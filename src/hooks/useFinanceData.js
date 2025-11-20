/**
 * Logique partagée Finance
 * Centralise tous les hooks et appels API pour les composants Finance
 */

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:4000";

export const useFinanceData = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // État transactions
  const [transactions, setTransactions] = useState([]);
  const [newTransaction, setNewTransaction] = useState({
    type: "CREDIT",
    amount: "",
    description: "",
    category: "ADHESION",
    date: new Date().toISOString().split("T")[0]
  });

  // État documents (Devis & Factures)
  const [documents, setDocuments] = useState([]);
  const [editingDocument, setEditingDocument] = useState(null);
  const [docForm, setDocForm] = useState({
    type: "QUOTE",
    number: "",
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: "",
    amountExcludingTax: "",
    taxRate: 20,
    taxAmount: 0,
    amount: "",
    status: "DRAFT",
    eventId: ""
  });

  // État opérations programmées (Échéanciers & Paiements)
  const [scheduledOperations, setScheduledOperations] = useState([]);
  const [newScheduled, setNewScheduled] = useState({
    type: "SCHEDULED_PAYMENT",
    amount: "",
    description: "",
    frequency: "MONTHLY",
    nextDate: new Date().toISOString().split("T")[0],
    totalAmount: ""
  });

  // État notes de frais
  const [expenseReports, setExpenseReports] = useState([]);
  const [newExpenseReport, setNewExpenseReport] = useState({
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0]
  });

  // État simulations
  const [simulationData, setSimulationData] = useState({
    scenarios: [],
    activeScenario: null,
    projectionMonths: 12
  });

  // État rapports
  const currentYear = new Date().getFullYear();
  const [reportYear, setReportYear] = useState(currentYear);
  const [reportData, setReportData] = useState(null);

  // État configuration
  const [balance, setBalance] = useState(0);
  const [isBalanceLocked, setIsBalanceLocked] = useState(true);
  const [stats, setStats] = useState({
    totalCredits: 0,
    totalDebits: 0,
    monthlyBalance: 0,
    scheduledMonthlyImpact: 0,
    scheduledCount: 0
  });

  // Charger les données initiales
  const loadFinanceData = useCallback(async () => {
    try {
      setLoading(true);

      // Charger les transactions
      const transRes = await fetch(`${API_BASE}/api/finance/transactions`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });
      if (transRes.ok) {
        const data = await transRes.json();
        setTransactions(data.transactions || []);
        setStats(data.stats || {});
      }

      // Charger les documents
      const docRes = await fetch(`${API_BASE}/api/finance/documents`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });
      if (docRes.ok) {
        const data = await docRes.json();
        setDocuments(data.documents || []);
      }

      // Charger les opérations programmées
      const schedRes = await fetch(`${API_BASE}/api/finance/scheduled`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });
      if (schedRes.ok) {
        const data = await schedRes.json();
        setScheduledOperations(data.operations || []);
      }

      // Charger les notes de frais
      const expenseRes = await fetch(`${API_BASE}/api/finance/expenses`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });
      if (expenseRes.ok) {
        const data = await expenseRes.json();
        setExpenseReports(data.reports || []);
      }

      // Charger le solde
      const balRes = await fetch(`${API_BASE}/api/finance/balance`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });
      if (balRes.ok) {
        const data = await balRes.json();
        setBalance(data.balance || 0);
      }
    } catch (error) {
      console.error("Erreur chargement données finance:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données financières",
        status: "error",
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Créer une transaction
  const addTransaction = useCallback(
    async (transaction) => {
      try {
        const res = await fetch(`${API_BASE}/api/finance/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify(transaction)
        });

        if (!res.ok) throw new Error("Erreur création transaction");

        const data = await res.json();
        setTransactions([...transactions, data]);
        toast({
          title: "Succès",
          description: "Transaction créée",
          status: "success"
        });
        return data;
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
      }
    },
    [transactions, toast]
  );

  // Supprimer une transaction
  const deleteTransaction = useCallback(
    async (id) => {
      try {
        const res = await fetch(`${API_BASE}/api/finance/transactions/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });

        if (!res.ok) throw new Error("Erreur suppression");

        setTransactions(transactions.filter(t => t.id !== id));
        toast({
          title: "Succès",
          description: "Transaction supprimée",
          status: "success"
        });
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
      }
    },
    [transactions, toast]
  );

  // Créer un document (Devis/Facture)
  const addDocument = useCallback(
    async (document) => {
      try {
        const res = await fetch(`${API_BASE}/api/finance/documents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify(document)
        });

        if (!res.ok) throw new Error("Erreur création document");

        const data = await res.json();
        setDocuments([...documents, data]);
        toast({
          title: "Succès",
          description: "Document créé",
          status: "success"
        });
        return data;
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
      }
    },
    [documents, toast]
  );

  // Supprimer un document
  const deleteDocument = useCallback(
    async (id) => {
      try {
        const res = await fetch(`${API_BASE}/api/finance/documents/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });

        if (!res.ok) throw new Error("Erreur suppression");

        setDocuments(documents.filter(d => d.id !== id));
        toast({
          title: "Succès",
          description: "Document supprimé",
          status: "success"
        });
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
      }
    },
    [documents, toast]
  );

  // Charger les données au montage
  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  return {
    loading,
    loadFinanceData,
    // Transactions
    transactions,
    setTransactions,
    newTransaction,
    setNewTransaction,
    addTransaction,
    deleteTransaction,
    // Documents
    documents,
    setDocuments,
    editingDocument,
    setEditingDocument,
    docForm,
    setDocForm,
    addDocument,
    deleteDocument,
    // Opérations programmées
    scheduledOperations,
    setScheduledOperations,
    newScheduled,
    setNewScheduled,
    // Notes de frais
    expenseReports,
    setExpenseReports,
    newExpenseReport,
    setNewExpenseReport,
    // Simulations
    simulationData,
    setSimulationData,
    // Rapports
    reportYear,
    setReportYear,
    reportData,
    setReportData,
    // Configuration
    balance,
    setBalance,
    isBalanceLocked,
    setIsBalanceLocked,
    stats,
    setStats
  };
};
