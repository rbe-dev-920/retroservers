import React, { useState } from "react";
import {
  Box, VStack, HStack, Card, CardHeader, CardBody,
  Heading, Text, Button, Badge, useToast, Icon, Table, Thead, Tbody,
  Tr, Th, Td, Alert, AlertIcon, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalFooter, FormControl, FormLabel, Input,
  Select, useDisclosure
} from "@chakra-ui/react";
import { FiCheck, FiX, FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import { useFinanceData } from "../../hooks/useFinanceData";

const FinanceScheduledOps = () => {
  const {
    scheduledOperations,
    setScheduledOperations,
    loading
  } = useFinanceData();

  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    type: "SCHEDULED_PAYMENT",
    amount: "",
    description: "",
    frequency: "MONTHLY",
    nextDate: new Date().toISOString().split("T")[0],
    totalAmount: ""
  });
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleAdd = async () => {
    if (!formData.amount || !formData.description) {
      toast({
        title: "Erreur",
        description: "Remplissez tous les champs",
        status: "error"
      });
      return;
    }

    setIsAdding(true);
    try {
      // Simuler l'ajout local (API à intégrer)
      const newOp = {
        id: Math.random(),
        ...formData,
        amount: parseFloat(formData.amount),
        totalAmount: parseFloat(formData.totalAmount) || parseFloat(formData.amount),
        status: "PENDING"
      };
      setScheduledOperations([...scheduledOperations, newOp]);
      toast({
        title: "Succès",
        description: "Opération programmée créée",
        status: "success"
      });
      setFormData({
        type: "SCHEDULED_PAYMENT",
        amount: "",
        description: "",
        frequency: "MONTHLY",
        nextDate: new Date().toISOString().split("T")[0],
        totalAmount: ""
      });
      onClose();
    } finally {
      setIsAdding(false);
    }
  };

  const handleValidate = async (id) => {
    setScheduledOperations(
      scheduledOperations.map(op =>
        op.id === id ? { ...op, status: "APPROVED" } : op
      )
    );
    toast({ title: "Opération validée", status: "success" });
  };

  const handleReject = async (id) => {
    setScheduledOperations(
      scheduledOperations.filter(op => op.id !== id)
    );
    toast({ title: "Opération rejetée", status: "warning" });
  };

  const pendingCount = (scheduledOperations || []).filter(op => op.status === "PENDING").length;

  return (
    <VStack align="stretch" spacing={6}>
      {/* Header */}
      <HStack justify="space-between">
        <Box>
          <Heading size="lg">Opérations planifiées</Heading>
          <Text color="gray.500" fontSize="sm">
            Gestion des paiements récurrents et planifiés
          </Text>
        </Box>
        <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={onOpen} isLoading={loading}>
          Nouvelle opération
        </Button>
      </HStack>

      {/* Alerte si opérations en attente */}
      {pendingCount > 0 && (
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">
              {pendingCount} opération{pendingCount > 1 ? "s" : ""} en attente de validation
            </Text>
          </Box>
        </Alert>
      )}

      {/* Tableau des opérations */}
      <Card overflowX="auto">
        <CardBody p={0}>
          <Table variant="simple">
            <Thead>
              <Tr bg="gray.50">
                <Th>Description</Th>
                <Th>Fréquence</Th>
                <Th isNumeric>Montant</Th>
                <Th>Prochaine date</Th>
                <Th>Statut</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {(scheduledOperations || []).length > 0 ? (
                scheduledOperations.map(op => (
                  <Tr key={op.id} _hover={{ bg: "gray.50" }}>
                    <Td fontWeight="500">{op.description}</Td>
                    <Td>{op.frequency}</Td>
                    <Td isNumeric fontWeight="600">{parseFloat(op.amount).toFixed(2)} €</Td>
                    <Td>{new Date(op.nextDate).toLocaleDateString()}</Td>
                    <Td>
                      <Badge
                        colorScheme={op.status === "APPROVED" ? "green" : op.status === "PENDING" ? "yellow" : "gray"}
                      >
                        {op.status === "APPROVED" ? "Approuvée" : op.status === "PENDING" ? "En attente" : "Rejetée"}
                      </Badge>
                    </Td>
                    <Td>
                      {op.status === "PENDING" && (
                        <HStack spacing={2}>
                          <Button
                            size="sm"
                            variant="ghost"
                            colorScheme="green"
                            onClick={() => handleValidate(op.id)}
                            leftIcon={<FiCheck />}
                          >
                            Valider
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleReject(op.id)}
                            leftIcon={<FiX />}
                          >
                            Rejeter
                          </Button>
                        </HStack>
                      )}
                      {op.status === "APPROVED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => handleReject(op.id)}
                          leftIcon={<FiTrash2 />}
                        >
                          Supprimer
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={6} textAlign="center" py={8} color="gray.500">
                    Aucune opération programmée
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </CardBody>
      </Card>

      {/* Modal Nouvelle Opération */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nouvelle Opération Programmée</ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Type</FormLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="SCHEDULED_PAYMENT">Paiement programmé</option>
                  <option value="RECURRING">Opération récurrente</option>
                  <option value="INVOICE">Facture programmée</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Montant (€)</FormLabel>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Fréquence</FormLabel>
                <Select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                >
                  <option value="MONTHLY">Mensuel</option>
                  <option value="QUARTERLY">Trimestriel</option>
                  <option value="SEMI_ANNUAL">Semestriel</option>
                  <option value="ANNUAL">Annuel</option>
                  <option value="ONCE">Une seule fois</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Prochaine date</FormLabel>
                <Input
                  type="date"
                  value={formData.nextDate}
                  onChange={(e) => setFormData({ ...formData, nextDate: e.target.value })}
                />
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

export default FinanceScheduledOps;
