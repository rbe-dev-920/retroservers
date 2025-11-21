# 🎨 Stylisation Uniforme des Pages MyRBE

## Objectif
Toutes les pages accessibles via les cartes MyRBE doivent avoir le **même style moderne** que la page Finance avec :
- Sidebar de navigation
- Sections/onglets
- Design cohérent
- Responsive mobile

## Architecture

### Option 1: SidebarPageLayout (Recommandé pour les modules)
Utiliser le composant `SidebarPageLayout` pour les modules avec plusieurs sections/onglets.

#### Import
```jsx
import SidebarPageLayout from '../components/Layout/SidebarPageLayout';
```

#### Usage
```jsx
const MyModule = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  
  const sections = [
    { id: 'dashboard', label: '📊 Dashboard', icon: FiBarChart },
    { id: 'settings', label: '⚙️ Paramètres', icon: FiSettings }
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardComponent />;
      case 'settings':
        return <SettingsComponent />;
      default:
        return null;
    }
  };

  return (
    <SidebarPageLayout
      title="Mon Module"
      subtitle="Description du module"
      icon={FiIcon}
      sections={sections}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      headerGradient="linear(to-r, blue.500, blue.600)"
    >
      {renderContent()}
    </SidebarPageLayout>
  );
};
```

### Option 2: PageLayout (Pour pages simples)
Utiliser `PageLayout` pour les pages avec moins de sections.

```jsx
import PageLayout from '../components/Layout/PageLayout';

export default function SimpleModule() {
  return (
    <PageLayout
      title="Mon Module"
      subtitle="Description"
      breadcrumbs={[{ label: 'MyRBE', href: '/dashboard/myrbe' }]}
    >
      <YourContent />
    </PageLayout>
  );
}
```

## Pages à Mettre à Jour

### Priorité Haute (Modules Complexes → SidebarPageLayout)
1. **RétroDemandes** (/dashboard/retro-demandes)
   - ✅ Utilise PageLayout (peut rester ainsi)
   - Status: OK

2. **Gestion Financière** (/admin/finance-v2)
   - ✅ Utilise SidebarPageLayout
   - Status: ✅ FAIT

3. **EventsManagement** (/dashboard/events-management)
   - ❌ Besoin d'update vers SidebarPageLayout
   - Sections: Dashboard, Détails, Participants, Itinéraires

4. **MembersManagement** (/dashboard/members-management)
   - ❌ Besoin d'update vers SidebarPageLayout
   - Sections: Dashboard, Adhérents, Rôles, Permissions

5. **StockManagement** (/dashboard/stock-management)
   - ❌ Besoin d'update vers SidebarPageLayout
   - Sections: Inventaire, Catégories, Rapports

6. **Newsletter** (/dashboard/newsletter)
   - ❌ Besoin d'update vers SidebarPageLayout
   - Sections: Abonnés, Campagnes, Templates

7. **RetroPlanning** (/dashboard/retroplanning)
   - ❌ Besoin d'update vers SidebarPageLayout
   - Sections: Planning, Assignations, Rapports

8. **SiteManagement** (/dashboard/site-management)
   - ❌ Besoin d'update vers SidebarPageLayout
   - Sections: Contenu, Templates, Paramètres

9. **SupportSite** (/dashboard/support)
   - ❌ Besoin d'update vers SidebarPageLayout
   - Sections: Tickets, Discussions, Rapports

### Priorité Moyenne (RetroBus)
10. **RetroBus** (/dashboard/retrobus)
    - ❌ À créer
    - Description: Mécanique, véhicules, maintenance
    - Utiliser SidebarPageLayout avec sections Véhicules, Maintenance, Rapports

### Pages Sans Changement Nécessaire
- **Profil** (/dashboard/profile) - Page simple
- **Permissions** (/dashboard/myrbe/permissions) - Modale standalone

## Directives de Stylisation

### Couleurs Gradient par Module
```javascript
const gradients = {
  finance: 'linear(to-r, blue.500, blue.600)',
  events: 'linear(to-r, green.500, green.600)',
  members: 'linear(to-r, purple.500, purple.600)',
  stock: 'linear(to-r, yellow.500, yellow.600)',
  newsletter: 'linear(to-r, teal.500, teal.600)',
  planning: 'linear(to-r, orange.500, orange.600)',
  site: 'linear(to-r, pink.500, pink.600)',
  support: 'linear(to-r, cyan.500, cyan.600)',
  vehicles: 'linear(to-r, red.500, red.600)'
};
```

### Icons Standard
```javascript
import {
  FiBarChart, FiSettings, FiUsers, FiPackage,
  FiMail, FiCalendar, FiGlobe, FiLifeBuoy, FiTruck
} from 'react-icons/fi';
```

### Sections Communes
Chaque module doit avoir au minimum :
- **📊 Dashboard** - Vue d'ensemble et statistiques
- **⚙️ Paramètres** - Configuration du module
- **📄 Rapports** (optionnel) - Exports et analyses

## Template pour Mettre à Jour une Page

```jsx
import React, { useState } from 'react';
import { Box } from '@chakra-ui/react';
import {
  Fi{Icon1}, Fi{Icon2}, Fi{Icon3}
} from 'react-icons/fi';
import SidebarPageLayout from '../components/Layout/SidebarPageLayout';
import ComponentDashboard from '../components/Module/Dashboard';
import ComponentSettings from '../components/Module/Settings';

export default function Module() {
  const [activeSection, setActiveSection] = useState('dashboard');

  const sections = [
    { id: 'dashboard', label: '📊 Dashboard', icon: FiBarChart },
    { id: 'section2', label: '🔧 Section 2', icon: FiTool },
    { id: 'settings', label: '⚙️ Paramètres', icon: FiSettings }
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <ComponentDashboard />;
      case 'section2':
        return <ComponentSection2 />;
      case 'settings':
        return <ComponentSettings />;
      default:
        return <ComponentDashboard />;
    }
  };

  return (
    <SidebarPageLayout
      title="Nom du Module"
      subtitle="Description courte"
      icon={FiModuleIcon}
      sections={sections}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      headerGradient="linear(to-r, color.500, color.600)"
    >
      <Box>
        {renderContent()}
      </Box>
    </SidebarPageLayout>
  );
}
```

## Checklist de Mise à Jour

Pour chaque page à mettre à jour :
- [ ] Importer `SidebarPageLayout`
- [ ] Définir les `sections` avec icônes
- [ ] Créer la fonction `renderContent()`
- [ ] Remplacer le Container/PageLayout par SidebarPageLayout
- [ ] Tester sur desktop et mobile
- [ ] Vérifier la cohérence visuelle
- [ ] Commit et push

## Bénéfices

✅ Cohérence visuelle globale  
✅ Navigation sidebar intuitive  
✅ Responsive mobile automatique  
✅ Réutilisabilité du composant  
✅ Maintenance simplifiée  
✅ UX améliorée pour l'utilisateur  

---

**Dernière mise à jour:** 21 novembre 2025
**Composant:** `src/components/Layout/SidebarPageLayout.jsx`
**Documentation:** Ce fichier
