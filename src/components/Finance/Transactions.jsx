import React, { useState } from "react";
import {
  Box, VStack, HStack, Card, CardHeader, CardBody,
  Heading, Text, Button, Input, Select, Table, Thead, Tbody,
  Tr, Th, Td, Badge, useDisclosure, Icon, Flex, InputGroup,
  InputLeftElement, useToast, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalFooter, FormControl, FormLabel
} from "@chakra-ui/react";
import { FiPlus, FiSearch, FiEdit2, FiTrash2 } from "react-icons/fi";
import { useFinanceData } from "../../hooks/useFinanceData";

const FinanceTransactions = () => {
  const {
    transactions,
    addTransaction,
    deleteTransaction,
    loading
  } = useFinanceData();

  const [filterCategory, setFilterCategory] = useState("Tous");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    type: "CREDIT",
    amount: "",
    description: "",
    category: "ADHESION",
    date: new Date().toISOString().split("T")[0]
  });
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const categories = ["Tous", "ADHESION", "DONATION", "TRANSPORT", "MAINTENANCE", "FOURNITURES"];

  const filteredTransactions = (transactions || []).filter(t => {
    const matchesSearch = (t.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "Tous" || t.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

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
      await addTransaction(formData);
      setFormData({
        type: "CREDIT",
        amount: "",
        description: "",
        category: "ADHESION",
        date: new Date().toISOString().split("T")[0]
      });
      onClose();
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Confirmer la suppression ?")) {
      await deleteTransaction(id);
    }
  };

  return (
    <VStack align="stretch" spacing={6}>
      {/* Header */}
      <HStack justify="space-between">
        <Box>
          <Heading size="lg">Transactions</Heading>
          <Text color="gray.500" fontSize="sm">
            Historique des mouvements financiers
          </Text>
        </Box>
        <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={onOpen} isLoading={loading}>
          Nouvelle transaction
        </Button>
      </HStack>

      {/* Filtres */}
      <Card>
        <CardBody>
          <HStack spacing={4}>
            <InputGroup flex={1}>
              <InputLeftElement pointerEvents="none">
                <Icon as={FiSearch} color="gray.300" />
              </InputLeftElement>
              <Input
                placeholder="Rechercher une transaction..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>
            <Select
              w="200px"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>
          </HStack>
        </CardBody>
      </Card>

      {/* Tableau des transactions */}
      <Card overflowX="auto">
        <CardBody p={0}>
          <Table variant="simple">
            <Thead>
              <Tr bg="gray.50">
                <Th>Date</Th>
                <Th>Description</Th>
                <Th>Catégorie</Th>
                <Th isNumeric>Montant</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map(t => (
                  <Tr key={t.id} _hover={{ bg: "gray.50" }}>
                    <Td>{new Date(t.date).toLocaleDateString()}</Td>
                    <Td fontWeight="500">{t.description}</Td>
                    <Td>{t.category}</Td>
                    <Td isNumeric fontWeight="600" color={t.type === "CREDIT" ? "green.500" : "red.500"}>
                      {t.type === "CREDIT" ? "+" : "-"}{Math.abs(t.amount).toFixed(2)} €
                    </Td>
                    <Td>
                      <Button
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Icon as={FiTrash2} />
                      </Button>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={5} textAlign="center" py={8} color="gray.500">
                    Aucune transaction trouvée
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </CardBody>
      </Card>

      {/* Modal Nouvelle Transaction */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nouvelle Transaction</ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Type</FormLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="CREDIT">Crédit (Entrée)</option>
                  <option value="DEBIT">Débit (Sortie)</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Montant (€)</FormLabel>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Catégorie</FormLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="ADHESION">Adhésion</option>
                  <option value="DONATION">Donation</option>
                  <option value="TRANSPORT">Transport</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="FOURNITURES">Fournitures</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Date</FormLabel>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
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

export default FinanceTransactions;
