import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Image, Menu, MenuButton, MenuItem, MenuList, Text,
  IconButton, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, Textarea, Switch, FormControl, FormLabel, Button,
  useDisclosure, useToast, HStack, Badge, VStack, Stack, Select,
  Tooltip, VisuallyHidden, Drawer, DrawerOverlay, DrawerContent, DrawerCloseButton,
  DrawerHeader, DrawerBody, Divider, useBreakpointValue
} from "@chakra-ui/react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { flashAPI } from "../api/flash.js";
import NotificationCenter from './NotificationCenter';
import logo from "../assets/retro_intranet_essonne.svg";
import infoPng from "../assets/icons/flash-info.png";
import notifPng from "../assets/icons/flash-notif.png";
import posPng from "../assets/icons/flash-pos.png";
import { Navigation } from './TopNavLink';

const WIN = {
  red:    "#2e538d",
  yellow: "#2e538d",
  green:  "#bb1f11",
  blue:   "#bb1f11",
};

const CATEGORY = {
  INFO: { key: "INFO", label: "Flash Infos", color: { bg: "red.50", border: "red.300", text: "red.800", accent: "#bb1f11" } },
  NOTIF: { key: "NOTIF", label: "Flash Notifications", color: { bg: "orange.50", border: "orange.300", text: "orange.800", accent: "#d97706" } },
  POS: { key: "POS", label: "Flash Positif", color: { bg: "green.50", border: "green.300", text: "green.900", accent: "#16a34a" } },
};

const HEADER_H_M = "56px";
const HEADER_H_D = "80px";
const LOGO_H_M   = "52px";
const LOGO_H_D   = "110px";

const ANN_KEY = "rbe:announcements";
const DISMISS_KEY_PREFIX = "rbe:announcements:dismissed:";

function generateId() { return `flash-${Date.now()}-${Math.floor(Math.random()*1000)}`; }

async function loadFlashes() {
  try {
    const response = await flashAPI.getAll();
    return Array.isArray(response) ? response : [];
  } catch (e) {
    return [];
  }
}
async function createFlash(flashData) {
  try { return await flashAPI.create(flashData); } catch (e) { throw e; }
}
async function updateFlash(id, flashData) {
  try { return await flashAPI.update(id, flashData); } catch (e) { throw e; }
}
async function deleteFlash(id) {
  try { await flashAPI.delete(id); return true; } catch (e) { throw e; }
}

function loadDismissedMap(matricule) {
  if (!matricule) return {};
  try {
    const raw = localStorage.getItem(DISMISS_KEY_PREFIX + matricule);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function saveDismissedMap(matricule, map) {
  if (!matricule) return;
  try { localStorage.setItem(DISMISS_KEY_PREFIX + matricule, JSON.stringify(map || {})); } catch (e) {}
}

const ICON_MAP = { INFO: infoPng, NOTIF: notifPng, POS: posPng };

function CategoryBadge({ catKey }) {
  const cat = Object.values(CATEGORY).find(c => c.key === catKey) || CATEGORY.INFO;
  const src = ICON_MAP[catKey] || ICON_MAP.INFO;
  return (
    <Tooltip label={cat.label}>
      <Box as="span" display="inline-flex" alignItems="center" gap={2}>
        <Image src={src} alt="" boxSize="18px" draggable={false} />
        <VisuallyHidden>{cat.label}</VisuallyHidden>
      </Box>
    </Tooltip>
  );
}

function MegaphoneIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M3 10v4a2 2 0 0 0 2 2h1v2a1 1 0 0 0 1.555.832L12 16h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-6L7.555 3.168A1 1 0 0 0 6 4v2H5a2 2 0 0 0-2 2z" />
    </svg>
  );
}
function BellIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2a4 4 0 0 0-4 4v1.07A6 6 0 0 1 6 13v3l-1.447 1.724A1 1 0 0 0 5.447 19h13.106a1 1 0 0 0 .894-1.276L18 16v-3a6 6 0 0 1-2-5.93V6a4 4 0 0 0-4-4zM8 20a4 4 0 0 0 8 0H8z"/>
    </svg>
  );
}

