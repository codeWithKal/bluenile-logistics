import React, { useState, useEffect } from 'react';
import {
  Plus,
  ShieldCheck,
  Edit2,
  KeyRound,
  Trash2,
  Power,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserX,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  Mail,
  User as UserIcon,
  Search,
  Filter,
  History,
  Download,
  RefreshCw,
  Users as UsersGroupIcon,
  UserPlus,
  Activity,
  ShieldAlert,
  Clock,
  ExternalLink
} from 'lucide-react';
import { User, UserRole, AuditLog, AuditLogSummary } from '../../types';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export const UsersView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Activity Log State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSummary, setAuditSummary] = useState<AuditLogSummary | null>(null);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditTotal, setAuditTotal] = useState(0);

  // New user modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('data_entry');
  const [createModalError, setCreateModalError] = useState<string | null>(null);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  // Edit user modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('data_entry');
  const [editPassword, setEditPassword] = useState('');
  const [editIsActive, setEditIsActive] = useState<number>(1);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string>('');
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Quick Password Reset modal
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetModalError, setResetModalError] = useState<string | null>(null);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  // Delete User Confirmation Modal
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);

  const loadUsers = () => {
    setIsLoading(true);
    api.getUsers()
      .then(setUsers)
      .catch((err) => console.error('Failed to load users', err))
      .finally(() => setIsLoading(false));
  };

  const loadAuditLogs = (search?: string, action?: string) => {
    setIsAuditLoading(true);
    const searchVal = search !== undefined ? search : auditSearchQuery;
    const actionVal = action !== undefined ? action : auditActionFilter;

    api.getAuditLogs({
      entity_type: 'user',
      action: actionVal !== 'all' ? actionVal : undefined,
      search: searchVal.trim() || undefined,
      limit: 300,
    })
      .then((res) => {
        setAuditLogs(res.logs || []);
        setAuditTotal(res.total || 0);
        setAuditSummary(res.summary || null);
      })
      .catch((err) => {
        console.error('Failed to load audit logs:', err);
      })
      .finally(() => {
        setIsAuditLoading(false);
      });
  };

  useEffect(() => {
    loadUsers();
    loadAuditLogs();
  }, []);

  const notifySuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4500);
  };

  const handleExportAuditCSV = () => {
    if (auditLogs.length === 0) return;
    const headers = ['Log ID', 'Timestamp (UTC)', 'Admin / Actor', 'Action Type', 'Target Entity', 'Details'];
    const rows = auditLogs.map((l) => [
      `"${l.id}"`,
      `"${l.created_at}"`,
      `"${l.user_name || 'System'}"`,
      `"${l.action}"`,
      `"${l.entity_id}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sandtrack_user_activity_audit_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleViewUserAudit = (u: User) => {
    setActiveTab('audit');
    setAuditSearchQuery(u.username);
    setAuditActionFilter('all');
    loadAuditLogs(u.username, 'all');
  };

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getRelativeTime = (isoString: string): string => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDays = Math.floor(diffHr / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  const getActionBadgeConfig = (action: string) => {
    switch (action) {
      case 'RESET_PASSWORD':
        return {
          label: 'Admin Password Reset',
          className: 'bg-amber-100 text-amber-900 border-amber-300',
          icon: KeyRound,
          dotColor: 'bg-amber-500'
        };
      case 'SELF_PASSWORD_CHANGE':
        return {
          label: 'Self Password Change',
          className: 'bg-yellow-100 text-yellow-900 border-yellow-300',
          icon: Lock,
          dotColor: 'bg-yellow-500'
        };
      case 'ENABLE_USER':
        return {
          label: 'Account Enabled',
          className: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          icon: CheckCircle2,
          dotColor: 'bg-emerald-500'
        };
      case 'DISABLE_USER':
        return {
          label: 'Account Disabled',
          className: 'bg-rose-100 text-rose-900 border-rose-300',
          icon: Power,
          dotColor: 'bg-rose-500'
        };
      case 'CREATE_USER':
        return {
          label: 'User Created',
          className: 'bg-blue-100 text-blue-900 border-blue-300',
          icon: UserPlus,
          dotColor: 'bg-blue-500'
        };
      case 'REGISTER_USER':
        return {
          label: 'User Registered',
          className: 'bg-sky-100 text-sky-900 border-sky-300',
          icon: UserCheck,
          dotColor: 'bg-sky-500'
        };
      case 'UPDATE_USER':
        return {
          label: 'User Modified',
          className: 'bg-indigo-100 text-indigo-900 border-indigo-300',
          icon: Edit2,
          dotColor: 'bg-indigo-500'
        };
      case 'CHANGE_ROLE':
        return {
          label: 'Role Modified',
          className: 'bg-purple-100 text-purple-900 border-purple-300',
          icon: ShieldCheck,
          dotColor: 'bg-purple-500'
        };
      case 'DELETE_USER':
        return {
          label: 'Account Deleted',
          className: 'bg-red-100 text-red-950 border-red-400 font-bold',
          icon: Trash2,
          dotColor: 'bg-red-600'
        };
      default:
        return {
          label: action,
          className: 'bg-slate-100 text-slate-800 border-slate-300',
          icon: History,
          dotColor: 'bg-slate-400'
        };
    }
  };

  // 1. Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateModalError(null);
    if (!createUsername.trim() || !createFullName.trim() || !createEmail.trim() || !createPassword.trim()) {
      setCreateModalError('All fields are required.');
      return;
    }
    if (createPassword.trim().length < 6) {
      setCreateModalError('Password must be at least 6 characters long.');
      return;
    }

    setIsCreateSubmitting(true);
    try {
      await api.createUser({
        username: createUsername.trim().toLowerCase(),
        full_name: createFullName.trim(),
        email: createEmail.trim().toLowerCase(),
        password: createPassword.trim(),
        role: createRole,
        is_active: 1,
      });
      setIsCreateModalOpen(false);
      setCreateUsername('');
      setCreateFullName('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateRole('data_entry');
      notifySuccess(`New user account "${createUsername.trim()}" created successfully!`);
      loadUsers();
      loadAuditLogs();
    } catch (err: any) {
      setCreateModalError(err.message || 'Failed to create user');
    } finally {
      setIsCreateSubmitting(false);
    }
  };

  // 2. Open Edit User Modal
  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditFullName(u.full_name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditPassword('');
    setEditIsActive(u.is_active !== undefined ? Number(u.is_active) : 1);
    setEditAvatarUrl(u.avatar_url || '');
    setEditModalError(null);
  };

  // 3. Handle Save User Edit
  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditModalError(null);

    if (!editUsername.trim() || !editFullName.trim() || !editEmail.trim()) {
      setEditModalError('Username, Full Name, and Email are all required.');
      return;
    }

    if (editPassword.trim().length > 0 && editPassword.trim().length < 6) {
      setEditModalError('New password must be at least 6 characters long.');
      return;
    }

    setIsEditSubmitting(true);
    try {
      await api.updateUser(editingUser.id, {
        username: editUsername.trim().toLowerCase(),
        full_name: editFullName.trim(),
        email: editEmail.trim().toLowerCase(),
        role: editRole,
        avatar_url: editAvatarUrl.trim() || null,
        password: editPassword.trim() || undefined,
        is_active: editIsActive,
      });

      setEditingUser(null);
      notifySuccess(`User "${editUsername.trim()}" details updated successfully!`);
      loadUsers();
      loadAuditLogs();
    } catch (err: any) {
      setEditModalError(err.message || 'Failed to update user');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // 4. Handle Quick Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUser) return;
    setResetModalError(null);

    if (!resetPasswordValue.trim() || resetPasswordValue.trim().length < 6) {
      setResetModalError('Password must be at least 6 characters long.');
      return;
    }

    setIsResetSubmitting(true);
    try {
      await api.updateUserPassword(passwordResetUser.id, resetPasswordValue.trim());
      notifySuccess(`Password for user "${passwordResetUser.username}" was reset successfully!`);
      setPasswordResetUser(null);
      setResetPasswordValue('');
      loadAuditLogs();
    } catch (err: any) {
      setResetModalError(err.message || 'Failed to reset password');
    } finally {
      setIsResetSubmitting(false);
    }
  };

  // 5. Handle Toggle Enable / Disable
  const handleToggleStatus = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert('You cannot disable your own active administrator account.');
      return;
    }

    const currentStatus = user.is_active !== undefined ? Number(user.is_active) : 1;
    const nextStatus = currentStatus === 1 ? 0 : 1;
    const actionLabel = nextStatus === 1 ? 'enable' : 'disable';

    if (!window.confirm(`Are you sure you want to ${actionLabel} the account for ${user.full_name} (${user.username})?`)) {
      return;
    }

    try {
      await api.toggleUserStatus(user.id, nextStatus);
      notifySuccess(`User "${user.username}" is now ${nextStatus === 1 ? 'Enabled' : 'Disabled'}.`);
      loadUsers();
      loadAuditLogs();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  // 6. Handle Delete User
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.id === currentUser?.id) {
      setDeleteModalError('You cannot delete your own active administrator account.');
      return;
    }

    setIsDeleteSubmitting(true);
    setDeleteModalError(null);
    try {
      await api.deleteUser(userToDelete.id);
      notifySuccess(`User account "${userToDelete.username}" was permanently deleted.`);
      setUserToDelete(null);
      loadUsers();
      loadAuditLogs();
    } catch (err: any) {
      setDeleteModalError(err.message || 'Failed to delete user');
    } finally {
      setIsDeleteSubmitting(false);
    }
  };

  // Generate strong random password helper
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 10; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  // Filtered users list
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter === 'active' && u.is_active === 0) return false;
    if (statusFilter === 'disabled' && u.is_active !== 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Role & Permissions Header Card */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900">
              User Management &amp; Role-Based Access Control (RBAC)
            </h2>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">
            Admin Full Access Mode
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          As a System Administrator, you have full authority to provision accounts, modify user profile details, reset passwords, enable or disable system access, and remove inactive accounts.
        </p>
      </div>

      {/* Administrative Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UsersGroupIcon className="w-4 h-4" />
          <span>User Accounts Registry</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
            activeTab === 'users' ? 'bg-amber-600/30 text-slate-950' : 'bg-slate-100 text-slate-600'
          }`}>
            {users.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('audit');
            loadAuditLogs();
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Administrative Activity Log</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
            activeTab === 'audit' ? 'bg-amber-600/30 text-slate-950' : 'bg-purple-100 text-purple-800'
          }`}>
            {auditTotal > 0 ? auditTotal : auditLogs.length}
          </span>
        </button>
      </div>

      {/* Users Registry Table Card */}
      {activeTab === 'users' && (
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Header & Controls Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">User Accounts Registry</h3>
            <span className="text-xs text-slate-500 font-mono">
              Total: {users.length} registered accounts ({users.filter(u => u.is_active !== 0).length} active)
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user, email, role..."
                className="w-full text-xs pl-8 pr-2.5 py-1 bg-white border border-slate-300 rounded focus:outline-hidden focus:border-amber-500"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700"
            >
              <option value="all">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="data_entry">Data Entry</option>
              <option value="viewer">Viewers</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="disabled">Disabled Only</option>
            </select>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New User</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 font-mono text-[11px] text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-4">Username</th>
                <th className="py-2.5 px-4">Email</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4">Created Date</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-mono">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-mono">
                    No users found matching your search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isActive = u.is_active !== undefined ? Number(u.is_active) === 1 : true;
                  const isSelf = u.id === currentUser?.id;

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        !isActive ? 'bg-slate-50/60 opacity-80' : ''
                      }`}
                    >
                      {/* User Avatar & Name */}
                      <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 ring-1 ring-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-bold text-[10px] text-amber-600 font-mono">
                                {u.full_name ? u.full_name.slice(0, 2).toUpperCase() : 'U'}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="leading-tight flex items-center gap-1.5">
                              <span>{u.full_name}</span>
                              {isSelf && (
                                <span className="text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-900 font-mono font-bold">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal font-mono">ID: {u.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                        @{u.username}
                      </td>

                      {/* Email */}
                      <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap font-mono">
                        {u.email}
                      </td>

                      {/* Role Badge */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                              : u.role === 'data_entry'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : 'bg-blue-100 text-blue-900 border border-blue-200'
                          }`}
                        >
                          {u.role === 'admin'
                            ? 'Administrator'
                            : u.role === 'data_entry'
                            ? 'Data Entry Operator'
                            : 'Viewer / Auditor'}
                        </span>
                      </td>

                      {/* Status Toggle Badge */}
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                            <span>Disabled</span>
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-2.5 px-4 text-slate-500 font-mono whitespace-nowrap">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                      </td>

                      {/* Admin Actions Strip */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* 1. Edit Full User Info Button */}
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="p-1.5 text-slate-600 hover:text-amber-800 hover:bg-amber-100/70 rounded transition-colors cursor-pointer"
                            title="Edit full user information, username, email & role"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* 2. Reset Password Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordResetUser(u);
                              setResetPasswordValue('');
                              setResetModalError(null);
                            }}
                            className="p-1.5 text-slate-600 hover:text-blue-800 hover:bg-blue-100/70 rounded transition-colors cursor-pointer"
                            title="Reset this user's password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* 3. Enable / Disable Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            disabled={isSelf}
                            className={`p-1.5 rounded transition-colors cursor-pointer ${
                              isSelf
                                ? 'text-slate-300 cursor-not-allowed'
                                : isActive
                                ? 'text-slate-500 hover:text-amber-700 hover:bg-amber-50'
                                : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                            }`}
                            title={
                              isSelf
                                ? 'Cannot disable your own active administrator account'
                                : isActive
                                ? 'Disable (Deactivate) user account'
                                : 'Enable (Activate) user account'
                            }
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                            {/* 4. Delete User Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setUserToDelete(u);
                                setDeleteModalError(null);
                              }}
                              disabled={isSelf}
                              className={`p-1.5 rounded transition-colors cursor-pointer ${
                                isSelf
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-400 hover:text-red-700 hover:bg-red-50'
                              }`}
                              title={isSelf ? 'Cannot delete your own active administrator account' : 'Delete user from system'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* 5. View Activity Log for this user */}
                            <button
                              type="button"
                              onClick={() => handleViewUserAudit(u)}
                              className="p-1.5 text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                              title={`View activity audit log for @${u.username}`}
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ADMINISTRATIVE ACTIVITY LOG                        */}
      {/* ========================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Executive Security KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Total User Events */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-slate-700" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block truncate">
                  Total Logged Actions
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 leading-tight">
                  {auditSummary?.totalUserEvents ?? auditTotal}
                </span>
              </div>
            </div>

            {/* 2. Password Resets */}
            <div className="bg-white p-3.5 rounded-lg border border-amber-200 shadow-2xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-amber-700 font-mono uppercase tracking-wider block truncate">
                  Password Changes
                </span>
                <span className="text-lg font-bold font-mono text-amber-950 leading-tight">
                  {auditSummary?.passwordEvents ?? 0}
                </span>
              </div>
            </div>

            {/* 3. Account Access Toggles */}
            <div className="bg-white p-3.5 rounded-lg border border-emerald-200 shadow-2xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <Power className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-emerald-700 font-mono uppercase tracking-wider block truncate">
                  Access Toggles
                </span>
                <span className="text-lg font-bold font-mono text-emerald-950 leading-tight">
                  {auditSummary?.statusEvents ?? 0}
                </span>
              </div>
            </div>

            {/* 4. Lifecycle & Role Edits */}
            <div className="bg-white p-3.5 rounded-lg border border-purple-200 shadow-2xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-purple-700 font-mono uppercase tracking-wider block truncate">
                  Lifecycle &amp; Edits
                </span>
                <span className="text-lg font-bold font-mono text-purple-950 leading-tight">
                  {(auditSummary?.lifecycleEvents ?? 0) + (auditSummary?.editEvents ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Audit Logs Table Card */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
            {/* Controls & Filter Bar */}
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Security &amp; User Activity Audit Trail</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Immutable Log
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {auditLogs.length} events {auditTotal > auditLogs.length ? `of ${auditTotal}` : ''} recorded in persistent storage.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Search Input */}
                <div className="relative w-48 sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                  <input
                    type="text"
                    value={auditSearchQuery}
                    onChange={(e) => {
                      setAuditSearchQuery(e.target.value);
                      loadAuditLogs(e.target.value, auditActionFilter);
                    }}
                    placeholder="Search admin, user, details..."
                    className="w-full text-xs pl-8 pr-2.5 py-1 bg-white border border-slate-300 rounded focus:outline-hidden focus:border-amber-500"
                  />
                  {auditSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuditSearchQuery('');
                        loadAuditLogs('', auditActionFilter);
                      }}
                      className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Action Filter */}
                <select
                  value={auditActionFilter}
                  onChange={(e) => {
                    setAuditActionFilter(e.target.value);
                    loadAuditLogs(auditSearchQuery, e.target.value);
                  }}
                  className="text-xs px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700"
                >
                  <option value="all">All Action Types</option>
                  <option value="RESET_PASSWORD">Password Resets (Admin)</option>
                  <option value="SELF_PASSWORD_CHANGE">Password Changes (User)</option>
                  <option value="ENABLE_USER">Account Enabled</option>
                  <option value="DISABLE_USER">Account Disabled</option>
                  <option value="CREATE_USER">Account Created</option>
                  <option value="UPDATE_USER">Account Updated</option>
                  <option value="CHANGE_ROLE">Role Changes</option>
                  <option value="DELETE_USER">Account Deleted</option>
                </select>

                {/* Refresh Button */}
                <button
                  type="button"
                  onClick={() => loadAuditLogs()}
                  disabled={isAuditLoading}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-xs text-slate-700 transition-colors cursor-pointer"
                  title="Refresh Audit Logs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAuditLoading ? 'animate-spin text-amber-600' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                {/* Export CSV Button */}
                <button
                  type="button"
                  onClick={handleExportAuditCSV}
                  disabled={auditLogs.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  title="Export audit log to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 font-mono text-[11px] text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Performed By (Admin)</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Target Entity</th>
                    <th className="py-2.5 px-4">Audit Trail Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isAuditLoading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-mono">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                          <span>Loading administrative audit logs...</span>
                        </div>
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                          <History className="w-8 h-8 text-slate-300" />
                          <p className="font-semibold text-slate-700">No activity logs found</p>
                          <p className="text-xs text-slate-500">
                            No user management events match your current filter or search criteria.
                          </p>
                          {(auditSearchQuery || auditActionFilter !== 'all') && (
                            <button
                              type="button"
                              onClick={() => {
                                setAuditSearchQuery('');
                                setAuditActionFilter('all');
                                loadAuditLogs('', 'all');
                              }}
                              className="mt-2 text-xs text-amber-600 hover:underline font-semibold"
                            >
                              Reset filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => {
                      const cfg = getActionBadgeConfig(log.action);
                      const IconComp = cfg.icon;
                      const relTime = getRelativeTime(log.created_at);

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Timestamp */}
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-mono text-slate-800 font-semibold text-[11px]">
                                {formatDateTime(log.created_at)}
                              </span>
                              {relTime && (
                                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                  <Clock className="w-2.5 h-2.5 text-slate-400" />
                                  {relTime}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Performed By */}
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-700 font-mono shrink-0">
                                {log.user_name ? log.user_name.slice(0, 2).toUpperCase() : 'SY'}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-900 block leading-tight">
                                  {log.user_name || 'System'}
                                </span>
                                {log.user_id && (
                                  <span className="text-[10px] font-mono text-slate-400">
                                    {log.user_id}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Action Badge */}
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${cfg.className}`}
                            >
                              <IconComp className="w-3 h-3 shrink-0" />
                              <span>{cfg.label}</span>
                            </span>
                          </td>

                          {/* Target Entity */}
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700">
                              {log.entity_id}
                            </span>
                          </td>

                          {/* Details */}
                          <td className="py-2.5 px-4 text-slate-700 max-w-md">
                            <p className="leading-relaxed break-words font-sans text-xs">
                              {log.details || 'No additional details recorded.'}
                            </p>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: CREATE NEW USER                                  */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden text-xs animate-scale-up">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">Provision New User Account</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-4 space-y-3">
              {createModalError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{createModalError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={createFullName}
                  onChange={(e) => setCreateFullName(e.target.value)}
                  placeholder="e.g. Dawit Bekele"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value.toLowerCase())}
                  placeholder="e.g. dawit_operator"
                  className="w-full px-3 py-1.5 font-mono bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value.toLowerCase())}
                  placeholder="e.g. dawit@abtrading.com"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Initial Password *</span>
                  <button
                    type="button"
                    onClick={() => setCreatePassword(generateRandomPassword())}
                    className="text-[10px] text-amber-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Generate Strong</span>
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    required
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-3 py-1.5 pr-8 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCreatePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Role *</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
                >
                  <option value="data_entry">Role A: Data Entry Operator (Full Trip Logging &amp; Updates)</option>
                  <option value="viewer">Role B: Viewer / Auditor (Read-Only Reports &amp; Dossiers)</option>
                  <option value="admin">Administrator (Complete System Access &amp; User Control)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 font-medium rounded hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreateSubmitting}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isCreateSubmitting ? 'Provisioning...' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: FULL USER EDIT (USERNAME, EMAIL, ROLE, PW, STATUS) */}
      {/* ========================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden text-xs animate-scale-up">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Edit User Account: @{editingUser.username}
                </h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEditUser} className="p-4 space-y-3">
              {editModalError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{editModalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase())}
                    className="w-full px-3 py-1.5 font-mono bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value.toLowerCase())}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Role *</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    disabled={editingUser.id === currentUser?.id}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden disabled:bg-slate-100"
                  >
                    <option value="data_entry">Data Entry Operator</option>
                    <option value="viewer">Viewer / Auditor</option>
                    <option value="admin">Administrator</option>
                  </select>
                  {editingUser.id === currentUser?.id && (
                    <span className="text-[10px] text-slate-400 mt-0.5 block italic">Cannot demote your own active account</span>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Access Status *</label>
                  <select
                    value={editIsActive}
                    onChange={(e) => setEditIsActive(Number(e.target.value))}
                    disabled={editingUser.id === currentUser?.id}
                    className={`w-full px-3 py-1.5 border rounded focus:outline-hidden font-semibold ${
                      editIsActive === 1
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-red-50 text-red-900 border-red-300'
                    }`}
                  >
                    <option value={1}>Active (Full Access Allowed)</option>
                    <option value={0}>Disabled (Blocked from Logging In)</option>
                  </select>
                </div>
              </div>

              {/* Password update section */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Change Password (Leave blank to keep existing)</span>
                  <button
                    type="button"
                    onClick={() => setEditPassword(generateRandomPassword())}
                    className="text-[10px] text-amber-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Generate Strong</span>
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Enter new password to overwrite or leave empty"
                    className="w-full px-3 py-1.5 pr-8 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Avatar / Picture URL (Optional)</label>
                <input
                  type="text"
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  placeholder="https://... or data:image/png;base64,..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden font-mono text-[11px]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 font-medium rounded hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isEditSubmitting ? 'Saving...' : 'Save User Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: QUICK PASSWORD RESET                             */}
      {/* ========================================================= */}
      {passwordResetUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden text-xs animate-scale-up">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Reset Password for @{passwordResetUser.username}
                </h3>
              </div>
              <button
                onClick={() => setPasswordResetUser(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="p-4 space-y-3">
              {resetModalError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{resetModalError}</span>
                </div>
              )}

              <p className="text-slate-600 text-xs">
                Enter a new password for <strong>{passwordResetUser.full_name}</strong>. Their previous password will immediately be overwritten.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>New Password *</span>
                  <button
                    type="button"
                    onClick={() => setResetPasswordValue(generateRandomPassword())}
                    className="text-[10px] text-amber-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Generate Strong</span>
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-3 py-1.5 pr-8 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-blue-500 focus:outline-hidden font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasswordResetUser(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 font-medium rounded hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetSubmitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isResetSubmitting ? 'Resetting...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: DELETE USER CONFIRMATION                         */}
      {/* ========================================================= */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden text-xs animate-scale-up">
            <div className="p-4 border-b border-red-100 flex items-center gap-2 bg-red-50 text-red-900">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <h3 className="font-bold text-sm">Delete User Account</h3>
            </div>
            <div className="p-4 space-y-3">
              {deleteModalError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs">
                  {deleteModalError}
                </div>
              )}
              <p className="text-slate-700 leading-relaxed">
                Are you sure you want to permanently delete the user account for{' '}
                <strong>{userToDelete.full_name}</strong> (<code>@{userToDelete.username}</code>)?
              </p>
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900">
                <strong>Warning:</strong> This action is irreversible. The user will immediately lose system access.
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 font-medium rounded hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={isDeleteSubmitting}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isDeleteSubmitting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
