import React, { useState, useEffect } from 'react';
import { Building2, Plus, Search, Edit, FileBarChart2, Phone, PhoneCall } from 'lucide-react';
import { ConstructionCompany } from '../../types';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { CompanyDetailModal } from './CompanyDetailModal';
import { ProjectDetailModal } from '../projects/ProjectDetailModal';

interface CompaniesViewProps {
  onNavigateToCompanyReport?: (companyId: string) => void;
}

export const CompaniesView: React.FC<CompaniesViewProps> = ({ onNavigateToCompanyReport }) => {
  const { canEdit } = useAuth();
  const [companies, setCompanies] = useState<ConstructionCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [viewingCompanyId, setViewingCompanyId] = useState<string | null>(null);
  const [viewingProjectId, setViewingProjectId] = useState<string | null>(null);

  // Edit/Register Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingComp, setEditingComp] = useState<ConstructionCompany | null>(null);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCompanies = () => {
    setIsLoading(true);
    api.getCompanies()
      .then(setCompanies)
      .catch((err) => console.error('Failed to load companies', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const openRegisterModal = () => {
    setEditingComp(null);
    setName('');
    setContactPerson('');
    setPhone('');
    setAddress('');
    setNotes('');
    setIsActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (c: ConstructionCompany) => {
    setEditingComp(c);
    setName(c.name);
    setContactPerson(c.contact_person || '');
    setPhone(c.phone || '');
    setAddress(c.address || '');
    setNotes(c.notes || '');
    setIsActive(c.is_active === 1);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!name.trim()) {
      setModalError('Company name is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        contact_person: contactPerson.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        is_active: isActive ? 1 : 0,
      };
      if (editingComp) {
        await api.updateCompany(editingComp.id, payload);
      } else {
        await api.createCompany(payload);
      }
      setIsModalOpen(false);
      loadCompanies();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save company');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.contact_person && c.contact_person.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  const sortedCompanies = [...filtered].sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return b.id.localeCompare(a.id);
  });

  return (
    <div className="space-y-4">
      {/* Domain Context Banner */}
      <div className="bg-blue-50/60 border border-blue-200/80 rounded-lg p-3 text-xs text-blue-900 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong>Construction Companies:</strong> Clients receiving sand &amp; aggregate deliveries from Alex Logistics. Click any company card to open detailed profile, direct call button, and active jobsites.
          </span>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search construction companies by name, contact, phone..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
          />
        </div>
        {canEdit && (
          <button
            onClick={openRegisterModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors shadow-xs whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Construction Company</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-xs font-mono text-slate-400">
            Loading construction companies...
          </div>
        ) : sortedCompanies.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500">
            No construction companies found.
          </div>
        ) : (
          sortedCompanies.map((c) => (
            <div
              key={c.id}
              onClick={() => setViewingCompanyId(c.id)}
              className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                      <Building2 className="w-4 h-4 text-blue-700" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 leading-tight transition-colors">
                        {c.name}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-400">{c.id}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                        c.is_active === 1 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {c.is_active === 1 ? 'Active' : 'Inactive'}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => openEditModal(c)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                        title="Edit Company"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  {c.contact_person && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-normal">Contact:</span>
                      <span className="text-slate-900 font-semibold">{c.contact_person}</span>
                    </div>
                  )}

                  {c.phone && (
                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`tel:${c.phone}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                        title={`Direct Call: ${c.phone}`}
                      >
                        <Phone className="w-3 h-3 text-emerald-700 shrink-0" />
                        <span>{c.phone}</span>
                      </a>
                    </div>
                  )}

                  {c.address && (
                    <div className="truncate text-slate-500 text-[11px]">{c.address}</div>
                  )}
                </div>
              </div>

              <div>
                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-50 p-2 rounded">
                    <div className="text-[10px] text-slate-500">Active Sites</div>
                    <div className="font-bold text-slate-900">{c.project_count || 0} Projects</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <div className="text-[10px] text-slate-500">Delivered Volume</div>
                    <div className="font-bold text-slate-900">{(c.total_delivered_m3 || 0).toFixed(2)} m³</div>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setViewingCompanyId(c.id)}
                    className="flex-1 py-1 px-2 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors text-center cursor-pointer"
                  >
                    View Details &amp; Projects →
                  </button>
                  {onNavigateToCompanyReport && (
                    <button
                      onClick={() => onNavigateToCompanyReport(c.id)}
                      className="py-1 px-2 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50/60 hover:bg-blue-100/60 rounded border border-blue-200 transition-colors cursor-pointer flex items-center gap-1"
                      title="Open Report Dossier"
                    >
                      <FileBarChart2 className="w-3 h-3 text-blue-600" />
                      <span>Dossier</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Pop-up Modal */}
      <CompanyDetailModal
        companyId={viewingCompanyId}
        isOpen={!!viewingCompanyId}
        onClose={() => setViewingCompanyId(null)}
        onSelectProject={(pId) => {
          setViewingCompanyId(null);
          setViewingProjectId(pId);
        }}
        onNavigateToCompanyReport={onNavigateToCompanyReport}
      />

      <ProjectDetailModal
        projectId={viewingProjectId}
        isOpen={!!viewingProjectId}
        onClose={() => setViewingProjectId(null)}
        onSelectCompany={(cId) => {
          setViewingProjectId(null);
          setViewingCompanyId(cId);
        }}
      />

      {/* Edit / Register Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden text-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingComp ? 'Edit Construction Company' : 'Add Construction Company'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveCompany} className="p-4 space-y-3">
              {modalError && (
                <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded">{modalError}</div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Midroc Ethiopia Construction"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Eng. Samuel Halala"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+251911223344"
                    className="w-full font-mono px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Head Office / Location Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Kirkos, Addis Ababa"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Operational Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. High volume tier-1 civil contractor"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                />
              </div>
              {editingComp && (
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  <span>Active Client Company</span>
                </label>
              )}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
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
                  className="px-4 py-1.5 font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingComp ? 'Update Company' : 'Save Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