export default function Header() {
  const { logout, prenom, nom, isAuthenticated, isAdmin, matricule } = useUser();
  const navigate = useNavigate();
  const toast = useToast();

  const manage = useDisclosure();
  const viewer = useDisclosure();
  const navDrawer = useDisclosure();
  const isMobile = useBreakpointValue({ base: true, md: false });

  const [flashes, setFlashes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ message: "", category: "INFO", active: true, expiresAt: "" });

  // Fonction de déconnexion
  const handleLogout = () => {
    logout(); // Efface token + user du localStorage
    navigate('/login'); // Redirige vers la page de login
    toast({
      title: "Déconnexion réussie",
      description: "Vous avez été déconnecté avec succès",
      status: "info",
      duration: 3000,
      isClosable: true,
    });
  };

  // Gestion de l'inactivité (10 minutes)
  useEffect(() => {
    if (!isAuthenticated) return;

    let inactivityTimer;
    const INACTIVITY_TIME = 10 * 60 * 1000; // 10 minutes en millisecondes

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        logout();
        navigate('/login');
        toast({
          title: "Session expirée",
          description: "Vous avez été déconnecté pour inactivité (10 minutes)",
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
      }, INACTIVITY_TIME);
    };

    // Événements qui réinitialisent le timer d'inactivité
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Initialiser le timer
    resetTimer();

    // Ajouter les écouteurs d'événements
    events.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });

    // Nettoyer au démontage
    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event => {
        document.removeEventListener(event, resetTimer, true);
      });
    };
  }, [isAuthenticated, logout, navigate, toast]);

  useEffect(() => {
    async function fetchFlashes() {
      try {
        setLoading(true);
        const flashesFromAPI = await loadFlashes();
        setFlashes(flashesFromAPI);
      } finally {
        setLoading(false);
      }
    }
    fetchFlashes();
  }, [toast]);

  const now = Date.now();
  const activeFlashes = useMemo(() => {
    return flashes.filter(f => f && f.active && (!f.expiresAt || new Date(f.expiresAt).getTime() > now));
  }, [flashes, now]);
  const bannerFlashes = useMemo(() => activeFlashes.filter(f => f.category === "INFO"), [activeFlashes]);

  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    const map = loadDismissedMap(matricule || "anon");
    const count = activeFlashes.reduce((acc, f) => {
      const ackTs = map[f.id] || 0;
      const updatedTs = f.updatedAt ? new Date(f.updatedAt).getTime() : (f.createdAt ? new Date(f.createdAt).getTime() : 0);
      return acc + (ackTs >= updatedTs ? 0 : 1);
    }, 0);
    setUnreadCount(count);
  }, [flashes, matricule, activeFlashes.length]);

  const openNew = () => {
    setEditing(null);
    setForm({ message: "", category: "INFO", active: true, expiresAt: "" });
    manage.onOpen();
  };
  const startEdit = (f) => {
    setEditing(f);
    setForm({
      message: f.message || "",
      category: f.category || "INFO",
      active: Boolean(f.active),
      expiresAt: f.expiresAt || ""
    });
    manage.onOpen();
  };
  const doSave = async () => {
    const trimmed = (form.message || "").trim();
    if (!trimmed) return toast({ status: "warning", title: "Le message est requis" });
    if (!["INFO","NOTIF","POS"].includes(form.category)) form.category = "INFO";
    try {
      if (editing) {
        const updatedFlash = await updateFlash(editing.id, {
          message: trimmed,
          category: form.category,
          active: Boolean(form.active),
          expiresAt: form.expiresAt || null
        });
        setFlashes(prev => prev.map(f => f.id === editing.id ? updatedFlash : f));
        toast({ status: "success", title: "Flash modifié" });
      } else {
        const flashData = {
          id: generateId(),
          message: trimmed,
          category: form.category,
          active: Boolean(form.active),
          expiresAt: form.expiresAt || null
        };
        const newFlash = await createFlash(flashData);
        setFlashes(prev => [newFlash, ...prev]);
        toast({ status: "success", title: "Flash ajouté" });
      }
      setEditing(null);
      manage.onClose();
    } catch (e) {
      toast({ status: "error", title: "Erreur", description: `Impossible de sauvegarder le flash: ${e.message}` });
    }
  };
  const doDelete = async (id) => {
    if (!confirm("Supprimer ce flash ?")) return;
    try {
      await deleteFlash(id);
      setFlashes(prev => prev.filter(f => f.id !== id));
      toast({ status: "info", title: "Flash supprimé" });
    } catch (e) {
      toast({ status: "error", title: "Erreur", description: "Impossible de supprimer le flash" });
    }
  };
  const toggleActive = async (id) => {
    try {
      const flash = flashes.find(f => f.id === id);
      if (!flash) return;
      const updatedFlash = await updateFlash(id, { active: !flash.active });
      setFlashes(prev => prev.map(f => f.id === id ? updatedFlash : f));
    } catch (e) {
      toast({ status: "error", title: "Erreur", description: "Impossible de modifier le flash" });
    }
  };
  const acknowledgeForUser = (id) => {
    const key = matricule || "anon";
    const map = loadDismissedMap(key);
    const nowMs = Date.now();
    map[id] = nowMs;
    saveDismissedMap(key, map);
    setUnreadCount(prev => Math.max(0, prev - 1));
    toast({ status: "info", title: "Prise de connaissance enregistrée" });
  };
  const bannerStyle = (catKey) => {
    const cat = Object.values(CATEGORY).find(c => c.key === catKey) || CATEGORY.INFO;
    return {
      bg: cat.color.bg,
      borderColor: cat.color.border,
      color: cat.color.text,
      accent: cat.color.accent
    };
  };

  return (
    <Box as="header" w="100%" bg="white" position="sticky" top="0" zIndex="1000" borderBottom="1px solid #3a3a3aff">
      <Box position="relative" h={{ base: HEADER_H_M, md: HEADER_H_D }} overflow="visible">
        {/* Dégradé fluide (derrière le logo) */}
        <Box
          position="absolute"
          left="0"
          right="0"
          top="0"
          bottom="0"
          zIndex={0}
          pointerEvents="none"
          style={{
            background: `linear-gradient(90deg,
              ${WIN.red} 0%,
              ${WIN.yellow} 22%,
              ${WIN.green} 70%,
              ${WIN.blue} 100%
            )`
          }}
        />

        {/* Logo à gauche (au-dessus du dégradé) */}
        <Image
          src={logo}
          alt="RétroBus Essonne Intranet"
          height={{ base: LOGO_H_M, md: LOGO_H_D }}
          objectFit="contain"
          position="absolute"
          left={{ base: 3, md: 5 }}
          top="50%"
          transform="translateY(-50%)"
          zIndex={2}
          draggable={false}
        />

        {/* Actions à droite */}
        <Box position="absolute" right={{ base: 2, md: 6 }} top="50%" transform="translateY(-50%)" zIndex={2}>
          {isMobile ? (
            <IconButton
              aria-label="Menu"
              icon={
                <Box as="span" display="inline-block" w="18px" h="2px" bg="white" position="relative" _before={{content:'""',position:'absolute',w:'18px',h:'2px',bg:'white',top:'-6px',left:0}} _after={{content:'""',position:'absolute',w:'18px',h:'2px',bg:'white',top:'6px',left:0}} />
              }
              size="sm"
              variant="ghost"
              color="white"
              onClick={navDrawer.onOpen}
              title="Ouvrir le menu"
            />
          ) : (
            <HStack spacing={2}>
              {/* Megaphone — only admin can manage */}
              <Tooltip label={isAdmin ? "Gérer les flashs" : "Vous n'êtes pas autorisé"}>
                <span>
                  <IconButton
                    aria-label="Annonces (gestion)"
                    icon={<MegaphoneIcon />}
                    size="sm"
                    variant="ghost"
                    color="white"
                    onClick={() => { if (isAdmin) manage.onOpen(); }}
                    title="Annonces"
                    isDisabled={!isAdmin}
                  />
                </span>
              </Tooltip>

              {/* RétroBus Mail Notifications */}
              <NotificationCenter />

              <Menu>
                <MenuButton as={Button} colorScheme="red">
                  Bonjour, {prenom || 'Utilisateur'}
                </MenuButton>
                <MenuList>
                  <MenuItem as={RouterLink} to="/adhesion">
                    Mon Adhésion
                  </MenuItem>
                  <MenuItem as={RouterLink} to="/retromail">
                    RétroMail
                  </MenuItem>
                  <MenuItem onClick={handleLogout} color="red.500">
                    Déconnexion
                  </MenuItem>
                </MenuList>
              </Menu>
            </HStack>
          )}
        </Box>
      </Box>

      {/* Barre de navigation (cachée sur mobile) */}
      <Box display={{ base: 'none', md: 'block' }}>
        <Navigation />
      </Box>

      {/* Drawer mobile navigation */}
      <Drawer isOpen={navDrawer.isOpen} onClose={navDrawer.onClose} placement="right">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader bg="var(--rbe-red)" color="white">
            <Text fontWeight="bold">👋 Bonjour {prenom || 'Utilisateur'}</Text>
            {unreadCount > 0 && (
              <Text fontSize="sm" color="whiteAlpha.800">{unreadCount} flash(s) non lu(s)</Text>
            )}
          </DrawerHeader>
          <DrawerBody p={0}>
            <VStack align="stretch" spacing={0}>
              <Button as={RouterLink} to="/dashboard" variant="ghost" justifyContent="flex-start" onClick={navDrawer.onClose} py={4} px={5}>Accueil</Button>
              <Button as={RouterLink} to="/dashboard/vehicules" variant="ghost" justifyContent="flex-start" onClick={navDrawer.onClose} py={4} px={5}>Véhicules</Button>
              <Button as={RouterLink} to="/dashboard/evenements" variant="ghost" justifyContent="flex-start" onClick={navDrawer.onClose} py={4} px={5}>Événements</Button>
              <Button as={RouterLink} to="/dashboard/myrbe" variant="ghost" justifyContent="flex-start" onClick={navDrawer.onClose} py={4} px={5}>MyRBE</Button>
              <Button as={RouterLink} to="/dashboard/retromerch" variant="ghost" justifyContent="flex-start" onClick={navDrawer.onClose} py={4} px={5}>RétroMerch</Button>
              <Divider />
              <Button onClick={() => { viewer.onOpen(); navDrawer.onClose(); }} variant="ghost" justifyContent="flex-start" py={4} px={5}>Voir les flashs</Button>
              {isAdmin && (
                <Button onClick={() => { manage.onOpen(); navDrawer.onClose(); }} variant="ghost" justifyContent="flex-start" py={4} px={5}>Gérer les flashs</Button>
              )}
              <Divider />
              <Button as={RouterLink} to="/adhesion" variant="ghost" justifyContent="flex-start" onClick={navDrawer.onClose} py={4} px={5}>Mon Adhésion</Button>
              <Button as={RouterLink} to="/retromail" variant="ghost" justifyContent="flex-start" onClick={navDrawer.onClose} py={4} px={5}>RétroMail</Button>
              <Button onClick={() => { navDrawer.onClose(); handleLogout(); }} colorScheme="red" justifyContent="flex-start" variant="ghost" py={4} px={5}>Déconnexion</Button>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Banners: render only urgent (INFO) active flashes as site banners */}
      <Box>
        {bannerFlashes.map(f => {
          const s = bannerStyle(f.category);
          return (
            <Box key={f.id} bg={s.bg} borderTop="2px solid" borderColor={s.borderColor || s.border} py={2} px={4}>
              <HStack spacing={3} flex="1" align="center">
                <Box>
                  <CategoryBadge catKey={f.category} />
                </Box>
                <Box>
                  <Text fontSize={{ base: "sm", md: "md" }} color={s.color}>
                    {f.message}
                  </Text>
                  <Text fontSize="xs" color="gray.500">{f.createdAt ? `Publié: ${new Date(f.createdAt).toLocaleString()}` : ""}</Text>
                </Box>
                <Box>
                  {isAdmin ? (
                    <HStack spacing={2}>
                      <Button size="sm" onClick={() => startEdit(f)}>Éditer</Button>
                      <Button size="sm" colorScheme={f.active ? "yellow" : "green"} onClick={() => toggleActive(f.id)}>
                        {f.active ? "Désactiver" : "Activer"}
                      </Button>
                      <Button size="sm" colorScheme="red" onClick={() => doDelete(f.id)}>Supprimer</Button>
                    </HStack>
                  ) : (
                    <Button size="sm" onClick={() => acknowledgeForUser(f.id)}>Prendre connaissance</Button>
                  )}
                </Box>
              </HStack>
            </Box>
          );
        })}
      </Box>

      {/* Viewer modal (bell) — shows all active flashes (notifications + urgent) */}
      <Modal isOpen={viewer.isOpen} onClose={viewer.onClose} isCentered size="xl">
        <ModalOverlay />
        <ModalContent maxW="900px">
          <ModalHeader>Flashs en cours</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={3} align="stretch">
              {activeFlashes.length === 0 && <Text color="gray.600">Aucun flash en cours.</Text>}
              {activeFlashes.map(f => (
                <Box key={f.id} p={3} borderWidth="1px" borderRadius="md" bg="white">
                  <HStack spacing={2} align="center">
                    <CategoryBadge catKey={f.category} />
                    <Text fontWeight="600">{f.message}</Text>
                  </HStack>
                  <Text fontSize="sm" color="gray.500">{f.createdAt ? `Publié: ${new Date(f.createdAt).toLocaleString()}` : ""}</Text>
                  <Button size="sm" onClick={() => { acknowledgeForUser(f.id); }}>
                    Prendre connaissance
                  </Button>
                </Box>
              ))}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={viewer.onClose}>Fermer</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Manage modal (megaphone) - admin only: list, add, edit */}
      <Modal isOpen={manage.isOpen} onClose={() => { setEditing(null); manage.onClose(); }} isCentered size="xl">
        <ModalOverlay />
        <ModalContent maxW="900px">
          <ModalHeader>Gestion des flashs</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Stack direction="row" justify="space-between" align="center">
                <Text fontWeight="600">Diffusions existantes</Text>
                <Button size="sm" onClick={openNew}>Nouveau flash</Button>
              </Stack>

              {flashes.length === 0 && <Text color="gray.600">Aucun flash enregistré.</Text>}

              {flashes.map(f => {
                const s = bannerStyle(f.category);
                return (
                  <Box key={f.id} p={3} borderWidth="1px" borderRadius="md" bg={s.bg}>
                    <HStack spacing={2} align="center">
                      <CategoryBadge catKey={f.category} />
                      <Text fontWeight="600">{f.message}</Text>
                    </HStack>
                    <Text fontSize="sm" color="gray.500">{f.createdAt ? `Publié: ${new Date(f.createdAt).toLocaleString()}` : ""}</Text>
                    <HStack spacing={2}>
                      <Button size="sm" onClick={() => startEdit(f)}>Éditer</Button>
                      <Button size="sm" onClick={() => toggleActive(f.id)}>{f.active ? "Désactiver" : "Activer"}</Button>
                      <Button size="sm" colorScheme="red" onClick={() => doDelete(f.id)}>Supprimer</Button>
                    </HStack>
                  </Box>
                );
              })}

              {/* Editor form */}
              <Box mt={2} p={3} borderWidth="1px" borderRadius="md" bg="white">
                <Text fontWeight="600" mb={2}>{editing ? "Modifier le flash" : "Créer un nouveau flash"}</Text>
                <FormControl mb={2}>
                  <FormLabel>Catégorie</FormLabel>
                  <Select value={form.category} onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}>
                    <option value="INFO">{CATEGORY.INFO.label}</option>
                    <option value="NOTIF">{CATEGORY.NOTIF.label}</option>
                    <option value="POS">{CATEGORY.POS.label}</option>
                  </Select>
                </FormControl>
                <FormControl mb={2}>
                  <FormLabel>Message</FormLabel>
                  <Textarea value={form.message} onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))} rows={4} />
                </FormControl>
                <FormControl display="flex" alignItems="center" mb={2}>
                  <FormLabel mb="0" mr={3}>Actif</FormLabel>
                  <Switch isChecked={form.active} onChange={(e) => setForm(prev => ({ ...prev, active: e.target.checked }))} />
                </FormControl>
                <FormControl mb={2}>
                  <FormLabel>Expire le (optionnel)</FormLabel>
                  <input
                    type="datetime-local"
                    value={form.expiresAt || ""}
                    onChange={(e) => setForm(prev => ({ ...prev, expiresAt: e.target.value || "" }))}
                    style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #e2e8f0" }}
                  />
                </FormControl>
                <HStack gap={2} justify="flex-end">
                  <Button variant="ghost" onClick={() => { setEditing(null); setForm({ message: "", category: "INFO", active: true, expiresAt: "" }); }}>Réinitialiser</Button>
                  <Button colorScheme="blue" onClick={doSave}>{editing ? "Sauvegarder" : "Créer"}</Button>
                </HStack>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => { setEditing(null); manage.onClose(); }}>Fermer</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
