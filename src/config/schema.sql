-- WINGO BACKEND - SUPABASE POSTGRESQL SCHEMA
-- This SQL schema creates all required tables for the B2B Gaming API Platform

-- ============================================================================
-- ENUMS & TYPES
-- ============================================================================

CREATE TYPE round_status AS ENUM ('PENDING', 'ACTIVE', 'CLOSED', 'SETTLED');
CREATE TYPE bet_status AS ENUM ('PENDING', 'WON', 'LOST', 'CANCELLED');
CREATE TYPE bet_type AS ENUM ('COLORBET', 'SIZEBET', 'NUMBERBET');
CREATE TYPE color_option AS ENUM ('RED', 'GREEN', 'VIOLET');
CREATE TYPE size_option AS ENUM ('SMALL', 'BIG');
CREATE TYPE ledger_type AS ENUM ('DEBIT', 'CREDIT', 'FEE', 'BONUS', 'ADMIN_ADJUSTMENT');
CREATE TYPE api_key_status AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE game_mode AS ENUM ('MAX_PROFIT', 'MAX_LOSS');

-- ============================================================================
-- ADMIN TABLE (Platform Operators)
-- ============================================================================

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  platform_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'ACTIVE',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

CREATE INDEX idx_admins_username ON admins(username);

-- ============================================================================
-- API KEYS TABLE (Admin Authentication)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  api_key VARCHAR(32) UNIQUE NOT NULL,
  api_secret_hash VARCHAR(255) NOT NULL,
  status api_key_status DEFAULT 'ACTIVE',
  permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
  rate_limit_requests INTEGER DEFAULT 10000,
  rate_limit_burst INTEGER DEFAULT 500,
  ip_whitelist TEXT[] DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP,
  expires_at TIMESTAMP,
  created_by VARCHAR(100),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_admin_id ON api_keys(admin_id);
CREATE INDEX idx_api_keys_api_key ON api_keys(api_key);
CREATE UNIQUE INDEX idx_api_keys_active ON api_keys(api_key) WHERE status = 'ACTIVE';

-- ============================================================================
-- USERS TABLE (Players)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  profile JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  UNIQUE(admin_id, username)
);

CREATE INDEX idx_users_admin_id ON users(admin_id);
CREATE INDEX idx_users_admin_username ON users(admin_id, username);

-- ============================================================================
-- WALLETS TABLE (Player Balances)
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  balance DECIMAL(20, 2) DEFAULT 0,
  locked DECIMAL(20, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_admin_id ON wallets(admin_id);

-- ============================================================================
-- LEDGER TABLE (Transaction History)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  round_id VARCHAR(20),
  bet_id UUID,
  type ledger_type NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  balance_after DECIMAL(20, 2),
  meta JSONB DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ledgers_user_id ON ledgers(user_id);
CREATE INDEX idx_ledgers_admin_id ON ledgers(admin_id);
CREATE INDEX idx_ledgers_round_id ON ledgers(round_id);
CREATE INDEX idx_ledgers_created_at ON ledgers(created_at DESC);

-- ============================================================================
-- ROUNDS TABLE (Game Rounds)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  round_id VARCHAR(20) UNIQUE NOT NULL,
  status round_status DEFAULT 'PENDING',
  result_number INTEGER,
  result_color color_option,
  result_size size_option,
  game_mode game_mode DEFAULT 'MAX_PROFIT',
  frozen_result JSONB,
  total_bets DECIMAL(20, 2) DEFAULT 0,
  total_exposure_color JSONB DEFAULT '{}',
  total_exposure_size JSONB DEFAULT '{}',
  total_exposure_number JSONB DEFAULT '{}',
  total_payout DECIMAL(20, 2) DEFAULT 0,
  start_ts TIMESTAMP,
  end_ts TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP
);

CREATE INDEX idx_rounds_admin_id ON rounds(admin_id);
CREATE INDEX idx_rounds_round_id ON rounds(round_id);
CREATE INDEX idx_rounds_status ON rounds(status);
CREATE INDEX idx_rounds_admin_status ON rounds(admin_id, status);

