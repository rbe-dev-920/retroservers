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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  useDisclosure,
  useToast,
  VStack,
  HStack,
  Text,
  Select,
  FormControl,
  FormLabel,
  Divider,
  Alert,
  AlertIcon,
  Grid,
  CheckboxGroup,
  Checkbox,
  Stack,
  Input,
  IconButton
} from '@chakra-ui/react';
import { DeleteIcon, EditIcon, AddIcon } from '@chakra-ui/icons';
import { getAllRoles } from '../lib/permissions';

/**
 * PermissionsManager - Gestion des droits individuels
 * Stockage LOCAL (localStorage) - pas de dépendance API
 */
export default function PermissionsManager() {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isAddPermOpen, onOpen: onAddPermOpen, onClose: onAddPermClose } = useDisclosure();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formRole, setFormRole] = useState('MEMBER');
  const rolesInfo = getAllRoles();

  // États pour ajouter/éditer droits
  const [formPerm, setFormPerm] = useState({
    module: '',
    access: [],
    reason: ''
  });
  const [editingPermId, setEditingPermId] = useState(null);

  const MODULES = [
    { id: 'vehicles', label: '🚗 Gestion des Véhicules' },
    { id: 'events', label: '🎉 Gestion des Événements' },
    { id: 'finance', label: '💰 Gestion Financière' },
    { id: 'members', label: '👥 Gestion des Adhérents' },
    { id: 'stock', label: '📦 Gestion des Stocks' },
    { id: 'site', label: '🌐 Gestion du Site' },
    { id: 'newsletter', label: '📧 Gestion Newsletter' },
    { id: 'planning', label: '📅 RétroPlanning' }
  ];

  const ACCESS_TYPES = [
    { value: 'read', label: 'Lecture' },
    { value: 'create', label: 'Créer' },
    { value: 'edit', label: 'Modifier' },
    { value: 'delete', label: 'Supprimer' }
  ];

  // Charger les données depuis le serveur
  const loadData = useCallback(async () => {
    try {
      // Charger les utilisateurs du serveur
      const response = await fetch('/api/site-users');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const serverUsers = await response.json();
      let processedUsers = Array.isArray(serverUsers) ? serverUsers : 
                          serverUsers.users ? serverUsers.users : [];

      // Localiser w.belaidi et configurer les permissions
      const belaidiIndex = processedUsers.findIndex(u => u.username?.toLowerCase() === 'w.belaidi');
      
      if (belaidiIndex >= 0) {
        const belaidi = processedUsers[belaidiIndex];
        
        // Charger les permissions existantes de w.belaidi depuis le serveur
        try {
          const permResponse = await fetch(`/api/site-users/${belaidi.id}/permissions`);
          if (permResponse.ok) {
            const permData = await permResponse.json();
            // Convertir format DB vers format UI
            const uiPermissions = permData.permissions.map(p => ({
              id: p.id,
              module: p.resource,
              access: (p.actions || []).map(a => {
                const map = { 'READ': 'read', 'CREATE': 'create', 'UPDATE': 'edit', 'DELETE': 'delete' };
                return map[a] || a.toLowerCase();
              }),
              reason: p.reason
            }));
            belaidi.permissions = uiPermissions;
            console.log('✅ Permissions w.belaidi chargées du serveur:', uiPermissions.length);
          }
        } catch (e) {
          console.warn('⚠️ Pas de permissions trouvées pour w.belaidi, création automatique...');
          // Créer les droits complets automatiquement
          belaidi.permissions = [{
            id: 'belaidi_full_access',
            module: 'ALL',
            access: ['read', 'create', 'edit', 'delete'],
            reason: '👑 Accès administrateur complet'
          }];
        }
        
        belaidi.role = belaidi.role || 'ADMIN';
        console.log('✅ w.belaidi trouvé et configuré');
      }

      // Normaliser les permissions pour tous les utilisateurs
      processedUsers = processedUsers.map(u => ({
        id: u.id,
        username: u.username,
        firstName: u.firstName || u.firstname || 'N/A',
        lastName: u.lastName || u.lastname || 'N/A',
        email: u.email,
        role: u.role || 'MEMBER',
        permissions: u.permissions || []
      }));

      setUsers(processedUsers);
      console.log('✅ Utilisateurs chargés du serveur:', processedUsers.length);
    } catch (error) {
      console.error('❌ Erreur chargement utilisateurs:', error);
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sauvegarder les données sur le serveur
  const saveUsers = async (newUsers) => {
    try {
      setUsers(newUsers);
      
      // Sauvegarder les permissions pour chaque utilisateur
      const savePromises = newUsers
        .filter(u => u.permissions && u.permissions.length > 0)
        .map(async (user) => {
          try {
            const response = await fetch(`/api/site-users/${user.id}/permissions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ permissions: user.permissions })
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            console.log(`✅ Permissions ${user.username} sauvegardées: ${result.count} droits`);
            return result;
          } catch (error) {
            console.error(`❌ Erreur sauvegarde ${user.username}:`, error);
            throw error;
          }
        });

      const results = await Promise.allSettled(savePromises);
      const failed = results.filter(r => r.status === 'rejected').length;
      const succeeded = results.filter(r => r.status === 'fulfilled').length;

      if (failed === 0) {
        toast({
          title: '✅ Tous les droits sauvegardés',
          status: 'success',
          duration: 1500
        });
      } else {
        toast({
          title: `⚠️ ${succeeded} sauvegardés, ${failed} échoués`,
          status: 'warning',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde globale:', error);
      toast({
        title: '❌ Erreur de sauvegarde',
        description: 'Vérifiez la connexion serveur',
        status: 'error',
        duration: 2000
      });
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser({ ...user });
    setFormRole(user.role || 'MEMBER');
    onOpen();
  };

  const handleChangeRole = () => {
    if (!selectedUser || formRole === selectedUser.role) return;

    const updated = users.map(u => 
      u.id === selectedUser.id ? { ...u, role: formRole } : u
    );
    
    setSelectedUser({ ...selectedUser, role: formRole });
    saveUsers(updated);
  };

  const handleAddPermission = () => {
    setEditingPermId(null);
    setFormPerm({ module: '', access: [], reason: '' });
    onAddPermOpen();
  };

  const handleEditPermission = (perm) => {
    setEditingPermId(perm.id);
    setFormPerm({
      module: perm.module,
      access: perm.access || [],
      reason: perm.reason || ''
    });
    onAddPermOpen();
  };

  const handleSavePermission = () => {
    if (!formPerm.module || !formPerm.access.length) {
      toast({
        title: 'Erreur',
        description: 'Module et droits requis',
        status: 'error',
        duration: 2000
      });
      return;
    }

    const newPerm = {
      id: editingPermId || `perm_${Date.now()}`,
      module: formPerm.module,
      access: formPerm.access,
      reason: formPerm.reason
    };

    const updatedUser = {
      ...selectedUser,
      permissions: editingPermId
        ? (selectedUser.permissions || []).map(p => p.id === editingPermId ? newPerm : p)
        : [...(selectedUser.permissions || []), newPerm]
    };

    setSelectedUser(updatedUser);

    const updatedUsers = users.map(u => u.id === selectedUser.id ? updatedUser : u);
    saveUsers(updatedUsers);

    onAddPermClose();
  };

  const handleDeletePermission = (permId) => {
    const updatedUser = {
      ...selectedUser,
      permissions: (selectedUser.permissions || []).filter(p => p.id !== permId)
    };

    setSelectedUser(updatedUser);

    const updatedUsers = users.map(u => u.id === selectedUser.id ? updatedUser : u);
    saveUsers(updatedUsers);
  };

  const handleAddUser = () => {
    const newUser = {
      id: Date.now(),
      username: `user_${Date.now()}`,
      email: 'new@example.com',
      firstName: 'Nouveau',
      lastName: 'Utilisateur',
      role: 'MEMBER',
      permissions: []
    };
    
    const updatedUsers = [...users, newUser];
    saveUsers(updatedUsers);
    toast({
      title: '✅ Utilisateur ajouté',
      status: 'success',
      duration: 1500
    });
  };

  return (
    <VStack spacing={8} align="stretch">
      {/* Rôles Métier */}
      <Card>
        <CardHeader>
          <Heading size="lg">📋 Rôles Métier Disponibles</Heading>
        </CardHeader>
        <Divider />
        <CardBody>
          <Text fontSize="sm" color="gray.600" mb={4}>
            Les rôles métier sont des classifications. Les droits d'accès sont définis individuellement par module.
          </Text>
          <Grid templateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap={3}>
            {rolesInfo.map(role => (
              <Box key={role.code} p={3} border="1px" borderColor="gray.300" borderRadius="md" bg="gray.50">
                <Badge colorScheme={role.color || 'gray'} mb={2}>{role.code}</Badge>
                <Text fontSize="sm" fontWeight="bold">{role.label}</Text>
              </Box>
            ))}
          </Grid>
        </CardBody>
      </Card>

      {/* Utilisateurs */}
      <Card>
        <CardHeader>
          <HStack justify="space-between">
            <Heading size="lg">👥 Utilisateurs & Droits</Heading>
            <HStack>
              <Badge colorScheme="blue">{users.length}</Badge>
              <Button size="sm" colorScheme="green" leftIcon={<AddIcon />} onClick={handleAddUser}>
                Ajouter
              </Button>
            </HStack>
          </HStack>
        </CardHeader>
        <Divider />
        <CardBody>
          <Box overflowX="auto">
            <Table size="sm" variant="striped">
              <Thead bg="gray.100">
                <Tr>
                  <Th>Nom</Th>
                  <Th>Email</Th>
                  <Th>Rôle Métier</Th>
                  <Th>Droits par Module</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {users.map((user) => (
                  <Tr key={user.id}>
                    <Td fontWeight="medium">{user.firstName} {user.lastName}</Td>
                    <Td fontSize="sm">{user.email}</Td>
                    <Td>
                      <Badge colorScheme="purple">{user.role}</Badge>
                    </Td>
                    <Td>
                      {user.permissions?.length > 0 ? (
                        <Badge colorScheme="green">{user.permissions.length}</Badge>
                      ) : (
                        <Text fontSize="xs" color="gray.500">-</Text>
                      )}
                    </Td>
                    <Td>
                      <Button size="sm" colorScheme="blue" onClick={() => handleSelectUser(user)}>
                        Gérer
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </CardBody>
      </Card>

      {/* Modal Gérer Utilisateur */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Gérer: {selectedUser?.firstName} {selectedUser?.lastName}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedUser && (
              <VStack spacing={6}>
                {/* Rôle Métier */}
                <Box w="100%" p={4} bg="gray.50" borderRadius="md">
                  <HStack spacing={4}>
                    <FormControl flex={1}>
                      <FormLabel fontWeight="bold">Rôle Métier</FormLabel>
                      <Select value={formRole} onChange={(e) => setFormRole(e.target.value)}>
                        {rolesInfo.map(r => (
                          <option key={r.code} value={r.code}>{r.label}</option>
                        ))}
                      </Select>
                    </FormControl>
                    <Button colorScheme="blue" mt={6} onClick={handleChangeRole} isDisabled={formRole === selectedUser.role}>
                      Sauvegarder
                    </Button>
                  </HStack>
                </Box>

                {/* Droits par Module */}
                <Box w="100%">
                  <HStack justify="space-between" mb={4}>
                    <Heading size="sm">📊 Droits d'Accès par Module</Heading>
                    <Button size="sm" colorScheme="green" leftIcon={<AddIcon />} onClick={handleAddPermission}>
                      Ajouter Droit
                    </Button>
                  </HStack>

                  {selectedUser.permissions?.length === 0 ? (
                    <Text fontSize="sm" color="gray.500" textAlign="center" py={6} bg="gray.50" borderRadius="md">
                      Aucun droit d'accès défini
                    </Text>
                  ) : (
                    <Stack spacing={3}>
                      {(selectedUser.permissions || []).map(perm => (
                        <Box key={perm.id} p={3} border="2px" borderColor="blue.200" borderRadius="md" bg="blue.50">
                          <HStack justify="space-between" mb={2}>
                            <VStack align="start" spacing={1}>
                              <Text fontWeight="bold" fontSize="sm">
                                {MODULES.find(m => m.id === perm.module)?.label}
                              </Text>
                              <HStack gap={1}>
                                {perm.access.map(a => (
                                  <Badge key={a} colorScheme="blue" fontSize="xs">
                                    {ACCESS_TYPES.find(t => t.value === a)?.label}
                                  </Badge>
                                ))}
                              </HStack>
                            </VStack>
                            <HStack>
                              <IconButton size="sm" icon={<EditIcon />} variant="ghost" onClick={() => handleEditPermission(perm)} />
                              <IconButton size="sm" icon={<DeleteIcon />} variant="ghost" colorScheme="red" onClick={() => handleDeletePermission(perm.id)} />
                            </HStack>
                          </HStack>
                          {perm.reason && <Text fontSize="xs" color="gray.600" mt={2}>💭 {perm.reason}</Text>}
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Fermer</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Ajouter/Éditer Droit */}
      <Modal isOpen={isAddPermOpen} onClose={onAddPermClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editingPermId ? '✏️ Modifier Droit' : '➕ Ajouter Droit'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel fontWeight="bold">Module</FormLabel>
                <Select value={formPerm.module} onChange={(e) => setFormPerm({ ...formPerm, module: e.target.value })} placeholder="Sélectionner...">
                  {MODULES.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontWeight="bold">Droits d'Accès</FormLabel>
                <CheckboxGroup value={formPerm.access} onChange={(values) => setFormPerm({ ...formPerm, access: values })}>
                  <Stack>
                    {ACCESS_TYPES.map(t => (
                      <Checkbox key={t.value} value={t.value}>{t.label}</Checkbox>
                    ))}
                  </Stack>
                </CheckboxGroup>
              </FormControl>

              <FormControl>
                <FormLabel>Raison / Justification</FormLabel>
                <Input 
                  placeholder="Ex: Accès pour projet X" 
                  value={formPerm.reason} 
                  onChange={(e) => setFormPerm({ ...formPerm, reason: e.target.value })} 
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="outline" onClick={onAddPermClose}>Annuler</Button>
              <Button colorScheme="blue" onClick={handleSavePermission}>
                {editingPermId ? 'Mettre à jour' : 'Ajouter'}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Info */}
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        <Box>
          <Text fontWeight="bold" fontSize="sm">💡 Système de Droits</Text>
          <Text fontSize="xs" color="gray.700" mt={1}>
            ✓ <strong>Rôle Métier</strong> = Classification (Président, Bénévole, etc.)<br/>
            ✓ <strong>Droits</strong> = Définis manuellement par module et par personne<br/>
            ✓ <strong>Stockage</strong> = Sauvegardé localement (localStorage)
          </Text>
        </Box>
      </Alert>
    </VStack>
  );
}
