# 🔄 MIGRATION GUIDE: From Hybrid Backup System to Prisma-Only

## The Problem

The server was stuck in a "data loop":
1. **Old backups reload at startup** → `loadBackupAtStartup()` loads `backups/data.json`
2. **In-memory state gets modified** → Users add/delete members, events via the UI
3. **Changes saved to disk** → `persistStateToDisk()` writes `backups/runtime-state.json`
4. **BUT** → `runtime-state.json` is NEVER reloaded on restart
5. **Result** → **Every restart brings back the old backup data**

### Data Sources (Conflicting)

| Layer | Status | Problem |
|-------|--------|---------|
| **Prisma PostgreSQL** | ✅ Updated | Correct data |
| **state (in-memory)** | ⚠️ Stale | From old backup |
| **backups/data.json** | ❌ Ancient | Reloaded every start |
| **backups/runtime-state.json** | ⚠️ Recent | Never read back |

---

## Solution: Single Source of Truth (Prisma)

### Step 1: Update Configuration Defaults

**File: `src/server.js` (DONE)**

```javascript
// BEFORE (dangerous defaults):
const LOAD_BACKUP_AT_BOOT = process.env.LOAD_BACKUP_AT_BOOT !== 'false';      // true by default
const ENABLE_MEMORY_FALLBACK = process.env.ENABLE_MEMORY_FALLBACK === 'true';  // false by default
const ENABLE_RUNTIME_STATE_SAVE = process.env.ENABLE_RUNTIME_STATE_SAVE !== 'false'; // true by default

// AFTER (safe defaults):
const LOAD_BACKUP_AT_BOOT = process.env.LOAD_BACKUP_AT_BOOT === 'true';       // false by default ✅
const ENABLE_MEMORY_FALLBACK = process.env.ENABLE_MEMORY_FALLBACK === 'true';  // false by default ✅
const ENABLE_RUNTIME_STATE_SAVE = process.env.ENABLE_RUNTIME_STATE_SAVE === 'true'; // false by default ✅
```

**Effect**: Server no longer auto-loads backups unless explicitly enabled.

---

### Step 2: Clean Up Stale Files

**Command: `cleanup-stale-backups.mjs` (DONE)**

```bash
cd interne/api
node cleanup-stale-backups.mjs
```

**What it does**:
- ✅ Removes `backups/restore-info.json` (prevents forced reload)
- ✅ Removes `backups/index.json` (backup catalog)
- ✅ Removes `backups/runtime-state.json` (stale in-memory dump)
- 📦 Archives all `backup_XXXX/` folders to `backups/_archived/`
- 📦 Archives all `.zip` backup files to `backups/_archived/`

**Result**: `/backups` directory is clean, no old data to reload.

---

### Step 3: Configure .env for Production

**File: `.env` or `.env.local`**

```env
# ✅ Data Persistence (Prisma-Only Mode)
LOAD_BACKUP_AT_BOOT=false
ENABLE_MEMORY_FALLBACK=false
ENABLE_RUNTIME_STATE_SAVE=false

# Database
DATABASE_URL="postgresql://user:pass@host:5432/retrobus"
NODE_ENV=production

# Optional: Keep in .env.example for reference
# LOAD_BACKUP_AT_BOOT - Load old backups at startup (development only)
# ENABLE_MEMORY_FALLBACK - Serve data from memory if Prisma fails (development only)
# ENABLE_RUNTIME_STATE_SAVE - Save memory state to disk (development only)
```

---

### Step 4: Test Locally

#### Test 1: Verify Prisma is being used

```bash
npm run dev
```

**Expected logs**:
```
✅ Prisma initialisé - DATABASE_URL valide
⏭️  LOAD_BACKUP_AT_BOOT=false - aucun backup chargé au démarrage
⚠️  LOAD_BACKUP_AT_BOOT: DISABLED (Recommended)
⚠️  ENABLE_MEMORY_FALLBACK: DISABLED (Recommended)
⚠️  ENABLE_RUNTIME_STATE_SAVE: DISABLED (Recommended)
```

#### Test 2: Add data via API

```bash
# Create a member
curl -X POST http://localhost:3001/api/members \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","firstName":"Test","lastName":"User"}'

# Expected: New member is created in Prisma
```

