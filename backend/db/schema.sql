CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  password_hash TEXT,
  age INT CHECK (age >= 0 AND age <= 120),
  gender TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  phone TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_age_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_age_check CHECK (age >= 0 AND age <= 120);
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_email_key;
  END IF;
END $$;
ALTER TABLE users DROP COLUMN IF EXISTS email;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_phone_key UNIQUE (phone);
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (email) WHERE email IS NOT NULL';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique_idx ON users (google_id) WHERE google_id IS NOT NULL;
ALTER TABLE users
  ALTER COLUMN created_at TYPE TIMESTAMPTZ
  USING created_at AT TIME ZONE 'UTC';
ALTER TABLE users
  ALTER COLUMN created_at SET DEFAULT NOW();

CREATE TABLE IF NOT EXISTS symptom_queries (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  symptoms_text TEXT NOT NULL,
  prediction_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE symptom_queries
  ALTER COLUMN created_at TYPE TIMESTAMPTZ
  USING created_at AT TIME ZONE 'UTC';
ALTER TABLE symptom_queries
  ALTER COLUMN created_at SET DEFAULT NOW();

CREATE TABLE IF NOT EXISTS voice_analysis_results (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  audio_path TEXT NOT NULL,
  prediction_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE voice_analysis_results
  ALTER COLUMN created_at TYPE TIMESTAMPTZ
  USING created_at AT TIME ZONE 'UTC';
ALTER TABLE voice_analysis_results
  ALTER COLUMN created_at SET DEFAULT NOW();

CREATE TABLE IF NOT EXISTS user_metrics (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_value DOUBLE PRECISION NOT NULL,
  metric_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_metrics
  ALTER COLUMN created_at TYPE TIMESTAMPTZ
  USING created_at AT TIME ZONE 'UTC';
ALTER TABLE user_metrics
  ALTER COLUMN created_at SET DEFAULT NOW();

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  message TEXT NOT NULL,
  extracted_symptoms JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE chat_messages
  ALTER COLUMN created_at TYPE TIMESTAMPTZ
  USING created_at AT TIME ZONE 'UTC';
ALTER TABLE chat_messages
  ALTER COLUMN created_at SET DEFAULT NOW();
