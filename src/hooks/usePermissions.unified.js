/**
 * usePermissions.js - HOOK UNIFIÉ pour les permissions
 * ✅ SOURCE UNIQUE: API backend
 * ✅ CACHE LOCAL: localStorage avec expiry
 * ✅ Combine usePermissions + useFunctionPermissions en UN SEUL
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../apiClient.js';
import { StorageManager } from '../api/authService.js';

/**
 * Hook unifié pour charger les permissions d'un utilisateur
 * Permissions = rôles + permissions individuelles + fonction-spécifique
 */
export function usePermissions(userId) {
  const [permissions, setPermissions] = useState([]);
  const [functionPermissions, setFunctionPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Clés cache
  const permCacheKey = StorageManager.makeKey('perms', userId);
  const funcCacheKey = StorageManager.makeKey('func_perms', userId);

  // Load permissions from API
  const loadPermissions = useCallback(async () => {
    if (!userId) {
      setPermissions([]);
      setFunctionPermissions([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Vérifier cache d'abord
      const cachedPerms = StorageManager.getIfFresh(permCacheKey);
      const cachedFuncs = StorageManager.getIfFresh(funcCacheKey);

      if (cachedPerms && cachedFuncs) {
        console.log(`✅ [usePermissions] Cache hit for ${userId}`);
        setPermissions(cachedPerms);
        setFunctionPermissions(cachedFuncs);
        setLastUpdated(new Date());
        return;
      }

      // Fetch from API en parallèle
      console.log(`📡 [usePermissions] Fetching from API for ${userId}`);
      
      const [permsData, funcsData] = await Promise.all([
        apiClient.get(`/api/permissions/user/${userId}`).catch(() => ({ permissions: [] })),
        apiClient.get(`/api/functions/user/${userId}`).catch(() => ({ functions: [] }))
      ]);

      const perms = permsData?.permissions || [];
      const funcs = funcsData?.functions || [];

      setPermissions(perms);
      setFunctionPermissions(funcs);
      setLastUpdated(new Date());

      // Mettre en cache
      StorageManager.set(permCacheKey, perms);
      StorageManager.set(funcCacheKey, funcs);

      console.log(`✅ [usePermissions] Loaded ${perms.length} perms, ${funcs.length} functions for ${userId}`);
    } catch (err) {
      console.error(`❌ [usePermissions] Load error:`, err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, permCacheKey, funcCacheKey]);

  // Charge les permissions au mount ou quand userId change
  useEffect(() => {
    loadPermissions();
  }, [userId, loadPermissions]);

  // Vérificateurs
  const hasPermission = useCallback((permissionId) => {
    return permissions.includes(permissionId);
  }, [permissions]);

  const hasAnyPermission = useCallback((permissionIds) => {
    return permissionIds.some(pid => permissions.includes(pid));
  }, [permissions]);

  const hasAllPermissions = useCallback((permissionIds) => {
    return permissionIds.every(pid => permissions.includes(pid));
  }, [permissions]);

  const hasFunction = useCallback((functionId) => {
    return functionPermissions.includes(functionId);
  }, [functionPermissions]);

  const hasAnyFunction = useCallback((functionIds) => {
    return functionIds.some(fid => functionPermissions.includes(fid));
  }, [functionPermissions]);

  const hasAllFunctions = useCallback((functionIds) => {
    return functionIds.every(fid => functionPermissions.includes(fid));
  }, [functionPermissions]);

  // Cache invalidation
  const invalidateCache = useCallback(() => {
    StorageManager.remove(permCacheKey);
    StorageManager.remove(funcCacheKey);
    setPermissions([]);
    setFunctionPermissions([]);
    setLastUpdated(null);
  }, [permCacheKey, funcCacheKey]);

  // Refresh from API (force)
  const refresh = useCallback(async () => {
    invalidateCache();
    await loadPermissions();
  }, [invalidateCache, loadPermissions]);

  // Check directly via API (no cache)
  const checkDirectly = useCallback(async (type, id) => {
    try {
      const response = await apiClient.post('/api/permissions/check', {
        userId,
        [type]: id
      });
      return response.allowed === true;
    } catch (err) {
      console.warn(`❌ Direct check failed:`, err.message);
      return false;
    }
  }, [userId]);

  // Memoize retour pour éviter re-renders inutiles
  const result = useMemo(() => ({
    permissions,
    functionPermissions,
    loading,
    error,
    lastUpdated,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasFunction,
    hasAnyFunction,
    hasAllFunctions,
    invalidateCache,
    refresh,
    checkDirectly
  }), [
    permissions,
    functionPermissions,
    loading,
    error,
    lastUpdated,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasFunction,
    hasAnyFunction,
    hasAllFunctions,
    invalidateCache,
    refresh,
    checkDirectly
  ]);

  return result;
}

/**
 * Hook simple pour vérifier une permission spécifique
 */
export function useHasPermission(userId, permissionId) {
  const { hasPermission, loading } = usePermissions(userId);
  return useMemo(
    () => ({ has: hasPermission(permissionId), loading }),
    [permissionId, hasPermission, loading]
  );
}

/**
 * Hook simple pour vérifier une fonction spécifique
 */
export function useHasFunction(userId, functionId) {
  const { hasFunction, loading } = usePermissions(userId);
  return useMemo(
    () => ({ has: hasFunction(functionId), loading }),
    [functionId, hasFunction, loading]
  );
}

export default usePermissions;
