import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Input,
  Textarea,
  FormControl,
  FormLabel,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Badge,
  IconButton,
  Flex,
  Spacer,
  Alert,
  AlertIcon,
  Spinner,
  Center,
  Switch,
  Select,
  Grid,
  GridItem,
  Tooltip,
  useColorModeValue
} from '@chakra-ui/react';
import { 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaEye, 
  FaEyeSlash, 
  FaBullhorn,
  FaExternalLinkAlt,
  FaClock,
  FaInfoCircle,
  FaExclamationTriangle,
  FaCheckCircle
} from 'react-icons/fa';
import { apiClient } from '../api/config';

const FLASH_TYPES = {
  info: { 
    label: 'Information', 
    color: 'blue', 
    icon: FaInfoCircle 
  },
  warning: { 
    label: 'Attention', 
    color: 'orange', 
    icon: FaExclamationTriangle 
  },
  success: { 
    label: 'Succès', 
    color: 'green', 
    icon: FaCheckCircle 
  },
  error: { 
    label: 'Erreur', 
    color: 'red', 
    icon: FaExclamationTriangle 
  }
};

export default function FlashManagement() {
  const [flashes, setFlashes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlash, setSelectedFlash] = useState(null);
  const [formData, setFormData] = useState({
    content: '',
    type: 'info',
    active: true,
    showOnExternal: false,
    expiresAt: ''
  });
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Couleurs pour le mode sombre/clair
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Charger les flashs
  const fetchFlashes = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/flashes');
      
      if (Array.isArray(response)) {
        setFlashes(response);
      } else {
        console.warn('Réponse inattendue de l\'API:', response);
        setFlashes([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des flashs:', error);
      setFlashes([]);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les flashs',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlashes();
  }, []);

  // Réinitialiser le formulaire
  const resetForm = () => {
    setFormData({
      content: '',
      type: 'info',
      active: true,
      showOnExternal: false,
      expiresAt: ''
    });
    setSelectedFlash(null);
  };

  // Ouvrir le modal pour créer
  const handleCreate = () => {
    resetForm();
    onOpen();
  };

  // Ouvrir le modal pour éditer
  const handleEdit = (flash) => {
    setSelectedFlash(flash);
    setFormData({
      content: flash.content || '',
      type: flash.type || 'info',
      active: flash.active !== undefined ? flash.active : true,
      showOnExternal: flash.showOnExternal || false,
      expiresAt: flash.expiresAt ? new Date(flash.expiresAt).toISOString().slice(0, 16) : ''
    });
    onOpen();
  };

  // Sauvegarder le flash
  const handleSave = async () => {
    try {
      // Validation
      if (!formData.content.trim()) {
        toast({
          title: 'Erreur de validation',
          description: 'Le contenu du flash est requis',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      const payload = {
        ...formData,
        expiresAt: formData.expiresAt || null
      };

      if (selectedFlash) {
        // Mise à jour
        await apiClient.put(`/flashes/${selectedFlash.id}`, payload);
        toast({
          title: 'Succès',
          description: 'Flash mis à jour avec succès',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        // Création
        await apiClient.post('/flashes', payload);
        toast({
          title: 'Succès',
          description: 'Flash créé avec succès',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }

      fetchFlashes();
      onClose();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder le flash',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Toggle actif/inactif
  const handleToggle = async (flash) => {
    try {
      await apiClient.patch(`/flashes/${flash.id}/toggle`);
      toast({
        title: 'Succès',
        description: `Flash ${flash.active ? 'désactivé' : 'activé'}`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
      fetchFlashes();
    } catch (error) {
      console.error('Erreur lors du toggle:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier le statut',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Supprimer un flash
  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce flash ?')) {
      return;
    }

    try {
      await apiClient.delete(`/flashes/${id}`);
      toast({
        title: 'Succès',
        description: 'Flash supprimé avec succès',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchFlashes();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le flash',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Vérifier si le flash est expiré
  const isExpired = (flash) => {
    if (!flash.expiresAt) return false;
    return new Date(flash.expiresAt) < new Date();
  };

  if (loading) {
    return (
      <Center minH="400px">
        <VStack>
          <Spinner size="xl" color="var(--rbe-red)" />
          <Text>Chargement des flashs...</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box p={6}>
      <Flex mb={6} align="center">
        <HStack spacing={3}>
          <FaBullhorn color="var(--rbe-red)" size={24} />
          <Heading size="lg">Gestion des Flashs Info</Heading>
        </HStack>
        <Spacer />
        <Button leftIcon={<FaPlus />} colorScheme="blue" onClick={handleCreate}>
          Nouveau Flash
        </Button>
      </Flex>

      {/* Statistiques */}
      <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4} mb={6}>
        <Card bg={cardBg} borderWidth={1} borderColor={borderColor}>
          <CardBody>
            <HStack>
              <FaBullhorn color="blue" />
              <VStack align="start" spacing={0}>
                <Text fontSize="sm" color="gray.500">Total</Text>
                <Text fontSize="2xl" fontWeight="bold">{flashes.length}</Text>
              </VStack>
            </HStack>
          </CardBody>
        </Card>
        
        <Card bg={cardBg} borderWidth={1} borderColor={borderColor}>
          <CardBody>
            <HStack>
              <FaEye color="green" />
              <VStack align="start" spacing={0}>
                <Text fontSize="sm" color="gray.500">Actifs</Text>
                <Text fontSize="2xl" fontWeight="bold" color="green.500">
                  {flashes.filter(f => f.active && !isExpired(f)).length}
                </Text>
              </VStack>
            </HStack>
          </CardBody>
        </Card>

        <Card bg={cardBg} borderWidth={1} borderColor={borderColor}>
          <CardBody>
            <HStack>
              <FaExternalLinkAlt color="purple" />
              <VStack align="start" spacing={0}>
                <Text fontSize="sm" color="gray.500">Sur l'externe</Text>
                <Text fontSize="2xl" fontWeight="bold" color="purple.500">
                  {flashes.filter(f => f.showOnExternal && f.active && !isExpired(f)).length}
                </Text>
              </VStack>
            </HStack>
          </CardBody>
        </Card>

        <Card bg={cardBg} borderWidth={1} borderColor={borderColor}>
          <CardBody>
            <HStack>
              <FaClock color="orange" />
              <VStack align="start" spacing={0}>
                <Text fontSize="sm" color="gray.500">Expirés</Text>
                <Text fontSize="2xl" fontWeight="bold" color="orange.500">
                  {flashes.filter(f => isExpired(f)).length}
                </Text>
              </VStack>
            </HStack>
          </CardBody>
        </Card>
      </Grid>

      <VStack spacing={4} align="stretch">
        {flashes.length === 0 ? (
          <Alert status="info">
            <AlertIcon />
            Aucun flash trouvé. Créez le premier !
          </Alert>
        ) : (
          flashes.map((flash) => {
            const typeConfig = FLASH_TYPES[flash.type] || FLASH_TYPES.info;
            const IconComponent = typeConfig.icon;
            const expired = isExpired(flash);

            return (
              <Card 
                key={flash.id} 
                bg={cardBg} 
                borderWidth={1} 
                borderColor={flash.active && !expired ? `${typeConfig.color}.200` : 'gray.300'}
                opacity={flash.active && !expired ? 1 : 0.6}
              >
                <CardHeader>
                  <Flex align="center">
                    <HStack spacing={3} flex={1}>
                      <IconComponent color={`var(--chakra-colors-${typeConfig.color}-500)`} />
                      <VStack align="start" spacing={1}>
                        <HStack spacing={2}>
                          <Badge colorScheme={typeConfig.color}>{typeConfig.label}</Badge>
                          {flash.active ? (
                            <Badge colorScheme="green">Actif</Badge>
                          ) : (
                            <Badge colorScheme="gray">Inactif</Badge>
                          )}
                          {flash.showOnExternal && (
                            <Badge colorScheme="purple" leftIcon={<FaExternalLinkAlt />}>
                              Externe
                            </Badge>
                          )}
                          {expired && (
                            <Badge colorScheme="red">Expiré</Badge>
                          )}
                        </HStack>
                        <Text fontSize="sm" color="gray.600">
                          Créé le {new Date(flash.createdAt).toLocaleDateString('fr-FR')}
                          {flash.expiresAt && (
                            <> • Expire le {new Date(flash.expiresAt).toLocaleDateString('fr-FR')}</>
                          )}
                        </Text>
                      </VStack>
                    </HStack>
                    <HStack spacing={1}>
                      <Tooltip label={flash.active ? 'Désactiver' : 'Activer'}>
                        <IconButton
                          icon={flash.active ? <FaEyeSlash /> : <FaEye />}
                          size="sm"
                          colorScheme={flash.active ? 'orange' : 'green'}
                          variant="ghost"
                          onClick={() => handleToggle(flash)}
                        />
                      </Tooltip>
                      <Tooltip label="Modifier">
                        <IconButton
                          icon={<FaEdit />}
                          size="sm"
                          colorScheme="blue"
                          variant="ghost"
                          onClick={() => handleEdit(flash)}
                        />
                      </Tooltip>
                      <Tooltip label="Supprimer">
                        <IconButton
                          icon={<FaTrash />}
                          size="sm"
                          colorScheme="red"
                          variant="ghost"
                          onClick={() => handleDelete(flash.id)}
                        />
                      </Tooltip>
                    </HStack>
                  </Flex>
                </CardHeader>
                <CardBody pt={0}>
                  <Text>{flash.content}</Text>
                </CardBody>
              </Card>
            );
          })
        )}
      </VStack>

      {/* Modal pour créer/éditer */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack>
              <FaBullhorn />
              <Text>{selectedFlash ? 'Modifier le flash' : 'Nouveau flash'}</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Type</FormLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                >
                  {Object.entries(FLASH_TYPES).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Contenu du message</FormLabel>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Message à afficher..."
                  rows={4}
                />
              </FormControl>

              <Grid templateColumns="1fr 1fr" gap={4} width="100%">
                <FormControl>
                  <FormLabel>Statut</FormLabel>
                  <HStack>
                    <Switch
                      isChecked={formData.active}
                      onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                    />
                    <Text>{formData.active ? 'Actif' : 'Inactif'}</Text>
                  </HStack>
                </FormControl>

                <FormControl>
                  <FormLabel>Afficher sur l'externe</FormLabel>
                  <HStack>
                    <Switch
                      isChecked={formData.showOnExternal}
                      onChange={(e) => setFormData(prev => ({ ...prev, showOnExternal: e.target.checked }))}
                    />
                    <Text>{formData.showOnExternal ? 'Oui' : 'Non'}</Text>
                  </HStack>
                </FormControl>
              </Grid>

              <FormControl>
                <FormLabel>Date d'expiration (optionnelle)</FormLabel>
                <Input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                />
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Laissez vide pour un flash permanent
                </Text>
              </FormControl>

              {formData.showOnExternal && (
                <Alert status="info">
                  <AlertIcon />
                  Ce flash sera visible sur le site public externe
                </Alert>
              )}
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Annuler
            </Button>
            <Button colorScheme="blue" onClick={handleSave}>
              {selectedFlash ? 'Mettre à jour' : 'Créer'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}