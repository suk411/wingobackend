# SUPABASE MIGRATION GUIDE - From MongoDB to PostgreSQL

## Overview

This guide helps you migrate the Wingo backend from MongoDB (Mongoose) to PostgreSQL (Supabase).

## Key Differences

| Aspect | MongoDB | PostgreSQL/Supabase |
|--------|---------|----------------------|
| Connection | mongoose.connect() | @supabase/supabase-js |
| Queries | Schema methods | SQL queries via JS client |
| Data types | BSON | Native SQL types |
| Transactions | Session.startTransaction() | BEGIN/COMMIT |
| Indexing | Automatic | Manual (included in schema.sql) |
| Scaling | Horizontal sharding | Vertical + read replicas |

---

## Migration Checklist

### Phase 1: Preparation (1-2 hours)
- [ ] Backup existing MongoDB data
- [ ] Create Supabase project
- [ ] Review schema.sql file
- [ ] Set up environment variables

### Phase 2: Schema Setup (30-45 minutes)
- [ ] Import SQL schema to Supabase
- [ ] Verify all tables created
- [ ] Enable Realtime for required tables
- [ ] Set up Row Level Security (optional)

### Phase 3: Code Migration (4-6 hours)
- [ ] Update config files (Supabase client)
- [ ] Migrate model files (User, Admin, Bet, etc.)
- [ ] Update service files (betting, settlement, etc.)
- [ ] Update middleware (authentication)
- [ ] Update routes (API endpoints)

### Phase 4: Testing (2-3 hours)
- [ ] Unit tests for each model
- [ ] Integration tests for APIs
- [ ] Real-time subscription tests
- [ ] Load testing

### Phase 5: Deployment (30 minutes - 2 hours)
- [ ] Create production Supabase project
- [ ] Set up CI/CD pipeline
- [ ] Deploy to staging
- [ ] Final smoke tests
- [ ] Switch production traffic

---

## Step-by-Step Migration

### Step 1: Backup MongoDB Data

```bash
# Export collections
mongodump --db wingobackend --out ./mongodb-backup

# Or export as JSON
mongoexport --db wingobackend --collection users --out users.json
mongoexport --db wingobackend --collection bets --out bets.json
mongoexport --db wingobackend --collection rounds --out rounds.json
mongoexport --db wingobackend --collection wallets --out wallets.json
mongoexport --db wingobackend --collection admins --out admins.json
mongoexport --db wingobackend --collection ledgers --out ledgers.json
```

### Step 2: Create Supabase Project

1. Visit https://supabase.com
2. Create new project
3. Copy connection details to `.env`:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

### Step 3: Import Schema

```bash
# Option A: Via Supabase Dashboard
# Go to SQL Editor → New Query → Paste schema.sql → Run

# Option B: Via CLI
supabase db push < src/config/schema.sql

# Option C: Via psql
psql "postgres://postgres:password@host:5432/postgres" < src/config/schema.sql
```

### Step 4: Data Migration Script

