import {
  LayoutDashboard,
  ClipboardList,
  Truck,
  Building2,
  FolderGit2,
  MapPin,
  FileBarChart,
  Users,
  Eye,
  Edit3,
  LogOut,
  Route,
  Factory,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type ActiveTab =
  | 'dashboard'
  | 'trips'
  | 'tariffs'
  | 'trucks'
  | 'companies'
  | 'projects'
  | 'locations'
  | 'reports'
  | 'users';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenProfileModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  onOpenProfileModal,
}) => {
  const { user, canEdit, isAdmin, logout } = useAuth();

  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trips' as ActiveTab, label: 'Trip Register', icon: ClipboardList },
    { id: 'tariffs' as ActiveTab, label: 'Route Tariffs & Fees', icon: Route },
    { id: 'trucks' as ActiveTab, label: 'Hired Trucks', icon: Truck },
    { id: 'companies' as ActiveTab, label: 'Construction Companies', icon: Building2 },
    { id: 'projects' as ActiveTab, label: 'Destination Projects', icon: FolderGit2 },
    { id: 'locations' as ActiveTab, label: 'Crusher Plants', icon: Factory },
    { id: 'reports' as ActiveTab, label: 'Reports & Export', icon: FileBarChart },
    ...(isAdmin ? [{ id: 'users' as ActiveTab, label: 'Users & Roles', icon: Users }] : []),
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Lockup */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-amber-500 flex items-center justify-center font-bold text-slate-950 text-base shadow-xs">
              A
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block leading-tight">
                Alex Logistics
              </span>
              <span className="text-[10px] text-amber-400 font-mono tracking-wider">
                SAND &amp; AGGREGATE
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 tracking-wider font-mono">
            OPERATIONAL LOGISTICS
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* User Account & Session Profile Box */}
        <div className="p-3 mx-3 mb-3 rounded-lg bg-slate-800/90 border border-slate-700/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Signed In As
            </span>
            <span
              className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded border ${
                user?.role === 'admin'
                  ? 'bg-purple-900/60 text-purple-200 border-purple-700'
                  : user?.role === 'data_entry'
                  ? 'bg-emerald-900/60 text-emerald-200 border-emerald-700'
                  : 'bg-blue-900/60 text-blue-200 border-blue-700'
              }`}
            >
              {user?.role === 'admin'
                ? 'Administrator'
                : user?.role === 'data_entry'
                ? 'Role A: Data Entry'
                : 'Role B: Viewer'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-slate-700/80 ring-1 ring-slate-600 overflow-hidden flex items-center justify-center shrink-0">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-bold text-xs text-amber-400 font-mono">
                  {user?.full_name ? user.full_name.slice(0, 2).toUpperCase() : 'U'}
                </span>
              )}
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="text-xs text-slate-100 font-bold truncate">
                {user?.full_name || 'Operational User'}
              </div>
              <div className="text-[10px] font-mono text-slate-400 truncate">
                @{user?.username}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-700/60">
            {canEdit ? (
              <>
                <Edit3 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">Can record trips &amp; fleet data</span>
              </>
            ) : (
              <>
                <Eye className="w-3 h-3 text-blue-400 shrink-0" />
                <span className="truncate">Read-only operational reporting</span>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {onOpenProfileModal && (
              <button
                type="button"
                onClick={onOpenProfileModal}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-[11px] font-medium text-amber-300 bg-amber-950/40 hover:bg-amber-950/70 border border-amber-800/60 hover:border-amber-700 rounded-md transition-colors cursor-pointer"
                title="Manage profile photo and password"
              >
                <KeyRound className="w-3 h-3" />
                <span>Profile</span>
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-[11px] font-medium text-slate-300 bg-slate-700/80 hover:bg-red-950/80 hover:text-red-200 border border-slate-600 hover:border-red-800 rounded-md transition-colors cursor-pointer ${
                !onOpenProfileModal ? 'col-span-2' : ''
              }`}
              title="Sign Out"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Sand Types Reference pill */}
        <div className="px-4 py-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between font-mono">
          <span>SAND GRADES:</span>
          <div className="flex gap-1.5 text-slate-200">
            <span className="px-1.5 bg-slate-800 rounded font-bold">00</span>
            <span className="px-1.5 bg-slate-800 rounded font-bold">01</span>
            <span className="px-1.5 bg-slate-800 rounded font-bold">02</span>
          </div>
        </div>
      </aside>
    </>
  );
};
