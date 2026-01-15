# Wingo API - Quick Reference Guide

## Project at a Glance

**Wingo** = B2B Gaming API Platform where merchants integrate the game into their platforms

```
Your Company → Creates Admin Account → Gets API Key → 
Uses API to Manage Players → Players Play Game via Your Frontend
```

---

## Key Concepts

### Three Authentication Layers

| Layer | Who | Token | Expiry | Purpose |
|-------|-----|-------|--------|---------|
| Admin | Merchant | JWT | 48h | Manage API keys, players, analytics |
| API Key | Backend | API Key + Secret | ∞ | Authenticate backend requests |
| Player | End User | JWT | 24h | Gameplay authentication |

### Bet Types & Payouts

| Type | Option | Multiplier | Example |
|------|--------|------------|---------|
| COLOR | RED/GREEN | 2.0x | Bet ₹100 → Win ₹200 |
| SIZE | SMALL/BIG | 2.0x | Bet ₹100 → Win ₹200 |
| NUMBER | 0-9 | 9.0x | Bet ₹100 → Win ₹900 |
| VIOLET | Always | 4.5x | Bet ₹100 → Win ₹450 |

### Game Round (30 seconds)
```
T=0s  → Round starts, betting opens
T=25s → Betting closes, result freezes
T=30s → Result revealed, settlement
```

---

## Essential API Endpoints

### For Admins

```bash
# Create account & get API key
POST /api/v1/admin/auth/register
  → Returns: apiKey, apiSecret

# Generate more API keys
POST /api/v1/admin/api-keys/generate
  → Returns: apiKey, apiSecret

# Create a player
POST /api/v1/admin/players/create
  → Returns: playerId, balance

# Get analytics
GET /api/v1/admin/analytics/dashboard
  → Returns: stats, metrics
```

### For Players

```bash
# Login
POST /api/v1/player/auth/login
  → Returns: JWT token

# Get wallet balance
GET /api/v1/player/wallet
  → Returns: balance, locked

# Place bets
POST /api/v1/player/bet
  → Returns: betIds

# WebSocket: Listen for events
socket.on('round-start', ...)
socket.on('result-reveal', ...)
socket.on('balance-updated', ...)
```

---

## Required Headers

### Admin Requests
```
Authorization: Bearer {admin_jwt_token}
X-API-Key: {api_key}
Content-Type: application/json
```

### Player Requests
```
Authorization: Bearer {player_jwt_token}
X-API-Key: {api_key}
Content-Type: application/json
```

---

## Common Tasks

### Task 1: Set Up New Admin Account (5 minutes)

```bash
# 1. Register
curl -X POST https://api.wingo.com/api/v1/admin/auth/register \
  -d '{"username":"admin1","password":"pass123","platformName":"MyGame"}'

# 2. Save: apiKey, apiSecret, adminToken

# 3. Generate production API key
curl -X POST https://api.wingo.com/api/v1/admin/api-keys/generate \
  -H "Authorization: Bearer {adminToken}"

# 4. Store securely
```

### Task 2: Create Test Player (1 minute)

```bash
curl -X POST https://api.wingo.com/api/v1/admin/players/create \
  -H "Authorization: Bearer {adminToken}" \
  -H "X-API-Key: {apiKey}" \
  -d '{"username":"player1","password":"pass123","initialBalance":1000}'
```

### Task 3: Player Login & Get Token (30 seconds)

```bash
curl -X POST https://api.wingo.com/api/v1/player/auth/login \
  -H "X-API-Key: {apiKey}" \
  -d '{"username":"player1","password":"pass123"}'

# Response: { token: "eyJ..." }
```

### Task 4: Place a Bet (10 seconds)

```bash
curl -X POST https://api.wingo.com/api/v1/player/bet \
  -H "X-API-Key: {apiKey}" \
  -H "Authorization: Bearer {playerToken}" \
  -d '{
    "roundId":"202601150001",
    "bets":[{"type":"COLOR","option":"RED","amount":100}]
  }'
```

### Task 5: Check Balance (5 seconds)

```bash
curl -X GET https://api.wingo.com/api/v1/player/wallet \
  -H "X-API-Key: {apiKey}" \
  -H "Authorization: Bearer {playerToken}"
```

---

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check payload format |
| 401 | Unauthorized | Check token/API key |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Verify playerId/roundId |
| 429 | Rate Limited | Wait before retrying |
| 500 | Server Error | Contact support |

---

## WebSocket Events

### Receive (Real-time updates)

```javascript
socket.on('round-start', ({ roundId, endTs }) => {
  // New round started
});

socket.on('bet-closed', ({ roundId }) => {
  // No more bets accepted
});

socket.on('result-reveal', ({ roundId, result }) => {
  // { number, color, size, includesViolet }
});

socket.on('balance-updated', ({ newBalance }) => {
  // Your balance changed
});
```

