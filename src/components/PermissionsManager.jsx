import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Container,
  Grid,
  GridItem,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  TextField,
  Input,
  Select,
  Checkbox,
  FormControl,
  FormLabel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Alert,
  AlertIcon,
  CircularProgress,
  Heading,
  Text,
  VStack,
  HStack,
  Divider,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Stack,
  useToast
} from '@chakra-ui/react';
import { AddIcon as ChakraAddIcon, DeleteIcon as ChakraDeleteIcon } from '@chakra-ui/icons';


/**
 * PermissionsManager - Gestionnaire complet des permissions
 * Remplace les onglets "Accès MyRBE" et "Gestion des utilisateurs"
 */
export default function PermissionsManager() {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // State pour les permissions
  const [permissions, setPermissions] = useState({
    functions: [],
    roles: [],
    roleFunctionDefaults: {}
  });

  // State pour la gestion des utilisateurs
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});

  // State pour les filtres
  const [searchFilter, setSearchFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Dialog pour accorder une permission
  const [grantData, setGrantData] = useState({
    userId: '',
    functionId: '',
    access: false,
    read: false,
    write: false,
    expiresAt: null
  });

  // Récupérer les définitions des permissions
  useEffect(() => {
    fetchPermissionDefinitions();
  }, []);

  const fetchPermissionDefinitions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token');

      const response = await fetch('/api/permissions/definitions', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setPermissions({
        functions: data.functions || [],
        roles: data.roles || [],
        roleFunctionDefaults: data.roleFunctionDefaults || {}
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching permission definitions:', err);
      setError(`Erreur lors du chargement des permissions: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPermissions = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token');

      const response = await fetch(`/api/permissions/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setUserPermissions(data.permissions || {});
    } catch (err) {
      console.error('Error fetching user permissions:', err);
      setError(`Erreur lors du chargement des permissions utilisateur: ${err.message}`);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token');

      const response = await fetch('/api/users/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const handleGrantPermission = async () => {
    try {
      if (!grantData.userId || !grantData.functionId) {
        setError('Veuillez sélectionner un utilisateur et une fonction');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token');

      const response = await fetch('/api/permissions/grant', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: grantData.userId,
          functionId: grantData.functionId,
          access: grantData.access,
          read: grantData.read,
          write: grantData.write,
          expiresAt: grantData.expiresAt
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      setSuccess('Permission accordée avec succès');
      onClose();
      setGrantData({
        userId: '',
        functionId: '',
        access: false,
        read: false,
        write: false,
        expiresAt: null
      });
      if (selectedUser) {
        fetchUserPermissions(selectedUser.id);
      }
    } catch (err) {
      console.error('Error granting permission:', err);
      setError(`Erreur lors de l'octroi de la permission: ${err.message}`);
    }
  };

  const handleRevokePermission = async (permissionId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token');

      const response = await fetch(`/api/permissions/${permissionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      setSuccess('Permission révoquée avec succès');
      if (selectedUser) {
        fetchUserPermissions(selectedUser.id);
      }
    } catch (err) {
      console.error('Error revoking permission:', err);
      setError(`Erreur lors de la révocation: ${err.message}`);
    }
  };

  // Filtrer les fonctions
  const filteredFunctions = permissions.functions.filter(func => {
    if (searchFilter && !func.name.toLowerCase().includes(searchFilter.toLowerCase())) {
      return false;
    }
    if (roleFilter && !func.group?.toLowerCase().includes(roleFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <VStack spacing={4}>
          <CircularProgress isIndeterminate color="blue.300" />
          <Text>Chargement des permissions...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Container maxW="container.lg" py={8}>
      {/* Titre */}
      <Heading size="2xl" mb={6}>
        🔐 Gestionnaire des Permissions du Site
      </Heading>

      {/* Messages */}
      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">Erreur</Text>
            <Text fontSize="sm">{error}</Text>
          </Box>
        </Alert>
      )}
      {success && (
        <Alert status="success" mb={4} borderRadius="md">
          <AlertIcon />
          <Text>{success}</Text>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs colorScheme="blue" variant="enclosed">
        <TabList mb={4}>
          <Tab>Vue d'ensemble des permissions</Tab>
          <Tab>Gestion des utilisateurs</Tab>
          <Tab>Audit et logs</Tab>
        </TabList>

        <TabPanels>
          {/* TAB 1: Vue d'ensemble des permissions */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <HStack spacing={2}>
                <Input
                  placeholder="Rechercher une fonction..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  maxW="200px"
                >
                  <option value="">Tous les groupes</option>
                  {[...new Set(permissions.functions.map(f => f.group))].map(group => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </Select>
              </HStack>

              {/* Tableau des permissions */}
              <Box overflowX="auto">
                <Table size="sm" variant="striped">
                  <Thead bg="gray.100">
                    <Tr>
                      <Th>Fonction</Th>
                      <Th>Groupe</Th>
                      <Th>Description</Th>
                      <Th>Rôles par défaut</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredFunctions.map((func) => (
                      <Tr key={func.id}>
                        <Td fontWeight="medium">{func.name}</Td>
                        <Td>{func.group}</Td>
                        <Td>{func.description}</Td>
                        <Td>
                          <HStack spacing={1}>
                            {permissions.roleFunctionDefaults[func.id]?.roles?.map(role => (
                              <Badge key={role} colorScheme="purple" size="sm">
                                {role}
                              </Badge>
                            ))}
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </VStack>
          </TabPanel>

          {/* TAB 2: Gestion des utilisateurs */}
          <TabPanel>
            <Grid templateColumns={{ base: '1fr', md: '1fr 2fr' }} gap={4}>
              <GridItem>
                <Card>
                  <CardHeader>
                    <Heading size="md">Utilisateurs</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={2} align="stretch">
                      <Input
                        placeholder="Rechercher un utilisateur..."
                        size="sm"
                      />
                      <Text fontSize="sm" color="gray.600">
                        Chargement des utilisateurs...
                      </Text>
                    </VStack>
                  </CardBody>
                </Card>
              </GridItem>

              <GridItem>
                <Card>
                  <CardHeader>
                    <HStack justify="space-between">
                      <Heading size="md">Permissions</Heading>
                      <Button
                        leftIcon={<ChakraAddIcon />}
                        colorScheme="blue"
                        size="sm"
                        onClick={onOpen}
                      >
                        Ajouter une permission
                      </Button>
                    </HStack>
                  </CardHeader>
                  <CardBody>
                    {selectedUser ? (
                      <Box overflowX="auto">
                        <Table size="sm" variant="striped">
                          <Thead bg="gray.100">
                            <Tr>
                              <Th>Fonction</Th>
                              <Th textAlign="center">Accès</Th>
                              <Th textAlign="center">Lecture</Th>
                              <Th textAlign="center">Écriture</Th>
                              <Th>Expiration</Th>
                              <Th>Actions</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {Object.entries(userPermissions).map(([funcId, perms]) => (
                              <Tr key={funcId}>
                                <Td>{funcId}</Td>
                                <Td textAlign="center">
                                  {perms.access && <Badge colorScheme="green">✓</Badge>}
                                </Td>
                                <Td textAlign="center">
                                  {perms.read && <Badge colorScheme="green">✓</Badge>}
                                </Td>
                                <Td textAlign="center">
                                  {perms.write && <Badge colorScheme="green">✓</Badge>}
                                </Td>
                                <Td fontSize="sm">{perms.expiresAt || 'Jamais'}</Td>
                                <Td>
                                  <Button
                                    leftIcon={<ChakraDeleteIcon />}
                                    size="xs"
                                    colorScheme="red"
                                    onClick={() => handleRevokePermission(perms.id)}
                                  >
                                    Révoquer
                                  </Button>
                                </Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </Box>
                    ) : (
                      <Text fontSize="sm" color="gray.600">
                        Sélectionnez un utilisateur pour voir ses permissions
                      </Text>
                    )}
                  </CardBody>
                </Card>
              </GridItem>
            </Grid>
          </TabPanel>

          {/* TAB 3: Audit et logs */}
          <TabPanel>
            <Card>
              <CardHeader>
                <Heading size="md">Audit des permissions</Heading>
              </CardHeader>
              <CardBody>
                <Text color="gray.600">
                  Historique des modifications de permissions (en développement)
                </Text>
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Modal pour accorder une permission */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Accorder une permission</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Utilisateur</FormLabel>
                <Select
                  value={grantData.userId}
                  onChange={(e) => setGrantData({ ...grantData, userId: e.target.value })}
                >
                  <option value="">Sélectionner...</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email})
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Fonction</FormLabel>
                <Select
                  value={grantData.functionId}
                  onChange={(e) => setGrantData({ ...grantData, functionId: e.target.value })}
                >
                  <option value="">Sélectionner...</option>
                  {permissions.functions.map(func => (
                    <option key={func.id} value={func.id}>
                      {func.name} ({func.group})
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Autorisations</FormLabel>
                <Stack spacing={2}>
                  <Checkbox
                    isChecked={grantData.access}
                    onChange={(e) => setGrantData({ ...grantData, access: e.target.checked })}
                  >
                    Accès
                  </Checkbox>
                  <Checkbox
                    isChecked={grantData.read}
                    onChange={(e) => setGrantData({ ...grantData, read: e.target.checked })}
                  >
                    Lecture
                  </Checkbox>
                  <Checkbox
                    isChecked={grantData.write}
                    onChange={(e) => setGrantData({ ...grantData, write: e.target.checked })}
                  >
                    Écriture
                  </Checkbox>
                </Stack>
              </FormControl>

              <FormControl>
                <FormLabel>Expiration (optionnel)</FormLabel>
                <Input
                  type="datetime-local"
                  value={grantData.expiresAt || ''}
                  onChange={(e) => setGrantData({ ...grantData, expiresAt: e.target.value })}
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Annuler
            </Button>
            <Button colorScheme="blue" onClick={handleGrantPermission}>
              Accorder
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}
