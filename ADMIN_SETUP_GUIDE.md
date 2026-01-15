# Wingo Admin Setup & Management Guide

**Technology Stack**: Node.js + Express + Supabase (PostgreSQL)

## Table of Contents
1. [Environment Setup](#environment-setup)
2. [Admin Account Creation](#admin-account-creation)
3. [API Key Management](#api-key-management)
4. [Player Management](#player-management)
5. [Game Configuration](#game-configuration)
6. [Analytics & Monitoring](#analytics--monitoring)
7. [Troubleshooting](#troubleshooting)

---

## Environment Setup

### Prerequisites
- Supabase account (https://supabase.com)
- Node.js 18+ installed
- Your Supabase project created with schema imported

### Configure Supabase
1. Create project at supabase.com
2. Run SQL schema from `src/config/schema.sql`
3. Create `.env` file with:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
```

### Install Dependencies
```bash
npm install @supabase/supabase-js express socket.io jsonwebtoken bcryptjs node-cron dotenv
```

---

## Admin Account Creation

### Step 1: Register Your Admin Account

```bash
curl -X POST http://localhost:3000/api/v1/admin/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "mycompany_admin",
    "password": "SecurePassword@123",
    "platformName": "My Gaming Platform"
  }'
```

**Response:**
```json
{
  "adminId": "550e8400-e29b-41d4-a716-446655440000",
  "username": "mycompany_admin",
  "platformName": "My Gaming Platform",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "apiKey": "wingo_key_a1b2c3d4e5f6g7h8",
  "apiSecret": "wingo_secret_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9",
  "message": "Admin registered successfully"
}
```

### Step 2: Store Credentials Securely

```bash
# Save in .env file (NEVER commit to git)
WINGO_ADMIN_ID=550e8400-e29b-41d4-a716-446655440000
WINGO_ADMIN_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
WINGO_API_KEY=wingo_key_a1b2c3d4e5f6g7h8
WINGO_API_SECRET=wingo_secret_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9
```

### Step 3: Login to Admin Panel

```bash
curl -X POST http://localhost:3000/api/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "mycompany_admin",
    "password": "SecurePassword@123"
  }'
```

**Response:**
```json
{
  "adminId": "550e8400-e29b-41d4-a716-446655440000",
  "username": "mycompany_admin",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "lastLogin": "2026-01-15T10:30:00Z"
}
```

```bash
curl -X POST https://api.wingo.com/api/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "mycompany_admin",
    "password": "SecurePassword@123"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "48h",
  "adminId": "63f7d1a2b4c5e6f7g8h9i0j1",
  "message": "Login successful"
}
```

---

## API Key Management

### Generating Production API Keys

#### Create New API Key

```bash
curl -X POST https://api.wingo.com/api/v1/admin/api-keys/generate \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production - Web Platform",
    "description": "API key for our main web platform",
    "permissions": [
      "player.create",
      "player.read",
      "player.update",
      "player.delete",
      "bet.read",
      "wallet.read",
      "ledger.read"
    ]
  }'
```

**Response:**
```json
{
  "id": "key_5a6b7c8d9e0f",
  "name": "Production - Web Platform",
  "apiKey": "wingo_key_prod_m1o2b3i4l5e6w7e8b",
  "apiSecret": "wingo_secret_prod_m1o2b3i4l5e6w7e8b9a0c1d2e3f4g5h6i7j8",
  "status": "ACTIVE",
  "createdAt": "2026-01-15T10:30:00Z",
  "expiresAt": null,
  "message": "API key created. Save the secret immediately - it won't be shown again!"
}
```

**Important:** Store the API Secret securely. You won't be able to retrieve it later!

#### List All API Keys

```bash
curl -X GET https://api.wingo.com/api/v1/admin/api-keys \
  -H "Authorization: Bearer {admin_token}"
```

**Response:**
```json
{
  "keys": [
    {
      "id": "key_5a6b7c8d9e0f",
      "name": "Production - Web Platform",
      "apiKey": "wingo_key_prod_m1o2b3i4l5e6w7e8b",
      "status": "ACTIVE",
      "createdAt": "2026-01-15T10:30:00Z",
      "lastUsed": "2026-01-15T14:22:15Z",
      "rateLimit": {
        "requests": 100000,
        "burst": 500
      }
    },
    {
      "id": "key_9x8y7z6w5v4u",
      "name": "Staging - Mobile App",
      "apiKey": "wingo_key_stag_x1y2z3w4v5u6t7s8",
      "status": "ACTIVE",
      "createdAt": "2026-01-10T08:15:00Z",
      "lastUsed": "2026-01-15T13:45:30Z",
      "rateLimit": {
        "requests": 10000,
        "burst": 100
      }
    }
  ],
  "totalKeys": 2
}
```

#### Revoke API Key

```bash
curl -X POST https://api.wingo.com/api/v1/admin/api-keys/{keyId}/revoke \
  -H "Authorization: Bearer {admin_token}"
```

#### Delete API Key

```bash
curl -X DELETE https://api.wingo.com/api/v1/admin/api-keys/{keyId} \
  -H "Authorization: Bearer {admin_token}"
```

### API Key Rotation Best Practices

1. **Create new key before disabling old one**
2. **Update all applications with new key**
3. **Revoke old key after verification**
4. **Monitor `lastUsed` timestamp**
5. **Rotate quarterly for security**

---

## Player Management

### Creating Players Programmatically

#### Single Player Creation

```bash
curl -X POST https://api.wingo.com/api/v1/admin/players/create \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "player_2026_001",
    "password": "PlayerPassword@123",
    "initialBalance": 1000,
    "email": "player@example.com",
    "metadata": {
      "referrer": "friend_123",
      "source": "organic"
    }
  }'
```

**Response:**
```json
{
  "playerId": "63f7d1a2b4c5e6f7g8h9i0j2",
  "username": "player_2026_001",
  "balance": 1000,
  "locked": 0,
  "createdAt": "2026-01-15T10:35:00Z",
  "message": "Player created successfully"
}
```

#### Bulk Player Creation

```bash
curl -X POST https://api.wingo.com/api/v1/admin/players/bulk-create \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "players": [
      {
        "username": "bulk_player_001",
        "password": "TempPassword@123",
        "initialBalance": 500
      },
      {
        "username": "bulk_player_002",
        "password": "TempPassword@123",
        "initialBalance": 500
      },
      {
        "username": "bulk_player_003",
        "password": "TempPassword@123",
        "initialBalance": 500
      }
    ]
  }'
```

### Listing Players

#### Get All Players (Paginated)

```bash
curl -X GET "https://api.wingo.com/api/v1/admin/players?page=1&limit=20&sortBy=createdAt&order=desc" \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"
```

**Response:**
```json
{
  "players": [
    {
      "playerId": "63f7d1a2b4c5e6f7g8h9i0j2",
      "username": "player_2026_001",
      "balance": 850,
      "locked": 150,
      "totalBets": 42,
      "winRate": 0.52,
      "createdAt": "2026-01-15T10:35:00Z",
      "lastActive": "2026-01-15T15:20:30Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 156,
  "totalPages": 8
}
```

#### Get Single Player Details

```bash
curl -X GET https://api.wingo.com/api/v1/admin/players/{playerId} \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"
```

**Response:**
```json
{
  "playerId": "63f7d1a2b4c5e6f7g8h9i0j2",
  "username": "player_2026_001",
  "balance": 850,
  "locked": 150,
  "email": "player@example.com",
  "stats": {
    "totalBets": 42,
    "totalWins": 22,
    "totalLosses": 20,
    "winRate": 0.524,
    "avgBetAmount": 125.50,
    "totalStaked": 5271.00,
    "totalWinnings": 4856.75,
    "totalLosses": 414.25
  },
  "recentBets": [...],
  "ledger": [...],
  "createdAt": "2026-01-15T10:35:00Z",
  "lastActive": "2026-01-15T15:20:30Z"
}
```

### Wallet Management

#### Adjust Player Balance (Credit/Debit)

```bash
curl -X POST https://api.wingo.com/api/v1/admin/players/{playerId}/adjust-balance \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "type": "CREDIT",
    "reason": "Welcome Bonus",
    "description": "New player signup bonus"
  }'
```

**Valid types:** `CREDIT`, `DEBIT`, `RESET`

**Response:**
```json
{
  "playerId": "63f7d1a2b4c5e6f7g8h9i0j2",
  "previousBalance": 1000,
  "newBalance": 1500,
  "amount": 500,
  "type": "CREDIT",
  "reason": "Welcome Bonus",
  "transactionId": "txn_abc123xyz",
  "createdAt": "2026-01-15T10:40:00Z"
}
```

#### Get Player Ledger/Transaction History

```bash
curl -X GET "https://api.wingo.com/api/v1/admin/players/{playerId}/ledger?page=1&limit=50" \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"
```

---

## Game Configuration

### Configuring Game Settings

#### Set Global Game Settings

```bash
curl -X POST https://api.wingo.com/api/v1/admin/game/settings \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "roundDuration": 30000,
    "bettingWindow": 25000,
    "gateClosingTime": 5000,
    "maxBetAmount": 10000,
    "minBetAmount": 10,
    "houseFeesPercent": 2.0,
    "defaultPlayerBalance": 5000,
    "maxPlayerBalance": 100000,
    "violetCapPer100": 10
  }'
```

**Response:**
```json
{
  "message": "Settings updated successfully",
  "settings": {
    "roundDuration": 30000,
    "bettingWindow": 25000,
    "gateClosingTime": 5000,
    "maxBetAmount": 10000,
    "minBetAmount": 10,
    "houseFeesPercent": 2.0,
    "defaultPlayerBalance": 5000,
    "maxPlayerBalance": 100000,
    "violetCapPer100": 10
  }
}
```

### Controlling Game Mode

#### Set Result Selection Mode

```bash
curl -X POST https://api.wingo.com/api/v1/admin/game/mode \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "MAX_PROFIT"
  }'
