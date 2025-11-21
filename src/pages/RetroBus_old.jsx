import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box, Heading, Text, SimpleGrid, Stat, StatLabel, StatNumber, Card, CardBody,
  Tabs, TabList, TabPanels, Tab, TabPanel, useToast, Spinner, HStack, VStack,
  Badge, Tag, TagLabel, TagLeftIcon, Button, Divider, Table, Thead, Tbody, Tr, Th, Td,
  Icon, Progress, Alert, AlertIcon, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Slider, SliderTrack, SliderFilledTrack, SliderThumb, FormLabel
} from "@chakra-ui/react";
import { FiClock, FiAlertTriangle, FiTool, FiFileText, FiInfo, FiEdit, FiSliders, FiRefreshCw } from "react-icons/fi";
import WorkspaceLayout from "../components/Layout/WorkspaceLayout";
import { apiClient } from "../api/config";
import CaracteristiquesEditor from '../components/vehicle/CaracteristiquesEditor.jsx';
import { useNavigate } from "react-router-dom";

function EtatBadge({ etat }) {
  const colorMap = {
    disponible: "green",
    en_panne: "red",
    maintenance: "orange",
    Service: "green",
    Préservé: "blue",
    "A VENIR": "gray",
    Restauration: "orange",
  };
  return <Badge colorScheme={colorMap[etat] || "purple"}>{etat || "—"}</Badge>;
}

// Fonction utilitaire pour mettre à jour les caractéristiques d'un véhicule
async function updateVehicleCaracs(parc, caracs, toast) {
  try {
    await apiClient.put(`/vehicles/${encodeURIComponent(parc)}`, {
      caracteristiques: JSON.stringify(caracs)
    });
    toast({ status: 'success', title: 'Caractéristiques mises à jour' });
  } catch (e) {
    toast({ status: 'error', title: 'Erreur lors de la mise à jour', description: e.message });
  }
}

