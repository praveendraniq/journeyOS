import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { config } from './config.js';
import { DemoStore } from './store/demo-store.js';
import { LandingAiService } from './services/landing-ai.service.js';
import { PayPalService } from './services/payment.service.js';
import { RouteOptimizer } from './services/route-optimizer.service.js';
import { SabreService } from './services/sabre.service.js';
import { VocalBridgeService } from './services/voice-planner.service.js';
import { JourneyAgentCoordinator } from './agents/journey-orchestrator.js';
import type { PaymentOrder, TripEvent } from './types.js';

const replanSchema = z.object({ type: z.enum(['late', 'rain', 'flight-delay', 'closed', 'tired']) });
const requestSchema = z.object({ conversation: z.string().min(3).max(1000) });
const agentQuerySchema = z.object({ query: z.string().trim().min(3).max(1000) });
const selectionSchema = z.object({ id: z.string().min(1) });
const inventorySearchSchema = z.object({
  origin: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  destination: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  departureDate: z.string().date(),
  returnDate: z.string().date().optional(),
  checkInDate: z.string().date(),
  checkOutDate: z.string().date(),
}).superRefine((input, context) => {
  if (input.checkInDate < input.departureDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['checkInDate'], message: 'Check-in must be on or after the departure date.' });
  if (input.returnDate && input.returnDate < input.departureDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['returnDate'], message: 'Return date must be on or after the departure date.' });
  if (input.returnDate && input.checkOutDate > input.returnDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['checkOutDate'], message: 'Check-out must be on or before the return date.' });
  if (input.checkOutDate < input.checkInDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['checkOutDate'], message: 'Check-out must be after check-in.' });
});
const travelDatesSchema = z.object({
  departureDate: z.string().date(),
  returnDate: z.string().date().optional(),
  checkInDate: z.string().date(),
  checkOutDate: z.string().date(),
}).superRefine((input, context) => {
  if (input.checkInDate < input.departureDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['checkInDate'], message: 'Check-in must be on or after departure.' });
  if (input.returnDate && input.returnDate < input.departureDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['returnDate'], message: 'Return must be on or after departure.' });
  if (input.returnDate && input.checkOutDate > input.returnDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['checkOutDate'], message: 'Check-out must be on or before return.' });
  if (input.checkOutDate < input.checkInDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['checkOutDate'], message: 'Check-out must be after check-in.' });
});
const receiptSchema = z.object({ amount: z.number().positive().optional(), restaurant: z.string().min(1).optional(), fileName: z.string().optional() });
const voiceTokenSchema = z.object({ participant_name: z.string().trim().min(1).max(80).optional(), session_id: z.string().trim().min(1).max(120).optional() });