```

**Valid modes:**
- `MAX_PROFIT` - House favorable (minimize payouts)
- `MAX_LOSS` - Player favorable (maximize payouts)
- `BALANCED` - Balanced house/player returns

#### Get Current Game Mode

```bash
curl -X GET https://api.wingo.com/api/v1/admin/game/mode \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"
```

### Forcing Round Results (For Testing/Correction)

#### Force Result for Active Round

```bash
curl -X POST https://api.wingo.com/api/v1/admin/game/force-result \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "roundId": "202601150001",
    "number": 5,
    "reason": "Admin correction for test environment"
  }'
```

**Response:**
```json
{
  "roundId": "202601150001",
  "forced": true,
  "result": {
    "number": 5,
    "color": "GREEN",
    "size": "BIG",
    "includesViolet": true,
    "payout": 0,
    "freeze_ts": 1642232415000
  },
  "message": "Result forced successfully"
}
```

#### Get Round Exposures (Before Forcing Result)

```bash
curl -X GET https://api.wingo.com/api/v1/admin/game/exposure/{roundId} \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"
```

**Response:**
```json
{
  "roundId": "202601150001",
  "color": {
    "red": 2500.50,
    "green": 1800.25,
    "violet": 450.00
  },
  "size": {
    "small": 3200.75,
    "big": 1550.00
  },
  "number": {
    "0": 200.00,
    "1": 150.00,
    "2": 180.00,
    "3": 220.00,
    "4": 190.00,
    "5": 450.00,
    "6": 170.00,
    "7": 160.00,
    "8": 210.00,
    "9": 200.00
  },
  "totalExposure": 4750.75
}
```

---

## Analytics & Monitoring

### Dashboard Analytics

#### Get Dashboard Summary

```bash
curl -X GET https://api.wingo.com/api/v1/admin/analytics/dashboard \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"
```

**Response:**
```json
{
  "period": "today",
  "metrics": {
    "totalPlayers": 1256,
    "activePlayers": 342,
    "totalBets": 8450,
    "totalStaked": 1056250.00,
    "totalPayouts": 1031256.75,
    "houseProfit": 24993.25,
    "houseMargin": 2.36,
    "totalRounds": 2880,
    "avgBetSize": 125.00
  },
  "topBets": [
    {
      "playerId": "63f7d1a2b4c5e6f7g8h9i0j2",
      "username": "player_2026_001",
      "amount": 5000,
      "type": "NUMBER",
      "option": 5
    }
  ],
  "topWinners": [
    {
      "playerId": "63f7d1a2b4c5e6f7g8h9i0j5",
      "username": "lucky_player_42",
      "winnings": 8500.00
    }
  ]
}
```

### Player Analytics

#### Get Player Statistics

```bash
curl -X GET "https://api.wingo.com/api/v1/admin/analytics/players?period=daily&limit=10" \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"
```

**Valid periods:** `daily`, `weekly`, `monthly`, `all`

**Response:**
```json
{
  "period": "daily",
  "players": [
    {
      "playerId": "63f7d1a2b4c5e6f7g8h9i0j5",
      "username": "lucky_player_42",
      "rank": 1,
      "totalBets": 156,
      "totalWins": 89,
      "totalLosses": 67,
      "winRate": 0.571,
      "totalStaked": 19500.00,
      "netProfit": 4250.00,
      "lastActive": "2026-01-15T15:45:20Z"
    }
  ],
  "totalPlayers": 342
}
```

### Round Analytics

#### Get Historical Rounds

```bash
curl -X GET "https://api.wingo.com/api/v1/admin/analytics/rounds?page=1&limit=50&startDate=2026-01-01&endDate=2026-01-15" \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"
```

**Response:**
```json
{
  "rounds": [
    {
      "roundId": "202601150001",
      "status": "SETTLED",
      "result": {
        "number": 5,
        "color": "GREEN",
        "size": "BIG",
        "includesViolet": true
      },
      "totalBets": 245,
      "totalStaked": 30625.00,
      "totalPayouts": 29856.50,
      "houseProfit": 768.50,
      "bettingPlayers": 89,
      "createdAt": "2026-01-15T10:30:00Z",
      "settledAt": "2026-01-15T10:30:30Z"
    }
  ],
  "page": 1,
  "totalRounds": 2880
}
```

### Payout Reports

#### Generate Payout Report

```bash
curl -X GET "https://api.wingo.com/api/v1/admin/analytics/payouts?startDate=2026-01-01&endDate=2026-01-15&groupBy=daily" \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"
```

**Response:**
```json
{
  "reportPeriod": {
    "start": "2026-01-01",
    "end": "2026-01-15"
  },
  "groupBy": "daily",
  "data": [
    {
      "date": "2026-01-15",
      "totalPayouts": 1031256.75,
      "colorPayouts": 512500.00,
      "sizePayouts": 385200.00,
      "numberPayouts": 128400.00,
      "violetPayouts": 5156.75,
      "totalBets": 8450,
      "houseProfit": 24993.25
    }
  ],
  "summary": {
    "totalPayouts": 15468425.00,
    "totalBets": 127500,
    "houseProfit": 374934.75
  }
}
```

---

## Troubleshooting

### Common Issues & Solutions

#### Issue: "Invalid API Key"

**Cause:** API key is incorrect or malformed

**Solution:**
1. Verify API key starts with `wingo_key_`
2. Check for extra spaces or formatting issues
3. Regenerate API key if corrupted

```bash
# Verify current API keys
curl -X GET https://api.wingo.com/api/v1/admin/api-keys \
  -H "Authorization: Bearer {admin_token}"
