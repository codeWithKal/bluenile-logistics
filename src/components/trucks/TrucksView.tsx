import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit,
  History,
  FileBarChart2,
  X,
  Phone,
  PhoneCall,
  Truck as TruckIcon,
  DollarSign,
  Trash2
} from 'lucide-react';
import { Truck, Trip } from '../../types';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface TrucksViewProps {
  onNavigateToTruckDossier?: (truckId: string) => void;
  onNavigateToPivotReport?: () => void;
}

export const TrucksView: React.FC<TrucksViewProps> = ({ onNavigateToTruckDossier, onNavigateToPivotReport }) => {
  const { canEdit } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State for Registering / Editing Truck
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [capacityM3, setCapacityM3] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History Drawer for Selected Truck
  const [selectedTruckHistory, setSelectedTruckHistory] = useState<{ truck: Truck; trips: Trip[] } | null>(null);

  const loadTrucks = () => {
    setIsLoading(true);
    api.getTrucks()
      .then(setTrucks)
      .catch((err) => console.error('Failed to load trucks', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTrucks();
  }, []);

  const openRegisterModal = () => {
    setEditingTruck(null);
    setPlateNumber('');
    setOwnerName('');
    setCapacityM3('');
    setOwnerPhone('');
    setNotes('');
    setIsActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (t: Truck) => {
    setEditingTruck(t);
    setPlateNumber(t.plate_number);
    setOwnerName(t.owner_name);
    setCapacityM3(t.capacity_m3 ? t.capacity_m3.toString() : '');
    setOwnerPhone(t.owner_phone || '');
    setNotes(t.notes || '');
    setIsActive(t.is_active === 1);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!plateNumber.trim() || !ownerName.trim()) {
      setModalError('Plate number and owner name are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        plate_number: plateNumber.trim().toUpperCase(),
        owner_name: ownerName.trim(),
        capacity_m3: capacityM3 ? Math.round(parseFloat(capacityM3) * 100) / 100 : null,
        owner_phone: ownerPhone.trim() || null,
        notes: notes.trim() || null,
        is_active: isActive ? 1 : 0,
      };
      if (editingTruck) {
        await api.updateTruck(editingTruck.id, payload);
      } else {
        await api.createTruck(payload);
      }
      setIsModalOpen(false);
      loadTrucks();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save truck');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTruck = async (truck: Truck, force: boolean = false) => {
    const confirmMsg = force
      ? `Warning: Truck "${truck.plate_number}" has associated trip records. Force delete will permanently erase this truck AND all its recorded trips. Proceed with force delete?`
      : `Are you sure you want to delete truck "${truck.plate_number}" (${truck.owner_name})?`;
    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      await api.deleteTruck(truck.id, force);
      if (isModalOpen && editingTruck?.id === truck.id) {
        setIsModalOpen(false);
      }
      loadTrucks();
    } catch (err: any) {
      if (err.data?.canForce) {
        if (window.confirm(`${err.message}\n\nDo you want to permanently delete truck "${truck.plate_number}" along with its ${err.data.tripCount} trip(s)?`)) {
          handleDeleteTruck(truck, true);
          return;
        }
      } else {
        alert(err.message || 'Failed to delete truck');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewHistory = async (truckId: string) => {
    try {
      const res = await api.getTruckHistory(truckId);
      setSelectedTruckHistory(res);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTrucks = trucks.filter((t) => {
    const matchesSearch =
      t.plate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.owner_phone && t.owner_phone.includes(searchTerm));
    const matchesActive =
      filterActive === 'all' ||
      (filterActive === 'active' && t.is_active === 1) ||
      (filterActive === 'inactive' && t.is_active === 0);
    return matchesSearch && matchesActive;
  });

  const sortedTrucks = [...filteredTrucks].sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return b.id.localeCompare(a.id);
  });

  return (
    <div className="space-y-4">
      {/* Top Filter & Action Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search trucks by plate, owner, phone..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
            />
          </div>
          {/* Active / Inactive Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-medium">
            <button
              onClick={() => setFilterActive('all')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                filterActive === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              All ({trucks.length})
            </button>
            <button
              onClick={() => setFilterActive('active')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                filterActive === 'active' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              Active ({trucks.filter(t => t.is_active === 1).length})
            </button>
            <button
              onClick={() => setFilterActive('inactive')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                filterActive === 'inactive' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              Inactive ({trucks.filter(t => t.is_active === 0).length})
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {onNavigateToPivotReport && (
            <button
              onClick={onNavigateToPivotReport}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
              title="View Hired Trucks Trip History & Calculated Transport Fees Pivoted by Plate"
            >
              <DollarSign className="w-4 h-4 text-emerald-700" />
              <span>Trip History &amp; Fees Pivot</span>
            </button>
          )}
          <button
            onClick={() => onNavigateToTruckDossier?.('all')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
            title="Open comprehensive report for all trucks in once"
          >
            <FileBarChart2 className="w-4 h-4 text-amber-600" />
            <span>All Trucks Report (All in Once)</span>
          </button>
          {canEdit && (
            <button
              onClick={openRegisterModal}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors shadow-xs whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register External Truck</span>
            </button>
          )}
        </div>
      </div>

      {/* Trucks Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 font-mono text-[11px] text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-3">Plate Number</th>
                <th className="py-2.5 px-3">Truck Owner</th>
                <th className="py-2.5 px-3">Capacity</th>
                <th className="py-2.5 px-3">Owner Contact</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Trips</th>
                <th className="py-2.5 px-3 text-right">Delivered (m³)</th>
                <th className="py-2.5 px-3 text-center">Success Rate</th>
                <th className="py-2.5 px-3 text-right">Reporting &amp; Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-mono">
                    Loading trucks...
                  </td>
                </tr>
              ) : sortedTrucks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No trucks matching filters.
                  </td>
                </tr>
              ) : (
                sortedTrucks.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => handleViewHistory(t.id)}
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {t.plate_number}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {t.owner_name}
                      {t.notes && (
                        <div className="text-[11px] text-slate-500 font-normal truncate max-w-xs">{t.notes}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700">
                      {t.capacity_m3 ? `${t.capacity_m3.toFixed(2)} m³` : <span className="text-slate-400">Unspecified</span>}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {t.owner_phone ? (
                        <a
                          href={`tel:${t.owner_phone}`}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono font-bold text-xs transition-colors shadow-2xs group-hover:border-emerald-500 cursor-pointer"
                          title={`Direct Call: ${t.owner_phone}`}
                        >
                          <Phone className="w-3 h-3 text-emerald-700 shrink-0" />
                          <span>{t.owner_phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded border ${
                          t.is_active === 1
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {t.is_active === 1 ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-800">
                      {t.total_trips || 0}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                      {(t.total_delivered_m3 || 0).toFixed(2)} m³
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                      {t.success_rate !== null && t.success_rate !== undefined ? (
                        <span className={`font-bold ${t.success_rate >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {t.success_rate}%
                        </span>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Dedicated Button: Open Truck Dossier in Reports */}
                        {onNavigateToTruckDossier && (
                          <button
                            type="button"
                            onClick={() => onNavigateToTruckDossier(t.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors font-semibold text-[11px] cursor-pointer"
                            title="Generate In-Depth Report on this Specific Truck"
                          >
                            <FileBarChart2 className="w-3.5 h-3.5 text-amber-600" />
                            <span>Report Dossier</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleViewHistory(t.id)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                          title="Quick Trip History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(t)}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                              title="Edit Truck Details"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTruck(t)}
                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete Truck"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register / Edit Truck Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingTruck ? 'Edit External Truck Record' : 'Register External Hired Truck'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveTruck} className="p-4 space-y-3 text-xs">
              {modalError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs">
                  {modalError}
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Truck Plate / Registration Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. TX-4892-A"
                  className="w-full font-mono font-bold uppercase px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  External Truck Owner Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Apex Haulage Logistics"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Truck Capacity (m³) (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={capacityM3}
                    onChange={(e) => setCapacityM3(e.target.value)}
                    placeholder="e.g. 22.0"
                    className="w-full font-mono px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-400">Used for capacity warnings</span>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Owner Phone / Contact
                  </label>
                  <input
                    type="text"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="+1 555-0192"
                    className="w-full font-mono px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notes &amp; Equipment Details
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Tri-axle Mack Granite, high sideboards"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                />
              </div>
              {editingTruck && (
                <div className="pt-1 flex items-center justify-between">
                  <label className="text-slate-700 font-semibold cursor-pointer flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded text-amber-500"
                    />
                    <span>Active Truck (Available for Dispatch)</span>
                  </label>
                </div>
              )}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div>
                  {editingTruck && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTruck(editingTruck)}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Truck</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors cursor-pointer"
                  >
                    {isSubmitting ? 'Saving...' : editingTruck ? 'Update Truck' : 'Register Truck'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick History & Truck Dossier Modal */}
      {selectedTruckHistory && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-amber-100 border border-amber-300 rounded text-amber-800">
                  <TruckIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm bg-slate-900 text-amber-400 px-2 py-0.5 rounded">
                      {selectedTruckHistory.truck.plate_number}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {selectedTruckHistory.truck.owner_name}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Hired Truck Operational Profile &amp; Trip Register
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedTruckHistory(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              {/* Truck Owner & Instant Call Contact Card */}
              <div className="bg-gradient-to-r from-amber-50/80 to-emerald-50/60 p-4 rounded-xl border border-amber-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold text-amber-900 uppercase tracking-wider">
                    Hired Truck Owner &amp; Transport Contractor
                  </div>
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>{selectedTruckHistory.truck.owner_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      selectedTruckHistory.truck.is_active === 1
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {selectedTruckHistory.truck.is_active === 1 ? 'Active Unit' : 'Inactive'}
                    </span>
                  </div>
                  {selectedTruckHistory.truck.notes && (
                    <div className="text-slate-600 text-[11px] italic">
                      "{selectedTruckHistory.truck.notes}"
                    </div>
                  )}
                </div>

                {/* Instant Call Button & Phone Display */}
                <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                  {selectedTruckHistory.truck.owner_phone ? (
                    <a
                      href={`tel:${selectedTruckHistory.truck.owner_phone}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-mono font-bold text-xs transition-colors shadow-xs cursor-pointer"
                      title={`Call ${selectedTruckHistory.truck.owner_name} now`}
                    >
                      <PhoneCall className="w-4 h-4 shrink-0 animate-bounce" />
                      <span>Call {selectedTruckHistory.truck.owner_phone}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400 font-mono text-xs">No Phone Registered</span>
                  )}
                </div>
              </div>

              {/* Truck Technical Capacity & Lifetime Operations */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="bg-white p-2.5 rounded border border-slate-200/70">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Registered Capacity</div>
                  <div className="font-bold font-mono text-base text-amber-800 mt-0.5">
                    {selectedTruckHistory.truck.capacity_m3 ? `${selectedTruckHistory.truck.capacity_m3.toFixed(2)} m³` : 'N/A'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Strict per-load rating</div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200/70">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Total Dispatches</div>
                  <div className="font-bold font-mono text-base text-slate-900 mt-0.5">
                    {selectedTruckHistory.trips.length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Unified trips completed</div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200/70">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Delivered Volume</div>
                  <div className="font-bold font-mono text-base text-emerald-700 mt-0.5">
                    {selectedTruckHistory.trips.reduce((acc, t) => acc + (t.quantity_delivered_m3 || 0), 0).toFixed(1)} m³
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Verified at job sites</div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200/70">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Success Rate</div>
                  <div className="font-bold font-mono text-base text-blue-700 mt-0.5">
                    {(() => {
                      const valid = selectedTruckHistory.trips.filter(t => !['Cancelled', 'Registered'].includes(t.status));
                      if (valid.length === 0) return '100%';
                      const success = valid.filter(t => t.status === 'Delivered').length;
                      return `${Math.round((success / valid.length) * 100)}%`;
                    })()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Trip fulfillment ratio</div>
                </div>
              </div>

              {/* In-Depth Reports Navigation */}
              {onNavigateToTruckDossier && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs text-amber-950">
                    <span className="font-bold">Need official audit metrics?</span> View comprehensive PDF dossier with sand grade distribution &amp; revenue metrics.
                  </div>
                  <button
                    onClick={() => {
                      const id = selectedTruckHistory.truck.id;
                      setSelectedTruckHistory(null);
                      onNavigateToTruckDossier(id);
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <FileBarChart2 className="w-3.5 h-3.5" />
                    <span>Open Truck Report Dossier →</span>
                  </button>
                </div>
              )}

              {/* Trip History Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Trip Dispatch History ({selectedTruckHistory.trips.length} Records)</span>
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500">
                    Auto-loaded to truck capacity ({selectedTruckHistory.truck.capacity_m3?.toFixed(2)} m³)
                  </span>
                </div>

                {selectedTruckHistory.trips.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-6 text-center bg-slate-50 rounded border border-slate-200">
                    No trips recorded for this hired truck yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-mono border-b border-slate-200 text-[11px]">
                          <th className="py-2 px-3">Trip ID &amp; Date</th>
                          <th className="py-2 px-3">Crusher (Loading)</th>
                          <th className="py-2 px-3">Destination Project</th>
                          <th className="py-2 px-3 text-center">Grade</th>
                          <th className="py-2 px-3 text-right">Delivered</th>
                          <th className="py-2 px-3 text-right">Fee (ETB/trip)</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {selectedTruckHistory.trips.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 whitespace-nowrap">
                              <div className="font-bold text-slate-900">{t.id}</div>
                              <div className="text-[10px] text-slate-500">{t.trip_date}</div>
                            </td>
                            <td className="py-2 px-3 font-sans text-slate-800 font-medium">
                              {t.loading_location_name}
                            </td>
                            <td className="py-2 px-3 font-sans">
                              <div className="text-blue-700 font-semibold">{t.unloading_location_name}</div>
                              <div className="text-[10px] text-slate-500">{t.company_name}</div>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="px-1.5 py-0.5 rounded bg-slate-200 font-bold text-slate-800">
                                {t.sand_type}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                              {t.quantity_delivered_m3.toFixed(2)} m³
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-700 font-bold">
                              {Number(t.total_transport_fee_etb || t.transport_rate_etb_per_m3 || 8500).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                t.status === 'Delivered'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : t.status === 'Partially Delivered'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              {selectedTruckHistory.truck.owner_phone && (
                <a
                  href={`tel:${selectedTruckHistory.truck.owner_phone}`}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-mono font-bold cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call {selectedTruckHistory.truck.owner_phone}</span>
                </a>
              )}
              <button
                onClick={() => setSelectedTruckHistory(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-300 rounded text-slate-800 transition-colors cursor-pointer ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
