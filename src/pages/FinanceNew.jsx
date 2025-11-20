import React, { useState } from "react";
import {
  Box, VStack, HStack, useColorModeValue,
  Button, Heading, Text, Icon, Divider, Card, CardBody,
  Flex, useMediaQuery
} from "@chakra-ui/react";
import {
  FiDollarSign, FiTrendingUp, FiBarChart, FiCalendar,
  FiCreditCard, FiTarget, FiSettings, FiFileText, FiMenu, FiX
} from "react-icons/fi";

// Import des sous-composants (à créer)
import FinanceDashboard from "../components/Finance/Dashboard";
import FinanceTransactions from "../components/Finance/Transactions";
import FinanceScheduledOps from "../components/Finance/ScheduledOperations";
import FinanceQuotes from "../components/Finance/Quotes";
import FinanceReports from "../components/Finance/Reports";
import FinanceSettings from "../components/Finance/Settings";

/**
 * FinanceNew - Nouvelle page Finance avec sidebar navigation
 * Architecture modulaire pour meilleure organisation
 */
const FinanceNew = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile] = useMediaQuery("(max-width: 768px)");

  const bgSidebar = useColorModeValue("gray.50", "gray.900");
  const bgMain = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const hoverBg = useColorModeValue("gray.100", "gray.800");
  const activeBg = useColorModeValue("blue.50", "blue.900");
  const activeBorder = useColorModeValue("blue.500", "blue.400");

  // Définition des sections avec icônes et labels
  const sections = [
    { id: "dashboard", label: "📊 Tableau de bord", icon: FiBarChart, color: "blue" },
    { id: "transactions", label: "💳 Transactions", icon: FiCreditCard, color: "green" },
    { id: "scheduled", label: "📅 Opérations planifiées", icon: FiCalendar, color: "purple" },
    { id: "quotes", label: "📄 Devis", icon: FiFileText, color: "orange" },
    { id: "reports", label: "📈 Rapports", icon: FiTrendingUp, color: "teal" },
    { id: "settings", label: "⚙️ Paramètres", icon: FiSettings, color: "gray" }
  ];

  // Rendu du contenu basé sur la section active
  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <FinanceDashboard />;
      case "transactions":
        return <FinanceTransactions />;
      case "scheduled":
        return <FinanceScheduledOps />;
      case "quotes":
        return <FinanceQuotes />;
      case "reports":
        return <FinanceReports />;
      case "settings":
        return <FinanceSettings />;
      default:
        return <FinanceDashboard />;
    }
  };

  return (
    <HStack align="stretch" spacing={0} h="100vh">
      {/* ===== SIDEBAR ===== */}
      <Box
        w={sidebarOpen && !isMobile ? "280px" : isMobile ? "100%" : "0"}
        bg={bgSidebar}
        borderRight="1px"
        borderColor={borderColor}
        overflowY="auto"
        transition="width 0.3s ease"
        display={isMobile && !sidebarOpen ? "none" : "block"}
        position={isMobile ? "absolute" : "relative"}
        h="100%"
        zIndex={isMobile ? 10 : "auto"}
        boxShadow={isMobile && sidebarOpen ? "lg" : "none"}
      >
        <VStack align="stretch" spacing={0} h="100%">
          {/* Header Sidebar */}
          <Box p={6} borderBottom="1px" borderColor={borderColor}>
            <HStack justify="space-between" mb={4}>
              <Heading size="md" display="flex" alignItems="center" gap={2}>
                <Icon as={FiDollarSign} color="blue.500" />
                Finances
              </Heading>
              {isMobile && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSidebarOpen(false)}
                >
                  <FiX />
                </Button>
              )}
            </HStack>
            <Text fontSize="sm" color="gray.500">
              Gestion des finances de l'association
            </Text>
          </Box>

          {/* Menu Items */}
          <VStack align="stretch" spacing={1} px={3} py={4} flex={1}>
            {sections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <Button
                  key={section.id}
                  leftIcon={<Icon as={section.icon} />}
                  variant="ghost"
                  justifyContent="flex-start"
                  w="100%"
                  bg={isActive ? activeBg : "transparent"}
                  borderLeft="3px"
                  borderColor={isActive ? activeBorder : "transparent"}
                  borderRadius={0}
                  px={4}
                  py={6}
                  fontSize="sm"
                  fontWeight={isActive ? "600" : "500"}
                  color={isActive ? activeBorder : "inherit"}
                  _hover={{
                    bg: hoverBg,
                    borderLeftColor: activeBorder
                  }}
                  onClick={() => {
                    setActiveSection(section.id);
                    if (isMobile) setSidebarOpen(false);
                  }}
                >
                  <Text truncate>{section.label}</Text>
                </Button>
              );
            })}
          </VStack>

          {/* Footer Sidebar */}
          <Box
            p={4}
            borderTop="1px"
            borderColor={borderColor}
            fontSize="xs"
            color="gray.500"
            textAlign="center"
          >
            <Text>Version 2.0 - Nouveau design</Text>
          </Box>
        </VStack>
      </Box>

      {/* ===== MAIN CONTENT ===== */}
      <Box
        flex={1}
        overflowY="auto"
        bg={bgMain}
        position="relative"
        display={isMobile && sidebarOpen ? "none" : "block"}
      >
        {/* Mobile Toggle Button */}
        {isMobile && (
          <Button
            position="fixed"
            top={4}
            left={4}
            size="sm"
            variant="solid"
            zIndex={5}
            onClick={() => setSidebarOpen(true)}
          >
            <FiMenu />
          </Button>
        )}

        {/* Content Area */}
        <Box p={6}>
          {renderContent()}
        </Box>
      </Box>
    </HStack>
  );
};

export default FinanceNew;
