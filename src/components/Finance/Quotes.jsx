import React, { useState } from "react";
import {
  Box, VStack, HStack, Card, CardHeader, CardBody,
  Heading, Text, Button, Badge, Icon, SimpleGrid, useToast,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalFooter, FormControl, FormLabel, Input, Select, useDisclosure,
  Table, Thead, Tbody, Tr, Th, Td
} from "@chakra-ui/react";
import { FiDownload, FiEye, FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import { useFinanceData } from "../../hooks/useFinanceData";

const FinanceQuotes = () => {
  const {
    documents,
    addDocument,
    deleteDocument,
    loading
  } = useFinanceData();

  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
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
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleAdd = async () => {
    if (!formData.number || !formData.amount) {
      toast({
        title: "Erreur",
        description: "Remplissez les champs obligatoires",
        status: "error"
      });
      return;
    }

    setIsAdding(true);
    try {
      await addDocument(formData);
      setFormData({
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
      onClose();
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Confirmer la suppression ?")) {
      await deleteDocument(id);
    }
  };

  const statusColors = {
    "DRAFT": "gray",
    "SENT": "blue",
    "ACCEPTED": "green",
    "REJECTED": "red",
    "INVOICED": "purple"
  };

  const statusLabels = {
    "DRAFT": "Brouillon",
    "SENT": "Envoyé",
    "ACCEPTED": "Accepté",
    "REJECTED": "Refusé",
    "INVOICED": "Facturé"
  };

  return (
    <VStack align="stretch" spacing={6}>
      {/* Header */}
      <HStack justify="space-between">
        <Box>
          <Heading size="lg">Devis & Factures</Heading>
          <Text color="gray.500" fontSize="sm">
            Gestion des documents commerciaux
          </Text>
        </Box>
        <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={onOpen} isLoading={loading}>
          Nouveau document
        </Button>
      </HStack>

      {/* Vue en grille (petits écrans) */}
      <SimpleGrid columns={[1, 2, 3]} spacing={6} display={{ base: "grid", md: "none" }}>
        {(documents || []).map(doc => (
          <Card key={doc.id}>
            <CardBody>
              <HStack justify="space-between" mb={4}>
                <Heading size="sm">{doc.number}</Heading>
                <Badge colorScheme={statusColors[doc.status] || "gray"}>
                  {statusLabels[doc.status] || doc.status}
                </Badge>
              </HStack>
              <Text color="gray.600" mb={2}>{doc.title}</Text>
              <Text fontSize="2xl" fontWeight="bold" color="blue.500" mb={4}>
                {parseFloat(doc.amount).toFixed(2)} €
              </Text>
              <Text fontSize="xs" color="gray.400" mb={4}>
                {new Date(doc.date).toLocaleDateString()}
              </Text>
              <HStack spacing={2} pt={4} borderTop="1px" borderColor="gray.200">
                <Button size="sm" variant="ghost" leftIcon={<FiEye />}>
                  Voir
                </Button>
                <Button size="sm" variant="ghost" leftIcon={<FiDownload />}>
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  leftIcon={<FiTrash2 />}
                  onClick={() => handleDelete(doc.id)}
                >
                  Suppr.
                </Button>
              </HStack>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      {/* Vue en tableau (grands écrans) */}
      <Card display={{ base: "none", md: "block" }} overflowX="auto">
        <CardBody p={0}>
          <Table variant="simple">
            <Thead>
              <Tr bg="gray.50">
                <Th>Numéro</Th>
                <Th>Titre</Th>
                <Th isNumeric>Montant</Th>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Statut</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {(documents || []).length > 0 ? (
                documents.map(doc => (
                  <Tr key={doc.id} _hover={{ bg: "gray.50" }}>
                    <Td fontWeight="600">{doc.number}</Td>
                    <Td>{doc.title}</Td>
                    <Td isNumeric fontWeight="600">{parseFloat(doc.amount).toFixed(2)} €</Td>
                    <Td>{new Date(doc.date).toLocaleDateString()}</Td>
                    <Td>
                      <Badge colorScheme={doc.type === "QUOTE" ? "blue" : "green"}>
                        {doc.type === "QUOTE" ? "Devis" : "Facture"}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge colorScheme={statusColors[doc.status] || "gray"}>
                        {statusLabels[doc.status] || doc.status}
                      </Badge>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <Button size="sm" variant="ghost" leftIcon={<FiEye />}>
                          Voir
                        </Button>
                        <Button size="sm" variant="ghost" leftIcon={<FiDownload />}>
                          PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          leftIcon={<FiTrash2 />}
                          onClick={() => handleDelete(doc.id)}
                        >
                        </Button>
                      </HStack>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={7} textAlign="center" py={8} color="gray.500">
                    Aucun document trouvé
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </CardBody>
      </Card>

      {/* Modal Nouveau Document */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nouveau Document</ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Type</FormLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="QUOTE">Devis</option>
                  <option value="INVOICE">Facture</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Numéro</FormLabel>
                <Input
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  placeholder="DV-2025-001"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Titre</FormLabel>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Montant HT (€)</FormLabel>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amountExcludingTax}
                  onChange={(e) => {
                    const amount = parseFloat(e.target.value) || 0;
                    const taxAmount = amount * (formData.taxRate / 100);
                    setFormData({
                      ...formData,
                      amountExcludingTax: e.target.value,
                      taxAmount: taxAmount,
                      amount: (amount + taxAmount).toString()
                    });
                  }}
                />
              </FormControl>
              <FormControl>
                <FormLabel>TVA (%)</FormLabel>
                <Select
                  value={formData.taxRate}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value);
                    const amount = parseFloat(formData.amountExcludingTax) || 0;
                    const taxAmount = amount * (rate / 100);
                    setFormData({
                      ...formData,
                      taxRate: rate,
                      taxAmount: taxAmount,
                      amount: (amount + taxAmount).toString()
                    });
                  }}
                >
                  <option value={0}>0%</option>
                  <option value={5.5}>5.5%</option>
                  <option value={20}>20%</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Montant TTC (€)</FormLabel>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  readOnly
                  disabled
                />
              </FormControl>
              <FormControl>
                <FormLabel>Date</FormLabel>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Statut</FormLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="DRAFT">Brouillon</option>
                  <option value="SENT">Envoyé</option>
                  <option value="ACCEPTED">Accepté</option>
                  <option value="REJECTED">Refusé</option>
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Annuler
            </Button>
            <Button colorScheme="blue" onClick={handleAdd} isLoading={isAdding}>
              Créer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default FinanceQuotes;
