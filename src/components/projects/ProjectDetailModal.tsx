import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Building2,
  Phone,
  PhoneCall,
  MapPin,
  X,
  Truck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Project, ConstructionCompany, Trip } from '../../types';
import { api } from '../../lib/api';

interface ProjectDetailModalProps {
  projectId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectCompany?: (companyId: string) => void;
  onSelectTrip?: (tripId: string) => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onSelectCompany,
  onSelectTrip,
}) => {
  const [data, setData] = useState<{
    project: Project;
    company?: ConstructionCompany;
    trips: Trip[];
    summary: { totalTrips: number; totalDeliveredM3: number; totalRevenueEtb: number };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !projectId) {
      setData(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    api.getProjectDetails(projectId)
      .then(setData)
      .catch((err) => {
        console.error('Failed to load project details', err);
        setError('Failed to load destination project details');
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, projectId]);

  if (!isOpen || !projectId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 border border-blue-300 rounded text-blue-800">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  {data?.project.name || 'Destination Project Profile'}
                </span>
                {data && (
                  <span className={`text-[10px] px-2 py-0.2 rounded font-semibold ${
                    data.project.is_active === 1
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {data.project.is_active === 1 ? 'Active Jobsite' : 'Inactive'}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Project ID: {projectId} • Unloading Destination Site
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
              Loading project details &amp; deliveries...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Project & Client Contractor Overview Banner */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 p-4 rounded-xl border border-blue-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold text-blue-900 uppercase tracking-wider">
                    Destination Project (Unloading Delivery Site)
                  </div>
                  <div className="text-base font-bold text-slate-900">
                    {data.project.name}
                  </div>
                  {data.project.address && (
                    <div className="text-slate-700 text-xs flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{data.project.address}</span>
                    </div>
                  )}

                  {data.company && (
                    <div className="pt-1 flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">Contractor:</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (data.company?.id && onSelectCompany) {
                            onSelectCompany(data.company.id);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-950 font-bold text-xs transition-colors cursor-pointer"
                        title="Click to view full company profile"
                      >
                        <Building2 className="w-3 h-3 text-blue-700" />
                        <span>{data.company.name}</span>
                      </button>
                    </div>
                  )}

                  {data.company?.contact_person && (
                    <div className="text-slate-600 text-[11px]">
                      Site Supervisor / Contact: <span className="font-semibold text-slate-900">{data.company.contact_person}</span>
                    </div>
                  )}

                  {data.project.notes && (
                    <div className="text-slate-500 text-[11px] italic pt-0.5">
                      "{data.project.notes}"
                    </div>
                  )}
                </div>

                {/* Direct Phone Call Button */}
                <div className="shrink-0 self-start sm:self-auto">
                  {data.company?.phone ? (
                    <a
                      href={`tel:${data.company.phone}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-mono font-bold text-xs transition-colors shadow-xs cursor-pointer"
                      title={`Call Site Engineer: ${data.company.phone}`}
                    >
                      <PhoneCall className="w-4 h-4 shrink-0 animate-bounce" />
                      <span>Call {data.company.phone}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400 font-mono text-xs">No Direct Phone</span>
                  )}
                </div>
              </div>

              {/* Delivery Stats Summary */}
              <div className="grid grid-cols-2 gap-3 text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="bg-white p-2.5 rounded border border-slate-200/70">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Total Trips Received</div>
                  <div className="font-bold font-mono text-base text-blue-800 mt-0.5">
                    {data.summary.totalTrips}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Dispatches delivered</div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200/70">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Delivered Volume</div>
                  <div className="font-bold font-mono text-base text-emerald-700 mt-0.5">
                    {data.summary.totalDeliveredM3.toFixed(2)} m³
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Verified aggregate &amp; sand</div>
                </div>
              </div>

              {/* Recent Deliveries to this Project */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Dispatches Unloaded Here ({data.trips.length} Deliveries)</span>
                  </span>
                </div>

                {data.trips.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded text-center text-slate-400">
                    No dispatches logged for this destination project yet.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-mono text-[10px] border-b border-slate-200">
                          <th className="py-2 px-2.5">Date &amp; ID</th>
                          <th className="py-2 px-2.5">Hired Truck</th>
                          <th className="py-2 px-2.5">Crusher Site (Origin)</th>
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
                            <td className="py-1.5 px-2.5 whitespace-nowrap">
                              <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {tr.truck_plate}
                              </span>
                            </td>
                            <td className="py-1.5 px-2.5 font-sans text-slate-700 truncate max-w-[150px]">
                              {tr.loading_location_name}
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

              {/* Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition-colors cursor-pointer"
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
