import React, { useState, useMemo } from 'react';
import {
  Truck as TruckIcon,
  Calendar,
  DollarSign,
  TrendingUp,
  Scale,
  MapPin,
  Building2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  ArrowUpDown,
  Phone,
  Search,
  Maximize2,
  Minimize2,
  Table as TableIcon,
  Info,
  Clock
} from 'lucide-react';
import { TruckTransportPivotData, TruckPivotGroup, TruckPivotTrip } from '../../types';

interface TruckTransportPivotReportViewProps {
  data: TruckTransportPivotData | null;
  isLoading: boolean;
  onOpenTripModal?: (tripId: string) => void;
  onOpenTruckDossier?: (truckId: string) => void;
}

export interface PivotTripItem {
  id: string;
  trip_date: string;
  loading_time: string;
  sand_type_display: string;
  quantity_loaded_m3: number;
  quantity_delivered_m3: number;
  individual_price: number;
  status: string;
  raw: TruckPivotTrip;
}

export interface PivotRouteGroup {
  key: string;
  loadingPoint: string;
  company: string;
  destinationProject: string;
  numberOfTrips: number;
  subtotalPrice: number;
  trips: PivotTripItem[];
}

export interface ProcessedTruckPivot {
  truck_id: string;
  truck_plate: string;
  truck_owner: string;
  owner_phone?: string | null;
  capacity_m3?: number | null;
  total_trips: number;
  grand_total: number;
  total_delivered_m3: number;
  total_loaded_m3: number;
  routeGroups: PivotRouteGroup[];
  totalRows: number;
}

function formatLoadingTime(loadingDatetime?: string | null, createdAt?: string | null): string {
  const raw = loadingDatetime || createdAt;
  if (!raw) return '10:00:00 PM';
  try {
    const dt = new Date(raw);
    if (isNaN(dt.getTime())) return '10:00:00 PM';
    return dt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return '10:00:00 PM';
  }
}

function formatSandType(st?: string): string {
  if (!st) return '0';
  if (st === '00') return '0';
  if (st === '01') return '1';
  if (st === '02') return '2';
  return st;
}

