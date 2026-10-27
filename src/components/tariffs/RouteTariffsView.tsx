import React, { useState, useEffect } from 'react';
import { Route, Plus, Search, Edit3, ArrowRight, DollarSign, ShieldCheck, MapPin, ChevronLeft, ChevronRight, Factory, FolderGit2 } from 'lucide-react';
import { RouteTariff, Location, Project } from '../../types';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { RouteTariffMapPicker, calculateHaversineRoadKm } from './RouteTariffMapPicker';

export const RouteTariffsView: React.FC = () => {
  const { canEdit } = useAuth();
  const [tariffs, setTariffs] = useState<RouteTariff[]>([]);
  const [crushers, setCrushers] = useState<Location[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOriginFilter, setSelectedOriginFilter] = useState('');
  const [selectedDestinationFilter, setSelectedDestinationFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<RouteTariff | null>(null);
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [feePerTrip, setFeePerTrip] = useState('');
  const [notes, setNotes] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map Coordinates adjustments
  const [customOriginCoords, setCustomOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [customDestCoords, setCustomDestCoords] = useState<{ lat: number; lng: number } | null>(null);

  const loadData = () => {
    setIsLoading(true);
    Promise.all([
      api.getRouteTariffs(),
      api.getLocations('Loading'),
      api.getProjects(),
    ])
      .then(([tariffsData, locsData, projsData]) => {
        setTariffs(tariffsData);
        // Only crusher plants (origin loading sites)
        const onlyCrushers = locsData.filter(l => l.location_type === 'Loading' || !l.location_type || l.location_type === 'Both');
        setCrushers(onlyCrushers);
        setProjects(projsData);
      })
      .catch((err) => console.error('Failed to load route tariffs', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Selected entities for the active modal
  const selectedOriginLoc = crushers.find(l => l.id === originId);
  const selectedDestProj = projects.find(p => p.id === destinationId);

  const openAddModal = () => {
    setEditingTariff(null);
    const defaultO = crushers[0]?.id || '';
    const defaultD = projects[0]?.id || '';
    setOriginId(defaultO);
    setDestinationId(defaultD);

    // Calculate initial driving distance between default Crusher and default Destination Project
    const locO = crushers.find(l => l.id === defaultO);
    const projD = projects.find(p => p.id === defaultD);
    if (locO?.latitude && locO?.longitude && projD?.latitude && projD?.longitude) {
      const initialKm = calculateHaversineRoadKm(locO.latitude, locO.longitude, projD.latitude, projD.longitude);
      setDistanceKm(initialKm.toString());
    } else {
      setDistanceKm('');
    }
    setFeePerTrip('');
    setNotes('');
    setCustomOriginCoords(null);
    setCustomDestCoords(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (tariff: RouteTariff) => {
    setEditingTariff(tariff);
    setOriginId(tariff.origin_location_id);
    setDestinationId(tariff.destination_location_id);
    setDistanceKm(tariff.distance_km ? tariff.distance_km.toString() : '');
    const currentFee = tariff.fee_per_trip_etb || tariff.fixed_trip_fee_etb || (tariff.rate_per_m3_etb * 20) || '';
    setFeePerTrip(currentFee ? currentFee.toString() : '');
    setNotes(tariff.notes || '');
    setCustomOriginCoords(tariff.origin_lat && tariff.origin_lng ? { lat: tariff.origin_lat, lng: tariff.origin_lng } : null);
    setCustomDestCoords(tariff.destination_lat && tariff.destination_lng ? { lat: tariff.destination_lat, lng: tariff.destination_lng } : null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOriginChange = (newOriginId: string) => {
    setOriginId(newOriginId);
    setCustomOriginCoords(null);
    const locO = crushers.find(l => l.id === newOriginId);
    const destLat = customDestCoords?.lat ?? projects.find(p => p.id === destinationId)?.latitude ?? null;
    const destLng = customDestCoords?.lng ?? projects.find(p => p.id === destinationId)?.longitude ?? null;
    if (locO?.latitude && locO?.longitude && destLat && destLng) {
      const km = calculateHaversineRoadKm(locO.latitude, locO.longitude, destLat, destLng);
      setDistanceKm(km.toString());
    }
  };

  const handleDestinationChange = (newDestId: string) => {
    setDestinationId(newDestId);
    setCustomDestCoords(null);
    const origLat = customOriginCoords?.lat ?? crushers.find(l => l.id === originId)?.latitude ?? null;
    const origLng = customOriginCoords?.lng ?? crushers.find(l => l.id === originId)?.longitude ?? null;
    const projD = projects.find(p => p.id === newDestId);
    if (origLat && origLng && projD?.latitude && projD?.longitude) {
      const km = calculateHaversineRoadKm(origLat, origLng, projD.latitude, projD.longitude);
      setDistanceKm(km.toString());
    }
  };

  const handleDistanceCalculated = (calculatedKm: number) => {
    setDistanceKm(calculatedKm.toString());
  };

  const handleCoordinatesUpdated = (
    orig: { lat: number; lng: number } | null,
    dest: { lat: number; lng: number } | null
  ) => {
    if (orig) setCustomOriginCoords(orig);
    if (dest) setCustomDestCoords(dest);
    if (orig && dest) {
      const km = calculateHaversineRoadKm(orig.lat, orig.lng, dest.lat, dest.lng);
      setDistanceKm(km.toString());
    }
  };

  const handleSaveTariff = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const feeNum = parseFloat(feePerTrip);
    if (isNaN(feeNum) || feeNum <= 0) {
      setModalError('Fixed transport fee per trip must be a valid numerical value greater than zero.');
      return;
    }
    if (!originId || !destinationId) {
      setModalError('Both Starting Crusher Site and Destination Project are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const dist = distanceKm ? parseFloat(distanceKm) : null;
      const ratePerM3 = Number((feeNum / 20).toFixed(2));

      // Persist coordinate overrides if adjusted on the map
      if (customOriginCoords && originId) {
        await api.updateLocation(originId, {
          latitude: customOriginCoords.lat,
          longitude: customOriginCoords.lng
        }).catch(() => {});
      }
      if (customDestCoords && destinationId) {
        await api.updateProject(destinationId, {
          latitude: customDestCoords.lat,
          longitude: customDestCoords.lng
        }).catch(() => {});
      }

      if (editingTariff) {
        await api.updateRouteTariff(editingTariff.id, {
          origin_location_id: originId,
          destination_location_id: destinationId,
          fee_per_trip_etb: feeNum,
          rate_per_m3_etb: ratePerM3,
          distance_km: dist,
          notes: notes.trim() || null,
        });
      } else {
        await api.createRouteTariff({
          origin_location_id: originId,
          destination_location_id: destinationId,
          fee_per_trip_etb: feeNum,
          rate_per_m3_etb: ratePerM3,
          distance_km: dist,
          notes: notes.trim() || null,
        });
      }
      setIsModalOpen(false);
      setCurrentPage(1); // Place newest at top of page 1
      loadData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save route tariff rate');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter routes
  const filtered = tariffs.filter((t) => {
    const origMatch = !selectedOriginFilter || t.origin_location_id === selectedOriginFilter;
    const destMatch = !selectedDestinationFilter || t.destination_location_id === selectedDestinationFilter;
    const searchMatch = !searchTerm ||
      (t.origin_name || t.origin_location_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.destination_name || t.destination_location_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    return origMatch && destMatch && searchMatch;
  });

  // Sort strictly by recency: newest/most recently updated entries on top
  const sortedTariffs = [...filtered].sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
    const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return b.id.localeCompare(a.id);
  });

  // Pagination with recent entries on Page 1
  const totalPages = Math.ceil(sortedTariffs.length / pageSize) || 1;
  const paginatedTariffs = sortedTariffs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalRoutesCount = tariffs.length;
  const totalTripsHauled = tariffs.reduce((acc, t) => acc + (t.trips_count || 0), 0);
  const totalFeesGenerated = tariffs.reduce((acc, t) => acc + (t.total_fees_etb || 0), 0);
  const avgFeePerTrip = tariffs.length > 0
    ? (tariffs.reduce((acc, t) => acc + (t.fee_per_trip_etb || t.fixed_trip_fee_etb || (t.rate_per_m3_etb * 20) || 8500), 0) / tariffs.length).toFixed(2)
    : '8500.00';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-semibold tracking-wider">
              <Route className="w-3.5 h-3.5" />
              <span>FIXED ROUTE TRANSPORT TARIFF MATRIX</span>
              <span aria-hidden="true">•</span>
              <span>SORTED BY RECENCY (NEWEST ON TOP)</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Route Transport Tariffs &amp; Fixed Fees per Trip
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Every specific haulage corridor between a <strong>Crusher Plant (Origin Loading Site)</strong> and a <strong>Destination Project (Unloading Delivery Site)</strong> has an established fixed transport fee (ETB/trip).
              Select loading points and registered destination projects to automatically calculate road driving distance.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors shadow-xs flex items-center gap-1.5 self-start md:self-center shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Configure Route Tariff</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-medium">Configured Corridors</div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {totalRoutesCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Crusher → Project Corridors</div>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-amber-200 bg-amber-50/20 shadow-2xs">
          <div className="text-[11px] text-amber-900 font-medium">Average Tariff / Trip</div>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-1 tabular-nums">
            {Number(avgFeePerTrip).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-amber-900">ETB/trip</span>
          </div>
          <div className="text-[10px] text-amber-800 mt-0.5">Flat corridor settlement</div>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-medium">Total Haulage Trips</div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {totalTripsHauled}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Dispatches completed</div>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/20 shadow-2xs">
          <div className="text-[11px] text-emerald-900 font-medium">Total Transport Fees</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
            {totalFeesGenerated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-emerald-900">ETB</span>
          </div>
          <div className="text-[10px] text-emerald-800 mt-0.5">Auto-calculated revenue</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search crusher plant, destination project, client company..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
            />
          </div>
          <select
            value={selectedOriginFilter}
            onChange={(e) => {
              setSelectedOriginFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white"
          >
            <option value="">All Crusher Plants ({crushers.length} Loading Origins)</option>
            {crushers.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name} (Crusher)</option>
            ))}
          </select>
          <select
            value={selectedDestinationFilter}
            onChange={(e) => {
              setSelectedDestinationFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white"
          >
            <option value="">All Destination Projects ({projects.length} Unloading Sites)</option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name} {proj.company_name ? `(${proj.company_name})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Showing <span className="font-bold text-slate-800">{sortedTariffs.length}</span> of {tariffs.length} routes • Page {currentPage} of {totalPages}
        </div>
      </div>

      {/* Routes Matrix Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider font-mono">
                <th className="py-3 px-4">Route ID</th>
                <th className="py-3 px-4">Starting Point (Crusher Plant)</th>
                <th className="py-3 px-4 text-center"></th>
                <th className="py-3 px-4">Destination Project (Unloading)</th>
                <th className="py-3 px-4 text-center">Haul Distance</th>
                <th className="py-3 px-4 text-right">Fixed Fee (ETB / trip)</th>
                <th className="py-3 px-4 text-right">Trips Hauled</th>
                <th className="py-3 px-4 text-right">Total Fees (ETB)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-mono">
                    Loading fixed route tariff matrix...
                  </td>
                </tr>
              ) : paginatedTariffs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No route tariffs found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedTariffs.map((t) => {
                  const feeValue = t.fee_per_trip_etb || t.fixed_trip_fee_etb || (t.rate_per_m3_etb * 20) || 8500;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{t.id}</span>
                          {t.updated_at && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Active Corridor" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <Factory className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <div>
                            <span className="font-semibold text-slate-900 block truncate max-w-[220px]" title={t.origin_name || t.origin_location_name || ''}>
                              {t.origin_name || t.origin_location_name || t.origin_location_id}
                            </span>
                            <span className="text-[10px] font-mono text-amber-700">Crusher Loading Plant</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center text-slate-400">
                        <ArrowRight className="w-3.5 h-3.5 inline text-slate-400" />
                      </td>
                      <td className="py-3 px-4 font-medium text-blue-900">
                        <div className="flex items-center gap-2">
                          <FolderGit2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <div>
                            <span className="font-semibold text-blue-950 block truncate max-w-[260px]" title={t.destination_name || t.destination_location_name || ''}>
                              {t.destination_name || t.destination_location_name || t.destination_location_id}
                            </span>
                            {t.company_name && (
                              <span className="text-[10px] font-semibold text-slate-500 block truncate max-w-[240px]">
                                Client: {t.company_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-700 whitespace-nowrap font-bold">
                        {t.distance_km ? `${t.distance_km} km` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-700 whitespace-nowrap">
                        {Number(feeValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-500">ETB / trip</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 whitespace-nowrap font-semibold">
                        {t.trips_count || 0}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap">
                        {t.total_fees_etb ? Number(t.total_fees_etb).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} ETB
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {canEdit && (
                          <button
                            onClick={() => openEditModal(t)}
                            className="px-2.5 py-1 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 rounded transition-colors inline-flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <Edit3 className="w-3 h-3 text-slate-500" />
                            <span>Edit Corridor</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar with Recent First */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-mono">
              Showing entries {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedTariffs.length)} of {sortedTariffs.length} (Newest on top)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-2.5 py-1 rounded border border-slate-300 text-xs text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer font-medium"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <div className="text-xs font-mono font-bold text-slate-800 px-2">
                Page {currentPage} of {totalPages}
              </div>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-2.5 py-1 rounded border border-slate-300 text-xs text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer font-medium"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Route Tariff Modal with Interactive Google Map */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-amber-700 uppercase tracking-wider font-semibold">
                  {editingTariff ? `Editing Corridor: ${editingTariff.id}` : 'Configure New Transport Route'}
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingTariff ? 'Edit Route & Fee per Trip' : 'Establish Route Tariff & Map Coordinates'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded hover:bg-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTariff} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded">
                  {modalError}
                </div>
              )}

              {/* Origin (Crusher Plant) and Destination (Destination Project) Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Factory className="w-3.5 h-3.5 text-amber-600" />
                    <span>Starting Point (Loading Point: Crusher Plant) <span className="text-red-500">*</span></span>
                  </label>
                  <select
                    value={originId}
                    onChange={(e) => handleOriginChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded focus:border-amber-500 focus:outline-hidden font-medium"
                  >
                    <option value="">-- Select Loading Point (Crusher Plant) --</option>
                    {crushers.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {loc.address ? `(${loc.address})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Commercial crusher plant or quarry origin where materials are loaded
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <FolderGit2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Destination Project (Unloading Delivery Site) <span className="text-red-500">*</span></span>
                  </label>
                  <select
                    value={destinationId}
                    onChange={(e) => handleDestinationChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded focus:border-amber-500 focus:outline-hidden font-medium"
                  >
                    <option value="">-- Select Registered Destination Project --</option>
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name} {proj.company_name ? `• ${proj.company_name}` : ''} {proj.address ? `(${proj.address})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Registered destination project where materials are unloaded
                  </div>
                </div>
              </div>

              {/* Google Map Locator & Distance Estimator */}
              <RouteTariffMapPicker
                originName={selectedOriginLoc?.name || 'Crusher Plant'}
                originLat={customOriginCoords?.lat ?? selectedOriginLoc?.latitude ?? null}
                originLng={customOriginCoords?.lng ?? selectedOriginLoc?.longitude ?? null}
                destinationName={selectedDestProj?.name || 'Destination Project'}
                destinationLat={customDestCoords?.lat ?? selectedDestProj?.latitude ?? null}
                destinationLng={customDestCoords?.lng ?? selectedDestProj?.longitude ?? null}
                distanceKm={distanceKm}
                onDistanceCalculated={handleDistanceCalculated}
                onCoordinatesUpdated={handleCoordinatesUpdated}
              />

              {/* Distance and Numerical Transport Fee Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Transport Fee (ETB / trip) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={feePerTrip}
                      onChange={(e) => setFeePerTrip(e.target.value)}
                      className="w-full text-xs font-mono font-bold px-3 py-2 bg-white border border-slate-300 rounded focus:border-amber-500 focus:outline-hidden pr-20 tabular-nums"
                      placeholder="Enter transport fee in ETB (e.g. 8500)"
                    />
                    <span className="absolute right-2.5 top-2 text-[11px] font-mono text-slate-500 pointer-events-none">
                      ETB / trip
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Direct numerical data field for transport fee per completed trip
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Approximate Haul Distance (km)</span>
                    <span className="text-[10px] text-amber-700 font-mono font-bold">
                      Exact Calculated Driving Distance
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(e.target.value)}
                      className="w-full text-xs font-mono font-bold px-3 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden pr-10"
                      placeholder="e.g. 34.5"
                    />
                    <span className="absolute right-2.5 top-2 text-[11px] font-mono text-slate-500 pointer-events-none">
                      km
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>Automatically matches calculated driving distance</span>
                    {distanceKm && (
                      <span className="font-mono font-bold text-amber-700">{distanceKm} km</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Corridor Transport Fee Configuration</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Trips registered on this corridor automatically apply this flat transport fee {feePerTrip ? <span>(<strong>{Number(feePerTrip).toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB per trip</strong>)</span> : 'entered in the numerical field above'}.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corridor Description &amp; Haul Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded focus:border-amber-500 focus:outline-hidden"
                  placeholder="e.g. Express highway route with bypass bridge"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors shadow-xs cursor-pointer"
                >
                  {isSubmitting ? 'Saving Tariff...' : 'Save Corridor Tariff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