```javascript
// scripts/migrate-mongodb-to-supabase.js
import mongoose from 'mongoose';
import { supabaseAdmin } from '../src/config/supabase.js';
import bcryptjs from 'bcryptjs';

const mongoUri = process.env.MONGODB_URI;
const supabaseUrl = process.env.SUPABASE_URL;

async function migrateAdmins() {
  console.log('Migrating admins...');

  try {
    await mongoose.connect(mongoUri);
    const AdminModel = mongoose.model('Admin');
    const admins = await AdminModel.find().lean();

    for (const admin of admins) {
      await supabaseAdmin
        .from('admins')
        .insert([
          {
            username: admin.username,
            password_hash: admin.password, // Already hashed in MongoDB
            platform_name: admin.platformName,
            status: 'ACTIVE',
            created_at: admin.createdAt,
            updated_at: admin.updatedAt
          }
        ]);
    }

    console.log(`✓ Migrated ${admins.length} admins`);
  } catch (error) {
    console.error('Error migrating admins:', error);
  }
}

async function migrateUsers(adminMap) {
  console.log('Migrating users...');

  try {
    const UserModel = mongoose.model('User');
    const users = await UserModel.find().lean();

    const userMap = new Map(); // Old ID → New ID mapping

    for (const user of users) {
      const supabaseAdminId = adminMap.get(user.adminId.toString());

      const { data } = await supabaseAdmin
        .from('users')
        .insert([
          {
            admin_id: supabaseAdminId,
            username: user.username,
            password_hash: user.password, // Already hashed
            status: user.status || 'ACTIVE',
            created_at: user.createdAt,
            updated_at: user.updatedAt,
            last_login: user.lastLogin
          }
        ])
        .select()
        .single();

      userMap.set(user._id.toString(), data.id);
    }

    console.log(`✓ Migrated ${users.length} users`);
    return userMap;
  } catch (error) {
    console.error('Error migrating users:', error);
  }
}

async function migrateWallets(userMap, adminMap) {
  console.log('Migrating wallets...');

  try {
    const WalletModel = mongoose.model('Wallet');
    const wallets = await WalletModel.find().lean();

    for (const wallet of wallets) {
      const supabaseUserId = userMap.get(wallet.userId.toString());
      const supabaseAdminId = adminMap.get(wallet.adminId.toString());

      if (!supabaseUserId || !supabaseAdminId) continue;

      await supabaseAdmin
        .from('wallets')
        .insert([
          {
            user_id: supabaseUserId,
            admin_id: supabaseAdminId,
            balance: wallet.balance,
            locked: wallet.locked,
            created_at: wallet.createdAt,
            updated_at: wallet.updatedAt
          }
        ]);
    }

    console.log(`✓ Migrated ${wallets.length} wallets`);
  } catch (error) {
    console.error('Error migrating wallets:', error);
  }
}

async function migrateBets(userMap, adminMap) {
  console.log('Migrating bets...');

  try {
    const BetModel = mongoose.model('Bet');
    const bets = await BetModel.find().lean();

    for (const bet of bets) {
      const supabaseUserId = userMap.get(bet.userId.toString());
      const supabaseAdminId = adminMap.get(bet.adminId.toString());

      if (!supabaseUserId || !supabaseAdminId) continue;

      await supabaseAdmin
        .from('bets')
        .insert([
          {
            admin_id: supabaseAdminId,
            user_id: supabaseUserId,
            round_id: bet.roundId,
            bet_type: bet.type,
            option_selected: bet.option,
            amount: bet.amount,
            payout_amount: bet.payoutAmount || 0,
            status: bet.status,
            multiplier: bet.multiplier,
            fee_amount: bet.feeAmount || 0,
            created_at: bet.createdAt,
            updated_at: bet.updatedAt,
            settled_at: bet.settledAt
          }
        ]);
    }

    console.log(`✓ Migrated ${bets.length} bets`);
  } catch (error) {
    console.error('Error migrating bets:', error);
  }
}

async function migrateRounds(adminMap) {
  console.log('Migrating rounds...');

  try {
    const RoundModel = mongoose.model('Round');
    const rounds = await RoundModel.find().lean();

    for (const round of rounds) {
      const supabaseAdminId = adminMap.get(round.adminId.toString());

      if (!supabaseAdminId) continue;

      await supabaseAdmin
        .from('rounds')
        .insert([
          {
            admin_id: supabaseAdminId,
            round_id: round.roundId,
            status: round.status,
            result_number: round.result?.number,
            result_color: round.result?.color,
            result_size: round.result?.size,
            total_bets: round.totalBets || 0,
            total_payout: round.totalPayout || 0,
            start_ts: round.startTs,
            end_ts: round.endTs,
            created_at: round.createdAt,
            updated_at: round.updatedAt,
            settled_at: round.settledAt
          }
        ]);
    }

    console.log(`✓ Migrated ${rounds.length} rounds`);
  } catch (error) {
    console.error('Error migrating rounds:', error);
  }
}

async function migrateLedgers(userMap, adminMap) {
  console.log('Migrating ledgers...');

  try {
    const LedgerModel = mongoose.model('Ledger');
    const ledgers = await LedgerModel.find().lean();

    for (const ledger of ledgers) {
      const supabaseUserId = userMap.get(ledger.userId.toString());
      const supabaseAdminId = adminMap.get(ledger.adminId.toString());

      if (!supabaseUserId || !supabaseAdminId) continue;

      await supabaseAdmin
        .from('ledgers')
        .insert([
          {
            user_id: supabaseUserId,
            admin_id: supabaseAdminId,
            round_id: ledger.roundId,
            bet_id: ledger.betId,
            type: ledger.type,
            amount: ledger.amount,
            balance_after: ledger.balanceAfter,
            description: ledger.description,
            meta: ledger.meta || {},
            created_at: ledger.createdAt
          }
        ]);
    }

    console.log(`✓ Migrated ${ledgers.length} ledgers`);
  } catch (error) {
    console.error('Error migrating ledgers:', error);
  }
}

async function runMigration() {
  console.log('🚀 Starting MongoDB → Supabase migration...\n');

  const adminMap = new Map(); // Old ID → New ID mapping

  try {
    // Migrate in order
    await migrateAdmins();
    const userMap = await migrateUsers(adminMap);
    await migrateWallets(userMap, adminMap);
    await migrateBets(userMap, adminMap);
    await migrateRounds(adminMap);
    await migrateLedgers(userMap, adminMap);

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration
runMigration();
```

