import React, { useState, useEffect } from "react";
import {
  Box, VStack, HStack, Card, CardHeader, CardBody,
  Heading, Text, Button, Badge, SimpleGrid, useToast,
  Alert, AlertIcon, Spinner, IconButton, Progress,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, FormControl, FormLabel, Input, Select,
  NumberInput, NumberInputField, NumberInputStepper,
  NumberIncrementStepper, NumberDecrementStepper, Textarea, useDisclosure
} from "@chakra-ui/react";
import { FiPlus, FiTrash2, FiCheck, FiEye } from "react-icons/fi";

const ScheduledTab = () => {
  const [scheduledOperations, setScheduledOperations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newScheduled, setNewScheduled] = useState({
    type: "SCHEDULED_PAYMENT",
    amount: "",
    description: "",
    frequency: "MONTHLY",
    nextDate: new Date().toISOString().split("T")[0],
    totalAmount: ""
  });
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentHistory, setPaymentHistory] = useState([]);

  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isPaymentOpen, onOpen: onPaymentOpen, onClose: onPaymentClose } = useDisclosure();
  const { isOpen: isHistoryOpen, onOpen: onHistoryOpen, onClose: onHistoryClose } = useDisclosure();

  useEffect(() => {
    loadScheduledOperations();
  }, []);

  const loadScheduledOperations = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/scheduled-operations`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setScheduledOperations(Array.isArray(data) ? data : data.scheduledOperations || []);
      }
    } catch (e) {
      console.error("Erreur chargement échéanciers:", e);
      toast({ status: "error", title: "Erreur", description: "Impossible de charger les échéanciers" });
    }
    setLoading(false);
  };

  const handleAddScheduledOperation = async () => {
    if (!newScheduled.amount || !newScheduled.description) {
      toast({ status: "error", title: "Erreur", description: "Remplissez les champs obligatoires" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/scheduled-operations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify(newScheduled)
        }
      );
      if (response.ok) {
        toast({ status: "success", title: "Créé", description: "Échéancier créé avec succès" });
        setNewScheduled({
          type: "SCHEDULED_PAYMENT",
          amount: "",
          description: "",
          frequency: "MONTHLY",
          nextDate: new Date().toISOString().split("T")[0],
          totalAmount: ""
        });
        loadScheduledOperations();
        onClose();
      } else {
        toast({ status: "error", title: "Erreur", description: "Impossible de créer l'échéancier" });
      }
    } catch (e) {
      console.error("Erreur création échéancier:", e);
      toast({ status: "error", title: "Erreur", description: e.message });
    }
    setLoading(false);
  };

  const deleteScheduledOperation = async (id) => {
    if (!window.confirm("Supprimer cet échéancier?")) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/scheduled-operations/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        }
      );
      if (response.ok) {
        toast({ status: "success", title: "Supprimé" });
        loadScheduledOperations();
      }
    } catch (e) {
      console.error("Erreur suppression:", e);
    }
    setLoading(false);
  };

  const openDeclarePayment = async (op) => {
    setSelectedOperation(op);
    setPaymentAmount(op.amount || "");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    onPaymentOpen();
  };

  const handleDeclarePayment = async () => {
    if (!paymentAmount) {
      toast({ status: "error", title: "Erreur", description: "Entrez un montant" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/scheduled-operations/${selectedOperation.id}/payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({
            amount: parseFloat(paymentAmount),
            date: paymentDate
          })
        }
      );
      if (response.ok) {
        toast({ status: "success", title: "Paiement déclaré" });
        loadScheduledOperations();
        onPaymentClose();
      }
    } catch (e) {
      console.error("Erreur déclaration paiement:", e);
      toast({ status: "error", title: "Erreur", description: e.message });
    }
    setLoading(false);
  };

  const openPaymentsList = async (op) => {
    setSelectedOperation(op);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/scheduled-operations/${op.id}/payments`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setPaymentHistory(Array.isArray(data) ? data : data.payments || []);
        onHistoryOpen();
      }
    } catch (e) {
      console.error("Erreur chargement paiements:", e);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2
    }).format(val);
  };

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("fr-FR");
  };

  // Filtrer les opérations programmées de type MONTHLY
  const monthlySchedules = scheduledOperations.filter(
    (op) => op.type === "SCHEDULED_PAYMENT" && op.frequency === "MONTHLY"
  );

  return (
    <VStack spacing={4} align="stretch">
      <HStack justify="space-between">
        <Heading size="md">⏰ Échéanciers (Mensualités)</Heading>
        <Button leftIcon={<FiPlus />} colorScheme="purple" size="sm" onClick={onOpen}>
          Nouvel échéancier
        </Button>
      </HStack>

      {loading && !monthlySchedules.length ? (
        <Box textAlign="center" p={8}>
          <Spinner size="lg" />
          <Text mt={2}>Chargement...</Text>
        </Box>
      ) : monthlySchedules.length === 0 ? (
        <Alert status="info">
          <AlertIcon />
          Aucun échéancier (mensualités) enregistré
        </Alert>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
          {monthlySchedules.map((op) => (
            <Card key={op.id}>
              <CardHeader>
                <VStack align="start" spacing={1}>
                  <Heading size="sm" noOfLines={2}>
                    {op.description}
                  </Heading>
                  <HStack>
                    <Badge variant="outline">Mensuel</Badge>
                    <Badge colorScheme="red">DÉPENSE</Badge>
                  </HStack>
                </VStack>
              </CardHeader>
              <CardBody>
                <VStack align="start" spacing={3}>
                  <Box width="100%">
                    <HStack justify="space-between" mb={2}>
                      <Text fontSize="sm" color="gray.600">
                        Prochaine date
                      </Text>
                      <Text fontWeight="medium">{formatDate(op.nextDate)}</Text>
                    </HStack>
                    <HStack justify="space-between" mb={2}>
                      <Text fontSize="sm" color="gray.600">
                        Mensualité
                      </Text>
                      <Text fontWeight="bold" color="red.600">
                        -{formatCurrency(Math.abs(op.amount))}
                      </Text>
                    </HStack>
                    <HStack spacing={2} wrap="wrap">
                      <Badge variant="subtle" colorScheme="blue">
                        Payées: {op.paymentsCount ?? 0}
                      </Badge>
                      {op.totalAmount && (
                        <Badge variant="subtle">
                          Restant: {formatCurrency(op.remainingTotalAmount || 0)}
                        </Badge>
                      )}
                    </HStack>
                    {op.monthsRemainingTotal && (
                      <Text fontSize="xs" color="gray.600" mt={2}>
                        Mensualités restantes: {op.monthsRemainingTotal}
                      </Text>
                    )}
                    {op.estimatedEndDate && (
                      <Text fontSize="xs" color="gray.600">
                        Fin estimée: {formatDate(op.estimatedEndDate)}
                      </Text>
                    )}
                  </Box>
                </VStack>
              </CardBody>
              <CardBody pt={0}>
                <HStack spacing={2}>
                  <Button size="sm" onClick={() => openDeclarePayment(op)}>
                    <FiCheck /> Déclarer payé
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openPaymentsList(op)}>
                    <FiEye /> Paiements
                  </Button>
                  <IconButton
                    aria-label="Supprimer"
                    icon={<FiTrash2 />}
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    onClick={() => deleteScheduledOperation(op.id)}
                  />
                </HStack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* Modal Nouvel Échéancier */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nouvel Échéancier</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Description (ex: "Loyer")</FormLabel>
                <Input
                  value={newScheduled.description}
                  onChange={(e) =>
                    setNewScheduled((prev) => ({
                      ...prev,
                      description: e.target.value
                    }))
                  }
                  placeholder="Description de la dépense"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Mensualité (€ / mois)</FormLabel>
                <NumberInput
                  value={newScheduled.amount}
                  onChange={(value) =>
                    setNewScheduled((prev) => ({ ...prev, amount: value }))
                  }
                  precision={2}
                  step={0.01}
                >
                  <NumberInputField placeholder="Ex: 500.00" />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl>
                <FormLabel>Prochaine exécution</FormLabel>
                <Input
                  type="date"
                  value={newScheduled.nextDate}
                  onChange={(e) =>
                    setNewScheduled((prev) => ({
                      ...prev,
                      nextDate: e.target.value
                    }))
                  }
                />
              </FormControl>

              <FormControl>
                <FormLabel>Montant total à amortir (optionnel)</FormLabel>
                <NumberInput
                  value={newScheduled.totalAmount}
                  onChange={(value) =>
                    setNewScheduled((prev) => ({
                      ...prev,
                      totalAmount: value
                    }))
                  }
                  precision={2}
                  step={0.01}
                >
                  <NumberInputField placeholder="Ex: 4000.00" />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Annuler
            </Button>
            <Button colorScheme="purple" onClick={handleAddScheduledOperation} isLoading={loading}>
              Créer l'échéancier
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Déclarer Paiement */}
      <Modal isOpen={isPaymentOpen} onClose={onPaymentClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Déclarer un paiement</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedOperation && (
              <VStack spacing={4}>
                <Alert status="info">
                  <AlertIcon />
                  <Text fontSize="sm">Paiement pour: {selectedOperation.description}</Text>
                </Alert>
                <FormControl isRequired>
                  <FormLabel>Montant payé</FormLabel>
                  <NumberInput
                    value={paymentAmount}
                    onChange={(value) => setPaymentAmount(value)}
                    precision={2}
                  >
                    <NumberInputField placeholder="Montant" />
                  </NumberInput>
                </FormControl>
                <FormControl>
                  <FormLabel>Date du paiement</FormLabel>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onPaymentClose}>
              Annuler
            </Button>
            <Button colorScheme="green" onClick={handleDeclarePayment} isLoading={loading}>
              Déclarer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Historique Paiements */}
      <Modal isOpen={isHistoryOpen} onClose={onHistoryClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Historique des paiements</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {paymentHistory.length === 0 ? (
              <Alert status="info">
                <AlertIcon />
                Aucun paiement déclaré
              </Alert>
            ) : (
              <VStack align="stretch" spacing={2}>
                {paymentHistory.map((payment, idx) => (
                  <Card key={idx}>
                    <CardBody>
                      <HStack justify="space-between">
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="bold">{formatDate(payment.date)}</Text>
                          <Text fontSize="sm" color="gray.600">
                            {payment.description}
                          </Text>
                        </VStack>
                        <Text fontWeight="bold" color="green.600">
                          +{formatCurrency(payment.amount)}
                        </Text>
                      </HStack>
                    </CardBody>
                  </Card>
                ))}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onHistoryClose}>Fermer</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default ScheduledTab;
