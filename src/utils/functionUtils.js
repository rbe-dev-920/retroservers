/**
 * Réexporte les fonctions et constantes depuis functionUtils
 * Point d'accès unique pour les composants
 */

export {
  canAccessFunction,
  hasAnyFunction,
  hasAllFunctions,
  getModuleFunctions,
  getAllModules,
  getUserModuleAccess,
  hasModuleAccess,
  getFunctionDescription,
  groupFunctionsByModule,
  FUNCTIONS,
  FUNCTION_GROUPS,
  FUNCTION_DESCRIPTIONS,
  ROLE_FUNCTION_DEFAULTS
} from '../lib/functionUtils';
