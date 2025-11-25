/**
 * Composant Facturation (Devis & Factures)
 * Gestion complète des documents commerciaux avec formulaire détaillé
 * Reprend tous les champs de l'ancien AdminFinance
 */

import React, { useState, useEffect } from "react";
import {
  Box, VStack, HStack, Card, CardHeader, CardBody,
  Heading, Text, Button, Badge, Icon, SimpleGrid, useToast,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalFooter, FormControl, FormLabel, Input, Select, useDisclosure,
  Table, Thead, Tbody, Tr, Th, Td, Textarea, NumberInput,
  NumberInputField, NumberInputStepper, NumberIncrementStepper,
  NumberDecrementStepper, Tabs, TabList, TabPanels, Tab, TabPanel,
  Divider, useBreakpointValue, Grid, Wrap, WrapItem, IconButton
} from "@chakra-ui/react";
import { FiDownload, FiEye, FiPlus, FiEdit2, FiTrash2, FiPrinter, FiUpload, FiInfo } from "react-icons/fi";
import html2pdf from "html2pdf.js";
import { useFinanceData } from "../../hooks/useFinanceData";
import DevisLinesManager from "../DevisLinesManager";

const FinanceInvoicing = () => {
  const {
    documents,
    addDocument,
    deleteDocument,
    updateDocumentStatus,
    loading
  } = useFinanceData();

  const [isAdding, setIsAdding] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [devisLines, setDevisLines] = useState([]);
  const [docForm, setDocForm] = useState({
    type: "QUOTE",
    number: "",
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: "",
    amountExcludingTax: "",
    taxRate: 0,
    taxAmount: 0,
    amount: "",
    status: "DRAFT",
    eventId: "",
    memberId: "",
    destinataireName: "",
    destinataireAdresse: "",
    destinataireSociete: "",
    destinataireContacts: "",
    notes: "",
    paymentMethod: "",
    paymentDate: "",
    amountPaid: "",
    htmlContent: ""
  });

  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isLinesOpen, onOpen: onLinesOpen, onClose: onLinesClose } = useDisclosure();
  const { isOpen: isGenerateOpen, onOpen: onGenerateOpen, onClose: onGenerateClose } = useDisclosure();

  // Charger les templates au montage
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch(
        import.meta.env.VITE_API_URL + "/api/quote-templates" || "http://localhost:4000/api/quote-templates",
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const tmplList = Array.isArray(data) ? data : (data?.templates || []);
        setTemplates(tmplList);
      }
    } catch (e) {
      console.warn("⚠️ Impossible de charger les templates:", e);
      setTemplates([]);
    }
  };

  const handleOpenCreate = () => {
    setEditingDocument(null);
    setDocForm({
      type: "QUOTE",
      number: "",
      title: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      dueDate: "",
      amountExcludingTax: "",
      taxRate: 0,
      taxAmount: 0,
      amount: "",
      status: "DRAFT",
      eventId: "",
      memberId: "",
      destinataireName: "",
      destinataireAdresse: "",
      destinataireSociete: "",
      destinataireContacts: "",
      notes: "",
      paymentMethod: "",
      paymentDate: "",
      amountPaid: "",
      htmlContent: ""
    });
    onOpen();
  };

  const handleOpenEdit = (doc) => {
    setEditingDocument(doc);
    setDocForm({
      type: doc.type || "QUOTE",
      number: doc.number || "",
      title: doc.title || "",
      description: doc.description || "",
      date: (doc.date || new Date().toISOString()).slice(0, 10),
      dueDate: doc.dueDate ? doc.dueDate.slice(0, 10) : "",
      amountExcludingTax: String(doc.amountExcludingTax ?? ""),
      taxRate: doc.taxRate ?? 0,
      taxAmount: doc.taxAmount ?? 0,
      amount: String(doc.amount || ""),
      status: doc.status || "DRAFT",
      eventId: doc.eventId || "",
      memberId: doc.memberId || "",
      destinataireName: doc.destinataireName || "",
      destinataireAdresse: doc.destinataireAdresse || "",
      destinataireSociete: doc.destinataireSociete || "",
      destinataireContacts: doc.destinataireContacts || "",
      notes: doc.notes || "",
      paymentMethod: doc.paymentMethod || "",
      paymentDate: doc.paymentDate ? doc.paymentDate.slice(0, 10) : "",
      amountPaid: String(doc.amountPaid || ""),
      htmlContent: doc.htmlContent || ""
    });
    onOpen();
  };

  const handleAdd = async () => {
    // Validations obligatoires
    if (!docForm.number) {
      toast({
        title: "Erreur",
        description: "Le numéro du document est obligatoire",
        status: "error"
      });
      return;
    }
    if (!docForm.title) {
      toast({
        title: "Erreur",
        description: "Le titre est obligatoire",
        status: "error"
      });
      return;
    }
    if (!docForm.amount) {
      toast({
        title: "Erreur",
        description: "Le montant est obligatoire",
        status: "error"
      });
      return;
    }

    setIsAdding(true);
    try {
      // Si un fichier PDF est sélectionné, convertir en base64
      let documentUrl = undefined;
      if (pdfFile) {
        const reader = new FileReader();
        documentUrl = await new Promise((resolve, reject) => {
          reader.onload = () => {
            resolve(reader.result); // data:application/pdf;base64,...
          };
          reader.onerror = reject;
          reader.readAsDataURL(pdfFile);
        });
      }

      // Si on édite un document existant, ajouter l'ID
      const dataToSave = {
        ...docForm,
        ...(editingDocument && { id: editingDocument.id }),
        ...(documentUrl && { documentUrl })
      };
      await addDocument(dataToSave);
      toast({
        title: "Succès",
        description: editingDocument ? "Document modifié" : "Document créé",
        status: "success"
      });
      setDocForm({
        type: "QUOTE",
        number: "",
        title: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
        dueDate: "",
        amountExcludingTax: "",
        taxRate: 0,
        taxAmount: 0,
        amount: "",
        status: "DRAFT",
        eventId: "",
        memberId: "",
        destinataireName: "",
        destinataireAdresse: "",
        destinataireSociete: "",
        destinataireContacts: "",
        notes: "",
        paymentMethod: "",
        htmlContent: "",
        paymentDate: "",
        amountPaid: ""
      });
      setPdfFile(null);
      setEditingDocument(null);
      onClose();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le document",
        status: "error"
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Cette action est irréversible. Confirmer la suppression ?")) {
      try {
        await deleteDocument(id);
        toast({
          title: "Succès",
          description: "Document supprimé",
          status: "success"
        });
      } catch (error) {
        toast({
          title: "Erreur",
          description: "Impossible de supprimer le document",
          status: "error"
        });
      }
    }
  };

  // Changer le statut d'un document
  const handleChangeStatus = async (docId, newStatus) => {
    try {
      const doc = documents.find(d => d.id === docId);
      await updateDocumentStatus(docId, newStatus);
      
      // Suggestion auto-facture quand un devis est accepté
      if (doc?.type === 'QUOTE' && newStatus === 'ACCEPTED') {
        toast({
          title: "Succès",
          description: "Statut mis à jour",
          status: "success"
        });
        
        // Attendre un peu puis proposer la création de facture
        setTimeout(() => {
          if (window.confirm(`✅ Devis ${doc.number} accepté !\n\nVoulez-vous créer une facture basée sur ce devis pour gagner du temps ?`)) {
            // Créer une facture avec les données du devis
            setDocForm({
              type: "INVOICE",
              number: `FACT-${doc.number.split('-')[1] || doc.number}`,
              title: doc.title,
              description: doc.description || "",
              date: new Date().toISOString().split("T")[0],
              dueDate: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              amountExcludingTax: doc.amountExcludingTax || "",
              taxRate: doc.taxRate || 0,
              taxAmount: doc.taxAmount || 0,
              amount: doc.amount || "",
              status: "DRAFT",
              eventId: doc.eventId || "",
              memberId: doc.memberId || "",
              destinataireName: "",
              destinataireAdresse: "",
              destinataireSociete: "",
              destinataireContacts: "",
              notes: `Facture créée à partir du devis ${doc.number}`,
              paymentMethod: "",
              paymentDate: "",
              amountPaid: ""
            });
            setEditingDocument(null);
            setPdfFile(null);
            setSelectedTemplate(null);
            onOpen(); // Ouvrir le modal
          }
        }, 500);
      } else {
        toast({
          title: "Succès",
          description: "Statut mis à jour",
          status: "success"
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut",
        status: "error"
      });
    }
  };

  // Voir le document (généré ou importé)
  const handleViewDocument = async (doc) => {
    if (!doc.documentUrl && !doc.htmlContent) {
      toast({
        title: "Aucun document",
        description: "Ce document n'a pas de fichier généré ou importé",
        status: "info"
      });
      return;
    }

    if (doc.documentUrl) {
      // Ouvrir le PDF/document importé
      window.open(doc.documentUrl, "_blank");
    } else if (doc.htmlContent) {
      // Afficher le HTML généré
      const newWindow = window.open("", "_blank");
      newWindow.document.write(doc.htmlContent);
      newWindow.document.close();
    }
  };

  // Générer un document depuis un template HTML
  const generateFromTemplate = async () => {
    if (!selectedTemplate) {
      toast({
        title: "Erreur",
        description: "Sélectionnez un template",
        status: "warning"
      });
      return;
    }

    if (!editingDocument?.id && !docForm.number) {
      toast({
        title: "Erreur",
        description: "Enregistrez d'abord le document",
        status: "warning"
      });
      return;
    }

    try {
      // Charger les lignes du devis
      const currentDevisId = editingDocument?.id || "temp-" + Date.now();
      let devisLinesTr = "";

      try {
        const linesResponse = await fetch(
          (import.meta.env.VITE_API_URL || "http://localhost:4000") + `/api/devis-lines/${currentDevisId}`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          }
        );

        if (linesResponse.ok) {
          const lines = await linesResponse.json();
          if (Array.isArray(lines) && lines.length > 0) {
            devisLinesTr = lines
              .map(
                (line) => `
              <tr>
                <td class="num">${line.quantity}</td>
                <td class="desc">${line.description}</td>
                <td class="num">${line.unitPrice.toFixed(2)} €</td>
                <td class="num">${line.totalPrice.toFixed(2)} €</td>
              </tr>
            `
              )
              .join("");
          }
        }
      } catch (e) {
        console.warn("⚠️ Impossible de charger les lignes:", e.message);
      }

      // Préparer les données pour la génération
      const previewData = {
        NUM_DEVIS: docForm.number,
        TITRE: docForm.title,
        OBJET: docForm.title,
        DESCRIPTION: docForm.description || "",
        MONTANT: parseFloat(docForm.amount || 0).toFixed(2),
        PRIX_NET: parseFloat(docForm.amount || 0).toFixed(2),
        DATE: new Date(docForm.date).toLocaleDateString("fr-FR"),
        DESTINATAIRE_NOM: docForm.destinataireName || "Destinataire",
        DESTINATAIRE_ADRESSE: docForm.destinataireAdresse || "",
        DESTINATAIRE_SOCIETE: docForm.destinataireSociete || "",
        DESTINATAIRE_CONTACTS: docForm.destinataireContacts || "",
        NOTES: docForm.notes || "",
        LOGO_BIG: selectedTemplate.logoBig || "",
        LOGO_SMALL: selectedTemplate.logoSmall || "",
        DEVIS_LINES_TR: devisLinesTr
      };

      // Générer l'HTML en remplaçant les placeholders
      let generatedHtml = selectedTemplate.htmlContent;
      Object.entries(previewData).forEach(([key, value]) => {
        const placeholder = new RegExp(`{{${key}}}`, "g");
        generatedHtml = generatedHtml.replace(placeholder, String(value || ""));
      });

      // Sauvegarder le document avec l'HTML généré
      setDocForm(prev => ({ ...prev, htmlContent: generatedHtml }));

      console.log("📄 Envoi au serveur pour génération PDF avec Puppeteer...");

      // Appeler l'endpoint serveur pour générer le PDF
      const token = localStorage.getItem("token");
      const generateResponse = await fetch(
        (import.meta.env.VITE_API_URL || "http://localhost:4000") + `/api/finance/documents/${editingDocument.id}/generate-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ htmlContent: generatedHtml })
        }
      );

      if (!generateResponse.ok) {
        const error = await generateResponse.json();
        throw new Error(error.error || "Erreur lors de la génération du PDF");
      }

      const generateResult = await generateResponse.json();
      const pdfDataUri = generateResult.pdfDataUri;

      if (!pdfDataUri) {
        throw new Error("Impossible de générer le PDF - résultat vide du serveur");
      }

      console.log("✅ PDF généré avec succès par Puppeteer!");

      // Ouvrir aperçu dans une nouvelle fenêtre
      const newWindow = window.open("", "_blank");
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>Aperçu - ${docForm.type === "QUOTE" ? "Devis" : "Facture"} ${docForm.number}</title>
              <style>
                body { margin: 0; padding: 10px; font-family: Arial, sans-serif; }
                #pdfContainer { width: 100%; height: 90vh; }
                #downloadBtn { 
                  padding: 10px 20px; 
                  background: #4CAF50; 
                  color: white; 
                  border: none; 
                  border-radius: 4px; 
                  cursor: pointer; 
                  font-size: 16px;
                  margin-bottom: 10px;
                }
                #downloadBtn:hover { background: #45a049; }
              </style>
            </head>
            <body>
              <button id="downloadBtn" onclick="downloadPDF()">⬇️ Télécharger PDF</button>
              <iframe id="pdfContainer" src="${pdfDataUri}" type="application/pdf"></iframe>
              <script>
                function downloadPDF() {
                  const link = document.createElement('a');
                  link.href = "${pdfDataUri}";
                  link.download = "${docForm.type === "QUOTE" ? "Devis" : "Facture"}_${docForm.number}.pdf";
                  link.click();
                }
              </script>
            </body>
          </html>
        `);
        newWindow.document.close();
      }

      toast({
        title: "Succès",
        description: "PDF généré par serveur ! Aperçu et téléchargement disponibles.",
        status: "success"
      });
    } catch (error) {
      console.error("❌ Erreur génération PDF:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le PDF: " + error.message,
        status: "error"
      });
    }
  };

  // Upload un PDF existant
  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier PDF",
        status: "warning"
      });
      return;
    }

    setPdfFile(file);
    toast({
      title: "PDF sélectionné",
      description: `${file.name} sera attaché au document`,
      status: "info"
    });
  };

  const statusColors = {
    "DRAFT": "gray",
    "SENT": "blue",
    "ACCEPTED": "green",
    "REJECTED": "red",
    "INVOICED": "purple",
    "PENDING_PAYMENT": "orange",
    "PAID": "green",
    "DEPOSIT_PAID": "cyan",
    "REEDITED": "yellow"
  };

  const statusLabels = {
    "DRAFT": "📋 Brouillon",
    "SENT": "📤 Envoyé",
    "ACCEPTED": "✅ Accepté",
    "REJECTED": "❌ Refusé",
    "INVOICED": "💰 Facturé",
    "PENDING_PAYMENT": "⏳ En attente",
    "PAID": "💳 Payé",
    "DEPOSIT_PAID": "💰 Accompte payé",
    "REEDITED": "🔄 Réédité"
  };

  const quoteStatuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "REEDITED"];
  const invoiceStatuses = ["DRAFT", "SENT", "PENDING_PAYMENT", "DEPOSIT_PAID", "PAID"];

  // Filtrer les documents
  const quotes = documents.filter(d => d.type === "QUOTE");
  const invoices = documents.filter(d => d.type === "INVOICE");

  return (
    <VStack align="stretch" spacing={6}>
      {/* Header - Responsive */}
      <HStack justify="space-between" wrap="wrap" spacing={4}>
        <Box>
          <Heading size={{ base: "md", md: "lg" }}>📄 Devis & Facturation</Heading>
          <Text color="gray.500" fontSize={{ base: "xs", md: "sm" }}>
            Gestion complète des documents commerciaux
          </Text>
        </Box>
        <Button
          leftIcon={<FiPlus />}
          colorScheme="blue"
          onClick={handleOpenCreate}
          isLoading={loading}
          size={{ base: "sm", md: "md" }}
        >
          Nouveau
        </Button>
      </HStack>

      {/* Tabs: Devis & Factures */}
      <Tabs colorScheme="blue" variant="enclosed">
        <TabList>
          <Tab>
            📄 Devis ({quotes.length})
          </Tab>
          <Tab>
            💰 Factures ({invoices.length})
          </Tab>
        </TabList>

        <TabPanels>
          {/* Onglet Devis */}
          <TabPanel>
            {quotes.length === 0 ? (
              <Card>
                <CardBody textAlign="center" py={12}>
                  <Text color="gray.500">Aucun devis. Créez-en un pour commencer.</Text>
                </CardBody>
              </Card>
            ) : (
              <Box overflowX={{ base: "auto", md: "visible" }}>
                <Card>
                  <CardBody>
                    <Table size={{ base: "sm", md: "md" }} variant="striped">
                      <Thead>
                        <Tr bg="gray.50">
                          <Th>N°</Th>
                          <Th>Titre</Th>
                          <Th display={{ base: "none", md: "table-cell" }}>Date</Th>
                          <Th isNumeric>Montant</Th>
                          <Th display={{ base: "none", sm: "table-cell" }}>Statut</Th>
                          <Th>Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {quotes.map((doc) => (
                          <Tr key={doc.id}>
                            <Td fontWeight="bold" fontSize={{ base: "xs", md: "md" }}>
                              {doc.number}
                            </Td>
                            <Td fontSize={{ base: "xs", md: "md" }}>
                              {doc.title.substring(0, 20)}
                            </Td>
                            <Td display={{ base: "none", md: "table-cell" }} fontSize="sm">
                              {new Date(doc.date).toLocaleDateString('fr-FR')}
                            </Td>
                            <Td isNumeric fontWeight="bold" fontSize={{ base: "xs", md: "md" }}>
                              {parseFloat(doc.amount || 0).toFixed(2)} €
                            </Td>
                            <Td display={{ base: "none", sm: "table-cell" }}>
                              <Badge colorScheme={statusColors[doc.status]} fontSize="xs">
                                {statusLabels[doc.status]}
                              </Badge>
                            </Td>
                            <Td>
                              <HStack spacing={1}>
                                <IconButton
                                  size={{ base: "xs", md: "sm" }}
                                  icon={<FiEye />}
                                  variant="ghost"
                                  onClick={() => handleViewDocument(doc)}
                                  title="Voir"
                                />
                                {doc.documentUrl && (
                                  <IconButton
                                    size={{ base: "xs", md: "sm" }}
                                    icon={<FiDownload />}
                                    variant="ghost"
                                    colorScheme="green"
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = doc.documentUrl;
                                      link.download = `${doc.type === 'QUOTE' ? 'Devis' : 'Facture'}_${doc.number}.pdf`;
                                      link.click();
                                    }}
                                    title="Télécharger PDF"
                                  />
                                )}
                                <Select
                                  size="xs"
                                  width="auto"
                                  value={doc.status}
                                  onChange={(e) => handleChangeStatus(doc.id, e.target.value)}
                                  cursor="pointer"
                                  display={{ base: "none", sm: "block" }}
                                >
                                  {quoteStatuses.map(s => (
                                    <option key={s} value={s}>{statusLabels[s]}</option>
                                  ))}
                                </Select>
                                <IconButton
                                  size={{ base: "xs", md: "sm" }}
                                  icon={<FiEdit2 />}
                                  variant="ghost"
                                  colorScheme="blue"
                                  onClick={() => handleOpenEdit(doc)}
                                  title="Modifier"
                                  display={{ base: "none", sm: "block" }}
                                />
                                <IconButton
                                  size={{ base: "xs", md: "sm" }}
                                  icon={<FiTrash2 />}
                                  variant="ghost"
                                  colorScheme="red"
                                  onClick={() => handleDelete(doc.id)}
                                  title="Supprimer"
                                  display={{ base: "none", md: "block" }}
                                />
                              </HStack>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </CardBody>
                </Card>
              </Box>
            )}
          </TabPanel>

          {/* Onglet Factures */}
          <TabPanel>
            {invoices.length === 0 ? (
              <Card>
                <CardBody textAlign="center" py={12}>
                  <Text color="gray.500">Aucune facture. Créez-en une pour commencer.</Text>
                </CardBody>
              </Card>
            ) : (
              <Box overflowX={{ base: "auto", md: "visible" }}>
                <Card>
                  <CardBody>
                    <Table size={{ base: "sm", md: "md" }} variant="striped">
                      <Thead>
                        <Tr bg="gray.50">
                          <Th>N°</Th>
                          <Th>Titre</Th>
                          <Th display={{ base: "none", md: "table-cell" }}>Date</Th>
                          <Th display={{ base: "none", lg: "table-cell" }}>Échéance</Th>
                          <Th isNumeric>Montant</Th>
                          <Th display={{ base: "none", sm: "table-cell" }} isNumeric>Payé</Th>
                          <Th display={{ base: "none", sm: "table-cell" }}>Statut</Th>
                          <Th>Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {invoices.map((doc) => (
                          <Tr key={doc.id}>
                            <Td fontWeight="bold" fontSize={{ base: "xs", md: "md" }}>
                              {doc.number}
                            </Td>
                            <Td fontSize={{ base: "xs", md: "md" }}>
                              {doc.title.substring(0, 20)}
                            </Td>
                            <Td display={{ base: "none", md: "table-cell" }} fontSize="sm">
                              {new Date(doc.date).toLocaleDateString('fr-FR')}
                            </Td>
                            <Td display={{ base: "none", lg: "table-cell" }} fontSize="sm">
                              {doc.dueDate ? new Date(doc.dueDate).toLocaleDateString('fr-FR') : '-'}
                            </Td>
                            <Td isNumeric fontWeight="bold" fontSize={{ base: "xs", md: "md" }}>
                              {parseFloat(doc.amount || 0).toFixed(2)} €
                            </Td>
                            <Td display={{ base: "none", sm: "table-cell" }} isNumeric>
                              <Badge 
                                colorScheme={
                                  parseFloat(doc.amountPaid || 0) >= parseFloat(doc.amount || 0) ? 'green' : 'orange'
                                }
                                fontSize="xs"
                              >
                                {parseFloat(doc.amountPaid || 0).toFixed(2)} €
                              </Badge>
                            </Td>
                            <Td display={{ base: "none", sm: "table-cell" }}>
                              <Badge colorScheme={statusColors[doc.status]} fontSize="xs">
                                {statusLabels[doc.status]}
                              </Badge>
                            </Td>
                            <Td>
                              <HStack spacing={1}>
                                <IconButton
                                  size={{ base: "xs", md: "sm" }}
                                  icon={<FiPrinter />}
                                  variant="ghost"
                                  onClick={() => handleViewDocument(doc)}
                                  title="Imprimer"
                                />
                                {doc.documentUrl && (
                                  <IconButton
                                    size={{ base: "xs", md: "sm" }}
                                    icon={<FiDownload />}
                                    variant="ghost"
                                    colorScheme="green"
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = doc.documentUrl;
                                      link.download = `${doc.type === 'QUOTE' ? 'Devis' : 'Facture'}_${doc.number}.pdf`;
                                      link.click();
                                    }}
                                    title="Télécharger PDF"
                                  />
                                )}
                                <Select
                                  size="xs"
                                  width="auto"
                                  value={doc.status}
                                  onChange={(e) => handleChangeStatus(doc.id, e.target.value)}
                                  cursor="pointer"
                                  display={{ base: "none", sm: "block" }}
                                >
                                  {invoiceStatuses.map(s => (
                                    <option key={s} value={s}>{statusLabels[s]}</option>
                                  ))}
                                </Select>
                                <IconButton
                                  size={{ base: "xs", md: "sm" }}
                                  icon={<FiEdit2 />}
                                  variant="ghost"
                                  colorScheme="blue"
                                  onClick={() => handleOpenEdit(doc)}
                                  title="Modifier"
                                  display={{ base: "none", sm: "block" }}
                                />
                                <IconButton
                                  size={{ base: "xs", md: "sm" }}
                                  icon={<FiTrash2 />}
                                  variant="ghost"
                                  colorScheme="red"
                                  onClick={() => handleDelete(doc.id)}
                                  title="Supprimer"
                                  display={{ base: "none", md: "block" }}
                                />
                              </HStack>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </CardBody>
                </Card>
              </Box>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Modal de formulaire */}
      <Modal isOpen={isOpen} onClose={onClose} size={{ base: "full", md: "xl" }}>
        <ModalOverlay />
        <ModalContent maxH="90vh" overflowY="auto">
          <ModalHeader>
            {editingDocument ? "Modifier le document" : "Nouveau document"}          </ModalHeader>
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {/* Type et Dates */}
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap={3}>
                <FormControl>
                  <FormLabel fontWeight="bold" fontSize="sm">Type</FormLabel>
                  <Select
                    value={docForm.type}
                    size="sm"
                    onChange={(e) => setDocForm(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="QUOTE">📄 Devis</option>
                    <option value="INVOICE">💰 Facture</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontWeight="bold" fontSize="sm">Date</FormLabel>
                  <Input
                    type="date"
                    size="sm"
                    value={docForm.date}
                    onChange={(e) => setDocForm(prev => ({ ...prev, date: e.target.value }))}
                  />
                </FormControl>
                {docForm.type === "INVOICE" && (
                  <FormControl>
                    <FormLabel fontWeight="bold" fontSize="sm">Échéance</FormLabel>
                    <Input
                      type="date"
                      size="sm"
                      value={docForm.dueDate || ""}
                      onChange={(e) => setDocForm(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </FormControl>
                )}
              </Grid>

              {/* Numéro et Titre */}
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={3}>
                <FormControl>
                  <FormLabel fontWeight="bold" fontSize="sm">Numéro</FormLabel>
                  <Input
                    size="sm"
                    value={docForm.number}
                    onChange={(e) => setDocForm(prev => ({ ...prev, number: e.target.value }))}
                    placeholder={docForm.type === "QUOTE" ? "ex: DV-2025-001" : "ex: FA-2025-001"}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontWeight="bold" fontSize="sm">Titre</FormLabel>
                  <Input
                    size="sm"
                    value={docForm.title}
                    onChange={(e) => setDocForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Objet du document"
                  />
                </FormControl>
              </Grid>

              {/* Description */}
              <FormControl>
                <FormLabel fontWeight="bold" fontSize="sm">Description</FormLabel>
                <Textarea
                  value={docForm.description || ""}
                  onChange={(e) => setDocForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Détails du document"
                  rows={2}
                  size="sm"
                />
              </FormControl>

              {/* Montant */}
              <Box bg="blue.50" p={4} borderRadius="md" borderLeft="4px solid" borderColor="blue.500">
                <VStack spacing={3} align="stretch">
                  <HStack justify="space-between">
                    <Heading size="sm">💰 Montant</Heading>
                    <Text fontSize="xs" color="gray.600">Association (exempte TVA)</Text>
                  </HStack>

                  <FormControl>
                    <FormLabel fontSize="sm" fontWeight="bold">Montant TTC</FormLabel>
                    <NumberInput
                      value={docForm.amount || ""}
                      onChange={(v) => {
                        setDocForm(prev => ({
                          ...prev,
                          amount: v,
                          amountExcludingTax: v,
                          taxRate: 0,
                          taxAmount: 0
                        }));
                      }}
                      precision={2}
                      step={10}
                    >
                      <NumberInputField placeholder="0.00" />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>

                  <Box p={3} bg="green.100" borderRadius="md" border="1px solid" borderColor="green.400">
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="green.700" fontWeight="bold">Total TTC:</Text>
                      <Text fontSize="lg" color="green.700" fontWeight="bold">
                        {parseFloat(docForm.amount || 0).toFixed(2)} €
                      </Text>
                    </HStack>
                  </Box>
                </VStack>
              </Box>

              {/* Section Génération & Lignes pour Devis */}
              {docForm.type === "QUOTE" && (
                <>
                  <Divider />
                  {!editingDocument?.id ? (
                    <Box bg="yellow.50" p={4} borderRadius="md" borderLeft="4px solid" borderColor="yellow.500">
                      <VStack spacing={2} align="flex-start">
                        <HStack>
                          <Icon as={FiInfo} color="yellow.600" />
                          <Text fontSize="sm" color="yellow.700" fontWeight="bold">
                            💡 Créez d'abord le devis pour gérer les lignes
                          </Text>
                        </HStack>
                        <Text fontSize="xs" color="yellow.600">
                          Remplissez le formulaire ci-dessus et cliquez sur "Créer" pour accéder au gestionnaire de lignes.
                        </Text>
                      </VStack>
                    </Box>
                  ) : (
                    <>
                      <VStack spacing={3} align="stretch" bg="blue.50" p={4} borderRadius="md">
                        <HStack justify="space-between" align="center">
                          <Heading size="sm">📄 Génération de Document</Heading>
                        </HStack>

                        {/* Sélection template */}
                        <FormControl>
                          <FormLabel fontSize="sm" fontWeight="bold">Template HTML</FormLabel>
                          <Select
                            size="sm"
                            value={selectedTemplate?.id || ""}
                            onChange={(e) => {
                              const tmpl = templates.find(t => t.id === e.target.value);
                              setSelectedTemplate(tmpl);
                            }}
                          >
                            <option value="">Sélectionnez un template...</option>
                            {templates.map(tmpl => (
                              <option key={tmpl.id} value={tmpl.id}>
                                {tmpl.name}
                              </option>
                            ))}
                          </Select>
                        </FormControl>

                        {/* Boutons d'action */}
                        <HStack spacing={2} width="100%">
                          {selectedTemplate && (
                            <Button
                              size="sm"
                              colorScheme="blue"
                              leftIcon={<FiPrinter />}
                              onClick={generateFromTemplate}
                              flex={1}
                            >
                              Générer depuis template
                            </Button>
                          )}
                          <Button
                            size="sm"
                            colorScheme="gray"
                            leftIcon={<FiUpload />}
                            onClick={() => document.getElementById("pdf-upload")?.click()}
                            flex={1}
                          >
                            Uploader un PDF
                          </Button>
                          <input
                            id="pdf-upload"
                            type="file"
                            accept=".pdf"
                            onChange={handlePdfUpload}
                            style={{ display: "none" }}
                          />
                        </HStack>

                        {pdfFile && (
                          <Text fontSize="xs" color="green.600" fontWeight="bold">
                            ✅ PDF sélectionné: {pdfFile.name}
                          </Text>
                        )}
                      </VStack>

                      {/* Gestionnaire de lignes */}
                      <Divider />
                      <Box bg="orange.50" p={4} borderRadius="md" borderLeft="4px solid" borderColor="orange.500">
                        <DevisLinesManager
                          devisId={editingDocument.id}
                          onTotalChange={(total) => {
                            setDocForm(prev => ({
                              ...prev,
                              amount: total.toFixed(2)
                            }));
                          }}
                        />
                      </Box>
                    </>
                  )}
                </>
              )}

              {/* Statut */}
              <FormControl>
                <FormLabel fontWeight="bold">Statut</FormLabel>
                <Select
                  value={docForm.status}
                  onChange={(e) => setDocForm(prev => ({ ...prev, status: e.target.value }))}
                >
                  {docForm.type === "QUOTE" ? (
                    <>
                      <option value="DRAFT">📋 Brouillon</option>
                      <option value="SENT">📤 Envoyé</option>
                      <option value="ACCEPTED">✅ Accepté</option>
                      <option value="REJECTED">❌ Refusé</option>
                      <option value="REEDITED">🔄 Réédité</option>
                    </>
                  ) : (
                    <>
                      <option value="DRAFT">📋 Brouillon</option>
                      <option value="SENT">📤 Envoyé</option>
                      <option value="PENDING_PAYMENT">⏳ En attente de paiement</option>
                      <option value="DEPOSIT_PAID">💰 Accompte payé</option>
                      <option value="PAID">💳 Payé</option>
                    </>
                  )}
                </Select>
              </FormControl>

              {/* Paiement pour les factures */}
              {docForm.type === "INVOICE" && (
                <Box bg="purple.50" p={3} borderRadius="md" borderLeft="4px solid" borderColor="purple.500">
                  <VStack spacing={2} align="stretch">
                    <FormLabel fontSize="sm" fontWeight="bold">📋 Infos de paiement</FormLabel>
                    <HStack spacing={2}>
                      <FormControl>
                        <FormLabel fontSize="xs">Mode de paiement</FormLabel>
                        <Input
                          size="sm"
                          value={docForm.paymentMethod || ""}
                          onChange={(e) => setDocForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                          placeholder="ex: Virement, Espèces, Chèque"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs">Date de paiement</FormLabel>
                        <Input
                          size="sm"
                          type="date"
                          value={docForm.paymentDate || ""}
                          onChange={(e) => setDocForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                        />
                      </FormControl>
                    </HStack>
                    <FormControl>
                      <FormLabel fontSize="xs">Montant payé</FormLabel>
                      <NumberInput
                        value={docForm.amountPaid || ""}
                        onChange={(v) => setDocForm(prev => ({ ...prev, amountPaid: v }))}
                        precision={2}
                      >
                        <NumberInputField />
                      </NumberInput>
                    </FormControl>
                  </VStack>
                </Box>
              )}

              {/* Informations destinataire */}
              <Box bg="orange.50" p={3} borderRadius="md" borderLeft="4px solid" borderColor="orange.500">
                <VStack spacing={2} align="stretch">
                  <FormLabel fontSize="sm" fontWeight="bold">👤 Destinataire (pour le template)</FormLabel>
                  <FormControl>
                    <FormLabel fontSize="xs">Nom</FormLabel>
                    <Input
                      size="sm"
                      value={docForm.destinataireName || ""}
                      onChange={(e) => setDocForm(prev => ({ ...prev, destinataireName: e.target.value }))}
                      placeholder="Nom du destinataire"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Société</FormLabel>
                    <Input
                      size="sm"
                      value={docForm.destinataireSociete || ""}
                      onChange={(e) => setDocForm(prev => ({ ...prev, destinataireSociete: e.target.value }))}
                      placeholder="Nom de la société"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Adresse</FormLabel>
                    <Input
                      size="sm"
                      value={docForm.destinataireAdresse || ""}
                      onChange={(e) => setDocForm(prev => ({ ...prev, destinataireAdresse: e.target.value }))}
                      placeholder="Adresse complète"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Contacts (téléphone, email, etc)</FormLabel>
                    <Input
                      size="sm"
                      value={docForm.destinataireContacts || ""}
                      onChange={(e) => setDocForm(prev => ({ ...prev, destinataireContacts: e.target.value }))}
                      placeholder="Coordonnées de contact"
                    />
                  </FormControl>
                </VStack>
              </Box>

              {/* Notes internes */}
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">📝 Notes internes</FormLabel>
                <Textarea
                  size="sm"
                  value={docForm.notes || ""}
                  onChange={(e) => setDocForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes internes (non visibles sur le document)"
                  rows={2}
                />
              </FormControl>

              {/* ========== GÉNÉRATION & IMPORT (FIN DU FORMULAIRE) ========== */}
              <Divider />
              <Heading size="sm">📄 Génération & Import du Document</Heading>

              {/* Génération depuis template */}
              <Box bg="blue.50" p={3} borderRadius="md" borderLeft="4px solid" borderColor="blue.500">
                <VStack spacing={3} align="stretch">
                  <FormLabel fontSize="sm" fontWeight="bold">🔨 Générer depuis un Template</FormLabel>
                  <FormControl>
                    <FormLabel fontSize="xs">Template HTML</FormLabel>
                    <Select
                      size="sm"
                      value={selectedTemplate?.id || ""}
                      onChange={(e) => {
                        const template = templates.find(t => t.id === e.target.value);
                        setSelectedTemplate(template || null);
                      }}
                    >
                      <option value="">-- Sélectionner un template --</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </Select>
                  </FormControl>
                  {selectedTemplate && (
                    <Button 
                      colorScheme="orange" 
                      size="sm"
                      onClick={generateFromTemplate}
                      leftIcon={<FiDownload />}
                      width="100%"
                    >
                      🔍 Générer l'aperçu & PDF
                    </Button>
                  )}
                  <Text fontSize="xs" color="gray.500">
                    💡 Remplissez tous les champs ci-dessus (Destinataire, Montant, etc.) avant de générer
                  </Text>
                </VStack>
              </Box>

              {/* Import PDF */}
              <Box bg="green.50" p={3} borderRadius="md" borderLeft="4px solid" borderColor="green.500">
                <VStack spacing={3} align="stretch">
                  <FormLabel fontSize="sm" fontWeight="bold">📥 Importer un PDF</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept=".pdf"
                      size="sm"
                      onChange={handlePdfUpload}
                    />
                  </FormControl>
                  {pdfFile && (
                    <Text fontSize="xs" color="green.600">
                      ✅ {pdfFile.name} sélectionné
                    </Text>
                  )}
                </VStack>
              </Box>

              {/* Liaisons optionnelles */}
              <HStack spacing={3}>
                <FormControl>
                  <FormLabel fontSize="sm">ID Événement (optionnel)</FormLabel>
                  <Input
                    size="sm"
                    value={docForm.eventId || ""}
                    onChange={(e) => setDocForm(prev => ({ ...prev, eventId: e.target.value }))}
                    placeholder="ID d'événement"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">ID Membre (optionnel)</FormLabel>
                  <Input
                    size="sm"
                    value={docForm.memberId || ""}
                    onChange={(e) => setDocForm(prev => ({ ...prev, memberId: e.target.value }))}
                    placeholder="ID de membre"
                  />
                </FormControl>
              </HStack>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleAdd}
                isLoading={isAdding}
              >
                {editingDocument ? "Modifier" : "Créer"}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default FinanceInvoicing;
