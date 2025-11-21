import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Input,
  Textarea,
  VStack,
  HStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  useDisclosure,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Select,
  Checkbox,
  Divider,
  Text,
  Badge,
  useToast,
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon, ViewIcon } from '@chakra-ui/icons';

const TemplateManagement = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [error, setError] = useState('');
  const toast = useToast();

  const createDisclosure = useDisclosure();
  const editDisclosure = useDisclosure();
  const previewDisclosure = useDisclosure();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    htmlContent: '',
    logoSmall: '',
    logoBig: '',
    isDefault: false,
  });

  // Charger les templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/quote-templates');
      if (!response.ok) throw new Error('Failed to load templates');
      const data = await response.json();
      setTemplates(data);
      setError('');
    } catch (err) {
      setError(err.message);
      toast({ title: 'Erreur', description: err.message, status: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      if (!formData.name || !formData.htmlContent) {
        toast({
          title: 'Erreur',
          description: 'Nom et contenu HTML requis',
          status: 'warning',
        });
        return;
      }

      const response = await fetch('/api/quote-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          createdBy: 'admin', // TODO: obtenir l'utilisateur actuel
        }),
      });

      if (!response.ok) throw new Error('Failed to create template');

      toast({
        title: 'Succès',
        description: 'Template créé avec succès',
        status: 'success',
      });

      loadTemplates();
      resetForm();
      createDisclosure.onClose();
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, status: 'error' });
    }
  };

  const handleUpdateTemplate = async () => {
    try {
      if (!formData.name || !formData.htmlContent) {
        toast({
          title: 'Erreur',
          description: 'Nom et contenu HTML requis',
          status: 'warning',
        });
        return;
      }

      // Préparer les données SANS les images (qui restent en base64)
      const dataToSend = {
        name: formData.name,
        description: formData.description,
        htmlContent: formData.htmlContent,
        isDefault: formData.isDefault,
        // Les images base64 doivent être filtrées si trop grandes
        ...(formData.logoSmall && formData.logoSmall.length < 500000 ? { logoSmall: formData.logoSmall } : {}),
        ...(formData.logoBig && formData.logoBig.length < 500000 ? { logoBig: formData.logoBig } : {}),
      };

      const response = await fetch(`/api/quote-templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to update template: ${errorData || response.statusText}`);
      }

      toast({
        title: 'Succès',
        description: 'Template mis à jour',
        status: 'success',
      });

      loadTemplates();
      resetForm();
      editDisclosure.onClose();
    } catch (err) {
      console.error('Error updating template:', err);
      toast({ title: 'Erreur', description: err.message, status: 'error' });
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce template?')) return;

    try {
      const response = await fetch(`/api/quote-templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete template');

      toast({
        title: 'Succès',
        description: 'Template supprimé',
        status: 'success',
      });

      loadTemplates();
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, status: 'error' });
    }
  };

  const handlePreview = async (template) => {
    try {
      const response = await fetch(`/api/quote-templates/${template.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to generate preview');

      const data = await response.json();
      setPreviewHtml(data.html);
      setSelectedTemplate(template);
      previewDisclosure.onOpen();
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, status: 'error' });
    }
  };

  const handleEditTemplate = (template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      htmlContent: template.htmlContent,
      logoSmall: template.logoSmall || '',
      logoBig: template.logoBig || '',
      isDefault: template.isDefault,
    });
    editDisclosure.onOpen();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      htmlContent: '',
      logoSmall: '',
      logoBig: '',
      isDefault: false,
    });
    setSelectedTemplate(null);
  };

  const openCreateModal = () => {
    resetForm();
    createDisclosure.onOpen();
  };

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        {/* En-tête */}
        <HStack justify="space-between">
          <Box>
            <Text fontSize="2xl" fontWeight="bold">
              Gestion des Templates de Documents
            </Text>
            <Text color="gray.500" fontSize="sm">
              Créez et personnalisez les templates HTML pour vos devis et factures
            </Text>
          </Box>
          <Button colorScheme="blue" onClick={openCreateModal}>
            + Nouveau Template
          </Button>
        </HStack>

        <Divider />

        {/* Liste des templates */}
        {loading ? (
          <Text>Chargement...</Text>
        ) : templates.length === 0 ? (
          <Box p={8} textAlign="center" bg="gray.50" borderRadius="md">
            <Text color="gray.500">Aucun template disponible</Text>
            <Button colorScheme="blue" mt={4} onClick={openCreateModal}>
              Créer le premier template
            </Button>
          </Box>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead>
                <Tr bg="gray.100">
                  <Th>Nom</Th>
                  <Th>Description</Th>
                  <Th>Défaut</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {templates.map(template => (
                  <Tr key={template.id} _hover={{ bg: 'gray.50' }}>
                    <Td fontWeight="600">{template.name}</Td>
                    <Td fontSize="sm">{template.description || '-'}</Td>
                    <Td>
                      {template.isDefault && <Badge colorScheme="yellow">Défaut</Badge>}
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <IconButton
                          icon={<ViewIcon />}
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePreview(template)}
                          title="Aperçu"
                        />
                        <IconButton
                          icon={<EditIcon />}
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditTemplate(template)}
                          title="Modifier"
                        />
                        <IconButton
                          icon={<DeleteIcon />}
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => handleDeleteTemplate(template.id)}
                          title="Supprimer"
                        />
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </VStack>

      {/* Modal Création */}
      <Modal isOpen={createDisclosure.isOpen} onClose={createDisclosure.onClose} size="2xl">
        <ModalOverlay />
        <ModalContent maxH="90vh" overflowY="auto">
          <ModalHeader>Créer un nouveau template de devis</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Input
                placeholder="Nom du template"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />

              <Textarea
                placeholder="Description (optionnel)"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />

              <Box w="full">
                <Text fontSize="sm" fontWeight="600" mb={2}>
                  Contenu HTML *
                </Text>
                <Textarea
                  placeholder='Exemple: <h1>{{TITRE}}</h1><p>Montant: {{MONTANT}} €</p>'
                  value={formData.htmlContent}
                  onChange={e => setFormData({ ...formData, htmlContent: e.target.value })}
                  minH="150px"
                  fontFamily="mono"
                  fontSize="xs"
                />
              </Box>

              <Box w="full">
                <Text fontSize="sm" fontWeight="600" mb={2}>
                  Logo Petit (optionnel)
                </Text>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setFormData({ ...formData, logoSmall: event.target.result });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {formData.logoSmall && (
                  <Box mt={2}>
                    <img src={formData.logoSmall} alt="Logo petit" style={{ maxHeight: '50px' }} />
                  </Box>
                )}
              </Box>

              <Box w="full">
                <Text fontSize="sm" fontWeight="600" mb={2}>
                  Logo Grand (optionnel)
                </Text>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setFormData({ ...formData, logoBig: event.target.result });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {formData.logoBig && (
                  <Box mt={2}>
                    <img src={formData.logoBig} alt="Logo grand" style={{ maxHeight: '100px' }} />
                  </Box>
                )}
              </Box>

              <HStack>
                <Checkbox
                  isChecked={formData.isDefault}
                  onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                >
                  Définir comme template par défaut
                </Checkbox>
              </HStack>

              <Box p={3} bg="blue.50" borderRadius="md" w="full">
                <Text fontSize="xs" fontWeight="600" mb={2}>
                  Variables disponibles:
                </Text>
                <Text fontSize="xs" fontFamily="mono">
                  {'{{NUM_DEVIS}}, {{TITRE}}, {{MONTANT}}, {{DATE}}, {{DESCRIPTION}}, {{DESTINATAIRE_NOM}}, {{DESTINATAIRE_ADRESSE}}, {{NOTES}}, {{LOGO_BIG}}, {{LOGO_SMALL}}'}
                </Text>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={createDisclosure.onClose}>
              Annuler
            </Button>
            <Button colorScheme="blue" onClick={handleCreateTemplate}>
              Créer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Édition */}
      <Modal isOpen={editDisclosure.isOpen} onClose={editDisclosure.onClose} size="2xl">
        <ModalOverlay />
        <ModalContent maxH="90vh" overflowY="auto">
          <ModalHeader>Modifier le template</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Input
                placeholder="Nom du template"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />

              <Textarea
                placeholder="Description (optionnel)"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />

              <Box w="full">
                <Text fontSize="sm" fontWeight="600" mb={2}>
                  Contenu HTML *
                </Text>
                <Textarea
                  placeholder='Exemple: <h1>{{TITRE}}</h1><p>Montant: {{MONTANT}} €</p>'
                  value={formData.htmlContent}
                  onChange={e => setFormData({ ...formData, htmlContent: e.target.value })}
                  minH="150px"
                  fontFamily="mono"
                  fontSize="xs"
                />
              </Box>

              <Box w="full">
                <Text fontSize="sm" fontWeight="600" mb={2}>
                  Logo Petit (optionnel)
                </Text>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setFormData({ ...formData, logoSmall: event.target.result });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {formData.logoSmall && (
                  <Box mt={2}>
                    <img src={formData.logoSmall} alt="Logo petit" style={{ maxHeight: '50px' }} />
                  </Box>
                )}
              </Box>

              <Box w="full">
                <Text fontSize="sm" fontWeight="600" mb={2}>
                  Logo Grand (optionnel)
                </Text>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setFormData({ ...formData, logoBig: event.target.result });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {formData.logoBig && (
                  <Box mt={2}>
                    <img src={formData.logoBig} alt="Logo grand" style={{ maxHeight: '100px' }} />
                  </Box>
                )}
              </Box>

              <HStack>
                <Checkbox
                  isChecked={formData.isDefault}
                  onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                >
                  Définir comme template par défaut
                </Checkbox>
              </HStack>

              <Box p={3} bg="blue.50" borderRadius="md" w="full">
                <Text fontSize="xs" fontWeight="600" mb={2}>
                  Variables disponibles:
                </Text>
                <Text fontSize="xs" fontFamily="mono">
                  {'{{NUM_DEVIS}}, {{TITRE}}, {{MONTANT}}, {{DATE}}, {{DESCRIPTION}}, {{DESTINATAIRE_NOM}}, {{DESTINATAIRE_ADRESSE}}, {{NOTES}}, {{LOGO_BIG}}, {{LOGO_SMALL}}'}
                </Text>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={editDisclosure.onClose}>
              Annuler
            </Button>
            <Button colorScheme="blue" onClick={handleUpdateTemplate}>
              Mettre à jour
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Aperçu */}
      <Modal isOpen={previewDisclosure.isOpen} onClose={previewDisclosure.onClose} size="4xl">
        <ModalOverlay />
        <ModalContent maxH="90vh">
          <ModalHeader>Aperçu du template: {selectedTemplate?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box
              p={6}
              bg="white"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="md"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
              overflowY="auto"
              maxH="60vh"
            />
          </ModalBody>
          <ModalFooter>
            <Button onClick={previewDisclosure.onClose}>Fermer</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default TemplateManagement;
