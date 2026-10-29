import React from 'react';
import { Menu, Plus, User as UserIcon, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ActiveTab } from './Sidebar';

interface HeaderProps {
  activeTab: ActiveTab;
  onOpenMobile: () => void;
  onOpenNewTripModal?: () => void;
  onOpenProfileModal?: () => void;
}

const tabTitles: Record<ActiveTab, { title: string; subtitle: string }> = {
  dashboard: { title: 'Operational Dashboard', subtitle: 'Crusher Dispatch & Destination Project Deliveries' },
  trips: { title: 'Unified Trip Register', subtitle: 'Crusher Site Loading to Destination Project Unloading' },
  tariffs: { title: 'Route Tariffs & Transport Fees', subtitle: 'Fixed Route Transport Rates (ETB/m³) & Auto-Fee Configuration' },
  trucks: { title: 'External Truck Registry', subtitle: 'Hired Independent Trucks & Fleet Capacity' },
  companies: { title: 'Construction Companies', subtitle: 'Clients with One or More Destination Projects' },
  projects: { title: 'Destination Projects', subtitle: 'Unloading Delivery Jobsites Belonging to Construction Clients' },
  locations: { title: 'Crusher Plants', subtitle: 'Sand & Aggregate Origin Loading Facilities (Crushers & Quarries)' },
  reports: { title: 'Analytics & Financial Reports', subtitle: 'Trip Transport Fees, ETB/m³ and Total/Truck Breakdown, Material Reports' },
  users: { title: 'Users & Permissions', subtitle: 'System Access & Role Control' },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMobile,
  onOpenNewTripModal,
  onOpenProfileModal,
}) => {
  const { user, canEdit, logout } = useAuth();
  const current = tabTitles[activeTab];

  return (
    <header className="h-16 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Breadcrumb & Mobile Toggle */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobile}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 lg:hidden cursor-pointer"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200/90 p-0.5 flex items-center justify-center shrink-0 shadow-2xs">
          <img
            src="/ab-trading-logo.jpg"
            alt="AB Trading Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">AB Trading</span>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-slate-800 truncate">{current.title}</span>
          </div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight truncate">
            {current.title}
          </h1>
        </div>
      </div>

      {/* Primary Actions & User Info */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {canEdit && onOpenNewTripModal && (
          <button
            type="button"
            onClick={onOpenNewTripModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-md transition-colors shadow-xs whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Trip</span>
          </button>
        )}

        {/* Profile button (mobile icon) */}
        {onOpenProfileModal && (
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="sm:hidden p-2 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
            title="My Profile & Password"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="w-6 h-6 rounded-full object-cover ring-1 ring-amber-500"
              />
            ) : (
              <UserIcon className="w-5 h-5" />
            )}
          </button>
        )}

        {/* Desktop Profile card with quick trigger */}
        <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-slate-200 text-xs">
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="flex items-center gap-2 p-1.5 -m-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left cursor-pointer group"
            title="Click to edit profile picture or change password"
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 ring-1 ring-slate-200 overflow-hidden flex items-center justify-center font-semibold text-slate-700 shrink-0 group-hover:ring-amber-500 transition-all">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user?.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-bold text-xs text-amber-600 font-mono">
                  {user?.full_name ? user.full_name.slice(0, 2).toUpperCase() : 'U'}
                </span>
              )}
            </div>
            <div className="leading-tight text-left">
              <div className="font-semibold text-slate-900 group-hover:text-amber-600 transition-colors flex items-center gap-1">
                <span>{user?.full_name}</span>
                <Settings className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-[10px] text-slate-500 font-mono capitalize">
                {user?.role === 'data_entry' ? 'Data Entry Operator' : user?.role === 'viewer' ? 'Viewer' : 'Admin'}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={logout}
            className="p-1.5 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
