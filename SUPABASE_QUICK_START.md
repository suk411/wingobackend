# WINGO BACKEND - SUPABASE COMPLETE SETUP

## Quick Start (5 minutes)

### 1. Prerequisites
```bash
# Install Node.js 18+
node --version  # Should be >= 18.0.0

# Clone project
cd /workspaces/wingobackend

# Install dependencies
npm install
```

### 2. Create Supabase Project
1. Go to https://supabase.com
2. Sign up / Login
3. Click "New Project"
4. Fill in project details
5. Copy your API keys to `.env` file

### 3. Import Database Schema
```bash
# Copy connection string from Supabase dashboard
# Settings → Database → Connection string → psql

# Option 1: Via psql (fastest)
psql "postgres://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" < src/config/schema.sql

# Option 2: Via Supabase Dashboard
# Go to SQL Editor → New Query → Paste src/config/schema.sql → Run
```

### 4. Configure Environment
Create `.env` file in project root:
```bash
# Database
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# Server
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# JWT
JWT_SECRET=your_super_secret_key_at_least_32_characters_long
JWT_EXPIRES_IN=24h
JWT_ADMIN_EXPIRES_IN=48h

# Game
ROUND_DURATION_SECONDS=30
BETTING_FREEZE_SECONDS=5
INITIAL_PLAYER_BALANCE=1000

# Socket.io
SOCKET_CORS_ORIGINS=http://localhost:3001,http://localhost:3000
```

### 5. Start Server
```bash
# Development with auto-reload
npm run dev

# Production
npm run start
```

Server will be running on http://localhost:3000

---

## Complete Setup (Step-by-Step)

### Phase 1: Supabase Project Setup (10-15 minutes)

#### 1.1 Create Project
```bash
# Go to supabase.com and create a new project
# Note: Project creation takes 1-2 minutes
```

#### 1.2 Get Connection Details
After project is created:
1. Click your project
2. Go to **Settings → API**
3. Copy these values:
   - Project URL → `SUPABASE_URL`
   - anon public key → `SUPABASE_KEY`
   - service_role secret → `SUPABASE_SERVICE_ROLE_KEY`

#### 1.3 Import Database Schema
```sql
-- Method 1: SQL Editor (Dashboard)
-- 1. Go to SQL Editor
-- 2. Create New Query
-- 3. Paste entire content of src/config/schema.sql
-- 4. Click Run

-- Method 2: Terminal
psql "your_connection_string_here" < src/config/schema.sql

-- Verify tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

#### 1.4 Enable Realtime (Optional but Recommended)
1. Go to **Realtime** in sidebar
2. Click **"Manage realtime settings"**
3. Enable these tables:
   - ✓ `bets`
   - ✓ `rounds`
   - ✓ `wallets`
   - ✓ `ledgers`

---

### Phase 2: Backend Configuration (5-10 minutes)

#### 2.1 Create Environment File
```bash
# Create .env file
cat > .env << EOF
# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# JWT
JWT_SECRET=your_super_secret_key_at_least_32_characters_long_change_me
JWT_EXPIRES_IN=24h
JWT_ADMIN_EXPIRES_IN=48h

# Game
ROUND_DURATION_SECONDS=30
BETTING_FREEZE_SECONDS=5
INITIAL_PLAYER_BALANCE=1000
MIN_BET=10
MAX_BET=100000
HOUSE_EDGE_PERCENT=2

# Socket.io
SOCKET_CORS_ORIGINS=http://localhost:3001

# Logging
LOG_LEVEL=info
EOF
```

#### 2.2 Install Dependencies
```bash
# Remove old MongoDB dependencies
npm uninstall mongoose ioredis

# Install Supabase and other dependencies
npm install @supabase/supabase-js@^2.38.0
npm install
```

#### 2.3 Verify Configuration
```bash
# Test Supabase connection
cat > test-db.js << 'EOF'
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const { data, error } = await supabase.from('admins').select('count');
if (error) {
  console.error('❌ Connection failed:', error.message);
} else {
  console.log('✅ Supabase connected successfully!');
}
EOF

node test-db.js
```

---

### Phase 3: Create First Admin & Test (10-15 minutes)

#### 3.1 Start Server
```bash
npm run dev
# Server running on http://localhost:3000
```

#### 3.2 Register Admin Account
```bash
curl -X POST http://localhost:3000/api/v1/admin/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin1",
    "password": "SecurePass@123!",
    "platformName": "My Gaming Platform"
  }'

# Response:
# {
#   "adminId": "550e8400-e29b-41d4-a716-446655440000",
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "apiKey": "wingo_key_a1b2c3d4e5f6g7h8",
#   "apiSecret": "wingo_secret_a1b2c3d4e5f6g7h8...",
#   "message": "Admin registered successfully"
# }
```

#### 3.3 Save Admin Credentials
```bash
# Save these for next requests
export ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
export API_KEY="wingo_key_a1b2c3d4e5f6g7h8"
```

#### 3.4 Create Test Player
```bash
curl -X POST http://localhost:3000/api/v1/admin/players/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testplayer",
    "password": "PlayerPass@123!",
    "initialBalance": 5000
  }'

