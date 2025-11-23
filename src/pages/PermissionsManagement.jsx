import React, { useState, useEffect } from 'react';
import {
  Box,
  HStack,
  VStack,
  Button,
  Input,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
  useToast,
  FormControl,
  FormLabel,
  Checkbox,
  Card,
  CardBody,
  CardHeader,
  SimpleGrid,
  Text,
  Spinner,
  Center,
  Heading,
  Alert,
  AlertIcon,
  Container,
  Flex,
  Spacer,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  FiUsers,
  FiLock,
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiShield,
  FiRefreshCw,
  FiAlertCircle,
} from 'react-icons/fi';
import { api } from '../api';
import { useUser } from '../context/UserContext';

// === ADMIN ROLES ===
const ADMIN_ROLES = ['ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'TRESORIER', 'SECRETAIRE_GENERAL'];

// === RESOURCES & PERMISSIONS ===
const RESOURCE_CATEGORIES = {
  VEHICLES: {
    label: '🚗 Véhicules',
    permissions: {
      READ: 'Consulter',
      CREATE: 'Créer',
      EDIT: 'Modifier',
      DELETE: 'Supprimer',
    }
  },
  FINANCE: {
    label: '💰 Finances',
    permissions: {
      READ: 'Consulter',
      CREATE: 'Créer transactions',
      EDIT: 'Modifier',
      DELETE: 'Supprimer',
    }
  },
  EVENTS: {
    label: '📅 Événements',
    permissions: {
      READ: 'Consulter',
      CREATE: 'Créer',
      EDIT: 'Modifier',
      DELETE: 'Supprimer',
    }
  },
  STOCK: {
    label: '📦 Stock',
    permissions: {
      READ: 'Consulter',
      CREATE: 'Ajouter articles',
      EDIT: 'Modifier',
      DELETE: 'Supprimer',
    }
  },
  PLANNING: {
    label: '📊 Planning',
    permissions: {
      READ: 'Consulter',
      CREATE: 'Créer',
      EDIT: 'Modifier',
      DELETE: 'Supprimer',
    }
  },
  MEMBERS: {
    label: '👥 Membres',
    permissions: {
      READ: 'Consulter',
      CREATE: 'Ajouter',
      EDIT: 'Modifier',
      DELETE: 'Supprimer',
    }
  },
};

const getRoleColor = (role) => {
  const colors = {
    ADMIN: 'red',
    PRESIDENT: 'purple',
    VICE_PRESIDENT: 'indigo',
    TRESORIER: 'blue',
    SECRETAIRE_GENERAL: 'cyan',
    MEMBER: 'gray',
  };
  return colors[role] || 'gray';
};

const getRoleLabel = (role) => {
  const labels = {
    ADMIN: '🔴 Admin',
    PRESIDENT: '👑 Président',
    VICE_PRESIDENT: '👔 Vice-Président',
    TRESORIER: '💳 Trésorier',
    SECRETAIRE_GENERAL: '📋 Secrétaire Général',
    MEMBER: '👤 Membre',
  };
  return labels[role] || role;
};

export default function PermissionsManagement() {
  const { user, roles, isAdmin } = useUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  
  // Vérifier que l'utilisateur est admin (PRESIDENT ou admin équivalent)
  const canManage = isAdmin || (user && user.roles && user.roles.some(r => ADMIN_ROLES.includes(r)));

  useEffect(() => {
    if (canManage) {
      loadUsers();
    }
  }, [canManage]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/users');
      if (Array.isArray(response.data)) {
        setUsers(response.data);
      } else if (response.data?.users) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les utilisateurs',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserPermissions = async (userId) => {
    try {
      const response = await api.get(`/api/admin/users/${userId}/permissions`);
      if (response.data) {
        setUserPermissions(response.data);
      }
    } catch (error) {
      console.error('Erreur chargement permissions:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les permissions',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    loadUserPermissions(user.id);
  };

  const handlePermissionToggle = async (resource, action, currentValue) => {
    if (!selectedUser || !canManage) return;

    try {
      const newValue = !currentValue;
      
      if (newValue) {
        // Ajouter permission
        await api.post(`/api/admin/users/${selectedUser.id}/permissions`, {
          resource,
          actions: [action],
        });
      } else {
        // Supprimer permission
        await api.delete(
          `/api/admin/users/${selectedUser.id}/permissions/${resource}/${action}`
        );
      }

      // Recharger
      await loadUserPermissions(selectedUser.id);
      toast({
        title: 'Succès',
        description: 'Permission mise à jour',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Erreur mise à jour permission:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour la permission',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const hasPermission = (resource, action) => {
    if (!userPermissions[resource]) return false;
    return userPermissions[resource].includes && 
           userPermissions[resource].includes(action);
  };

  const filteredUsers = users.filter(u => 
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!canManage) {
    return (
      <Container maxW="container.xl" py={8}>
        <Alert status="error" variant="subtle" flexDirection="column" alignItems="center" justifyContent="center" textAlign="center" height="auto" p={6}>
          <AlertIcon boxSize="40px" mr={0} mb={4} />
          <Heading size="md" mb={2}>Accès Refusé</Heading>
          <Text>Seuls les administrateurs peuvent gérer les permissions.</Text>
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Center minH="80vh">
        <VStack>
          <Spinner size="xl" color="var(--rbe-red)" />
          <Text>Chargement...</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <HStack justify="space-between" mb={4}>
            <VStack align="start" spacing={1}>
              <Heading size="xl" display="flex" alignItems="center" gap={2}>
                <FiShield /> Gestion des Permissions
              </Heading>
              <Text color="gray.600" fontSize="sm">
                Configurez les droits d'accès pour chaque utilisateur
              </Text>
            </VStack>
            <Button
              leftIcon={<FiRefreshCw />}
              onClick={loadUsers}
              isLoading={loading}
              colorScheme="blue"
              variant="outline"
            >
              Actualiser
            </Button>
          </HStack>
        </Box>

        {/* Main Grid */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6} w="full">
          {/* Users List */}
          <Card bg={cardBg}>
            <CardHeader pb={3}>
              <Heading size="md" mb={4}>👥 Utilisateurs</Heading>
              <Input
                placeholder="Rechercher..."
                size="sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </CardHeader>
            <CardBody pt={0}>
              <VStack spacing={2} maxH="600px" overflowY="auto" align="stretch">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <Button
                      key={u.id}
                      justifyContent="start"
                      variant={selectedUser?.id === u.id ? 'solid' : 'ghost'}
                      colorScheme="blue"
                      onClick={() => handleSelectUser(u)}
                      isFullWidth
                      textAlign="left"
                      p={3}
                      height="auto"
                      whiteSpace="normal"
                    >
                      <VStack align="start" spacing={0} width="100%">
                        <Text fontWeight="bold" fontSize="sm">
                          {u.firstName} {u.lastName}
                        </Text>
                        <HStack spacing={2}>
                          <Text fontSize="xs" color="gray.500">
                            {u.email}
                          </Text>
                          {u.role && (
                            <Badge colorScheme={getRoleColor(u.role)} fontSize="xs">
                              {getRoleLabel(u.role)}
                            </Badge>
                          )}
                        </HStack>
                      </VStack>
                    </Button>
                  ))
                ) : (
                  <Text textAlign="center" color="gray.500" py={8}>
                    Aucun utilisateur trouvé
                  </Text>
                )}
              </VStack>
            </CardBody>
          </Card>

          {/* Permissions Grid */}
          <Box gridColumn={{ lg: '2 / 4' }}>
            {selectedUser ? (
              <Card bg={cardBg}>
                <CardHeader>
                  <VStack align="start" spacing={2}>
                    <Heading size="md">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </Heading>
                    {selectedUser.role && (
                      <Badge colorScheme={getRoleColor(selectedUser.role)} fontSize="sm">
                        {getRoleLabel(selectedUser.role)}
                      </Badge>
                    )}
                  </VStack>
                </CardHeader>
                <CardBody pt={0}>
                  <VStack spacing={6} align="stretch">
                    {Object.entries(RESOURCE_CATEGORIES).map(([resource, category]) => (
                      <Box key={resource} p={4} borderWidth={1} borderRadius="md" borderColor="gray.200">
                        <Heading size="sm" mb={4}>
                          {category.label}
                        </Heading>
                        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                          {Object.entries(category.permissions).map(([action, label]) => (
                            <HStack key={`${resource}-${action}`} spacing={2}>
                              <Checkbox
                                isChecked={hasPermission(resource, action)}
                                onChange={() => handlePermissionToggle(resource, action, hasPermission(resource, action))}
                                colorScheme="blue"
                              />
                              <Text fontSize="sm">{label}</Text>
                            </HStack>
                          ))}
                        </SimpleGrid>
                      </Box>
                    ))}
                  </VStack>
                </CardBody>
              </Card>
            ) : (
              <Card bg={cardBg}>
                <CardBody>
                  <Center p={10}>
                    <VStack>
                      <FiAlertCircle size={32} color="gray" />
                      <Text color="gray.500">
                        Sélectionnez un utilisateur pour gérer ses permissions
                      </Text>
                    </VStack>
                  </Center>
                </CardBody>
              </Card>
            )}
          </Box>
        </SimpleGrid>

        {/* Stats */}
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
          <Card>
            <CardBody textAlign="center">
              <Text fontSize="2xl" fontWeight="bold" color="blue.500">
                {users.length}
              </Text>
              <Text fontSize="sm" color="gray.600">
                Utilisateurs
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardBody textAlign="center">
              <Text fontSize="2xl" fontWeight="bold" color="red.500">
                {users.filter(u => u.role === 'ADMIN').length}
              </Text>
              <Text fontSize="sm" color="gray.600">
                Admins
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardBody textAlign="center">
              <Text fontSize="2xl" fontWeight="bold" color="purple.500">
                {users.filter(u => ADMIN_ROLES.includes(u.role)).length}
              </Text>
              <Text fontSize="sm" color="gray.600">
                Administrateurs
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardBody textAlign="center">
              <Text fontSize="2xl" fontWeight="bold" color="gray.500">
                {users.filter(u => u.role === 'MEMBER').length}
              </Text>
              <Text fontSize="sm" color="gray.600">
                Membres
              </Text>
            </CardBody>
          </Card>
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
