CREATE TABLE IF NOT EXISTS users (
  wallet_address TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_wallet TEXT NOT NULL,
  app_attest_key_id TEXT,
  public_key_jwk TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_wallet) REFERENCES users(wallet_address)
);

CREATE TABLE IF NOT EXISTS commitments (
  id TEXT PRIMARY KEY,
  user_wallet TEXT NOT NULL,
  failure_recipient TEXT NOT NULL,
  token_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  goal_kind TEXT NOT NULL CHECK (goal_kind IN ('screen_time', 'steps')),
  goal_hash TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  proof_due_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL,
  funding_tx_hash TEXT,
  contract_address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_wallet) REFERENCES users(wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_commitments_user_status
  ON commitments (user_wallet, status);

CREATE INDEX IF NOT EXISTS idx_commitments_due
  ON commitments (status, proof_due_at);

CREATE TABLE IF NOT EXISTS proof_events (
  id TEXT PRIMARY KEY,
  commitment_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  observed_value INTEGER,
  reason TEXT,
  payload_hash TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  device_id TEXT,
  UNIQUE (commitment_id),
  FOREIGN KEY (commitment_id) REFERENCES commitments(id)
);

CREATE TABLE IF NOT EXISTS settlement_attempts (
  id TEXT PRIMARY KEY,
  commitment_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  tx_hash TEXT,
  error TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (commitment_id) REFERENCES commitments(id)
);

CREATE TABLE IF NOT EXISTS event_cursors (
  contract_address TEXT PRIMARY KEY,
  last_block INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
