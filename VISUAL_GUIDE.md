# Wingo Platform - Visual Architecture & Quick Navigation

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                       YOUR PLATFORM                                 │
├────────────────────────────────────────────────────────────────────┤
│  Frontend (React/Vue/Angular) + Backend (Node/Python/etc)          │
│                                                                     │
│  Players:                    Admin Dashboard:                      │
│  • Register                  • Create API Keys                     │
│  • Login                     • Manage Players                      │
│  • View Balance              • Configure Game                      │
│  • Place Bets                • View Analytics                      │
└────────────────────┬─────────────────────────────┬─────────────────┘
                     │ API Calls + WebSocket       │
                     │ (Requires API Key)          │
┌────────────────────▼─────────────────────────────▼─────────────────┐
│                   WINGO API GAME PROVIDER                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Player Management      |  Game Engine        |  Admin Controls   │
│  ├─ Register            |  ├─ Round creation  |  ├─ Force result  │
│  ├─ Login               |  ├─ Bet processing  |  ├─ Set mode      │
│  ├─ Wallet              |  ├─ Settlement      |  ├─ Analytics     │
│  └─ Ledger              |  └─ Exposure calc   |  └─ Settings      │
│                         |                     |                    │
│  Real-time Events (WebSocket)                                      │
│  ├─ round-start         ├─ bet-closed                              │
│  ├─ result-reveal       ├─ settlement-complete                     │
│  └─ balance-updated                                                │
│                                                                     │
└────────────────────┬────────────────────────────┬───────────────────┘
                     │                            │
        ┌────────────▼─────────────┐     ┌────────▼──────────┐
        │    MongoDB Database      │     │  Redis Cache      │
        ├─────────────────────────┤     ├───────────────────┤
        │ • Users                 │     │ • Round state     │
        │ • Wallets               │     │ • Exposures       │
        │ • Bets                  │     │ • Game mode       │
        │ • Rounds                │     │ • Locks           │
        │ • Ledgers               │     │ • Stats           │
        │ • Admin Accounts        │     │ • Violet window   │
        │ • API Keys              │     │                   │
        └─────────────────────────┘     └───────────────────┘
```

---

## 🔐 Authentication Flow

```
                    YOUR PLATFORM                    WINGO API
┌─────────────────────────────────┐     ┌──────────────────────────┐
│                                 │     │                          │
│  Admin User                     │     │  Admin Creates Account   │
│       │                         │     │       │                  │
│       ▼                         │     │       ▼                  │
│  Login with Username/Password   │     │  POST /admin/auth/reg    │
│       │                         │     │       │                  │
│       ▼                         │     │       ▼ Returns:         │
│  Get Admin JWT (48h)            │─────▶ adminToken (48h)        │
│       │                         │      apiKey (public)          │
│       ▼                         │      apiSecret (private)      │
│  Generate API Keys             │      │                         │
│  Store API Secret Securely      │      │ [SAVE IN .env]          │
│       │                         │      │                         │
│       ▼                         │      │                         │
│  Send to Frontend Team          │      │                         │
│                                 │      │                         │
│       Frontend App              │      │                         │
│       │                         │      │                         │
│       ▼                         │      │                         │
│  Player Register/Login          │      │                         │
│       │                         │      │                         │
│       ▼                         │      │                         │
│  POST /player/auth/login        │──────▶ Validate API Key       │
│  + X-API-Key: {apiKey}          │      Create Player JWT (24h)  │
│       │                         │      │                         │
│       ▼ Returns:                │      │                         │
│  Player JWT (24h)               │◀────── Return token           │
│       │                         │       │                         │
│       ▼                         │       │                         │
│  All subsequent requests        │       │                         │
│  include:                       │       │                         │
│  - Authorization: Bearer token  │       │                         │
│  - X-API-Key: {apiKey}          │       │                         │
│                                 │       │                         │
└─────────────────────────────────┘       └──────────────────────────┘
```

---

## 🎮 Game Flow (30-Second Cycle)

```
TIME    EVENT                    STATE          BETTING    BET ACCEPTANCE
─────────────────────────────────────────────────────────────────────────

  0s   Round Created             BETTING         OPEN       ✓ Accept bets
       round-start event
       sent to all players
       │
  1s   │
  │    │
  5s   │
  │    │
 10s   │
  │    Players placing bets
 15s   │                         BETTING         OPEN       ✓ Accept bets
  │    │
 20s   │
  │    │
 25s   BETTING CLOSED            CLOSED          CLOSED     ✗ Reject bets
       bet-closed event                                     (5s gate)
       Result frozen in Redis
       │
 26s   │
  │    Result calculated &
 27s   stored in Redis           REVEALED        CLOSED     ✗ Reject bets
  │    │
 28s   │
  │    │
 29s   │
  │    │
 30s   RESULT REVEALED           SETTLED         CLOSED     ✗ Reject bets
       result-reveal event
       Bets settled
       Wallets updated
       settlement-complete event
       │
       └──► NEXT ROUND STARTS (back to 0s)
