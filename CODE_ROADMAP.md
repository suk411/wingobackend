# WINGO BACKEND - CODE ROADMAP & DETAILED DOCUMENTATION

## PROJECT OVERVIEW

**Wingo** is a **B2B API Game Provider Platform** built with Node.js, Express, Supabase, and Socket.io. It's a white-label betting/gaming backend service that allows third-party platforms (admins) to integrate a fast-paced multiplayer gambling game into their frontend. Players place bets on game outcomes (numbers, colors, sizes) during 30-second betting rounds. The system automatically manages round creation, bet placement, result generation, and settlement with sophisticated exposure management and API-level admin controls. Supabase provides PostgreSQL database, real-time subscriptions, and built-in authentication.

### Business Model
- **Game Provider**: Wingo provides the game logic, betting system, and real-time mechanics via Supabase backend
- **Admin (Merchant)**: Third-party platforms integrate via REST API + Socket.io with Supabase real-time
- **Players**: End users of the admin's platform who play the game
- **API Keys**: Admins authenticate requests using API credentials (API Key + Secret)

---

## CORE TECHNOLOGY STACK

- **Runtime**: Node.js (ES modules)
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL (via Supabase with @supabase/supabase-js 2.x)
- **Real-time Communication**: Socket.io 4.x + Supabase Real-time
- **Authentication**: JWT (Supabase native + jsonwebtoken 9.x for API keys)
- **Security**: bcryptjs for password hashing
- **Task Scheduling**: node-cron 4.x
- **CORS**: Enabled for cross-origin requests
- **Environment**: .env configuration via dotenv
- **Database Queries**: Supabase REST API or Supabase JS client
- **Real-time Subscriptions**: Supabase Realtime PostgreSQL changes

---

## PROJECT STRUCTURE

```
src/
├── app.js                      # Express app initialization & route mounting
├── server.js                   # HTTP server creation with Socket.io & scheduler initialization
├── config/
│   ├── supabase.js             # Supabase client initialization
│   ├── env.js                  # Environment variables export
│   └── schema.sql              # PostgreSQL schema definitions
├── constants/
│   └── enums.js                # Game enums (RoundStatus, Color, Size)
├── middleware/
│   ├── apiKeyAuth.js           # API Key authentication (merchant/admin verification)
│   ├── userAuth.js             # JWT authentication for players
│   └── adminAuth.js            # Admin-specific middleware
├── models/
│   ├── User.js                 # Player account queries (username, password with bcrypt)
│   ├── Admin.js                # Merchant/Admin account queries (username, password)
│   ├── ApiKey.js               # Admin API credentials queries (key, secret, permissions)
│   ├── Bet.js                  # Individual bets queries (userId, roundId, type, option, amount, status)
│   ├── Ledger.js               # Transaction ledger queries (DEBIT/CREDIT/FEE entries)
│   ├── Wallet.js               # User wallet queries (balance, locked funds)
│   └── Round.js                # Game round metadata queries (roundId, status, result, bets snapshot)
├── routes/
│   ├── v1/
│   │   ├── player/
│   │   │   ├── authRoutes.js   # Player register/login
│   │   │   ├── betRoutes.js    # Bet placement & bet history
│   │   │   ├── walletRoutes.js # Wallet balance & ledger history
│   │   │   └── userRoutes.js   # Player profile endpoints
│   │   │
│   │   ├── admin/
│   │   │   ├── authRoutes.js   # Admin register/login
│   │   │   ├── apiKeyRoutes.js # API Key management (CRUD)
│   │   │   ├── userMgmtRoutes.js # Create/manage players
│   │   │   ├── gameRoutes.js   # Game control (force results, mode, settings)
│   │   │   └── analyticsRoutes.js # Reports, stats, settlements
│   │   │
│   │   └── healthRoutes.js     # Health check endpoints
│   │
│   └── docs/
│       └── apiDocRoutes.js     # Interactive API documentation
│
└── services/
    ├── betting.js              # placeBet() function
    ├── round.js                # Round creation & closure
    ├── resultEngine.js         # Game logic & result selection (MAX_PROFIT/MAX_LOSS modes)
    ├── resultReveal.js         # Result reveal service
    ├── settlement.js           # Bet settlement & payout calculation
    ├── countdown.js            # Countdown logic
    ├── scheduler.js            # 30s round orchestration with auto-close & settlement
    └── apiKeyService.js        # API key generation, validation, and management
```

---

## GAME MECHANICS

### Round Lifecycle (30-second cycle)