### Step 5: Update Package.json

Remove MongoDB dependencies and add Supabase:

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
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

```bash
npm uninstall mongoose
npm install @supabase/supabase-js
```

### Step 6: Update Middleware

```javascript
// File: src/middleware/adminAuth.js (Updated for Supabase)
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';

export const adminAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch admin from Supabase
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('id', decoded.adminId)
      .single();

    if (error || !admin) {
      return res.status(401).json({ error: 'Admin not found' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const playerAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from Supabase
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Step 7: Update Routes

```javascript
// File: src/routes/playerRoutes.js (Example)
import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { playerAuthMiddleware } from '../middleware/adminAuth.js';

const router = express.Router();

router.get('/wallet', playerAuthMiddleware, async (req, res) => {
  try {
    const { data: wallet, error } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

## Verification Checklist

After migration, verify:

- [ ] All admin accounts accessible
- [ ] All player accounts accessible
- [ ] All wallets have correct balances
- [ ] All bets accessible with correct data
- [ ] All rounds accessible with correct results
- [ ] Ledger history intact
- [ ] API keys working
- [ ] JWT authentication working
- [ ] Real-time subscriptions working
- [ ] Round creation/settlement working

---

## Rollback Plan

If issues occur:

1. Stop application
2. Restore MongoDB from backup: `mongorestore --dir ./mongodb-backup`
3. Restart application
4. Investigate and fix issues
5. Retry migration

---

## Performance Tips

### Indexes
- Already included in schema.sql
- Verify in Supabase: Go to Table Editor → Indexes tab

### Connection Pooling
```javascript
// Use connection pooling for better performance
const supabaseClient = createClient(url, key);
// Supabase manages pooling automatically
```

### Query Optimization
```javascript
// Bad: Fetch all data
const { data } = await supabase.from('bets').select('*');

// Good: Filter and paginate
const { data } = await supabase
  .from('bets')
  .select('*')
  .eq('admin_id', adminId)
  .range(0, 99);
```

---

## Support & Troubleshooting

### Common Issues

**Issue**: Column not found
**Solution**: Verify schema.sql was imported correctly

**Issue**: Foreign key constraint violation
**Solution**: Ensure parent records exist before inserting child records

**Issue**: JWT decode error
**Solution**: Verify JWT_SECRET matches between signing and verification

---

## Next Steps

1. ✅ Complete migration
2. ✅ Run verification tests
3. ✅ Load testing
4. → Deploy to staging
5. → User acceptance testing
6. → Deploy to production