```

#### Issue: "Rate limit exceeded"

**Cause:** Too many requests in time window

**Response:**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

**Solution:**
1. Implement exponential backoff
2. Cache responses where possible
3. Contact support to increase limits

#### Issue: "Player not found"

**Cause:** Invalid playerId or player deleted

**Solution:**
1. Verify playerId is correct
2. Check player still exists
3. Review player deletion logs

#### Issue: "Insufficient balance"

**Cause:** Player balance < bet amount

**Solution:**
1. Check player's current balance
2. Adjust balance using `/adjust-balance` endpoint
3. Inform player to add funds

#### Issue: "Round state mismatch"

**Cause:** Game round state desynchronized

**Solution:**
1. Wait for next round to start
2. Refresh round status
3. Contact support if persistent

### Debugging Commands

```bash
# Check API connectivity
curl -X GET https://api.wingo.com/api/v1/health

# Verify admin token validity
curl -X POST https://api.wingo.com/api/v1/admin/auth/validate \
  -H "Authorization: Bearer {admin_token}"

# Get detailed error logs
curl -X GET "https://api.wingo.com/api/v1/admin/logs?level=ERROR&limit=50" \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"
```

---

## Support & Contact

- **Email**: support@wingo.com
- **Slack**: #wingo-support
- **Status Page**: status.wingo.com
- **Documentation**: https://api.wingo.com/docs

---

This guide provides comprehensive information for managing your Wingo admin account and platform integration.