#### **T=0s - Round Creation**
- New round created every 30 seconds via cron scheduler
- Round ID: `YYYYMMDD{seq}` (e.g., 202601150001)
- Broadcast `round-start` event with roundId and endTs
- Betting window opens

#### **T=5s - T=25s - Betting Phase**
- Players place bets via `/api/bet` endpoint
- Bets locked into frozen result at T=25s (5s before end)
- 5-second gate: No bets accepted within final 5 seconds
- Bet amount deducted from wallet, locked until settlement

#### **T=25s - Bet Closure & Result Freezing**
- Betting closed automatically
- Admin can override with forced result via `/admin/force-result`
- Algorithm computes best result based on mode (MAX_PROFIT or MAX_LOSS)
- Result frozen in Redis

#### **T=30s - Result Reveal & Settlement**
- Round ends
- Result revealed to all players via Socket.io
- Bets settled immediately with payouts calculated
- Wallets updated and ledger entries created

---

## BET TYPES & PAYOUTS

| Bet Type | Option | Payout Multiplier | Notes |
|----------|--------|------------------|-------|
| **COLOR** | RED, GREEN | 2.0x | VIOLET numbers pay 1.5x to RED/GREEN bettors |
| **SIZE** | SMALL (0-4), BIG (5-9) | 2.0x | Based on drawn number |
| **NUMBER** | 0-9 | 9.0x | Direct number match |
| **VIOLET** | Always 1 option | 4.5x | Numbers 0 & 5 include violet |

### Number Mapping
- **0**: RED + SMALL + VIOLET
- **1, 3, 7, 9**: GREEN + SMALL
- **2, 4, 6, 8**: RED + BIG
- **5**: GREEN + BIG + VIOLET

### Violet Rolling Window
Maximum 10 violet outcomes per 100 rounds (strict enforcement)

---

## EXPOSURE MANAGEMENT

The system calculates real-time betting exposures in Redis to optimize result selection:

```
Redis Keys per Round:
- wingo:round:{roundId}:exposure:color     (hash: red, green, violet)
- wingo:round:{roundId}:exposure:size      (hash: small, big)
- wingo:round:{roundId}:exposure:number    (hash: 0-9)
```

### Net Exposure Calculation
- Individual bet net amount: `betAmount * 0.98` (2% fee)
- Total exposure per color/size/number tracked
- Used by result engine to minimize/maximize profits

---

## RESULT SELECTION ALGORITHMS

### Mode: MAX_PROFIT
- Selects result that minimizes payout obligation
- Favors low-exposure numbers
- House-favorable mode

### Mode: MAX_LOSS
- Selects result that maximizes payout obligation
- Favors high-exposure numbers
- Player-favorable mode (debugging/testing)

### Forced Results
Admins can override auto-calculated results for active rounds only

---

## WALLET & LEDGER SYSTEM

### Wallet Schema
```javascript
{
  userId: ObjectId,
  balance: Number,        // Available funds
  locked: Number          // Funds locked in pending bets
}
```

### Ledger Schema
```javascript
{
  userId: ObjectId,
  roundId: String,
  type: "DEBIT" | "CREDIT" | "FEE" | "BONUS" | "ADMIN_ADJUSTMENT",
  amount: Number,
  balanceAfter: Number,
  meta: Object,           // Additional context (bets, results, etc.)
  createdAt: Date
}
```

### API Key Schema
```javascript
{
  _id: ObjectId,
  adminId: ObjectId,                    // Reference to Admin
  name: String,                         // "Production", "Mobile", etc.
  apiKey: String,                       // 32-char public key (wingo_key_*)
  apiSecret: String,                    // 64-char secret (encrypted at rest)
  status: "ACTIVE" | "REVOKED" | "EXPIRED",
  permissions: [String],                // ["player.read", "player.create", "bet.read"]
  rateLimit: {
    requests: 10000,                    // per hour
    burst: 500                          // concurrent requests
  },
  ipWhitelist: [String],                // Optional IP restriction
  createdAt: Date,
  lastUsed: Date,
  expiresAt: Date,                      // Optional: auto-expire
  createdBy: String                     // Admin username for audit
}
```

### Bet Settlement Flow
1. Wallet deducted on bet placement (locked funds)
2. After round settle, locked amount released
3. Payout added if bet won
4. CREDIT ledger entry created with final balance

---

## API ENDPOINTS

### PLAYER API (`/api/v1/player`)

#### Player Authentication (`/player/auth`)

