CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  referred_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  refresh_token_hash TEXT NOT NULL,
  device_id TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  device_fingerprint_hash TEXT NOT NULL,
  device_name TEXT,
  last_seen_at TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS plans (
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

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL,
  ends_at TEXT,
  changed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_ledger (
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

CREATE TABLE IF NOT EXISTS usage_daily (
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

CREATE TABLE IF NOT EXISTS usage_monthly (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  business_month TEXT NOT NULL,
  plan_id_snapshot TEXT NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, business_month)
);

CREATE TABLE IF NOT EXISTS orders (
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
  expires_at TEXT NOT NULL,
  paid_at TEXT,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL REFERENCES orders(id),
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  processed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_imports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  original_file_name TEXT NOT NULL,
  original_format TEXT NOT NULL,
  original_mime_type TEXT NOT NULL,
  original_size_bytes INTEGER NOT NULL,
  original_sha256 TEXT NOT NULL,
  original_file_bytes BYTEA NOT NULL,
  columns_json TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  import_options_json TEXT NOT NULL,
  parsed_rows_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_records (
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

CREATE TABLE IF NOT EXISTS workspace_leases (
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

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id),
  refresh_token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
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

INSERT INTO plans (
  id,
  display_name,
  card_tier,
  unit_price_cents,
  daily_limit,
  workspace_limit,
  minimum_top_up_credits,
  template_limit,
  status
) VALUES
  ('free', '免费版', 'FREE', 0, 10, 1, 0, 1, 'active'),
  ('advanced', '进阶版', 'PLUS', 40, 200, 2, 2000, 2, 'active'),
  ('professional', '专业版', 'PRO', 30, 500, 3, 5000, 4, 'active'),
  ('business', '商业版', 'ULTRA', 20, 1000, 5, 20000, 8, 'active')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  card_tier = EXCLUDED.card_tier,
  unit_price_cents = EXCLUDED.unit_price_cents,
  daily_limit = EXCLUDED.daily_limit,
  workspace_limit = EXCLUDED.workspace_limit,
  minimum_top_up_credits = EXCLUDED.minimum_top_up_credits,
  template_limit = EXCLUDED.template_limit,
  status = EXCLUDED.status;

INSERT INTO admin_users (
  id,
  username,
  password_hash,
  role,
  status,
  created_at,
  updated_at
) VALUES (
  'admin-preview',
  'yojiro',
  'scrypt:addwhatsappdevsalt0011223344:f364dc6d774e4c1d1ea990f0cef9a65b5b7d0bba1c2909db2740744068b96ab89be89431031225da73fe988fd37bfec57954c330405ae36e3fd2fb5547c20631',
  'owner',
  'active',
  '2026-05-26T00:00:00.000Z',
  '2026-05-26T00:00:00.000Z'
)
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;
