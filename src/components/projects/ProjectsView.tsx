import React, { useState, useEffect } from 'react';
import { FolderGit2, Plus, Search, Edit, Building2 } from 'lucide-react';
import { Project, ConstructionCompany } from '../../types';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { ProjectDetailModal } from './ProjectDetailModal';
import { CompanyDetailModal } from '../companies/CompanyDetailModal';

export const ProjectsView: React.FC = () => {
  const { canEdit } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<ConstructionCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('');

  // Detail Popups
  const [viewingProjectId, setViewingProjectId] = useState<string | null>(null);
  const [viewingCompanyId, setViewingCompanyId] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProj, setEditingProj] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = () => {
    setIsLoading(true);
    Promise.all([
      api.getProjects(selectedCompanyFilter || undefined),
      api.getCompanies(),
    ])
      .then(([projs, comps]) => {
        setProjects(projs);
        setCompanies(comps);
      })
      .catch((err) => console.error('Failed to load projects', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [selectedCompanyFilter]);

  const openRegisterModal = () => {
    setEditingProj(null);
    setName('');
    setCompanyId(companies[0]?.id || '');
    setAddress('');
    setNotes('');
    setIsActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Project) => {
    setEditingProj(p);
    setName(p.name);
    setCompanyId(p.company_id);
    setAddress(p.address || '');
    setNotes(p.notes || '');
    setIsActive(p.is_active === 1);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!name.trim() || !companyId) {
      setModalError('Project name and associated construction company are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        company_id: companyId,
        address: address.trim() || null,
        notes: notes.trim() || null,
        is_active: isActive ? 1 : 0,
      };
      if (editingProj) {
        await api.updateProject(editingProj.id, payload);
      } else {
        await api.createProject(payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.address && p.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.company_name && p.company_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedProjects = [...filtered].sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return b.id.localeCompare(a.id);
  });

  return (
    <div className="space-y-4">
      <div className="bg-blue-50/60 border border-blue-200/80 rounded-lg p-3 text-xs text-blue-900 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderGit2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong>Destination Projects (Unloading Sites):</strong> Delivery destination jobsites where external hired trucks unload sand loaded from Crusher Sites. Click any project card to open detailed profile and recent deliveries.
          </span>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search destination projects by name, contractor, address..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
            />
          </div>
          <select
            value={selectedCompanyFilter}
            onChange={(e) => setSelectedCompanyFilter(e.target.value)}
            className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white"
          >
            <option value="">All Companies ({companies.length})</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {canEdit && (
          <button
            onClick={openRegisterModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors shadow-xs whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Destination Project</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-xs font-mono text-slate-400">
            Loading project sites...
          </div>
        ) : sortedProjects.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500">
            No projects registered.
          </div>
        ) : (
          sortedProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => setViewingProjectId(p.id)}
              className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                      <FolderGit2 className="w-4 h-4 text-blue-700" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 leading-tight transition-colors">
                        {p.name}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-400">{p.id}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                        p.is_active === 1 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {p.is_active === 1 ? 'Active' : 'Inactive'}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                        title="Edit Project"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div
                    className="flex items-center gap-1.5 text-slate-700 hover:text-blue-700 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewingCompanyId(p.company_id);
                    }}
                    title="Click to view company profile"
                  >
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold underline decoration-dotted">{p.company_name}</span>
                  </div>
                  {p.address && (
                    <div className="text-slate-500 text-[11px] truncate">{p.address}</div>
                  )}
                  {p.notes && (
                    <div className="text-slate-600 text-[11px] italic bg-slate-50 p-1.5 rounded">{p.notes}</div>
                  )}
                </div>
              </div>

              <div>
                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-50 p-2 rounded">
                    <div className="text-[10px] text-slate-500">Total Trips</div>
                    <div className="font-bold text-slate-900">{p.total_trips || 0} Trips</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <div className="text-[10px] text-slate-500">Delivered Volume</div>
                    <div className="font-bold text-slate-900">{(p.total_delivered_m3 || 0).toFixed(2)} m³</div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setViewingProjectId(p.id)}
                    className="w-full py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors text-center cursor-pointer"
                  >
                    View Project Deliveries &amp; Supervisor →
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pop-up Modals */}
      <ProjectDetailModal
        projectId={viewingProjectId}
        isOpen={!!viewingProjectId}
        onClose={() => setViewingProjectId(null)}
        onSelectCompany={(cId) => {
          setViewingProjectId(null);
          setViewingCompanyId(cId);
        }}
      />

      <CompanyDetailModal
        companyId={viewingCompanyId}
        isOpen={!!viewingCompanyId}
        onClose={() => setViewingCompanyId(null)}
        onSelectProject={(pId) => {
          setViewingCompanyId(null);
          setViewingProjectId(pId);
        }}
      />

      {/* Edit / Register Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden text-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingProj ? 'Edit Destination Project' : 'Add Destination Project'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveProject} className="p-4 space-y-3">
              {modalError && (
                <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded">{modalError}</div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bole Airport Expansion"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Associated Construction Company *</label>
                <select
                  required
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                >
                  <option value="">Select Contractor</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Site Address / Location</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Bole, Addis Ababa"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jobsite Delivery Gate Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Gate 3 delivery access, supervisor on site"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500"
                />
              </div>
              {editingProj && (
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  <span>Active Destination Project</span>
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
                  {isSubmitting ? 'Saving...' : editingProj ? 'Update Project' : 'Save Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