```
POST /api/v1/player/auth/register
  headers: { X-API-Key: "{admin_api_key}" }
  body: { username, password }
  → Creates player & wallet (initial balance: configurable by admin)
  → Returns { playerId, message }

POST /api/v1/player/auth/login
  headers: { X-API-Key: "{admin_api_key}" }
  body: { username, password }
  → Returns JWT token (24h expiration)
```

#### Player Betting (`/player/bet`)

```
POST /api/v1/player/bet
  headers: { 
    Authorization: "Bearer {player_token}",
    X-API-Key: "{admin_api_key}"
  }
  body: { roundId, bets: [{type, option, amount}, ...] }
  → Places bets, deducts wallet, updates exposures
  → Returns { roundId, betIds }

GET /api/v1/player/bets
  headers: { 
    Authorization: "Bearer {player_token}",
    X-API-Key: "{admin_api_key}"
  }
  query: { page: 1, limit: 10 }
  → Paginated bet history
```

#### Player Wallet (`/player/wallet`)

```
GET /api/v1/player/wallet
  headers: { 
    Authorization: "Bearer {player_token}",
    X-API-Key: "{admin_api_key}"
  }
  → Returns { userId, balance, locked }

GET /api/v1/player/ledger
  headers: { 
    Authorization: "Bearer {player_token}",
    X-API-Key: "{admin_api_key}"
  }
  → Returns ledger entries (transactions history)
```

---

### ADMIN API (`/api/v1/admin`)

#### Admin Authentication (`/admin/auth`)

```
POST /api/v1/admin/auth/register
  body: { username, password, platformName }
  → Creates admin account
  → Returns { adminId, apiKey, apiSecret }

POST /api/v1/admin/auth/login
  body: { username, password }
  → Returns { adminId, token, apiKey, apiSecret }
```

#### API Key Management (`/admin/api-keys`)

```
POST /api/v1/admin/api-keys/generate
  headers: { Authorization: "Bearer {admin_token}" }
  body: { name: "Production Key" }
  → Generates new API key pair
  → Returns { apiKey, apiSecret, createdAt }

GET /api/v1/admin/api-keys
  headers: { Authorization: "Bearer {admin_token}" }
  → Lists all API keys for admin
  → Returns [{ name, apiKey, status, createdAt, lastUsed }]

DELETE /api/v1/admin/api-keys/:keyId
  headers: { Authorization: "Bearer {admin_token}" }
  → Revokes API key

POST /api/v1/admin/api-keys/:keyId/revoke
  headers: { Authorization: "Bearer {admin_token}" }
  → Temporarily disables API key
```

#### Player Management (`/admin/players`)

```
POST /api/v1/admin/players/create
  headers: { Authorization: "Bearer {admin_token}" }
  body: { username, password, initialBalance: 5000 }
  → Creates player under this admin's account
  → Returns { playerId, username, balance }

GET /api/v1/admin/players
  headers: { Authorization: "Bearer {admin_token}" }
  query: { page: 1, limit: 20 }
  → Lists all players for this admin

GET /api/v1/admin/players/:playerId
  headers: { Authorization: "Bearer {admin_token}" }
  → Returns player details, wallet, stats

POST /api/v1/admin/players/:playerId/adjust-balance
  headers: { Authorization: "Bearer {admin_token}" }
  body: { amount: 100, reason: "Bonus", type: "CREDIT" }
  → Manually adjust player balance (admin operations)

DELETE /api/v1/admin/players/:playerId
  headers: { Authorization: "Bearer {admin_token}" }
  → Deactivate/delete player account
```

#### Game Control (`/admin/game`)

```
POST /api/v1/admin/game/force-result
  headers: { Authorization: "Bearer {admin_token}" }
  body: { roundId, number: 0-9 }
  → Forces result for active round (admin control)

POST /api/v1/admin/game/mode
  headers: { Authorization: "Bearer {admin_token}" }
  body: { mode: "MAX_PROFIT" | "MAX_LOSS" | "BALANCED" }
  → Sets result selection mode globally

GET /api/v1/admin/game/exposure/:roundId
  headers: { Authorization: "Bearer {admin_token}" }
  → Returns { color: {...}, size: {...}, number: {...} }

POST /api/v1/admin/game/settings
  headers: { Authorization: "Bearer {admin_token}" }
  body: { 
    roundDuration: 30,
    maxBetAmount: 10000,
    minBetAmount: 10,
    houseFeesPercent: 2,
    defaultPlayerBalance: 5000
  }
  → Configure game settings per admin
```

