import React, { useState } from "react";
import {
  Box, VStack, HStack, Card, CardHeader, CardBody,
  Heading, Text, Button, Input, Switch, FormControl,
  FormLabel, useToast, Alert, AlertIcon, Divider,
  Table, Thead, Tbody, Tr, Th, Td, Badge
} from "@chakra-ui/react";
import { FiSave, FiLock } from "react-icons/fi";
import { useFinanceData } from "../../hooks/useFinanceData";

const FinanceSettings = () => {
  const {
    balance,
    setBalance,
    isBalanceLocked,
    setIsBalanceLocked
  } = useFinanceData();

  const [newBalance, setNewBalance] = useState(balance);
  const [isSaving, setIsSaving] = useState(false);
  const [auditLog, setAuditLog] = useState([
    {
      id: 1,
      timestamp: new Date(Date.now() - 86400000).toLocaleString(),
      user: "Admin",
      action: "Modification solde",
      oldValue: "12000.00",
      newValue: "12450.50",
      reason: "Correction suite audit"
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 172800000).toLocaleString(),
      user: "Trésorier",
      action: "Synchronisation",
      oldValue: "12450.50",
      newValue: "12450.50",
      reason: "Sync avec banque"
    }
  ]);

  const toast = useToast();

  const handleSaveBalance = async () => {
    if (newBalance === balance) {
      toast({
        title: "Aucune modification",
        status: "info"
      });
      return;
    }

    setIsSaving(true);
    try {
      // Simuler l'API
      const oldBalance = balance;
      setBalance(parseFloat(newBalance));
      
      // Ajouter à l'historique d'audit
      setAuditLog([
        {
          id: auditLog.length + 1,
          timestamp: new Date().toLocaleString(),
          user: localStorage.getItem('userName') || "Utilisateur",
          action: "Modification solde",
          oldValue: oldBalance.toFixed(2),
          newValue: newBalance,
          reason: "Mise à jour manuelle"
        },
        ...auditLog
      ]);

      toast({
        title: "Succès",
        description: "Solde mis à jour",
        status: "success"
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: error.message,
        status: "error"
      });
      setNewBalance(balance);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleLock = () => {
    setIsBalanceLocked(!isBalanceLocked);
    toast({
      title: isBalanceLocked ? "Déverrouillé" : "Verrouillé",
      description: `Le solde est ${!isBalanceLocked ? "maintenant " : ""}verrouillé`,
      status: "success"
    });
  };

  return (
    <VStack align="stretch" spacing={6}>
      {/* Header */}
      <Box>
        <Heading size="lg">Paramètres Finances</Heading>
        <Text color="gray.500" fontSize="sm">
          Configuration et gestion du solde
        </Text>
      </Box>

      {/* Gestion du solde */}
      <Card>
        <CardHeader>
          <HStack justify="space-between">
            <Heading size="md">Gestion du Solde</Heading>
            <Button
              leftIcon={<FiLock />}
              size="sm"
              variant={isBalanceLocked ? "solid" : "outline"}
              colorScheme={isBalanceLocked ? "red" : "gray"}
              onClick={handleToggleLock}
            >
              {isBalanceLocked ? "Verrouillé" : "Déverrouillé"}
            </Button>
          </HStack>
        </CardHeader>
        <CardBody>
          <VStack align="stretch" spacing={4}>
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Box>
                <Text fontSize="sm">
                  Le solde est <strong>{isBalanceLocked ? "verrouillé" : "déverrouillé"}</strong>. 
                  Les modifications {isBalanceLocked ? "ne " : ""}seront enregistrées dans l'historique d'audit.
                </Text>
              </Box>
            </Alert>

            <FormControl>
              <FormLabel>Solde actuel</FormLabel>
              <Input
                type="number"
                step="0.01"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                isDisabled={isBalanceLocked}
                fontSize="lg"
                fontWeight="bold"
                color="blue.500"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Raison de la modification (optionnel)</FormLabel>
              <Input
                placeholder="Ex: Correction suite audit, Synchronisation manuelle..."
                isDisabled={isBalanceLocked}
              />
            </FormControl>

            <Button
              leftIcon={<FiSave />}
              colorScheme="blue"
              onClick={handleSaveBalance}
              isLoading={isSaving}
              isDisabled={isBalanceLocked}
              w="100%"
            >
              Enregistrer le solde
            </Button>
          </VStack>
        </CardBody>
      </Card>

      <Divider />

      {/* Paramètres généraux */}
      <Card>
        <CardHeader>
          <Heading size="md">Paramètres Généraux</Heading>
        </CardHeader>
        <CardBody>
          <VStack align="stretch" spacing={4}>
            <FormControl display="flex" alignItems="center" justifyContent="space-between">
              <FormLabel mb={0}>Activer les notifications de solde bas</FormLabel>
              <Switch defaultChecked={true} />
            </FormControl>

            <FormControl display="flex" alignItems="center" justifyContent="space-between">
              <FormLabel mb={0}>Afficher les graphiques mensuels</FormLabel>
              <Switch defaultChecked={true} />
            </FormControl>

            <FormControl display="flex" alignItems="center" justifyContent="space-between">
              <FormLabel mb={0}>Exporter automatiquement les rapports</FormLabel>
              <Switch defaultChecked={false} />
            </FormControl>

            <FormControl display="flex" alignItems="center" justifyContent="space-between">
              <FormLabel mb={0}>Mode strict (validation obligatoire)</FormLabel>
              <Switch defaultChecked={false} />
            </FormControl>
          </VStack>
        </CardBody>
      </Card>

      <Divider />

      {/* Historique d'audit */}
      <Card>
        <CardHeader>
          <Heading size="md">Historique d'Audit du Solde</Heading>
        </CardHeader>
        <CardBody overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead>
              <Tr bg="gray.50">
                <Th>Date/Heure</Th>
                <Th>Utilisateur</Th>
                <Th>Action</Th>
                <Th>Ancien solde</Th>
                <Th>Nouveau solde</Th>
                <Th>Raison</Th>
              </Tr>
            </Thead>
            <Tbody>
              {auditLog.map(entry => (
                <Tr key={entry.id} _hover={{ bg: "gray.50" }}>
                  <Td fontSize="xs">{entry.timestamp}</Td>
                  <Td fontWeight="500">{entry.user}</Td>
                  <Td>
                    <Badge colorScheme="blue">{entry.action}</Badge>
                  </Td>
                  <Td isNumeric fontSize="sm">{entry.oldValue} €</Td>
                  <Td isNumeric fontSize="sm" fontWeight="600">{entry.newValue} €</Td>
                  <Td fontSize="sm" color="gray.600">{entry.reason}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardBody>
      </Card>

      {/* Catégories personnalisées */}
      <Card>
        <CardHeader>
          <Heading size="md">Catégories de Transactions</Heading>
        </CardHeader>
        <CardBody>
          <VStack align="stretch" spacing={2}>
            {["ADHESION", "DONATION", "TRANSPORT", "MAINTENANCE", "FOURNITURES"].map(cat => (
              <HStack key={cat} justify="space-between" p={2} borderRadius="md" bg="gray.50">
                <Text fontWeight="500">{cat}</Text>
                <Badge colorScheme="gray">Active</Badge>
              </HStack>
            ))}
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
};

export default FinanceSettings;
