# Wingo API - Integration Examples & Code Samples

## Quick Start Examples

### 1. Node.js Integration (Express Backend)

```javascript
// File: routes/wingo.js
import express from 'express';
import axios from 'axios';

const router = express.Router();
const WINGO_API_BASE = 'https://api.wingo.com/api/v1';
const API_KEY = process.env.WINGO_API_KEY;
const ADMIN_TOKEN = process.env.WINGO_ADMIN_TOKEN;

// Create a player
router.post('/create-player', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const response = await axios.post(
      `${WINGO_API_BASE}/admin/players/create`,
      { username, password, initialBalance: 1000 },
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// Login player
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const response = await axios.post(
      `${WINGO_API_BASE}/player/auth/login`,
      { username, password },
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// Get player wallet
router.get('/wallet/:playerId', async (req, res) => {
  try {
    const playerToken = req.headers.authorization.split(' ')[1];
    
    const response = await axios.get(
      `${WINGO_API_BASE}/player/wallet`,
      {
        headers: {
          'Authorization': `Bearer ${playerToken}`,
          'X-API-Key': API_KEY
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

export default router;
```

### 2. Frontend Integration (React + Socket.io)

```javascript
// File: components/WingoGame.jsx
import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const WingoGame = ({ playerToken, apiKey }) => {
  const [socket, setSocket] = useState(null);
  const [roundId, setRoundId] = useState(null);
  const [balance, setBalance] = useState(0);
  const [bets, setBets] = useState([]);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    // Initialize Socket.io connection
    const newSocket = io('https://api.wingo.com', {
      auth: {
        apiKey: apiKey,
        token: playerToken
      }
    });

    // Listen for round start
    newSocket.on('round-start', ({ roundId, endTs }) => {
      setRoundId(roundId);
      setResult(null);
      const totalSeconds = Math.ceil((endTs - Date.now()) / 1000);
      setTimeLeft(totalSeconds);
    });

    // Listen for bet closed
    newSocket.on('bet-closed', ({ roundId }) => {
      console.log(`Betting closed for round ${roundId}`);
    });

    // Listen for result reveal
    newSocket.on('result-reveal', ({ roundId, result }) => {
      setResult(result);
      console.log(`Result: ${result.number} - ${result.color}`);
    });

    // Listen for balance updates
    newSocket.on('balance-updated', ({ newBalance }) => {
      setBalance(newBalance);
    });

    // Countdown timer
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    setSocket(newSocket);

    return () => {
      clearInterval(timer);
      newSocket.disconnect();
    };
  }, [playerToken, apiKey]);

  // Place bet
  const placeBet = async (bets) => {
    try {
      const response = await fetch('https://api.wingo.com/api/v1/player/bet', {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Authorization': `Bearer ${playerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roundId: roundId,
          bets: bets
        })
      });

      const data = await response.json();
      console.log('Bets placed:', data.betIds);
    } catch (error) {
      console.error('Bet placement failed:', error);
    }
  };

  return (
    <div className="wingo-game">
      <div className="round-info">
        <h2>Round {roundId}</h2>
        <p className="timer">Time Left: {timeLeft}s</p>
      </div>

      <div className="balance-display">
        Balance: <strong>₹{balance}</strong>
      </div>

      {result && (
        <div className="result-display">
          <h3>Result: {result.number}</h3>
          <p>Color: {result.color}</p>
          <p>Size: {result.size}</p>
        </div>
      )}

      <div className="betting-section">
        <button onClick={() => placeBet([
          { type: 'COLOR', option: 'RED', amount: 100 }
        ])}>
          Bet RED (2x)
        </button>

        <button onClick={() => placeBet([
          { type: 'NUMBER', option: 5, amount: 50 }
        ])}>
          Bet 5 (9x)
        </button>

        <button onClick={() => placeBet([
          { type: 'SIZE', option: 'BIG', amount: 100 }
        ])}>
          Bet BIG (2x)
        </button>
      </div>

      <div className="bet-history">
        <h4>Recent Bets</h4>
        {bets.length === 0 ? (
          <p>No bets yet</p>
        ) : (
          <ul>
            {bets.map((bet, idx) => (
              <li key={idx}>
                {bet.type} {bet.option} - ₹{bet.amount} [{bet.status}]
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default WingoGame;
```

### 3. Python Integration (Django Backend)

```python
# File: wingo_service.py
import requests
import hmac
import hashlib
import json
from datetime import datetime, timedelta
from django.conf import settings

WINGO_API_BASE = 'https://api.wingo.com/api/v1'
API_KEY = settings.WINGO_API_KEY
API_SECRET = settings.WINGO_API_SECRET
ADMIN_TOKEN = settings.WINGO_ADMIN_TOKEN


def generate_api_signature(method, path, body, secret):
    """Generate HMAC-SHA256 signature for API request"""
    timestamp = int(datetime.now().timestamp())
    
    # Build signature string
    if body:
        payload = f"{method}{path}{json.dumps(body)}{timestamp}"
    else:
        payload = f"{method}{path}{timestamp}"
    
    # Generate HMAC-SHA256
    signature = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return signature, timestamp


def create_player(username, password, initial_balance=1000):
    """Create a new player in Wingo"""
    headers = {
        'Authorization': f'Bearer {ADMIN_TOKEN}',
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
    }
    
    data = {
        'username': username,
        'password': password,
        'initialBalance': initial_balance
    }
    
    response = requests.post(
        f'{WINGO_API_BASE}/admin/players/create',
        json=data,
        headers=headers
    )
    
    return response.json()


def login_player(username, password):
    """Login player and get JWT token"""
    headers = {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
    }
    
    data = {
        'username': username,
        'password': password
    }
    
    response = requests.post(
        f'{WINGO_API_BASE}/player/auth/login',
        json=data,
        headers=headers
    )
    
    return response.json()


def get_wallet_balance(player_token):
    """Get player's wallet balance"""
    headers = {
        'Authorization': f'Bearer {player_token}',
        'X-API-Key': API_KEY
    }
    
    response = requests.get(
        f'{WINGO_API_BASE}/player/wallet',
        headers=headers
    )
    
    return response.json()


def place_bet(player_token, round_id, bets):
    """Place bets for a player"""
    headers = {
        'X-API-Key': API_KEY,
        'Authorization': f'Bearer {player_token}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'roundId': round_id,
        'bets': bets
    }
    
    response = requests.post(
        f'{WINGO_API_BASE}/player/bet',
        json=data,
        headers=headers
    )
    
    return response.json()


def get_analytics_dashboard(admin_token):
    """Get admin analytics dashboard"""
    headers = {
        'Authorization': f'Bearer {admin_token}',
        'X-API-Key': API_KEY
    }
    
    response = requests.get(
        f'{WINGO_API_BASE}/admin/analytics/dashboard',
        headers=headers
    )
    
    return response.json()


# Django Views
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

@require_http_methods(["POST"])
def create_player_view(request):
    """API endpoint to create player"""
    data = json.loads(request.body)
    result = create_player(data['username'], data['password'])
    return JsonResponse(result)


@require_http_methods(["POST"])
def login_view(request):
    """API endpoint to login player"""
    data = json.loads(request.body)
    result = login_player(data['username'], data['password'])
    return JsonResponse(result)


@require_http_methods(["GET"])
def wallet_view(request):
    """API endpoint to get wallet"""
    token = request.headers.get('Authorization', '').split(' ')[1]
    result = get_wallet_balance(token)
    return JsonResponse(result)
```

### 4. cURL Examples

```bash
# ========================================
# ADMIN ENDPOINTS
# ========================================

# 1. Register Admin
curl -X POST https://api.wingo.com/api/v1/admin/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "mygames_admin",
    "password": "secure_password_123",
    "platformName": "MyGames Platform"
  }'

# Response:
# {
#   "adminId": "...",
#   "apiKey": "wingo_key_...",
#   "apiSecret": "wingo_secret_...",
#   "token": "eyJhbGciOiJIUzI1NiIs..."
# }


# 2. Login Admin
curl -X POST https://api.wingo.com/api/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "mygames_admin",
    "password": "secure_password_123"
  }'


# 3. Generate API Key
curl -X POST https://api.wingo.com/api/v1/admin/api-keys/generate \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production API Key"
  }'


# 4. List All Players
curl -X GET "https://api.wingo.com/api/v1/admin/players?page=1&limit=20" \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"


# ========================================
# PLAYER ENDPOINTS
# ========================================

# 1. Register Player
curl -X POST https://api.wingo.com/api/v1/player/auth/register \
  -H "X-API-Key: {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "player_001",
    "password": "player_password"
  }'


# 2. Login Player
curl -X POST https://api.wingo.com/api/v1/player/auth/login \
  -H "X-API-Key: {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "player_001",
    "password": "player_password"
  }'

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIs...",
#   "expiresIn": "24h"
# }


# 3. Get Wallet Balance
curl -X GET https://api.wingo.com/api/v1/player/wallet \
  -H "X-API-Key: {api_key}" \
  -H "Authorization: Bearer {player_token}"


# 4. Get Ledger/Transaction History
curl -X GET https://api.wingo.com/api/v1/player/ledger \
  -H "X-API-Key: {api_key}" \
  -H "Authorization: Bearer {player_token}"


# 5. Place Bet
curl -X POST https://api.wingo.com/api/v1/player/bet \
  -H "X-API-Key: {api_key}" \
  -H "Authorization: Bearer {player_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "roundId": "202601150001",
    "bets": [
      {
        "type": "COLOR",
        "option": "RED",
        "amount": 100
      },
      {
        "type": "NUMBER",
        "option": 5,
        "amount": 50
      },
      {
        "type": "SIZE",
        "option": "BIG",
        "amount": 100
      }
    ]
  }'

