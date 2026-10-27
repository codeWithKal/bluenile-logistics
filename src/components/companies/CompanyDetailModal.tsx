import React, { useState, useEffect } from 'react';
import {
  Building2,
  Phone,
  PhoneCall,
  MapPin,
  X,
  FileBarChart2,
  FolderGit2,
  Truck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ConstructionCompany, Project, Trip } from '../../types';
import { api } from '../../lib/api';

interface CompanyDetailModalProps {
  companyId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectProject?: (projectId: string) => void;
  onSelectTrip?: (tripId: string) => void;
  onNavigateToCompanyReport?: (companyId: string) => void;
}

export const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({
  companyId,
  isOpen,
  onClose,
  onSelectProject,
  onSelectTrip,
  onNavigateToCompanyReport,
}) => {
  const [data, setData] = useState<{
    company: ConstructionCompany;
    projects: Project[];
    trips: Trip[];
    summary: { totalTrips: number; totalDeliveredM3: number; totalRevenueEtb: number };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !companyId) {
      setData(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    api.getCompanyDetails(companyId)
      .then(setData)
      .catch((err) => {
        console.error('Failed to load company details', err);
        setError('Failed to load company details');
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, companyId]);

  if (!isOpen || !companyId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 border border-blue-300 rounded text-blue-800">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  {data?.company.name || 'Construction Client Profile'}
                </span>
                {data && (
                  <span className={`text-[10px] px-2 py-0.2 rounded font-semibold ${
                    data.company.is_active === 1
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {data.company.is_active === 1 ? 'Active Client' : 'Inactive'}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Client ID: {companyId} • Alex Logistics Client Registry
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 font-mono">
              Loading client company details...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Client Contact & Instant Direct Call Banner */}
              <div className="bg-gradient-to-r from-blue-50 to-emerald-50/70 p-4 rounded-xl border border-blue-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold text-blue-900 uppercase tracking-wider">
                    Authorized Construction Contractor
                  </div>
                  <div className="text-base font-bold text-slate-900">
                    {data.company.name}
                  </div>
                  {data.company.contact_person && (
                    <div className="text-slate-700 font-medium text-xs flex items-center gap-1.5">
                      <span className="text-slate-500">Key Contact / Engineer:</span>
                      <span className="font-bold text-slate-900">{data.company.contact_person}</span>
                    </div>
                  )}
                  {data.company.address && (
                    <div className="text-slate-600 text-[11px] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{data.company.address}</span>
                    </div>
                  )}
                  {data.company.notes && (
                    <div className="text-slate-500 text-[11px] italic pt-0.5">
                      "{data.company.notes}"
                    </div>
                  )}
                </div>

                {/* Direct Phone Call Button */}
                <div className="shrink-0 self-start sm:self-auto">
                  {data.company.phone ? (
                    <a
                      href={`tel:${data.company.phone}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-mono font-bold text-xs transition-colors shadow-xs cursor-pointer"
                      title={`Direct Call: ${data.company.phone}`}
                    >
                      <PhoneCall className="w-4 h-4 shrink-0 animate-bounce" />
                      <span>Call {data.company.phone}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400 font-mono text-xs">No Phone Registered</span>
                  )}
                </div>
              </div>

              {/* Lifetime Operations Summary */}
              <div className="grid grid-cols-3 gap-3 text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="bg-white p-2.5 rounded border border-slate-200/70">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Active Projects</div>
                  <div className="font-bold font-mono text-base text-blue-800 mt-0.5">
                    {data.projects.length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Jobsites registered</div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200/70">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Total Trips Received</div>
                  <div className="font-bold font-mono text-base text-slate-900 mt-0.5">
                    {data.summary.totalTrips}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Dispatches delivered</div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200/70">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Total Volume Delivered</div>
                  <div className="font-bold font-mono text-base text-emerald-700 mt-0.5">
                    {data.summary.totalDeliveredM3.toFixed(2)} m³
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Sand & aggregate</div>
                </div>
              </div>

              {/* Destination Projects of this Company */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderGit2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Destination Projects ({data.projects.length})</span>
                  </span>
                </div>
                {data.projects.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-center text-slate-400">
                    No destination projects registered under this company yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.projects.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => onSelectProject?.(p.id)}
                        className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50/50 hover:border-blue-300 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-slate-900 group-hover:text-blue-700">{p.name}</div>
                          <span className="text-[10px] font-mono text-slate-400">{p.id}</span>
                        </div>
                        {p.address && (
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">{p.address}</div>
                        )}
                        <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-600">
                          <span>{p.total_trips || 0} Trips</span>
                          <span className="font-bold text-emerald-700">{(p.total_delivered_m3 || 0).toFixed(1)} m³</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Dispatches Delivered to this Company */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Recent Deliveries ({data.trips.length} Dispatches)</span>
                  </span>
                </div>

                {data.trips.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded text-center text-slate-400">
                    No deliveries logged for this company yet.
                  </div>
                ) : (
                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-mono text-[10px] border-b border-slate-200">
                          <th className="py-2 px-2.5">Date &amp; ID</th>
                          <th className="py-2 px-2.5">Truck Plate</th>
                          <th className="py-2 px-2.5">Crusher Origin</th>
                          <th className="py-2 px-2.5">Project Site</th>
                          <th className="py-2 px-2.5 text-center">Grade</th>
                          <th className="py-2 px-2.5 text-right">Delivered</th>
                          <th className="py-2 px-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {data.trips.map((tr) => (
                          <tr
                            key={tr.id}
                            className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                            onClick={() => onSelectTrip?.(tr.id)}
                            title="Click to view trip details"
                          >
                            <td className="py-1.5 px-2.5 whitespace-nowrap">
                              <div className="font-bold text-slate-900 underline decoration-dotted">{tr.id}</div>
                              <div className="text-[10px] text-slate-500">{tr.trip_date}</div>
                            </td>
                            <td className="py-1.5 px-2.5 whitespace-nowrap font-bold text-slate-900">
                              {tr.truck_plate}
                            </td>
                            <td className="py-1.5 px-2.5 font-sans text-slate-700 truncate max-w-[130px]">
                              {tr.loading_location_name}
                            </td>
                            <td className="py-1.5 px-2.5 font-sans text-blue-700 font-semibold truncate max-w-[130px]">
                              {tr.project_name || tr.unloading_location_name}
                            </td>
                            <td className="py-1.5 px-2.5 text-center">
                              <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-800 font-bold text-[10px]">
                                {tr.sand_type}
                              </span>
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-bold text-slate-900">
                              {Number(tr.quantity_delivered_m3 || 0).toFixed(2)} m³
                            </td>
                            <td className="py-1.5 px-2.5 text-center">
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                tr.status === 'Delivered'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {tr.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                {onNavigateToCompanyReport && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToCompanyReport(companyId);
                    }}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <FileBarChart2 className="w-4 h-4" />
                    <span>Open Company Report Dossier →</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition-colors ml-auto cursor-pointer"
                >
                  Close
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