// Component: MaintenanceTab - Complete maintenance tracking interface
function MaintenanceTab({ vehicles, apiClient }) {
  const toast = useToast();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [maintenance, setMaintenance] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Modal for new maintenance
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    type: 'other',
    description: '',
    cost: '',
    mileage: '',
    performedBy: '',
    location: '',
    status: 'completed',
    notes: ''
  });
  
  // Modal for service schedule
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    serviceType: 'oil_change',
    description: '',
    frequency: 'yearly',
    priority: 'medium',
    notes: ''
  });

  const loadMaintenanceData = async (parc) => {
    try {
      setLoading(true);
      const [maintenanceData, scheduleData, summaryData] = await Promise.all([
        apiClient.get(`/vehicles/${encodeURIComponent(parc)}/maintenance`),
        apiClient.get(`/vehicles/${encodeURIComponent(parc)}/service-schedule`),
        apiClient.get(`/vehicles/${encodeURIComponent(parc)}/maintenance-summary`)
      ]);

      setMaintenance(Array.isArray(maintenanceData) ? maintenanceData : []);
      setSchedule(Array.isArray(scheduleData) ? scheduleData : []);
      setSummary(summaryData);
    } catch (e) {
      console.error('Error loading maintenance data:', e);
      toast({ status: 'error', title: 'Erreur de chargement', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleSelect = (v) => {
    const parc = v.parc || v.id || v.slug;
    setSelectedVehicle(parc);
    loadMaintenanceData(parc);
  };

  const handleAddMaintenance = async () => {
    if (!selectedVehicle || !maintenanceForm.type || !maintenanceForm.description) {
      toast({ status: 'warning', title: 'Formulaire incomplet' });
      return;
    }

    try {
      const response = await apiClient.post(
        `/vehicles/${encodeURIComponent(selectedVehicle)}/maintenance`,
        maintenanceForm
      );
      setMaintenance([response, ...maintenance]);
      setMaintenanceForm({ type: 'other', description: '', cost: '', mileage: '', performedBy: '', location: '', status: 'completed', notes: '' });
      setShowAddMaintenance(false);
      toast({ status: 'success', title: 'Entretien ajouté' });
      await loadMaintenanceData(selectedVehicle);
    } catch (e) {
      toast({ status: 'error', title: 'Erreur', description: e.message });
    }
  };

  const handleAddSchedule = async () => {
    if (!selectedVehicle || !scheduleForm.serviceType) {
      toast({ status: 'warning', title: 'Formulaire incomplet' });
      return;
    }

    try {
      const response = await apiClient.post(
        `/vehicles/${encodeURIComponent(selectedVehicle)}/service-schedule`,
        scheduleForm
      );
      setSchedule([response, ...schedule]);
      setScheduleForm({ serviceType: 'oil_change', description: '', frequency: 'yearly', priority: 'medium', notes: '' });
      setShowAddSchedule(false);
      toast({ status: 'success', title: 'Tâche programmée' });
      await loadMaintenanceData(selectedVehicle);
    } catch (e) {
      toast({ status: 'error', title: 'Erreur', description: e.message });
    }
  };

  const maintenanceTypes = {
    oil_change: { label: 'Vidange', color: 'blue' },
    tire_change: { label: 'Changement pneus', color: 'purple' },
    brake_service: { label: 'Service freins', color: 'red' },
    inspection: { label: 'Inspection', color: 'green' },
    repair: { label: 'Réparation', color: 'orange' },
    washing: { label: 'Lavage', color: 'cyan' },
    other: { label: 'Autre', color: 'gray' }
  };

  const statusColors = {
    completed: 'green',
    in_progress: 'yellow',
    pending: 'orange',
    cancelled: 'gray'
  };

  if (!selectedVehicle) {
    <VStack align="stretch" spacing={4}>
      {loading ? (
        <HStack spacing={3} pt={4}>
          <Spinner />
          <Text>Chargement des véhicules…</Text>
        </HStack>
      ) : (
        <>
          <Alert status="info">
            <AlertIcon />
            <VStack align="start" spacing={1}>
              <Text fontWeight="600">Infos techniques</Text>
              <Text fontSize="sm">
                Utilisez le bouton "Infos techniques" de chaque carte pour mettre à jour le niveau de gasoil et les caractéristiques.
              </Text>
            </VStack>
          </Alert>
          {vehicleCards || <Text mt={2}>Aucun véhicule pour le moment.</Text>}
        </>
      )}
    </VStack>
  );

  const renderHistorySection = () => (
    <VStack align="start" spacing={4} py={2}>
      <HStack justify="space-between" w="full">
        <HStack>
          <FiFileText />
          <Heading size="sm">Historique des usages</Heading>
        </HStack>
        <Button size="sm" onClick={loadAllUsages} isLoading={loadingUsages}>
          Charger
        </Button>
      </HStack>

      {loadingUsages ? (
        <HStack spacing={3}>
          <Spinner size="sm" />
          <Text>Chargement de l'historique...</Text>
        </HStack>
      ) : Object.keys(usagesData).length === 0 ? (
        <Alert status="info">
          <AlertIcon />
          Cliquez sur "Charger" pour afficher l'historique des usages
        </Alert>
      ) : (
        <VStack align="stretch" w="full" spacing={4}>
          {vehicles.map((v) => {
            const parc = v.parc || v.id || v.slug;
            const usages = usagesData[parc] || [];
            const completedUsages = usages.filter(u => u.endedAt);

            if (completedUsages.length === 0) return null;

            return (
              <Card key={parc} variant="outline">
                <CardBody>
                  <Heading size="sm" mb={3}>{parc} - {completedUsages.length} usage(s)</Heading>
                  <Table size="sm" variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Début</Th>
                        <Th>Fin</Th>
                        <Th>Conducteur</Th>
                        <Th>Note</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {completedUsages.slice(0, 5).map((usage) => (
                        <Tr key={usage.id}>
                          <Td>{new Date(usage.startedAt).toLocaleDateString('fr-FR')}</Td>
                          <Td>{usage.endedAt ? new Date(usage.endedAt).toLocaleDateString('fr-FR') : '-'}</Td>
                          <Td>{usage.conducteur || '-'}</Td>
                          <Td fontSize="sm" color="gray.600">{usage.note || '-'}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                  {completedUsages.length > 5 && (
                    <Text mt={2} fontSize="sm" color="gray.500">
                      ... et {completedUsages.length - 5} autres usage(s)
                    </Text>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </VStack>
      )}
    </VStack>
  );

  const renderMaintenanceSection = () => (
    <MaintenanceTab vehicles={vehicles} apiClient={apiClient} />
  );

  const renderAdministrativeSection = () => (
    <VStack align="start" spacing={3} py={2}>
      <HStack>
        <FiAlertTriangle />
        <Heading size="sm">Situation administrative</Heading>
      </HStack>
      <Alert status="warning">
        <AlertIcon />
        Cette section sera développée prochainement pour gérer : documents, assurances, contrôle technique, conformité.
      </Alert>
      <Text opacity={0.8}>
        En attendant, vous pouvez ajouter ces informations dans les notes de chaque véhicule via la page d'édition.
      </Text>
    </VStack>
  );

  const renderCheckinsSection = () => (
    <VStack align="start" spacing={4} py={2}>
      <HStack>
        <FiClock />
        <Heading size="sm">Pointages actifs</Heading>
      </HStack>

      {vehicles.filter(v => {
        const parc = v.parc || v.id || v.slug;
        return statusByParc[parc]?.active;
      }).length === 0 ? (
        <Alert status="info">
          <AlertIcon />
          Aucun pointage en cours actuellement
        </Alert>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} w="full">
          {vehicles.map((v) => {
            const parc = v.parc || v.id || v.slug;
            const status = statusByParc[parc];

            if (!status?.active) return null;

            const duration = status.startedAt
              ? Math.floor((Date.now() - new Date(status.startedAt).getTime()) / (1000 * 60))
              : 0;

            return (
              <Card key={parc} variant="outline" borderColor="purple.300">
                <CardBody>
                  <VStack align="start" spacing={2}>
                    <Heading size="sm">{parc}</Heading>
                    <HStack>
                      <Icon as={FiClock} color="purple.500" />
                      <Text fontSize="sm">
                        En cours depuis {duration} min
                      </Text>
                    </HStack>
                    {status.conducteur && (
                      <Text fontSize="sm" color="gray.600">
                        Conducteur: {status.conducteur}
                      </Text>
                    )}
                    <Button
                      size="sm"
                      colorScheme="purple"
                      onClick={() => navigate(`/mobile/v/${encodeURIComponent(parc)}`)}
                    >
                      Voir le pointage
                    </Button>
                  </VStack>
                </CardBody>
              </Card>
            );
          })}
        </SimpleGrid>
      )}
    </VStack>
  );

  const sections = [
    {
      id: 'vehicles',
      label: 'Parc véhicules',
      icon: FiTool,
      description: 'Vue d’ensemble',
      render: renderVehiclesSection
    },
    {
      id: 'history',
      label: 'Historique',
      icon: FiFileText,
      description: 'Usages récents',
      render: renderHistorySection
    },
    {
      id: 'maintenance',
      label: 'Entretien',
      icon: FiTool,
      description: 'Planification & suivi',
      render: renderMaintenanceSection
    },
    {
      id: 'administrative',
      label: 'Administratif',
      icon: FiAlertTriangle,
      description: 'Documents & obligations',
      render: renderAdministrativeSection
    },
    {
      id: 'checkins',
      label: 'Pointages',
      icon: FiClock,
      description: 'Sessions actives',
      render: renderCheckinsSection
    }
  ];

  const headerActions = [
    <Button
      key="refresh"
      leftIcon={<FiRefreshCw />}
      variant="outline"
      size="sm"
      onClick={reloadVehicles}
      isLoading={loading}
    >
      Actualiser
    </Button>,
    <Button
      key="manage"
      leftIcon={<FiEdit />}
      colorScheme="blue"
      size="sm"
      onClick={() => navigate('/dashboard/vehicules')}
    >
      Gestion complète
    </Button>
  ];

  return (
    <>
      <WorkspaceLayout
        title="RétroBus"
        subtitle="Suivi d'entretien, d'usages et de disponibilité du parc."
        sections={sections}
        defaultSectionId="vehicles"
        sidebarTitle="RétroBus"
        sidebarSubtitle="Parc & maintenance"
        sidebarTitleIcon={FiTool}
        versionLabel="RétroBus v3"
        headerActions={headerActions}
      />

      <Modal isOpen={editTechOpen} onClose={() => setEditTechOpen(false)} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Informations techniques : {editTechVehicle?.parc}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <FormLabel>Niveau actuel du gasoil (%)</FormLabel>
              <Box>
                <Box position="relative" h="60px" mb={6}>
                  <Box position="absolute" top="20px" left="0" right="0" h="2px" bg="gray.300" />
                  {[0, 50, 100].map((val) => (
                    <Box
                      key={val}
                      position="absolute"
                      left={`${val}%`}
                      top="12px"
                      transform="translateX(-50%)"
                      textAlign="center"
                    >
                      <Box w="3px" h="16px" bg="gray.800" mx="auto" mb={1} />
                      <Text fontSize="xs" fontWeight="bold">{val}%</Text>
                    </Box>
                  ))}
                  {Array.from({ length: 99 }).map((_, i) => {
                    const val = i + 1;
                    const isBig = val === 50;
                    if (isBig) return null;
                    return (
                      <Box
                        key={`small-${val}`}
                        position="absolute"
                        left={`${val}%`}
                        top="16px"
                        transform="translateX(-50%)"
                        w="1px"
                        h="8px"
                        bg="gray.400"
                      />
                    );
                  })}
                  <Box
                    position="absolute"
                    left={`${editTechGasoil}%`}
                    top="0"
                    transform="translateX(-50%)"
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                  >
                    <Text fontSize="sm" fontWeight="bold" color="blue.600">{editTechGasoil}%</Text>
                    <Box w="2px" h="20px" bg="blue.600" mt={1} />
                  </Box>
                </Box>

                <Slider value={editTechGasoil} onChange={setEditTechGasoil} min={0} max={100} step={1}>
                  <SliderTrack>
                    <SliderFilledTrack />
                  </SliderTrack>
                  <SliderThumb />
                </Slider>
              </Box>

              <Divider />
              <CaracteristiquesEditor caracs={editTechCaracs} onChange={setEditTechCaracs} />
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setEditTechOpen(false)}>Annuler</Button>
            <Button
              colorScheme="blue"
              isLoading={editTechSaving}
              onClick={async () => {
                try {
                  setEditTechSaving(true);
                  const nextCaracs = Array.isArray(editTechCaracs) ? [...editTechCaracs] : [];
                  const gasoilIdx = nextCaracs.findIndex(c => c.label === 'Niveau gasoil');
                  if (gasoilIdx >= 0) {
                    nextCaracs[gasoilIdx] = { ...nextCaracs[gasoilIdx], value: String(editTechGasoil) };
                  } else {
                    nextCaracs.push({ label: 'Niveau gasoil', value: String(editTechGasoil) });
                  }

                  await apiClient.put(`/vehicles/${encodeURIComponent(editTechVehicle.parc)}`, {
                    caracteristiques: JSON.stringify(nextCaracs)
                  });

                  setVehicles(prev => prev.map(v => {
                    const parcKey = v.parc || v.id || v.slug;
                    if (parcKey === editTechVehicle.parc) {
                      return { ...v, caracteristiques: JSON.stringify(nextCaracs) };
                    }
                    return v;
                  }));

                  toast({ status: 'success', title: 'Caractéristiques mises à jour' });
                  setEditTechSaving(false);
                  setEditTechOpen(false);
                } catch (e) {
                  toast({ status: 'error', title: 'Erreur lors de la mise à jour', description: e.message });
                  setEditTechSaving(false);
                }
              }}
            >
              Enregistrer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
                          <select
                            value={maintenanceForm.status}
                            onChange={(e) => setMaintenanceForm({ ...maintenanceForm, status: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                          >
                            <option value="completed">Complété</option>
                            <option value="in_progress">En cours</option>
                            <option value="pending">En attente</option>
                            <option value="cancelled">Annulé</option>
                          </select>
                        </Box>
                      </VStack>
                    </ModalBody>
                    <ModalFooter>
                      <Button mr={3} onClick={() => setShowAddMaintenance(false)} variant="ghost">Annuler</Button>
                      <Button colorScheme="green" onClick={handleAddMaintenance}>Ajouter</Button>
                    </ModalFooter>
                  </ModalContent>
                </Modal>
              </TabPanel>

              {/* Service Schedule */}
              <TabPanel>
                <VStack align="stretch" spacing={3}>
                  <HStack justify="space-between">
                    <Heading size="sm">Planning de maintenance</Heading>
                    <Button size="sm" colorScheme="blue" onClick={() => setShowAddSchedule(true)}>
                      + Programmer
                    </Button>
                  </HStack>

                  {schedule.length === 0 ? (
                    <Alert status="info">
                      <AlertIcon />
                      Aucune tâche programmée
                    </Alert>
                  ) : (
                    <VStack align="stretch" spacing={2} maxH="500px" overflowY="auto">
                      {schedule.map(s => (
                        <Card key={s.id} variant="outline" size="sm" borderLeftWidth="4px" borderLeftColor={s.status === 'overdue' ? 'red.500' : s.status === 'pending' ? 'orange.500' : 'green.500'}>
                          <CardBody py={2}>
                            <HStack justify="space-between" mb={1}>
                              <HStack spacing={2}>
                                <Badge colorScheme={s.priority === 'critical' ? 'red' : s.priority === 'high' ? 'orange' : 'blue'}>
                                  {s.priority}
                                </Badge>
                                <Text fontSize="sm" fontWeight="600">{s.serviceType}</Text>
                              </HStack>
                              <Badge colorScheme={s.status === 'completed' ? 'green' : s.status === 'overdue' ? 'red' : s.status === 'pending' ? 'yellow' : 'gray'}>
                                {s.status}
                              </Badge>
                            </HStack>
                            {s.description && <Text fontSize="sm" color="gray.700">{s.description}</Text>}
                            <HStack spacing={4} mt={2} fontSize="xs" color="gray.600">
                              {s.plannedDate && <Text>📅 {new Date(s.plannedDate).toLocaleDateString('fr-FR')}</Text>}
                              <Text>🔄 {s.frequency}</Text>
                            </HStack>
                          </CardBody>
                        </Card>
                      ))}
                    </VStack>
                  )}
                </VStack>

                {/* Add Schedule Modal */}
                <Modal isOpen={showAddSchedule} onClose={() => setShowAddSchedule(false)}>
                  <ModalOverlay />
                  <ModalContent>
                    <ModalHeader>Programmer une maintenance</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                      <VStack spacing={3}>
                        <Box w="full">
                          <FormLabel>Type de service *</FormLabel>
                          <select
                            value={scheduleForm.serviceType}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, serviceType: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                          >
                            <option value="oil_change">Vidange</option>
                            <option value="tire_inspection">Inspection pneus</option>
                            <option value="brake_check">Vérification freins</option>
                            <option value="full_inspection">Inspection complète</option>
                            <option value="other">Autre</option>
                          </select>
                        </Box>
                        <Box w="full">
                          <FormLabel>Description</FormLabel>
                          <input
                            type="text"
                            value={scheduleForm.description}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                            placeholder="Détails..."
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                        </Box>
                        <Box w="full">
                          <FormLabel>Fréquence</FormLabel>
                          <select
                            value={scheduleForm.frequency}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                          >
                            <option value="weekly">Hebdomadaire</option>
                            <option value="monthly">Mensuelle</option>
                            <option value="quarterly">Trimestrielle</option>
                            <option value="yearly">Annuelle</option>
                            <option value="as_needed">À la demande</option>
                          </select>
                        </Box>
                        <Box w="full">
                          <FormLabel>Priorité</FormLabel>
                          <select
                            value={scheduleForm.priority}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, priority: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                          >
                            <option value="low">Basse</option>
                            <option value="medium">Moyenne</option>
                            <option value="high">Haute</option>
                            <option value="critical">Critique</option>
                          </select>
                        </Box>
                      </VStack>
                    </ModalBody>
                    <ModalFooter>
                      <Button mr={3} onClick={() => setShowAddSchedule(false)} variant="ghost">Annuler</Button>
                      <Button colorScheme="blue" onClick={handleAddSchedule}>Programmer</Button>
                    </ModalFooter>
                  </ModalContent>
                </Modal>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </>
      )}
    </VStack>
  );
}

export default function RetroBus() {
  const toast = useToast();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusByParc, setStatusByParc] = useState({}); // { [parc]: { active: bool, startedAt, conducteur } }
  const [reportsData, setReportsData] = useState({}); // { [parc]: Report[] }
  const [usagesData, setUsagesData] = useState({}); // { [parc]: Usage[] }
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingUsages, setLoadingUsages] = useState(false);
  // Modal édition technique
  const [editTechOpen, setEditTechOpen] = useState(false);
  const [editTechVehicle, setEditTechVehicle] = useState(null);
  const [editTechCaracs, setEditTechCaracs] = useState([]);
  const [editTechGasoil, setEditTechGasoil] = useState(0);
  const [editTechSaving, setEditTechSaving] = useState(false);

  const reloadVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const list = await apiClient.get('/vehicles');
      setVehicles(Array.isArray(list) ? list : (list?.vehicles || []));
    } catch (e) {
      toast({
        status: 'error',
        title: "Chargement des véhicules",
        description: e.message || 'Impossible de charger la liste'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    reloadVehicles();
  }, [reloadVehicles]);

  // Charger l'état de pointage (actif) pour chaque véhicule — lazy/background
  useEffect(() => {
    if (!vehicles || vehicles.length === 0) return;
    let cancelled = false;
    const loadStatuses = async () => {
      // limiter à 24 en premier rendu pour éviter l'explosion de requêtes
      const slice = vehicles.slice(0, 24);
      await Promise.all(
        slice.map(async (v) => {
          const parc = v.parc || v.id || v.slug;
          if (!parc) return;
          try {
            const usages = await apiClient.get(`/vehicles/${encodeURIComponent(parc)}/usages`);
            if (cancelled) return;
            const active = Array.isArray(usages) ? usages.find(u => !u.endedAt) : null;
            setStatusByParc(prev => ({
              ...prev,
              [parc]: active ? { active: true, startedAt: active.startedAt, conducteur: active.conducteur } : { active: false }
            }));
          } catch {
            // silencieux: on laisse le statut vide
          }
        })
      );
    };
    loadStatuses();
    return () => { cancelled = true; };
  }, [vehicles]);

  // Charger les rapports pour tous les véhicules
  const loadAllReports = async () => {
    if (!vehicles || vehicles.length === 0) return;
    setLoadingReports(true);
    try {
      const reportsMap = {};
      await Promise.all(
        vehicles.map(async (v) => {
          const parc = v.parc || v.id || v.slug;
          if (!parc) return;
          try {
            const reports = await apiClient.get(`/vehicles/${encodeURIComponent(parc)}/reports`);
            reportsMap[parc] = Array.isArray(reports) ? reports : [];
          } catch (e) {
            reportsMap[parc] = [];
          }
        })
      );
      setReportsData(reportsMap);
    } catch (error) {
      console.error('Erreur chargement rapports:', error);
    } finally {
      setLoadingReports(false);
    }
  };

  // Charger l'historique des usages pour tous les véhicules
  const loadAllUsages = async () => {
    if (!vehicles || vehicles.length === 0) return;
    setLoadingUsages(true);
    try {
      const usagesMap = {};
      await Promise.all(
        vehicles.map(async (v) => {
          const parc = v.parc || v.id || v.slug;
          if (!parc) return;
          try {
            const usages = await apiClient.get(`/vehicles/${encodeURIComponent(parc)}/usages`);
            usagesMap[parc] = Array.isArray(usages) ? usages : [];
          } catch (e) {
            usagesMap[parc] = [];
          }
        })
      );
      setUsagesData(usagesMap);
    } catch (error) {
      console.error('Erreur chargement usages:', error);
    } finally {
      setLoadingUsages(false);
    }
  };

  const vehicleCards = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return null;
    return (
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={4} mt={4}>
        {vehicles.map((v) => {
          const parc = v.parc || v.id || v.slug;
          const status = statusByParc[parc] || {};
          // Parser les caractéristiques si elles existent
          let carac = [];
          let gasoil = 0;
          try {
            if (v.caracteristiques) {
              // Vérifier si c'est déjà un objet ou une chaîne JSON
              if (typeof v.caracteristiques === 'string') {
                carac = JSON.parse(v.caracteristiques);
              } else if (Array.isArray(v.caracteristiques)) {
                carac = v.caracteristiques;
              } else if (typeof v.caracteristiques === 'object') {
                carac = Array.isArray(v.caracteristiques) ? v.caracteristiques : [];
              }
              const found = carac.find(c => c.label === 'Niveau gasoil');
              if (found) gasoil = Number(found.value) || 0;
            }
          } catch (e) {
            console.warn('Erreur parsing caractéristiques:', e);
          }
          const hasCarac = Array.isArray(carac) && carac.length > 0;
          return (
            <Card key={parc} variant="outline" _hover={{ shadow: 'md' }}>
              <CardBody>
                <VStack align="start" spacing={3}>
                  <HStack justify="space-between" w="full">
                    <VStack align="start" spacing={0}>
                      <Heading size="md">{parc}</Heading>
                      <Text fontSize="sm" color="gray.600">{[v.marque, v.modele].filter(Boolean).join(' ') || v.titre || 'Véhicule'}</Text>
                    </VStack>
                    <EtatBadge etat={v.etat || v.statut} />
                  </HStack>
                  {/* Indicateur informations techniques */}
                  {hasCarac ? (
                    <HStack w="full">
                      <Icon as={FiInfo} color="green.500" />
                      <Text fontSize="sm" color="green.600">{carac.length} info(s) technique(s)</Text>
                    </HStack>
                  ) : (
                    <HStack w="full">
                      <Icon as={FiAlertTriangle} color="orange.500" />
                      <Text fontSize="sm" color="orange.600">Aucune info technique</Text>
                    </HStack>
                  )}
                  {/* Curseur gasoil */}
                  <HStack w="full" spacing={2}>
                    <Icon as={FiSliders} color="blue.500" />
                    <Text fontSize="sm" color="blue.600">Gasoil: {gasoil}%</Text>
                    <Button size="xs" variant="outline" onClick={() => {
                      setEditTechVehicle(v);
                      setEditTechCaracs(carac);
                      setEditTechGasoil(gasoil);
                      setEditTechOpen(true);
                    }}>Infos techniques</Button>
                  </HStack>
                  <HStack spacing={2} flexWrap="wrap">
                    {status.active ? (
                      <Tag colorScheme="purple" size="sm">
                        <TagLeftIcon as={FiClock} />
                        <TagLabel>Pointage en cours</TagLabel>
                      </Tag>
                    ) : (
                      <Tag size="sm" colorScheme="gray" variant="subtle">
                        <TagLabel>Disponible</TagLabel>
                      </Tag>
                    )}
                    {(v.etat === 'en_panne' || v.statut === 'en_panne') && (
                      <Tag colorScheme="red" size="sm">
                        <TagLeftIcon as={FiAlertTriangle} />
                        <TagLabel>Panne</TagLabel>
                      </Tag>
                    )}
                  </HStack>
                  <Divider />
                  <HStack w="full" spacing={2}>
                    <Button 
                      size="sm" 
                      leftIcon={<FiEdit />}
                      onClick={() => navigate(`/dashboard/vehicules/${encodeURIComponent(parc)}`)}
                      flex={1}
                    >
                      Éditer
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => navigate(`/mobile/v/${encodeURIComponent(parc)}`)}
                      flex={1}
                    >
                      Pointage
                    </Button>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          );
        })}
      </SimpleGrid>
    );
  }, [vehicles, navigate, statusByParc]);

  return (
    <Box p={6}>
      <Heading size="lg">RétroBus</Heading>
      <Text mt={2} opacity={0.85}>Gestion des véhicules, historique, entretien, situation et pointages.</Text>

      <Tabs mt={6} variant="enclosed">
        {/* Modal édition technique véhicule */}
        <Modal isOpen={editTechOpen} onClose={() => setEditTechOpen(false)} size="lg">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Informations techniques : {editTechVehicle?.parc}</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack align="stretch" spacing={4}>
                <FormLabel>Niveau actuel du gasoil (%)</FormLabel>
                <Box>
                  {/* Graduée personnalisée */}
                  <Box position="relative" h="60px" mb={6}>
                    {/* Ligne de base */}
                    <Box position="absolute" top="20px" left="0" right="0" h="2px" bg="gray.300" />
                    
                    {/* Grandes graduations (0, 50, 100) */}
                    {[0, 50, 100].map((val) => (
                      <Box
                        key={val}
                        position="absolute"
                        left={`${val}%`}
                        top="12px"
                        transform="translateX(-50%)"
                        textAlign="center"
                      >
                        <Box w="3px" h="16px" bg="gray.800" mx="auto" mb={1} />
                        <Text fontSize="xs" fontWeight="bold">{val}%</Text>
                      </Box>
                    ))}
                    
                    {/* Petites graduations entre les grands points */}
                    {Array.from({ length: 99 }).map((_, i) => {
                      const val = i + 1;
                      const isBig = val === 50;
                      if (isBig) return null; // Skip les grands points
                      return (
                        <Box
                          key={`small-${val}`}
                          position="absolute"
                          left={`${val}%`}
                          top="16px"
                          transform="translateX(-50%)"
                          w="1px"
                          h="8px"
                          bg="gray.400"
                        />
                      );
                    })}
                    
                    {/* Curseur interactif */}
                    <Box
                      position="absolute"
                      left={`${editTechGasoil}%`}
                      top="0"
                      transform="translateX(-50%)"
                      cursor="pointer"
                      w="20px"
                      h="40px"
                      bg="blue.500"
                      borderRadius="md"
                      opacity="0.8"
                      _hover={{ opacity: 1, shadow: 'md' }}
                      onClick={(e) => {
                        const rect = e.currentTarget.parentElement.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const percent = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
                        setEditTechGasoil(percent);
                      }}
                    />
                  </Box>
                  
                  {/* Slider classique pour plus de précision */}
                  <Slider 
                    min={0} 
                    max={100} 
                    step={1} 
                    value={editTechGasoil} 
                    onChange={setEditTechGasoil}
                    colorScheme="blue"
                  >
                    <SliderTrack bg="gray.200">
                      <SliderFilledTrack bg="blue.500" />
                    </SliderTrack>
                    <SliderThumb boxSize={6} bg="blue.500" />
                  </Slider>
                </Box>
                
                <HStack justify="space-between">
                  <Text fontSize="sm" fontWeight="bold">Niveau actuel :</Text>
                  <Text fontSize="lg" fontWeight="bold" color="blue.600">{editTechGasoil}%</Text>
                </HStack>
                <CaracteristiquesEditor value={editTechCaracs} onChange={setEditTechCaracs} />
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button mr={3} onClick={() => setEditTechOpen(false)} variant="ghost">Annuler</Button>
              <Button colorScheme="blue" isLoading={editTechSaving} onClick={async () => {
                try {
                  setEditTechSaving(true);
                  // Mettre à jour ou ajouter le niveau de gasoil dans les caracs
                  let nextCaracs = Array.isArray(editTechCaracs) ? [...editTechCaracs] : [];
                  const idx = nextCaracs.findIndex(c => c.label === 'Niveau gasoil');
                  if (idx >= 0) {
                    nextCaracs[idx].value = String(editTechGasoil);
                  } else {
                    nextCaracs.push({ label: 'Niveau gasoil', value: String(editTechGasoil) });
                  }
                  
                  // Sauvegarder via API
                  await apiClient.put(`/vehicles/${encodeURIComponent(editTechVehicle.parc)}`, {
                    caracteristiques: JSON.stringify(nextCaracs)
                  });
                  
                  // Mettre à jour localement sans recharger toute la liste (évite la boucle infinie)
                  setVehicles(prev => prev.map(v => {
                    const parcKey = v.parc || v.id || v.slug;
                    if (parcKey === editTechVehicle.parc) {
                      return { ...v, caracteristiques: JSON.stringify(nextCaracs) };
                    }
                    return v;
                  }));
                  
                  toast({ status: 'success', title: 'Caractéristiques mises à jour' });
                  setEditTechSaving(false);
                  setEditTechOpen(false);
                } catch (e) {
                  toast({ status: 'error', title: 'Erreur lors de la mise à jour', description: e.message });
                  setEditTechSaving(false);
                }
              }}>Enregistrer</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <TabList overflowX="auto">
          <Tab>Véhicules</Tab>
          <Tab>Historique</Tab>
          <Tab>Entretien</Tab>
          <Tab>Situation administrative</Tab>
          <Tab>Pointages</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            {loading ? (
              <HStack spacing={3} pt={6}>
                <Spinner />
                <Text>Chargement des véhicules…</Text>
              </HStack>
            ) : (
              <>
                <Alert status="info" mb={4}>
                  <AlertIcon />
                  <VStack align="start" spacing={1}>
                    <Text fontWeight="600">💡 Astuce - Informations techniques</Text>
                    <Text fontSize="sm">
                      Cliquez sur "Infos techniques" pour éditer les caractéristiques et le niveau de gasoil de chaque véhicule.
                    </Text>
                  </VStack>
                </Alert>
                {vehicleCards || <Text mt={4}>Aucun véhicule pour le moment.</Text>}
              </>
            )}
          </TabPanel>

          <TabPanel>
            <VStack align="start" spacing={4} py={2}>
              <HStack justify="space-between" w="full">
                <HStack>
                  <FiFileText />
                  <Heading size="sm">Historique des usages</Heading>
                </HStack>
                <Button size="sm" onClick={loadAllUsages} isLoading={loadingUsages}>
                  Charger
                </Button>
              </HStack>
              
              {loadingUsages ? (
                <HStack spacing={3}>
                  <Spinner size="sm" />
                  <Text>Chargement de l'historique...</Text>
                </HStack>
              ) : Object.keys(usagesData).length === 0 ? (
                <Alert status="info">
                  <AlertIcon />
                  Cliquez sur "Charger" pour afficher l'historique des usages
                </Alert>
              ) : (
                <VStack align="stretch" w="full" spacing={4}>
                  {vehicles.map((v) => {
                    const parc = v.parc || v.id || v.slug;
                    const usages = usagesData[parc] || [];
                    const completedUsages = usages.filter(u => u.endedAt);
                    
                    if (completedUsages.length === 0) return null;
                    
                    return (
                      <Card key={parc} variant="outline">
                        <CardBody>
                          <Heading size="sm" mb={3}>{parc} - {completedUsages.length} usage(s)</Heading>
                          <Table size="sm" variant="simple">
                            <Thead>
                              <Tr>
                                <Th>Début</Th>
                                <Th>Fin</Th>
                                <Th>Conducteur</Th>
                                <Th>Note</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {completedUsages.slice(0, 5).map((usage) => (
                                <Tr key={usage.id}>
                                  <Td>{new Date(usage.startedAt).toLocaleDateString('fr-FR')}</Td>
                                  <Td>{usage.endedAt ? new Date(usage.endedAt).toLocaleDateString('fr-FR') : '-'}</Td>
                                  <Td>{usage.conducteur || '-'}</Td>
                                  <Td fontSize="sm" color="gray.600">{usage.note || '-'}</Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                          {completedUsages.length > 5 && (
                            <Text mt={2} fontSize="sm" color="gray.500">
                              ... et {completedUsages.length - 5} autres usage(s)
                            </Text>
                          )}
                        </CardBody>
                      </Card>
                    );
                  })}
                </VStack>
              )}
            </VStack>
          </TabPanel>

          <TabPanel>
            <MaintenanceTab vehicles={vehicles} apiClient={apiClient} />
          </TabPanel>

          <TabPanel>
            <VStack align="start" spacing={3} py={2}>
              <HStack>
                <FiAlertTriangle />
                <Heading size="sm">Situation administrative</Heading>
              </HStack>
              <Alert status="warning">
                <AlertIcon />
                Cette section sera développée prochainement pour gérer : documents, assurances, contrôle technique, conformité.
              </Alert>
              <Text opacity={0.8}>
                En attendant, vous pouvez ajouter ces informations dans les notes de chaque véhicule via la page d'édition.
              </Text>
            </VStack>
          </TabPanel>

          <TabPanel>
            <VStack align="start" spacing={4} py={2}>
              <HStack>
                <FiClock />
                <Heading size="sm">Pointages actifs</Heading>
              </HStack>
              
              {vehicles.filter(v => {
                const parc = v.parc || v.id || v.slug;
                return statusByParc[parc]?.active;
              }).length === 0 ? (
                <Alert status="info">
                  <AlertIcon />
                  Aucun pointage en cours actuellement
                </Alert>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} w="full">
                  {vehicles.map((v) => {
                    const parc = v.parc || v.id || v.slug;
                    const status = statusByParc[parc];
                    
                    if (!status?.active) return null;
                    
                    const duration = status.startedAt 
                      ? Math.floor((Date.now() - new Date(status.startedAt).getTime()) / (1000 * 60))
                      : 0;
                    
                    return (
                      <Card key={parc} variant="outline" borderColor="purple.300">
                        <CardBody>
                          <VStack align="start" spacing={2}>
                            <Heading size="sm">{parc}</Heading>
                            <HStack>
                              <Icon as={FiClock} color="purple.500" />
                              <Text fontSize="sm">
                                En cours depuis {duration} min
                              </Text>
                            </HStack>
                            {status.conducteur && (
                              <Text fontSize="sm" color="gray.600">
                                Conducteur: {status.conducteur}
                              </Text>
                            )}
                            <Button 
                              size="sm" 
                              colorScheme="purple"
                              onClick={() => navigate(`/mobile/v/${encodeURIComponent(parc)}`)}
                            >
                              Voir le pointage
                            </Button>
                          </VStack>
                        </CardBody>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              )}
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
