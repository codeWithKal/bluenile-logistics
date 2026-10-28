import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Camera,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  Sparkles,
  Cloud,
  Database,
  RefreshCw,
  HardDrive,
  ExternalLink,
  Download,
  History,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Curated avatar presets with high-res SVG data URIs or colorful stylized initials/vectors
const AVATAR_PRESETS = [
  {
    id: 'preset-1',
    label: 'Dispatcher / Operator',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset-2',
    label: 'Fleet Logistics Lead',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset-3',
    label: 'Transport Controller',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset-4',
    label: 'Site Operations Manager',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset-5',
    label: 'Quarry Supervisor',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset-6',
    label: 'Haulage Specialist',
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset-7',
    label: 'Data Analyst & Auditor',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset-8',
    label: 'Executive Director',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile, changePassword } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'backup'>('profile');

  // Profile Edit State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url || null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Cloud Backup Diagnostics State
  const [backupInfo, setBackupInfo] = useState<any>(null);
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [syncingBackup, setSyncingBackup] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  const fetchBackupStatus = async () => {
    setLoadingBackup(true);
    try {
      const data = await api.getCloudBackupStatus();
      setBackupInfo(data);
    } catch (err: any) {
      setBackupInfo({ isConfigured: false, status: 'error', message: err.message || 'Failed to inspect status' });
    } finally {
      setLoadingBackup(false);
    }
  };

  // Historic Backups State
  const [historicBackups, setHistoricBackups] = useState<any[]>([]);
  const [loadingBackupsList, setLoadingBackupsList] = useState(false);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);

  const fetchHistoricBackups = async () => {
    setLoadingBackupsList(true);
    try {
      const list = await api.getCloudBackupsList();
      setHistoricBackups(list);
    } catch (err) {
      console.error('Could not load historic backups:', err);
    } finally {
      setLoadingBackupsList(false);
    }
  };

  const handleManualSync = async () => {
    setSyncingBackup(true);
    setSyncFeedback(null);
    try {
      const res = await api.syncCloudBackup(false);
      if (res.success) {
        setSyncFeedback({ text: res.message, isError: false });
        await Promise.all([fetchBackupStatus(), fetchHistoricBackups()]);
      } else {
        setSyncFeedback({ text: res.message, isError: true });
      }
    } catch (err: any) {
      setSyncFeedback({ text: err.message || 'Sync failed', isError: true });
    } finally {
      setSyncingBackup(false);
    }
  };

  const handleCreateTimestampedSnapshot = async () => {
    setSyncingBackup(true);
    setSyncFeedback(null);
    try {
      const res = await api.syncCloudBackup(true);
      if (res.success) {
        setSyncFeedback({ text: res.message, isError: false });
        await Promise.all([fetchBackupStatus(), fetchHistoricBackups()]);
      } else {
        setSyncFeedback({ text: res.message, isError: true });
      }
    } catch (err: any) {
      setSyncFeedback({ text: err.message || 'Snapshot creation failed', isError: true });
    } finally {
      setSyncingBackup(false);
    }
  };

  const handleRestoreBackup = async (fileName: string) => {
    const isConfirmed = window.confirm(
      `Restore confirmation:\n\nAre you sure you want to restore the system database from "${fileName}"?\n\nThis will replace the current active SQLite database with this snapshot and refresh the application.`
    );
    if (!isConfirmed) return;

    setRestoringFile(fileName);
    setSyncFeedback(null);
    try {
      const res = await api.restoreCloudBackup(fileName);
      if (res.success) {
        setSyncFeedback({ text: `${res.message} Reloading application...`, isError: false });
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setSyncFeedback({ text: res.message, isError: true });
      }
    } catch (err: any) {
      setSyncFeedback({ text: err.message || 'Restore failed', isError: true });
    } finally {
      setRestoringFile(null);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !user) return null;

  // Compress & resize uploaded image to 200x200 JPEG to ensure fast uploads & low storage footprint
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Crop to square center
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setAvatarUrl(dataUrl);
        setProfileError(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!fullName.trim()) {
      setProfileError('Full name cannot be blank.');
      return;
    }

    setProfileSaving(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        avatar_url: avatarUrl,
      });
      setProfileSuccess('Profile details and picture updated successfully!');
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please provide your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess('Password changed successfully! Keep your new credentials secure.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password. Please check your current password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return {
          label: 'Administrator',
          desc: 'Full System Control & User Management',
          classes: 'bg-purple-900/40 text-purple-300 border-purple-700/60',
        };
      case 'data_entry':
        return {
          label: 'Data Entry Operator',
          desc: 'Trips, Crushers & Hired Fleet Management',
          classes: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/60',
        };
      default:
        return {
          label: 'Viewer',
          desc: 'Read-only Analytics, Audits & PDF Exports',
          classes: 'bg-blue-900/40 text-blue-300 border-blue-700/60',
        };
    }
  };

  const roleInfo = getRoleBadge(user.role);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl text-slate-100 overflow-hidden flex flex-col my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Account &amp; Profile Settings</h2>
              <p className="text-xs text-slate-400">
                Manage your personal details, profile photo, and password security
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Identity Banner */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex flex-col sm:flex-row items-center sm:items-start gap-4">
          {/* Avatar with upload button */}
          <div className="relative group shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-800 ring-2 ring-amber-500/40 shadow-lg flex items-center justify-center">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-800 text-amber-400 flex items-center justify-center text-2xl font-bold font-mono">
                  {user.full_name ? user.full_name.slice(0, 2).toUpperCase() : 'U'}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-transform hover:scale-110 cursor-pointer"
              title="Upload new photo"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* User Details */}
          <div className="flex-1 text-center sm:text-left space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h3 className="text-base font-bold text-white">{user.full_name}</h3>
              <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${roleInfo.classes}`}>
                {roleInfo.label}
              </span>
            </div>
            <div className="text-xs font-mono text-slate-400">
              @{user.username} • {user.email}
            </div>
            <p className="text-[11px] text-slate-500 pt-1 flex items-center justify-center sm:justify-start gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
              <span>{roleInfo.desc}</span>
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-5 bg-slate-900/60">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Profile &amp; Photo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'password'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Change Password</span>
          </button>
          {user.role === 'admin' && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('backup');
                fetchBackupStatus();
                fetchHistoricBackups();
              }}
              className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === 'backup'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Cloud Persistence</span>
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4">
          {/* TAB 1: PROFILE & PICTURE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-5 text-xs">
              {profileError && (
                <div className="p-3 bg-red-950/70 border border-red-800 rounded-lg text-red-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{profileError}</span>
                </div>
              )}

              {profileSuccess && (
                <div className="p-3 bg-emerald-950/70 border border-emerald-800 rounded-lg text-emerald-200 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Full Display Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Elena Vance"
                  className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-lg text-white focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Username & Email Read-Only Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-400">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Username (System Identifier)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user.username}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 font-mono cursor-not-allowed opacity-80"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 font-mono cursor-not-allowed opacity-80"
                  />
                </div>
              </div>

              {/* Profile Picture Actions */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span>Choose Profile Picture</span>
                  </span>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(null)}
                      className="text-red-400 hover:text-red-300 flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Picture</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-slate-200 font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>Upload Custom Image</span>
                  </button>
                </div>

                {/* Preset Avatars */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Or pick from preset fleet &amp; operations photos:</span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {AVATAR_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setAvatarUrl(preset.url)}
                        title={preset.label}
                        className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all p-0.5 cursor-pointer ${
                          avatarUrl === preset.url
                            ? 'border-amber-400 ring-2 ring-amber-500/50 scale-105'
                            : 'border-slate-700 hover:border-slate-500 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="w-full h-full object-cover rounded-full"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Submit Profile */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: CHANGE PASSWORD */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
              {passwordError && (
                <div className="p-3 bg-red-950/70 border border-red-800 rounded-lg text-red-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-emerald-950/70 border border-emerald-800 rounded-lg text-emerald-200 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {/* Current Password */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your existing account password"
                    className="w-full pl-3 pr-10 py-2 bg-slate-800/90 border border-slate-700 rounded-lg text-white font-mono focus:border-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  New Password (min 6 characters)
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Create a strong new password"
                    className="w-full pl-3 pr-10 py-2 bg-slate-800/90 border border-slate-700 rounded-lg text-white font-mono focus:border-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type your new password"
                  className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-lg text-white font-mono focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Password Requirements helper */}
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] space-y-1.5 text-slate-400">
                <div className="font-semibold text-slate-300">Password Checklist:</div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${newPassword.length >= 6 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <span className={newPassword.length >= 6 ? 'text-emerald-300' : 'text-slate-400'}>
                    At least 6 characters in length
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${newPassword && newPassword === confirmPassword ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <span className={newPassword && newPassword === confirmPassword ? 'text-emerald-300' : 'text-slate-400'}>
                    New password and confirmation match
                  </span>
                </div>
              </div>

              {/* Submit Password */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving || newPassword.length < 6 || newPassword !== confirmPassword}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {passwordSaving ? 'Updating Password...' : 'Change Password'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: CLOUD PERSISTENCE & BACKUP (Admin Only) */}
          {activeTab === 'backup' && user.role === 'admin' && (
            <div className="space-y-4 text-xs">
              {/* Feedback Alert */}
              {syncFeedback && (
                <div
                  className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                    syncFeedback.isError
                      ? 'bg-red-950/70 border-red-800 text-red-200'
                      : 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
                  }`}
                >
                  {syncFeedback.isError ? (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <span>{syncFeedback.text}</span>
                </div>
              )}

              {/* Status Overview Card */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-slate-200">Supabase Cloud Storage Status</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchBackupStatus}
                    disabled={loadingBackup}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                    title="Refresh status"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingBackup ? 'animate-spin text-amber-400' : ''}`} />
                  </button>
                </div>

                {loadingBackup ? (
                  <div className="py-6 flex items-center justify-center gap-2 text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Querying Supabase persistent storage...</span>
                  </div>
                ) : backupInfo?.status === 'connected' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-semibold text-emerald-300">
                        Connected &amp; Active
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400 font-mono">Bucket: {backupInfo.bucket}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                        <div className="text-slate-500">Supabase Project Ref</div>
                        <div className="font-semibold text-slate-200 truncate">{backupInfo.supabaseProject}</div>
                      </div>
                      <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                        <div className="text-slate-500">Local Database File</div>
                        <div className="font-semibold text-slate-200">{backupInfo.localStorage?.sizeKb || 128} KB (SQLite)</div>
                      </div>
                      <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 sm:col-span-2">
                        <div className="text-slate-500">Last Successful Sync</div>
                        <div className="font-semibold text-emerald-400">
                          {backupInfo.lastSync
                            ? new Date(backupInfo.lastSync).toLocaleString()
                            : 'Synchronized with live cloud bucket'}
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Every database transaction (trips, tariffs, fleet edits) automatically saves to local SQLite and syncs in the background to your Supabase bucket.
                    </p>

                    <div className="pt-2 flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleManualSync}
                        disabled={syncingBackup}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncingBackup ? 'animate-spin' : ''}`} />
                        <span>{syncingBackup ? 'Syncing...' : 'Sync Database (Daily Snapshot)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCreateTimestampedSnapshot}
                        disabled={syncingBackup}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Creates an immutable snapshot stamped with the current date & hour"
                      >
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                        <span>Create Timestamped Snapshot</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="font-semibold text-amber-300">
                        {backupInfo?.status === 'invalid_credentials' ? 'Invalid Supabase Credentials' : 'Local SQLite Storage Active'}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs">
                      {backupInfo?.message || 'Data is stored locally on the server in SQLite.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Dated Cloud Backups & Historic Snapshots List */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-slate-200">Dated Historic Snapshots</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {historicBackups.length} file{historicBackups.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchHistoricBackups}
                    disabled={loadingBackupsList}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                    title="Refresh backups list"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingBackupsList ? 'animate-spin text-amber-400' : ''}`} />
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  Each day an automatic dated backup copy is saved in your Supabase bucket under <code className="text-amber-300 font-mono">backups/sand_logistics_YYYY-MM-DD.sqlite</code> alongside your live database.
                </p>

                {loadingBackupsList ? (
                  <div className="py-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Loading dated backups from bucket...</span>
                  </div>
                ) : historicBackups.length === 0 ? (
                  <div className="py-4 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
                    No dated snapshots created yet. Click "Sync Database" or "Create Timestamped Snapshot" above to generate your first dated backup!
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {historicBackups.map((bk) => (
                      <div
                        key={bk.name}
                        className="p-2.5 bg-slate-900 border border-slate-800/80 rounded-lg flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-colors"
                      >
                        <div className="min-w-0 flex items-center gap-2.5">
                          <Database className="w-4 h-4 text-amber-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-mono text-slate-200 font-medium truncate flex items-center gap-2">
                              <span>{bk.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-sans">
                                {bk.sizeKb} KB
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(bk.updatedAt).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Direct Download Button */}
                          <a
                            href={`/api/system/cloud-backups/download?file=${encodeURIComponent(bk.name)}`}
                            download={bk.name}
                            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                            title="Download SQLite file to your computer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Download</span>
                          </a>

                          {/* Restore Snapshot Button */}
                          {user.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => handleRestoreBackup(bk.name)}
                              disabled={restoringFile === bk.name}
                              className="p-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 transition-colors flex items-center gap-1 text-[11px] cursor-pointer disabled:opacity-50"
                              title="Restore system database to this point in time"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${restoringFile === bk.name ? 'animate-spin' : ''}`} />
                              <span className="hidden sm:inline">
                                {restoringFile === bk.name ? 'Restoring...' : 'Restore'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* How to verify in Supabase Dashboard */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px] space-y-2 text-slate-400">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                  <span>File Storage Organization in Supabase:</span>
                </div>
                <ul className="space-y-1.5 text-slate-300 font-mono text-[11px]">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">1. Live File:</span>
                    <span><code className="text-white">sandtrack-db/sand_logistics.sqlite</code> (Active live database used by the app)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">2. Dated Backups:</span>
                    <span><code className="text-white">sandtrack-db/backups/sand_logistics_YYYY-MM-DD.sqlite</code> (Daily historical snapshots)</span>
                  </li>
                </ul>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