#### Analytics & Reports (`/admin/analytics`)

```
GET /api/v1/admin/analytics/dashboard
  headers: { Authorization: "Bearer {admin_token}" }
  → Returns { totalBets, totalPlayers, totalRevenue, roundsPlayed }

GET /api/v1/admin/analytics/players
  headers: { Authorization: "Bearer {admin_token}" }
  query: { period: "daily" | "weekly" | "monthly" }
  → Player statistics and rankings

GET /api/v1/admin/analytics/rounds
  headers: { Authorization: "Bearer {admin_token}" }
  query: { page: 1, limit: 50 }
  → Rounds history with results and settlements

GET /api/v1/admin/analytics/payouts
  headers: { Authorization: "Bearer {admin_token}" }
  query: { startDate, endDate }
  → Payout reports

GET /api/v1/admin/analytics/ledger
  headers: { Authorization: "Bearer {admin_token}" }
  query: { playerId, type: "CREDIT" | "DEBIT" }
  → Transaction ledger export
```

---

### WEBSOCKET / REAL-TIME API

#### Connection
```javascript
const socket = io('https://api.wingo.com', {
  auth: {
    apiKey: 'your_api_key',
    token: 'player_jwt_token'
  }
});
```

#### Events (Received by Client)
```javascript
// Round started
socket.on('round-start', ({ roundId, endTs }) => {
  console.log(`Round ${roundId} started, ends at ${endTs}`);
});

// Betting closed for round
socket.on('bet-closed', ({ roundId }) => {
  console.log(`No more bets accepted for ${roundId}`);
});

// Result revealed
socket.on('result-reveal', ({ roundId, result }) => {
  console.log(`Result: ${result.number} (${result.color})`);
});

// Settlement complete
socket.on('settlement-complete', ({ roundId, totalBets, totalPayouts }) => {
  console.log(`Round settled with ${totalPayouts} paid out`);
});

// Player balance updated
socket.on('balance-updated', ({ userId, newBalance }) => {
  console.log(`Your balance is now ${newBalance}`);
});
```

#### Events (Sent by Client)
```javascript
// Subscribe to round updates
socket.emit('join-round', { roundId }, (ack) => {
  console.log('Joined round:', ack);
});

// Get current round info
socket.emit('get-current-round', {}, (roundInfo) => {
  console.log(roundInfo);
});
```

---

### HEALTH & STATUS (`/api/v1/health`)

```
GET /api/v1/health
  → { status: "ok", timestamp, uptime, version }

GET /api/v1/health/redis
  → { status: "connected" | "error", latency_ms }

GET /api/v1/health/mongodb
  → { status: "connected" | "error", latency_ms }
```

---

### API DOCUMENTATION (`/api/docs`)

```
GET /api/docs
  → Interactive Swagger/OpenAPI documentation

GET /api/docs/integration-guide
  → Complete integration guide for admins

GET /api/docs/code-examples
  → Code samples (Node.js, Python, JavaScript)
```

---

## SOCKET.IO EVENTS

### Emitted by Server
```javascript
io.emit("round-start", { roundId, endTs })
io.emit("bet-closed", { roundId })
io.emit("result-reveal", { roundId, result })
io.emit("settlement-complete", { roundId, totalBets, totalPayouts })
```

### Received from Clients
- Real-time bet updates (via HTTP then broadcasted)
- Round countdown updates

---

## DATA FLOW - BET TO SETTLEMENT

### 1. Bet Placement (`betRoutes.js::placeBet`)
- Validate round status & betting window (5s gate)
- Check wallet balance
- Deduct from wallet, lock funds
- Calculate net amount (2% fee already applied)
- Update Redis exposures per bet type
- Save to MongoDB & Redis list

### 2. Result Freezing (`scheduler.js::T-5s`)
- Call `resultEngine.selectResult()`
- Read all exposures from Redis
- Compute payout for each candidate
- Select & freeze best result
- Store in Redis: `wingo:round:{roundId}:result`

### 3. Result Reveal (`scheduler.js::T=30s`)
- Emit `result-reveal` to clients
- Update Round status to "REVEALED"
- Call `settlement.settleRound()`

### 4. Settlement (`settlement.js`)
- For each pending bet:
  - Compare bet option to result
  - Calculate payout based on multiplier
  - Release locked funds
  - Add payout to balance
  - Create CREDIT ledger entry
  - Mark bet WON or LOST

---

