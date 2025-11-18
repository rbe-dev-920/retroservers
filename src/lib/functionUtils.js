/**
 * Utilitaires pour les permissions individuelles par fonction
 * À utiliser dans les composants pour vérifier l'accès aux fonctions
 */

import {
  FUNCTIONS,
  FUNCTION_GROUPS,
  FUNCTION_DESCRIPTIONS,
  ROLE_FUNCTION_DEFAULTS
} from '../core/FunctionPermissions.js';

/**
 * Vérifier si l'utilisateur a accès à une fonction
 */
export function canAccessFunction(userFunctions, functionId) {
  if (!Array.isArray(userFunctions)) return false;
  return userFunctions.includes(functionId);
}

/**
 * Vérifier si l'utilisateur a accès à au moins une fonction
 */
export function hasAnyFunction(userFunctions, functionIds) {
  if (!Array.isArray(userFunctions) || !Array.isArray(functionIds)) return false;
  return functionIds.some(fid => userFunctions.includes(fid));
}

/**
 * Vérifier si l'utilisateur a accès à toutes les fonctions
 */
export function hasAllFunctions(userFunctions, functionIds) {
  if (!Array.isArray(userFunctions) || !Array.isArray(functionIds)) return false;
  return functionIds.every(fid => userFunctions.includes(fid));
}

/**
 * Obtenir les fonctions d'un module spécifique
 */
export function getModuleFunctions(moduleName) {
  return Object.values(FUNCTIONS).filter(fid => {
    const desc = FUNCTION_DESCRIPTIONS[fid];
    return desc && desc.module === moduleName;
  });
}

/**
 * Obtenir tous les modules disponibles
 */
export function getAllModules() {
  const modules = new Set();
  Object.values(FUNCTION_DESCRIPTIONS).forEach(desc => {
    if (desc.module) modules.add(desc.module);
  });
  return Array.from(modules);
}

/**
 * Obtenir toutes les fonctions d'un module pour un utilisateur
 */
export function getUserModuleAccess(userFunctions, moduleName) {
  const moduleFunctions = getModuleFunctions(moduleName);
  return moduleFunctions.filter(fid => userFunctions.includes(fid));
}

/**
 * Vérifier si l'utilisateur a au moins une fonction dans un module
 */
export function hasModuleAccess(userFunctions, moduleName) {
  return getUserModuleAccess(userFunctions, moduleName).length > 0;
}

/**
 * Obtenir la description d'une fonction
 */
export function getFunctionDescription(functionId) {
  return FUNCTION_DESCRIPTIONS[functionId] || null;
}

/**
 * Grouper les fonctions d'un utilisateur par module
 */
export function groupFunctionsByModule(userFunctions) {
  const grouped = {};
  
  // Itérer sur tous les IDs de fonctions (ou userFunctions si c'est un array)
  const functionsToProcess = Array.isArray(userFunctions) ? userFunctions : Object.values(FUNCTIONS);
  
  functionsToProcess.forEach(fid => {
    const desc = FUNCTION_DESCRIPTIONS[fid];
    if (desc && desc.module) {
      if (!grouped[desc.module]) {
        grouped[desc.module] = [];
      }
      grouped[desc.module].push(fid);
    }
  });
  
  return grouped;
}

/**
 * Helper pour les contrôles d'accès courants dans les composants
 */
export const ACCESS = {
  // Véhicules
  VEHICLES_VIEW: FUNCTIONS.VEHICLES_VIEW,
  VEHICLES_CREATE: FUNCTIONS.VEHICLES_CREATE,
  VEHICLES_EDIT: FUNCTIONS.VEHICLES_EDIT,
  VEHICLES_DELETE: FUNCTIONS.VEHICLES_DELETE,
  VEHICLES_MAINTENANCE: FUNCTIONS.VEHICLES_MAINTENANCE,

  // Planning
  PLANNING_VIEW: FUNCTIONS.PLANNING_VIEW,
  PLANNING_CREATE: FUNCTIONS.PLANNING_CREATE,
  PLANNING_EDIT: FUNCTIONS.PLANNING_EDIT,

  // Tickets
  TICKETS_VIEW: FUNCTIONS.TICKETS_VIEW,
  TICKETS_CREATE: FUNCTIONS.TICKETS_CREATE,
  TICKETS_RESPOND: FUNCTIONS.TICKETS_RESPOND,

  // Demandes
  RETRODEMANDES_VIEW: FUNCTIONS.RETRODEMANDES_VIEW,
  RETRODEMANDES_CREATE: FUNCTIONS.RETRODEMANDES_CREATE,
  RETRODEMANDES_APPROVE: FUNCTIONS.RETRODEMANDES_APPROVE,

  // RetroMail
  RETROMAIL_VIEW: FUNCTIONS.RETROMAIL_VIEW,
  RETROMAIL_SEND: FUNCTIONS.RETROMAIL_SEND,

  // Finances
  FINANCE_VIEW: FUNCTIONS.FINANCE_VIEW,
  FINANCE_CREATE: FUNCTIONS.FINANCE_CREATE,
  FINANCE_EDIT: FUNCTIONS.FINANCE_EDIT,

  // Événements
  EVENTS_VIEW: FUNCTIONS.EVENTS_VIEW,
  EVENTS_CREATE: FUNCTIONS.EVENTS_CREATE,

  // Membres
  MEMBERS_VIEW: FUNCTIONS.MEMBERS_VIEW,
  MEMBERS_EDIT: FUNCTIONS.MEMBERS_EDIT,

  // Permissions
  PERMISSIONS_EDIT: FUNCTIONS.PERMISSIONS_EDIT,
  PERMISSIONS_ADMIN: FUNCTIONS.PERMISSIONS_ADMIN
};

export default {
  canAccessFunction,
  hasAnyFunction,
  hasAllFunctions,
  getModuleFunctions,
  getAllModules,
  getUserModuleAccess,
  hasModuleAccess,
  getFunctionDescription,
  groupFunctionsByModule,
  ACCESS,
  FUNCTIONS,
  FUNCTION_GROUPS,
  FUNCTION_DESCRIPTIONS,
  ROLE_FUNCTION_DEFAULTS
};
