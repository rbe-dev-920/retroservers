import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  useToast,
  VStack,
  HStack,
  Text,
  Divider,
  Alert,
  AlertIcon,
  Checkbox,
  Spinner,
  useColorModeValue,
  Input,
  InputGroup,
  InputLeftElement
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';

// Les cartes MyRBE qui nécessitent une autorisation
const MYRBE_CARDS = [
  { id: 'RETRODEMANDES', label: 'RétroDemandes', color: 'blue' },
  { id: 'RETRODEMANDES_RECAP', label: 'Récapitulatif Demandes', color: 'cyan' },
  { id: 'VEHICLES', label: 'RétroBus', color: 'teal' },
  { id: 'FINANCE', label: 'Gestion Financière', color: 'green' },
  { id: 'EVENTS', label: 'Gestion des Événements', color: 'green' },
  { id: 'MEMBERS', label: 'Gérer les adhésions', color: 'blue' },
  { id: 'STOCK', label: 'Gestion des Stocks', color: 'yellow' },
  { id: 'NEWSLETTER', label: 'Gestion Newsletter', color: 'purple' },
  { id: 'PLANNING', label: 'RétroPlanning', color: 'orange' },
  { id: 'SITE_MANAGEMENT', label: 'Gestion du Site', color: 'pink' },
  { id: 'PERMISSIONS_MANAGEMENT', label: 'Gestion des Autorisations', color: 'red' },
  { id: 'RETROMAIL', label: 'Retromail', color: 'teal' },
  { id: 'RETROSUPPORT', label: 'RétroSupport', color: 'cyan' }
];

/**
 * MyRBEPermissionsManager - Gestion matricielle des permissions MyRBE
 * Vue d'ensemble: tous les utilisateurs vs toutes les cartes MyRBE
 */
