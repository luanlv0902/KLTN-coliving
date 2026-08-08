CREATE SCHEMA IF NOT EXISTS ai;

CREATE TABLE IF NOT EXISTS ai.user_profiles (
  user_id text PRIMARY KEY,
  email text,
  full_name text,
  role text,
  budget_min_vnd bigint,
  budget_max_vnd bigint,
  preferred_district text,
  lifestyle_archetype text,
  priority_cleanliness integer,
  priority_social_environment integer,
  accept_smoking_roommates boolean,
  accept_pets boolean,
  source_updated_at timestamptz,
  projected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai.room_profiles (
  room_id text PRIMARY KEY,
  title text,
  address text,
  district text,
  district_id text,
  latitude double precision,
  longitude double precision,
  price_value numeric,
  owner_id text,
  status text,
  cleanliness_required text,
  noise_tolerance text,
  guest_policy text,
  preferred_sleep_habit text,
  max_occupants integer,
  current_occupants integer,
  allow_smoking boolean,
  allow_pets boolean,
  source_updated_at timestamptz,
  projected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai.occupancy_profiles (
  room_id text NOT NULL,
  user_id text NOT NULL,
  status text NOT NULL,
  source_updated_at timestamptz,
  projected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS ai.room_interactions (
  interaction_id text PRIMARY KEY,
  user_id text NOT NULL,
  room_id text NOT NULL,
  interaction_type text NOT NULL,
  interaction_value double precision NOT NULL DEFAULT 1,
  source_created_at timestamptz,
  projected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai.processed_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  source_service text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai.projection_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'RUNNING',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);

CREATE INDEX IF NOT EXISTS ai_reconciliation_runs_started_idx
  ON ai.projection_reconciliation_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS ai_occupancy_room_status_idx
  ON ai.occupancy_profiles (room_id, status);
CREATE INDEX IF NOT EXISTS ai_interactions_user_idx
  ON ai.room_interactions (user_id);
CREATE INDEX IF NOT EXISTS ai_interactions_room_idx
  ON ai.room_interactions (room_id);
