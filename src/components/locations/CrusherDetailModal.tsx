import React, { useState, useEffect } from 'react';
import {
  Factory,
  Phone,
  PhoneCall,
  MapPin,
  X,
  Truck,
  Layers,
  Info,
  CheckCircle2
} from 'lucide-react';
import { Location, Trip } from '../../types';
import { api } from '../../lib/api';

interface CrusherDetailModalProps {
  locationId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectTrip?: (tripId: string) => void;
}

export const CrusherDetailModal: React.FC<CrusherDetailModalProps> = ({
  locationId,
  isOpen,
  onClose,
  onSelectTrip,
}) => {
  const [data, setData] = useState<{
    location: Location;
    isCrusher: boolean;
    trips: Trip[];
    summary: { totalTrips: number; totalLoadedM3?: number; totalDeliveredM3?: number };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !locationId) {
      setData(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    api.getLocationDetails(locationId)
      .then(setData)
      .catch((err) => {
        console.error('Failed to load crusher location details', err);
        setError('Failed to load crusher facility details');
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, locationId]);

  if (!isOpen || !locationId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 border border-amber-300 rounded text-amber-800">
              <Factory className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  {data?.location.name || 'Crusher Facility Profile'}
                </span>
                <span className="text-[10px] px-2 py-0.2 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300 font-mono">
                  Loading Origin Facility Only
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Facility ID: {locationId} • Alex Logistics Loading Quarry Source
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
              Loading crusher facility &amp; dispatch records...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Mandatory Strict Loading Origin Explanatory Notice */}
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Crusher Site Rule: Strictly Loading Point (Origin Facility)</span>
                </div>
                <p className="text-[11px] text-amber-900/90 leading-relaxed">
                  Crusher plants and sand quarries strictly operate as <strong>Loading Origin Sites</strong>. External hired trucks are loaded with aggregate and sand at this facility. <strong>No unloading or receiving happens at crusher sites.</strong>
                </p>
              </div>

              {/* Plant Supervisor & Instant Phone Call Banner */}
              <div className="bg-gradient-to-r from-amber-50/80 to-emerald-50/60 p-4 rounded-xl border border-amber-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold text-amber-950 uppercase tracking-wider">
                    Crusher Facility &amp; Aggregate Quarry
                  </div>
                  <div className="text-base font-bold text-slate-900">
                    {data.location.name}
                  </div>
                  {data.location.address && (
                    <div className="text-slate-700 text-xs flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Region / Woreda: {data.location.address}</span>
                    </div>
                  )}

                  {data.location.contact_person && (
                    <div className="text-slate-700 text-xs flex items-center gap-1.5">
                      <span className="text-slate-500">Facility Manager / Supervisor:</span>
                      <span className="font-bold text-slate-900">{data.location.contact_person}</span>
                    </div>
                  )}

                  {data.location.notes && (
                    <div className="text-slate-500 text-[11px] italic pt-0.5">
                      "{data.location.notes}"
                    </div>
                  )}
                </div>

                {/* Direct Phone Call Button */}
                <div className="shrink-0 self-start sm:self-auto">
                  {data.location.phone ? (
                    <a
                      href={`tel:${data.location.phone}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-mono font-bold text-xs transition-colors shadow-xs cursor-pointer"
                      title={`Call Crusher Site: ${data.location.phone}`}
                    >
                      <PhoneCall className="w-4 h-4 shrink-0 animate-bounce" />
                      <span>Call {data.location.phone}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400 font-mono text-xs">No Direct Phone</span>
                  )}
                </div>
              </div>

              {/* Available Sand Grades & Loading Operations Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="bg-white p-2.5 rounded border border-slate-200/70">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Total Dispatches Loaded</div>
                  <div className="font-bold font-mono text-base text-amber-900 mt-0.5">
                    {data.summary.totalTrips}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Trucks loaded here</div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200/70">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Total Volume Dispatched</div>
                  <div className="font-bold font-mono text-base text-emerald-700 mt-0.5">
                    {(data.summary.totalLoadedM3 || 0).toFixed(2)} m³
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Loaded aggregate &amp; sand</div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200/70 col-span-2 sm:col-span-1">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Available Grades</div>
                  <div className="flex items-center justify-center gap-1.5 mt-1 font-mono font-bold text-xs">
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded border border-amber-300">00</span>
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-900 rounded border border-blue-300">01</span>
                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-900 rounded border border-slate-300">02</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Fine, Medium, Coarse</div>
                </div>
              </div>

              {/* Recent Dispatches Loaded at this Crusher */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-700" />
                    <span>Dispatches Loaded at this Crusher ({data.trips.length} Trips)</span>
                  </span>
                </div>

                {data.trips.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded text-center text-slate-400">
                    No trips loaded from this crusher site yet.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-mono text-[10px] border-b border-slate-200">
                          <th className="py-2 px-2.5">Date &amp; ID</th>
                          <th className="py-2 px-2.5">Truck Plate</th>
                          <th className="py-2 px-2.5">Truck Owner</th>
                          <th className="py-2 px-2.5">Destination Project</th>
                          <th className="py-2 px-2.5 text-center">Grade</th>
                          <th className="py-2 px-2.5 text-right">Loaded Volume</th>
                          <th className="py-2 px-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {data.trips.map((tr) => (
                          <tr
                            key={tr.id}
                            className="hover:bg-amber-50/50 cursor-pointer transition-colors"
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
                            <td className="py-1.5 px-2.5 font-sans text-slate-600 truncate max-w-[120px]">
                              {tr.truck_owner}
                            </td>
                            <td className="py-1.5 px-2.5 font-sans text-blue-700 font-semibold truncate max-w-[140px]">
                              {tr.project_name || tr.unloading_location_name}
                            </td>
                            <td className="py-1.5 px-2.5 text-center">
                              <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-800 font-bold text-[10px]">
                                {tr.sand_type}
                              </span>
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-bold text-slate-900">
                              {Number(tr.quantity_loaded_m3 || 0).toFixed(2)} m³
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