export default function MyRBEPermissionsManager() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState({});

  const tableBg = useColorModeValue('white', 'gray.800');
  const headerBg = useColorModeValue('blue.50', 'blue.900');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  // Charger les utilisateurs et leurs permissions
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Charger les utilisateurs
      const usersRes = await fetch('/api/site-users');
      const usersData = await usersRes.json();
      setUsers(Array.isArray(usersData) ? usersData : []);

      // Charger les permissions
      const permsRes = await fetch('/api/user-permissions');
      const permsData = await permsRes.json();

      // Organiser les permissions par userId et resource
      const permsMap = {};
      if (permsData.success && Array.isArray(permsData.permissions)) {
        permsData.permissions.forEach(p => {
          if (!permsMap[p.userId]) {
            permsMap[p.userId] = {};
          }
          permsMap[p.userId][p.resource] = p;
        });
      }

      setPermissions(permsMap);
      console.log('✅ Données chargées:', usersData.length, 'utilisateurs');
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast({
        title: 'Erreur',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Activer/Désactiver l'accès à une carte
  const toggleCardAccess = async (userId, cardId) => {
    try {
      setSaving(true);

      const hasAccess = permissions[userId]?.[cardId];

      if (hasAccess) {
        // Supprimer la permission via DELETE /api/user-permissions/:userId/:resource
        const res = await fetch(`/api/user-permissions/${userId}/${cardId}`, {
          method: 'DELETE'
        });

        if (!res.ok) {
          throw new Error('Erreur lors de la suppression');
        }

        // Mettre à jour l'état local
        setPermissions(prev => ({
          ...prev,
          [userId]: {
            ...prev[userId],
            [cardId]: null
          }
        }));

        toast({
          title: 'Accès supprimé',
          status: 'success',
          duration: 2000
        });
      } else {
        // Ajouter la permission via POST /api/user-permissions/:userId
        const res = await fetch(`/api/user-permissions/${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resource: cardId,
            actions: ['READ', 'CREATE', 'EDIT', 'DELETE']
          })
        });

        if (!res.ok) {
          throw new Error('Erreur lors de la création');
        }

        const data = await res.json();
        const newPerm = data.permission || data;

        // Mettre à jour l'état local
        setPermissions(prev => ({
          ...prev,
          [userId]: {
            ...prev[userId],
            [cardId]: newPerm
          }
        }));

        toast({
          title: 'Accès accordé',
          status: 'success',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast({
        title: 'Erreur',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    } finally {
      setSaving(false);
    }
  };

  // Donner/Retirer accès à toutes les cartes
  const toggleAllCards = async (userId, grantAccess) => {
    try {
      setSaving(true);

      const userPermissions = permissions[userId] || {};

      for (const card of MYRBE_CARDS) {
        const hasAccess = userPermissions[card.id];

        if (grantAccess && !hasAccess) {
          // Ajouter
          const res = await fetch(`/api/user-permissions/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resource: card.id,
              actions: ['READ', 'CREATE', 'EDIT', 'DELETE']
            })
          });
          if (res.ok) {
            const data = await res.json();
            const newPerm = data.permission || data;
            setPermissions(prev => ({
              ...prev,
              [userId]: {
                ...prev[userId],
                [card.id]: newPerm
              }
            }));
          }
        } else if (!grantAccess && hasAccess) {
          // Retirer
          await fetch(`/api/user-permissions/${userId}/${card.id}`, {
            method: 'DELETE'
          });
          setPermissions(prev => ({
            ...prev,
            [userId]: {
              ...prev[userId],
              [card.id]: null
            }
          }));
        }
      }

      toast({
        title: grantAccess ? 'Tous les accès accordés' : 'Tous les accès retirés',
        status: 'success',
        duration: 2000
      });
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast({
        title: 'Erreur',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    } finally {
      setSaving(false);
    }
  };

  // Filtrer les utilisateurs
  const filteredUsers = users.filter(user =>
    `${user.firstName} ${user.lastName} ${user.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardBody>
          <VStack spacing={4} py={8}>
            <Spinner size="lg" />
            <Text>Chargement des permissions MyRBE...</Text>
          </VStack>
        </CardBody>
      </Card>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* En-tête */}
      <Box>
        <Heading size="lg" mb={2}>🎯 Gestion des accès MyRBE</Heading>
        <Text color="gray.600">
          Matrice permettant de gérer les accès aux cartes MyRBE pour chaque utilisateur.
          Par défaut, seul w.belaidi a accès à toutes les cartes.
        </Text>
      </Box>

      {/* Recherche */}
      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <SearchIcon color="gray.300" />
        </InputLeftElement>
        <Input
          placeholder="Rechercher un utilisateur..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </InputGroup>

      {/* Alerte info */}
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        <Box>
          <Text fontWeight="bold" fontSize="sm">
            ℹ️ {filteredUsers.length} utilisateur(s) trouvé(s) - {MYRBE_CARDS.length} cartes disponibles
          </Text>
        </Box>
      </Alert>

      {/* Tableau matriciel */}
      <Card bg={tableBg}>
        <CardHeader>
          <Heading size="md">📊 Matrice des permissions</Heading>
        </CardHeader>
        <Divider />
        <CardBody>
          <Box overflowX="auto">
            <Table size="sm" variant="striped">
              <Thead bg={headerBg}>
                <Tr>
                  <Th position="sticky" left="0" bg={headerBg} zIndex="10" minW="250px">
                    Utilisateur
                  </Th>
                  <Th textAlign="center" minW="100px">
                    <Button
                      size="xs"
                      variant="ghost"
                      fontSize="xs"
                      title="Accorder accès à toutes les cartes"
                    >
                      ✓ Tous
                    </Button>
                  </Th>
                  {MYRBE_CARDS.map(card => (
                    <Th key={card.id} textAlign="center" minW="80px">
                      <Box fontSize="xs" whiteSpace="normal" lineHeight="1.2">
                        {card.label.substring(0, 12)}
                      </Box>
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {filteredUsers.map(user => {
                  const userPerms = permissions[user.id] || {};
                  const accessCount = Object.values(userPerms).filter(p => p).length;

                  return (
                    <Tr key={user.id} _hover={{ bg: hoverBg }}>
                      <Td
                        position="sticky"
                        left="0"
                        bg={tableBg}
                        zIndex="5"
                        fontWeight="medium"
                        minW="250px"
                      >
                        <VStack align="start" spacing={0}>
                          <Text>
                            {user.firstName} {user.lastName}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {user.email}
                          </Text>
                          {user.email === 'w.belaidi@retrobus.fr' && (
                            <Badge colorScheme="gold" fontSize="xs" mt={1}>
                              Admin par défaut
                            </Badge>
                          )}
                        </VStack>
                      </Td>
                      <Td textAlign="center">
                        <Badge
                          colorScheme={accessCount > 0 ? 'green' : 'gray'}
                          fontSize="xs"
                        >
                          {accessCount}/{MYRBE_CARDS.length}
                        </Badge>
                      </Td>
                      {MYRBE_CARDS.map(card => (
                        <Td key={card.id} textAlign="center">
                          <Checkbox
                            isChecked={!!permissions[user.id]?.[card.id]}
                            onChange={() => toggleCardAccess(user.id, card.id)}
                            isDisabled={saving}
                            size="md"
                            colorScheme={card.color}
                            title={
                              permissions[user.id]?.[card.id]?.expiresAt
                                ? `Expire le: ${new Date(permissions[user.id][card.id].expiresAt).toLocaleDateString()}`
                                : 'Accès accordé'
                            }
                          />
                        </Td>
                      ))}
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        </CardBody>
      </Card>

      {/* Info */}
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <Box>
          <Text fontWeight="bold" fontSize="sm">⚙️ À savoir</Text>
          <Text fontSize="xs" color="gray.700" mt={1}>
            • Cochez pour accorder l'accès à une carte
            • Décochez pour révoquer l'accès
            • Les permissions individuelles priment sur les rôles
            • Les changements sont appliqués immédiatement
          </Text>
        </Box>
      </Alert>
    </VStack>
  );
}
