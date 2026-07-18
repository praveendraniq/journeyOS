import assert from 'node:assert/strict';
import test from 'node:test';
import { knownBookingTotal } from './payment.service.js';
import { weatherCodeLabel } from './weather.service.js';
import { mergeStructuredTripRequest, tripRequestMissingFields, VocalBridgeService } from './voice-planner.service.js';

test('pre-trip checkout includes flight and hotel but excludes variable expenses', () => {
  const trip = { budget: { total: 6_000, spent: 4_200, remaining: 1_800, flight: 2_400, hotel: 600, activities: 700, food: 500 } };
  assert.equal(knownBookingTotal(trip), 3_000);
  assert.notEqual(knownBookingTotal(trip), trip.budget.spent);
});

test('weather codes use human-readable WMO condition labels', () => {
  assert.equal(weatherCodeLabel(0), 'Clear sky');
  assert.equal(weatherCodeLabel(63), 'Rain');
  assert.equal(weatherCodeLabel(95), 'Thunderstorms');
});

test('voice extraction accepts spoken Indian city names without a city lookup table', async () => {
  const planner = new VocalBridgeService();
  const detailed = await planner.extractTrip('Plan a 6-day trip from Bengaluru to Jaipur for 2 people under $5000 with food and history.');
  const sparse = await planner.extractTrip('Maybe Jaipur.');
  assert.equal(detailed.request.origin, 'Bengaluru');
  assert.equal(detailed.request.destination, 'Jaipur');
  assert.equal(detailed.request.travelers, 2);
  assert.notEqual(detailed.confidence, 0.94);
  assert.ok(detailed.confidence > sparse.confidence);
});

test('incomplete voice transcripts never fall back to the seeded Japan trip', async () => {
  const planner = new VocalBridgeService();
  const result = await planner.extractTrip('Goodbye, please hang up.');
  assert.equal(result.request.destination, '');
  assert.equal(result.request.duration, 0);
  assert.ok(result.missingFields.includes('destination'));
  assert.ok(result.missingFields.includes('exact departure and return dates'));
});

test('a duration alone cannot replace required departure and return dates', async () => {
  const planner = new VocalBridgeService();
  const result = await planner.extractTrip('Plan a 4-day trip from San Francisco to Honolulu for 2 travelers with a budget of $4000. Priorities are history and food. We prefer a slow pace and vegetarian food.');
  assert.equal(result.request.origin, 'San Francisco');
  assert.equal(result.request.destination, 'Honolulu');
  assert.ok(result.missingFields.includes('exact departure and return dates'));
  assert.ok(!result.missingFields.includes('places of interest or activities'));
  assert.ok(!result.missingFields.includes('preferred pace'));
  assert.ok(!result.missingFields.includes('food preferences or dietary requirements'));
});

test('voice extraction accepts destination-first polished summaries', async () => {
  const planner = new VocalBridgeService();
  const result = await planner.extractTrip('Plan a slow trip for 2 travelers to Honolulu, departing from San Francisco on October 12, 2026 and returning October 15, 2026, with a total budget of $4,000. Priorities are history and food. Food preferences: vegetarian friendly.');
  assert.equal(result.request.origin, 'San Francisco');
  assert.equal(result.request.destination, 'Honolulu');
  assert.equal(result.request.departureDate, '2026-10-12');
  assert.equal(result.request.returnDate, '2026-10-15');
  assert.deepEqual(result.missingFields, []);
});

test('voice extraction completes a brief from cumulative short-call answers', async () => {
  const planner = new VocalBridgeService();
  const result = await planner.extractTrip('Plan a trip from San Francisco to Honolulu. Priorities are history and food. We prefer a slow pace and vegetarian food. Departure is October 12, 2026 and return is October 15, 2026. 2 travelers. $4000 total budget.');
  assert.equal(result.request.origin, 'San Francisco');
  assert.equal(result.request.destination, 'Honolulu');
  assert.equal(result.request.travelers, 2);
  assert.equal(result.request.budget, 4000);
  assert.deepEqual(result.missingFields, []);
});

test('voice extraction uses short answers in mediator-question context', async () => {
  const planner = new VocalBridgeService();
  const result = await planner.extractTrip('Plan a slow trip from San Francisco to Honolulu. Priorities are history and food. Food preferences: vegetarian friendly. agent: What are your exact departure and return dates? user: October 12, 2026 and October 15, 2026. agent: How many travelers are there in total, including you? user: Two. agent: What is the total group budget? user: Four thousand dollars.');
  assert.equal(result.request.travelers, 2);
  assert.equal(result.request.budget, 4000);
  assert.equal(result.request.departureDate, '2026-10-12');
  assert.equal(result.request.returnDate, '2026-10-15');
  assert.deepEqual(result.missingFields, []);
});

test('structured Vocal Bridge fields override transcript extraction without destination hardcoding', async () => {
  const planner = new VocalBridgeService();
  const extracted = await planner.extractTrip('We are considering Tokyo, but the confirmed trip details are in the action payload.');
  const request = mergeStructuredTripRequest(extracted.request, {
    origin: 'Bengaluru',
    destination: 'Jaipur',
    departureDate: '2026-11-02',
    returnDate: '2026-11-06',
    travelers: 3,
    budget: 5200,
    travelStyle: 'balanced',
    interests: ['history', 'food'],
    foodPreferences: ['vegetarian'],
  });
  assert.equal(request.origin, 'Bengaluru');
  assert.equal(request.destination, 'Jaipur');
  assert.equal(request.duration, 5);
  assert.deepEqual(tripRequestMissingFields(request), []);
});
