import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Building2,
  MapPin,
  RefreshCw,
  AlertCircle,
  Info,
  Route,
  DollarSign,
  Activity,
  ArrowRight,
  Boxes,
  TrendingUp,
  Zap
} from 'lucide-react';
import {
  DashboardData,
  DashboardKPI,
  SandType,
  TripStatus,
  ConstructionCompany,
  TodayRealtimeSummary
} from '../../types';
import { api } from '../../lib/api';

interface DashboardViewProps {
  onNavigateToTrips: (filter?: any) => void;
  onNavigateToReports: (reportId?: string, extraParams?: { truck_id?: string; company_id?: string }) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToTrips,
  onNavigateToReports,
}) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedSandType, setSelectedSandType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const [companies, setCompanies] = useState<ConstructionCompany[]>([]);
  const [showSandInfoModal, setShowSandInfoModal] = useState(false);

  useEffect(() => {
    api.getCompanies().then(setCompanies).catch(() => {});
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
  };

  const loadDashboard = () => {
    setIsLoading(true);
    api.getDashboardAnalytics({
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      company_id: selectedCompanyId || undefined,
      sand_type: (selectedSandType as SandType) || undefined,
      status: (selectedStatus as TripStatus) || undefined,
    })
      .then(setData)
      .catch((err) => console.error('Failed to load dashboard data', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, [startDate, endDate, selectedCompanyId, selectedSandType, selectedStatus]);

  const kpi: DashboardKPI = data?.kpi || {
    totalTrips: 0,
    fullySuccessfulTrips: 0,
    partiallyDeliveredTrips: 0,
    unsuccessfulTrips: 0,
    activePendingTrips: 0,
    cancelledTrips: 0,
    totalLoadedM3: 0,
    totalDeliveredM3: 0,
    totalOutstandingM3: 0,
    distinctTrucksCount: 0,
    totalRevenueEtb: 0,
    totalCostEtb: 0,
    grossProfitEtb: 0,
    shortageLossEtb: 0,
    totalTransportFeesEtb: 0,
    avgTransportFeePerTruckEtb: 0,
    avgTransportRatePerM3Etb: 0,
    avgRevenuePerTruckEtb: 0,
    avgCostPerTruckEtb: 0,
    avgProfitPerTruckEtb: 0,
    avgSellingPricePerM3Etb: 0,
    avgCostPricePerM3Etb: 0,
  };

  const today = data?.todaySummary;

  return (
    <div className="space-y-6">
      {/* Real-Time Operational Shift Summary Widget */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-xl border border-slate-800 shadow-md p-5 space-y-4">
        {/* Widget Header & Live Pulse Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <Activity className="w-4 h-4 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full"></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-white">
                  Real-Time Trip Registry Summary
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                  Live Dispatch Feed
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Operational Shift: <span className="text-slate-200 font-mono font-semibold">{today?.date || new Date().toISOString().split('T')[0]}</span>
                {today?.isToday ? ' (Today)' : ' (Latest Operational Log)'} • Continuous live trip telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              onClick={() => setShowSandInfoModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span>Sand Grade Specs</span>
            </button>
            <button
              onClick={loadDashboard}
              className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => onNavigateToTrips({ start_date: today?.date, end_date: today?.date })}
              className="text-xs font-mono font-bold text-amber-400 hover:text-amber-300 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span>View Today's Dispatches</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3 Core Requested Real-Time KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* KPI 1: Total Trips Today */}
          <div
            onClick={() => onNavigateToTrips({ start_date: today?.date, end_date: today?.date })}
            className="group bg-slate-800/80 hover:bg-slate-800 p-4 rounded-xl border border-slate-700/80 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 group-hover:text-amber-400 transition-colors">
                Total Trips Today
              </span>
              <div className="w-7 h-7 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Route className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-white tabular-nums tracking-tight">
                {today?.totalTripsToday ?? 0}
              </span>
              <span className="text-xs font-mono text-slate-400">dispatches</span>
            </div>

            {/* Micro status breakdown pill strip */}
            <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center gap-2 flex-wrap text-[11px] font-mono">
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>{today?.deliveredTodayTrips ?? 0} Delivered</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="inline-flex items-center gap-1 text-blue-400">
                <Clock className="w-3 h-3" />
                <span>{today?.activeInTransitTrips ?? 0} In-Transit</span>
              </span>
              {(today?.partialTodayTrips ?? 0) > 0 && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="inline-flex items-center gap-1 text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{today?.partialTodayTrips} Partial</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* KPI 2: Active Trucks */}
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Active Trucks
              </span>
              <div className="w-7 h-7 rounded-md bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Truck className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-blue-400 tabular-nums tracking-tight">
                {today?.activeTrucks ?? 0}
              </span>
              <span className="text-xs font-mono text-slate-400">
                units deployed today
              </span>
            </div>

            {/* Fleet Mobilization ratio & progress */}
            <div className="mt-3 pt-2.5 border-t border-slate-700/60 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                <span>Fleet Mobilization</span>
                <span className="font-bold text-blue-300">
                  {today?.activeTrucks ?? 0} / {today?.totalFleetTrucks ?? 30} ({today?.fleetUtilizationPercent ?? 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-700/80 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(today?.fleetUtilizationPercent ?? 0, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* KPI 3: Total Daily Load */}
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Total Daily Load
              </span>
              <div className="w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Boxes className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-emerald-400 tabular-nums tracking-tight">
                {(today?.totalDailyLoadM3 ?? 0).toFixed(2)}
              </span>
              <span className="text-xs font-mono text-slate-400">m³ loaded</span>
            </div>

            {/* Delivered Volume & Fulfillment Rate */}
            <div className="mt-3 pt-2.5 border-t border-slate-700/60 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                <span>Delivered Volume</span>
                <span className="font-bold text-emerald-300">
                  {(today?.totalDailyDeliveredM3 ?? 0).toFixed(2)} m³ ({today?.deliveryFulfillmentPercent ?? 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-700/80 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(today?.deliveryFulfillmentPercent ?? 0, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Recent Dispatches Row (Real-time activity ticker) */}
        {today?.recentTodayTrips && today.recentTodayTrips.length > 0 && (
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                Recent Live Dispatches This Shift
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Latest {today.recentTodayTrips.length} active units
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {today.recentTodayTrips.map((tr) => (
                <div
                  key={tr.id}
                  onClick={() => onNavigateToTrips({ search: tr.truck_plate })}
                  className="bg-slate-800/60 hover:bg-slate-800 p-2.5 rounded-lg border border-slate-700/60 hover:border-slate-600 transition-colors cursor-pointer text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-amber-300">{tr.truck_plate}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                        tr.status === 'Delivered'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : tr.status === 'Partially Delivered'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-blue-950 text-blue-400 border border-blue-800'
                      }`}
                    >
                      {tr.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1 truncate">
                    {tr.loading_location_name} → {tr.unloading_location_name}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1.5 pt-1 border-t border-slate-700/40">
                    <span>Sand {tr.sand_type}</span>
                    <span className="font-bold text-slate-200">{tr.quantity_loaded_m3} m³</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Date & Dimension Filters Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider">
              Reporting Scope
            </span>
          </div>
          {/* Quick Date Segmented Control */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-medium self-start sm:self-auto overflow-x-auto max-w-full">
            {(['all', 'today', 'yesterday', 'week', 'month'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => handleDatePreset(preset)}
                className={`px-3 py-1 rounded transition-colors whitespace-nowrap capitalize cursor-pointer ${
                  datePreset === preset
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset === 'all' ? 'All Time' : preset === 'week' ? 'This Week' : preset === 'month' ? 'This Month' : preset}
              </button>
            ))}
          </div>
          {/* Custom Date Pickers */}
          <div className="flex items-center gap-1 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset('all');
              }}
              className="text-xs font-mono px-2 py-1.5 bg-slate-50 border border-slate-300 rounded"
              title="Start Date"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset('all');
              }}
              className="text-xs font-mono px-2 py-1.5 bg-slate-50 border border-slate-300 rounded"
              title="End Date"
            />
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Construction Company</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white"
            >
              <option value="">All Construction Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Sand Type Category</label>
            <select
              value={selectedSandType}
              onChange={(e) => setSelectedSandType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white font-mono"
            >
              <option value="">All Grades (00, 01, 02)</option>
              <option value="00">Category 00 - Fine Sand</option>
              <option value="01">Category 01 - Medium Sand</option>
              <option value="02">Category 02 - Coarse Sand</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Trip Outcome / Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white"
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
          </div>
        </div>
      </div>

      {/* KPI Cards: Distinct Trip Counts vs Material Quantities */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>OPERATIONAL DISPATCH SUMMARY</span>
          <span>STRICT SEPARATION: TRIP COUNTS VS CUBIC METERS</span>
        </div>

        {/* Section A: Material Quantities in m³ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
              Total Sand Delivered
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
                {kpi.totalDeliveredM3.toFixed(2)}
              </span>
              <span className="text-xs font-mono font-semibold text-slate-400">m³</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Verified on site receipts &amp; tickets
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
              Total Sand Loaded
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {kpi.totalLoadedM3.toFixed(2)}
              </span>
              <span className="text-xs font-mono font-semibold text-slate-400">m³</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Origin pit &amp; depot scale measurements
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
              Outstanding / Undelivered
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className={`text-2xl font-bold font-mono tabular-nums ${kpi.totalOutstandingM3 > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                {kpi.totalOutstandingM3.toFixed(2)}
              </span>
              <span className="text-xs font-mono font-semibold text-slate-400">m³</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              In-transit balance or delivery shortages
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
              External Trucks Active
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {kpi.distinctTrucksCount}
              </span>
              <Truck className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Independent fleet units mobilized
            </div>
          </div>
        </div>

        {/* Section B: Trip Counts by Outcome */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className="text-[11px] text-slate-500 font-medium truncate">Total Trips</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
              {kpi.totalTrips}
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-emerald-200 bg-emerald-50/20 shadow-2xs">
            <div className="text-[11px] text-emerald-800 font-medium truncate flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Delivered (Full)</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
              {kpi.fullySuccessfulTrips}
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-amber-200 bg-amber-50/20 shadow-2xs">
            <div className="text-[11px] text-amber-800 font-medium truncate flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Partial Trips</span>
            </div>
            <div className="text-xl font-bold font-mono text-amber-700 mt-1 tabular-nums">
              {kpi.partiallyDeliveredTrips}
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-red-200 bg-red-50/20 shadow-2xs">
            <div className="text-[11px] text-red-800 font-medium truncate flex items-center gap-1">
              <XCircle className="w-3 h-3 text-red-600" />
              <span>Unsuccessful</span>
            </div>
            <div className="text-xl font-bold font-mono text-red-700 mt-1 tabular-nums">
              {kpi.unsuccessfulTrips}
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-sky-200 bg-sky-50/20 shadow-2xs">
            <div className="text-[11px] text-sky-800 font-medium truncate flex items-center gap-1">
              <Clock className="w-3 h-3 text-sky-600" />
              <span>Active Pending</span>
            </div>
            <div className="text-xl font-bold font-mono text-sky-700 mt-1 tabular-nums">
              {kpi.activePendingTrips}
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className="text-[11px] text-slate-500 font-medium truncate">Cancelled</div>
            <div className="text-xl font-bold font-mono text-slate-500 mt-1 tabular-nums">
              {kpi.cancelledTrips}
            </div>
          </div>
        </div>
      </div>

      {/* Operational Alerts Widget */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
              Operational Exception Alerts &amp; Action Required
            </h3>
          </div>
          <button
            onClick={() => onNavigateToReports('exceptions')}
            className="text-xs text-amber-700 hover:text-amber-800 font-medium cursor-pointer"
          >
            View Full Exception Report →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded border border-sky-100 bg-sky-50/40 text-xs space-y-1.5">
            <div className="font-semibold text-sky-900 flex items-center justify-between">
              <span>Pending Trips Needing Delivery Update</span>
              <span className="font-mono bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded text-[10px]">
                {data?.alerts.pending.length || 0}
              </span>
            </div>
            {data?.alerts.pending.length === 0 ? (
              <p className="text-slate-500 text-[11px]">No overdue pending dispatches.</p>
            ) : (
              <div className="space-y-1">
                {data?.alerts.pending.slice(0, 2).map((a: any) => (
                  <div key={a.id} className="text-[11px] text-slate-700 flex justify-between">
                    <span className="font-mono">{a.id} ({a.truck_plate})</span>
                    <span className="text-slate-500">{a.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 rounded border border-amber-100 bg-amber-50/40 text-xs space-y-1.5">
            <div className="font-semibold text-amber-900 flex items-center justify-between">
              <span>Partial Deliveries Requiring Review</span>
              <span className="font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px]">
                {data?.alerts.partial.length || 0}
              </span>
            </div>
            {data?.alerts.partial.length === 0 ? (
              <p className="text-slate-500 text-[11px]">All delivered trips balanced.</p>
            ) : (
              <div className="space-y-1">
                {data?.alerts.partial.slice(0, 2).map((a: any) => (
                  <div key={a.id} className="text-[11px] text-slate-700 flex justify-between">
                    <span className="font-mono">{a.id}</span>
                    <span className="font-mono text-amber-800 font-bold">
                      -{a.quantity_remaining_m3} m³ shortage
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 rounded border border-red-100 bg-red-50/40 text-xs space-y-1.5">
            <div className="font-semibold text-red-900 flex items-center justify-between">
              <span>Unsuccessful Deliveries / Returns</span>
              <span className="font-mono bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-[10px]">
                {data?.alerts.unsuccessful.length || 0}
              </span>
            </div>
            {data?.alerts.unsuccessful.length === 0 ? (
              <p className="text-slate-500 text-[11px]">No failed trips in current window.</p>
            ) : (
              <div className="space-y-1">
                {data?.alerts.unsuccessful.slice(0, 2).map((a: any) => (
                  <div key={a.id} className="text-[11px] text-slate-700 truncate">
                    <span className="font-mono">{a.id}</span>: {a.status_reason || a.delivery_outcome}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivered Sand Volume by Type (00, 01, 02) */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Delivered Volume by Sand Category</h3>
              <p className="text-xs text-slate-500">Strict separation for grades 00, 01, and 02</p>
            </div>
            <button
              onClick={() => onNavigateToReports('sand-type')}
              className="text-xs text-amber-700 hover:text-amber-800 font-medium cursor-pointer"
            >
              Report Details →
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(data?.sandBreakdown || []).map((sb) => {
              return (
                <div key={sb.sand_type} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-1">
                  <div className="inline-block px-2 py-0.5 bg-amber-500 text-slate-950 font-mono font-bold text-xs rounded">
                    Grade {sb.sand_type}
                  </div>
                  <div className="text-lg font-bold font-mono text-slate-900 tabular-nums pt-1">
                    {sb.delivered_m3.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">m³ Delivered</div>
                  <div className="pt-2 text-[11px] text-slate-600">
                    <span className="font-mono font-semibold">{sb.trip_count}</span> trips
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">Sand Category Code Guide:</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div><strong className="font-mono text-slate-900">00:</strong> Fine Mortar / Masonry Sand</div>
              <div><strong className="font-mono text-slate-900">01:</strong> Medium Washed Concrete Sand</div>
              <div><strong className="font-mono text-slate-900">02:</strong> Coarse Road Bedding Sand</div>
            </div>
          </div>
        </div>

        {/* Top Truck Delivery Performance with direct link to Truck Dossier */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Top External Truck Performance</h3>
              <p className="text-xs text-slate-500">Click any truck to open its dedicated Audit Dossier</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateToReports('truck_dossier', { truck_id: 'all' })}
                className="text-xs text-amber-900 hover:text-amber-950 font-bold bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded border border-amber-300 transition-colors cursor-pointer"
                title="View consolidated report of all trucks in once"
              >
                All Trucks in Once →
              </button>
            </div>
          </div>
          <div className="space-y-2.5">
            {(data?.truckPerformance || []).length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-mono">No truck records found.</div>
            ) : (
              (data?.truckPerformance || []).map((tp) => {
                const maxVol = Math.max(...(data?.truckPerformance || []).map(t => t.delivered_m3), 1);
                const barWidth = Math.min(Math.round((tp.delivered_m3 / maxVol) * 100), 100);
                return (
                  <div
                    key={tp.truck_plate}
                    className="p-2 rounded hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                    onClick={() => onNavigateToReports('truck_dossier', { truck_id: tp.truck_id || tp.truck_plate })}
                    title={`View specific truck report dossier for ${tp.truck_plate}`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {tp.truck_plate}
                        </span>
                        <span className="text-slate-600 truncate max-w-[150px]">{tp.truck_owner}</span>
                        <span className="text-[10px] text-amber-700 font-semibold underline">Dossier →</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="font-bold text-slate-900 tabular-nums">{tp.delivered_m3.toFixed(2)} m³</span>
                        <span className="text-slate-400">({tp.total_trips} trips)</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Construction Company Delivery Volumes */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Volumes by Construction Client</h3>
              <p className="text-xs text-slate-500">Delivered cubic meters per client enterprise</p>
            </div>
            <button
              onClick={() => onNavigateToReports('companies_projects')}
              className="text-xs text-amber-700 hover:text-amber-800 font-medium cursor-pointer"
            >
              Client Report →
            </button>
          </div>
          <div className="space-y-2.5">
            {(data?.companyVolumes || []).map((cv) => (
              <div key={cv.company_name} className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-100 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-semibold text-slate-900 truncate">{cv.company_name}</span>
                </div>
                <div className="flex items-center gap-3 font-mono shrink-0">
                  <span className="text-slate-500">{cv.trip_count} trips</span>
                  <span className="font-bold text-slate-900 tabular-nums">{cv.delivered_m3.toFixed(2)} m³</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Destination Projects (Unloading Volume) */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Destination Projects (Unloading Volume)</h3>
              <p className="text-xs text-slate-500">Active project jobsites where sand is unloaded</p>
            </div>
            <button
              onClick={() => onNavigateToReports('destinations')}
              className="text-xs text-amber-700 hover:text-amber-800 font-medium cursor-pointer"
            >
              Project Deliveries Report →
            </button>
          </div>
          <div className="space-y-2.5">
            {(data?.destinationVolumes || []).map((dv) => (
              <div key={dv.unloading_location_name} className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-100 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="font-semibold text-slate-900 truncate">{dv.unloading_location_name}</span>
                </div>
                <div className="flex items-center gap-3 font-mono shrink-0">
                  <span className="text-slate-500">{dv.trip_count} trips</span>
                  <span className="font-bold text-slate-900 tabular-nums">{dv.delivered_m3.toFixed(2)} m³</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Transport Routes: Rate ETB/m³ and Total Fee / Truck */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Transport Fee Breakdown by Corridor (Crusher → Destination Project)
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Fixed corridor tariffs, ETB per m³, and total payout per truck
              </p>
            </div>
            <button
              onClick={() => onNavigateToReports('financial')}
              className="text-xs font-mono font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer self-start sm:self-auto"
            >
              Full Financial Report →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-mono border-b border-slate-200">
                  <th className="py-2.5 px-3">Haul Corridor (Crusher → Destination)</th>
                  <th className="py-2.5 px-3 text-center">Distance</th>
                  <th className="py-2.5 px-3 text-right">Fixed Rate (ETB/m³)</th>
                  <th className="py-2.5 px-3 text-right">Trips</th>
                  <th className="py-2.5 px-3 text-right">Volume (m³)</th>
                  <th className="py-2.5 px-3 text-right">Avg Fee / Truck</th>
                  <th className="py-2.5 px-3 text-right text-emerald-900 font-bold">Total Fees (ETB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {(data?.topRoutes || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-400 font-sans">
                      No route transport records yet for this period.
                    </td>
                  </tr>
                ) : (
                  (data?.topRoutes || []).map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-sans">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900">{r.origin_name || 'Crusher'}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-blue-700 font-semibold">{r.destination_name || 'Destination Project'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500">
                        {r.distance_km ? `${r.distance_km} km` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-700 font-bold">
                        {r.rate_per_m3_etb ? `${r.rate_per_m3_etb.toFixed(2)} ETB/m³` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {r.trip_count}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-900 font-bold">
                        {(r.total_delivered_m3 || 0).toFixed(2)} m³
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-800">
                        {(r.avg_fee_per_truck_etb || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {(r.total_transport_fee_etb || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sand Grade Specs Modal */}
      {showSandInfoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Sand Category Quality Specifications</h3>
              <button
                onClick={() => setShowSandInfoModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <div className="font-mono font-bold text-slate-900 text-sm">Grade 00</div>
                  <div className="font-semibold text-amber-700">Fine Masonry Sand</div>
                  <p className="text-slate-600 text-[11px]">
                    0.1mm - 0.6mm grain size. Used for brick mortar, plaster finishing, and delicate compaction bedding.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <div className="font-mono font-bold text-slate-900 text-sm">Grade 01</div>
                  <div className="font-semibold text-amber-700">Medium Washed Sand</div>
                  <p className="text-slate-600 text-[11px]">
                    0.3mm - 2.5mm grain size. Standard washed concrete mix aggregate and structural slab foundations.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <div className="font-mono font-bold text-slate-900 text-sm">Grade 02</div>
                  <div className="font-semibold text-amber-700">Coarse Bedding Sand</div>
                  <p className="text-slate-600 text-[11px]">
                    0.5mm - 5.0mm grain size. Road sub-base compaction, utility trench backfill, and paving base.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setShowSandInfoModal(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 cursor-pointer"
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
