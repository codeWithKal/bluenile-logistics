import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Eye,
  Edit,
  Download,
  AlertCircle,
  Truck as TruckIcon,
  X,
  Phone,
  PhoneCall,
  ShieldCheck,
  FileBarChart2
} from 'lucide-react';
import { Trip, Truck, ConstructionCompany, Location, TripStatus } from '../../types';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { TripFormModal } from './TripFormModal';
import { TripDetailModal } from './TripDetailModal';
import { exportToCsv } from '../../lib/exportUtils';
import { CompanyDetailModal } from '../companies/CompanyDetailModal';
import { ProjectDetailModal } from '../projects/ProjectDetailModal';
import { CrusherDetailModal } from '../locations/CrusherDetailModal';

interface TripRegisterViewProps {
  onNavigateToTruckDossier?: (truckId: string) => void;
}

export const TripRegisterView: React.FC<TripRegisterViewProps> = ({ onNavigateToTruckDossier }) => {
  const { canEdit } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Registries for dropdowns
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [companies, setCompanies] = useState<ConstructionCompany[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedSandType, setSelectedSandType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [viewingTripId, setViewingTripId] = useState<string | null>(null);
  const [viewingTruckModalId, setViewingTruckModalId] = useState<string | null>(null);
  const [viewingCompanyId, setViewingCompanyId] = useState<string | null>(null);
  const [viewingProjectId, setViewingProjectId] = useState<string | null>(null);
  const [viewingCrusherId, setViewingCrusherId] = useState<string | null>(null);
  const [truckModalData, setTruckModalData] = useState<{ truck: Truck; trips: Trip[]; summary?: any } | null>(null);
  const [isLoadingTruckModal, setIsLoadingTruckModal] = useState(false);

  useEffect(() => {
    if (!viewingTruckModalId) {
      setTruckModalData(null);
      return;
    }
    setIsLoadingTruckModal(true);
    api.getSingleTruckReport(viewingTruckModalId)
      .then((dossier) => {
        setTruckModalData({
          truck: dossier.truck,
          trips: dossier.trips,
          summary: dossier.summary
        });
      })
      .catch((err) => {
        console.error('Failed to load truck info', err);
        const fallbackTrk = trucks.find(t => t.id === viewingTruckModalId);
        if (fallbackTrk) {
          setTruckModalData({
            truck: fallbackTrk,
            trips: trips.filter(t => t.truck_id === viewingTruckModalId)
          });
        }
      })
      .finally(() => setIsLoadingTruckModal(false));
  }, [viewingTruckModalId]);

  useEffect(() => {
    Promise.all([
      api.getTrucks(),
      api.getCompanies(),
      api.getLocations(),
    ]).then(([trk, cmp, loc]) => {
      setTrucks(trk);
      setCompanies(cmp);
      setLocations(loc);
    }).catch(err => console.error('Failed to load support registries', err));
  }, []);

  const handleDatePreset = (preset: 'all' | 'today' | 'yesterday' | 'week' | 'month') => {
    setDatePreset(preset);
    const now = new Date();
    const toDateStr = (d: Date) => d.toISOString().split('T')[0];
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayStr = toDateStr(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = toDateStr(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      setStartDate(toDateStr(w));
      setEndDate(toDateStr(now));
    } else if (preset === 'month') {
      const m = new Date(now);
      m.setDate(m.getDate() - 30);
      setStartDate(toDateStr(m));
      setEndDate(toDateStr(now));
    }
    setPage(1);
  };

  const loadTrips = () => {
    setIsLoading(true);
    const filters: Record<string, any> = {
      search: searchTerm,
      truck_id: selectedTruckId,
      company_id: selectedCompanyId,
      sand_type: selectedSandType,
      status: selectedStatus,
      start_date: startDate,
      end_date: endDate,
      limit,
      offset: (page - 1) * limit,
    };
    api.getTrips(filters)
      .then((res) => {
        setTrips(res.trips);
        setTotalCount(res.total);
      })
      .catch((err) => console.error('Failed to fetch trips', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTrips();
  }, [page, searchTerm, startDate, endDate, selectedTruckId, selectedCompanyId, selectedSandType, selectedStatus]);

  const handleExportQuickCsv = () => {
    exportToCsv(
      `trip_register_${new Date().toISOString().split('T')[0]}`,
      [
        { header: 'Trip ID', key: 'id' },
        { header: 'Date', key: 'trip_date' },
        { header: 'Truck Plate', key: 'truck_plate' },
        { header: 'Truck Owner', key: 'truck_owner' },
        { header: 'Company', key: 'company_name' },
        { header: 'Project', key: 'project_name', format: (v) => v || 'General' },
        { header: 'Loading Point', key: 'loading_location_name' },
        { header: 'Sand Type', key: 'sand_type' },
        { header: 'Loaded (m³)', key: 'quantity_loaded_m3', format: (v) => Number(v).toFixed(2) },
        { header: 'Destination', key: 'unloading_location_name' },
        { header: 'Delivered (m³)', key: 'quantity_delivered_m3', format: (v) => Number(v).toFixed(2) },
        { header: 'Remaining (m³)', key: 'quantity_remaining_m3', format: (v) => Number(v).toFixed(2) },
        { header: 'Status', key: 'status' },
        { header: 'Outcome', key: 'delivery_outcome' },
        { header: 'POD Ref', key: 'delivery_proof_ref' },
      ],
      trips
    );
  };

  const getStatusBadge = (st: TripStatus) => {
    switch (st) {
      case 'Delivered':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Partially Delivered':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'Unsuccessful':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'Cancelled':
        return 'text-slate-600 bg-slate-100 border-slate-200';
      case 'Loaded / In Transit':
        return 'text-sky-700 bg-sky-50 border-sky-200';
      case 'Loading':
        return 'text-indigo-700 bg-indigo-50 border-indigo-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar & Quick Filter Strip */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by Trip ID, truck plate, owner, crusher site, company..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-medium self-start sm:self-auto overflow-x-auto max-w-full">
            {(['all', 'today', 'yesterday', 'week', 'month'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => handleDatePreset(preset)}
                className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap capitalize cursor-pointer ${
                  datePreset === preset
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset === 'all' ? 'All Time' : preset === 'week' ? 'This Week' : preset === 'month' ? 'This Month' : preset}
              </button>
            ))}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportQuickCsv}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition-colors shadow-2xs cursor-pointer"
              title="Export Current Filtered List to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
            {canEdit && (
              <button
                onClick={() => {
                  setEditingTrip(null);
                  setIsFormOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Register Trip</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Truck Filter */}
          <select
            value={selectedTruckId}
            onChange={(e) => {
              setSelectedTruckId(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded focus:bg-white font-mono"
          >
            <option value="">All Trucks (All in Once)</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plate_number} ({t.owner_name})
              </option>
            ))}
          </select>

          {/* Construction Company */}
          <select
            value={selectedCompanyId}
            onChange={(e) => {
              setSelectedCompanyId(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded focus:bg-white"
          >
            <option value="">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Sand Type Filter */}
          <select
            value={selectedSandType}
            onChange={(e) => {
              setSelectedSandType(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded focus:bg-white font-mono"
          >
            <option value="">All Sand Types (00, 01, 02)</option>
            <option value="00">Grade 00 (Fine)</option>
            <option value="01">Grade 01 (Medium)</option>
            <option value="02">Grade 02 (Coarse)</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded focus:bg-white"
          >
            <option value="">All Statuses</option>
            <option value="Delivered">Delivered (Successful)</option>
            <option value="Partially Delivered">Partially Delivered</option>
            <option value="Unsuccessful">Unsuccessful</option>
            <option value="Loaded / In Transit">Loaded / In Transit</option>
            <option value="Loading">Loading</option>
            <option value="Registered">Registered</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Custom Date Inputs if needed */}
          <div className="flex items-center gap-1 col-span-2 sm:col-span-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset('all');
                setPage(1);
              }}
              className="w-1/2 text-[11px] font-mono px-1.5 py-1 bg-slate-50 border border-slate-200 rounded"
              title="Start Date"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset('all');
                setPage(1);
              }}
              className="w-1/2 text-[11px] font-mono px-1.5 py-1 bg-slate-50 border border-slate-200 rounded"
              title="End Date"
            />
          </div>
        </div>
      </div>

      {/* Trips Table Container */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 font-mono text-[11px] text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-3">Trip ID</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Hired Truck (Click for Specs)</th>
                <th className="py-2.5 px-3">Client &amp; Destination Project</th>
                <th className="py-2.5 px-3">Crusher Site (Loading)</th>
                <th className="py-2.5 px-3">Destination Project (Unloading)</th>
                <th className="py-2.5 px-3 text-center">Grade</th>
                <th className="py-2.5 px-3 text-right">Loaded</th>
                <th className="py-2.5 px-3 text-right">Delivered</th>
                <th className="py-2.5 px-3 text-right">Tariff (ETB / trip)</th>
                <th className="py-2.5 px-3 text-right font-bold text-emerald-800">Total Fee (ETB)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 font-mono">
                    Loading trip records...
                  </td>
                </tr>
              ) : trips.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                      <div className="font-semibold text-slate-700">No trips matching criteria</div>
                      <p className="text-xs text-slate-500">
                        Try adjusting your search query, date filter, or create a new trip record.
                      </p>
                      {canEdit && (
                        <button
                          onClick={() => {
                            setEditingTrip(null);
                            setIsFormOpen(true);
                          }}
                          className="mt-2 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 rounded cursor-pointer"
                        >
                          Register First Trip
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                trips.map((t) => {
                  const feeValue = t.total_transport_fee_etb || t.transport_rate_etb_per_m3 || 8500;
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setViewingTripId(t.id)}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {t.id}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {t.trip_date}
                      </td>
                      <td
                        className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-amber-100/60 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingTruckModalId(t.truck_id);
                        }}
                        title="Click to view full hired truck profile & capacity details"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-950 text-xs px-1.5 py-0.5 bg-amber-100/80 border border-amber-300 rounded group-hover:border-amber-500">
                            {t.truck_plate}
                          </span>
                          <TruckIcon className="w-3.5 h-3.5 text-amber-700 inline shrink-0" />
                        </div>
                        <div className="text-[11px] text-slate-600 truncate max-w-[130px] font-medium mt-0.5">
                          {t.truck_owner}
                        </div>
                        {t.truck_owner_phone && (
                          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                            <a
                              href={`tel:${t.truck_owner_phone}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono font-bold text-[10px] transition-colors shadow-2xs group-hover:border-emerald-500 cursor-pointer"
                              title={`Direct Call Owner: ${t.truck_owner_phone}`}
                            >
                              <Phone className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                              <span>{t.truck_owner_phone}</span>
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setViewingCompanyId(t.company_id)}
                          className="font-semibold text-slate-900 hover:text-blue-700 hover:underline text-left truncate max-w-[150px] block cursor-pointer"
                          title="Click to view construction company profile & direct phone link"
                        >
                          {t.company_name}
                        </button>
                        {t.project_id ? (
                          <button
                            type="button"
                            onClick={() => setViewingProjectId(t.project_id || null)}
                            className="text-[11px] text-slate-500 hover:text-blue-700 hover:underline text-left truncate max-w-[150px] block cursor-pointer"
                            title="Click to view destination project details & direct phone link"
                          >
                            {t.project_name || 'General'}
                          </button>
                        ) : (
                          <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                            {t.project_name || 'General'}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setViewingCrusherId(t.loading_location_id)}
                          className="text-slate-700 hover:text-amber-800 hover:underline text-left truncate max-w-[130px] block font-medium cursor-pointer"
                          title="Click to view crusher plant loading details & direct phone link"
                        >
                          {t.loading_location_name}
                        </button>
                      </td>
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            if (t.project_id) setViewingProjectId(t.project_id);
                          }}
                          className="text-slate-700 hover:text-blue-800 hover:underline text-left truncate max-w-[130px] block font-medium cursor-pointer"
                          title="Click to view destination project details & direct phone link"
                        >
                          {t.unloading_location_name}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-mono font-bold px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-900">
                          {t.sand_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                        {t.quantity_loaded_m3.toFixed(2)} m³
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {t.quantity_delivered_m3.toFixed(2)} m³
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-800 font-semibold">
                        {Number(feeValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                        {Number(feeValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 text-[11px] font-semibold border rounded ${getStatusBadge(
                            t.status
                          )}`}
                        >
                          {t.status}
                        </span>
                      </td>
                    <td
                      className="py-2.5 px-3 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingTripId(t.id)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                          title="View Unified Trip Record"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTrip(t);
                              setIsFormOpen(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                            title="Edit Trip Details"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="text-slate-500 font-mono">
            Showing{' '}
            <strong className="text-slate-800">
              {trips.length > 0 ? (page - 1) * limit + 1 : 0} -{' '}
              {Math.min(page * limit, totalCount)}
            </strong>{' '}
            of <strong className="text-slate-800">{totalCount}</strong> unified records <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold">(Newest on top)</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-mono cursor-pointer"
            >
              Prev
            </button>
            <span className="px-2 font-mono text-slate-600">
              Page {page} of {Math.max(Math.ceil(totalCount / limit), 1)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(totalCount / limit)}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-mono cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Trip Form Modal */}
      <TripFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onTripSaved={() => {
          setPage(1);
          loadTrips();
        }}
        tripToEdit={editingTrip}
        trucks={trucks}
        companies={companies}
        locations={locations}
      />

      {/* Trip Details Drawer / Modal */}
      <TripDetailModal
        tripId={viewingTripId}
        onClose={() => setViewingTripId(null)}
        onEditTrip={(trip) => {
          setViewingTripId(null);
          setEditingTrip(trip);
          setIsFormOpen(true);
        }}
        onStatusUpdated={() => {
          loadTrips();
        }}
        onViewTruckDossier={(trkId) => {
          setViewingTripId(null);
          if (onNavigateToTruckDossier) {
            onNavigateToTruckDossier(trkId);
          }
        }}
      />

      {/* Truck Quick Info Modal (Opens when clicked on Hired Truck row) */}
      {viewingTruckModalId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                  <TruckIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-mono text-amber-400 uppercase tracking-wider font-semibold">
                    Hired Truck Information
                  </div>
                  <h3 className="text-base font-bold text-white font-mono">
                    {truckModalData?.truck.plate_number || 'Loading Truck...'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingTruckModalId(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {isLoadingTruckModal ? (
                <div className="py-12 text-center text-xs font-mono text-slate-400">
                  Loading truck technical specifications and trip records...
                </div>
              ) : !truckModalData ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Truck record details could not be found.
                </div>
              ) : (
                <>
                  {/* Truck Core Specs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">
                        Registered Capacity
                      </div>
                      <div className="mt-1 text-xl font-bold font-mono text-slate-900">
                        {truckModalData.truck.capacity_m3 ? `${truckModalData.truck.capacity_m3} m³` : 'Standard'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Volumetric haulage rating
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">
                        Fleet Status
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${truckModalData.truck.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span className="font-bold text-sm text-slate-900">
                          {truckModalData.truck.is_active ? 'Active in Service' : 'Inactive'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Ready for dispatch
                      </div>
                    </div>
                  </div>

                  {/* Owner & Contact Card with Instant Call */}
                  <div className="bg-gradient-to-r from-amber-50 to-emerald-50/70 p-3.5 rounded-lg border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-mono font-bold text-amber-950 uppercase tracking-wider">
                        Truck Owner / Transport Contractor
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {truckModalData.truck.owner_name}
                      </div>
                      {truckModalData.truck.notes && (
                        <div className="text-xs text-slate-600 italic">
                          "{truckModalData.truck.notes}"
                        </div>
                      )}
                    </div>

                    {truckModalData.truck.owner_phone && (
                      <div className="shrink-0">
                        <a
                          href={`tel:${truckModalData.truck.owner_phone}`}
                          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-mono font-bold text-xs transition-colors shadow-xs cursor-pointer"
                          title="Call Owner Directly"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-white animate-bounce" />
                          <span>Call {truckModalData.truck.owner_phone}</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Operational Lifetime Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase font-mono">Total Trips</div>
                      <div className="font-bold font-mono text-base text-slate-900 mt-0.5">
                        {truckModalData.summary?.totalTrips ?? truckModalData.trips.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase font-mono">Delivered Volume</div>
                      <div className="font-bold font-mono text-base text-emerald-700 mt-0.5">
                        {truckModalData.summary?.totalDeliveredM3
                          ? `${Number(truckModalData.summary.totalDeliveredM3).toFixed(1)} m³`
                          : `${truckModalData.trips.reduce((acc, t) => acc + (t.quantity_delivered_m3 || 0), 0).toFixed(1)} m³`}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase font-mono">Success Rate</div>
                      <div className="font-bold font-mono text-base text-blue-700 mt-0.5">
                        {truckModalData.summary?.successRate !== undefined && truckModalData.summary?.successRate !== null
                          ? `${truckModalData.summary.successRate}%`
                          : '100%'}
                      </div>
                    </div>
                  </div>

                  {/* Truck Trip History Table */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-mono font-bold text-slate-800 uppercase tracking-wider">
                        Unified Trip History ({truckModalData.trips.length} dispatches)
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        Rated Cap: {truckModalData.truck.capacity_m3?.toFixed(2)} m³
                      </span>
                    </div>

                    {truckModalData.trips.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded border border-slate-200 text-center text-slate-400 text-xs">
                        No dispatches logged for this truck yet.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-slate-600 font-mono text-[10px] border-b border-slate-200">
                              <th className="py-1.5 px-2.5">Date &amp; ID</th>
                              <th className="py-1.5 px-2.5">Route</th>
                              <th className="py-1.5 px-2.5 text-center">Grade</th>
                              <th className="py-1.5 px-2.5 text-right">Delivered</th>
                              <th className="py-1.5 px-2.5 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                            {truckModalData.trips.map((tr) => (
                              <tr
                                key={tr.id}
                                className="hover:bg-amber-50/70 cursor-pointer transition-colors"
                                onClick={() => {
                                  setViewingTruckModalId(null);
                                  setViewingTripId(tr.id);
                                }}
                                title="Click to view trip audit & settlement details"
                              >
                                <td className="py-1.5 px-2.5 whitespace-nowrap">
                                  <div className="font-bold text-slate-900 hover:text-amber-600 underline decoration-dotted">{tr.id}</div>
                                  <div className="text-[10px] text-slate-500">{tr.trip_date}</div>
                                </td>
                                <td className="py-1.5 px-2.5 font-sans">
                                  <div className="text-slate-800 truncate max-w-[170px]">{tr.loading_location_name}</div>
                                  <div className="text-blue-700 text-[10px] font-semibold truncate max-w-[170px]">{tr.unloading_location_name}</div>
                                </td>
                                <td className="py-1.5 px-2.5 text-center">
                                  <span className="px-1 py-0.2 rounded bg-slate-200 text-slate-800 font-bold text-[10px]">
                                    {tr.sand_type}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2.5 text-right font-bold text-slate-900">
                                  {tr.quantity_delivered_m3.toFixed(2)} m³
                                </td>
                                <td className="py-1.5 px-2.5 text-center">
                                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                    tr.status === 'Delivered'
                                      ? 'bg-emerald-50 text-emerald-800'
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

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-between gap-3">
                    {onNavigateToTruckDossier && (
                      <button
                        type="button"
                        onClick={() => {
                          const trkId = truckModalData.truck.id;
                          setViewingTruckModalId(null);
                          onNavigateToTruckDossier(trkId);
                        }}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <FileBarChart2 className="w-4 h-4" />
                        <span>Open Comprehensive Dossier Report →</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setViewingTruckModalId(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition-colors ml-auto cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Construction Company Detail Popup */}
      <CompanyDetailModal
        companyId={viewingCompanyId}
        isOpen={!!viewingCompanyId}
        onClose={() => setViewingCompanyId(null)}
        onSelectProject={(pId) => {
          setViewingCompanyId(null);
          setViewingProjectId(pId);
        }}
        onSelectTrip={(tId) => {
          setViewingCompanyId(null);
          setViewingTripId(tId);
        }}
      />

      {/* Destination Project Detail Popup */}
      <ProjectDetailModal
        projectId={viewingProjectId}
        isOpen={!!viewingProjectId}
        onClose={() => setViewingProjectId(null)}
        onSelectCompany={(cId) => {
          setViewingProjectId(null);
          setViewingCompanyId(cId);
        }}
        onSelectTrip={(tId) => {
          setViewingProjectId(null);
          setViewingTripId(tId);
        }}
      />

      {/* Crusher Site (Loading Origin) Detail Popup */}
      <CrusherDetailModal
        locationId={viewingCrusherId}
        isOpen={!!viewingCrusherId}
        onClose={() => setViewingCrusherId(null)}
        onSelectTrip={(tId) => {
          setViewingCrusherId(null);
          setViewingTripId(tId);
        }}
      />
    </div>
  );
};
