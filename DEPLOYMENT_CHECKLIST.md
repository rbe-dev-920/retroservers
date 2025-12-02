# ✅ DEPLOYMENT CHECKLIST: Prisma-Only Data Persistence

> **Status**: Ready for Production  
> **Ticket**: Data reappearing on restart (Ghost Data Bug)  
> **Solution**: Remove backup auto-loading, use Prisma as single source of truth

---

## 🚨 CRITICAL: DO THIS FIRST

- [ ] **BACKUP YOUR POSTGRES DATABASE**
  ```bash
  pg_dump $DATABASE_URL > retrobus_backup_$(date +%Y%m%d_%H%M%S).sql
  ```
  Keep this file safe in case we need to rollback.

- [ ] **Archive backups folder**
  ```bash
  cd interne/api
  node cleanup-stale-backups.mjs
  ```
  This removes all stale backup files that could interfere.

---

## 🔧 CODE CHANGES

- [ ] **Review `src/server.js` changes**
  - [ ] Line ~14-25: New toggle defaults
    ```javascript
    const LOAD_BACKUP_AT_BOOT = process.env.LOAD_BACKUP_AT_BOOT === 'true';       // ✅ false by default
    const ENABLE_MEMORY_FALLBACK = process.env.ENABLE_MEMORY_FALLBACK === 'true';  // ✅ false by default
    const ENABLE_RUNTIME_STATE_SAVE = process.env.ENABLE_RUNTIME_STATE_SAVE === 'true'; // ✅ false by default
    ```

- [ ] **Check startup logs (line ~52)**
  - [ ] Should display toggle status
  - [ ] Should show "LOAD_BACKUP_AT_BOOT: DISABLED (Recommended)"

---

## 📋 CONFIGURATION

- [ ] **Verify `.env` file** (in `interne/api/.env` or env vars in deployment)
  ```env
  LOAD_BACKUP_AT_BOOT=false
  ENABLE_MEMORY_FALLBACK=false
  ENABLE_RUNTIME_STATE_SAVE=false
  DATABASE_URL=postgresql://...
  NODE_ENV=production
  ```

- [ ] **Verify `.env.local` or `.env.production`** (if using one)
  - Same settings as above

- [ ] **Verify `.env.example`** (for documentation)
  - Add comments about these new toggles
  - Mark them as required for production

- [ ] **Do NOT set `LOAD_BACKUP_AT_BOOT=true` in production**
  - This will re-enable the bug!

---

## 🧪 LOCAL TESTING

### Pre-Test: Ensure clean state
```bash
cd interne/api
npm install
node cleanup-stale-backups.mjs
```

### Test 1: Verify Prisma is available
```bash
# Start server
npm run dev

# In another terminal, check logs for:
# ✅ Prisma initialisé - DATABASE_URL valide
# ✅ LOAD_BACKUP_AT_BOOT: DISABLED (Recommended)
# ❌ Should NOT see "Chargement du backup:"
```

- [ ] **PASS**: Server shows Prisma is enabled and backups are disabled
- [ ] **FAIL**: Server shows different messages → check config

### Test 2: Create data and restart
```bash
# Terminal 1: Server is running from Test 1

# Terminal 2: Create a test member
curl -X POST http://localhost:3001/api/members \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testmember@example.com",
    "firstName": "Test",
    "lastName": "Member",
    "status": "active"
  }'

# Expected response: Member created with an ID
# Note the member ID for next step
```

- [ ] **PASS**: Member is created
- [ ] **FAIL**: Check server logs for error → fix DB connection

### Test 3: Verify data persists after restart
```bash
# Terminal 2: Stop the server (Ctrl+C in Terminal 1)

# Restart server
npm run dev

# Terminal 2: Check if member still exists
curl http://localhost:3001/api/members \
  -H "Authorization: Bearer test"

# Expected: Member list includes the test member created above
```

- [ ] **PASS**: Test member appears in list after restart → ✅ DATA PERSISTS
- [ ] **FAIL**: Test member is gone → ❌ Still loading from backup
  - Check if `backups/restore-info.json` still exists
  - Run cleanup script again
  - Verify `LOAD_BACKUP_AT_BOOT=false`

### Test 4: Verify memory fallback is disabled
```bash
# This test requires PostgreSQL to be stopped
# OR you can simulate Prisma failure by breaking DATABASE_URL

# Terminal 1: Stop server, set invalid DATABASE_URL
DATABASE_URL="invalid" npm run dev

# Terminal 2: Make request
curl http://localhost:3001/api/events \
  -H "Authorization: Bearer test"

# Expected: 503 error "Prisma indisponible et mémoire désactivée"
# NOT: Old cached data from backup
```

- [ ] **PASS**: Get 503 error → ✅ Memory fallback is disabled
- [ ] **FAIL**: Get old data → ❌ Memory fallback is still enabled
  - Verify `ENABLE_MEMORY_FALLBACK=false`

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Commit changes
```bash
cd interne/api
git add .
git commit -m "🔒 Migrate to Prisma-only data persistence

- Disable automatic backup loading (LOAD_BACKUP_AT_BOOT=false)
- Disable memory state persistence (ENABLE_RUNTIME_STATE_SAVE=false)
- Disable memory fallback (ENABLE_MEMORY_FALLBACK=false)
- Add cleanup-stale-backups.mjs script
- Add MIGRATION_GUIDE.md and DEPLOYMENT_CHECKLIST.md

Fixes: #BUG Data reappearing on restart from old backups
Fixes: #BUG Inconsistency between Prisma DB and in-memory state"

git push origin main
```

