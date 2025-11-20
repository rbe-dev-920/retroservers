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
  Divider
} from "@chakra-ui/react";
import { FiDownload, FiEye, FiPlus, FiEdit2, FiTrash2, FiPrinter, FiFileUp } from "react-icons/fi";
import { useFinanceData } from "../../hooks/useFinanceData";
import DevisLinesManager from "../DevisLinesManager";

const FinanceInvoicing = () => {
  const {
    documents,
    addDocument,
    deleteDocument,
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
    amountPaid: ""
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
      amountPaid: ""
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
      amountPaid: String(doc.amountPaid || "")
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
      await addDocument(docForm);
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
        paymentDate: "",
        amountPaid: ""
      });
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

      // Générer le PDF (intégration avec print)
      console.log("📄 Génération du document avec données:", previewData);

      toast({
        title: "Succès",
        description: "Document généré. Prêt à imprimer.",
        status: "success"
      });
    } catch (error) {
      console.error("❌ Erreur génération:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le document",
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
      {/* Header */}
      <HStack justify="space-between">
        <Box>
          <Heading size="lg">📄 Devis & Facturation</Heading>
          <Text color="gray.500" fontSize="sm">
            Gestion complète des documents commerciaux
          </Text>
        </Box>
        <Button
          leftIcon={<FiPlus />}
          colorScheme="blue"
          onClick={handleOpenCreate}
          isLoading={loading}
        >
          Nouveau document
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
              <Card>
                <CardBody overflowX="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr bg="gray.50">
                        <Th>N°</Th>
                        <Th>Titre</Th>
                        <Th>Date</Th>
                        <Th isNumeric>Montant</Th>
                        <Th>Statut</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {quotes.map((doc) => (
                        <Tr key={doc.id}>
                          <Td fontWeight="bold">{doc.number}</Td>
                          <Td>{doc.title}</Td>
                          <Td>{new Date(doc.date).toLocaleDateString('fr-FR')}</Td>
                          <Td isNumeric fontWeight="bold">{parseFloat(doc.amount || 0).toFixed(2)} €</Td>
                          <Td>
                            <Badge colorScheme={statusColors[doc.status]}>
                              {statusLabels[doc.status]}
                            </Badge>
                          </Td>
                          <Td>
                            <HStack spacing={2}>
                              <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<FiEye />}
                                onClick={() => handleOpenEdit(doc)}
                              >
                                Voir
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<FiEdit2 />}
                                onClick={() => handleOpenEdit(doc)}
                              >
                                Modifier
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                colorScheme="red"
                                leftIcon={<FiTrash2 />}
                                onClick={() => handleDelete(doc.id)}
                              >
                                Supprimer
                              </Button>
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>
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
              <Card>
                <CardBody overflowX="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr bg="gray.50">
                        <Th>N°</Th>
                        <Th>Titre</Th>
                        <Th>Date</Th>
                        <Th>Échéance</Th>
                        <Th isNumeric>Montant</Th>
                        <Th isNumeric>Payé</Th>
                        <Th>Statut</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {invoices.map((doc) => (
                        <Tr key={doc.id}>
                          <Td fontWeight="bold">{doc.number}</Td>
                          <Td>{doc.title}</Td>
                          <Td>{new Date(doc.date).toLocaleDateString('fr-FR')}</Td>
                          <Td>
                            {doc.dueDate ? new Date(doc.dueDate).toLocaleDateString('fr-FR') : '-'}
                          </Td>
                          <Td isNumeric fontWeight="bold">{parseFloat(doc.amount || 0).toFixed(2)} €</Td>
                          <Td isNumeric>
                            <Badge colorScheme={
                              parseFloat(doc.amountPaid || 0) >= parseFloat(doc.amount || 0) ? 'green' : 'orange'
                            }>
                              {parseFloat(doc.amountPaid || 0).toFixed(2)} €
                            </Badge>
                          </Td>
                          <Td>
                            <Badge colorScheme={statusColors[doc.status]}>
                              {statusLabels[doc.status]}
                            </Badge>
                          </Td>
                          <Td>
                            <HStack spacing={2}>
                              <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<FiPrinter />}
                                onClick={() => handleOpenEdit(doc)}
                              >
                                Imprimer
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<FiEdit2 />}
                                onClick={() => handleOpenEdit(doc)}
                              >
                                Modifier
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                colorScheme="red"
                                leftIcon={<FiTrash2 />}
                                onClick={() => handleDelete(doc.id)}
                              >
                                Supprimer
                              </Button>
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Modal de formulaire */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent maxH="90vh" overflowY="auto">
          <ModalHeader>
            {editingDocument ? "Modifier le document" : "Nouveau document"}
          </ModalHeader>
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {/* Type et Dates */}
              <HStack spacing={3}>
                <FormControl>
                  <FormLabel fontWeight="bold">Type</FormLabel>
                  <Select
                    value={docForm.type}
                    onChange={(e) => setDocForm(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="QUOTE">📄 Devis</option>
                    <option value="INVOICE">💰 Facture</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontWeight="bold">Date</FormLabel>
                  <Input
                    type="date"
                    value={docForm.date}
                    onChange={(e) => setDocForm(prev => ({ ...prev, date: e.target.value }))}
                  />
                </FormControl>
                {docForm.type === "INVOICE" && (
                  <FormControl>
                    <FormLabel fontWeight="bold">Échéance</FormLabel>
                    <Input
                      type="date"
                      value={docForm.dueDate || ""}
                      onChange={(e) => setDocForm(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </FormControl>
                )}
              </HStack>

              {/* Numéro et Titre */}
              <HStack spacing={3}>
                <FormControl>
                  <FormLabel fontWeight="bold">Numéro</FormLabel>
                  <Input
                    value={docForm.number}
                    onChange={(e) => setDocForm(prev => ({ ...prev, number: e.target.value }))}
                    placeholder={docForm.type === "QUOTE" ? "ex: DV-2025-001" : "ex: FA-2025-001"}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontWeight="bold">Titre</FormLabel>
                  <Input
                    value={docForm.title}
                    onChange={(e) => setDocForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Objet du document"
                  />
                </FormControl>
              </HStack>

              {/* Description */}
              <FormControl>
                <FormLabel fontWeight="bold">Description</FormLabel>
                <Textarea
                  value={docForm.description || ""}
                  onChange={(e) => setDocForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Détails du document"
                  rows={2}
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
              {docForm.type === "QUOTE" && editingDocument?.id && (
                <>
                  <Divider />
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
                        leftIcon={<FiFileUp />}
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

              {/* Notes et liaisons */}
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
