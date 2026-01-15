# WINGO BACKEND - SUPABASE SETUP & CONFIGURATION GUIDE

## Table of Contents
1. [Supabase Project Creation](#supabase-project-creation)
2. [Database Schema Setup](#database-schema-setup)
3. [Environment Configuration](#environment-configuration)
4. [Real-time Subscriptions](#real-time-subscriptions)
5. [Authentication Setup](#authentication-setup)
6. [Security & RLS](#security--row-level-security)
7. [Migrations & Backups](#migrations--backups)
8. [Troubleshooting](#troubleshooting)

---

## Supabase Project Creation

### Step 1: Create Supabase Account
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub, Google, or email
4. Create organization (if first time)

### Step 2: Create New Project
1. Click "New project"
2. **Project name**: `wingo-backend`
3. **Database password**: Use a strong password (save securely)
4. **Region**: Choose closest to your user base
5. Click "Create new project" (takes 1-2 minutes)

### Step 3: Get API Keys
Once project is created:
1. Go to Settings → API in the left sidebar
2. Copy these keys:
   - **Project URL** → `SUPABASE_URL`
   - **anon key** → `SUPABASE_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`
3. Save these for `.env` file

---

## Database Schema Setup

### Option A: Import via SQL Editor (Recommended)

1. Go to **SQL Editor** in left sidebar
2. Click **"New query"**
3. Copy entire contents of `src/config/schema.sql`
4. Paste into SQL editor
5. Click **"Run"** button
6. Wait for schema creation (should complete in 5-10 seconds)

**Expected output:**
```
Query executed successfully in 8.234 seconds
Created 9 tables, 35 indexes, 2 views, 7 triggers, 1 function
```

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push schema
supabase db push < src/config/schema.sql

# Verify tables created
supabase db tables list
```

### Option C: Using psql (Direct PostgreSQL)

```bash
# Get database connection string from Supabase
# Settings → Database → Connection string → psql format

psql "postgres://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" < src/config/schema.sql
```

### Verify Schema Created

1. Go to **Table Editor** in Supabase dashboard
2. Verify these tables exist:
   - `admins` - Platform operators
   - `users` - Players
   - `wallets` - Player balances
   - `api_keys` - Admin authentication
   - `bets` - Individual bets
   - `rounds` - Game rounds
   - `ledgers` - Transaction history
   - `game_settings` - Game configuration
   - `audit_logs` - System audit trail

---

## Environment Configuration

### Create `.env` File

Create `/.env` in project root:

```bash
# Supabase Configuration
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server Configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_EXPIRES_IN=24h
JWT_ADMIN_EXPIRES_IN=48h

# API Configuration
API_KEY_LENGTH=32
API_SECRET_LENGTH=64

# Game Configuration
ROUND_DURATION_SECONDS=30
BETTING_FREEZE_SECONDS=5
INITIAL_PLAYER_BALANCE=1000
MIN_BET=10
MAX_BET=100000
HOUSE_EDGE_PERCENT=2

# Rate Limiting
RATE_LIMIT_REQUESTS=10000
RATE_LIMIT_WINDOW_MS=3600000

# Socket.io Configuration
SOCKET_CORS_ORIGINS=http://localhost:3001,https://yourdomain.com

# Logging
LOG_LEVEL=info
```

### Update package.json

Ensure these dependencies are present:

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.38.0",
    "express": "^5.0.0",
    "socket.io": "^4.7.0",
    "jsonwebtoken": "^9.1.2",
    "bcryptjs": "^2.4.3",
    "node-cron": "^3.0.2",
    "dotenv": "^16.3.1"
  }
}
```

Install dependencies:
```bash
npm install
```

---

## Real-time Subscriptions

### Enable Realtime in Supabase

1. Go to **Realtime** in left sidebar
2. Click **"Manage realtime settings"**
3. In **Production** section, enable tables you want to subscribe to:
   - ✓ `bets`
   - ✓ `rounds`
   - ✓ `wallets`
   - ✓ `ledgers`

### Realtime Subscriptions in Node.js

Example: Subscribe to new rounds

```javascript
import { supabase } from './config/supabase.js';

// Subscribe to new rounds for specific admin
const subscription = supabase
  .channel('rounds-channel')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'rounds',
      filter: `admin_id=eq.${adminId}`
    },
    (payload) => {
      console.log('New round created:', payload.new);
      // Broadcast to Socket.io clients
      io.emit('round-start', payload.new);
    }
  )
  .subscribe();

// Unsubscribe when done
subscription.unsubscribe();
```

### Socket.io Integration with Realtime

```javascript
import io from 'socket.io';
import { supabase } from './config/supabase.js';

const socketServer = io(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGINS?.split(','),
    credentials: true
  }
});

// Subscribe to round changes via Realtime
socketServer.on('connection', (socket) => {
  const { adminId } = socket.handshake.auth;

  const roundsChannel = supabase
    .channel(`rounds-${adminId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rounds',
        filter: `admin_id=eq.${adminId}`
      },
      (payload) => {
        socket.emit('round-update', payload);
      }
    )
    .subscribe();

  socket.on('disconnect', () => {
    roundsChannel.unsubscribe();
  });
});
```

---

## Authentication Setup

### Admin JWT Generation

```javascript
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from './config/supabase.js';
import bcryptjs from 'bcryptjs';

export const adminLogin = async (username, password) => {
  // Fetch admin from Supabase
  const { data, error } = await supabaseAdmin
    .from('admins')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !data) {
    throw new Error('Admin not found');
  }

  // Verify password
  const isPasswordValid = await bcryptjs.compare(password, data.password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid password');
  }

  // Generate JWT
  const token = jwt.sign(
    { adminId: data.id, username: data.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ADMIN_EXPIRES_IN }
  );

  return {
    adminId: data.id,
    token,
    platformName: data.platform_name
  };
};
```

### API Key Authentication (HMAC-SHA256)

```javascript
import crypto from 'crypto';
import { supabaseAdmin } from './config/supabase.js';

export const validateApiKey = async (apiKey, signature, payload) => {
  // Fetch API key from Supabase
  const { data: keyData, error } = await supabaseAdmin
    .from('api_keys')
    .select('api_secret_hash, admin_id, status')
    .eq('api_key', apiKey)
    .single();

  if (error || !keyData || keyData.status !== 'ACTIVE') {
    throw new Error('Invalid API key');
  }

  // Verify HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', keyData.api_secret_hash)
    .update(JSON.stringify(payload))
    .digest('hex');

  if (signature !== expectedSignature) {
    throw new Error('Invalid request signature');
  }

  // Update last_used timestamp
  await supabaseAdmin
    .from('api_keys')
    .update({ last_used: new Date() })
    .eq('api_key', apiKey);

  return {
    adminId: keyData.admin_id,
    apiKey: apiKey
  };
};
```

### Player JWT Generation

```javascript
export const playerLogin = async (adminId, username, password) => {
  // Fetch user from Supabase (specific to admin)
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('admin_id', adminId)
    .eq('username', username)
    .single();

  if (error || !data) {
    throw new Error('User not found');
  }

  // Verify password
  const isPasswordValid = await bcryptjs.compare(password, data.password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid password');
  }

  // Generate JWT (tied to admin's API key)
  const token = jwt.sign(
    { userId: data.id, adminId: data.admin_id, username: data.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return {
    userId: data.id,
    token,
    adminId: adminId
  };
};
```

---

## Security & Row Level Security

### Enable RLS (Optional but Recommended)

RLS (Row Level Security) ensures users can only access their own data:

```sql
-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledgers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid()::text = id::text);

CREATE POLICY "Users can view own bets"
  ON bets FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view own wallet"
  ON wallets FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- Policy: Admins can view their own data
CREATE POLICY "Admins can view own resources"
  ON users FOR SELECT
  USING (auth.uid()::text = admin_id::text);
```

### API Key Management Best Practices

1. **Never store secrets in code** - Always use environment variables
2. **Rotate API keys regularly** - Generate new keys every 90 days
3. **Use separate keys per environment** - Development, staging, production
4. **Set IP whitelist** - Restrict keys to specific IP ranges
5. **Monitor last_used** - Track when keys were last used
6. **Implement key expiration** - Auto-expire keys after period of inactivity

---

## Migrations & Backups

### Using Supabase Migrations

```bash
# Create a new migration
supabase migration new add_new_table

# Edit the migration file created
nano supabase/migrations/[timestamp]_add_new_table.sql

# Apply migration
supabase db push

# Check migration status
supabase migration list
```

### Manual Backups

**Via Supabase Dashboard:**
1. Go to **Database** → **Backups**
2. Click **"Request backup"**
3. Download backup when ready
4. Store securely

**Via CLI:**
```bash
# Download latest backup
supabase db backup list
supabase db backup download [BACKUP_ID]
```

### Restore from Backup

```bash
# Restore database from backup file
supabase db restore < backup.sql
```

---

## Troubleshooting

### Connection Issues

**Problem:** `"SUPABASE_URL or SUPABASE_KEY not found"`

**Solution:**
- Verify `.env` file exists in project root
- Check API keys are correct (copy from Supabase dashboard)
- Ensure no typos in variable names

```bash
# Check env file
cat .env | grep SUPABASE
```

---

### Table Not Found Error

**Problem:** `relation "users" does not exist`

**Solution:**
1. Verify schema was imported correctly
2. Check in Supabase Table Editor that tables exist
3. Re-import schema if needed

```bash
# Verify tables
psql "your_connection_string" -c "\dt"
```

---

### RLS Policy Blocking Queries

**Problem:** `new row violates row-level security policy`

**Solution:**
- RLS policies might be blocking legitimate queries
- Temporarily disable RLS to test (use service_role key in code)
- Adjust RLS policies to match your auth scheme

```javascript
// Use service role key to bypass RLS
const { data, error } = await supabaseAdmin
  .from('users')
  .select('*');
```

---

### Realtime Not Working

**Problem:** Changes not appearing in real-time

**Solution:**
1. Verify Realtime is enabled for table (go to Realtime settings)
2. Check subscription is listening to correct table/filter
3. Ensure schema matches exactly (public.table_name)

```javascript
// Check if subscription is active
console.log(subscription.status); // Should print "SUBSCRIBED"
```

---

### Performance Issues

**Problem:** Slow queries on large tables

**Solution:**
1. Add indexes (included in schema.sql)
2. Use pagination for large result sets
3. Filter by admin_id when querying user data

```javascript
// Good: Filtered query with pagination
const { data, error, count } = await supabase
  .from('bets')
  .select('*', { count: 'exact' })
  .eq('admin_id', adminId)
  .eq('status', 'WON')
  .range(0, 99);

// Bad: Unfiltered query
const { data } = await supabase.from('bets').select('*');
```

---

### Authentication Issues

**Problem:** JWT token invalid or expired

**Solution:**
1. Check token expiration: `JWT_EXPIRES_IN` in `.env`
2. Verify JWT_SECRET is set correctly
3. Ensure token is sent in Authorization header: `Bearer <token>`

```bash
# Decode JWT to check expiration
node -e "console.log(require('jsonwebtoken').decode('YOUR_TOKEN_HERE'))"
```

---

### API Rate Limiting

**Problem:** 429 Too Many Requests error

**Solution:**
1. Implement client-side rate limiting
2. Use rate limit headers from response
3. Implement exponential backoff for retries

```javascript
// Check rate limit headers
const { headers } = response;
console.log('Rate limit:', headers['x-ratelimit-limit']);
console.log('Rate limit remaining:', headers['x-ratelimit-remaining']);
```

---

## Quick Reference Commands

```bash
# Test Supabase connection
npm run test:db

# Create new admin
curl -X POST http://localhost:3000/api/v1/admin/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "admin1", "password": "SecurePass123!"}'

# Generate API key for admin
curl -X POST http://localhost:3000/api/v1/admin/api-keys \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Production"}'

# Check database size
psql "your_connection_string" -c "SELECT pg_size_pretty(pg_database_size('postgres'))"

# View current connections
psql "your_connection_string" -c "SELECT count(*) FROM pg_stat_activity"
```

---

## Next Steps

1. ✅ Create Supabase project
2. ✅ Import schema
3. ✅ Configure environment variables
4. ✅ Test connection
5. → **Implement model files** (User, Admin, Bet, Wallet, etc.)
6. → **Create API endpoints** (routes)
7. → **Setup real-time subscriptions**
8. → **Deploy to production**

For more info, visit [Supabase Documentation](https://supabase.com/docs)