## AUTHENTICATION & SECURITY ARCHITECTURE

### Three-Layer Authentication Model

#### Layer 1: Admin (Merchant) Authentication
- **Credentials**: Username + Password
- **Token**: JWT (48h expiration)
- **Purpose**: Admin login to create API keys and manage their platform
- **Endpoint**: `POST /api/v1/admin/auth/login`

#### Layer 2: API Key Authentication (Merchant ↔ Provider)
- **Credentials**: API Key + API Secret (HMAC signature)
- **Method**: Header-based: `X-API-Key: {key}` or signature-based
- **Purpose**: Authenticate admin's server requests to Wingo API
- **Validation**: Every request to `/api/v1/player/*` requires valid API key
- **Rotation**: Admins can generate unlimited keys and revoke old ones
- **Endpoint**: `POST /api/v1/admin/api-keys/generate`

#### Layer 3: Player (End-User) Authentication
- **Credentials**: Username + Password
- **Token**: JWT (24h expiration)
- **Purpose**: Player login and gameplay authentication
- **Header**: `Authorization: Bearer {player_token}`
- **Required**: Must also include API key from parent admin
- **Endpoint**: `POST /api/v1/player/auth/login`

### Request Flow Diagram

```
Admin's Frontend
      ↓
[Admin logs in]
      ↓
GET JWT Token (48h)
      ↓
Admin Dashboard
      ↓
[Generate API Key] → Wingo API with JWT
      ↓
API Key + Secret (HMAC)
      ↓
Admin shares with Frontend Team
      ↓
Frontend makes requests:
  Headers: {
    X-API-Key: "{api_key}",
    X-API-Secret: "{signature}",    // HMAC-SHA256(secret, method+path+body+timestamp)
    Authorization: "Bearer {player_token}"
  }
      ↓
Wingo validates both keys
      ↓
Process request (if authorized)
```

### API Key Model Schema

```javascript
{
  _id: ObjectId,
  adminId: ObjectId,           // Reference to Admin
  name: String,                // "Production", "Staging", etc.
  apiKey: String,              // 32-char random string (public)
  apiSecret: String,           // 64-char random string (secret - shown once)
  status: "ACTIVE" | "REVOKED",
  permissions: [String],       // ["player.create", "player.bet", "game.read"]
  rateLimit: {
    requests: 10000,           // per hour
    burst: 500                 // concurrent requests
  },
  createdAt: Date,
  lastUsed: Date,
  expiresAt: Date              // Optional: auto-expire keys
}
```

### Security Features

- **Rate Limiting**: Per API key (configurable by tier)
- **Request Signing**: HMAC-SHA256 signature validation
- **IP Whitelisting**: Optional per API key
- **Webhook Signatures**: Outbound webhooks are also signed
- **Audit Logging**: All API requests logged with admin context
- **Key Rotation**: Easy key generation and revocation
- **Encryption**: Secrets encrypted at rest in MongoDB

---

## KEY REDIS DATA STRUCTURES

```javascript
// Round state
wingo:round:{roundId}:state          // hash: id, start_ts, end_ts, status
wingo:round:current                  // string: current round state key

// Bet data
wingo:round:{roundId}:bets           // list: JSON bets
wingo:round:{roundId}:exposure:*     // hashes: color, size, number

// Admin controls
wingo:admin:mode                      // string: MAX_PROFIT or MAX_LOSS
wingo:round:{roundId}:forced         // flag: if admin forced result
wingo:round:{roundId}:result         // string: JSON result object
wingo:stats:violet:last100           // list: last 100 violet flags

// Counters
wingo:roundCounter:{YYYYMMDD}        // counter: auto-incremented per day
```

---

## ENVIRONMENT VARIABLES REQUIRED

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/wingo
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
```

---

## ERROR HANDLING

- **Invalid Payload**: 400 Bad Request
- **Authentication Failures**: 401 Unauthorized
- **Round Not Found**: 404 Not Found
- **Insufficient Balance**: 400 Bad Request ("Insufficient balance")
- **Betting Closed**: 400 Bad Request ("Betting closed")
- **No Active Round**: 400 Bad Request ("No active round")
- **Global Error Handler**: 500 Internal Server Error (logs stack trace)

---

## DEPLOYMENT & RUNNING

```bash
# Install dependencies
npm install

# Development (with auto-reload)
npm run dev

# Production
npm start