```

---

## 📊 Data Model Relationships

```
Admin Account
    │
    ├─► API Keys (many)
    │   ├─ API Key
    │   ├─ API Secret
    │   └─ Rate Limits
    │
    └─► Players (many)
        │
        ├─► Wallet
        │   ├─ Balance
        │   └─ Locked Funds
        │
        ├─► Bets (many)
        │   ├─ Round ID
        │   ├─ Type (COLOR/SIZE/NUMBER/VIOLET)
        │   ├─ Amount
        │   └─ Status (PENDING/WON/LOST)
        │
        └─► Ledger Entries (many)
            ├─ Type (DEBIT/CREDIT/FEE)
            ├─ Amount
            ├─ Balance After
            └─ Timestamp

Round (shared across all admins)
    │
    ├─ Round ID
    ├─ Status (BETTING/CLOSED/REVEALED/SETTLED)
    ├─ Result { number, color, size, includesViolet }
    │
    └─► Bets (from all players of all admins)
        └─ But accessed only by owning admin
```

---

## 🎯 Bet Types & Number Mapping

```
NUMBER    PROPERTIES              COLOR      SIZE      INCLUDES
─────────────────────────────────────────────────────────────
  0       ✨ Special Violet       RED        SMALL     VIOLET
  1       Green Small             GREEN      SMALL     -
  2       Red Big                 RED        BIG       -
  3       Green Small             GREEN      SMALL     -
  4       Red Big                 RED        BIG       -
  5       ✨ Special Violet       GREEN      BIG       VIOLET
  6       Red Big                 RED        BIG       -
  7       Green Small             GREEN      SMALL     -
  8       Red Big                 RED        BIG       -
  9       Green Small             GREEN      SMALL     -


PAYOUT TABLE (Net Amount = Bet * 0.98)
─────────────────────────────────────────

Bet on:          If number drawn:           Payout:
RED              0-9 (RED result)           2.0x net amount
                 0 or 5 (VIOLET)            1.5x net amount
GREEN            1,3,7,9,5                  2.0x net amount
SMALL (0-4)      0-4                        2.0x net amount
BIG (5-9)        5-9                        2.0x net amount
NUMBER (0-9)     Exact match                9.0x net amount
VIOLET           0 or 5                     4.5x net amount
```

---

## 📈 State Transitions

```
Admin Creation Flow:
   Register Admin
       │
       ▼
   Get JWT Token (48h)
       │
       ▼
   Generate API Keys
       │
       ▼
   Create Players
       │
       ▼
   Ready for Integration


Round State Flow:
   BETTING ──(T=25s)──> CLOSED ──(T=30s)──> REVEALED ──(instant)──> SETTLED
   
   Players:            No new       Result         Settlement
   Accept Bets         bets         revealed       complete


Player Wallet Flow:
   Initial Balance
       │
       ├─ Bet Placed ──> Balance ↓ | Locked ↑
       │
       ├─ Bet Won ──────> Balance ↑ | Locked ↓ (payout added)
       │
       └─ Bet Lost ─────> Balance - | Locked ↓


Settlement Process:
   1. Load all PENDING bets
   2. For each bet:
      ├─ Evaluate against result
      ├─ Calculate payout if won
      ├─ Update wallet
      └─ Create ledger entry
   3. Mark bets as WON/LOST
   4. Emit settlement-complete event
```

---

## 🔄 Request/Response Flow

```
Client Request:
┌──────────────────────────────────────────────┐
│ POST /api/v1/player/bet                      │
├──────────────────────────────────────────────┤
│ Headers:                                      │
│ ├─ X-API-Key: wingo_key_...                  │
│ ├─ Authorization: Bearer {playerToken}       │
│ └─ Content-Type: application/json            │
│                                               │
│ Body:                                         │
│ {                                             │
│   "roundId": "202601150001",                  │
│   "bets": [                                   │
│     { "type": "COLOR", "option": "RED",       │
│       "amount": 100 },                        │
│     { "type": "NUMBER", "option": 5,          │
│       "amount": 50 }                          │
│   ]                                           │
│ }                                             │
└──────────────────────────────────────────────┘
                    │ WINGO API
                    ▼
            ┌──────────────────┐
            │ Validate API Key │
            │ Validate Token   │
            │ Check Round Open │
            │ Check Balance    │
            │ Check 5s Gate    │
            └──────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Create Bet Records   │
         │ Update Exposures     │
         │ Deduct Wallet        │
         │ Create Ledger Entry  │
         └──────────────────────┘
                    │
                    ▼
         Response Sent to Client:
         ┌──────────────────────┐
         │ 200 OK               │
         ├──────────────────────┤
         │ {                    │
         │   "roundId": "...",  │
         │   "betIds": [...]    │
         │ }                    │
         └──────────────────────┘
