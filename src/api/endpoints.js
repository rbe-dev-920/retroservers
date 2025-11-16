/**
 * API Endpoints Configuration
 * Centralizes all API endpoints used throughout the application
 */

// Base endpoint candidates for each API resource
export const ENDPOINTS = {
  siteUsers: [
    'api/site-users',
    'site-users'
  ],
  members: [
    'api/members',
    'members'
  ],
  siteConfig: [
    'api/site-config',
    'site-config'
  ],
  changelog: [
    'api/changelog',
    'changelog'
  ],
  retroNews: [
    'api/retro-news',
    'retro-news'
  ],
  notifications: [
    'api/notifications',
    'notifications'
  ]
};

// Helper functions to get paths and origins
export const getUsersPath = () => 'api/site-users';
export const getMembersPath = () => 'api/members';
export const getSiteConfigPath = () => 'api/site-config';
export const getChangelogPath = () => 'api/changelog';
export const getRetroNewsPath = () => 'api/retro-news';

export const getUsersOrigin = () => import.meta.env.VITE_API_URL || '';
export const getMembersOrigin = () => import.meta.env.VITE_API_URL || '';
export const getSiteConfigOrigin = () => import.meta.env.VITE_API_URL || '';
export const getChangelogOrigin = () => import.meta.env.VITE_API_URL || '';
export const getGlobalOrigin = () => import.meta.env.VITE_API_URL || '';

/**
 * Utility functions
 */

// Clean a path string
export const clean = (p) => String(p || '').trim().replace(/^\/+|\/+$/g, '');

// Get API prefix from environment or default
export const getApiPrefix = () => {
  const prefix = import.meta.env.VITE_API_PREFIX || '';
  return clean(prefix);
};

// Check if string is absolute URL
export const isAbsoluteUrl = (u) => /^https?:\/\//i.test(u || '');

// JSON response validation
export const ensureJsonResponse = (result) => {
  if (!result) result = {};
  const ct = (result.headers?.['content-type'] || '').toLowerCase();
  if (!ct.includes('application/json')) {
    throw new Error('Réponse non-JSON reçue du serveur');
  }
  return result;
};

// Build candidate URLs for fallback strategy
export const buildCandidates = (baseCandidates, overridePath, extraSuffix = '', overrideOrigin) => {
  const suffix = clean(extraSuffix);
  const API_PREFIX = getApiPrefix();
  const list = new Set();
  const isHttpOrigin = (o) => /^https?:\/\//i.test(o || '');
  const sameOrigin = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin.replace(/\/+$/, '')
    : '';
  // Avoid calling the Vite dev server (localhost:5173) which doesn't serve the API → 404
  const skipSameOrigin = !!sameOrigin && /localhost:5173$/i.test(sameOrigin);

  const pushEntries = (relPath) => {
    const parts = [clean(relPath)];
    if (suffix) parts.push(suffix);
    const rel = parts.filter(Boolean).join('/');
    if (!rel) return;

    // Only use relative URLs to avoid CORS issues
    // These will be processed by apiClient which handles JWT and CORS properly
    list.add(rel);
  };

  const pushPrefixedIfNeeded = (p) => {
    if (!API_PREFIX) return;
    const cleaned = clean(p);
    // Avoid double prefix (/api/api/..., /v1/v1/..., /api/v1/ already provided)
    if (cleaned.startsWith(`${API_PREFIX}/`)) return;
    pushEntries(`${API_PREFIX}/${cleaned}`);
  };

  if (overridePath) pushEntries(overridePath);
  // Prioritize prefixed variants first, then raw paths
  baseCandidates.forEach((p) => pushPrefixedIfNeeded(p));
  baseCandidates.forEach((p) => pushEntries(p));

  return Array.from(list);
};
