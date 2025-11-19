import React from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useUser } from "./context/UserContext";
import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import PermissionProtectedRoute from "./components/PermissionProtectedRoute";
import PrestataireLimitedRoute from "./components/PrestataireLimitedRoute";
import RequireCreator from "./components/RequireCreator";
import { RESOURCES } from "./lib/permissions";

// Pages principales
import Dashboard from "./pages/Dashboard";
import DashboardHome from "./pages/DashboardHome";
import MyRBE from "./pages/MyRBE";
import MyRBEActions from "./pages/MyRBEActions";
import AdminFinance from "./pages/AdminFinance";
import Vehicules from "./pages/Vehicules";
import VehiculeShow from "./pages/VehiculeShow";
import VehiculeCreate from "./pages/VehiculeCreate";
import Evenements from "./pages/Evenements";
import EventsHub from "./pages/EventsHub";
import EventsManagement from "./pages/EventsManagement";
import EventsCreation from "./pages/EventsCreation";
import TestEventsPage from "./pages/TestEventsPage";
import SiteManagement from "./pages/SiteManagement";
import StockManagement from "./pages/StockManagement";
import FlashManagement from "./pages/FlashManagement";
import Adhesion from "./pages/Adhesion";
import Login from "./pages/Login";
import MobileVehicle from "./pages/MobileVehicle";
import Retromail from "./pages/Retromail";
import Newsletter from "./pages/Newsletter";
import NewsletterCampaigns from "./pages/NewsletterCampaigns";
import Members from "./pages/Members";
import MembersManagement from "./pages/MembersManagement";
import SupportSite from "./pages/SupportSite";
import RetroMerch from "./pages/RetroMerch";
import RetroPlanning from "./pages/RetroPlanning";
import AttendancePage from "./pages/AttendancePage";
import AttendanceManager from "./pages/AttendanceManager";
import RetroRequests from "./pages/RetroRequests";
import PresidentDashboard from "./pages/PresidentDashboard";
import PermissionsManager from "./components/PermissionsManager";

export default function App() {
  const { isAuthenticated } = useUser();
  const location = useLocation();
  
  // Debug: afficher la route actuelle
  console.log('🛣️ Current route:', location.pathname);
  
  const showHeader = isAuthenticated && location.pathname !== '/login';

  return (
    <>
      {showHeader && <Header />}
      <Routes>
        {/* Route de connexion */}
        <Route path="/login" element={<Login />} />
        
        {/* Routes du dashboard principal */}
        <Route path="/dashboard/home" element={<ProtectedRoute><DashboardHome /></ProtectedRoute>} />
  <Route path="/dashboard/myrbe" element={<ProtectedRoute><MyRBE /></ProtectedRoute>} />
  <Route path="/dashboard/myrbe/:parc" element={<ProtectedRoute><MyRBEActions /></ProtectedRoute>} />
        
        {/* 📋 RétroDemandes - Devis et demandes */}
        <Route path="/dashboard/retro-requests" element={<ProtectedRoute><RetroRequests /></ProtectedRoute>} />
        <Route path="/dashboard/president/retro-requests" element={<RoleProtectedRoute allowedRoles={['PRESIDENT', 'ADMIN']}><PresidentDashboard /></RoleProtectedRoute>} />
        
        {/* 💰 Route gestion financière */}
        <Route path="/admin/finance" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><AdminFinance /></RoleProtectedRoute>} />
        
        {/* 🚗 Routes des véhicules */}
        <Route path="/dashboard/vehicules" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><Vehicules /></RoleProtectedRoute>} />
        <Route path="/dashboard/vehicules/ajouter" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><RequireCreator><VehiculeCreate /></RequireCreator></RoleProtectedRoute>} />
        <Route path="/dashboard/vehicules/:parc" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><VehiculeShow /></RoleProtectedRoute>} />
        
        {/* 📅 Routes des événements */}
        <Route path="/dashboard/evenements" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><Evenements /></RoleProtectedRoute>} />
        <Route path="/dashboard/events-management" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><EventsHub /></RoleProtectedRoute>} />
        <Route path="/dashboard/events-creation" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><EventsCreation /></RoleProtectedRoute>} />
        {/* Route de test pour diagnostiquer */}
        <Route path="/dashboard/test-events" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><TestEventsPage /></RoleProtectedRoute>} />
        
        {/* 🌐 Gestion du site et contenu */}
        <Route path="/dashboard/site-management" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><PermissionProtectedRoute resource={RESOURCES.SITE_MANAGEMENT}><SiteManagement /></PermissionProtectedRoute></RoleProtectedRoute>} />
        <Route path="/dashboard/flash-management" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><FlashManagement /></RoleProtectedRoute>} />
        {/* 🛒 RétroMerch (administration) */}
        <Route path="/dashboard/retromerch" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><RetroMerch /></RoleProtectedRoute>} />
        
        {/* 📦 Gestion des stocks */}
        <Route path="/dashboard/stock-management" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><StockManagement /></RoleProtectedRoute>} />
        
        {/* 👥 Gestion des membres */}
        <Route path="/dashboard/members-management" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><MembersManagement /></RoleProtectedRoute>} />
        <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
        <Route path="/adhesion" element={<ProtectedRoute><Adhesion /></ProtectedRoute>} />
        
        {/* 🔐 Gestion des permissions */}
        <Route path="/dashboard/permissions" element={<RoleProtectedRoute allowedRoles={['ADMIN']}><PermissionsManager /></RoleProtectedRoute>} />
        
        {/* 📧 Communication */}
        <Route path="/dashboard/newsletter" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><Newsletter /></RoleProtectedRoute>} />
        <Route path="/dashboard/newsletter-campaigns" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><NewsletterCampaigns /></RoleProtectedRoute>} />
        <Route path="/dashboard/retroplanning" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><PermissionProtectedRoute resource={RESOURCES.RETROPLANNING}><RetroPlanning /></PermissionProtectedRoute></RoleProtectedRoute>} />
        <Route path="/planning/attendance/:eventId/:memberId" element={<AttendancePage />} />
        <Route path="/planning/my-invitations" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><PermissionProtectedRoute resource={RESOURCES.RETROPLANNING_RESPOND}><AttendanceManager /></PermissionProtectedRoute></RoleProtectedRoute>} />
        <Route path="/dashboard/support" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><PermissionProtectedRoute resource={RESOURCES.RETROSUPPORT}><SupportSite /></PermissionProtectedRoute></RoleProtectedRoute>} />
        <Route path="/retromail" element={<RoleProtectedRoute deniedRoles={['CLIENT', 'GUEST']}><Retromail /></RoleProtectedRoute>} />
        
        {/* 📱 Version mobile */}
        <Route path="/mobile/v/:parc" element={<ProtectedRoute><MobileVehicle /></ProtectedRoute>} />
        
        {/* Route par défaut - redirige vers le dashboard home */}
        <Route path="/" element={<ProtectedRoute><DashboardHome /></ProtectedRoute>} />
        <Route path="*" element={<ProtectedRoute><DashboardHome /></ProtectedRoute>} />
      </Routes>
    </>
  );
}