# Response:
# {
#   "roundId": "202601150001",
#   "betIds": ["bet_001", "bet_002", "bet_003"]
# }


# 6. Get Bet History
curl -X GET "https://api.wingo.com/api/v1/player/bets?page=1&limit=10" \
  -H "X-API-Key: {api_key}" \
  -H "Authorization: Bearer {player_token}"


# ========================================
# ADMIN GAME CONTROL
# ========================================

# 1. Force Result
curl -X POST https://api.wingo.com/api/v1/admin/game/force-result \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "roundId": "202601150001",
    "number": 5
  }'


# 2. Change Game Mode
curl -X POST https://api.wingo.com/api/v1/admin/game/mode \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "MAX_PROFIT"
  }'


# 3. Get Round Exposures
curl -X GET https://api.wingo.com/api/v1/admin/game/exposure/202601150001 \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"


# ========================================
# ADMIN ANALYTICS
# ========================================

# 1. Get Dashboard Stats
curl -X GET https://api.wingo.com/api/v1/admin/analytics/dashboard \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"


# 2. Get Player Stats
curl -X GET "https://api.wingo.com/api/v1/admin/analytics/players?period=daily" \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"


# 3. Get Payout Reports
curl -X GET "https://api.wingo.com/api/v1/admin/analytics/payouts?startDate=2026-01-01&endDate=2026-01-15" \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-API-Key: {api_key}"
```

### 5. TypeScript Integration

```typescript
// File: services/WingoAPI.ts
import axios, { AxiosInstance } from 'axios';

