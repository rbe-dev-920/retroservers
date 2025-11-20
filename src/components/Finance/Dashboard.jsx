import React from "react";
import {
  Box, VStack, HStack, Card, CardBody, CardHeader,
  Heading, Text, Stat, StatLabel, StatNumber, StatHelpText,
  Grid, GridItem, useColorModeValue, SimpleGrid, Icon
} from "@chakra-ui/react";
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiCalendar } from "react-icons/fi";
import { useFinanceData } from "../../hooks/useFinanceData";

const FinanceDashboard = () => {
  const { stats, balance, transactions, scheduledOperations, loading } = useFinanceData();

  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  // Calculer les statistiques
  const totalCredits = transactions
    ?.filter(t => t.type === "CREDIT")
    .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

  const totalDebits = transactions
    ?.filter(t => t.type === "DEBIT")
    .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyTransactions = transactions?.filter(t => {
    const tDate = new Date(t.date);
    return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
  }) || [];

  const monthlyBalance = monthlyTransactions
    .filter(t => t.type === "CREDIT")
    .reduce((sum, t) => sum + (t.amount || 0), 0) -
    monthlyTransactions
      .filter(t => t.type === "DEBIT")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

  const scheduledMonthlyImpact = (scheduledOperations || [])
    .reduce((sum, op) => sum + (op.amount || 0), 0);

  return (
    <VStack align="stretch" spacing={6}>
      {/* Header */}
      <Box>
        <Heading size="lg">Tableau de Bord Finances</Heading>
        <Text color="gray.500" fontSize="sm">
          Vue d'ensemble de votre trésorerie
        </Text>
      </Box>

      {/* Statistiques principales */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        {/* Solde */}
        <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
          <CardBody>
            <Stat>
              <StatLabel>Solde actuel</StatLabel>
              <StatNumber fontSize="2xl" color="blue.500">
                {balance.toFixed(2)} €
              </StatNumber>
              <StatHelpText>Trésorerie générale</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        {/* Crédits */}
        <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
          <CardBody>
            <HStack spacing={3} mb={2}>
              <Icon as={FiTrendingUp} color="green.500" boxSize={5} />
              <Box>
                <Stat>
                  <StatLabel>Crédits</StatLabel>
                  <StatNumber fontSize="xl" color="green.500">
                    +{totalCredits.toFixed(2)} €
                  </StatNumber>
                </Stat>
              </Box>
            </HStack>
          </CardBody>
        </Card>

        {/* Débits */}
        <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
          <CardBody>
            <HStack spacing={3} mb={2}>
              <Icon as={FiTrendingDown} color="red.500" boxSize={5} />
              <Box>
                <Stat>
                  <StatLabel>Débits</StatLabel>
                  <StatNumber fontSize="xl" color="red.500">
                    -{Math.abs(totalDebits).toFixed(2)} €
                  </StatNumber>
                </Stat>
              </Box>
            </HStack>
          </CardBody>
        </Card>

        {/* Opérations programmées */}
        <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
          <CardBody>
            <HStack spacing={3} mb={2}>
              <Icon as={FiCalendar} color="purple.500" boxSize={5} />
              <Box>
                <Stat>
                  <StatLabel>À programmer</StatLabel>
                  <StatNumber fontSize="xl" color="purple.500">
                    {scheduledOperations?.length || 0}
                  </StatNumber>
                </Stat>
              </Box>
            </HStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Détails mensuels */}
      <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
        <CardHeader>
          <Heading size="md">Mois actuel</Heading>
        </CardHeader>
        <CardBody>
          <Grid templateColumns="repeat(2, 1fr)" gap={6}>
            <GridItem>
              <VStack align="start" spacing={2}>
                <Text fontSize="sm" color="gray.500">Balance mensuelle</Text>
                <Text fontSize="2xl" fontWeight="bold" color={monthlyBalance >= 0 ? "green.500" : "red.500"}>
                  {monthlyBalance >= 0 ? "+" : ""}{monthlyBalance.toFixed(2)} €
                </Text>
              </VStack>
            </GridItem>
            <GridItem>
              <VStack align="start" spacing={2}>
                <Text fontSize="sm" color="gray.500">Impact programmé</Text>
                <Text fontSize="2xl" fontWeight="bold" color={scheduledMonthlyImpact >= 0 ? "green.500" : "red.500"}>
                  {scheduledMonthlyImpact >= 0 ? "+" : ""}{scheduledMonthlyImpact.toFixed(2)} €
                </Text>
              </VStack>
            </GridItem>
          </Grid>
        </CardBody>
      </Card>

      {/* Dernières transactions */}
      <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
        <CardHeader>
          <Heading size="md">Dernières transactions</Heading>
        </CardHeader>
        <CardBody>
          <VStack align="stretch" spacing={3} maxH="300px" overflowY="auto">
            {(transactions || []).slice(0, 5).map((t) => (
              <HStack key={t.id} justify="space-between" p={2} borderRadius="md" _hover={{ bg: "gray.100" }}>
                <VStack align="start" spacing={0}>
                  <Text fontWeight="500">{t.description}</Text>
                  <Text fontSize="xs" color="gray.500">{new Date(t.date).toLocaleDateString()}</Text>
                </VStack>
                <Text fontWeight="bold" color={t.type === "CREDIT" ? "green.500" : "red.500"}>
                  {t.type === "CREDIT" ? "+" : "-"}{Math.abs(t.amount).toFixed(2)} €
                </Text>
              </HStack>
            ))}
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
};

export default FinanceDashboard;