#### Test 3: Restart and verify persistence

```bash
# Stop server (Ctrl+C)
# Restart server (npm run dev)
# Check if member still exists
curl http://localhost:3001/api/members \
  -H "Authorization: Bearer test"

# Expected: Member should still be there (from Prisma, not backup)
```

#### Test 4: Verify memory is NOT the fallback

```bash
# (With PostgreSQL still running)
# Stop Postgres
# Make request:
curl http://localhost:3001/api/vehicles

# Expected: 503 Service Unavailable (because memory fallback is disabled)
# NOT: Old cached data
```

---

## Configuration Matrix

| Scenario | LOAD_BACKUP_AT_BOOT | ENABLE_MEMORY_FALLBACK | ENABLE_RUNTIME_STATE_SAVE | Use Case |
|----------|-------|-------|-------|----------|
| **Production (Safe)** | ❌ false | ❌ false | ❌ false | Live server, Prisma required |
| **Development (Flexible)** | ❌ false | ✅ true | ✅ true | Local dev, DB optional |
| **Migration** | ❌ false | ❌ false | ❌ false | Migrate from backup to Prisma |
| **Backup Recovery** | ✅ true | ✅ true | ✅ true | Emergency restore from backup |

---

## Endpoint Behavior After Migration

### Scenario A: Prisma Running ✅

```
GET /api/events
  → Prisma.event.findMany()
  → Returns fresh data from DB
  ✅ OK
```

### Scenario B: Prisma Down, Memory Fallback Disabled ❌

```
GET /api/events
  → Prisma.event.findMany() → FAILS
  → Check ENABLE_MEMORY_FALLBACK
  → false → Don't use stale memory
  → Return 503 Service Unavailable
  ✅ Better than stale data!
```

### Scenario C: Data Modified (Before)

```
POST /api/events { title: "New Event" }
  → Create in Prisma
  → Sync to memory state
  → debouncedSave() → runtime-state.json
  → RESTART
  → Load old backup instead of runtime-state.json
  ❌ NEW EVENT LOST!
```

### Scenario D: Data Modified (After Migration)

```
POST /api/events { title: "New Event" }
  → Create in Prisma
  → Persist in DB
  → Memory sync disabled
  → RESTART
  → No backups loaded
  → Data fetched fresh from Prisma
  ✅ NEW EVENT PRESERVED!
```

---

## Rollback Plan (If Needed)

If something goes wrong and you need the old behavior:

```bash
# 1. Restore archived backups
mv backups/_archived/* backups/

# 2. Restore index.json from git or backup
git checkout backups/index.json

# 3. Re-enable flags
LOAD_BACKUP_AT_BOOT=true \
ENABLE_MEMORY_FALLBACK=true \
ENABLE_RUNTIME_STATE_SAVE=true \
npm run dev
```

---

## Migration Checklist

- [ ] **Backup current Prisma database** (if you have critical data)
  ```bash
  pg_dump $DATABASE_URL > backup_before_migration.sql
  ```

- [ ] **Update `src/server.js`** with new toggle defaults
  - [ ] LOAD_BACKUP_AT_BOOT defaults to false
  - [ ] ENABLE_RUNTIME_STATE_SAVE defaults to false

- [ ] **Run cleanup script**
  ```bash
  node cleanup-stale-backups.mjs
  ```

- [ ] **Verify `.env` or `.env.local`**
  ```env
  LOAD_BACKUP_AT_BOOT=false
  ENABLE_MEMORY_FALLBACK=false
  ENABLE_RUNTIME_STATE_SAVE=false
  ```

- [ ] **Test locally (see Test section above)**
  - [ ] Server starts without loading backup
  - [ ] Create member via API
  - [ ] Restart server
  - [ ] Member persists

- [ ] **Commit changes**
  ```bash
  git add src/server.js cleanup-stale-backups.mjs
  git commit -m "🔒 Migrate to Prisma-only data persistence

  - Default LOAD_BACKUP_AT_BOOT=false (no stale backups)
  - Default ENABLE_RUNTIME_STATE_SAVE=false (no memory dumps)
  - Default ENABLE_MEMORY_FALLBACK=false (Prisma required)
  - Add cleanup-stale-backups.mjs script
  - Ensures data persistence goes through PostgreSQL only
  
  Fixes: Data reappearing on restart from old backups"
  ```