export const TruckTransportPivotReportView: React.FC<TruckTransportPivotReportViewProps> = ({
  data,
  isLoading,
  onOpenTripModal,
  onOpenTruckDossier
}) => {
  // Default to the exact pivoted document table matching user's attached report
  const [viewMode, setViewMode] = useState<'pivot_table' | 'cards' | 'grid'>('pivot_table');
  const [expandedTrucks, setExpandedTrucks] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'total_fee' | 'trips' | 'volume' | 'plate'>('total_fee');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Toggle expand for a truck in card mode
  const toggleTruckExpand = (truckId: string) => {
    setExpandedTrucks(prev => ({
      ...prev,
      [truckId]: prev[truckId] === undefined ? false : !prev[truckId]
    }));
  };

  const isTruckExpanded = (truckId: string) => {
    return expandedTrucks[truckId] !== false;
  };

  const handleExpandAll = (expand: boolean) => {
    if (!data) return;
    const next: Record<string, boolean> = {};
    data.truckGroups.forEach(tg => {
      next[tg.truck_id] = expand;
    });
    setExpandedTrucks(next);
  };

  // Process trucks and their route groups for the exact pivot table
  const processedTrucks: ProcessedTruckPivot[] = useMemo(() => {
    if (!data || !data.truckGroups) return [];

    let list = [...data.truckGroups];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(tg => {
        const matchesTruck =
          tg.truck_plate.toLowerCase().includes(q) ||
          tg.truck_owner.toLowerCase().includes(q) ||
          (tg.owner_phone && tg.owner_phone.toLowerCase().includes(q));

        const matchesTrip = tg.trips.some(tr =>
          (tr.trip_date && tr.trip_date.toLowerCase().includes(q)) ||
          (tr.loading_location_name && tr.loading_location_name.toLowerCase().includes(q)) ||
          (tr.unloading_location_name && tr.unloading_location_name.toLowerCase().includes(q)) ||
          (tr.company_name && tr.company_name.toLowerCase().includes(q)) ||
          (tr.project_name && tr.project_name.toLowerCase().includes(q)) ||
          (tr.status && tr.status.toLowerCase().includes(q)) ||
          (tr.sand_type && tr.sand_type.toLowerCase().includes(q))
        );

        return matchesTruck || matchesTrip;
      });
    }

    // Sort truck groups
    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'total_fee') {
        comparison = (a.calculated_total_transport_fee_etb || 0) - (b.calculated_total_transport_fee_etb || 0);
      } else if (sortBy === 'trips') {
        comparison = (a.total_trips || 0) - (b.total_trips || 0);
      } else if (sortBy === 'volume') {
        comparison = (a.total_delivered_m3 || 0) - (b.total_delivered_m3 || 0);
      } else if (sortBy === 'plate') {
        comparison = a.truck_plate.localeCompare(b.truck_plate);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Build hierarchical route groups for each truck
    return list.map(truck => {
      const rawTrips = truck.trips || [];
      const routeMap = new Map<string, PivotTripItem[]>();

      rawTrips.forEach(tr => {
        const loading = (tr.loading_location_name || '-').trim();
        const comp = (tr.company_name || '-').trim();
        const dest = ((tr.project_name && tr.project_name !== '-') ? tr.project_name : (tr.unloading_location_name || '-')).trim();
        const key = `${loading}__${comp}__${dest}`;

        if (!routeMap.has(key)) routeMap.set(key, []);

        routeMap.get(key)!.push({
          id: tr.id,
          trip_date: tr.trip_date || '-',
          loading_time: formatLoadingTime(tr.loading_datetime, tr.created_at),
          sand_type_display: formatSandType(tr.sand_type),
          quantity_loaded_m3: Number(tr.quantity_loaded_m3 || 0),
          quantity_delivered_m3: Number(tr.quantity_delivered_m3 || 0),
          individual_price: Number(tr.individual_transport_fee_etb || 0),
          status: tr.status || 'Delivered',
          raw: tr
        });
      });

      const routeGroups: PivotRouteGroup[] = [];
      routeMap.forEach((tripsInGroup) => {
        const first = tripsInGroup[0].raw;
        const subtotal = tripsInGroup.reduce((sum, item) => sum + item.individual_price, 0);

        routeGroups.push({
          key: `${first.loading_location_name}__${first.company_name}__${first.project_name || first.unloading_location_name}`,
          loadingPoint: (first.loading_location_name || '-').trim(),
          company: (first.company_name || '-').trim(),
          destinationProject: ((first.project_name && first.project_name !== '-') ? first.project_name : (first.unloading_location_name || '-')).trim(),
          numberOfTrips: tripsInGroup.length,
          subtotalPrice: subtotal,
          trips: tripsInGroup
        });
      });

      const totalRows = rawTrips.length > 0 ? rawTrips.length : 1;
      const computedGrandTotal = truck.calculated_total_transport_fee_etb ?? routeGroups.reduce((acc, rg) => acc + rg.subtotalPrice, 0);

      return {
        truck_id: truck.truck_id,
        truck_plate: truck.truck_plate,
        truck_owner: truck.truck_owner,
        owner_phone: truck.owner_phone,
        capacity_m3: truck.capacity_m3,
        total_trips: rawTrips.length || truck.total_trips,
        grand_total: computedGrandTotal,
        total_delivered_m3: Number(truck.total_delivered_m3 || 0),
        total_loaded_m3: Number(truck.total_loaded_m3 || 0),
        routeGroups,
        totalRows
      };
    });
  }, [data, searchQuery, sortBy, sortOrder]);

  // Flattened trips for grid mode
  const filteredFlatTrips = useMemo(() => {
    const list: Array<TruckPivotTrip & { parentTruck: TruckPivotGroup }> = [];
    if (!data) return list;
    data.truckGroups.forEach(tg => {
      tg.trips.forEach(tr => {
        list.push({ ...tr, parentTruck: tg });
      });
    });
    return list;
  }, [data]);

  // Overall sums across all processed trucks in current filter
  const tableSummary = useMemo(() => {
    let dispatches = 0;
    let totalLoaded = 0;
    let grandTotalFee = 0;

    processedTrucks.forEach(t => {
      dispatches += t.total_trips;
      t.routeGroups.forEach(rg => {
        rg.trips.forEach(tr => {
          totalLoaded += tr.quantity_loaded_m3;
        });
        grandTotalFee += rg.subtotalPrice;
      });
    });

    return {
      trucksCount: processedTrucks.length,
      dispatches,
      totalLoaded,
      grandTotalFee
    };
  }, [processedTrucks]);

  if (isLoading) {
    return (
      <div className="bg-white p-12 rounded-lg border border-slate-200 text-center font-mono text-xs text-slate-500 space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mx-auto" />
        <p>Compiling Hired Trucks Trip History &amp; Calculating Pivoted Transport Fees...</p>
      </div>
    );
  }

  if (!data || data.truckGroups.length === 0) {
    return (
      <div className="bg-white p-10 rounded-lg border border-slate-200 text-center text-xs text-slate-500 space-y-2">
        <TruckIcon className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="font-semibold text-slate-700">No trip history found for hired trucks matching your filter criteria.</p>
        <p className="text-[11px] text-slate-400">Try broadening the date range or clearing the truck/client filters.</p>
      </div>
    );
  }

  const kpis = data.kpis;

  return (
    <div className="space-y-4">
      {/* Executive Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Calculated Transport Fees */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white p-3.5 rounded-lg border border-amber-300 shadow-2xs col-span-2 sm:col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-amber-900 font-bold uppercase tracking-wider">
              Total Transport Fees
            </span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-950 mt-1 tabular-nums">
            ETB {Number(kpis.totalTransportFeesEtb || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-amber-800/80 mt-0.5">
            Calculated across all {kpis.totalTrips} dispatches
          </div>
        </div>

        {/* Hired Trucks Mobilized */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500 uppercase">Hired Trucks</span>
            <TruckIcon className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {kpis.totalHiredTrucks} <span className="text-xs font-normal text-slate-500">units</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Mobilized fleet</div>
        </div>

        {/* Total Trips */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500 uppercase">Total Dispatches</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {kpis.totalTrips} <span className="text-xs font-normal text-slate-500">trips</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{kpis.successfulTrips} successful delivery</div>
        </div>

        {/* Average Transport Fee Per Truck */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500 uppercase">Avg Fee / Truck</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-bold font-mono text-slate-900 mt-1 tabular-nums">
            ETB {Number(kpis.avgFeePerTruckEtb || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">ETB {Number(kpis.avgFeePerTripEtb || 0).toFixed(0)} avg/trip</div>
        </div>

        {/* Total Delivered Volume */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500 uppercase">Total Delivered</span>
            <Scale className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold font-mono text-emerald-700 mt-1 tabular-nums">
            {Number(kpis.totalDeliveredM3 || 0).toFixed(2)} <span className="text-xs font-normal">m³</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Sand &amp; aggregate volume</div>
        </div>
      </div>

      {/* Control Strip: Presentation Mode & Search & Sorting */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-xs">Report Layout:</span>
          <div className="inline-flex rounded-md p-1 bg-slate-100 border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('pivot_table')}
              className={`px-3 py-1 font-bold rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'pivot_table'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Exact pivoted layout with merged cells matching the reference report"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Exact Pivoted Ledger (Reference Format)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 font-semibold rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Expandable master-detail truck cards"
            >
              <TruckIcon className="w-3.5 h-3.5 text-amber-500" />
              <span>Interactive Truck Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 font-semibold rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Flat ledger grid"
            >
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              <span>Flat Ledger Grid</span>
            </button>
          </div>
        </div>

        {/* Search and Sort Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {viewMode === 'cards' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleExpandAll(true)}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 flex items-center gap-1 cursor-pointer"
                title="Expand all truck histories"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Expand All</span>
              </button>
              <button
                type="button"
                onClick={() => handleExpandAll(false)}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 flex items-center gap-1 cursor-pointer"
                title="Collapse all truck histories"
              >
                <Minimize2 className="w-3 h-3" />
                <span>Collapse</span>
              </button>
            </div>
          )}

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800"
            >
              <option value="total_fee">Grand Total Fee (ETB)</option>
              <option value="trips">Total Trips</option>
              <option value="volume">Delivered Volume (m³)</option>
              <option value="plate">Plate Number (A-Z)</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
              className="p-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 cursor-pointer"
              title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-48 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter plate, route, carrier..."
              className="w-full text-xs pl-8 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Explanatory Banner */}
      <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-snug">
          <span className="font-bold text-slate-900">Pivoted Hierarchical Ledger:</span> This report reproduces the exact multi-level pivot layout shown in your reference document. Dispatches are pivoted around the <strong>Truck Plate Number</strong> (with its <strong>Grand Total</strong>), grouped by <strong>Loading Point &amp; Destination Project</strong> (with route <strong>Subtotal price</strong>), and detailed across individual trip rows displaying <strong>Date</strong>, <strong>Loading Time</strong>, <strong>Sand Type</strong>, <strong>Loaded (m³)</strong>, and <strong>Individual Price</strong>.
        </div>
      </div>

      {/* ======================================================== */}
      {/* VIEW MODE 1: EXACT PIVOTED DOCUMENT TABLE (AS ATTACHED) */}
      {/* ======================================================== */}
      {viewMode === 'pivot_table' && (
        <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse border border-slate-300 bg-white">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold text-[11px] tracking-tight">
                  <th className="py-2.5 px-3 border border-slate-300 text-left whitespace-nowrap bg-slate-100">
                    Truck Plate
                  </th>
                  <th className="py-2.5 px-3 border border-slate-300 text-left whitespace-nowrap bg-slate-100">
                    Truck Owner
                  </th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap bg-slate-100">
                    Total Trips
                  </th>
                  <th className="py-2.5 px-3 border border-slate-300 text-left whitespace-nowrap bg-slate-100">
                    Loading Point
                  </th>
                  <th className="py-2.5 px-3 border border-slate-300 text-left whitespace-nowrap bg-slate-100">
                    Company
                  </th>
                  <th className="py-2.5 px-3 border border-slate-300 text-left whitespace-nowrap bg-slate-100">
                    Destination Project
                  </th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap bg-slate-100">
                    Number of Trips
                  </th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap bg-slate-100">
                    Date
                  </th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap bg-slate-100">
                    Loading Time
                  </th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap bg-slate-100">
                    Sand Type
                  </th>
                  <th className="py-2.5 px-3 border border-slate-300 text-right whitespace-nowrap bg-slate-100">
                    Loaded (m³)
                  </th>
                  <th className="py-2.5 px-3 border border-slate-300 text-right whitespace-nowrap bg-slate-100">
                    Individual Price
                  </th>
                  <th className="py-2.5 px-3 border border-slate-300 text-right whitespace-nowrap bg-slate-100 font-bold text-slate-900">
                    Subtotal price
                  </th>
                  <th className="py-2.5 px-3 border border-slate-300 text-right whitespace-nowrap bg-slate-200/80 font-black text-slate-950">
                    Grand Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {processedTrucks.map((truck, truckIdx) => {
                  const { routeGroups, totalRows } = truck;

                  if (routeGroups.length === 0) {
                    return (
                      <tr key={truck.truck_id} className="hover:bg-slate-50 border-b border-slate-300">
                        <td className="py-2 px-3 border border-slate-300 font-mono font-bold text-slate-900">
                          {truck.truck_plate}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 font-medium text-slate-800">
                          {truck.truck_owner}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 text-center font-mono font-bold">
                          0
                        </td>
                        <td colSpan={10} className="py-2 px-3 border border-slate-300 text-center text-slate-400 italic">
                          No trip history found in the current period
                        </td>
                        <td className="py-2 px-3 border border-slate-300 text-right font-mono font-bold text-slate-900">
                          0
                        </td>
                      </tr>
                    );
                  }

                  return routeGroups.map((routeGroup, rgIdx) => {
                    return routeGroup.trips.map((trip, tIdx) => {
                      const isFirstRowOfTruck = rgIdx === 0 && tIdx === 0;
                      const isFirstRowOfRoute = tIdx === 0;
                      const routeGroupRows = routeGroup.trips.length;

                      return (
                        <tr
                          key={trip.id}
                          className={`hover:bg-amber-50/20 transition-colors ${
                            isFirstRowOfTruck && truckIdx > 0 ? 'border-t-2 border-slate-400' : ''
                          }`}
                        >
                          {/* 1. Truck Plate (rowspanned across entire truck) */}
                          {isFirstRowOfTruck && (
                            <td
                              rowSpan={totalRows}
                              className="py-2.5 px-3 border border-slate-300 align-middle font-mono font-bold text-slate-950 bg-white"
                            >
                              <div className="flex items-center gap-1.5">
                                <TruckIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>{truck.truck_plate}</span>
                              </div>
                              {onOpenTruckDossier && (
                                <button
                                  type="button"
                                  onClick={() => onOpenTruckDossier(truck.truck_id)}
                                  className="text-[10px] text-amber-600 hover:underline flex items-center gap-0.5 mt-0.5 font-sans font-normal cursor-pointer"
                                  title="View complete truck dossier"
                                >
                                  <span>Dossier</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </td>
                          )}

                          {/* 2. Truck Owner (rowspanned across entire truck) */}
                          {isFirstRowOfTruck && (
                            <td
                              rowSpan={totalRows}
                              className="py-2.5 px-3 border border-slate-300 align-middle font-medium text-slate-800 bg-white whitespace-nowrap"
                            >
                              <div>{truck.truck_owner}</div>
                              {truck.owner_phone && (
                                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                  <Phone className="w-2.5 h-2.5" />
                                  <span>{truck.owner_phone}</span>
                                </div>
                              )}
                            </td>
                          )}

                          {/* 3. Total Trips (rowspanned across entire truck) */}
                          {isFirstRowOfTruck && (
                            <td
                              rowSpan={totalRows}
                              className="py-2.5 px-3 border border-slate-300 align-middle text-center font-mono font-bold text-slate-900 bg-white"
                            >
                              {truck.total_trips}
                            </td>
                          )}

                          {/* 4. Loading Point (rowspanned across route group) */}
                          {isFirstRowOfRoute && (
                            <td
                              rowSpan={routeGroupRows}
                              className="py-2.5 px-3 border border-slate-300 align-middle font-semibold text-slate-900 bg-slate-50/40"
                            >
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>{routeGroup.loadingPoint}</span>
                              </div>
                            </td>
                          )}

                          {/* 5. Company (rowspanned across route group) */}
                          {isFirstRowOfRoute && (
                            <td
                              rowSpan={routeGroupRows}
                              className="py-2.5 px-3 border border-slate-300 align-middle font-medium text-slate-800 bg-slate-50/40"
                            >
                              <div className="flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
                                <span>{routeGroup.company}</span>
                              </div>
                            </td>
                          )}

                          {/* 6. Destination Project (rowspanned across route group) */}
                          {isFirstRowOfRoute && (
                            <td
                              rowSpan={routeGroupRows}
                              className="py-2.5 px-3 border border-slate-300 align-middle text-slate-700 bg-slate-50/40"
                            >
                              {routeGroup.destinationProject}
                            </td>
                          )}

                          {/* 7. Number of Trips in this Route Group (rowspanned) */}
                          {isFirstRowOfRoute && (
                            <td
                              rowSpan={routeGroupRows}
                              className="py-2.5 px-3 border border-slate-300 align-middle text-center font-mono font-bold text-slate-900 bg-slate-50/40"
                            >
                              {routeGroup.numberOfTrips}
                            </td>
                          )}

                          {/* 8. Date (individual dispatch row) */}
                          <td className="py-2 px-3 border border-slate-300 text-center font-mono text-slate-900 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{trip.trip_date}</span>
                            </div>
                          </td>

                          {/* 9. Loading Time (individual dispatch row) */}
                          <td className="py-2 px-3 border border-slate-300 text-center font-mono text-slate-600 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{trip.loading_time}</span>
                            </div>
                          </td>

                          {/* 10. Sand Type (individual dispatch row) */}
                          <td className="py-2 px-3 border border-slate-300 text-center font-mono font-bold text-slate-700">
                            {trip.sand_type_display}
                          </td>

                          {/* 11. Loaded (m³) (individual dispatch row) */}
                          <td className="py-2 px-3 border border-slate-300 text-right font-mono font-medium text-slate-800 tabular-nums">
                            {trip.quantity_loaded_m3.toFixed(2)}
                          </td>

                          {/* 12. Individual Price (individual dispatch row) */}
                          <td className="py-2 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <span>
                                {trip.individual_price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                              </span>
                              {onOpenTripModal && (
                                <button
                                  type="button"
                                  onClick={() => onOpenTripModal(trip.id)}
                                  className="text-slate-300 hover:text-amber-600 transition-colors p-0.5 cursor-pointer"
                                  title="Inspect trip dispatch details"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 13. Subtotal price (rowspanned across route group) */}
                          {isFirstRowOfRoute && (
                            <td
                              rowSpan={routeGroupRows}
                              className="py-2.5 px-3 border border-slate-300 align-middle text-right font-mono font-bold text-slate-950 bg-slate-50/80 tabular-nums whitespace-nowrap"
                            >
                              {routeGroup.subtotalPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </td>
                          )}

                          {/* 14. Grand Total (rowspanned across entire truck) */}
                          {isFirstRowOfTruck && (
                            <td
                              rowSpan={totalRows}
                              className="py-2.5 px-3 border border-slate-300 align-middle text-right font-mono font-black text-emerald-800 bg-amber-50/30 text-sm tabular-nums whitespace-nowrap"
                            >
                              {truck.grand_total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </td>
                          )}
                        </tr>
                      );
                    });
                  });
                })}
              </tbody>
              {/* Grand Total Summary Footer */}
              <tfoot>
                <tr className="bg-slate-900 text-white font-mono text-xs font-bold border-t-2 border-slate-400">
                  <td colSpan={2} className="py-3 px-3 uppercase tracking-wider text-amber-400 border border-slate-700">
                    Grand Fleet Totals ({tableSummary.trucksCount} trucks):
                  </td>
                  <td className="py-3 px-3 text-center border border-slate-700 text-amber-300">
                    {tableSummary.dispatches}
                  </td>
                  <td colSpan={3} className="py-3 px-3 border border-slate-700 text-slate-400 font-normal">
                    Aggregated across all routes &amp; destinations
                  </td>
                  <td className="py-3 px-3 text-center border border-slate-700 text-amber-300">
                    {tableSummary.dispatches}
                  </td>
                  <td colSpan={3} className="py-3 px-3 border border-slate-700"></td>
                  <td className="py-3 px-3 text-right border border-slate-700 text-emerald-300 font-black tabular-nums">
                    {tableSummary.totalLoaded.toFixed(2)} m³
                  </td>
                  <td className="py-3 px-3 text-right border border-slate-700 text-amber-300 font-black tabular-nums">
                    ETB {tableSummary.grandTotalFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right border border-slate-700 text-amber-300 font-black tabular-nums">
                    ETB {tableSummary.grandTotalFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right border border-slate-700 text-emerald-400 font-black text-sm tabular-nums bg-slate-950">
                    ETB {tableSummary.grandTotalFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW MODE 2: PIVOTED MASTER-DETAIL CARDS (EXPANDABLE)   */}
      {/* ======================================================== */}
      {viewMode === 'cards' && (
        <div className="space-y-3.5">
          {processedTrucks.map((truck) => {
            const isExpanded = isTruckExpanded(truck.truck_id);
            const routeGroups = truck.routeGroups || [];

            return (
              <div
                key={truck.truck_id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Master Header Card Pivoted Around Truck Plate Number */}
                <div
                  onClick={() => toggleTruckExpand(truck.truck_id)}
                  className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-100/70 transition-colors"
                >
                  {/* Left: Truck Plate & Carrier Info */}
                  <div className="flex items-start sm:items-center gap-3">
                    <button
                      type="button"
                      className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors mt-0.5 sm:mt-0"
                      tabIndex={-1}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-amber-600" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <div className="p-2 rounded-lg bg-slate-900 text-amber-400 font-mono font-bold text-xs shadow-xs flex items-center gap-1.5 shrink-0">
                      <TruckIcon className="w-4 h-4" />
                      <span>{truck.truck_plate}</span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{truck.truck_owner}</span>
                        {truck.capacity_m3 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            Cap: {Number(truck.capacity_m3).toFixed(1)} m³
                          </span>
                        )}
                        {onOpenTruckDossier && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenTruckDossier(truck.truck_id);
                            }}
                            className="text-[10px] text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-0.5"
                          >
                            <span>Full Dossier</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 font-mono">
                        {truck.owner_phone && (
                          <span className="flex items-center gap-1 text-slate-600">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {truck.owner_phone}
                          </span>
                        )}
                        <span>{truck.total_trips} trips registered</span>
                        <span>•</span>
                        <span>{truck.total_loaded_m3.toFixed(2)} m³ loaded</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: GRAND TOTAL TRANSPORT FEE (PIVOTED) */}
                  <div className="flex items-center gap-4 self-end md:self-center pl-8 md:pl-0">
                    <div className="text-right">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-amber-800 font-semibold">
                        Grand Total Transport Fee
                      </div>
                      <div className="text-base sm:text-lg font-black font-mono text-emerald-700 tabular-nums">
                        ETB {truck.grand_total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {routeGroups.length} route group(s) • {truck.total_trips} trips
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-Rows: Itemized Route Groups & Trip History */}
                {isExpanded && (
                  <div>
                    {routeGroups.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 font-mono">
                        No individual trip records found for this truck in the current filter period.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                              <th className="py-2 px-3">Loading Point</th>
                              <th className="py-2 px-3">Company</th>
                              <th className="py-2 px-3">Destination Project</th>
                              <th className="py-2 px-3 text-center">Trips</th>
                              <th className="py-2 px-3 text-center">Date</th>
                              <th className="py-2 px-3 text-center">Loading Time</th>
                              <th className="py-2 px-3 text-center">Grade</th>
                              <th className="py-2 px-3 text-right">Loaded (m³)</th>
                              <th className="py-2 px-3 text-right font-bold text-slate-900">Individual Price</th>
                              <th className="py-2 px-3 text-right font-bold text-emerald-800 bg-emerald-50/50">Subtotal price</th>
                              <th className="py-2 px-3 text-right font-black text-amber-950 bg-amber-50/60">Grand Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {routeGroups.map((rg, rgIdx) => {
                              return rg.trips.map((trip, tIdx) => {
                                const isFirstOfRoute = tIdx === 0;
                                const isFirstOfTruck = rgIdx === 0 && tIdx === 0;

                                return (
                                  <tr key={trip.id} className="hover:bg-amber-50/20 transition-colors">
                                    {isFirstOfRoute && (
                                      <td rowSpan={rg.trips.length} className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-100 align-middle">
                                        {rg.loadingPoint}
                                      </td>
                                    )}
                                    {isFirstOfRoute && (
                                      <td rowSpan={rg.trips.length} className="py-2 px-3 text-slate-800 border-r border-slate-100 align-middle">
                                        {rg.company}
                                      </td>
                                    )}
                                    {isFirstOfRoute && (
                                      <td rowSpan={rg.trips.length} className="py-2 px-3 text-slate-700 border-r border-slate-100 align-middle">
                                        {rg.destinationProject}
                                      </td>
                                    )}
                                    {isFirstOfRoute && (
                                      <td rowSpan={rg.trips.length} className="py-2 px-3 text-center font-mono font-bold text-slate-900 border-r border-slate-100 align-middle">
                                        {rg.numberOfTrips}
                                      </td>
                                    )}
                                    <td className="py-2 px-3 text-center font-mono text-slate-800 whitespace-nowrap">
                                      {trip.trip_date}
                                    </td>
                                    <td className="py-2 px-3 text-center font-mono text-slate-600 whitespace-nowrap">
                                      {trip.loading_time}
                                    </td>
                                    <td className="py-2 px-3 text-center font-mono text-slate-800 font-bold">
                                      {trip.sand_type_display}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-slate-800 tabular-nums">
                                      {trip.quantity_loaded_m3.toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                                      {trip.individual_price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    </td>
                                    {isFirstOfRoute && (
                                      <td rowSpan={rg.trips.length} className="py-2 px-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/40 align-middle tabular-nums whitespace-nowrap">
                                        {rg.subtotalPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                      </td>
                                    )}
                                    {isFirstOfTruck && (
                                      <td rowSpan={truck.totalRows} className="py-2 px-3 text-right font-mono font-black text-slate-950 bg-amber-50/50 align-middle tabular-nums whitespace-nowrap">
                                        {truck.grand_total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                      </td>
                                    )}
                                  </tr>
                                );
                              });
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW MODE 3: MULTI-ROW SPREADSHEET LEDGER GRID          */}
      {/* ======================================================== */}
      {viewMode === 'grid' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-3">Truck Plate</th>
                  <th className="py-3 px-3">Carrier / Owner</th>
                  <th className="py-3 px-3 font-bold text-amber-300 text-right bg-slate-950">
                    Grand Total (ETB)
                  </th>
                  <th className="py-3 px-3 font-bold text-amber-300">Trip Date</th>
                  <th className="py-3 px-3">Crusher Plant (Origin)</th>
                  <th className="py-3 px-3">Destination Project</th>
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3 text-center">Grade</th>
                  <th className="py-3 px-3 text-right">Loaded (m³)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right font-bold text-emerald-400 bg-slate-950">
                    Individual Price (ETB)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFlatTrips.map((row, idx) => {
                  const isFirstOfTruck =
                    idx === 0 || row.truck_id !== filteredFlatTrips[idx - 1].truck_id;

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-amber-50/30 transition-colors ${
                        isFirstOfTruck ? 'border-t-2 border-slate-300 bg-slate-50/50' : ''
                      }`}
                    >
                      {/* Truck Plate */}
                      <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {isFirstOfTruck ? (
                          <div className="flex items-center gap-1.5 text-slate-950">
                            <TruckIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="font-bold underline decoration-amber-400 underline-offset-2">
                              {row.truck_plate}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 pl-5 text-[10px] font-mono">↳ {row.truck_plate}</span>
                        )}
                      </td>

                      {/* Carrier / Owner */}
                      <td className="py-2 px-3 font-medium text-slate-700 whitespace-nowrap">
                        {isFirstOfTruck ? (
                          <span>{row.truck_owner}</span>
                        ) : (
                          <span className="text-slate-300">”</span>
                        )}
                      </td>

                      {/* GRAND TOTAL FEE (PIVOTED AROUND TRUCK) */}
                      <td className="py-2 px-3 text-right font-mono font-bold text-amber-950 bg-amber-50/40 tabular-nums whitespace-nowrap">
                        {isFirstOfTruck ? (
                          <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-black border border-amber-300">
                            ETB {Number(row.parentTruck.calculated_total_transport_fee_etb || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[10px] font-mono">
                            (Total: ETB {Number(row.parentTruck.calculated_total_transport_fee_etb || 0).toLocaleString()})
                          </span>
                        )}
                      </td>

                      {/* Trip Date Column */}
                      <td className="py-2 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {row.trip_date}
                      </td>

                      {/* Origin Crusher */}
                      <td className="py-2 px-3 text-slate-800 truncate max-w-[160px]">
                        {row.loading_location_name}
                      </td>

                      {/* Destination Project */}
                      <td className="py-2 px-3 text-slate-700 truncate max-w-[160px]">
                        {row.project_name && row.project_name !== '-' ? row.project_name : row.unloading_location_name}
                      </td>

                      {/* Client */}
                      <td className="py-2 px-3 text-slate-600 truncate max-w-[130px]">
                        {row.company_name}
                      </td>

                      {/* Grade */}
                      <td className="py-2 px-3 text-center">
                        <span className="font-mono text-[10px] font-bold px-1 rounded bg-slate-100 text-slate-700">
                          {formatSandType(row.sand_type)}
                        </span>
                      </td>

                      {/* Loaded Volume */}
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {Number(row.quantity_loaded_m3 || 0).toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                            row.status === 'Delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>

                      {/* Individual Price */}
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/50 tabular-nums whitespace-nowrap">
                        ETB {Number(row.individual_transport_fee_etb || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Grand Total Footer */}
              <tfoot>
                <tr className="bg-slate-900 text-white font-mono text-xs font-bold">
                  <td colSpan={2} className="py-3 px-3 uppercase tracking-wider text-amber-400">
                    Grand Fleet Totals ({kpis.totalHiredTrucks} trucks, {kpis.totalTrips} trips):
                  </td>
                  <td className="py-3 px-3 text-right text-amber-300 font-black tabular-nums bg-slate-950">
                    ETB {Number(kpis.totalTransportFeesEtb || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={5}></td>
                  <td className="py-3 px-3 text-right text-emerald-300 font-black tabular-nums">
                    {Number(kpis.totalLoadedM3 || 0).toFixed(2)} m³
                  </td>
                  <td></td>
                  <td className="py-3 px-3 text-right text-emerald-400 font-black tabular-nums bg-slate-950">
                    ETB {Number(kpis.totalTransportFeesEtb || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
