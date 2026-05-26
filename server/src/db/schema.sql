CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  referred_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  refresh_token_hash TEXT NOT NULL,
  device_id TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  device_fingerprint_hash TEXT NOT NULL,
  device_name TEXT,
  last_seen_at TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  card_tier TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  daily_limit INTEGER NOT NULL,
  workspace_limit INTEGER NOT NULL,
  minimum_top_up_credits INTEGER NOT NULL,
  template_limit INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL,
  ends_at TEXT,
  changed_at TEXT NOT NULL
);

CREATE TABLE credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  related_order_id TEXT,
  related_task_id TEXT,
  related_contact_hash TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE usage_daily (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  business_date TEXT NOT NULL,
  plan_id_snapshot TEXT NOT NULL,
  daily_limit INTEGER NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, business_date)
);

CREATE TABLE usage_monthly (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  business_month TEXT NOT NULL,
  plan_id_snapshot TEXT NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, business_month)
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  plan_id TEXT NOT NULL REFERENCES plans(id),
  credits INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  payment_provider TEXT,
  provider_trade_no TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  closed_at TEXT
);

CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL REFERENCES orders(id),
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  processed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE referral_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE referral_records (
  id TEXT PRIMARY KEY,
  referrer_user_id TEXT NOT NULL REFERENCES users(id),
  referred_user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL,
  reward_credits INTEGER NOT NULL DEFAULT 0,
  reward_ledger_id TEXT,
  first_paid_order_id TEXT,
  created_at TEXT NOT NULL,
  rewarded_at TEXT
);

CREATE TABLE workspace_leases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  device_id TEXT NOT NULL,
  workspace_kind TEXT NOT NULL,
  process_nonce TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  renewed_at TEXT,
  released_at TEXT
);

CREATE TABLE admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  ip TEXT,
  created_at TEXT NOT NULL
);