```

---

## 📋 API Endpoint Organization

```
/api/v1/
│
├─ player/                          (Player-facing endpoints)
│   ├─ auth/
│   │   ├─ POST   register
│   │   └─ POST   login
│   ├─ bet/
│   │   ├─ POST   /               (place bets)
│   │   └─ GET    /               (bet history)
│   └─ wallet/
│       ├─ GET    /wallet          (check balance)
│       └─ GET    /ledger          (transaction history)
│
├─ admin/                           (Admin-facing endpoints)
│   ├─ auth/
│   │   ├─ POST   register
│   │   └─ POST   login
│   ├─ api-keys/
│   │   ├─ POST   generate
│   │   ├─ GET    /
│   │   ├─ POST   /{id}/revoke
│   │   └─ DELETE /{id}
│   ├─ players/
│   │   ├─ POST   create
│   │   ├─ GET    /               (list)
│   │   ├─ GET    /{id}           (details)
│   │   ├─ POST   /{id}/adjust-balance
│   │   └─ DELETE /{id}
│   ├─ game/
│   │   ├─ POST   force-result
│   │   ├─ POST   mode
│   │   ├─ POST   settings
│   │   └─ GET    exposure/{id}
│   └─ analytics/
│       ├─ GET    dashboard
│       ├─ GET    players
│       ├─ GET    rounds
│       ├─ GET    payouts
│       └─ GET    ledger
│
└─ health/                          (System endpoints)
    ├─ GET    /
    ├─ GET    /redis
    └─ GET    /mongodb
```

---

## 🚀 Deployment Pipeline

```
Development
    │
    ├─ Read Documentation
    │ └─ CODE_ROADMAP.md, API_INTEGRATION_EXAMPLES.md
    │
    ├─ Local Setup
    │ ├─ npm install
    │ ├─ Configure .env
    │ └─ npm run dev
    │
    └─ Code Implementation
      ├─ Restructure routes (player vs admin)
      ├─ Create API key model & middleware
      ├─ Add admin endpoints
      └─ Add analytics endpoints
          │
          ▼
Staging Environment
    │
    ├─ Create test admin account
    ├─ Generate staging API keys
    ├─ Create test players
    ├─ Test all endpoints
    ├─ Load testing (100+ concurrent)
    ├─ Security review
    └─ Performance testing
          │
          ▼
Production
    │
    ├─ Deploy to production servers
    ├─ Configure monitoring/alerts
    ├─ Set up log aggregation
    ├─ Create admin accounts for customers
    ├─ Document onboarding process
    └─ 24/7 Support ready
```

---

## 📚 Documentation Map

```
                          START HERE
                             │
                    QUICK_REFERENCE.md
                       (5 minutes)
                             │
                    ┌────────┼────────┐
                    │        │        │
                    ▼        ▼        ▼
              Developer  Admin    Manager
                │        │        │
         INTEGRATION    SETUP    ROADMAP
         EXAMPLES.md   GUIDE.md  SUMMARY.md
         (30 min)      (30 min)  (10 min)
                │        │        │
                └────────┼────────┘
                         │
                  CODE_ROADMAP.md
                  (45 minutes)
                  COMPLETE SPEC
```

---

## ✅ Quick Status Checklist

```
Documentation Status:
✅ QUICK_REFERENCE.md ............ Complete
✅ DOCUMENTATION_SUMMARY.md ...... Complete  
✅ CODE_ROADMAP.md .............. Complete (45 KB)
✅ API_INTEGRATION_EXAMPLES.md .. Complete (35 KB, 6 languages)
✅ ADMIN_SETUP_GUIDE.md ......... Complete (30 KB)
✅ INDEX.md ..................... Complete
✅ VISUAL_GUIDE.md .............. This file

Project Status:
⏳ Code Restructuring ........... Not Started (see DOCUMENTATION_SUMMARY.md)
⏳ API Key Implementation ....... Not Started
⏳ Admin Endpoints .............. Not Started
⏳ Analytics Endpoints .......... Not Started
```

---

## 🎓 Learning Resources by File Size

```
Quick (5 min):    QUICK_REFERENCE.md
Short (10 min):   DOCUMENTATION_SUMMARY.md
Medium (30 min):  API_INTEGRATION_EXAMPLES.md
Medium (30 min):  ADMIN_SETUP_GUIDE.md
Long (45 min):    CODE_ROADMAP.md
─────────────────────────────────
Total: ~2 hours of reading material
```

---

**Last Updated:** January 15, 2026  
**Version:** 1.0
