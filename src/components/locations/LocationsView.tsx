import React, { useState, useEffect } from 'react';
import {
  Factory,
  Plus,
  Search,
  Edit,
  Phone,
  PhoneCall,
  Info,
  MapPin,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { Location } from '../../types';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { CrusherDetailModal } from './CrusherDetailModal';

export const LocationsView: React.FC = () => {
  const { canEdit } = useAuth();
  const [crushers, setCrushers] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Detail Pop-up Modal
  const [viewingCrusherId, setViewingCrusherId] = useState<string | null>(null);

  // Modal State for Register / Edit Crusher Plant
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCrusherPlants = () => {
    setIsLoading(true);
    api.getLocations('Loading')
      .then((locs) => {
        // Strictly filter to Crusher Plants (loading origin facilities)
        const onlyCrushers = locs.filter(l => l.location_type === 'Loading' || !l.location_type || l.location_type === 'Both');
        setCrushers(onlyCrushers);
      })
      .catch((err) => console.error('Failed to load crusher plants', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadCrusherPlants();
  }, []);

  const openRegisterCrusherModal = () => {
    setEditingLoc(null);
    setName('');
    setAddress('');
    setContactPerson('');
    setPhone('');
    setNotes('');
    setIsActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (l: Location) => {
    setEditingLoc(l);
    setName(l.name);
    setAddress(l.address || '');
    setContactPerson(l.contact_person || '');
    setPhone(l.phone || '');
    setNotes(l.notes || '');
    setIsActive(l.is_active === 1);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveCrusher = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!name.trim()) {
      setModalError('Crusher plant name is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: Partial<Location> = {
        name: name.trim(),
        location_type: 'Loading', // Strictly loading only
        address: address.trim() || null,
        contact_person: contactPerson.trim() || null,
        phone: phone.trim() || null,
        associated_company_id: null,
        associated_project_id: null,
        notes: notes.trim() || null,
        is_active: isActive ? 1 : 0,
      };

      if (editingLoc) {
        await api.updateLocation(editingLoc.id, payload);
      } else {
        await api.createLocation(payload);
      }
      setIsModalOpen(false);
      loadCrusherPlants();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save crusher plant');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLocation = async (loc: Location, force: boolean = false) => {
    const confirmMsg = force
      ? `Warning: Crusher plant "${loc.name}" has associated trips and/or route tariffs. Force delete will permanently erase this crusher facility, its route tariffs, and its trips. Proceed with force delete?`
      : `Are you sure you want to delete crusher plant "${loc.name}"?`;
    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      await api.deleteLocation(loc.id, force);
      if (isModalOpen && editingLoc?.id === loc.id) {
        setIsModalOpen(false);
      }
      loadCrusherPlants();
    } catch (err: any) {
      if (err.data?.canForce) {
        if (window.confirm(`${err.message}\n\nDo you want to permanently force-delete crusher plant "${loc.name}" along with its ${err.data.tripCount || 0} trip(s) and ${err.data.tariffCount || 0} tariff(s)?`)) {
          handleDeleteLocation(loc, true);
          return;
        }
      } else {
        alert(err.message || 'Failed to delete crusher plant');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = crushers.filter((l) =>
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.address && l.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (l.contact_person && l.contact_person.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (l.phone && l.phone.includes(searchTerm))
  );

  const sortedCrushers = [...filtered].sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return b.id.localeCompare(a.id);
  });

  return (
    <div className="space-y-4">
      {/* Domain Context Guidance */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Factory className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Crusher Plants (Origin Loading Sites):</strong> Commercial quarries and aggregate crushing stations where hired trucks load sand (Grades 00, 01, 02). <em>All materials are loaded from crusher sites and unloaded in Destination Projects.</em>
          </span>
        </div>
        <span className="text-[11px] font-mono text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded font-bold shrink-0">
          Loading Origin Only
        </span>
      </div>

      {/* Search & Actions Bar - No Unloading Submenu */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search crusher plants, quarry woreda, contact, phone..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
            />
          </div>
          <span className="text-xs font-mono text-slate-500 hidden sm:inline">
            Showing <strong className="text-slate-900">{filtered.length}</strong> Crusher Plants
          </span>
        </div>

        {canEdit && (
          <button
            onClick={openRegisterCrusherModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors shadow-xs whitespace-nowrap cursor-pointer self-start sm:self-auto"
            title="Register a Crusher Plant or Sand Quarry (Strictly Loading Origin Site)"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span>Register Crusher Plant</span>
          </button>
        )}
      </div>

      {/* Crusher Plants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-xs font-mono text-slate-400">
            Loading crusher plants &amp; loading facilities...
          </div>
        ) : sortedCrushers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500">
            No crusher plants found matching search criteria.
          </div>
        ) : (
          sortedCrushers.map((loc) => (
            <div
              key={loc.id}
              onClick={() => setViewingCrusherId(loc.id)}
              className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
                      <Factory className="w-4 h-4 text-amber-800" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 group-hover:text-amber-800 leading-tight transition-colors">
                        {loc.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-mono text-slate-400">{loc.id}</span>
                        <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-900 px-1 rounded border border-amber-300">
                          Crusher Plant (Origin Only)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                        loc.is_active === 1
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {loc.is_active === 1 ? 'Active Origin' : 'Inactive'}
                    </span>
                    {canEdit && (
                      <>
                        <button
                          onClick={() => openEditModal(loc)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                          title="Edit Crusher Plant"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(loc)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                          title="Delete Crusher Plant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  {loc.address && (
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Quarry Woreda / Location: <strong className="text-slate-900">{loc.address}</strong></span>
                    </div>
                  )}

                  {loc.contact_person && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-normal">Facility Supervisor:</span>
                      <span className="text-slate-900 font-semibold">{loc.contact_person}</span>
                    </div>
                  )}

                  {loc.phone && (
                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`tel:${loc.phone}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                        title={`Direct Call: ${loc.phone}`}
                      >
                        <PhoneCall className="w-3 h-3 text-emerald-700 shrink-0" />
                        <span>Call {loc.phone}</span>
                      </a>
                    </div>
                  )}

                  {/* Sand Grades Available at this Crusher */}
                  <div className="pt-1 flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-slate-400">Loading Grades:</span>
                    <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-semibold">00 Fine Mortar</span>
                    <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-semibold">01 Washed Concrete</span>
                    <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-semibold">02 Road Bedding</span>
                  </div>

                  {loc.notes && (
                    <div className="text-[11px] text-slate-500 italic truncate pt-0.5">
                      "{loc.notes}"
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500 text-[11px]">Loading Scale Dispatches:</span>
                  <span className="font-bold text-amber-800">{loc.trips_loaded_here || 0} Trips Loaded</span>
                </div>

                <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setViewingCrusherId(loc.id)}
                    className="w-full py-1.5 px-3 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>View Crusher Profile &amp; Dispatches →</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Crusher Facility Detail Popup Modal */}
      <CrusherDetailModal
        locationId={viewingCrusherId}
        isOpen={!!viewingCrusherId}
        onClose={() => setViewingCrusherId(null)}
      />

      {/* Register / Edit Crusher Plant Modal (Loading Origin Only) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 text-amber-800 rounded">
                  <Factory className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {editingLoc ? 'Edit Crusher Plant' : 'Register New Crusher Plant'}
                  </h3>
                  <div className="text-[10px] text-amber-800 font-mono">
                    Strictly Loading Origin Facility (No Unloading)
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCrusher} className="p-5 space-y-3.5">
              {modalError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded text-xs">
                  {modalError}
                </div>
              )}

              {/* Locked Notice */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Crusher Facility: Strictly Loading (Origin Site)</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Crusher plants serve exclusively as <strong>Loading Locations (Origin Sites)</strong> where independent hired trucks receive sand &amp; aggregate grades (00, 01, 02). Unloading occurs only at Destination Projects.
                </p>
              </div>

              {/* Crusher Plant Name */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Crusher Plant / Quarry Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. TDT Crusher Plant, HATI Crusher Facility, Sendafa Quarry"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                />
              </div>

              {/* Physical Address / Woreda Area */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Quarry Region / Woreda Area
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Sendafa, Aleltu, Chole, Fiche"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                />
              </div>

              {/* Contact Person & Direct Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Facility Supervisor</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Ato Ayele Kejela"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Direct Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+25197234543"
                    className="w-full font-mono px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Operational Notes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Weighbridge, Loading Scales &amp; Access Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Automated digital weighbridge, automated hopper loader"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                />
              </div>

              {editingLoc && (
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 pt-1">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  <span>Active Loading Origin Site</span>
                </label>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div>
                  {editingLoc && (
                    <button
                      type="button"
                      onClick={() => handleDeleteLocation(editingLoc)}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Crusher Plant</span>
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
                    className="px-4 py-1.5 font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded cursor-pointer transition-colors shadow-2xs"
                  >
                    {isSubmitting ? 'Saving...' : editingLoc ? 'Update Crusher Plant' : 'Save Crusher Plant'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