-- ============================================================================
-- BETS TABLE (Individual Bets)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_id VARCHAR(20) NOT NULL REFERENCES rounds(round_id),
  bet_type bet_type NOT NULL,
  option_selected VARCHAR(20),
  amount DECIMAL(20, 2) NOT NULL,
  payout_amount DECIMAL(20, 2) DEFAULT 0,
  status bet_status DEFAULT 'PENDING',
  multiplier DECIMAL(5, 2),
  fee_amount DECIMAL(20, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP
);

CREATE INDEX idx_bets_admin_id ON bets(admin_id);
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_round_id ON bets(round_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_bets_admin_round ON bets(admin_id, round_id);
CREATE INDEX idx_bets_admin_user ON bets(admin_id, user_id);

-- ============================================================================
-- GAME SETTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL UNIQUE REFERENCES admins(id) ON DELETE CASCADE,
  round_duration_seconds INTEGER DEFAULT 30,
  betting_freeze_seconds INTEGER DEFAULT 5,
  initial_player_balance DECIMAL(20, 2) DEFAULT 1000,
  min_bet DECIMAL(20, 2) DEFAULT 10,
  max_bet DECIMAL(20, 2) DEFAULT 100000,
  house_edge_percent DECIMAL(5, 2) DEFAULT 2,
  max_payout_percent DECIMAL(5, 2) DEFAULT 95,
  color_multiplier JSONB DEFAULT '{"RED": 2.0, "GREEN": 2.0, "VIOLET": 12.0}',
  size_multiplier JSONB DEFAULT '{"SMALL": 2.0, "BIG": 2.0}',
  number_multiplier JSONB DEFAULT '{}',
  violet_cap INTEGER DEFAULT 10,
  auto_settle BOOLEAN DEFAULT TRUE,
  force_mode game_mode DEFAULT 'MAX_PROFIT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_game_settings_admin_id ON game_settings(admin_id);

-- ============================================================================
-- AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  changes JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  status VARCHAR(20),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ============================================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================================================

-- Player Statistics View
CREATE VIEW player_stats AS
SELECT
  u.id as user_id,
  u.admin_id,
  u.username,
  COUNT(DISTINCT b.id) as total_bets,
  COUNT(DISTINCT CASE WHEN b.status = 'WON' THEN b.id END) as bets_won,
  COUNT(DISTINCT CASE WHEN b.status = 'LOST' THEN b.id END) as bets_lost,
  SUM(b.amount) as total_wagered,
  SUM(CASE WHEN b.status = 'WON' THEN b.payout_amount ELSE 0 END) as total_winnings,
  w.balance as current_balance
FROM users u
LEFT JOIN bets b ON u.id = b.user_id
LEFT JOIN wallets w ON u.id = w.user_id
GROUP BY u.id, u.admin_id, u.username, w.balance;

-- Round Statistics View
CREATE VIEW round_stats AS
SELECT
  r.admin_id,
  r.round_id,
  r.status,
  COUNT(DISTINCT b.user_id) as unique_players,
  COUNT(b.id) as total_bets,
  SUM(b.amount) as total_wagered,
  SUM(CASE WHEN b.status = 'WON' THEN b.payout_amount ELSE 0 END) as total_payouts,
  (SUM(b.amount) - SUM(CASE WHEN b.status = 'WON' THEN b.payout_amount ELSE 0 END)) as house_profit
FROM rounds r
LEFT JOIN bets b ON r.round_id = b.round_id
GROUP BY r.admin_id, r.round_id, r.status;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for admins table
CREATE TRIGGER update_admins_updated_at
BEFORE UPDATE ON admins
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for wallets table
CREATE TRIGGER update_wallets_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for bets table
CREATE TRIGGER update_bets_updated_at
BEFORE UPDATE ON bets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for rounds table
CREATE TRIGGER update_rounds_updated_at
BEFORE UPDATE ON rounds
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for api_keys table
CREATE TRIGGER update_api_keys_updated_at
BEFORE UPDATE ON api_keys
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for game_settings table
CREATE TRIGGER update_game_settings_updated_at
BEFORE UPDATE ON game_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Note: Enable RLS on tables as needed for your security model
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX idx_bets_user_round_status ON bets(user_id, round_id, status);
CREATE INDEX idx_rounds_admin_created ON rounds(admin_id, created_at DESC);
CREATE INDEX idx_wallets_admin_balance ON wallets(admin_id, balance DESC);

-- Full text search index (optional)
CREATE INDEX idx_users_username_search ON users USING GIN(to_tsvector('english', username));