interface BetPayload {
  type: 'COLOR' | 'NUMBER' | 'SIZE' | 'VIOLET';
  option: string | number;
  amount: number;
}

interface PlaceBetRequest {
  roundId: string;
  bets: BetPayload[];
}

interface WalletBalance {
  userId: string;
  balance: number;
  locked: number;
}

class WingoAPI {
  private apiClient: AxiosInstance;
  private apiKey: string;
  private playerToken: string;

  constructor(apiKey: string, playerToken?: string) {
    this.apiKey = apiKey;
    this.playerToken = playerToken || '';

    this.apiClient = axios.create({
      baseURL: 'https://api.wingo.com/api/v1',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  setPlayerToken(token: string): void {
    this.playerToken = token;
  }

  async loginPlayer(username: string, password: string): Promise<{ token: string }> {
    const response = await this.apiClient.post('/player/auth/login', {
      username,
      password
    });
    return response.data;
  }

  async getWallet(): Promise<WalletBalance> {
    const response = await this.apiClient.get('/player/wallet', {
      headers: {
        'Authorization': `Bearer ${this.playerToken}`
      }
    });
    return response.data;
  }

  async placeBet(roundId: string, bets: BetPayload[]): Promise<{ roundId: string; betIds: string[] }> {
    const response = await this.apiClient.post('/player/bet', 
      { roundId, bets } as PlaceBetRequest,
      {
        headers: {
          'Authorization': `Bearer ${this.playerToken}`
        }
      }
    );
    return response.data;
  }

  async getBetHistory(page: number = 1, limit: number = 10) {
    const response = await this.apiClient.get(`/player/bets`, {
      params: { page, limit },
      headers: {
        'Authorization': `Bearer ${this.playerToken}`
      }
    });
    return response.data;
  }

  async getLedger(page: number = 1, limit: number = 50) {
    const response = await this.apiClient.get(`/player/ledger`, {
      params: { page, limit },
      headers: {
        'Authorization': `Bearer ${this.playerToken}`
      }
    });
    return response.data;
  }
}

export default WingoAPI;
```

### 6. Vue.js Integration

```vue
<!-- File: components/WingoGameBoard.vue -->
<template>
  <div class="wingo-board">
    <div class="header">
      <h1>Wingo Game</h1>
      <p class="timer" :class="{ low: timeLeft < 5 }">{{ timeLeft }}s</p>
      <p class="balance">Balance: ₹{{ balance }}</p>
    </div>

    <div v-if="result" class="result-box">
      <h2>{{ result.number }}</h2>
      <p class="color">{{ result.color }}</p>
      <p class="size">{{ result.size }}</p>
      <p v-if="result.includesViolet" class="violet">✨ VIOLET ✨</p>
    </div>

    <div class="betting-grid">
      <div class="color-bets">
        <button @click="placeBet('COLOR', 'RED', 100)" :disabled="timeLeft < 5">
          RED
          <span>2x</span>
        </button>
        <button @click="placeBet('COLOR', 'GREEN', 100)" :disabled="timeLeft < 5">
          GREEN
          <span>2x</span>
        </button>
      </div>

      <div class="number-bets">
        <div class="number-grid">
          <button
            v-for="num in 10"
            :key="num"
            @click="placeBet('NUMBER', num - 1, 50)"
            :disabled="timeLeft < 5"
            :class="{ violet: [0, 5].includes(num - 1) }"
          >
            {{ num - 1 }}
            <span>9x</span>
          </button>
        </div>
      </div>

      <div class="size-bets">
        <button @click="placeBet('SIZE', 'SMALL', 100)" :disabled="timeLeft < 5">
          SMALL
          <span>2x</span>
        </button>
        <button @click="placeBet('SIZE', 'BIG', 100)" :disabled="timeLeft < 5">
          BIG
          <span>2x</span>
        </button>
      </div>
    </div>

    <div class="bet-history">
      <h3>Recent Bets</h3>
      <ul>
        <li v-for="(bet, idx) in recentBets" :key="idx" :class="bet.status.toLowerCase()">
          {{ bet.type }} {{ bet.option }} - ₹{{ bet.amount }} <strong>{{ bet.status }}</strong>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { io } from 'socket.io-client';
import WingoAPI from '@/services/WingoAPI';

export default {
  name: 'WingoGameBoard',
  props: {
    apiKey: String,
    playerToken: String
  },
  data() {
    return {
      socket: null,
      api: null,
      roundId: null,
      balance: 0,
      timeLeft: 30,
      result: null,
      recentBets: []
    };
  },
  mounted() {
    this.initializeSocket();
    this.initializeAPI();
    this.fetchBalance();
  },
  methods: {
    initializeSocket() {
      this.socket = io('https://api.wingo.com', {
        auth: {
          apiKey: this.apiKey,
          token: this.playerToken
        }
      });

      this.socket.on('round-start', ({ roundId, endTs }) => {
        this.roundId = roundId;
        this.result = null;
        this.startCountdown(endTs);
      });

      this.socket.on('result-reveal', ({ result }) => {
        this.result = result;
      });

      this.socket.on('balance-updated', ({ newBalance }) => {
        this.balance = newBalance;
      });
    },
    initializeAPI() {
      this.api = new WingoAPI(this.apiKey, this.playerToken);
    },
    async placeBet(type, option, amount) {
      try {
        await this.api.placeBet(this.roundId, [
          { type, option, amount }
        ]);
        await this.fetchBets();
      } catch (error) {
        console.error('Failed to place bet:', error);
      }
    },
    async fetchBalance() {
      try {
        const wallet = await this.api.getWallet();
        this.balance = wallet.balance;
      } catch (error) {
        console.error('Failed to fetch balance:', error);
      }
    },
    async fetchBets() {
      try {
        const data = await this.api.getBetHistory(1, 5);
        this.recentBets = data.bets;
      } catch (error) {
        console.error('Failed to fetch bets:', error);
      }
    },
    startCountdown(endTs) {
      const interval = setInterval(() => {
        const remaining = Math.ceil((endTs - Date.now()) / 1000);
        this.timeLeft = remaining > 0 ? remaining : 0;

        if (this.timeLeft <= 0) {
          clearInterval(interval);
        }
      }, 100);
    }
  },
  beforeUnmount() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
};
</script>

<style scoped>
.wingo-board {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.timer {
  font-size: 48px;
  font-weight: bold;
  color: #00aa00;
}

.timer.low {
  color: #ff0000;
  animation: blink 0.5s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}

.balance {
  font-size: 24px;
  font-weight: bold;
}

.betting-grid {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  gap: 20px;
  margin: 30px 0;
}

button {
  padding: 15px;
  font-size: 16px;
  border: 2px solid #333;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

button:hover:not(:disabled) {
  background-color: #f0f0f0;
  transform: scale(1.05);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.result-box {
  text-align: center;
  padding: 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  margin-bottom: 20px;
}

.result-box h2 {
  font-size: 72px;
  margin: 0;
}

.violet {
  background-color: #9370db !important;
}
</style>
```

---

## Error Handling Best Practices

### Common Errors & Solutions

```javascript
// Error: "Invalid API Key"
// Solution: Verify API key in headers
const headers = {
  'X-API-Key': 'wingo_key_...',  // Must start with 'wingo_key_'
  'Authorization': 'Bearer ...'
};

// Error: "Betting closed"
// Solution: Check timeLeft < 5000ms
if (timeLeft < 5000) {
  console.warn('Betting window closing soon');
}

// Error: "Insufficient balance"
// Solution: Check wallet balance before betting
if (betAmount > wallet.balance) {
  console.error('Insufficient balance');
}

// Error: "Round not found"
// Solution: Ensure roundId is current
// Subscribe to 'round-start' for latest roundId

// Retry logic
async function apiCallWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
    }
  }
}
```

---

## Testing Your Integration

### Unit Test Examples

```javascript
// File: __tests__/wingo.test.js
import WingoAPI from '../services/WingoAPI';

describe('WingoAPI', () => {
  let api;

  beforeEach(() => {
    api = new WingoAPI('test_api_key');
  });

  test('placeBet should send correct payload', async () => {
    api.setPlayerToken('test_token');
    
    const result = await api.placeBet('202601150001', [
      { type: 'COLOR', option: 'RED', amount: 100 }
    ]);

    expect(result.roundId).toBe('202601150001');
    expect(result.betIds).toHaveLength(1);
  });

  test('getWallet should return balance', async () => {
    api.setPlayerToken('test_token');
    
    const wallet = await api.getWallet();

    expect(wallet.balance).toBeGreaterThanOrEqual(0);
    expect(wallet.locked).toBeGreaterThanOrEqual(0);
  });
});
```

This documentation provides complete integration examples for various technologies and platforms used with the Wingo API.