# Server starts on configured PORT
# 30-second rounds begin automatically
# Check logs for round creation timestamps
```

---

## PERFORMANCE CONSIDERATIONS

- **Round Cadence**: 30-second cycles = 2,880 rounds/day
- **Bet Velocity**: High concurrency on bet placement (5-25s window)
- **Redis Efficiency**: Exposures tracked in memory for instant access
- **MongoDB Batching**: insertMany for bet persistence
- **Lock Timeouts**: 10-second TTL prevents deadlocks

---

## FUTURE ENHANCEMENT IDEAS

- Multi-currency support
- Referral program with ledger tracking
- Bonus/promotion codes
- Withdrawal/deposit system
- Real-time WebSocket bet confirmation
- Admin analytics dashboard
- Audit logs for security compliance

---

## ADMIN ONBOARDING WORKFLOW

### Step 1: Create Admin Account
```bash
curl -X POST https://api.wingo.com/api/v1/admin/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "acmegames_admin",
    "password": "secure_password",
    "platformName": "ACME Games"
  }'

Response:
{
  "adminId": "63f7d1a2b4c5e6f7g8h9i0j1",
  "apiKey": "wingo_key_abc123xyz789def456",
  "apiSecret": "wingo_secret_xyz789abc123def456ghi789jkl012mno",
  "message": "Admin account created. Save your API credentials securely!"
}
```

### Step 2: Generate Additional API Keys
```bash
curl -X POST https://api.wingo.com/api/v1/admin/api-keys/generate \
  -H "Authorization: Bearer {admin_jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile App Production"
  }'

Response:
{
  "apiKey": "wingo_key_prod_m1o2b3i4l5e6",
  "apiSecret": "wingo_secret_prod_m1o2b3i4l5e6a7p8p9production",
  "createdAt": "2026-01-15T10:30:00Z"
}
```

### Step 3: Create Test Players
```bash
curl -X POST https://api.wingo.com/api/v1/admin/players/create \
  -H "Authorization: Bearer {admin_jwt_token}" \
  -H "X-API-Key: {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testplayer_001",
    "password": "test_password",
    "initialBalance": 1000
  }'

Response:
{
  "playerId": "63f7d1a2b4c5e6f7g8h9i0j2",
  "username": "testplayer_001",
  "balance": 1000
}
```

### Step 4: Frontend Integration
Admin's frontend developer integrates using the API:

```javascript
// 1. Login player
const loginResponse = await fetch('https://api.wingo.com/api/v1/player/auth/login', {
  method: 'POST',
  headers: {
    'X-API-Key': 'wingo_key_abc123xyz789def456',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'testplayer_001',
    password: 'test_password'
  })
});

const { token } = await loginResponse.json();

// 2. Connect WebSocket
const socket = io('https://api.wingo.com', {
  auth: {
    apiKey: 'wingo_key_abc123xyz789def456',
    token: token
  }
});

// 3. Listen for round events
socket.on('round-start', ({ roundId, endTs }) => {
  console.log(`New round: ${roundId}`);
  updateGameUI(roundId, endTs);
});

// 4. Place bet
const betResponse = await fetch('https://api.wingo.com/api/v1/player/bet', {
  method: 'POST',
  headers: {
    'X-API-Key': 'wingo_key_abc123xyz789def456',
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    roundId: '202601150001',
    bets: [
      { type: 'COLOR', option: 'RED', amount: 100 },
      { type: 'NUMBER', option: 5, amount: 50 }
    ]
  })
});

const { betIds } = await betResponse.json();
console.log(`Bets placed: ${betIds}`);
```

### Step 5: Monitor & Manage
```bash
# Get all players
curl -X GET https://api.wingo.com/api/v1/admin/players \
  -H "Authorization: Bearer {admin_jwt_token}" \
  -H "X-API-Key: {api_key}"

# View analytics
curl -X GET https://api.wingo.com/api/v1/admin/analytics/dashboard \
  -H "Authorization: Bearer {admin_jwt_token}" \
  -H "X-API-Key: {api_key}"

# Adjust player balance (bonus)
curl -X POST https://api.wingo.com/api/v1/admin/players/{playerId}/adjust-balance \
  -H "Authorization: Bearer {admin_jwt_token}" \
  -H "X-API-Key: {api_key}" \
  -d '{
    "amount": 500,
    "reason": "Welcome Bonus",
    "type": "CREDIT"
  }'
