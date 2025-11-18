import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  VStack,
  HStack,
  Input,
  Textarea,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  useToast,
  Select,
  Divider,
  Text,
  Badge
} from '@chakra-ui/react';
import { fetchJson } from '../apiClient';

/**
 * TemplatePreview - Affiche l'aperçu live d'un template de devis
 * avec remplacage des variables
 */
export function QuoteTemplatePreview({ template, data = {} }) {
  const [previewHtml, setPreviewHtml] = useState('');

  // Remplacer les placeholders par les données
  const generatePreview = useMemo(() => {
    if (!template?.htmlContent) return '';

    let html = template.htmlContent;

    // Remplacer les variables {{VAR}} par les données
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      html = html.replace(new RegExp(placeholder, 'g'), value || '');
    });

    return html;
  }, [template, data]);

  return (
    <Box>
      <Box
        border="1px solid #ccc"
        borderRadius="md"
        p={4}
        bg="white"
        maxH="600px"
        overflowY="auto"
        dangerouslySetInnerHTML={{ __html: generatePreview }}
      />
    </Box>
  );
}

/**
 * QuoteTemplateManager - Gestion des templates de devis
 */
export default function QuoteTemplateManager() {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    htmlContent: '',
    isDefault: false
  });
  const [logoSmallFile, setLogoSmallFile] = useState(null);
  const [logoBigFile, setLogoBigFile] = useState(null);
  const [loading, setLoading] = useState(false);

  // Charger les templates
  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await fetchJson('/api/quote-templates');
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
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
  };

  React.useEffect(() => {
    loadTemplates();
  }, []);

  // Convertir fichier en base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  // Sauvegarder un template
  const handleSave = async () => {
    try {
      setLoading(true);

      // Convertir les logos en base64 si fournis
      let logoSmall = formData.logoSmall;
      let logoBig = formData.logoBig;

      if (logoSmallFile) {
        logoSmall = await fileToBase64(logoSmallFile);
      }
      if (logoBigFile) {
        logoBig = await fileToBase64(logoBigFile);
      }

      const payload = {
        ...formData,
        logoSmall,
        logoBig
      };

      if (selectedTemplate?.id) {
        // Mettre à jour
        await fetchJson(`/api/quote-templates/${selectedTemplate.id}`, {
          method: 'PUT',
          body: payload
        });
        toast({
          title: 'Template mis à jour',
          status: 'success',
          duration: 2000
        });
      } else {
        // Créer
        await fetchJson('/api/quote-templates', {
          method: 'POST',
          body: payload
        });
        toast({
          title: 'Template créé',
          status: 'success',
          duration: 2000
        });
      }

      onClose();
      loadTemplates();
      resetForm();
    } catch (error) {
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
  };

  // Éditer un template
  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      htmlContent: template.htmlContent,
      isDefault: template.isDefault,
      logoSmall: template.logoSmall,
      logoBig: template.logoBig
    });
    onOpen();
  };

  // Supprimer un template
  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr?')) return;

    try {
      await fetchJson(`/api/quote-templates/${id}`, {
        method: 'DELETE'
      });
      toast({
        title: 'Template supprimé',
        status: 'success',
        duration: 2000
      });
      loadTemplates();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error.message,
        status: 'error'
      });
    }
  };

  const resetForm = () => {
    setSelectedTemplate(null);
    setFormData({
      name: '',
      description: '',
      htmlContent: '',
      isDefault: false
    });
    setLogoSmallFile(null);
    setLogoBigFile(null);
  };

  return (
    <VStack spacing={4} align="stretch">
      <HStack justify="space-between">
        <Heading size="md">📄 Templates de Devis</Heading>
        <Button
          colorScheme="blue"
          onClick={() => {
            resetForm();
            onOpen();
          }}
        >
          + Nouveau Template
        </Button>
      </HStack>

      {/* Liste des templates */}
      {templates.map((template) => (
        <Card key={template.id}>
          <CardBody>
            <HStack justify="space-between" align="start">
              <VStack align="start" spacing={1}>
                <Heading size="sm">{template.name}</Heading>
                {template.description && (
                  <Text fontSize="sm" color="gray.600">
                    {template.description}
                  </Text>
                )}
                {template.isDefault && (
                  <Badge colorScheme="green">Par défaut</Badge>
                )}
              </VStack>
              <HStack>
                <Button
                  size="sm"
                  onClick={() => handleEdit(template)}
                >
                  Éditer
                </Button>
                <Button
                  size="sm"
                  colorScheme="red"
                  onClick={() => handleDelete(template.id)}
                >
                  Supprimer
                </Button>
              </HStack>
            </HStack>
          </CardBody>
        </Card>
      ))}

      {/* Modal d'édition */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalOverlay />
        <ModalContent maxH="90vh" overflowY="auto">
          <ModalHeader>
            {selectedTemplate ? 'Éditer Template' : 'Nouveau Template'}
          </ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              {/* Nom */}
              <Box width="100%">
                <Text fontWeight="bold">Nom du template</Text>
                <Input
                  placeholder="Ex: Template Standard RétroBus"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </Box>

              {/* Description */}
              <Box width="100%">
                <Text fontWeight="bold">Description</Text>
                <Textarea
                  placeholder="Description optionnelle"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                />
              </Box>

              <Divider />

              {/* Upload logos */}
              <Box width="100%">
                <Text fontWeight="bold">Logo Petit (23.4mm)</Text>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setLogoSmallFile(e.target.files?.[0] || null)
                  }
                />
              </Box>

              <Box width="100%">
                <Text fontWeight="bold">Logo Gros (68mm)</Text>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setLogoBigFile(e.target.files?.[0] || null)
                  }
                />
              </Box>

              <Divider />

              {/* HTML Content */}
              <Box width="100%">
                <Text fontWeight="bold">Contenu HTML</Text>
                <Textarea
                  placeholder="Collez votre HTML ici..."
                  value={formData.htmlContent}
                  onChange={(e) =>
                    setFormData({ ...formData, htmlContent: e.target.value })
                  }
                  rows={12}
                  fontFamily="monospace"
                  fontSize="sm"
                />
                <Text fontSize="xs" color="gray.500" mt={2}>
                  Utilisez {{'{{'}}VARIABLE{{'}}'}} pour les placeholders
                </Text>
              </Box>

              {/* Aperçu */}
              {formData.htmlContent && (
                <Box width="100%">
                  <Text fontWeight="bold" mb={2}>
                    Aperçu
                  </Text>
                  <QuoteTemplatePreview
                    template={{ htmlContent: formData.htmlContent }}
                    data={{
                      NUM_DEVIS: '2025-001',
                      OBJET: 'Service de Transport',
                      DESTINATAIRE_NOM: 'M. Client',
                      RNA: '0000000000',
                      SIREN: '123456789'
                    }}
                  />
                </Box>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleSave}
                isLoading={loading}
              >
                Sauvegarder
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}
