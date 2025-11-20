import React from "react";
import {
  SimpleGrid,
  VStack,
  Text,
  Button,
  HStack,
  Box,
  useColorModeValue,
  Divider,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Heading,
  Badge,
  Spinner
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import {
  FiDollarSign, FiPlus, FiCalendar, FiUsers, FiPackage,
  FiMail, FiGlobe, FiInbox, FiLifeBuoy, FiTool, FiShield,
  FiTruck, FiShoppingCart, FiAlertCircle
} from "react-icons/fi";
import { useUser } from "../context/UserContext";
import { canAccess, RESOURCES } from "../lib/permissions";
import { useUserPermissions } from "../hooks/useUserPermissions";
import PageLayout from '../components/Layout/PageLayout';
import ModernCard from '../components/Layout/ModernCard';
import PermissionsManager from '../components/PermissionsManager';

const cards = [
  {
    title: "RétroDemandes",
    description: "Créez vos demandes et consultez vos devis",
    to: "/dashboard/retro-requests",
    icon: FiPlus,
    color: "blue",
    resource: "RETRODEMANDES",
    cardAccess: true
  },
  {
    title: "Récapitulatif Demandes",
    description: "Vue d'ensemble de toutes les RétroDemandes",
    to: "/dashboard/president/retro-requests",
    icon: FiPlus,
    color: "cyan",
    requiredRole: ['PRESIDENT', 'ADMIN'],
    resource: "RETRODEMANDES",
    cardAccess: true
  },
  {
    title: "RétroBus",
    description: "Mécanique, véhicules et maintenance",
    to: "/dashboard/retrobus",
    icon: FiTool,
    color: "teal",
    resource: "VEHICLES",
    cardAccess: true
  },
  {
    title: "Gestion Financière",
    description: "Recettes, dépenses et opérations programmées",
    to: "/admin/finance-v2",
    icon: FiDollarSign,
    color: "rbe",
    resource: "FINANCE",
    cardAccess: true
  },
  {
    title: "Gestion des Événements",
    description: "Création, planification et suivi",
    to: "/dashboard/events-management",
    icon: FiCalendar,
    color: "green",
    resource: "EVENTS",
    cardAccess: true
  },
  {
    title: "Gérer les adhésions",
    description: "Membres, cotisations et documents",
    to: "/dashboard/members-management",
    icon: FiUsers,
    color: "blue",
    resource: "MEMBERS",
    cardAccess: true
  },
  {
    title: "Gestion des Stocks",
    description: "Inventaire et matériel de l'association",
    to: "/dashboard/stock-management",
    icon: FiPackage,
    color: "yellow",
    resource: "STOCK",
    cardAccess: true
  },
  {
    title: "Gestion Newsletter",
    description: "Abonnés et campagnes d'envoi",
    to: "/dashboard/newsletter",
    icon: FiMail,
    color: "purple",
    resource: "NEWSLETTER",
    cardAccess: true
  },
  {
    title: "RétroPlanning",
    description: "Calendrier centralisé: campagnes, tournées, affectations",
    to: "/dashboard/retroplanning",
    icon: FiCalendar,
    color: "orange",
    resource: "PLANNING",
    cardAccess: true,
    hidden: true // Temporairement masqué - en cours de correction de la modale
  },
  {
    title: "Gestion du Site",
    description: "Changelog, contenu et mise à jour",
    to: "/dashboard/site-management",
    icon: FiGlobe,
    color: "pink",
    resource: "SITE_MANAGEMENT",
    cardAccess: true
  },
  {
    title: "Gestion des Autorisations",
    description: "Rôles et permissions des utilisateurs",
    to: "/dashboard/myrbe/permissions",
    icon: FiShield,
    color: "red",
    requiredRole: ['ADMIN', 'MANAGER', 'OPERATOR'],
    resource: "PERMISSIONS_MANAGEMENT",
    cardAccess: true
  },
  {
    title: "Retromail",
    description: "Messagerie interne de l'équipe",
    to: "/retromail",
    icon: FiInbox,
    color: "teal",
    resource: "RETROMAIL",
    cardAccess: true,
    hidden: true // Non utilisé sur MyRBE
  },
  {
    title: "RétroSupport",
    description: "Tickets: incidents, bugs et améliorations",
    to: "/dashboard/support",
    icon: FiLifeBuoy,
    color: "cyan",
    resource: "RETROSUPPORT",
    cardAccess: true
  },
  {
    title: "Mon Profil",
    description: "Informations personnelles et permissions",
    to: "/dashboard/profile",
    icon: FiUsers,
    color: "blue",
    hidden: true // Non utilisé sur MyRBE
  }
];

export default function MyRBE() {
  const alertBg = useColorModeValue("blue.50", "blue.900");
  const alertBorder = useColorModeValue("blue.500", "blue.300");
  const { user, roles, customPermissions } = useUser();
  const userRole = roles?.[0] || 'MEMBER';
  const { permissions: userPermissions, loading: permissionsLoading } = useUserPermissions(user?.id);
  const [showPermissions, setShowPermissions] = React.useState(false);
  
  // Détecter si c'est demandé via URL
  const location = React.useMemo(() => window.location.pathname, []);
  React.useEffect(() => {
    if (location.includes('permissions')) {
      setShowPermissions(true);
    }
  }, [location]);

  /**
   * Vérifier si une carte doit être affichée
   */
  const shouldShowCard = (card) => {
    // Si la carte est masquée, ne pas l'afficher (sauf pour ADMIN)
    if (card.hidden && userRole !== 'ADMIN') {
      return false;
    }

    // Les ADMIN voient TOUT
    if (userRole === 'ADMIN') {
      return true;
    }

    // Les prestataires ne voient que RétroSupport (RétroPlanning est masqué)
    if (userRole === 'PRESTATAIRE') {
      return card.title === 'RétroSupport';
    }

    // Vérifier les rôles requis
    if (card.requiredRole && !card.requiredRole.includes(userRole)) {
      return false;
    }

    // Si la carte nécessite une autorisation d'accès (cardAccess)
    if (card.cardAccess) {
      // Vérifier d'abord les permissions individuelles pour cette carte
      const hasCardPermission = userPermissions.some(p => p.resource === card.resource);
      if (hasCardPermission) {
        return true;
      }

      // Pour les PARTENAIRES, l'accès aux cartes doit être accordé individuellement
      if (userRole === 'PARTENAIRE') {
        // Les partenaires ne voient la carte que s'ils ont une permission spécifique
        return false;
      }

      // Pour les autres rôles, l'accès est autorisé par défaut (sauf si pas de permissions)
      // Vérifier si le rôle a accès à la ressource
      if (card.resource) {
        const cardPermissionMap = {
          'VEHICLES': RESOURCES.VEHICLES,
          'EVENTS': RESOURCES.EVENTS,
          'PLANNING': RESOURCES.RETROPLANNING,
          'FINANCE': RESOURCES.FINANCE,
          'MEMBERS': RESOURCES.MEMBERS,
          'STOCK': RESOURCES.STOCK,
          'NEWSLETTER': RESOURCES.NEWSLETTER,
          'SITE_MANAGEMENT': RESOURCES.SITE_MANAGEMENT,
          'RETRODEMANDES': RESOURCES.RETRODEMANDES,
          'RETROMAIL': RESOURCES.RETROMAIL,
          'RETROSUPPORT': RESOURCES.RETROSUPPORT,
          'PERMISSIONS_MANAGEMENT': RESOURCES.PERMISSIONS_MANAGEMENT
        };

        const requiredResource = cardPermissionMap[card.resource];
        // Les rôles standards voient les cartes si elles correspondent à leurs permissions
        return !requiredResource || canAccess(userRole, requiredResource, customPermissions);
      }
      
      // Si pas de ressource spécifiée, afficher la carte
      return true;
    }

    // Les cartes sans ressource sont toujours visibles (ex: Mon Profil)
    return true;
  };

  // Filtrer les cartes en fonction des permissions
  const visibleCards = cards.filter(shouldShowCard);

  if (permissionsLoading) {
    return (
      <PageLayout
        title="Espace MyRBE"
        subtitle="Les outils d'administration RétroBus Essonne"
        bgGradient="linear(to-r, blue.500, purple.600)"
      >
        <VStack spacing={4} py={8}>
          <Spinner size="lg" />
          <Text>Chargement des permissions...</Text>
        </VStack>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Espace MyRBE"
      subtitle="Les outils d'administration RétroBus Essonne"
      headerVariant="card"
      bgGradient="linear(to-r, blue.500, purple.600)"
      titleSize="xl"
      titleWeight="700"
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard/home" },
        { label: "MyRBE", href: "/dashboard/myrbe" }
      ]}
    >
      <VStack spacing={8} align="stretch">
        {/* Section Permissions - Affiche PermissionsManager quand requis */}
        {showPermissions && (roles?.includes('ADMIN') || roles?.includes('MANAGER') || roles?.includes('OPERATOR')) && (
          <Box>
            <Button 
              mb={4}
              variant="ghost" 
              onClick={() => setShowPermissions(false)}
              size="sm"
            >
              ← Retour à MyRBE
            </Button>
            <Box bg={useColorModeValue('white', 'gray.800')} borderRadius="md" p={6} borderWidth="1px" borderColor={useColorModeValue('gray.200', 'gray.700')}>
              <Heading size="md" mb={4}>🛡️ Gestion des Autorisations</Heading>
              <PermissionsManager />
            </Box>
          </Box>
        )}

        {/* Grille des fonctionnalités - Masquée si permissions affichées */}
        {!showPermissions && (
          <>
            {visibleCards.length > 0 ? (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                {visibleCards.map((card) => (
                  <ModernCard
                    key={card.title}
                    title={card.title}
                    description={card.description}
                    icon={card.icon}
                    color={card.color}
                    badge={card.badge}
                    as={card.title === 'Gestion des Autorisations' ? 'button' : RouterLink}
                    to={card.title !== 'Gestion des Autorisations' ? card.to : undefined}
                    onClick={card.title === 'Gestion des Autorisations' ? () => setShowPermissions(true) : undefined}
                  />
                ))}
              </SimpleGrid>
            ) : (
              <Box
                bg={useColorModeValue('gray.50', 'gray.900')}
                borderRadius="md"
                p={12}
                textAlign="center"
                borderWidth="2px"
                borderStyle="dashed"
                borderColor={useColorModeValue('gray.300', 'gray.600')}
              >
                <HStack justify="center" mb={3}>
                  <FiAlertCircle size={32} />
                </HStack>
                <Heading size="md" mb={2}>Accès limité</Heading>
                <Text color="gray.600" mb={4}>
                  Vous n'avez pas accès aux fonctionnalités de MyRBE avec votre rôle et vos permissions actuels.
                </Text>
                <Text fontSize="sm" color="gray.500">
                  Contactez un administrateur pour demander l'accès.
                </Text>
              </Box>
            )}
          </>
        )}
        
        {/* Section d'aide */}
        {!showPermissions && visibleCards.length > 0 && (
          <VStack spacing={6}>
            <Box 
              bg={alertBg}
              p={6}
              borderRadius="xl" 
              borderLeft="4px solid"
              borderLeftColor={alertBorder}
              w="full"
            >
              <VStack spacing={3} align="start">
                <HStack>
                  <Text fontSize="lg" fontWeight="600" color="blue.700">
                    💡 Guide d'utilisation
                  </Text>
                </HStack>
                <Text color="blue.600" lineHeight="relaxed" fontSize="sm">
                  Votre vue MyRBE est personnalisée selon vos permissions individuelles et votre rôle. 
                  Les cartes affichées correspondent à vos droits d'accès. 
                  Les modifications que vous effectuez sont automatiquement sauvegardées 
                  et synchronisées avec les autres membres de l'équipe.
                </Text>
                <HStack spacing={3} pt={2}>
                  <Button size="sm" variant="secondary" colorScheme="blue">
                    Guide complet
                  </Button>
                  <Button size="sm" variant="modern" as={RouterLink} to="/dashboard/support">
                    Support technique
                  </Button>
                </HStack>
              </VStack>
            </Box>
            
            {/* Stats rapides */}
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} w="full">
              <ModernCard 
                title="Cartes visibles" 
                description={`${visibleCards.length}`}
                color="blue"
                variant="modern"
              />
              <ModernCard 
                title="Votre rôle" 
                description={userRole}
                color="green"
                variant="modern"
              />
              <ModernCard 
                title="Permissions individuelles" 
                description={`${userPermissions.length}`}
                color="orange"
                variant="modern"
              />
              <ModernCard 
                title="Version" 
                description="v2.2.0" 
                color="purple"
                variant="modern"
              />
            </SimpleGrid>
          </VStack>
        )}
      </VStack>
    </PageLayout>
  );
}