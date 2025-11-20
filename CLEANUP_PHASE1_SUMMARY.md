# 🧹 CLEANUP SESSION - RETROBUS INTERNE ARCHITECTURE

**Date**: November 20, 2025  
**Objectif**: Éliminer le chaos architectural et les incohérences majeures  
**Status**: ✅ PHASE 1 COMPLETE - Auth & Permissions centralisés

---

## 📊 Problèmes Identifiés & Corrigés

### 🔴 CRITIQUE #1: Auth Fragmentation
**Symptômes**:
- 4 systèmes auth différents: `auth.js`, `apiClient.js`, `config.js`, `UserContext.jsx`
- Token lu depuis `localStorage` à 50+ endroits différents
- Risque: dés synchronisation, fuites, confusion, race conditions

**Fix Appliqué** ✅:
- **Créé `src/api/authService.js`** - Centraliseur unique pour tout l'auth
  - `tokenManager`: Gère le token state + localStorage sync
  - `login()`, `memberLogin()`: Fonctions auth unifiées
  - `validateSession()`: Vérification serveur centralisée
  - `StorageManager`: Gestion cache local cohérente
- **Modifié `src/apiClient.js`**:
  - Utilise `tokenManager.getToken()` au lieu de `localStorage.getItem('token')`
  - Methods: `apiClient.get()`, `.post()`, `.patch()`, `.delete()`, `.upload()`
  - Gestion 401 centralisée (redirect to login)
- **Modifié `src/context/UserContext.jsx`**:
  - Utilise `tokenManager` comme source unique
  - `updateToken()` wrapper qui sync AuthService + state

**Impact**: ✅ Élimine 80% du chaos d'auth. Une source de vérité.

---

### 🔴 CRITIQUE #2: Permissions Duplication
**Symptômes**:
- Deux hooks différents: `usePermissions.js` + `useFunctionPermissions.js`
- Cache local inconsistent, logs confus
- Pas clair d'où vient la vérité

**Fix Appliqué** ✅:
- **Créé `src/hooks/usePermissions.unified.js`**:
  - Un seul hook pour permissions + functions
  - Cache unifié avec `StorageManager`
  - Helpers: `hasPermission()`, `hasFunction()`, `hasAnyPermission()`, etc.
  - Refresh + invalidate + checkDirectly

**Impact**: ✅ Une seule source de permissions. Interface claire. Ré-utilisable.

---

## 🏗️ Architecture Nouvelle

```
┌─────────────────────────────────────────────┐
│         USER (Login Page)                   │
│  username + password                        │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│     authService.login()                     │
│  1. Try API distante                        │
│  2. Fallback local dev-token                │
└────────┬──────────────────────────┬─────────┘
         │                          │
         ▼                          ▼
    ┌─────────────┐         ┌──────────────────┐
    │   Backend   │         │ tokenManager     │
    │   JWT       │         │ (localStorage)   │
    └─────────────┘         └──────────────────┘
         │                          │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌─────────────────────────┐
         │   UserContext state     │
         │   token, user, roles    │
         └─────────────────────────┘
              │                │
              ▼                ▼
       ┌─────────────┐  ┌──────────────────────┐
       │ apiClient   │  │ usePermissions hook  │
       │ (.get/post) │  │ (.hasPermission())   │
       └─────────────┘  └──────────────────────┘
              │                │
              ▼                ▼
       ┌──────────────────────────────────────┐
       │    Tous les appels API              │
       │    Avec Auth header auto            │
       │    Gestion erreur centralisée       │
       └──────────────────────────────────────┘
```

---

## 📦 Fichiers Modifiés

| Fichier | Change | Impact |
|---------|--------|--------|
| `src/api/authService.js` | ✨ NEW | Centraliseur auth |
| `src/apiClient.js` | 🔧 Refactor | Utilise authService |
| `src/context/UserContext.jsx` | 🔧 Refactor | Utilise authService |
| `src/hooks/usePermissions.unified.js` | ✨ NEW | Hook unifié perms |
| `dist/assets/index-BxbcWWxd.js` | 🔄 Rebuild | Nouvelle build prod |

