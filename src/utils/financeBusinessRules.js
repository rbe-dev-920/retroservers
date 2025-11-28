/**
 * Règles métier Finance - RETROBUS ESSONNE
 * Toutes les validations et règles applicables au module Finance
 */

// ============= VALIDATIONS TRANSACTIONS =============

export const validateTransaction = (transaction) => {
  const errors = [];

  // Champs obligatoires
  if (!transaction.type) errors.push("Type de transaction requis (CREDIT ou DEBIT)");
  if (!transaction.amount || transaction.amount <= 0) errors.push("Montant doit être > 0");
  if (!transaction.description || transaction.description.trim() === "") errors.push("Description requise");
  if (!transaction.date) errors.push("Date requise");

  // Validations par type
  if (transaction.type === 'CREDIT' && transaction.category === undefined) {
    errors.push("Catégorie requise pour credit");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// ============= VALIDATIONS DOCUMENTS (DEVIS/FACTURES) =============

export const validateDocument = (doc) => {
  const errors = [];

  if (!doc.type) errors.push("Type de document requis (QUOTE ou INVOICE)");
  if (!doc.number || doc.number.trim() === "") errors.push("Numéro de document requis");
  if (!doc.amount || doc.amount <= 0) errors.push("Montant doit être > 0");
  if (!doc.date) errors.push("Date requise");

  return {
    isValid: errors.length === 0,
    errors
  };
};

// ============= VALIDATIONS OPÉRATIONS PROGRAMMÉES =============

export const validateScheduledOperation = (op) => {
  const errors = [];

  if (!op.type) errors.push("Type d'opération requis");
  if (!op.description || op.description.trim() === "") errors.push("Description requise");
  if (!op.amount || op.amount <= 0) errors.push("Montant doit être > 0");
  if (!op.frequency) errors.push("Fréquence requise");
  if (!op.nextDate) errors.push("Date de prochaine exécution requise");

  // Validations par fréquence
  const validFrequencies = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'ONCE'];
  if (!validFrequencies.includes(op.frequency)) {
    errors.push("Frequence invalide");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// ============= CATÉGORIES PRÉDÉFINIES =============

export const TRANSACTION_CATEGORIES = {
  'ADHESION': 'Adhésion',
  'DONATION': 'Donation',
  'TRANSPORT': 'Transport',
  'MAINTENANCE': 'Maintenance',
  'FOURNITURES': 'Fournitures',
  'COTISATION': 'Cotisation',
  'FRAIS_EVENEMENT': 'Frais événement',
  'ASSURANCE': 'Assurance',
  'AUTRE': 'Autre'
};

export const getCategoryLabel = (category) => {
  return TRANSACTION_CATEGORIES[category] || category;
};

// ============= TYPES DE TRANSACTIONS =============

export const TRANSACTION_TYPES = {
  'CREDIT': { label: 'Crédit (Entrée)', color: 'green' },
  'DEBIT': { label: 'Débit (Sortie)', color: 'red' }
};

// ============= STATUTS DOCUMENTS =============

export const DOCUMENT_STATUS = {
  'DRAFT': { label: 'Brouillon', color: 'gray' },
  'SENT': { label: 'Envoyé', color: 'blue' },
  'ACCEPTED': { label: 'Accepté', color: 'green' },
  'REJECTED': { label: 'Rejeté', color: 'red' },
  'INVOICED': { label: 'Facturé', color: 'purple' }
};

// ============= FRÉQUENCES PROGRAMMATION =============

export const FREQUENCIES = {
  'MONTHLY': 'Mensuel',
  'QUARTERLY': 'Trimestriel',
  'SEMI_ANNUAL': 'Semestriel',
  'ANNUAL': 'Annuel',
  'ONCE': 'Une seule fois'
};

// ============= CALCULS FINANCIERS =============

/**
 * Calcule les statistiques financières
 */
export const calculateFinancialStats = (transactions = [], scheduledOps = []) => {
  const totalCredits = transactions
    .filter(t => t.type === 'CREDIT')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  const totalDebits = transactions
    .filter(t => t.type === 'DEBIT')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyTransactions = transactions.filter(t => {
    const tDate = new Date(t.date);
    return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
  });

  const monthlyCredits = monthlyTransactions
    .filter(t => t.type === 'CREDIT')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  const monthlyDebits = monthlyTransactions
    .filter(t => t.type === 'DEBIT')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  const monthlyBalance = monthlyCredits - monthlyDebits;

  // Impact des opérations programmées sur le mois
  const scheduledMonthlyImpact = (scheduledOps || [])
    .filter(op => {
      const opDate = new Date(op.nextDate || op.date);
      return opDate.getMonth() === currentMonth && opDate.getFullYear() === currentYear;
    })
    .reduce((sum, op) => {
      const impact = op.type === 'SCHEDULED_CREDIT' ? (parseFloat(op.amount) || 0) : -(parseFloat(op.amount) || 0);
      return sum + impact;
    }, 0);

  return {
    totalCredits: parseFloat(totalCredits.toFixed(2)),
    totalDebits: parseFloat(totalDebits.toFixed(2)),
    monthlyBalance: parseFloat(monthlyBalance.toFixed(2)),
    scheduledMonthlyImpact: parseFloat(scheduledMonthlyImpact.toFixed(2)),
    scheduledCount: scheduledOps?.length || 0
  };
};

/**
 * Calcule le montant TTC à partir du HT et TVA
 */
export const calculateTTC = (amountExcludingTax, taxRate = 0) => {
  const ht = parseFloat(amountExcludingTax) || 0;
  const rate = parseFloat(taxRate) || 0;
  const taxAmount = ht * (rate / 100);
  const ttc = ht + taxAmount;
  
  return {
    taxAmount: parseFloat(taxAmount.toFixed(2)),
    totalAmount: parseFloat(ttc.toFixed(2))
  };
};

/**
 * Formate une devise
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

// ============= RÈGLES DE PERMISSIONS =============

/**
 * Vérifie si l'utilisateur peut modifier la balance
 */
export const canModifyBalance = (userRole) => {
  const allowedRoles = ['ADMIN', 'PRESIDENT', 'TRESORIER'];
  return allowedRoles.includes(userRole);
};

/**
 * Vérifie si l'utilisateur peut approuver des paiements
 */
export const canApprovePayments = (userRole) => {
  const allowedRoles = ['ADMIN', 'PRESIDENT', 'TRESORIER'];
  return allowedRoles.includes(userRole);
};

/**
 * Vérifie si l'utilisateur peut supprimer des transactions
 */
export const canDeleteTransaction = (userRole, transactionOwner) => {
  if (userRole === 'ADMIN') return true;
  if (userRole === 'TRESORIER') return true;
  return userRole === transactionOwner;
};

// ============= ALLOCATIONS DE TRANSACTIONS =============

/**
 * Valide les allocations d'une transaction
 */
export const validateTransactionAllocations = (allocations = [], totalAmount) => {
  const errors = [];

  if (allocations.length === 0) return { isValid: true, errors };

  const allocatedTotal = allocations.reduce((sum, a) => sum + (parseFloat(a.allocatedAmount) || 0), 0);
  
  // Le total alloué doit égaler le montant de la transaction (tolérance 0.01€)
  if (Math.abs(allocatedTotal - totalAmount) > 0.01) {
    errors.push(`Total alloue (${allocatedTotal.toFixed(2)}EUR) doit egaler le montant (${totalAmount.toFixed(2)}EUR)`);
  }

  // Chaque allocation doit avoir un montant > 0
  allocations.forEach((a, i) => {
    if (!a.categoryId) errors.push(`Allocation ${i + 1}: Categorie requise`);
    if (!a.allocatedAmount || parseFloat(a.allocatedAmount) <= 0) {
      errors.push(`Allocation ${i + 1}: Montant doit etre > 0`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

// ============= RAPPORTS FINANCIERS =============

/**
 * Génère un rapport par catégorie
 */
export const generateCategoryReport = (transactions = [], year = null) => {
  const targetYear = year || new Date().getFullYear();
  
  const filtered = transactions.filter(t => {
    const tDate = new Date(t.date);
    return tDate.getFullYear() === targetYear;
  });

  const byCategory = {};
  
  filtered.forEach(t => {
    const cat = t.category || 'AUTRE';
    if (!byCategory[cat]) {
      byCategory[cat] = { credits: 0, debits: 0, count: 0 };
    }
    if (t.type === 'CREDIT') {
      byCategory[cat].credits += parseFloat(t.amount) || 0;
    } else {
      byCategory[cat].debits += parseFloat(t.amount) || 0;
    }
    byCategory[cat].count++;
  });

  return byCategory;
};

/**
 * Génère un rapport mensuel
 */
export const generateMonthlyReport = (transactions = [], year = null) => {
  const targetYear = year || new Date().getFullYear();
  const monthly = {};

  // Initialiser tous les mois
  for (let m = 1; m <= 12; m++) {
    monthly[m] = { credits: 0, debits: 0, balance: 0 };
  }

  transactions.filter(t => {
    const tDate = new Date(t.date);
    return tDate.getFullYear() === targetYear;
  }).forEach(t => {
    const month = new Date(t.date).getMonth() + 1;
    if (t.type === 'CREDIT') {
      monthly[month].credits += parseFloat(t.amount) || 0;
    } else {
      monthly[month].debits += parseFloat(t.amount) || 0;
    }
  });

  // Calculer les balances
  Object.keys(monthly).forEach(m => {
    monthly[m].balance = monthly[m].credits - monthly[m].debits;
  });

  return monthly;
};

// ============= PROCHAINES DATES PROGRAMMÉES =============

/**
 * Calcule la prochaine date d'exécution selon la fréquence
 */
export const calculateNextScheduledDate = (currentDate, frequency) => {
  const date = new Date(currentDate);
  
  switch (frequency) {
    case 'MONTHLY':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'QUARTERLY':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'SEMI_ANNUAL':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'ANNUAL':
      date.setFullYear(date.getFullYear() + 1);
      break;
    case 'ONCE':
      return null; // Pas de prochaine date
    default:
      return null;
  }

  return date.toISOString().split('T')[0];
};

// ============= EXPORT DE TOUTES LES CONSTANTES =============

export const BUSINESS_RULES = {
  TRANSACTION_CATEGORIES,
  TRANSACTION_TYPES,
  DOCUMENT_STATUS,
  FREQUENCIES,
  validateTransaction,
  validateDocument,
  validateScheduledOperation,
  validateTransactionAllocations,
  calculateFinancialStats,
  calculateTTC,
  formatCurrency,
  canModifyBalance,
  canApprovePayments,
  canDeleteTransaction,
  generateCategoryReport,
  generateMonthlyReport,
  calculateNextScheduledDate
};