- [ ] **Deploy to production**
  ```bash
  git push origin main
  # Railway/other CI/CD picks it up
  ```

- [ ] **Monitor logs** after deployment
  ```bash
  # Check logs for:
  # ✅ "Prisma initialisé - DATABASE_URL valide"
  # ✅ "LOAD_BACKUP_AT_BOOT: DISABLED (Recommended)"
  # ❌ No "Chargement du backup: ..."
  ```

- [ ] **Verify data integrity**
  - [ ] Add member via UI → persists after restart
  - [ ] Delete event → stays deleted after restart
  - [ ] Modify vehicle → changes persist

---

## FAQ

### Q: What if Prisma is not available?
**A**: With fallback disabled, you'll get `503 Service Unavailable`. This is correct—force fixing Prisma/DB instead of silently serving stale data.

### Q: Can I keep backups for export/import?
**A**: Yes! Keep `backup-utils.mjs` and other export tools. Just don't auto-load them on startup.

### Q: What about the `state` object in memory?
**A**: It's still there for temporary caching/sync during request processing. But it's not persisted to disk anymore, and it's not reloaded from backups.

### Q: Why not keep runtime-state.json?
**A**: Because it creates confusion:
- Runtime state is newer than backups
- But backups are loaded instead
- Migrations fail because runtime state is ignored
- Better to have ONE source (Prisma) than multiple conflicting ones

### Q: How do I recover if I deleted important data?
**A**: 
1. Check `backups/_archived/` for recent backups
2. Extract the backup and restore via script
3. Or recover from PostgreSQL backups (if you had `pg_dump`)
4. Or reconstruct from your external records

---

## Architecture Before vs After

### BEFORE (Broken)

```
┌─────────────────────────────────────────────────────┐
│ API Request (e.g., GET /api/events)                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Try Prisma                                      │
│     ├─ Success → Return data                        │
│     └─ Fail → ⚠️  Check memory fallback              │
│                                                     │
│  2. Memory Fallback (if enabled)                    │
│     └─ Return state.events (from old backup!)       │
│                                                     │
│  ❌ PROBLEM: state was loaded from backup at        │
│     startup, not from actual runtime state!         │
│                                                     │
└─────────────────────────────────────────────────────┘

┌─ Startup ──────────────────────────────────────────┐
│                                                     │
│  1. loadBackupAtStartup()                           │
│     └─ Load backups/data.json → fill state          │
│                                                     │
│  2. Server runs, requests modify state              │
│                                                     │
│  3. debouncedSave()                                 │
│     └─ Save state → backups/runtime-state.json      │
│                                                     │
│  ❌ PROBLEM: If restart, we reload                  │
│     backups/data.json, NOT runtime-state.json!      │
│                                                     │
│  Result: Changes lost, old data reappears           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### AFTER (Fixed)

```
┌─────────────────────────────────────────────────────┐
│ API Request (e.g., GET /api/events)                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Try Prisma (ALWAYS)                             │
│     ├─ Success → Return fresh data ✅               │
│     └─ Fail → 503 Service Unavailable ✅            │
│                                                     │
│  ✅ NO memory fallback, NO stale data               │
│                                                     │
└─────────────────────────────────────────────────────┘

┌─ Startup ──────────────────────────────────────────┐
│                                                     │
│  1. Skip loadBackupAtStartup()                      │
│     └─ No backup loading ✅                         │
│                                                     │
│  2. Server runs, requests update Prisma             │
│                                                     │
│  3. NO debouncedSave() to disk                      │
│     └─ State changes don't get serialized ✅        │
│                                                     │
│  ✅ CLEAN: Restart just reads from Prisma           │
│     All changes were already in DB                  │
│                                                     │
│  Result: Data always fresh, changes persist         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Next Steps

1. ✅ Run `cleanup-stale-backups.mjs`
2. ✅ Verify `.env` settings
3. ✅ Restart server and test
4. ✅ Commit and deploy
5. 📊 Monitor for a few days
6. 📚 Update team documentation

**Result**: Data consistency, no phantom data, clear ownership (Prisma = source of truth).