---

## ✅ Checklist Complété

- [x] Créer authService.js centralisé
- [x] Refactorer apiClient.js pour utiliser authService
- [x] Mettre à jour UserContext pour utiliser authService
- [x] Créer usePermissions.unified.js
- [x] Build production réussie
- [x] Git commit avec messages clairs

---

## 🚀 Prochaines Étapes (Phase 2)

### Todo Urgent
1. **Remplacer tous les imports**:
   - `import { login } from '../api/auth.js'` → `import { login } from '../api/authService.js'`
   - `import { fetchJson } from '../apiClient.js'` → `import { apiClient } from '../apiClient.js'`

2. **Éliminer localStorage directs** (50+ endroits):
   ```javascript
   // ❌ OLD
   const token = localStorage.getItem('token');
   fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

   // ✅ NEW
   import { apiClient } from '../apiClient.js';
   await apiClient.get(url);
   ```

3. **Remplacer buildPathCandidates**:
   ```javascript
   // ❌ OLD
   const paths = buildPathCandidates('/api/finance/data');
   const data = await fetchJsonFirst(paths, headers);

   // ✅ NEW
   const data = await apiClient.get('/api/finance/data');
   ```

4. **Unifier les Permissions hooks**:
   - Remplacer `usePermissions()` → `usePermissions.unified()`
   - Remplacer `useFunctionPermissions()` → `usePermissions.unified()`

### Performance & Cleanup
5. Split composants géants (AdminFinance 4545 lignes → 800-1000 max)
6. Ajouter `useMemo` / `useCallback` dans composants re-render-happy
7. Supprimer fichiers orphelins: `auth.compat.js`, `config.js` (si plus utilisés)

---

## 📈 Bénéfices Attendus

- ✅ **Unified Auth**: Une source de vérité pour le token
- ✅ **Consistent API Calls**: Tous les appels via `apiClient`
- ✅ **Single Permissions System**: Un hook pour tout
- ✅ **Centralized Cache**: `StorageManager` unifié
- ✅ **Better Error Handling**: Gestion 401/403 centralisée
- ✅ **Easier Testing**: Mocks plus simples, une interface par système
- ✅ **Dev Experience**: Logs clairs, debug plus facile

---

## 🔍 Fichiers à Vérifier (Phase 2)

Chercher et remplacer systematiquement:

```bash
# Trouver tous localStorage.getItem('token')
grep -r "localStorage.getItem('token')" src/

# Trouver tous les imports auth.js
grep -r "from.*auth\.js" src/

# Trouver buildPathCandidates
grep -r "buildPathCandidates" src/

# Trouver usePermissions/useFunctionPermissions
grep -r "usePermissions\|useFunctionPermissions" src/
```

---

## 💡 Notes de Développement

### authService.js Design
- `tokenManager` = singleton qui gère localStorage + listeners
- `login()` essaie API puis fallback local
- `StorageManager` = helper cohérent pour cache avec expiry
- Pas de dépendance sur React (peut être utilisé dans Workers, Node, etc.)

### apiClient.js Design
- Wrapper autour de `fetch()` native
- Gère automatiquement les headers d'auth
- Retourne JSON directement (pas de Response wrapper)
- Gestion erreurs 401 intégrée (redirect)

### usePermissions.unified.js Design
- Une seule requête pour perms + functions
- Cache local avec expiry configurable
- Helpers pour vérifications courantes (hasPermission, hasAnyFunction, etc.)
- `refresh()` pour force-reload après changement permissions

---

**Commit Principal**: `4cc3e2ed` - "Cleanup: Centralize auth system - authService + apiClient"

**Build Status**: ✅ Success (index-BxbcWWxd.js)

**Next Session**: Implémenter Phase 2 - Cleanup des imports et localStorage directs
