import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './components/auth/LoginView';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { TripRegisterView } from './components/trips/TripRegisterView';
import { TrucksView } from './components/trucks/TrucksView';
import { CompaniesView } from './components/companies/CompaniesView';
import { ProjectsView } from './components/projects/ProjectsView';
import { LocationsView } from './components/locations/LocationsView';
import { RouteTariffsView } from './components/tariffs/RouteTariffsView';
import { ReportsView, ReportType } from './components/reports/ReportsView';
import { UsersView } from './components/users/UsersView';
import { TripFormModal } from './components/trips/TripFormModal';
import { ProfileModal } from './components/profile/ProfileModal';
import { api } from './lib/api';
import { Truck, ConstructionCompany, Location } from './types';

function MainApp() {
  const { user, isLoading, canEdit, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Quick report parameters passed from other views
  const [initialReportTab, setInitialReportTab] = useState<ReportType>('truck_dossier');
  const [targetTruckId, setTargetTruckId] = useState<string | undefined>(undefined);
  const [targetCompanyId, setTargetCompanyId] = useState<string | undefined>(undefined);

  // Global profile modal
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Global trip registration modal
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [companies, setCompanies] = useState<ConstructionCompany[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const openGlobalTripModal = async () => {
    try {
      const [trks, comps, locs] = await Promise.all([
        api.getTrucks(),
        api.getCompanies(),
        api.getLocations(),
      ]);
      setTrucks(trks);
      setCompanies(comps);
      setLocations(locs);
      setIsNewTripModalOpen(true);
    } catch (err) {
      console.error(err);
      setIsNewTripModalOpen(true);
    }
  };

  const navigateToReports = (reportName?: string, extraParams?: { truck_id?: string; company_id?: string }) => {
    if (reportName) {
      const map: Record<string, ReportType> = {
        'truck_transport_pivot': 'truck_transport_pivot',
        'truck_pivot': 'truck_transport_pivot',
        'truck_fees': 'truck_transport_pivot',
        'truck_dossier': 'truck_dossier',
        'trucks': 'truck_performance',
        'truck_performance': 'truck_performance',
        'company_dossier': 'company_dossier',
        'companies': 'companies_projects',
        'companies_projects': 'companies_projects',
        'sand-type': 'sand_type',
        'destinations': 'destinations',
        'loading-points': 'loading_points',
        'time': 'time_summary',
        'register': 'detailed_register',
        'exceptions': 'exceptions',
      };
      setInitialReportTab(map[reportName] || 'truck_dossier');
    }
    if (extraParams?.truck_id) {
      setTargetTruckId(extraParams.truck_id);
    }
    if (extraParams?.company_id) {
      setTargetCompanyId(extraParams.company_id);
    }
    setActiveTab('reports');
  };

  const navigateToTruckDossier = (truckId: string) => {
    setInitialReportTab('truck_dossier');
    setTargetTruckId(truckId);
    setActiveTab('reports');
  };

  const navigateToCompanyReport = (companyId: string) => {
    setInitialReportTab('company_dossier');
    setTargetCompanyId(companyId);
    setActiveTab('reports');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 font-mono text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <span>Verifying Alex Logistics credentials...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row antialiased text-slate-900">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOpenMobile={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          onOpenMobile={() => setIsMobileOpen(true)}
          onOpenNewTripModal={canEdit ? openGlobalTripModal : undefined}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigateToTrips={() => setActiveTab('trips')}
              onNavigateToReports={navigateToReports}
            />
          )}

          {activeTab === 'trips' && (
            <TripRegisterView onNavigateToTruckDossier={navigateToTruckDossier} />
          )}

          {activeTab === 'trucks' && (
            <TrucksView
              onNavigateToTruckDossier={navigateToTruckDossier}
              onNavigateToPivotReport={() => navigateToReports('truck_transport_pivot')}
            />
          )}

          {activeTab === 'companies' && (
            <CompaniesView onNavigateToCompanyReport={navigateToCompanyReport} />
          )}

          {activeTab === 'tariffs' && <RouteTariffsView />}

          {activeTab === 'projects' && <ProjectsView />}

          {activeTab === 'locations' && <LocationsView />}

          {activeTab === 'reports' && (
            <ReportsView
              initialReportType={initialReportTab}
              initialTruckId={targetTruckId}
              initialCompanyId={targetCompanyId}
            />
          )}

          {activeTab === 'users' && isAdmin && <UsersView />}
        </main>
      </div>

      {/* Global Trip Form Modal */}
      {isNewTripModalOpen && (
        <TripFormModal
          isOpen={isNewTripModalOpen}
          onClose={() => setIsNewTripModalOpen(false)}
          onTripSaved={() => {
            setActiveTab('trips');
          }}
          trucks={trucks}
          companies={companies}
          locations={locations}
        />
      )}

      {/* Global User Profile & Password Modal (All Roles) */}
      {isProfileModalOpen && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