```

---

## INTEGRATION GUIDE FOR PARTNERS

### Architecture Overview
```
┌─────────────────────────────────────────────────────────┐
│                   Partner Platform                      │
├─────────────────────────────────────────────────────────┤
│  Frontend (Vue/React/Angular) + WebSocket Client        │
│                                                         │
│  const socket = io('wingo.api.com', {                   │
│    auth: { apiKey, playerToken }                        │
│  })                                                     │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS + WebSocket
                       │
┌──────────────────────▼──────────────────────────────────┐
│             Wingo API Game Provider                     │
├─────────────────────────────────────────────────────────┤
│  - Player Management          - Bet Processing          │
│  - Authentication             - Result Generation       │
│  - Wallet Management          - Settlement              │
│  - Real-time Game Events      - Admin Controls          │
│  - Analytics & Reports        - Rate Limiting           │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Backend Services                           │
├─────────────────────────────────────────────────────────┤
│  MongoDB    │  Redis       │  Socket.io   │  Scheduler  │
└─────────────────────────────────────────────────────────┘
```

### Integration Checklist for Partners

- [ ] Create admin account
- [ ] Generate production API key
- [ ] Read API documentation (`/api/docs`)
- [ ] Review code examples for your tech stack
- [ ] Set up test environment with test players
- [ ] Implement player registration endpoint
- [ ] Implement player login + token storage
- [ ] Connect WebSocket with authentication
- [ ] Display game UI with round countdown
- [ ] Implement bet placement form
- [ ] Handle result events and payout display
- [ ] Implement wallet/balance display
- [ ] Set up error handling and retry logic
- [ ] Test with sandbox API keys
- [ ] Load testing (contact Wingo for rate limit increase)
- [ ] Deploy to production

### Common Integration Patterns

#### Pattern 1: Embedded Game (iFrame)
- Partner hosts Wingo game in iFrame
- Parent sends API key via postMessage
- Game communicates with Wingo API directly

#### Pattern 2: Native Integration
- Partner's frontend directly calls Wingo API
- No iFrame, fully branded experience
- Requires API key + admin JWT on backend

#### Pattern 3: Backend Proxy
- Partner's backend proxies requests to Wingo
- Adds additional security/validation layer
- Better for sensitive operations (player creation, balance adjustment)

---

## PARTNER SUPPORT & DOCUMENTATION

### API Documentation Portal
- **Swagger UI**: `/api/docs/swagger`
- **Integration Guide**: `/api/docs/integration-guide`
- **Code Examples**: `/api/docs/code-examples` (Node.js, Python, JavaScript, etc.)
- **Webhooks**: `/api/docs/webhooks` (Coming Soon)

### Developer Community
- **Slack Channel**: #wingo-developers
- **GitHub Repo**: github.com/wingobackend/partner-integrations
- **Email**: developers@wingo.com
- **Status Page**: status.wingo.com

### SLA & Support Tiers

| Tier | Requests/Hour | Support | SLA | Fee |
|------|---------------|---------|-----|-----|
| Starter | 1,000 | Email | 99% | Free |
| Professional | 100,000 | Chat + Phone | 99.5% | $499/month |
| Enterprise | Unlimited | Dedicated | 99.99% | Custom |

---

## DATA OWNERSHIP & PRIVACY

- **Player Data**: Belongs to partner admin, Wingo is data processor
- **API Access Logs**: Retained for 90 days
- **Game Results**: Stored indefinitely (audit trail)
- **Personal Information**: Encrypted at rest, in transit
- **GDPR Compliance**: Right to export, right to delete (soft delete only)
- **Terms**: Partners responsible for player consent & privacy policies

---

## RATE LIMITING & QUOTAS

### Default Limits (Starter Tier)
```
- Authentication: 10 requests/minute per IP
- Player Management: 100 requests/minute per API key
- Betting: 1000 requests/minute per API key
- Analytics: 100 requests/minute per API key
- Burst: Up to 50 concurrent requests
```

### Upgrade Path
Contact sales@wingo.com for enterprise limits

### Rate Limit Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 956
X-RateLimit-Reset: 1642232400
```

---

## DEVELOPMENT GUIDELINES

### Code Conventions
- Use ES modules (import/export)
- Async/await for asynchronous operations
- Error handling with try/catch
- Console logs with emoji prefixes for clarity
  - ✅ Success operations
  - ❌ Errors
  - 🚀 Starting processes
  - 🔒 Locks/Closures
  - 🧊 Frozen states
  - 🎉 Reveals/Completions
  - ⚠️ Warnings
- JSDoc comments for complex functions
- MongoDB atomic operations where possible

