-- Portable MVP schema. SQLite uses TEXT UUIDs; PostgreSQL may replace them with UUID.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  destination TEXT NOT NULL,
  starts_on TEXT,
  ends_on TEXT,
  budget_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE travelers (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  name TEXT NOT NULL,
  budget_preference TEXT NOT NULL,
  activity_level INTEGER NOT NULL,
  pace_preference TEXT NOT NULL,
  food_preference TEXT NOT NULL
);

CREATE TABLE preferences (
  id TEXT PRIMARY KEY,
  traveler_id TEXT NOT NULL REFERENCES travelers(id),
  category TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5)
);

CREATE TABLE itinerary_items (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  day_number INTEGER NOT NULL,
  starts_at TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  latitude REAL,
  longitude REAL,
  status TEXT NOT NULL DEFAULT 'upcoming'
);

CREATE TABLE trip_events (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE travel_dna_scores (
  id TEXT PRIMARY KEY,
  traveler_id TEXT NOT NULL REFERENCES travelers(id),
  category TEXT NOT NULL,
  score INTEGER NOT NULL,
  observed_minutes INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