- [ ] **PASS**: Changes pushed to `main`
- [ ] **FAIL**: Merge conflicts → resolve and retry

### Step 2: Verify remote changes
```bash
# Check GitHub/GitLab that commit is visible
# Wait for CI/CD to pass (if you have any tests)
```

- [ ] **PASS**: Commit visible on main branch
- [ ] **FAIL**: Commit not visible → check push output

### Step 3: Deploy to Railway (or your hosting)
```bash
# Option A: Manual deploy
# Go to Railway console → select app → click "Deploy"

# Option B: Auto-deploy (if enabled)
# Should trigger automatically on push to main
```

- [ ] **PASS**: Deployment started (check Railway logs)
- [ ] **FAIL**: Deployment failed → check error logs

### Step 4: Monitor deployment
```bash
# In Railway console, watch the deployment logs
# Wait for "npm run dev" to complete
# Watch for the startup message:
# ✅ Prisma initialisé
# ✅ LOAD_BACKUP_AT_BOOT: DISABLED (Recommended)
```

- [ ] **PASS**: Deployment completed, server running
- [ ] **FAIL**: Deployment error → rollback or debug

---

## ✔️ POST-DEPLOYMENT VALIDATION

### Validation 1: Health check
```bash
curl https://your-api-domain/health
# or
curl http://localhost:3001/health

# Expected: {"ok":true,"time":"2025-12-02T...","version":"..."}
```

- [ ] **PASS**: API responds
- [ ] **FAIL**: API not responding → check deployment

### Validation 2: Check startup flags
```bash
# Via logs (production) or terminal (local)
# Should see:
# ✅ Prisma initialisé - DATABASE_URL valide
# ✅ LOAD_BACKUP_AT_BOOT: DISABLED (Recommended)
# ✅ ENABLE_MEMORY_FALLBACK: DISABLED (Recommended)
# ✅ ENABLE_RUNTIME_STATE_SAVE: DISABLED (Recommended)
```

- [ ] **PASS**: All flags showing correct state
- [ ] **FAIL**: Flags showing enabled → check env vars

### Validation 3: Functional test (create and persist)
```bash
# Use the web UI or API to:
# 1. Create a new member
# 2. Create a new event
# 3. Restart the API server
# 4. Verify both still exist

# Via API:
# POST /api/members (create)
# GET /api/members (list)
# RESTART SERVER
# GET /api/members (should still include new member)
```

- [ ] **PASS**: Data persists across restart
- [ ] **FAIL**: Data lost → check Prisma connectivity

### Validation 4: Data deletion persists
```bash
# Create a test member
curl -X POST http://your-api/api/members \
  -H "Authorization: Bearer token" \
  -d '{"email":"deleteme@test.com","firstName":"Delete","lastName":"Me"}'

# Note the ID, then delete it
curl -X DELETE http://your-api/api/members \
  -H "Authorization: Bearer token" \
  -d '{"id":"<member-id>"}'

# Restart API server

# Verify member is still deleted (not restored from backup)
curl http://your-api/api/members \
  -H "Authorization: Bearer token"
# Should NOT see the deleted member
```

- [ ] **PASS**: Deleted member stays deleted after restart
- [ ] **FAIL**: Deleted member reappears → data is still loading from backup

---

## 📊 SUCCESS CRITERIA

All of the following must be true:

- [ ] Startup logs show `LOAD_BACKUP_AT_BOOT: DISABLED`
- [ ] No "Chargement du backup" message in logs
- [ ] Created data persists across server restart
- [ ] Deleted data stays deleted after restart
- [ ] API responds with 503 when Prisma unavailable (NOT with cached data)
- [ ] No `backups/restore-info.json` file exists
- [ ] No `backups/index.json` file exists
- [ ] Backups archived in `backups/_archived/`

---

## 🔄 ROLLBACK PLAN

If something goes wrong:

### Quick Rollback (revert commit)
```bash
cd interne/api
git revert <commit-sha>
# or
git reset --hard HEAD~1
git push -f origin main
```

- [ ] Changes reverted
- [ ] Server redeployed with old config
- [ ] Monitor logs for old behavior

### Restore from backup
```bash
# If you have a PostgreSQL backup
psql $DATABASE_URL < retrobus_backup_20251202_120000.sql

# OR restore from archived backups
mv backups/_archived/* backups/
# and re-enable
LOAD_BACKUP_AT_BOOT=true npm run dev
```

- [ ] Database restored
- [ ] Old data available (temporarily)
- [ ] Investigate root cause of issue

---

## 📞 SUPPORT

**If the API crashes after deployment:**

1. **Check logs** (Railway console or server terminal)
   - Look for `DATABASE_URL` connection errors
   - Look for Prisma migration errors

2. **Verify environment variables**
   - Ensure `DATABASE_URL` is set correctly
   - Ensure PostgreSQL is running and accessible

3. **Rollback**
   - Revert the commit
   - Deploy previous working version
   - Investigate

4. **Contact**: [Your team contact]

---

## ✅ Sign-Off

- [ ] **QA**: Validated all tests pass
- [ ] **DevOps**: Deployment successful
- [ ] **Product Owner**: Feature approved for production
- [ ] **Date Deployed**: ___________________
- [ ] **Notes**: 

```
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________
```

---

## 📝 DOCUMENTATION

Links to related docs:
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Detailed migration steps
- [CLEANUP_WORKFLOW.md](./CLEANUP_WORKFLOW.md) - Data cleanup procedures
- [src/server.js](./src/server.js) - Code with inline comments about persistence

Contact: Your team / repository maintainers