# Response:
# {
#   "userId": "660e8400-e29b-41d4-a716-446655440001",
#   "username": "testplayer",
#   "initialBalance": 5000,
#   "message": "Player created successfully"
# }
```

#### 3.5 Player Login
```bash
curl -X POST http://localhost:3000/api/v1/player/auth/login \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testplayer",
    "password": "PlayerPass@123!"
  }'

# Response:
# {
#   "userId": "660e8400-e29b-41d4-a716-446655440001",
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "adminId": "550e8400-e29b-41d4-a716-446655440000"
# }
```

#### 3.6 Check Wallet
```bash
export PLAYER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET http://localhost:3000/api/v1/player/wallet \
  -H "Authorization: Bearer $PLAYER_TOKEN" \
  -H "X-API-Key: $API_KEY"

# Response:
# {
#   "balance": 5000,
#   "locked": 0
# }
```

---

### Phase 4: Integration Testing (15-20 minutes)

#### 4.1 Create Round
```bash
curl -X POST http://localhost:3000/api/v1/admin/rounds/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Response:
# {
#   "roundId": "20260115001",
#   "status": "ACTIVE",
#   "endTs": "2026-01-15T10:30:30.000Z"
# }
```

#### 4.2 Place Bet
```bash
curl -X POST http://localhost:3000/api/v1/player/bet \
  -H "Authorization: Bearer $PLAYER_TOKEN" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "roundId": "20260115001",
    "bets": [
      {
        "type": "COLORBET",
        "option": "RED",
        "amount": 100
      }
    ]
  }'

# Response:
# {
#   "roundId": "20260115001",
#   "betIds": ["660e8400-e29b-41d4-a716-446655440002"],
#   "totalWagered": 100,
#   "newBalance": 4900
# }
```

#### 4.3 Verify Bet
```bash
curl -X GET http://localhost:3000/api/v1/player/bets \
  -H "Authorization: Bearer $PLAYER_TOKEN" \
  -H "X-API-Key: $API_KEY"

# Response: Array of bets with status
```

---

## File Structure After Setup

```
/workspaces/wingobackend/
├── .env                              # ← Environment variables
├── src/
│   ├── config/
│   │   ├── supabase.js              # ← Supabase client
│   │   ├── schema.sql               # ← Database schema
│   │   └── env.js
│   ├── models/
│   │   ├── User.js                  # ← Updated for Supabase
│   │   ├── Admin.js
│   │   ├── Bet.js
│   │   ├── Wallet.js
│   │   ├── Ledger.js
│   │   ├── Round.js
│   │   └── ApiKey.js
│   ├── routes/
│   │   ├── v1/
│   │   │   ├── admin/
│   │   │   │   ├── authRoutes.js
│   │   │   │   ├── playerMgmtRoutes.js
│   │   │   │   └── gameRoutes.js
│   │   │   └── player/
│   │   │       ├── authRoutes.js
│   │   │       ├── betRoutes.js
│   │   │       └── walletRoutes.js
│   ├── services/
│   │   ├── betting.js
│   │   ├── settlement.js
│   │   ├── round.js
│   │   └── scheduler.js
│   ├── middleware/
│   │   └── adminAuth.js             # ← Updated for Supabase
│   ├── app.js
│   └── server.js
├── SUPABASE_SETUP.md                # ← Setup guide
├── SUPABASE_INTEGRATION_EXAMPLES.md # ← Code examples
├── MIGRATION_GUIDE.md               # ← MongoDB→Supabase
└── package.json
```

---

## Verification Checklist

After setup, verify these work:

- [ ] Supabase project created
- [ ] Database schema imported (9 tables exist)
- [ ] `.env` file configured
- [ ] `npm install` completed
- [ ] Server starts: `npm run dev`
- [ ] Admin registration works
- [ ] Admin login works
- [ ] Create player works
- [ ] Player login works
- [ ] Get wallet works
- [ ] Create round works (if scheduler enabled)
- [ ] Place bet works
- [ ] Get bets works

---

## Common Issues

### Issue: "SUPABASE_URL not found"
**Solution**: Check `.env` file exists and has correct variable names

### Issue: "connection refused"
**Solution**: 
- Verify Supabase project is running
- Check internet connection
- Verify SUPABASE_URL is correct

### Issue: "table does not exist"
**Solution**: Re-import schema.sql via SQL Editor

### Issue: "Invalid API Key"
**Solution**: Verify you're using correct API_KEY from admin registration

---

## Next Steps

1. ✅ Setup complete
2. → Deploy to staging environment
3. → Setup CI/CD pipeline
4. → Configure monitoring & alerts
5. → Load test with multiple players
6. → Deploy to production

---

## Documentation Files

- **SUPABASE_SETUP.md** - Detailed Supabase configuration
- **SUPABASE_INTEGRATION_EXAMPLES.md** - Code examples in multiple languages
- **MIGRATION_GUIDE.md** - Migrate from MongoDB to Supabase
- **CODE_ROADMAP.md** - Complete technical specification
- **ADMIN_SETUP_GUIDE.md** - Admin panel operations

---

## Support

For issues:
1. Check troubleshooting section above
2. Review documentation files
3. Check Supabase logs: https://app.supabase.com → Project → Logs
4. Enable debug logging: `LOG_LEVEL=debug` in `.env`