### Testing Scenarios
1. **Happy Path**: Register → Login → Place bet → Win/Lose → Check ledger
2. **Edge Cases**: 5s gate, late bets, insufficient balance, forced results
3. **Concurrency**: Multiple bets in same round, parallel settlements
4. **Admin Functions**: Mode switching, forced results, exposure queries

### Common Issues & Solutions

**Issue**: Round state desync between Redis and MongoDB
**Solution**: Always read from Redis first, fallback to MongoDB for recovery

**Issue**: Bet placed after freeze (T>25s)
**Solution**: 5-second gate validates remainingMs before accepting

**Issue**: Duplicate settlements
**Solution**: Check PENDING status before settling, atomic updates

**Issue**: Violet cap breaches
**Solution**: Exclude violet candidates from selection when cap=10

---

## DEPLOYMENT & RUNNING

```bash
# Install dependencies
npm install

# Development (with auto-reload)
npm run dev

# Production
npm start

# Server starts on configured PORT
# 30-second rounds begin automatically
# Check logs for round creation timestamps
```

### Environment Variables for API Provider Mode

```env
# Server
PORT=5000
NODE_ENV=production

# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/wingo
REDIS_URL=redis://user:pass@redis-cluster.com:6379

# Authentication
JWT_SECRET=your-secure-jwt-secret-key
JWT_ADMIN_EXPIRY=48h
JWT_PLAYER_EXPIRY=24h

# API Key Encryption
API_KEY_ENCRYPTION_KEY=your-encryption-key-for-secrets

# Rate Limiting
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX_REQUESTS=1000

# CORS & Security
ALLOWED_ORIGINS=https://partner1.com,https://partner2.com
ENABLE_REQUEST_SIGNING=true

# Game Settings
ROUND_DURATION=30000
DEFAULT_PLAYER_BALANCE=5000
HOUSE_FEE_PERCENT=2

# Notifications (optional)
WEBHOOK_ENABLED=false
WEBHOOK_SECRET=your-webhook-signing-key
```

---

## DATABASE SETUP & INDEXES

### MongoDB Index Creation

```javascript
// Admins
db.admins.createIndex({ username: 1 }, { unique: true })

// API Keys
db.apikeys.createIndex({ adminId: 1 })
db.apikeys.createIndex({ apiKey: 1 }, { unique: true })
db.apikeys.createIndex({ status: 1 })

// Users/Players
db.users.createIndex({ adminId: 1, username: 1 }, { unique: true })
db.users.createIndex({ adminId: 1 })

// Bets
db.bets.createIndex({ adminId: 1, userId: 1, roundId: 1 })
db.bets.createIndex({ roundId: 1, status: 1 })
db.bets.createIndex({ userId: 1, createdAt: -1 })

// Ledgers
db.ledgers.createIndex({ adminId: 1, userId: 1, createdAt: -1 })
db.ledgers.createIndex({ roundId: 1, type: 1 })

// Wallets
db.wallets.createIndex({ adminId: 1, userId: 1 }, { unique: true })

// Rounds
db.rounds.createIndex({ roundId: 1 }, { unique: true })
db.rounds.createIndex({ status: 1, createdAt: -1 })
```

### Redis Namespace Strategy

```
# Multi-tenant isolation by admin
wingo:{adminId}:round:{roundId}:state
wingo:{adminId}:round:{roundId}:exposures:color
wingo:{adminId}:round:{roundId}:exposures:size
wingo:{adminId}:round:{roundId}:exposures:number
wingo:{adminId}:round:current
wingo:{adminId}:admin:mode
wingo:{adminId}:stats:violet:last100
wingo:{adminId}:roundCounter:{YYYYMMDD}
```

---

## MONITORING & DEBUGGING

### Key Metrics to Track
- Rounds per minute (target: 2)
- Total bets per round (avg, min, max)
- Settlement latency (target: <100ms)
- Redis memory usage
- MongoDB connection pool status
- Failed bets (investigate immediately)

### Debug Endpoints
- `GET /health` - Basic health check
- Check Redis keys: `redis-cli KEYS wingo:round:*`
- Check MongoDB: `db.rounds.find().sort({ createdAt: -1 }).limit(10)`

### Logging Recommendations
- Log all round state transitions
- Log settlement details (userId, betIds, payouts)
- Log admin actions (forced results, mode changes)
- Alert on: Settlement failures, wallet mismatches, violet cap breaches

---

This document serves as the complete technical specification and roadmap for the Wingo backend platform. Use it as a reference for development, debugging, and feature planning.