export const createApp = () => {
  const store = new DemoStore();
  const sabre = new SabreService(store.getTrip());
  const planner = new VocalBridgeService();
  const payments = new PayPalService();
  const routeOptimizer = new RouteOptimizer();
  const receipts = new LandingAiService();
  const agents = new JourneyAgentCoordinator();
  const orders = new Map<string, PaymentOrder>();
  const voiceTokenWindows = new Map<string, { count: number; resetAt: number }>();
  const app = express();

  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) =>
    res.json({
      ok: true,
      mockMode: config.mockMode,
      integrations: {
        vocalBridge: Boolean(config.vocalBridge.apiKey && config.vocalBridge.agentId),
        sabre: Boolean(config.sabre.accessToken || (config.sabre.eprUsername && config.sabre.eprPassword)),
        paypal: Boolean(config.paypal.clientId && config.paypal.clientSecret),
      },
    }),
  );
  app.get('/api/trips/demo', (_req, res) => res.json({ trip: store.getTrip(), mode: config.mockMode ? 'demo' : 'live' }));
  app.get('/api/agents', (_req, res) => res.json(agents.snapshot()));

  const issueVoiceToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      if (!config.vocalBridge.apiKey) return res.status(503).json({ error: 'Vocal Bridge is not configured on the server.' });
      const now = Date.now();
      const rateKey = req.ip || 'local';
      const window = voiceTokenWindows.get(rateKey);
      const nextWindow = !window || window.resetAt <= now ? { count: 1, resetAt: now + 60_000 } : { ...window, count: window.count + 1 };
      voiceTokenWindows.set(rateKey, nextWindow);
      if (nextWindow.count > 20) return res.status(429).json({ error: 'Too many voice sessions. Please wait a minute and try again.' });

      const input = voiceTokenSchema.parse(req.method === 'GET' ? {
        participant_name: typeof req.query.participant_name === 'string' ? req.query.participant_name : undefined,
        session_id: typeof req.query.session_id === 'string' ? req.query.session_id : undefined,
      } : req.body ?? {});
      const headers: Record<string, string> = { 'X-API-Key': config.vocalBridge.apiKey, 'Content-Type': 'application/json' };
      if (config.vocalBridge.agentId) headers['X-Agent-Id'] = config.vocalBridge.agentId;
      const response = await fetch(new URL('/api/v1/token', config.vocalBridge.apiUrl).toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify({ participant_name: input.participant_name ?? 'JourneyOS traveler', ...(input.session_id ? { session_id: input.session_id } : {}) }),
      });
      if (!response.ok) {
        const messages: Record<number, string> = {
          400: 'Vocal Bridge requires a deployed agent ID. Set VOCAL_BRIDGE_AGENT_ID on the server.',
          401: 'Vocal Bridge rejected the API key.',
          403: 'Vocal Bridge usage is not enabled for this account.',
          404: 'The configured Vocal Bridge agent was not found.',
        };
        return res.status(response.status).json({ error: messages[response.status] ?? `Vocal Bridge token request failed with status ${response.status}.` });
      }
      res.json(await response.json());
    } catch (error) { next(error); }
  };
  app.get('/api/voice-token', issueVoiceToken);
  app.post('/api/voice-token', issueVoiceToken);

  app.post('/api/agents/query', async (req, res, next) => {
    const run = agents.start('Answer a Vocal Bridge query through the Journey Orchestrator');
    try {
      const { query } = agentQuerySchema.parse(req.body);
      const value = query.toLowerCase();
      let trip = store.getTrip();
      let response = '';

      if (/\b(pay|payment|checkout|purchase|charge)\b/.test(value)) {
        await run.delegate('commerce', 'Protect the explicit payment-confirmation boundary', () => trip.budget, (budget) => `$${budget.spent.toLocaleString()} is ready for review`);
        response = `Your current trip total is $${trip.budget.spent.toLocaleString()}. For safety, open Booking and Checkout to review the split and explicitly confirm payment.`;
      } else if (/\b(budget|cost|spend|remaining|total)\b/.test(value)) {
        const budget = await run.delegate('commerce', 'Read the live shared budget', () => trip.budget, (current) => `$${current.remaining.toLocaleString()} remains`);
        response = `The group has planned $${budget.spent.toLocaleString()} of the $${budget.total.toLocaleString()} budget, leaving $${budget.remaining.toLocaleString()}.`;
      } else if (/\b(flight|hotel|stay|sabre)\b/.test(value)) {
        const inventory = await run.delegate('travel-inventory', 'Summarize the current normalized travel inventory', () => ({ flights: trip.flights, hotels: trip.hotels }), ({ flights, hotels }) => `${flights.length} flights and ${hotels.length} hotels available`);
        const selectedFlight = inventory.flights.find((flight) => flight.selected);
        const selectedHotel = inventory.hotels.find((hotel) => hotel.selected);
        response = `I have ${inventory.flights.length} flight options and ${inventory.hotels.length} hotel options. The current selections are ${selectedFlight?.airline ?? 'no flight yet'} and ${selectedHotel?.name ?? 'no hotel yet'}.`;
      } else if (/\b(rain|late|delay|closed|tired)\b/.test(value)) {
        const type: TripEvent['type'] = /rain/.test(value) ? 'rain' : /closed/.test(value) ? 'closed' : /tired/.test(value) ? 'tired' : /flight|delay/.test(value) ? 'flight-delay' : 'late';
        trip = await run.delegate('live-operations', 'Assess the spoken disruption and create the smallest safe patch', () => store.replan(type), (updatedTrip) => updatedTrip.events[0]?.title ?? 'Disruption assessed');
        await run.delegate('itinerary-route', 'Validate the revised itinerary sequence', () => routeOptimizer.optimize(trip.itinerary, { raining: type === 'rain' }), (items) => `${items.length} stops validated`);
        await run.delegate('travel-dna', 'Preserve group priorities in the revised plan', () => trip.travelDna, (dna) => dna.learning);
        response = trip.events[0]?.explanation ?? 'I updated the itinerary and preserved the group’s highest-priority moments.';
      } else if (/\b(route|itinerary|schedule|day)\b/.test(value)) {
        const itinerary = await run.delegate('itinerary-route', 'Summarize the optimized itinerary', () => routeOptimizer.optimize(trip.itinerary), (items) => `${items.length} stops across ${trip.request.duration} days`);
        response = `Your ${trip.request.duration}-day route has ${itinerary.length} planned stops. It groups nearby experiences, respects opening windows, and protects booked travel times.`;
      } else {
        const brief = await run.delegate('voice-preference', 'Extract a structured trip brief from the voice-agent query', () => planner.extractTrip(query), ({ request }) => `${request.duration} days in ${request.destination}`);
        trip = await run.delegate('travel-dna', 'Merge the voice brief with group preferences', () => store.updateFromRequest(brief.request), (updatedTrip) => updatedTrip.groupPreference.recommendedPace);
        await Promise.all([
          run.delegate('travel-inventory', 'Review available flight and hotel candidates', () => ({ flights: trip.flights.length, hotels: trip.hotels.length }), (inventory) => `${inventory.flights} flights and ${inventory.hotels} hotels ready`),
          run.delegate('itinerary-route', 'Validate the itinerary against the new brief', () => routeOptimizer.optimize(trip.itinerary), (items) => `${items.length} stops sequenced`),
        ]);
        response = `I created a ${brief.request.duration}-day ${brief.request.destination} brief for ${brief.request.travelers} travelers with a $${brief.request.budget.toLocaleString()} budget. I delegated inventory, route, and preference checks to the JourneyOS specialist agents.`;
      }

      res.json({ response, trip, agentRun: run.complete() });
    } catch (error) { next(error); }
  });

  app.post('/api/planner/extract', async (req, res, next) => {
    const run = agents.start('Turn a voice conversation into a coordinated trip plan');
    try {
      const { conversation } = requestSchema.parse(req.body);
      const result = await run.delegate(
        'voice-preference',
        'Extract the destination, duration, party, budget, interests, and food preferences',
        () => planner.extractTrip(conversation),
        ({ request }) => `Structured ${request.duration} days in ${request.destination} for ${request.travelers} travelers`,
      );
      const trip = await run.delegate(
        'travel-dna',
        'Merge the new brief with the group preference model',
        () => store.updateFromRequest(result.request),
        (updatedTrip) => `${updatedTrip.groupPreference.recommendedPace}; ${updatedTrip.request.interests.length} shared interests`,
      );
      await Promise.all([
        run.delegate(
          'travel-inventory',
          'Hold inventory search until the traveler supplies an exact route and future travel dates',
          () => ({ flights: trip.flights.length, hotels: trip.hotels.length }),
          ({ flights, hotels }) => `${flights} saved flights and ${hotels} saved hotels retained pending search details`,
        ),
        run.delegate(
          'itinerary-route',
          'Optimize the seeded itinerary around route distance and opening windows',
          () => routeOptimizer.optimize(trip.itinerary),
          (itinerary) => `Sequenced ${itinerary.length} stops across ${result.request.duration} days`,
        ),
      ]);
      const agentRun = run.complete();
      res.json({ ...result, trip, agentRun, summary: `${result.request.duration} days in ${result.request.destination} for ${result.request.travelers} travelers, with a $${result.request.budget.toLocaleString()} budget.` });
    } catch (error) { next(error); }
  });

  app.get('/api/flights/search', async (req, res, next) => {
    const run = agents.start('Search flight inventory');
    try {
      const results = await run.delegate(
        'travel-inventory',
        'Search and normalize flight offers',
        () => sabre.searchFlights({ origin: String(req.query.origin ?? 'SFO'), destination: String(req.query.destination ?? 'TYO'), departureDate: String(req.query.departureDate ?? '2026-10-12') }),
        (flights) => `Normalized ${flights.length} flight offers`,
      );
      res.json({ results, source: config.mockMode ? 'mock' : 'sabre', agentRun: run.complete() });
    }
    catch (error) { next(error); }
  });
  app.get('/api/hotels/search', async (req, res, next) => {
    const run = agents.start('Search hotel inventory');
    try {
      const results = await run.delegate(
        'travel-inventory',
        'Search and normalize hotel offers',
        () => sabre.searchHotels({ cityCode: String(req.query.cityCode ?? 'TYO'), checkInDate: String(req.query.checkInDate ?? '2026-10-12'), checkOutDate: String(req.query.checkOutDate ?? '2026-10-15') }),
        (hotels) => `Normalized ${hotels.length} hotel offers`,
      );
      res.json({ results, source: config.mockMode ? 'mock' : 'sabre', agentRun: run.complete() });
    }
    catch (error) { next(error); }
  });
  app.post('/api/inventory/search', async (req, res, next) => {
    const run = agents.start('Search live Sabre inventory');
    try {
      const input = inventorySearchSchema.parse(req.body);
      let results = await run.delegate(
        'travel-inventory',
        'Search and normalize live Sabre flight and hotel offers',
        async () => {
          const [flights, hotels] = await Promise.all([
            sabre.searchFlights(input),
            sabre.searchHotels({ cityCode: input.destination, checkInDate: input.checkInDate, checkOutDate: input.checkOutDate }),
          ]);
          return { flights, hotels };
        },
        (results) => `Found ${results.flights.length} flights and ${results.hotels.length} hotels`,
      );
      let usedInput = input;
      let message = results.flights.length > 0 ? 'Live Sabre flights and hotels are ready to review.' : 'No flights were available on the requested date.';
      if (results.flights.length === 0) {
        for (let offset = 1; offset <= 7; offset += 1) {
          const shiftDate = (date: string) => {
            const next = new Date(`${date}T12:00:00Z`);
            next.setUTCDate(next.getUTCDate() + offset);
            return next.toISOString().slice(0, 10);
          };
          const candidate = { ...input, departureDate: shiftDate(input.departureDate), checkInDate: shiftDate(input.checkInDate), checkOutDate: shiftDate(input.checkOutDate) };
          const flights = await run.delegate(
            'travel-inventory',
            `Search the next available departure date (+${offset} day${offset === 1 ? '' : 's'})`,
            () => sabre.searchFlights(candidate),
            (offers) => `${offers.length} flight offers on ${candidate.departureDate}`,
          );
          if (flights.length === 0) continue;
          const hotels = await run.delegate(
            'travel-inventory',
            'Refresh hotel inventory for the next available travel dates',
            () => sabre.searchHotels({ cityCode: candidate.destination, checkInDate: candidate.checkInDate, checkOutDate: candidate.checkOutDate }),
            (offers) => `${offers.length} hotel offers on the updated dates`,
          );
          results = { flights, hotels };
          usedInput = candidate;
          message = `No flights were available on ${input.departureDate}. Showing the next available options for ${candidate.departureDate}.`;
          break;
        }
        if (results.flights.length === 0) message = `No flights were available from ${input.departureDate} through the following 7 days. Try another route or later dates.`;
      }
      const cityNames: Record<string, string> = { PAR: 'Paris', CDG: 'Paris', ORY: 'Paris', LAX: 'Los Angeles', NYC: 'New York', JFK: 'New York', LHR: 'London', SFO: 'San Francisco', TYO: 'Tokyo', HND: 'Tokyo', NRT: 'Tokyo' };
      const currentRequest = store.getTrip().request;
      store.updateFromRequest({ ...currentRequest, destination: cityNames[input.destination] ?? input.destination, departureDate: usedInput.departureDate, returnDate: usedInput.returnDate });
      const trip = store.replaceInventory(results.flights, results.hotels);
      res.json({ trip, message, source: config.mockMode ? 'mock' : 'sabre-mcp', agentRun: run.complete() });
    } catch (error) { next(error); }
  });
  app.post('/api/trip/dates', (req, res, next) => {
    try {
      const dates = travelDatesSchema.parse(req.body);
      const trip = store.updateFromRequest({ ...store.getTrip().request, ...dates });
      res.json({ trip });
    } catch (error) { next(error); }
  });
  app.post('/api/bookings/flight', async (req, res, next) => {
    const run = agents.start('Select a flight and update the shared trip cost');
    try {
      const id = selectionSchema.parse(req.body).id;
      let trip = await run.delegate('travel-inventory', 'Apply the selected normalized flight offer', () => store.selectFlight(id), (updatedTrip) => updatedTrip.flights.find((flight) => flight.selected)?.code ?? 'Flight selected');
      const selectedFlight = trip.flights.find((flight) => flight.selected);
      if (selectedFlight) {
        const checkInDate = trip.request.departureDate ?? '2026-10-12';
        const derivedCheckout = new Date(`${checkInDate}T12:00:00Z`);
        derivedCheckout.setUTCDate(derivedCheckout.getUTCDate() + Math.max(1, trip.request.duration - 1));
        const checkOutDate = trip.request.returnDate && trip.request.returnDate < derivedCheckout.toISOString().slice(0, 10) ? trip.request.returnDate : derivedCheckout.toISOString().slice(0, 10);
        try {
          const hotels = await run.delegate('travel-inventory', 'Refresh hotels for the selected flight arrival airport', () => sabre.searchHotels({ cityCode: selectedFlight.arrival, checkInDate, checkOutDate }), (offers) => `${offers.length} hotels near ${selectedFlight.arrival}`);
          if (hotels.length > 0) trip = store.replaceHotels(hotels);
        } catch {
          // Keep the currently displayed hotels when a downstream provider is temporarily unavailable.
        }
      }
      await run.delegate('commerce', 'Recalculate the group total after the flight selection', () => trip.budget, (budget) => `$${budget.spent.toLocaleString()} planned; $${budget.remaining.toLocaleString()} remaining`);
      res.json({ trip, agentRun: run.complete() });
    }
    catch (error) { next(error); }
  });
  app.post('/api/bookings/hotel', async (req, res, next) => {
    const run = agents.start('Select a hotel and update the shared trip cost');
    try {
      const id = selectionSchema.parse(req.body).id;
      const trip = await run.delegate('travel-inventory', 'Apply the selected normalized hotel offer', () => store.selectHotel(id), (updatedTrip) => updatedTrip.hotels.find((hotel) => hotel.selected)?.name ?? 'Hotel selected');
      await run.delegate('commerce', 'Recalculate the group total after the hotel selection', () => trip.budget, (budget) => `$${budget.spent.toLocaleString()} planned; $${budget.remaining.toLocaleString()} remaining`);
      res.json({ trip, agentRun: run.complete() });
    }
    catch (error) { next(error); }
  });

  app.post('/api/itinerary/optimize', async (_req, res, next) => {
    const run = agents.start('Optimize the current daily itinerary');
    try {
      const trip = store.getTrip();
      const itinerary = await run.delegate('itinerary-route', 'Re-sequence stops within safe timing windows', () => routeOptimizer.optimize(trip.itinerary), (items) => `Optimized ${items.length} itinerary stops`);
      res.json({ itinerary, explanation: 'The route groups nearby stops, respects booked times and opening windows, and minimizes backtracking between Tokyo and Kyoto neighborhoods.', agentRun: run.complete() });
    } catch (error) { next(error); }
  });

  app.post('/api/operations/replan', async (req, res, next) => {
    const run = agents.start('Recover the live itinerary from a travel disruption');
    try {
      const { type } = replanSchema.parse(req.body);
      const trip = await run.delegate('live-operations', 'Assess the disruption and identify the smallest safe itinerary change', () => store.replan(type as TripEvent['type']), (updatedTrip) => updatedTrip.events[0]?.explanation ?? 'Impact assessed');
      const itinerary = await run.delegate('itinerary-route', 'Apply and validate the route patch', () => routeOptimizer.optimize(trip.itinerary, { raining: type === 'rain' }), (items) => `Validated ${items.length} stops after the change`);
      await run.delegate('travel-dna', 'Update preference signals from the live decision', () => trip.travelDna, (dna) => dna.learning);
      res.json({ trip, event: trip.events[0], itinerary, agentRun: run.complete() });
    } catch (error) { next(error); }
  });

  app.post('/api/payments/create-order', async (_req, res, next) => {
    const run = agents.start('Prepare a user-confirmed split payment');
    try {
      const trip = store.getTrip();
      const order = await run.delegate('commerce', 'Calculate the split and create a PayPal order draft', () => payments.createOrder(trip.budget.spent, trip.travelers), (created) => `${created.split.length} shares prepared for $${created.total.toLocaleString()}`);
      orders.set(order.id, order);
      res.json({ order, agentRun: run.complete() });
    } catch (error) { next(error); }
  });
  app.post('/api/payments/:orderId/capture', async (req, res, next) => {
    const run = agents.start('Capture a payment after explicit user confirmation');
    try {
      const order = orders.get(req.params.orderId);
      if (!order) return res.status(404).json({ error: 'Payment order not found' });
      const captured = await run.delegate('commerce', 'Capture the user-confirmed PayPal order', () => payments.captureOrder(order), (completed) => `Payment ${completed.status.toLowerCase()} for $${completed.total.toLocaleString()}`);
      orders.set(captured.id, captured);
      res.json({ order: captured, agentRun: run.complete() });
    } catch (error) { next(error); }
  });

  app.post('/api/receipts/analyze', async (req, res, next) => {
    const run = agents.start('Read a receipt and learn from actual trip spend');
    try {
      const result = await run.delegate('commerce', 'Read the receipt and extract the merchant and amount', () => receipts.analyzeReceipt(receiptSchema.parse(req.body)), (receipt) => `${String((receipt as { restaurant?: string }).restaurant ?? 'Receipt')} · $${Number((receipt as { amount?: number }).amount ?? 0).toFixed(2)}`);
      const amount = Number((result as { amount: number }).amount);
      const restaurant = String((result as { restaurant: string }).restaurant);
      const trip = store.addReceipt(amount, restaurant);
      await run.delegate('travel-dna', 'Strengthen the food preference signal from actual behavior', () => trip.travelDna, (dna) => dna.learning);
      res.json({ receipt: result, trip, agentRun: run.complete() });
    } catch (error) { next(error); }
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(', ') : error instanceof Error ? error.message : 'Unexpected error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  });

  return app;
};
