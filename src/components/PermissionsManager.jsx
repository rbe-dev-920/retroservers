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
  const [debugInfo, setDebugInfo] = useState('');
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
      setLoading(true);
      setDebugInfo('Chargement...');
      
      const response = await fetch('/api/site-users');
      const data = await response.json();
      
      setDebugInfo(`✅ Reçu ${Array.isArray(data) ? data.length : 0} utilisateurs`);
      
      // Garder directement les utilisateurs de l'API
      if (Array.isArray(data)) {
        setUsers(data);
        console.log('✅ Utilisateurs chargés:', data.length);
      } else {
        console.error('❌ Format inattendu:', data);
        setDebugInfo(`❌ Format inattendu: ${typeof data}`);
        setUsers([]);
      }
    } catch (error) {
      console.error('❌ Erreur:', error);
      setDebugInfo(`❌ Erreur: ${error.message}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectUser = (user) => {
    setSelectedUser({ ...user });
    setFormRole(user.role || 'MEMBER');
    // TODO: Ouvrir modal de gestion
    toast({
      title: 'Fonctionnalité en développement',
      description: `Gestion de ${user.firstName} ${user.lastName}`,
      status: 'info',
      duration: 2000
    });
  };

  if (loading) {
    return (
      <Card>
        <CardBody>
          <Text textAlign="center" py={8}>
            ⏳ Chargement des utilisateurs...
          </Text>
        </CardBody>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardBody>
          <VStack spacing={4}>
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              <Box>
                <Text fontWeight="bold">❌ Aucun utilisateur chargé</Text>
                <Text fontSize="sm" mt={2}>{debugInfo}</Text>
              </Box>
            </Alert>
            <Button colorScheme="blue" onClick={() => loadData()}>
              Réessayer
            </Button>
          </VStack>
        </CardBody>
      </Card>
    );
  }

  return (
    <VStack spacing={8} align="stretch">
      {/* Info de débogage */}
      <Alert status="success" borderRadius="md">
        <AlertIcon />
        <Box>
          <Text fontWeight="bold">✅ {users.length} utilisateur(s) chargé(s)</Text>
          <Text fontSize="xs" color="gray.600" mt={1}>{debugInfo}</Text>
        </Box>
      </Alert>
      {/* Utilisateurs */}
      <Card>
        <CardHeader>
          <HStack justify="space-between">
            <Heading size="lg">👥 Utilisateurs</Heading>
            <Badge colorScheme="blue">{users.length}</Badge>
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
                  <Th>Rôle</Th>
                  <Th>Accès Interne</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {users.map((user) => (
                  <Tr key={user.id}>
                    <Td fontWeight="medium">
                      {user.firstName} {user.lastName}
                    </Td>
                    <Td fontSize="sm">{user.email}</Td>
                    <Td>
                      <Badge colorScheme="purple">{user.role}</Badge>
                    </Td>
                    <Td>
                      {user.hasInternalAccess ? (
                        <Badge colorScheme="green">✅ Oui</Badge>
                      ) : (
                        <Badge colorScheme="red">❌ Non</Badge>
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

      {/* Info */}
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        <Box>
          <Text fontWeight="bold" fontSize="sm">💡 Utilisateurs du système</Text>
          <Text fontSize="xs" color="gray.700" mt={1}>
            Affichage de tous les utilisateurs actifs du système
          </Text>
        </Box>
      </Alert>
    </VStack>
  );
}
