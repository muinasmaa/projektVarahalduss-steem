-- Varahaldussüsteemi MVP SQLite skeem

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  asset_id TEXT PRIMARY KEY,
  name TEXT NOT NULL default '',
  subgroup TEXT NOT NULL default '',
  status TEXT NOT NULL CHECK (status IN ('IN_STOCK', 'ASSIGNED', 'WRITTEN_OFF')),
  purchase_date TEXT NOT NULL,
  expected_life_months INTEGER NOT NULL default 36,
  warranty_end_date TEXT NOT NULL,
  invoice_number TEXT NOT NULL default '',
  current_responsible_name TEXT,
  current_room TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_subgroup ON assets(subgroup);
CREATE INDEX IF NOT EXISTS idx_assets_responsible ON assets(current_responsible_name);

CREATE TABLE IF NOT EXISTS operations (
  operation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('ISSUE', 'RETURN')),
  number TEXT NOT NULL UNIQUE,
  timestamp TEXT NOT NULL,
  created_by TEXT NOT NULL default 'ATK',
  employee_name TEXT NOT NULL,
  room TEXT,
  ticket TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_operations_timestamp ON operations(timestamp DESC);

CREATE TABLE IF NOT EXISTS operation_assets (
  operation_id INTEGER NOT NULL REFERENCES operations(operation_id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(asset_id),
  PRIMARY KEY (operation_id, asset_id)
);