### Send

```javascript
socket.emit('join-round', { roundId });
socket.emit('get-current-round', {});
```

---

## File Structure

```
📁 Documentation Files (You are here)
├── CODE_ROADMAP.md ..................... Full technical spec
├── API_INTEGRATION_EXAMPLES.md ......... Code samples
├── ADMIN_SETUP_GUIDE.md ............... Admin procedures
├── DOCUMENTATION_SUMMARY.md ........... Overview
└── QUICK_REFERENCE.md ................ This file

📁 Source Code (Needs restructuring)
├── src/models/ ........................ Data models
├── src/routes/ ........................ API endpoints
├── src/services/ ...................... Business logic
├── src/middleware/ .................... Authentication
└── src/config/ ........................ Setup files
```

---

## Development Checklist

### Before Going Live

- [ ] Create admin account
- [ ] Generate API keys (production & staging)
- [ ] Create 5 test players
- [ ] Test betting flow end-to-end
- [ ] Verify balance adjustments
- [ ] Check analytics dashboards
- [ ] Test error scenarios
- [ ] Verify WebSocket events
- [ ] Load test with 100+ concurrent players
- [ ] Security audit
- [ ] Set up monitoring/alerts

### Integration Steps

- [ ] API documentation reviewed
- [ ] Authentication understood (3 layers)
- [ ] Code examples reviewed for your tech stack
- [ ] Backend setup (credentials stored securely)
- [ ] Frontend integration (WebSocket + REST)
- [ ] Test complete betting cycle
- [ ] User registration flow integrated
- [ ] Game UI implemented
- [ ] Error handling added
- [ ] Deployed to staging
- [ ] Final testing before production

---

## Important Notes

### Security

⚠️ **Never expose API Secret in frontend code**
- API Secret must stay on backend only
- API Key can be in frontend (it's public)
- Player tokens expire in 24h
- Admin tokens expire in 48h

### Rate Limits

- Default: 1,000 requests/hour per API key
- Contact support for higher limits
- Implement retry logic with backoff

### Data Isolation

- Each admin's players are separate
- Cannot see other admin's data
- Round history is shared (audit trail)
- Ledger entries are private per admin

---

## Quick API Playground

Try these in sequence:

```bash
# 1. Register admin
curl -X POST https://api.wingo.com/api/v1/admin/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test_admin","password":"Test@123","platformName":"TestGame"}'

# Save the returned: adminToken, apiKey, apiSecret

# 2. Create player
curl -X POST https://api.wingo.com/api/v1/admin/players/create \
  -H "Authorization: Bearer {adminToken}" \
  -H "X-API-Key: {apiKey}" \
  -H "Content-Type: application/json" \
  -d '{"username":"testplayer","password":"Test@123","initialBalance":5000}'

# Save: playerId

# 3. Login player
curl -X POST https://api.wingo.com/api/v1/player/auth/login \
  -H "X-API-Key: {apiKey}" \
  -H "Content-Type: application/json" \
  -d '{"username":"testplayer","password":"Test@123"}'

# Save: playerToken

# 4. Get balance
curl -X GET https://api.wingo.com/api/v1/player/wallet \
  -H "X-API-Key: {apiKey}" \
  -H "Authorization: Bearer {playerToken}"

# Should see: {"userId":"...","balance":5000,"locked":0}

# 5. Place bet
curl -X POST https://api.wingo.com/api/v1/player/bet \
  -H "X-API-Key: {apiKey}" \
  -H "Authorization: Bearer {playerToken}" \
  -H "Content-Type: application/json" \
  -d '{"roundId":"202601150001","bets":[{"type":"COLOR","option":"RED","amount":100}]}'

# Should see: {"roundId":"...","betIds":["..."]}
```

---

## Getting Help

| Need | Resource |
|------|----------|
| Technical Details | CODE_ROADMAP.md |
| Code Examples | API_INTEGRATION_EXAMPLES.md |
| Admin Tasks | ADMIN_SETUP_GUIDE.md |
| Project Overview | DOCUMENTATION_SUMMARY.md |
| Quick Answer | This file (QUICK_REFERENCE.md) |

---

## Common Questions

**Q: Can players create their own accounts?**
A: No, admins create players via API. This allows admins to control initial balance and metadata.

**Q: Is the game fair?**
A: Yes! Results are calculated based on betting exposures using MAX_PROFIT/MAX_LOSS algorithms. Violet cap prevents over-exposure.

**Q: Can I change game settings?**
A: Yes, via `/admin/game/settings`. Each admin has independent configuration.

**Q: How often do rounds happen?**
A: Every 30 seconds, continuously. Gives 2,880 rounds per day.

**Q: What happens if I don't have API Secret?**
A: Contact support. API Secret shown only once during generation. If lost, generate new API key.

---

**Last Updated:** January 15, 2026  
**Version:** 1.0
