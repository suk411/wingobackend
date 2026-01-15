# Wingo API - Supabase Integration Examples

## Table of Contents
1. [Backend Integration (Node.js + Supabase)](#backend-integration)
2. [Frontend Integration (React + Socket.io)](#frontend-integration)
3. [Python/Django Integration](#pythondjango-integration)
4. [Webhook Integration](#webhook-integration)
5. [Real-time Subscriptions](#real-time-subscriptions)
6. [TypeScript Examples](#typescript-examples)

---

## Backend Integration

### 1. Node.js/Express with Supabase

#### Setup
```javascript
// File: src/config/supabase.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
```

#### Admin Authentication
```javascript
// File: routes/admin/authRoutes.js
import express from 'express';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { supabaseAdmin } from '../../config/supabase.js';
import crypto from 'crypto';

const router = express.Router();

// Admin Register
router.post('/register', async (req, res) => {
  try {
    const { username, password, platformName } = req.body;

    // Hash password
    const passwordHash = await bcryptjs.hash(password, 10);

    // Create admin in Supabase
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .insert([
        {
          username,
          password_hash: passwordHash,
          platform_name: platformName,
          status: 'ACTIVE'
        }
      ])
      .select()
      .single();

    if (adminError) {
      return res.status(400).json({ error: adminError.message });
    }

    // Generate API Key and Secret
    const apiKey = `wingo_key_${crypto.randomBytes(16).toString('hex')}`;
    const apiSecret = `wingo_secret_${crypto.randomBytes(32).toString('hex')}`;
    const apiSecretHash = await bcryptjs.hash(apiSecret, 10);

    // Store API Key
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from('api_keys')
      .insert([
        {
          admin_id: adminData.id,
          name: 'Default',
          api_key: apiKey,
          api_secret_hash: apiSecretHash,
          status: 'ACTIVE',
          permissions: ['*'],
          created_by: username
        }
      ])
      .select()
      .single();

    if (keyError) {
      return res.status(400).json({ error: keyError.message });
    }

    // Generate JWT
    const token = jwt.sign(
      { adminId: adminData.id, username: adminData.username },
      process.env.JWT_SECRET,
      { expiresIn: '48h' }
    );

    res.status(201).json({
      adminId: adminData.id,
      username: adminData.username,
      platformName: adminData.platform_name,
      token,
      apiKey,
      apiSecret, // Return once; user should save
      message: 'Admin registered successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Fetch admin
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('username', username)
      .single();

    if (adminError || !adminData) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isPasswordValid = await bcryptjs.compare(password, adminData.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await supabaseAdmin
      .from('admins')
      .update({ last_login: new Date() })
      .eq('id', adminData.id);

    // Generate JWT
    const token = jwt.sign(
      { adminId: adminData.id, username: adminData.username },
      process.env.JWT_SECRET,
      { expiresIn: '48h' }
    );

    // Fetch API keys
    const { data: apiKeys } = await supabaseAdmin
      .from('api_keys')
      .select('api_key, name, status')
      .eq('admin_id', adminData.id);

    res.json({
      adminId: adminData.id,
      username: adminData.username,
      platformName: adminData.platform_name,
      token,
      apiKeys,
      lastLogin: adminData.last_login
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

#### Player Management
```javascript
// File: routes/admin/playerMgmtRoutes.js
import express from 'express';
import bcryptjs from 'bcryptjs';
import { supabaseAdmin } from '../../config/supabase.js';
import { adminAuthMiddleware } from '../../middleware/adminAuth.js';

const router = express.Router();

// Create Player
router.post('/create', adminAuthMiddleware, async (req, res) => {
  try {
    const { username, password, initialBalance = 1000 } = req.body;
    const { adminId } = req.admin;

    const passwordHash = await bcryptjs.hash(password, 10);

    // Create user
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          admin_id: adminId,
          username,
          password_hash: passwordHash,
          status: 'ACTIVE'
        }
      ])
      .select()
      .single();

    if (userError) {
      return res.status(400).json({ error: userError.message });
    }

    // Create wallet
    const { error: walletError } = await supabaseAdmin
      .from('wallets')
      .insert([
        {
          user_id: userData.id,
          admin_id: adminId,
          balance: initialBalance,
          locked: 0
        }
      ]);

    if (walletError) {
      return res.status(400).json({ error: walletError.message });
    }

    // Create initial ledger entry
    await supabaseAdmin
      .from('ledgers')
      .insert([
        {
          user_id: userData.id,
          admin_id: adminId,
          type: 'CREDIT',
          amount: initialBalance,
          balance_after: initialBalance,
          description: 'Account creation - Initial balance'
        }
      ]);

    res.status(201).json({
      userId: userData.id,
      username: userData.username,
      initialBalance,
      message: 'Player created successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Players
router.get('/list', adminAuthMiddleware, async (req, res) => {
  try {
    const { adminId } = req.admin;
    const { page = 0, limit = 20 } = req.query;

    const from = page * limit;
    const to = from + limit - 1;

    const { data: players, error, count } = await supabaseAdmin
      .from('users')
      .select('id, username, status, created_at, last_login', { count: 'exact' })
      .eq('admin_id', adminId)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      players,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Player Details
router.get('/:userId', adminAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { adminId } = req.admin;

    // Fetch user
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .eq('admin_id', adminId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Fetch wallet
    const { data: walletData } = await supabaseAdmin
      .from('wallets')
      .select('balance, locked')
      .eq('user_id', userId)
      .single();

    // Fetch stats
    const { data: stats } = await supabaseAdmin
      .from('bets')
      .select('status')
      .eq('user_id', userId);

    const totalBets = stats?.length || 0;
    const winBets = stats?.filter(b => b.status === 'WON').length || 0;
    const lostBets = stats?.filter(b => b.status === 'LOST').length || 0;

    res.json({
      userId: userData.id,
      username: userData.username,
      status: userData.status,
      wallet: walletData,
      statistics: {
        totalBets,
        betsWon: winBets,
        betsLost: lostBets,
        winRate: totalBets > 0 ? (winBets / totalBets * 100).toFixed(2) + '%' : '0%'
      },
      createdAt: userData.created_at,
      lastLogin: userData.last_login
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Player Balance (Admin Adjustment)
router.post('/:userId/adjust-balance', adminAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { adminId } = req.admin;
    const { amount, reason } = req.body;

    // Verify user belongs to admin
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .eq('admin_id', adminId)
      .single();

    if (!userData) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get current wallet
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    const newBalance = wallet.balance + amount;

    // Update wallet
    await supabaseAdmin
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    // Create ledger entry
    await supabaseAdmin
      .from('ledgers')
      .insert([
        {
          user_id: userId,
          admin_id: adminId,
          type: amount > 0 ? 'CREDIT' : 'DEBIT',
          amount: Math.abs(amount),
          balance_after: newBalance,
          description: `Admin adjustment: ${reason}`
        }
      ]);

    res.json({
      userId,
      newBalance,
      adjustment: amount,
      reason
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

#### Betting Service
```javascript
// File: services/betting.js
import { supabaseAdmin } from '../config/supabase.js';

export const placeBet = async (userId, adminId, roundId, bets) => {
  try {
    // Verify round exists and is active
    const { data: round, error: roundError } = await supabaseAdmin
      .from('rounds')
      .select('*')
      .eq('round_id', roundId)
      .eq('admin_id', adminId)
      .single();

    if (roundError || !round || round.status !== 'ACTIVE') {
      throw new Error('Invalid or inactive round');
    }

    // Get wallet
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('balance, locked')
      .eq('user_id', userId)
      .single();

    // Calculate total bet amount
    const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);

    // Verify sufficient balance
    if (wallet.balance - totalBetAmount < 0) {
      throw new Error('Insufficient balance');
    }

    // Insert bets
    const betInserts = bets.map(bet => ({
      admin_id: adminId,
      user_id: userId,
      round_id: roundId,
      bet_type: bet.type, // COLORBET, SIZEBET, NUMBERBET
      option_selected: bet.option,
      amount: bet.amount,
      fee_amount: bet.amount * 0.02, // 2% fee
      status: 'PENDING'
    }));

    const { data: createdBets, error: betError } = await supabaseAdmin
      .from('bets')
      .insert(betInserts)
      .select();

    if (betError) {
      throw new Error(betError.message);
    }

    // Update wallet (deduct amount + lock it)
    const newBalance = wallet.balance - totalBetAmount;
    const newLocked = wallet.locked + totalBetAmount;

    await supabaseAdmin
      .from('wallets')
      .update({
        balance: newBalance,
        locked: newLocked
      })
      .eq('user_id', userId);

    // Create ledger entries
    await supabaseAdmin
      .from('ledgers')
      .insert([
        {
          user_id: userId,
          admin_id: adminId,
          round_id: roundId,
          type: 'DEBIT',
          amount: totalBetAmount,
          balance_after: newBalance,
          description: `Bets placed on round ${roundId}`
        }
      ]);

    return {
      roundId,
      betIds: createdBets.map(b => b.id),
      totalWagered: totalBetAmount,
      newBalance
    };
  } catch (error) {
    throw error;
  }
};

export const settleBets = async (adminId, roundId, result) => {
  try {
    // Get all bets for round
    const { data: bets } = await supabaseAdmin
      .from('bets')
      .select('*')
      .eq('round_id', roundId)
      .eq('admin_id', adminId)
      .eq('status', 'PENDING');

    let totalPayouts = 0;

    for (const bet of bets || []) {
      let isWon = false;
      let multiplier = 1;

      // Check if bet won
      if (bet.bet_type === 'COLORBET' && bet.option_selected === result.color) {
        isWon = true;
        multiplier = 2.0; // 2x for red/green, 12x for violet
        if (result.color === 'VIOLET') multiplier = 12.0;
      } else if (bet.bet_type === 'SIZEBET' && bet.option_selected === result.size) {
        isWon = true;
        multiplier = 2.0;
      } else if (bet.bet_type === 'NUMBERBET' && bet.option_selected === result.number.toString()) {
        isWon = true;
        multiplier = 50.0;
      }

      const payoutAmount = isWon ? bet.amount * multiplier : 0;
      totalPayouts += payoutAmount;

      // Update bet status and payout
      await supabaseAdmin
        .from('bets')
        .update({
          status: isWon ? 'WON' : 'LOST',
          payout_amount: payoutAmount,
          multiplier: isWon ? multiplier : null,
          settled_at: new Date()
        })
        .eq('id', bet.id);

      // Update wallet if won
      if (isWon) {
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('balance, locked')
          .eq('user_id', bet.user_id)
          .single();

        const newBalance = wallet.balance + payoutAmount;
        const newLocked = wallet.locked - bet.amount;

        await supabaseAdmin
          .from('wallets')
          .update({
            balance: newBalance,
            locked: newLocked
          })
          .eq('user_id', bet.user_id);

        // Create ledger entry
        await supabaseAdmin
          .from('ledgers')
          .insert([
            {
              user_id: bet.user_id,
              admin_id: adminId,
              round_id: roundId,
              bet_id: bet.id,
              type: 'CREDIT',
              amount: payoutAmount,
              balance_after: newBalance,
              description: `Bet won - ${payoutAmount.toFixed(2)}`
            }
          ]);
      } else {
        // Just release locked amount for losses
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('balance, locked')
          .eq('user_id', bet.user_id)
          .single();

        const newLocked = wallet.locked - bet.amount;

        await supabaseAdmin
          .from('wallets')
          .update({ locked: newLocked })
          .eq('user_id', bet.user_id);
      }
    }

    // Update round as settled
    await supabaseAdmin
      .from('rounds')
      .update({
        status: 'SETTLED',
        total_payout: totalPayouts,
        settled_at: new Date()
      })
      .eq('round_id', roundId);

    return {
      roundId,
      settledBets: bets?.length || 0,
      totalPayouts
    };
  } catch (error) {
    throw error;
  }
};
```

---

## Frontend Integration

### React + Socket.io + Supabase

```javascript
// File: components/WingoGame.jsx
import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

const WingoGame = ({ playerToken, adminApiKey }) => {
  const [socket, setSocket] = useState(null);
  const [currentRound, setCurrentRound] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [bets, setBets] = useState([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [loading, setLoading] = useState(false);

  // Fetch wallet on mount
  useEffect(() => {
    fetchWallet();
  }, [playerToken]);

  // Connect to Socket.io
  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_API_URL, {
      auth: {
        token: playerToken,
        apiKey: adminApiKey
      }
    });

    newSocket.on('round-start', (round) => {
      setCurrentRound(round);
      setRoundResult(null);
      setTimeLeft(30);
      setBets([]);
    });

    newSocket.on('round-update', (data) => {
      setTimeLeft(data.timeLeft);
    });

    newSocket.on('round-result', (result) => {
      setRoundResult(result);
      fetchWallet(); // Refresh wallet after settlement
    });

    newSocket.on('bet-placed', (betData) => {
      setBets(prev => [...prev, betData]);
    });

    setSocket(newSocket);

    return () => newSocket.disconnect();
  }, [playerToken]);

  const fetchWallet = async () => {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance, locked')
        .single();

      if (!error && data) {
        setWallet(data);
      }
    } catch (error) {
      console.error('Error fetching wallet:', error);
    }
  };

  const placeBet = async (betData) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/v1/player/bet`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${playerToken}`,
            'X-API-Key': adminApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            roundId: currentRound.round_id,
            bets: [betData]
          })
        }
      );

      const result = await response.json();
      if (result.error) {
        alert('Bet placement failed: ' + result.error);
      }
    } catch (error) {
      console.error('Error placing bet:', error);
      alert('Failed to place bet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wingo-game">
      <h2>Wingo Game</h2>

      <div className="wallet-section">
        <h3>Wallet</h3>
        <p>Balance: {wallet?.balance?.toFixed(2)} ₹</p>
        <p>Locked: {wallet?.locked?.toFixed(2)} ₹</p>
      </div>

      {currentRound && (
        <div className="game-section">
          <h3>Round: {currentRound.round_id}</h3>
          <div className="countdown">Time Left: {timeLeft}s</div>

          {timeLeft > 5 && (
            <div className="betting-section">
              <button
                onClick={() => placeBet({
                  type: 'COLORBET',
                  option: 'RED',
                  amount: 100
                })}
                disabled={loading}
              >
                RED (2x)
              </button>
              <button
                onClick={() => placeBet({
                  type: 'COLORBET',
                  option: 'GREEN',
                  amount: 100
                })}
                disabled={loading}
              >
                GREEN (2x)
              </button>
              <button
                onClick={() => placeBet({
                  type: 'COLORBET',
                  option: 'VIOLET',
                  amount: 100
                })}
                disabled={loading}
              >
                VIOLET (12x)
              </button>
            </div>
          )}

          {roundResult && (
            <div className="result-section">
              <h4>Round Result</h4>
              <p>Color: {roundResult.color}</p>
              <p>Number: {roundResult.number}</p>
              <p>Size: {roundResult.size}</p>
            </div>
          )}
        </div>
      )}

      <div className="bets-section">
        <h3>My Bets</h3>
        {bets.map((bet, idx) => (
          <div key={idx} className="bet-item">
            <p>{bet.type}: {bet.option} - ₹{bet.amount}</p>
            <p>Status: {bet.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WingoGame;
```

---

## Python/Django Integration

```python
# File: views.py
import requests
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from supabase import create_client, Client

supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_KEY
)

@csrf_exempt
def admin_login(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')

        try:
            # Fetch admin from Supabase
            response = supabase.table('admins').select('*').eq('username', username).execute()

            if not response.data:
                return JsonResponse({'error': 'Admin not found'}, status=401)

            admin = response.data[0]

            # Verify password (using bcryptjs equivalent)
            # In production, use proper password verification

            # Generate JWT
            import jwt
            token = jwt.encode(
                {
                    'adminId': str(admin['id']),
                    'username': admin['username']
                },
                settings.JWT_SECRET,
                algorithm='HS256'
            )

            return JsonResponse({
                'adminId': str(admin['id']),
                'username': admin['username'],
                'token': token
            })

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def create_player(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        admin_token = request.headers.get('Authorization', '').split(' ')[1]

        try:
            # Verify admin token
            import jwt
            admin_data = jwt.decode(admin_token, settings.JWT_SECRET, algorithms=['HS256'])
            admin_id = admin_data['adminId']

            # Create player in Supabase
            username = data.get('username')
            password = data.get('password')
            initial_balance = data.get('initialBalance', 1000)

            # Hash password
            from django.contrib.auth.hashers import make_password
            password_hash = make_password(password)

            # Insert user
            user_response = supabase.table('users').insert({
                'admin_id': admin_id,
                'username': username,
                'password_hash': password_hash,
                'status': 'ACTIVE'
            }).execute()

            user = user_response.data[0]

            # Create wallet
            supabase.table('wallets').insert({
                'user_id': str(user['id']),
                'admin_id': admin_id,
                'balance': initial_balance,
                'locked': 0
            }).execute()

            return JsonResponse({
                'userId': str(user['id']),
                'username': user['username'],
                'initialBalance': initial_balance
            }, status=201)

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def get_player_stats(request):
    if request.method == 'GET':
        player_token = request.headers.get('Authorization', '').split(' ')[1]

        try:
            import jwt
            player_data = jwt.decode(player_token, settings.JWT_SECRET, algorithms=['HS256'])
            user_id = player_data['userId']

            # Fetch wallet
            wallet_response = supabase.table('wallets').select('*').eq('user_id', user_id).execute()
            wallet = wallet_response.data[0] if wallet_response.data else None

            # Fetch bets
            bets_response = supabase.table('bets').select('*').eq('user_id', user_id).execute()
            bets = bets_response.data or []

            # Calculate stats
            total_bets = len(bets)
            bets_won = sum(1 for b in bets if b['status'] == 'WON')
            bets_lost = sum(1 for b in bets if b['status'] == 'LOST')
            total_wagered = sum(b['amount'] for b in bets)

            return JsonResponse({
                'wallet': wallet,
                'statistics': {
                    'totalBets': total_bets,
                    'betsWon': bets_won,
                    'betsLost': bets_lost,
                    'totalWagered': total_wagered,
                    'winRate': f"{(bets_won / total_bets * 100):.2f}%" if total_bets > 0 else "0%"
                }
            })

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
```

---

## Webhook Integration

```javascript
// File: services/webhooks.js
import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';

export const sendWebhook = async (adminId, eventType, payload) => {
  try {
    // Fetch admin's webhook configuration
    const { data: webhooks } = await supabaseAdmin
      .from('webhooks')
      .select('*')
      .eq('admin_id', adminId)
      .eq('status', 'ACTIVE')
      .contains('events', [eventType]);

    if (!webhooks || webhooks.length === 0) {
      return;
    }

    for (const webhook of webhooks) {
      // Sign payload with webhook secret
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Event-Type': eventType
          },
          body: JSON.stringify({
            event: eventType,
            timestamp: new Date(),
            data: payload
          })
        });

        // Log successful delivery
        await supabaseAdmin
          .from('webhook_logs')
          .insert({
            webhook_id: webhook.id,
            event_type: eventType,
            status: 'DELIVERED',
            response: 'OK'
          });

      } catch (error) {
        // Log failed delivery
        await supabaseAdmin
          .from('webhook_logs')
          .insert({
            webhook_id: webhook.id,
            event_type: eventType,
            status: 'FAILED',
            response: error.message
          });
      }
    }
  } catch (error) {
    console.error('Webhook send error:', error);
  }
};

// Event triggers throughout the system
export const triggerWebhooks = async (adminId, eventType, data) => {
  switch (eventType) {
    case 'bet.placed':
      await sendWebhook(adminId, 'bet.placed', data);
      break;
    case 'bet.settled':
      await sendWebhook(adminId, 'bet.settled', data);
      break;
    case 'round.created':
      await sendWebhook(adminId, 'round.created', data);
      break;
    case 'player.created':
      await sendWebhook(adminId, 'player.created', data);
      break;
  }
};
```

---

## Real-time Subscriptions

```javascript
// File: services/realtimeSubscriptions.js
import { supabase } from '../config/supabase.js';

export const subscribeToRounds = (adminId, callback) => {
  const channel = supabase
    .channel(`rounds:${adminId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rounds',
        filter: `admin_id=eq.${adminId}`
      },
      (payload) => {
        callback({
          event: payload.eventType,
          data: payload.new || payload.old
        });
      }
    )
    .subscribe();

  return channel;
};

export const subscribeToBets = (adminId, roundId, callback) => {
  const channel = supabase
    .channel(`bets:${adminId}:${roundId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bets',
        filter: `admin_id=eq.${adminId}&round_id=eq.${roundId}`
      },
      (payload) => {
        callback({
          event: 'bet.placed',
          data: payload.new
        });
      }
    )
    .subscribe();

  return channel;
};

export const subscribeToWallet = (userId, callback) => {
  const channel = supabase
    .channel(`wallet:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'wallets',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        callback({
          balance: payload.new.balance,
          locked: payload.new.locked
        });
      }
    )
    .subscribe();

  return channel;
};
```

---

## TypeScript Examples

```typescript
// File: types/wingo.ts
export interface Admin {
  id: string;
  username: string;
  platform_name: string;
  status: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  admin_id: string;
  name: string;
  api_key: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  permissions: string[];
}

export interface User {
  id: string;
  admin_id: string;
  username: string;
  status: string;
  created_at: string;
  last_login?: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  admin_id: string;
  balance: number;
  locked: number;
}

export interface Bet {
  id: string;
  user_id: string;
  round_id: string;
  bet_type: 'COLORBET' | 'SIZEBET' | 'NUMBERBET';
  option_selected: string;
  amount: number;
  status: 'PENDING' | 'WON' | 'LOST';
  payout_amount: number;
  created_at: string;
}

export interface Round {
  id: string;
  admin_id: string;
  round_id: string;
  status: 'PENDING' | 'ACTIVE' | 'CLOSED' | 'SETTLED';
  result_color?: 'RED' | 'GREEN' | 'VIOLET';
  result_size?: 'SMALL' | 'BIG';
  result_number?: number;
  start_ts: string;
  end_ts: string;
}

// Service example in TypeScript
export class WingoService {
  constructor(private supabaseUrl: string, private apiKey: string) {}

  async createPlayer(adminId: string, username: string, password: string): Promise<User> {
    // Implementation
    return {} as User;
  }

  async placeBet(userId: string, roundId: string, bet: any): Promise<Bet> {
    // Implementation
    return {} as Bet;
  }

  async getWallet(userId: string): Promise<Wallet> {
    // Implementation
    return {} as Wallet;
  }
}
```

---

## cURL Examples

### Admin Login
```bash
curl -X POST http://localhost:3000/api/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin1",
    "password": "Password123!"
  }'
```

### Create Player
```bash
curl -X POST http://localhost:3000/api/v1/admin/players/create \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "X-API-Key: API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "player1",
    "password": "PlayerPass123!",
    "initialBalance": 5000
  }'
```

### Place Bet
```bash
curl -X POST http://localhost:3000/api/v1/player/bet \
  -H "Authorization: Bearer PLAYER_TOKEN" \
  -H "X-API-Key: API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "roundId": "20260115001",
    "bets": [{
      "type": "COLORBET",
      "option": "RED",
      "amount": 100
    }]
  }'
```

### Get Wallet
```bash
curl -X GET http://localhost:3000/api/v1/player/wallet \
  -H "Authorization: Bearer PLAYER_TOKEN" \
  -H "X-API-Key: API_KEY"
```

---

## Environment Variables for Integration

```bash
# Frontend
REACT_APP_SUPABASE_URL=https://[PROJECT].supabase.co
REACT_APP_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
REACT_APP_API_URL=http://localhost:3000

# Backend
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=your_super_secret_key
```
