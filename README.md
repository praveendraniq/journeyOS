# JourneyOS

JourneyOS is a mock-first hackathon MVP for planning, booking, managing, and dynamically re-optimizing a group trip in one conversational flow.

## What is included

- Voice-style trip planner with structured preference extraction
- Four-person traveler profile and combined group preference model
- Sabre-shaped flight and hotel search endpoints with sandbox-ready adapters
- PayPal-shaped order and split-payment flow with a demo fallback
- Route optimization using opening hours, geography, travel time, and weather constraints
- Animated Japan journey map, itinerary timeline, Operations Center, and Travel DNA learning
- Optional Landing AI receipt analysis endpoint with a demo OCR fallback

## Run locally

Use Node 20+ and pnpm 9+.

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Open `http://localhost:5173`. The API is at `http://localhost:8787`.

```bash
pnpm build
pnpm lint
```

## Demo sequence

1. Open the Voice Planner and submit: “Plan a 5-day Japan trip for four people under $6,000.”
2. Review the group preference rationale and choose a flight and hotel.
3. Open Checkout and create a split order.
4. In Operations Center, trigger **Running late +90m** and then **Heavy rain**.
5. Watch the route, itinerary, budget, and Travel DNA update.

### Test with real voice

Open the app in Chrome or Edge, select **Voice planner**, click the microphone, and allow microphone access when prompted. Speak the request naturally, review the live transcript, then click **Create my trip brief**. Browsers without the Web Speech API can still use the editable transcript field.

## API integration modes

`MOCK_MODE=true` is the default: no account, key, or internet access is needed for the polished demo. Set it to `false` and configure credentials to activate the service adapters.

- `SabreService` requests Sabre OAuth and normalizes flight and hotel results.
- `PayPalService` uses PayPal Orders APIs when credentials are present; otherwise it creates a mock order that can be captured by the demo UI.
- `VocalBridgeService` forwards an audio/transcript payload to a configured Vocal Bridge endpoint; the UI safely uses text-to-plan in mock mode.
- `LandingAiService` accepts receipt metadata and returns normalized receipt data in mock mode.

## Architecture

```
client/             React + TypeScript + Tailwind dashboard
server/             Express + TypeScript REST API
server/src/services provider adapters and trip intelligence
server/src/store    seeded JSON-backed MVP repository
server/src/db       portable SQL schema for SQLite/PostgreSQL deployment
```

The demo repository is intentionally JSON-backed so it runs without native database dependencies. `server/src/db/schema.sql` contains the normalized SQLite/PostgreSQL-ready schema and `DemoStore` is the narrow persistence seam to replace for a production database.
