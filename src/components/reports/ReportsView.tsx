import React, { useState, useEffect, useMemo } from 'react';
import {
  FileBarChart,
  Download,
  Printer,
  Calendar,
  Truck as TruckIcon,
  Building2,
  MapPin,
  Layers,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Scale,
  FileText,
  TrendingUp,
  Clock,
  ShieldAlert,
  Route,
  DollarSign,
  FileSpreadsheet,
  FileDown,
  Phone,
  PhoneCall,
  ChevronDown,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { api } from '../../lib/api';
import {
  exportToCsv,
  exportToPdf,
  exportTruckDossierPdf,
  exportRegisteredTripsAndTrucksPdf,
  exportTruckTransportPivotPdf,
  ExportColumn
} from '../../lib/exportUtils';
import { CompanyDetailModal } from '../companies/CompanyDetailModal';
import { ProjectDetailModal } from '../projects/ProjectDetailModal';
import { CrusherDetailModal } from '../locations/CrusherDetailModal';
import { TripDetailModal } from '../trips/TripDetailModal';
import { TruckTransportPivotReportView } from './TruckTransportPivotReportView';
import {
  Truck,
  ConstructionCompany,
  Location,
  SandType,
  TripStatus,
  SpecificTruckDossier,
  SpecificCompanyDossier,
  FinancialReportData,
  TruckTransportPivotData
} from '../../types';

export type ReportType =
  | 'truck_transport_pivot'
  | 'trips_and_trucks'
  | 'financial'
  | 'truck_dossier'
  | 'company_dossier'
  | 'truck_performance'
  | 'sand_type'
  | 'destinations'
  | 'loading_points'
  | 'companies_projects'
  | 'time_summary'
  | 'detailed_register'
  | 'exceptions';

interface ReportsViewProps {
  initialReportType?: ReportType;
  initialTruckId?: string;
  initialCompanyId?: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  initialReportType = 'trips_and_trucks',
  initialTruckId,
  initialCompanyId
}) => {
  const [activeReport, setActiveReport] = useState<ReportType>(initialReportType);

  // Universal Filters
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTruckId, setSelectedTruckId] = useState<string>(initialTruckId || '');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompanyId || '');
  const [selectedSandType, setSelectedSandType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [timePeriod, setTimePeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [tableSearch, setTableSearch] = useState('');

  // Support entities for dropdowns
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [companies, setCompanies] = useState<ConstructionCompany[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Premier Registered Trips & Truck Performance State
  const [registeredTripsList, setRegisteredTripsList] = useState<any[]>([]);
  const [truckPerformanceList, setTruckPerformanceList] = useState<any[]>([]);
  const [tripsAndTrucksMode, setTripsAndTrucksMode] = useState<'matrix' | 'trips' | 'combined'>('matrix');
  const [expandedTruckPlate, setExpandedTruckPlate] = useState<string | null>(null);

  // Detail Popups
  const [viewingCompanyId, setViewingCompanyId] = useState<string | null>(null);
  const [viewingProjectId, setViewingProjectId] = useState<string | null>(null);
  const [viewingCrusherId, setViewingCrusherId] = useState<string | null>(null);
  const [viewingTripId, setViewingTripId] = useState<string | null>(null);

  // General Tabular Report Data
  const [reportData, setReportData] = useState<any[]>([]);
  // Specific Truck Dossier State
  const [truckDossier, setTruckDossier] = useState<SpecificTruckDossier | null>(null);
  // Specific Company Dossier State
  const [companyDossier, setCompanyDossier] = useState<SpecificCompanyDossier | null>(null);
  // Financial & Transport Report Data
  const [financialData, setFinancialData] = useState<FinancialReportData | null>(null);
  // Hired Trucks & Transport Fees Pivot State
  const [pivotData, setPivotData] = useState<TruckTransportPivotData | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // Load support entities
  useEffect(() => {
    Promise.all([
      api.getTrucks(),
      api.getCompanies(),
      api.getLocations(),
    ]).then(([trks, comps, locs]) => {
      setTrucks(trks);
      setCompanies(comps);
      setLocations(locs);

      // Default selected truck to 'all' or initialTruckId
      if (!selectedTruckId) {
        setSelectedTruckId(initialTruckId || 'all');
      }
      if (!selectedCompanyId && comps.length > 0) {
        setSelectedCompanyId(initialCompanyId || comps[0].id);
      }
    }).catch(err => console.error('Failed to load support data', err));
  }, []);

  // Sync prop changes
  useEffect(() => {
    if (initialReportType) setActiveReport(initialReportType);
    if (initialTruckId) setSelectedTruckId(initialTruckId);
    if (initialCompanyId) setSelectedCompanyId(initialCompanyId);
  }, [initialReportType, initialTruckId, initialCompanyId]);

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

  const loadCurrentReport = () => {
    setIsLoading(true);
    const filters = {
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      truck_id: (activeReport !== 'truck_dossier' && selectedTruckId && selectedTruckId !== 'all') ? selectedTruckId : undefined,
      company_id: (activeReport !== 'company_dossier' && selectedCompanyId && selectedCompanyId !== 'all') ? selectedCompanyId : undefined,
      sand_type: (selectedSandType as SandType) || undefined,
      status: (selectedStatus as TripStatus) || undefined,
    };

    if (activeReport === 'truck_transport_pivot') {
      api.getTruckTransportPivotReport(filters)
        .then(setPivotData)
        .catch(err => console.error('Failed to load truck transport pivot report', err))
        .finally(() => setIsLoading(false));
      return;
    }

    if (activeReport === 'trips_and_trucks') {
      Promise.all([
        api.getTruckPerformanceReport(filters),
        api.getDetailedRegisterReport(filters),
      ])
        .then(([perf, trips]) => {
          setTruckPerformanceList(perf);
          setRegisteredTripsList(trips);
        })
        .catch(err => console.error('Failed to load trips and truck performance', err))
        .finally(() => setIsLoading(false));
      return;
    }

    if (activeReport === 'truck_dossier') {
      const trkToFetch = selectedTruckId || 'all';
      api.getSingleTruckReport(trkToFetch, filters)
        .then(setTruckDossier)
        .catch(err => console.error('Failed to load truck dossier', err))
        .finally(() => setIsLoading(false));
      return;
    }

    if (activeReport === 'company_dossier') {
      if (!selectedCompanyId) {
        setIsLoading(false);
        return;
      }
      api.getSingleCompanyReport(selectedCompanyId, filters)
        .then(setCompanyDossier)
        .catch(err => console.error('Failed to load company dossier', err))
        .finally(() => setIsLoading(false));
      return;
    }

    if (activeReport === 'financial') {
      api.getFinancialReport(filters)
        .then(setFinancialData)
        .catch(err => console.error('Failed to load financial report', err))
        .finally(() => setIsLoading(false));
      return;
    }

    let fetcher: Promise<any[]>;
    switch (activeReport) {
      case 'truck_performance':
        fetcher = api.getTruckPerformanceReport(filters);
        break;
      case 'sand_type':
        fetcher = api.getSandTypeReport(filters);
        break;
      case 'destinations':
        fetcher = api.getDestinationReport(filters);
        break;
      case 'loading_points':
        fetcher = api.getLoadingPointReport(filters);
        break;
      case 'companies_projects':
        fetcher = api.getCompanyProjectReport(filters);
        break;
      case 'time_summary':
        fetcher = api.getTimeSummaryReport(filters, timePeriod);
        break;
      case 'detailed_register':
        fetcher = api.getDetailedRegisterReport(filters);
        break;
      case 'exceptions':
        fetcher = api.getExceptionsReport(filters);
        break;
      default:
        fetcher = Promise.resolve([]);
    }

    fetcher
      .then(setReportData)
      .catch((err) => console.error('Failed to load report', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadCurrentReport();
  }, [
    activeReport,
    selectedTruckId,
    selectedCompanyId,
    startDate,
    endDate,
    selectedSandType,
    selectedStatus,
    timePeriod
  ]);

  // Filtered trips and trucks for Premier Trips & Truck Performance Report
  const filteredRegisteredTrips = useMemo(() => {
    if (!tableSearch.trim()) return registeredTripsList;
    const term = tableSearch.toLowerCase();
    return registeredTripsList.filter(t => {
      return Object.values(t).some(
        val => val !== null && val !== undefined && String(val).toLowerCase().includes(term)
      );
    });
  }, [registeredTripsList, tableSearch]);

  const filteredTruckPerformance = useMemo(() => {
    if (!tableSearch.trim()) return truckPerformanceList;
    const term = tableSearch.toLowerCase();
    return truckPerformanceList.filter(t => {
      return Object.values(t).some(
        val => val !== null && val !== undefined && String(val).toLowerCase().includes(term)
      );
    });
  }, [truckPerformanceList, tableSearch]);

  const tripsAndTrucksKpis = useMemo(() => {
    const totalTrips = registeredTripsList.length;
    const totalLoaded = registeredTripsList.reduce((acc, t) => acc + (Number(t.quantity_loaded_m3) || 0), 0);
    const totalDelivered = registeredTripsList.reduce((acc, t) => acc + (Number(t.quantity_delivered_m3) || 0), 0);
    const totalShortage = Number((totalLoaded - totalDelivered).toFixed(2));
    const successfulTrips = registeredTripsList.filter(t => t.status === 'Delivered').length;
    const partialTrips = registeredTripsList.filter(t => t.status === 'Partially Delivered').length;
    const unsuccessfulTrips = registeredTripsList.filter(t => t.status === 'Unsuccessful').length;
    const eligible = successfulTrips + partialTrips + unsuccessfulTrips;
    const successRate = eligible > 0
      ? Number(((successfulTrips / eligible) * 100).toFixed(1))
      : 100.0;
    const distinctTrucks = truckPerformanceList.length || trucks.length;
    return {
      totalTrips,
      totalLoaded,
      totalDelivered,
      totalShortage,
      successfulTrips,
      partialTrips,
      unsuccessfulTrips,
      successRate,
      distinctTrucks
    };
  }, [registeredTripsList, truckPerformanceList, trucks]);

  // Column definitions for general tabular reports
  const getColumnsForActiveReport = (): ExportColumn[] => {
    switch (activeReport) {
      case 'truck_performance':
        return [
          { header: 'Plate Number', key: 'truck_plate' },
          { header: 'Truck Owner', key: 'truck_owner' },
          { header: 'Total Trips', key: 'total_trips' },
          { header: 'Successful', key: 'successful_trips' },
          { header: 'Partial', key: 'partial_trips' },
          { header: 'Unsuccessful', key: 'unsuccessful_trips' },
          { header: 'Cancelled', key: 'cancelled_trips' },
          { header: 'Pending', key: 'pending_trips' },
          { header: 'Loaded (m³)', key: 'total_loaded_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Delivered (m³)', key: 'total_delivered_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Shortage (m³)', key: 'total_shortage_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 00 (m³)', key: 'delivered_sand_00', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 01 (m³)', key: 'delivered_sand_01', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 02 (m³)', key: 'delivered_sand_02', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Outcome Success Rate', key: 'success_rate_label' },
        ];
      case 'sand_type':
        return [
          { header: 'Sand Category', key: 'sand_type', format: (v) => `Grade ${v}` },
          { header: 'Total Trips', key: 'total_trips' },
          { header: 'Loaded (m³)', key: 'total_loaded_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Delivered (m³)', key: 'total_delivered_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Shortage (m³)', key: 'total_not_delivered_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Successful Deliveries', key: 'successful_trips' },
          { header: 'Partial Deliveries', key: 'partial_trips' },
          { header: 'Unsuccessful', key: 'unsuccessful_trips' },
        ];
      case 'destinations':
        return [
          { header: 'Destination', key: 'unloading_location_name' },
          { header: 'Total Trips', key: 'total_trips' },
          { header: 'Delivered (m³)', key: 'total_delivered_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 00 (m³)', key: 'delivered_sand_00', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 01 (m³)', key: 'delivered_sand_01', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 02 (m³)', key: 'delivered_sand_02', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Successful', key: 'successful_trips' },
          { header: 'Partial', key: 'partial_trips' },
          { header: 'Unsuccessful', key: 'unsuccessful_trips' },
          { header: 'Companies Served', key: 'companies_served' },
        ];
      case 'loading_points':
        return [
          { header: 'Loading Point', key: 'loading_location_name' },
          { header: 'Trips Loaded', key: 'total_trips' },
          { header: 'Loaded (m³)', key: 'total_loaded_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Delivered (m³)', key: 'total_delivered_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 00 (m³)', key: 'loaded_sand_00', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 01 (m³)', key: 'loaded_sand_01', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 02 (m³)', key: 'loaded_sand_02', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Successful', key: 'successful_trips' },
          { header: 'Partial', key: 'partial_trips' },
          { header: 'Unsuccessful', key: 'unsuccessful_trips' },
        ];
      case 'companies_projects':
        return [
          { header: 'Company Name', key: 'company_name' },
          { header: 'Project / Site', key: 'project_name' },
          { header: 'Total Trips', key: 'total_trips' },
          { header: 'Loaded (m³)', key: 'total_loaded_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Delivered (m³)', key: 'total_delivered_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Shortage (m³)', key: 'total_shortage_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 00 (m³)', key: 'delivered_sand_00', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 01 (m³)', key: 'delivered_sand_01', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 02 (m³)', key: 'delivered_sand_02', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Trucks Used', key: 'distinct_trucks_used' },
          { header: 'Successful', key: 'successful_trips' },
          { header: 'Partial', key: 'partial_trips' },
        ];
      case 'time_summary':
        return [
          { header: 'Period', key: 'period_label' },
          { header: 'Trips', key: 'total_trips' },
          { header: 'Successful', key: 'successful_trips' },
          { header: 'Partial', key: 'partial_trips' },
          { header: 'Unsuccessful', key: 'unsuccessful_trips' },
          { header: 'Pending', key: 'pending_trips' },
          { header: 'Cancelled', key: 'cancelled_trips' },
          { header: 'Loaded (m³)', key: 'total_loaded_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Delivered (m³)', key: 'total_delivered_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Shortage (m³)', key: 'total_shortage_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 00 (m³)', key: 'delivered_sand_00', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 01 (m³)', key: 'delivered_sand_01', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 02 (m³)', key: 'delivered_sand_02', format: (v) => Number(v || 0).toFixed(2) },
        ];
      case 'detailed_register':
        return [
          { header: 'Trip ID', key: 'id' },
          { header: 'Date', key: 'trip_date' },
          { header: 'Plate', key: 'truck_plate' },
          { header: 'Owner', key: 'truck_owner' },
          { header: 'Company', key: 'company_name' },
          { header: 'Destination Project', key: 'project_name' },
          { header: 'Crusher (Loading)', key: 'loading_location_name' },
          { header: 'Destination (Unloading)', key: 'unloading_location_name' },
          { header: 'Grade', key: 'sand_type' },
          { header: 'Loaded (m³)', key: 'quantity_loaded_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Delivered (m³)', key: 'quantity_delivered_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Rate (ETB/m³)', key: 'transport_rate_etb_per_m3', format: (v) => v ? Number(v).toFixed(2) : '450.00' },
          { header: 'Total Fee / Truck (ETB)', key: 'total_transport_fee_etb', format: (v) => v ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00' },
          { header: 'Status', key: 'status' },
          { header: 'POD Ref', key: 'delivery_proof_ref' },
          { header: 'Notes', key: 'notes' },
        ];
      case 'exceptions':
        return [
          { header: 'Trip ID', key: 'id' },
          { header: 'Date', key: 'trip_date' },
          { header: 'Exception Type', key: 'exception_type' },
          { header: 'Truck Plate', key: 'truck_plate' },
          { header: 'Client', key: 'company_name' },
          { header: 'Loaded (m³)', key: 'quantity_loaded_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Delivered (m³)', key: 'quantity_delivered_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Shortage (m³)', key: 'quantity_remaining_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Truck Cap (m³)', key: 'truck_capacity_m3', format: (v) => v ? Number(v).toFixed(2) : 'N/A' },
          { header: 'Status', key: 'status' },
          { header: 'Explanation Reason', key: 'status_reason' },
        ];
      default:
        return [];
    }
  };

  const getReportTitle = () => {
    switch (activeReport) {
      case 'truck_transport_pivot':
        return 'Hired Trucks Trip History & Calculated Transport Fees (Pivoted by Truck Plate)';
      case 'trips_and_trucks':
        return 'Report: Registered Trips & Hired Truck Performance (Unified Ledger)';
      case 'financial':
        return 'Financial & Transport Fee Analytics Report (ETB / Fixed Corridor Tariffs)';
      case 'truck_dossier':
        return (truckDossier?.isAllTrucks || selectedTruckId === 'all')
          ? 'Report: Consolidated All Trucks Fleet Report (All in Once)'
          : `Report: Specific Truck Audit Dossier (${truckDossier?.truck?.plate_number || selectedTruckId || 'Select Truck'})`;
      case 'company_dossier':
        return (selectedCompanyId === 'all')
          ? 'Report: Consolidated Client Delivery Report (All Clients)'
          : `Report: Specific Construction Client Dossier (${companyDossier?.company?.name || selectedCompanyId || 'Select Client'})`;
      case 'truck_performance':
        return 'Report: External Hired Truck Performance & Outcome Rates';
      case 'sand_type':
        return 'Report: Sand Type Material Category Analysis (00, 01, 02)';
      case 'destinations':
        return 'Report: Destination Projects (Unloading Delivery Volumes)';
      case 'loading_points':
        return 'Report: Crusher Sites Sand Loading & Dispatch Activity';
      case 'companies_projects':
        return 'Report: Construction Companies & Project Deliveries';
      case 'time_summary':
        return `Report: ${timePeriod.toUpperCase()} Delivery Volume & Trip Summary`;
      case 'detailed_register':
        return 'Report: Detailed Unified Trip Register';
      case 'exceptions':
        return 'Report: Operational Incomplete & Exception Audit';
    }
  };

  const getFilterSummary = () => {
    const parts = [];
    if (startDate || endDate) {
      parts.push(`Date Range: ${startDate || 'Start'} to ${endDate || 'End'}`);
    } else {
      parts.push('Period: All Time');
    }
    if (activeReport === 'truck_dossier') {
      if (truckDossier?.isAllTrucks || selectedTruckId === 'all') {
        parts.push(`Truck Scope: All Trucks Combined (Consolidated Fleet)`);
      } else if (truckDossier?.truck) {
        parts.push(`Truck: ${truckDossier.truck.plate_number} (${truckDossier.truck.owner_name})`);
      }
    } else if (selectedTruckId && selectedTruckId !== 'all') {
      const t = trucks.find(trk => trk.id === selectedTruckId);
      parts.push(`Truck Filter: ${t ? t.plate_number : selectedTruckId}`);
    } else if (selectedTruckId === 'all') {
      parts.push(`Truck Filter: All Trucks`);
    }
    if (activeReport === 'company_dossier') {
      if (selectedCompanyId === 'all') {
        parts.push(`Client Scope: All Clients Combined`);
      } else if (companyDossier?.company) {
        parts.push(`Client: ${companyDossier.company.name}`);
      }
    } else if (selectedCompanyId && selectedCompanyId !== 'all') {
      const c = companies.find(comp => comp.id === selectedCompanyId);
      parts.push(`Company: ${c ? c.name : selectedCompanyId}`);
    }
    if (selectedSandType) parts.push(`Sand Grade: ${selectedSandType}`);
    if (selectedStatus) parts.push(`Status: ${selectedStatus}`);
    return parts.join(' • ');
  };

  // Filtered rows for in-table live search
  const filteredReportData = useMemo(() => {
    if (!tableSearch.trim()) return reportData;
    const term = tableSearch.toLowerCase();
    return reportData.filter(row => {
      return Object.values(row).some(val =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(term)
      );
    });
  }, [reportData, tableSearch]);

  // Aggregate KPI summary for the current filtered rows in tabular reports
  const tabularKpis = useMemo(() => {
    let trips = 0;
    let loaded = 0;
    let delivered = 0;
    let shortage = 0;
    filteredReportData.forEach(r => {
      if (r.total_trips !== undefined) trips += Number(r.total_trips) || 0;
      else if (r.id) trips += 1;
      if (r.total_loaded_m3 !== undefined) loaded += Number(r.total_loaded_m3) || 0;
      else if (r.quantity_loaded_m3 !== undefined) loaded += Number(r.quantity_loaded_m3) || 0;
      if (r.total_delivered_m3 !== undefined) delivered += Number(r.total_delivered_m3) || 0;
      else if (r.quantity_delivered_m3 !== undefined) delivered += Number(r.quantity_delivered_m3) || 0;
      if (r.total_shortage_m3 !== undefined) shortage += Number(r.total_shortage_m3) || 0;
      else if (r.quantity_remaining_m3 !== undefined) shortage += Number(r.quantity_remaining_m3) || 0;
    });
    return { trips, loaded, delivered, shortage };
  }, [filteredReportData]);

  // Handle CSV/Spreadsheet and PDF exports
  const handleExportCsv = () => {
    if (activeReport === 'truck_transport_pivot' && pivotData) {
      const csvRows: any[] = [];
      pivotData.truckGroups.forEach((group) => {
        const rawTrips = group.trips || [];
        const routeMap = new Map<string, any[]>();
        rawTrips.forEach((t) => {
          const loading = (t.loading_location_name || '-').trim();
          const comp = (t.company_name || '-').trim();
          const dest = ((t.project_name && t.project_name !== '-') ? t.project_name : (t.unloading_location_name || '-')).trim();
          const key = `${loading}__${comp}__${dest}`;
          if (!routeMap.has(key)) routeMap.set(key, []);
          routeMap.get(key)!.push(t);
        });

        routeMap.forEach((tripsInGroup) => {
          const subtotal = tripsInGroup.reduce((sum, tr) => sum + (Number(tr.individual_transport_fee_etb) || 0), 0);
          tripsInGroup.forEach((tr) => {
            let timeStr = '10:00:00 PM';
            try {
              const rawTime = tr.loading_datetime || tr.created_at;
              if (rawTime) {
                const dt = new Date(rawTime);
                if (!isNaN(dt.getTime())) {
                  timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                }
              }
            } catch {
              timeStr = '10:00:00 PM';
            }

            const sandGrade = (tr.sand_type === '00' ? '0' : tr.sand_type === '01' ? '1' : tr.sand_type === '02' ? '2' : (tr.sand_type || '0'));

            csvRows.push({
              truck_plate: group.truck_plate,
              truck_owner: group.truck_owner,
              total_trips: rawTrips.length,
              loading_location_name: tr.loading_location_name,
              company_name: tr.company_name,
              destination_project: (tr.project_name && tr.project_name !== '-') ? tr.project_name : tr.unloading_location_name,
              number_of_trips: tripsInGroup.length,
              trip_date: tr.trip_date,
              loading_time: timeStr,
              sand_type: sandGrade,
              quantity_loaded_m3: Number(tr.quantity_loaded_m3 || 0).toFixed(2),
              individual_price: Number(tr.individual_transport_fee_etb || 0),
              subtotal_price: subtotal,
              grand_total: group.calculated_total_transport_fee_etb
            });
          });
        });
      });

      const cols: ExportColumn[] = [
        { header: 'Truck Plate', key: 'truck_plate' },
        { header: 'Truck Owner', key: 'truck_owner' },
        { header: 'Total Trips', key: 'total_trips' },
        { header: 'Loading Point', key: 'loading_location_name' },
        { header: 'Company', key: 'company_name' },
        { header: 'Destination Project', key: 'destination_project' },
        { header: 'Number of Trips', key: 'number_of_trips' },
        { header: 'Date', key: 'trip_date' },
        { header: 'Loading Time', key: 'loading_time' },
        { header: 'Sand Type', key: 'sand_type' },
        { header: 'Loaded (m³)', key: 'quantity_loaded_m3' },
        { header: 'Individual Price', key: 'individual_price', format: (v) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) },
        { header: 'Subtotal price', key: 'subtotal_price', format: (v) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) },
        { header: 'Grand Total', key: 'grand_total', format: (v) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) },
      ];
      exportToCsv(`hired_trucks_transport_fees_pivot_${new Date().toISOString().split('T')[0]}`, cols, csvRows);
      return;
    }

    if (activeReport === 'trips_and_trucks') {
      if (tripsAndTrucksMode === 'matrix') {
        const cols: ExportColumn[] = [
          { header: 'Plate Number', key: 'truck_plate' },
          { header: 'Truck Owner', key: 'truck_owner' },
          { header: 'Owner Phone', key: 'owner_phone' },
          { header: 'Capacity (m³)', key: 'capacity_m3', format: (v) => v ? Number(v).toFixed(2) : '-' },
          { header: 'Total Trips', key: 'total_trips' },
          { header: 'Loaded (m³)', key: 'total_loaded_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Delivered (m³)', key: 'total_delivered_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Shortage (m³)', key: 'total_shortage_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 00 (m³)', key: 'delivered_sand_00', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 01 (m³)', key: 'delivered_sand_01', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Sand 02 (m³)', key: 'delivered_sand_02', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Success Rate', key: 'success_rate_label' },
        ];
        exportToCsv(`hired_truck_performance_matrix_${new Date().toISOString().split('T')[0]}`, cols, truckPerformanceList);
        return;
      } else {
        const cols: ExportColumn[] = [
          { header: 'Trip ID', key: 'id' },
          { header: 'Date', key: 'trip_date' },
          { header: 'Truck Plate', key: 'truck_plate' },
          { header: 'Truck Owner', key: 'truck_owner' },
          { header: 'Owner Phone', key: 'truck_owner_phone' },
          { header: 'Truck Capacity (m³)', key: 'truck_capacity_m3', format: (v) => v ? Number(v).toFixed(2) : '-' },
          { header: 'Crusher Site (Origin)', key: 'loading_location_name' },
          { header: 'Destination Project', key: 'unloading_location_name' },
          { header: 'Client Company', key: 'company_name' },
          { header: 'Sand Grade', key: 'sand_type' },
          { header: 'Loaded (m³)', key: 'quantity_loaded_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Delivered (m³)', key: 'quantity_delivered_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Shortage (m³)', key: 'quantity_remaining_m3', format: (v) => Number(v || 0).toFixed(2) },
          { header: 'Transport Fee (ETB)', key: 'total_transport_fee_etb', format: (v) => v ? Number(v).toFixed(2) : '0.00' },
          { header: 'Status', key: 'status' },
          { header: 'POD Ref', key: 'delivery_proof_ref' },
        ];
        exportToCsv(`registered_trips_ledger_${new Date().toISOString().split('T')[0]}`, cols, registeredTripsList);
        return;
      }
    }

    if (activeReport === 'truck_dossier' && truckDossier) {
      const cols: ExportColumn[] = [
        { header: 'Trip ID', key: 'id' },
        { header: 'Date', key: 'trip_date' },
        ...(truckDossier.isAllTrucks ? [{ header: 'Truck Plate', key: 'truck_plate' }] : []),
        { header: 'Crusher Plant (Origin)', key: 'loading_location_name' },
        { header: 'Destination Site', key: 'unloading_location_name' },
        { header: 'Client', key: 'company_name' },
        { header: 'Project', key: 'project_name' },
        { header: 'Sand Grade', key: 'sand_type' },
        { header: 'Loaded (m³)', key: 'quantity_loaded_m3', format: (v) => Number(v || 0).toFixed(2) },
        { header: 'Delivered (m³)', key: 'quantity_delivered_m3', format: (v) => Number(v || 0).toFixed(2) },
        { header: 'Shortage (m³)', key: 'quantity_remaining_m3', format: (v) => Number(v || 0).toFixed(2) },
        { header: 'Status', key: 'status' },
        { header: 'POD Ref', key: 'delivery_proof_ref' },
      ];
      const filename = truckDossier.isAllTrucks
        ? `all_trucks_fleet_report_${new Date().toISOString().split('T')[0]}`
        : `truck_${truckDossier.truck.plate_number}_dossier_${new Date().toISOString().split('T')[0]}`;
      exportToCsv(filename, cols, truckDossier.trips);
      return;
    }

    if (activeReport === 'company_dossier' && companyDossier) {
      const cols: ExportColumn[] = [
        { header: 'Trip ID', key: 'id' },
        { header: 'Date', key: 'trip_date' },
        { header: 'Truck Plate', key: 'truck_plate' },
        { header: 'Truck Owner', key: 'truck_owner' },
        { header: 'Destination Site', key: 'unloading_location_name' },
        { header: 'Project', key: 'project_name' },
        { header: 'Sand Grade', key: 'sand_type' },
        { header: 'Delivered (m³)', key: 'quantity_delivered_m3', format: (v) => Number(v || 0).toFixed(2) },
        { header: 'Status', key: 'status' },
        { header: 'POD Ref', key: 'delivery_proof_ref' },
      ];
      exportToCsv(`client_${companyDossier.company.name.replace(/[^a-zA-Z0-9]/g, '_')}_dossier`, cols, companyDossier.trips);
      return;
    }

    if (activeReport === 'financial' && financialData) {
      const cols: ExportColumn[] = [
        { header: 'Trip ID', key: 'id' },
        { header: 'Date', key: 'trip_date' },
        { header: 'Truck Plate', key: 'truck_plate' },
        { header: 'Crusher (Origin)', key: 'loading_location_name' },
        { header: 'Destination Project', key: 'unloading_location_name' },
        { header: 'Transport Fee (ETB / trip)', key: 'total_transport_fee_etb', format: (v, r) => (v || r.transport_rate_etb_per_m3 ? Number(v || r.transport_rate_etb_per_m3).toFixed(2) : '8500.00') },
        { header: 'Volume (m³)', key: 'quantity_delivered_m3', format: (v, r) => (Number(v) > 0 ? Number(v) : Number(r.quantity_loaded_m3)).toFixed(2) },
        { header: 'Total Fee / Truck (ETB)', key: 'total_transport_fee_etb', format: (v) => v ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00' },
        { header: 'Status', key: 'status' },
      ];
      exportToCsv(`transport_financial_report_${new Date().toISOString().split('T')[0]}`, cols, financialData.trips);
      return;
    }

    const cols = getColumnsForActiveReport();
    exportToCsv(`${activeReport}_${new Date().toISOString().split('T')[0]}`, cols, filteredReportData);
  };

  const handleExportPdf = () => {
    if (activeReport === 'truck_transport_pivot' && pivotData) {
      exportTruckTransportPivotPdf(pivotData.truckGroups, pivotData.kpis, getFilterSummary());
      return;
    }

    if (activeReport === 'trips_and_trucks') {
      const totTrips = registeredTripsList.length;
      const totLoaded = registeredTripsList.reduce((acc, t) => acc + (Number(t.quantity_loaded_m3) || 0), 0);
      const totDelivered = registeredTripsList.reduce((acc, t) => acc + (Number(t.quantity_delivered_m3) || 0), 0);
      const totShortage = Number((totLoaded - totDelivered).toFixed(2));
      const succCount = registeredTripsList.filter(t => t.status === 'Delivered').length;
      const rate = totTrips > 0 ? ((succCount / totTrips) * 100).toFixed(1) : '100.0';

      exportRegisteredTripsAndTrucksPdf(
        getFilterSummary(),
        truckPerformanceList,
        registeredTripsList,
        {
          totalTrips: totTrips,
          totalLoadedM3: totLoaded,
          totalDeliveredM3: totDelivered,
          totalShortageM3: totShortage,
          activeTrucksCount: truckPerformanceList.length || trucks.length,
          successRate: rate
        }
      );
      return;
    }

    if (activeReport === 'truck_dossier' && truckDossier) {
      exportTruckDossierPdf(truckDossier, getFilterSummary());
      return;
    }

    if (activeReport === 'financial' && financialData) {
      const cols: ExportColumn[] = [
        { header: 'Trip ID', key: 'id' },
        { header: 'Date', key: 'trip_date' },
        { header: 'Plate', key: 'truck_plate' },
        { header: 'Crusher', key: 'loading_location_name' },
        { header: 'Destination', key: 'unloading_location_name' },
        { header: 'Fee (ETB/trip)', key: 'total_transport_fee_etb', format: (v, r) => (v || r.transport_rate_etb_per_m3 ? Number(v || r.transport_rate_etb_per_m3).toFixed(2) : '8500.00') },
        { header: 'Delivered m³', key: 'quantity_delivered_m3', format: (v) => Number(v || 0).toFixed(2) },
        { header: 'Total Fee (ETB)', key: 'total_transport_fee_etb', format: (v) => v ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00' },
        { header: 'Status', key: 'status' },
      ];
      exportToPdf(
        'Transport Fee & Financial Logistics Report',
        getFilterSummary(),
        cols,
        financialData.trips,
        `Total Transport Fees: ${financialData.kpi.totalTransportFeesEtb?.toLocaleString()} ETB | Avg Fee/Trip: ${financialData.kpi.avgTransportFeePerTruckEtb?.toLocaleString()} ETB`
      );
      return;
    }

    const cols = getColumnsForActiveReport();
    const title = getReportTitle();
    const filterSummary = getFilterSummary();
    exportToPdf(
      title,
      filterSummary,
      cols,
      filteredReportData,
      activeReport === 'truck_performance'
        ? 'Trip Outcome Formula: Successful ÷ (Successful + Partial + Unsuccessful) × 100. Cancelled & Pending excluded.'
        : undefined
    );
  };

  const reportTabs: Array<{ id: ReportType; label: string; badge?: string; icon: any }> = [
    { id: 'truck_transport_pivot', label: 'Hired Trucks & Fees Pivot', badge: 'Truck Pivot & Fees', icon: TruckIcon },
    { id: 'trips_and_trucks', label: 'Registered Trips & Truck Performance', badge: 'Premier Overview', icon: TruckIcon },
    { id: 'financial', label: 'Financial & Transport Fees', badge: 'ETB & Tariffs', icon: DollarSign },
    { id: 'truck_dossier', label: 'Trucks Report (All in Once / Specific)', badge: 'All & Single', icon: TruckIcon },
    { id: 'company_dossier', label: 'Specific Client Dossier', icon: Building2 },
    { id: 'truck_performance', label: 'All Hired Trucks Matrix', icon: Scale },
    { id: 'sand_type', label: 'Sand Grades (00, 01, 02)', icon: Layers },
    { id: 'destinations', label: 'Destination Projects (Unloading)', icon: MapPin },
    { id: 'loading_points', label: 'Crusher Plants (Loading)', icon: MapPin },
    { id: 'companies_projects', label: 'Client Companies & Projects', icon: Building2 },
    { id: 'time_summary', label: 'Time Summaries', icon: Clock },
    { id: 'detailed_register', label: 'Detailed Trip Register', icon: FileText },
    { id: 'exceptions', label: 'Exception & Shortage Audit', badge: 'Alerts', icon: ShieldAlert },
  ];

  const columns = getColumnsForActiveReport();

  return (
    <div className="space-y-4">
      {/* Report Category Switcher Strip */}
      <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {reportTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeReport === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveReport(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-bold ${
                      isActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Export Action Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{getReportTitle()}</h2>
            <div className="text-xs text-slate-500 font-mono mt-0.5">{getFilterSummary()}</div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            {activeReport === 'time_summary' && (
              <div className="flex items-center bg-slate-100 p-1 rounded text-xs font-mono mr-1">
                {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setTimePeriod(p)}
                    className={`px-2 py-0.5 rounded capitalize cursor-pointer ${
                      timePeriod === p ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition-colors shadow-2xs cursor-pointer"
              title="Export report in Spreadsheet format (.CSV / Excel)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Spreadsheet Format (.CSV / Excel)</span>
            </button>

            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors shadow-xs cursor-pointer"
              title="Export report in PDF Document format (.PDF)"
            >
              <FileDown className="w-4 h-4 text-slate-950 shrink-0" />
              <span>PDF Document Format (.PDF)</span>
            </button>

            <button
              onClick={() => window.print()}
              className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
              title="Print Report View"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              onClick={loadCurrentReport}
              className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
              title="Refresh Report Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Specific Truck Selector - Includes 'All' Option */}
          <div className={activeReport === 'truck_dossier' ? 'col-span-1 md:col-span-2' : ''}>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>{activeReport === 'truck_dossier' ? 'Truck Scope (All in Once or Specific)' : 'Filter by Truck'}</span>
              <span className="text-[10px] text-amber-600 font-mono">
                {selectedTruckId === 'all' || !selectedTruckId ? '★ All Trucks in Once' : 'Single Truck Target'}
              </span>
            </label>
            <select
              value={selectedTruckId}
              onChange={(e) => setSelectedTruckId(e.target.value)}
              className={`w-full text-xs font-mono px-2.5 py-1.5 rounded border focus:outline-hidden ${
                activeReport === 'truck_dossier'
                  ? 'bg-amber-50/60 border-amber-400 text-slate-900 font-bold ring-1 ring-amber-300'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="all">All (Report of All Trucks in Once)</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.plate_number} — {t.owner_name} ({t.capacity_m3 ? `${t.capacity_m3} m³` : 'No Cap'})
                </option>
              ))}
            </select>
            {activeReport === 'truck_dossier' && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedTruckId('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer ${
                    selectedTruckId === 'all' || !selectedTruckId
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs ring-1 ring-amber-400'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  ✓ All Trucks (All in Once)
                </button>
                <span className="text-[10px] text-slate-400 font-sans">or select a specific truck</span>
              </div>
            )}
          </div>

          {/* Specific Company Selector - Includes 'All' Option */}
          <div className={activeReport === 'company_dossier' ? 'col-span-1 md:col-span-2' : ''}>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>{activeReport === 'company_dossier' ? 'Client Scope (Single or All)' : 'Filter by Client'}</span>
              <span className="text-[10px] text-blue-600 font-mono">
                {selectedCompanyId === 'all' || !selectedCompanyId ? 'All Clients' : 'Client Target'}
              </span>
            </label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className={`w-full text-xs px-2.5 py-1.5 rounded border focus:outline-hidden ${
                activeReport === 'company_dossier'
                  ? 'bg-blue-50/60 border-blue-400 text-slate-900 font-bold ring-1 ring-blue-300'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="all">★ All Construction Clients</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date Presets and Pickers */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Time Period Range</label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('all');
                }}
                className="w-1/2 text-xs font-mono px-2 py-1.5 bg-slate-50 border border-slate-200 rounded"
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
                className="w-1/2 text-xs font-mono px-2 py-1.5 bg-slate-50 border border-slate-200 rounded"
                title="End Date"
              />
            </div>
          </div>

          {/* Sand Type */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Sand Type Category</label>
            <select
              value={selectedSandType}
              onChange={(e) => setSelectedSandType(e.target.value)}
              className="w-full text-xs font-mono px-2 py-1.5 bg-slate-50 border border-slate-200 rounded"
            >
              <option value="">All Grades (00, 01, 02)</option>
              <option value="00">Category 00 (Fine)</option>
              <option value="01">Category 01 (Medium)</option>
              <option value="02">Category 02 (Coarse)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Delivery Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded"
            >
              <option value="">All Statuses</option>
              <option value="Delivered">Delivered (Successful)</option>
              <option value="Partially Delivered">Partially Delivered</option>
              <option value="Unsuccessful">Unsuccessful</option>
              <option value="Loaded / In Transit">Loaded / In Transit</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Quick Date Presets Row */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
            {(['all', 'today', 'yesterday', 'week', 'month'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => handleDatePreset(preset)}
                className={`px-2.5 py-0.5 rounded text-[11px] transition-colors capitalize cursor-pointer ${
                  datePreset === preset
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset === 'all' ? 'All Time' : preset === 'week' ? 'Past 7 Days' : preset === 'month' ? 'Past 30 Days' : preset}
              </button>
            ))}
          </div>

          {activeReport !== 'truck_dossier' && activeReport !== 'company_dossier' && (
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search within report..."
                className="w-full text-xs pl-8 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-hidden"
              />
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* PREMIER VIEW: HIRED TRUCKS TRIP HISTORY & TRANSPORT FEES PIVOT */}
      {/* ======================================================== */}
      {activeReport === 'truck_transport_pivot' && (
        <TruckTransportPivotReportView
          data={pivotData}
          isLoading={isLoading}
          onOpenTripModal={(id) => setViewingTripId(id)}
          onOpenTruckDossier={(id) => {
            setSelectedTruckId(id);
            setActiveReport('truck_dossier');
          }}
        />
      )}

      {/* ======================================================== */}
      {/* PREMIER VIEW: REGISTERED TRIPS & TRUCK PERFORMANCE       */}
      {/* ======================================================== */}
      {activeReport === 'trips_and_trucks' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-xs font-mono text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
              Compiling Registered Trips and Truck Fleet Performance...
            </div>
          ) : (
            <>
              {/* Executive Operational KPI Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-mono text-slate-500 uppercase">Total Dispatches</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                    {tripsAndTrucksKpis.totalTrips}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Trips in filter scope</div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-mono text-blue-800 uppercase">Hired Trucks</div>
                  <div className="text-xl font-bold font-mono text-blue-900 mt-1 tabular-nums">
                    {tripsAndTrucksKpis.distinctTrucks} <span className="text-xs font-normal">units</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Mobilized fleet</div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-mono text-slate-500 uppercase">Total Loaded</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                    {tripsAndTrucksKpis.totalLoaded.toFixed(2)} <span className="text-xs font-normal">m³</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">From crusher sites</div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-mono text-emerald-800 uppercase">Total Delivered</div>
                  <div className="text-xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
                    {tripsAndTrucksKpis.totalDelivered.toFixed(2)} <span className="text-xs font-normal">m³</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Verified on projects</div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-mono text-amber-800 uppercase">Net Shortage</div>
                  <div className={`text-xl font-bold font-mono mt-1 tabular-nums ${tripsAndTrucksKpis.totalShortage > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                    {tripsAndTrucksKpis.totalShortage.toFixed(2)} <span className="text-xs font-normal">m³</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Transit shortage</div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-mono text-slate-500 uppercase">Fleet Reliability</div>
                  <div className="text-xl font-bold font-mono mt-1 tabular-nums">
                    <span className={tripsAndTrucksKpis.successRate >= 80 ? 'text-emerald-700' : 'text-amber-700'}>
                      {tripsAndTrucksKpis.successRate}%
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{tripsAndTrucksKpis.successfulTrips} successful deliveries</div>
                </div>
              </div>

              {/* View Presentation Mode Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setTripsAndTrucksMode('matrix')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                      tripsAndTrucksMode === 'matrix'
                        ? 'bg-white text-slate-950 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mapped Truck Performance Matrix ({filteredTruckPerformance.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTripsAndTrucksMode('trips')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                      tripsAndTrucksMode === 'trips'
                        ? 'bg-white text-slate-950 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>All Registered Trips Ledger ({filteredRegisteredTrips.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTripsAndTrucksMode('combined')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                      tripsAndTrucksMode === 'combined'
                        ? 'bg-white text-slate-950 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Combined Mapped View (By Truck)</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                  <span>Both <strong className="text-emerald-700">Spreadsheet (.CSV / Excel)</strong> &amp; <strong className="text-amber-700">PDF</strong> ready for export</span>
                </div>
              </div>

              {/* MODE 1: Mapped Truck Performance Matrix */}
              {tripsAndTrucksMode === 'matrix' && (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <TruckIcon className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        <strong>Hired Truck Performance Matrix:</strong> Independent trucks with calibrated capacities (16.74 m³ &amp; 16.14 m³). Click <strong>"Expand Trips"</strong> to view registered dispatches mapped to that specific truck, or click owner phone to dial directly.
                      </span>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100/90 border-b border-slate-200 font-mono text-[11px] text-slate-700 uppercase tracking-wider">
                            <th className="py-2.5 px-3 w-8"></th>
                            <th className="py-2.5 px-3">Truck Plate</th>
                            <th className="py-2.5 px-3">Carrier / Owner</th>
                            <th className="py-2.5 px-3">Direct Phone</th>
                            <th className="py-2.5 px-3 text-right">Rated Cap</th>
                            <th className="py-2.5 px-3 text-right">Trips</th>
                            <th className="py-2.5 px-3 text-right">Loaded (m³)</th>
                            <th className="py-2.5 px-3 text-right">Delivered (m³)</th>
                            <th className="py-2.5 px-3 text-right">Shortage</th>
                            <th className="py-2.5 px-3 text-right">Sand 00</th>
                            <th className="py-2.5 px-3 text-right">Sand 01</th>
                            <th className="py-2.5 px-3 text-right">Sand 02</th>
                            <th className="py-2.5 px-3 text-center">Success Rate</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {filteredTruckPerformance.length === 0 ? (
                            <tr>
                              <td colSpan={14} className="py-12 text-center text-slate-400 font-sans">
                                No trucks found matching filters.
                              </td>
                            </tr>
                          ) : (
                            filteredTruckPerformance.map((t) => {
                              const isExpanded = expandedTruckPlate === t.truck_plate;
                              const mappedTrips = registeredTripsList.filter(tr => tr.truck_plate === t.truck_plate);
                              return (
                                <React.Fragment key={t.truck_id || t.truck_plate}>
                                  <tr className="hover:bg-slate-50 transition-colors group">
                                    <td className="py-2 px-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedTruckPlate(isExpanded ? null : t.truck_plate)}
                                        className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200 cursor-pointer"
                                        title={isExpanded ? 'Collapse Trips' : 'Expand Registered Trips for this Truck'}
                                      >
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-amber-600" /> : <ChevronRight className="w-4 h-4" />}
                                      </button>
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap font-bold text-slate-900">
                                      <span className="bg-amber-100 text-amber-950 border border-amber-300 px-2 py-0.5 rounded text-xs">
                                        {t.truck_plate}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 font-sans font-semibold text-slate-900 whitespace-nowrap">
                                      {t.truck_owner}
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap">
                                      {t.owner_phone ? (
                                        <a
                                          href={`tel:${t.owner_phone}`}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] transition-colors shadow-2xs cursor-pointer"
                                          title={`Direct Call: ${t.owner_phone}`}
                                        >
                                          <Phone className="w-3 h-3 text-emerald-700 shrink-0" />
                                          <span>{t.owner_phone}</span>
                                        </a>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-800 font-semibold tabular-nums">
                                      {t.capacity_m3 ? `${Number(t.capacity_m3).toFixed(2)} m³` : '-'}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums">
                                      {t.total_trips || 0}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums text-slate-800">
                                      {Number(t.total_loaded_m3 || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums font-bold text-emerald-700">
                                      {Number(t.total_delivered_m3 || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                      {Number(t.total_shortage_m3 || 0) > 0 ? (
                                        <span className="text-amber-700 font-bold">
                                          {Number(t.total_shortage_m3).toFixed(2)}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-600 tabular-nums">
                                      {Number(t.delivered_sand_00 || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-600 tabular-nums">
                                      {Number(t.delivered_sand_01 || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-600 tabular-nums">
                                      {Number(t.delivered_sand_02 || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        (t.success_rate || 0) >= 80 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                                      }`}>
                                        {t.success_rate_label || (t.success_rate !== null ? `${t.success_rate}%` : 'N/A')}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right whitespace-nowrap space-x-1.5 font-sans">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedTruckPlate(isExpanded ? null : t.truck_plate)}
                                        className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                                          isExpanded
                                            ? 'bg-amber-500 text-slate-950 font-bold'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                      >
                                        {isExpanded ? 'Hide Trips' : `Trips (${mappedTrips.length})`}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedTruckId(t.truck_id);
                                          setActiveReport('truck_dossier');
                                        }}
                                        className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors cursor-pointer"
                                      >
                                        Dossier →
                                      </button>
                                    </td>
                                  </tr>

                                  {/* Inline Mapped Registered Trips Accordion */}
                                  {isExpanded && (
                                    <tr className="bg-amber-50/40">
                                      <td colSpan={14} className="p-3">
                                        <div className="bg-white rounded-lg border border-amber-300 shadow-2xs overflow-hidden">
                                          <div className="px-4 py-2.5 bg-amber-100/60 border-b border-amber-200 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <TruckIcon className="w-4 h-4 text-amber-800" />
                                              <span className="font-bold text-slate-900 font-sans text-xs">
                                                Registered Trips Mapped to Truck {t.truck_plate} ({t.truck_owner})
                                              </span>
                                              <span className="text-[10px] font-mono bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                                                {mappedTrips.length} Dispatches Recorded
                                              </span>
                                            </div>
                                            <span className="text-[11px] text-slate-500 font-sans">
                                              Rated Capacity: {t.capacity_m3 ? `${Number(t.capacity_m3).toFixed(2)} m³` : 'Standard'}
                                            </span>
                                          </div>

                                          <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse text-xs">
                                              <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase">
                                                  <th className="py-2 px-3">Trip ID</th>
                                                  <th className="py-2 px-3">Date</th>
                                                  <th className="py-2 px-3">Crusher Plant (Origin)</th>
                                                  <th className="py-2.5 px-3">Destination Project</th>
                                                  <th className="py-2 px-3">Construction Client</th>
                                                  <th className="py-2 px-3 text-center">Grade</th>
                                                  <th className="py-2 px-3 text-right">Loaded (m³)</th>
                                                  <th className="py-2 px-3 text-right">Delivered (m³)</th>
                                                  <th className="py-2 px-3 text-right">Fee (ETB)</th>
                                                  <th className="py-2 px-3 text-center">Status</th>
                                                  <th className="py-2 px-3">POD Ref</th>
                                                  <th className="py-2 px-3 text-right">Action</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100 font-mono">
                                                {mappedTrips.length === 0 ? (
                                                  <tr>
                                                    <td colSpan={12} className="py-6 text-center text-slate-400 font-sans">
                                                      No trips logged for this truck in the selected period.
                                                    </td>
                                                  </tr>
                                                ) : (
                                                  mappedTrips.map((tr) => (
                                                    <tr key={tr.id} className="hover:bg-slate-50 transition-colors">
                                                      <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                                                        {tr.id}
                                                      </td>
                                                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                                        {tr.trip_date}
                                                      </td>
                                                      <td className="py-2 px-3 font-sans font-medium text-slate-800">
                                                        <button
                                                          type="button"
                                                          onClick={() => setViewingCrusherId(tr.loading_location_id)}
                                                          className="text-amber-800 hover:underline hover:text-amber-950 cursor-pointer text-left"
                                                          title="Click to view crusher plant details"
                                                        >
                                                          {tr.loading_location_name}
                                                        </button>
                                                      </td>
                                                      <td className="py-2 px-3 font-sans text-blue-700 font-medium">
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            if (tr.project_id) setViewingProjectId(tr.project_id);
                                                          }}
                                                          className="hover:underline cursor-pointer text-left"
                                                          title="Click to view destination project details"
                                                        >
                                                          {tr.unloading_location_name}
                                                        </button>
                                                      </td>
                                                      <td className="py-2 px-3 font-sans text-slate-800">
                                                        <button
                                                          type="button"
                                                          onClick={() => setViewingCompanyId(tr.company_id)}
                                                          className="hover:underline cursor-pointer text-left"
                                                          title="Click to view client company details"
                                                        >
                                                          {tr.company_name}
                                                        </button>
                                                      </td>
                                                      <td className="py-2 px-3 text-center">
                                                        <span className="font-bold px-1.5 py-0.5 bg-slate-100 rounded text-slate-900">
                                                          {tr.sand_type}
                                                        </span>
                                                      </td>
                                                      <td className="py-2 px-3 text-right text-slate-800">
                                                        {Number(tr.quantity_loaded_m3 || 0).toFixed(2)}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                                        {Number(tr.quantity_delivered_m3 || 0).toFixed(2)}
                                                      </td>
                                                      <td className="py-2 px-3 text-right text-amber-800 font-semibold">
                                                        {Number(tr.total_transport_fee_etb || tr.transport_rate_etb_per_m3 || 8500).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                      </td>
                                                      <td className="py-2 px-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                                          tr.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                                                          tr.status === 'Partially Delivered' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                                        }`}>
                                                          {tr.status}
                                                        </span>
                                                      </td>
                                                      <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">
                                                        {tr.delivery_proof_ref || '-'}
                                                      </td>
                                                      <td className="py-2 px-3 text-right">
                                                        <button
                                                          type="button"
                                                          onClick={() => setViewingTripId(tr.id)}
                                                          className="px-2 py-0.5 text-[10px] font-sans font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                                                        >
                                                          Details
                                                        </button>
                                                      </td>
                                                    </tr>
                                                  ))
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })
                          )}
                        </tbody>
                        <tfoot className="bg-slate-100/90 border-t-2 border-slate-300 font-mono text-xs font-bold text-slate-900">
                          <tr>
                            <td></td>
                            <td className="py-2.5 px-3 uppercase text-[11px] text-slate-700">
                              Fleet Totals ({filteredTruckPerformance.length} Trucks)
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 font-sans text-[11px]">Mobilized Carriers</td>
                            <td></td>
                            <td></td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {filteredTruckPerformance.reduce((acc, t) => acc + (Number(t.total_trips) || 0), 0)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {filteredTruckPerformance.reduce((acc, t) => acc + (Number(t.total_loaded_m3) || 0), 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-emerald-800">
                              {filteredTruckPerformance.reduce((acc, t) => acc + (Number(t.total_delivered_m3) || 0), 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-amber-800">
                              {filteredTruckPerformance.reduce((acc, t) => acc + (Number(t.total_shortage_m3) || 0), 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                              {filteredTruckPerformance.reduce((acc, t) => acc + (Number(t.delivered_sand_00) || 0), 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                              {filteredTruckPerformance.reduce((acc, t) => acc + (Number(t.delivered_sand_01) || 0), 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                              {filteredTruckPerformance.reduce((acc, t) => acc + (Number(t.delivered_sand_02) || 0), 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-center text-emerald-800">
                              {tripsAndTrucksKpis.successRate}%
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 2: All Registered Trips Ledger */}
              {tripsAndTrucksMode === 'trips' && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-700 shrink-0" />
                      <span>
                        <strong>Unified Registered Trips Ledger:</strong> All historical and active dispatches from Crusher Loading Sites to Destination Projects. Click any company, destination, or crusher plant to view its profile popup with direct phone links.
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-blue-900 font-bold shrink-0">
                      {filteredRegisteredTrips.length} Dispatches Recorded
                    </span>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100/90 border-b border-slate-200 font-mono text-[11px] text-slate-700 uppercase tracking-wider">
                            <th className="py-2.5 px-3">Trip ID</th>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Hired Truck &amp; Carrier</th>
                            <th className="py-2.5 px-3">Crusher Site (Origin)</th>
                            <th className="py-2.5 px-3">Destination Project</th>
                            <th className="py-2.5 px-3">Construction Client</th>
                            <th className="py-2.5 px-3 text-center">Grade</th>
                            <th className="py-2.5 px-3 text-right">Loaded (m³)</th>
                            <th className="py-2.5 px-3 text-right">Delivered (m³)</th>
                            <th className="py-2.5 px-3 text-right">Fee (ETB)</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3">POD Ticket</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {filteredRegisteredTrips.length === 0 ? (
                            <tr>
                              <td colSpan={13} className="py-12 text-center text-slate-400 font-sans">
                                No registered trips found matching filters.
                              </td>
                            </tr>
                          ) : (
                            filteredRegisteredTrips.map((t) => (
                              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                                  {t.id}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                  {t.trip_date}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold px-1.5 py-0.5 bg-amber-100 text-amber-950 border border-amber-300 rounded text-xs">
                                      {t.truck_plate}
                                    </span>
                                    <span className="font-sans font-medium text-slate-800 text-[11px] truncate max-w-[120px]">
                                      {t.truck_owner}
                                    </span>
                                  </div>
                                  {t.truck_owner_phone && (
                                    <div className="mt-0.5">
                                      <a
                                        href={`tel:${t.truck_owner_phone}`}
                                        className="inline-flex items-center gap-1 text-[10px] text-emerald-800 font-bold hover:underline"
                                      >
                                        <Phone className="w-2.5 h-2.5 text-emerald-700" />
                                        <span>{t.truck_owner_phone}</span>
                                      </a>
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-sans font-medium text-slate-800">
                                  <button
                                    type="button"
                                    onClick={() => setViewingCrusherId(t.loading_location_id)}
                                    className="text-amber-800 hover:text-amber-950 hover:underline cursor-pointer text-left"
                                    title="Click to view crusher plant loading details"
                                  >
                                    {t.loading_location_name}
                                  </button>
                                </td>
                                <td className="py-2.5 px-3 font-sans font-medium text-blue-700">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (t.project_id) setViewingProjectId(t.project_id);
                                    }}
                                    className="hover:underline cursor-pointer text-left"
                                    title="Click to view destination project details"
                                  >
                                    {t.unloading_location_name}
                                  </button>
                                </td>
                                <td className="py-2.5 px-3 font-sans text-slate-800">
                                  <button
                                    type="button"
                                    onClick={() => setViewingCompanyId(t.company_id)}
                                    className="hover:underline cursor-pointer text-left"
                                    title="Click to view client company details"
                                  >
                                    {t.company_name}
                                  </button>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="font-bold px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-900">
                                    {t.sand_type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-800 tabular-nums">
                                  {Number(t.quantity_loaded_m3 || 0).toFixed(2)} m³
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-emerald-700 tabular-nums">
                                  {Number(t.quantity_delivered_m3 || 0).toFixed(2)} m³
                                </td>
                                <td className="py-2.5 px-3 text-right text-amber-800 font-semibold tabular-nums">
                                  {Number(t.total_transport_fee_etb || t.transport_rate_etb_per_m3 || 8500).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    t.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                    t.status === 'Partially Delivered' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                    'bg-slate-100 text-slate-700 border border-slate-200'
                                  }`}>
                                    {t.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px]">
                                  {t.delivery_proof_ref || '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-sans whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => setViewingTripId(t.id)}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                                  >
                                    View Record
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot className="bg-slate-100/90 border-t-2 border-slate-300 font-mono text-xs font-bold text-slate-900">
                          <tr>
                            <td colSpan={2} className="py-2.5 px-3 uppercase text-[11px]">
                              Total Registered Trips: {filteredRegisteredTrips.length}
                            </td>
                            <td colSpan={5}></td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {filteredRegisteredTrips.reduce((acc, t) => acc + (Number(t.quantity_loaded_m3) || 0), 0).toFixed(2)} m³
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-emerald-800">
                              {filteredRegisteredTrips.reduce((acc, t) => acc + (Number(t.quantity_delivered_m3) || 0), 0).toFixed(2)} m³
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-amber-800 font-bold">
                              {filteredRegisteredTrips.reduce((acc, t) => acc + (Number(t.total_transport_fee_etb || t.transport_rate_etb_per_m3 || 8500)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                            </td>
                            <td colSpan={3}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 3: Combined Mapped View (Truck Performance Card followed by its Trips) */}
              {tripsAndTrucksMode === 'combined' && (
                <div className="space-y-6">
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg text-xs text-emerald-950 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      <strong>Combined Mapped View:</strong> Hired truck performance summary cards mapped directly with their respective registered delivery logs.
                    </span>
                  </div>

                  {filteredTruckPerformance.map((t) => {
                    const truckTrips = registeredTripsList.filter(tr => tr.truck_plate === t.truck_plate);
                    return (
                      <div key={t.truck_id || t.truck_plate} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                        {/* Truck Header Header */}
                        <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center font-bold shrink-0">
                              <TruckIcon className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-base text-amber-400">
                                  {t.truck_plate}
                                </span>
                                <span className="text-xs text-slate-300 font-sans font-medium">
                                  • Carrier / Owner: <strong className="text-white">{t.truck_owner}</strong>
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                                {t.owner_phone && (
                                  <a
                                    href={`tel:${t.owner_phone}`}
                                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-mono font-bold"
                                    title="Click to call truck owner"
                                  >
                                    <Phone className="w-3 h-3" />
                                    <span>{t.owner_phone}</span>
                                  </a>
                                )}
                                <span>Rated Capacity: <strong className="text-slate-200 font-mono">{t.capacity_m3 ? `${Number(t.capacity_m3).toFixed(2)} m³` : 'Standard'}</strong></span>
                                <span>Success Rate: <strong className="text-emerald-400 font-mono">{t.success_rate_label || `${t.success_rate}%`}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-start sm:self-auto font-mono text-xs">
                            <div className="bg-slate-800/80 px-3 py-1.5 rounded border border-slate-700">
                              <span className="text-[10px] text-slate-400 block uppercase">Dispatches</span>
                              <strong className="text-white text-sm">{t.total_trips || truckTrips.length}</strong>
                            </div>
                            <div className="bg-slate-800/80 px-3 py-1.5 rounded border border-slate-700">
                              <span className="text-[10px] text-slate-400 block uppercase">Delivered</span>
                              <strong className="text-emerald-400 text-sm">{Number(t.total_delivered_m3 || 0).toFixed(2)} m³</strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTruckId(t.truck_id);
                                setActiveReport('truck_dossier');
                              }}
                              className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs transition-colors cursor-pointer shadow-xs font-sans"
                            >
                              Full Dossier →
                            </button>
                          </div>
                        </div>

                        {/* Mapped Registered Trips Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase">
                                <th className="py-2 px-3">Trip ID</th>
                                <th className="py-2 px-3">Date</th>
                                <th className="py-2 px-3">Crusher Plant (Origin)</th>
                                <th className="py-2 px-3">Destination Project</th>
                                <th className="py-2 px-3">Construction Client</th>
                                <th className="py-2 px-3 text-center">Grade</th>
                                <th className="py-2 px-3 text-right">Loaded (m³)</th>
                                <th className="py-2 px-3 text-right">Delivered (m³)</th>
                                <th className="py-2 px-3 text-right">Fee (ETB)</th>
                                <th className="py-2 px-3 text-center">Status</th>
                                <th className="py-2 px-3">POD Ticket</th>
                                <th className="py-2 px-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {truckTrips.length === 0 ? (
                                <tr>
                                  <td colSpan={12} className="py-6 text-center text-slate-400 font-sans">
                                    No registered dispatches for this truck in the current period.
                                  </td>
                                </tr>
                              ) : (
                                truckTrips.map((tr) => (
                                  <tr key={tr.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                                      {tr.id}
                                    </td>
                                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                      {tr.trip_date}
                                    </td>
                                    <td className="py-2 px-3 font-sans font-medium text-slate-800">
                                      <button
                                        type="button"
                                        onClick={() => setViewingCrusherId(tr.loading_location_id)}
                                        className="text-amber-800 hover:underline cursor-pointer text-left"
                                      >
                                        {tr.loading_location_name}
                                      </button>
                                    </td>
                                    <td className="py-2 px-3 font-sans font-medium text-blue-700">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (tr.project_id) setViewingProjectId(tr.project_id);
                                        }}
                                        className="hover:underline cursor-pointer text-left"
                                      >
                                        {tr.unloading_location_name}
                                      </button>
                                    </td>
                                    <td className="py-2 px-3 font-sans text-slate-800">
                                      <button
                                        type="button"
                                        onClick={() => setViewingCompanyId(tr.company_id)}
                                        className="hover:underline cursor-pointer text-left"
                                      >
                                        {tr.company_name}
                                      </button>
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <span className="font-bold px-1.5 py-0.5 bg-slate-100 rounded text-slate-900">
                                        {tr.sand_type}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-800">
                                      {Number(tr.quantity_loaded_m3 || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                      {Number(tr.quantity_delivered_m3 || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-right text-amber-800 font-semibold">
                                      {Number(tr.total_transport_fee_etb || tr.transport_rate_etb_per_m3 || 8500).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                        tr.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                                        tr.status === 'Partially Delivered' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                      }`}>
                                        {tr.status}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">
                                      {tr.delivery_proof_ref || '-'}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => setViewingTripId(tr.id)}
                                        className="px-2 py-0.5 text-[10px] font-sans font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                                      >
                                        Details
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 0: FINANCIAL & ROUTE TRANSPORT FEES REPORT          */}
      {/* ======================================================== */}
      {activeReport === 'financial' && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-xs font-mono text-slate-400">
              Calculating Route Transport Fees & Financial Metrics...
            </div>
          ) : !financialData ? (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-xs text-slate-500">
              No financial data available for the chosen date range.
            </div>
          ) : (
            <>
              {/* Financial Summary KPI Cards (ETB Currency, ETB/m³, Total / Truck) */}
              <div className="bg-emerald-950 text-white p-5 rounded-xl border border-emerald-900 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-emerald-100">
                        Transport Fee Settlement & Route Financials (ETB)
                      </h3>
                      <p className="text-xs text-emerald-300/80">
                        Fixed route corridor tariffs • Strict calculations in ETB / trip and Total per Truck
                      </p>
                    </div>
                  </div>
                  <div className="text-xs font-mono bg-emerald-900/80 px-3 py-1.5 rounded-md border border-emerald-800 self-start sm:self-auto">
                    Total Dispatches: <strong className="text-white">{financialData.kpi.totalTrips}</strong> trips
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-emerald-900/60 p-4 rounded-lg border border-emerald-800/80">
                    <div className="text-[11px] font-mono text-emerald-300 uppercase tracking-wider">
                      Total Transport Fees (ETB)
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono text-white tabular-nums">
                      {(financialData.kpi.totalTransportFeesEtb || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-emerald-300">ETB</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-1">
                      Total payout across all trips
                    </div>
                  </div>

                  <div className="bg-emerald-900/60 p-4 rounded-lg border border-emerald-800/80">
                    <div className="text-[11px] font-mono text-emerald-300 uppercase tracking-wider">
                      Average Fee / Trip
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono text-white tabular-nums">
                      {(financialData.kpi.avgTransportFeePerTruckEtb || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-emerald-300">ETB</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-1">
                      Total payout per truck delivery
                    </div>
                  </div>

                  <div className="bg-emerald-900/60 p-4 rounded-lg border border-emerald-800/80">
                    <div className="text-[11px] font-mono text-emerald-300 uppercase tracking-wider">
                      Effective Tariff / Trip
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono text-white tabular-nums">
                      {((financialData.kpi.totalTransportFeesEtb && financialData.kpi.totalTrips) ? (financialData.kpi.totalTransportFeesEtb / financialData.kpi.totalTrips) : 8500).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-emerald-300">ETB / trip</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-1">
                      Average settled rate per haul
                    </div>
                  </div>

                  <div className="bg-emerald-900/60 p-4 rounded-lg border border-emerald-800/80">
                    <div className="text-[11px] font-mono text-emerald-300 uppercase tracking-wider">
                      Total Billed Volume
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono text-white tabular-nums">
                      {financialData.kpi.totalDeliveredM3.toFixed(2)} <span className="text-xs font-normal text-emerald-300">m³</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-1">
                      Delivered across {financialData.kpi.totalTrips} loads
                    </div>
                  </div>
                </div>
              </div>

              {/* Haul Corridors Table (Fixed Route Tariff, ETB/m³, Total / Truck) */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Route className="w-4 h-4 text-emerald-700" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Corridor Breakdown: Crusher Sites → Destination Projects
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500">
                      Fixed route fees configured per origin-destination pair
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    {(financialData.byRoute || []).length} active routes
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-mono border-b border-slate-200">
                        <th className="py-2.5 px-3">Crusher Site (Origin)</th>
                        <th className="py-2.5 px-3">Destination Project</th>
                        <th className="py-2.5 px-3 text-center">Distance</th>
                        <th className="py-2.5 px-3 text-right">Corridor Tariff (ETB / trip)</th>
                        <th className="py-2.5 px-3 text-right">Trips</th>
                        <th className="py-2.5 px-3 text-right">Delivered (m³)</th>
                        <th className="py-2.5 px-3 text-right">Avg Fee / Truck</th>
                        <th className="py-2.5 px-3 text-right text-emerald-900 font-bold">Total Fees (ETB)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(financialData.byRoute || []).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-slate-400 font-sans">
                            No route transport records for this selection.
                          </td>
                        </tr>
                      ) : (
                        (financialData.byRoute || []).map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                              {r.origin_location_name}
                            </td>
                            <td className="py-2.5 px-3 font-sans font-semibold text-blue-700">
                              {r.destination_location_name}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-500">
                              {r.distance_km ? `${r.distance_km} km` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-amber-700 font-bold">
                              {r.fixed_fee_per_trip_etb
                                ? `${Number(r.fixed_fee_per_trip_etb).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
                                : (r.rate_per_m3_etb ? `${(r.rate_per_m3_etb * 20).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` : '8,500.00 ETB')}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-700">
                              {r.trip_count}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-900 font-semibold">
                              {r.delivered_m3.toFixed(2)} m³
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-800">
                              {r.avg_fee_per_truck_etb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                              {r.total_transport_fee_etb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Individual Trips Financial Log */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Trip Transport Fee Register ({financialData.trips.length} Dispatches)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Trip-by-trip fee calculation based on fixed corridor tariff per trip
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-mono border-b border-slate-200">
                        <th className="py-2.5 px-3">Trip ID</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Truck Plate</th>
                        <th className="py-2.5 px-3">Crusher Site</th>
                        <th className="py-2.5 px-3">Destination Project</th>
                        <th className="py-2.5 px-3 text-right">Fee (ETB / trip)</th>
                        <th className="py-2.5 px-3 text-right">Delivered (m³)</th>
                        <th className="py-2.5 px-3 text-right text-emerald-900 font-bold">Total Fee / Truck (ETB)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {financialData.trips.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-slate-400 font-sans">
                            No trips matching filters.
                          </td>
                        </tr>
                      ) : (
                        financialData.trips.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 font-bold text-slate-900">{t.id}</td>
                            <td className="py-2 px-3 text-slate-600">{t.trip_date}</td>
                            <td className="py-2 px-3 font-semibold text-slate-900">{t.truck_plate}</td>
                            <td className="py-2 px-3 text-slate-700 font-sans">{t.loading_location_name}</td>
                            <td className="py-2 px-3 text-blue-700 font-sans">{t.unloading_location_name}</td>
                            <td className="py-2 px-3 text-right text-amber-700 font-bold">
                              {Number(t.total_transport_fee_etb || t.transport_rate_etb_per_m3 || 8500).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                            </td>
                            <td className="py-2 px-3 text-right text-slate-800">
                              {(t.quantity_delivered_m3 > 0 ? t.quantity_delivered_m3 : t.quantity_loaded_m3).toFixed(2)} m³
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700">
                              {t.total_transport_fee_etb
                                ? Number(t.total_transport_fee_etb).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                : '0.00'} ETB
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 1: TRUCK AUDIT DOSSIER & ALL-TRUCKS FLEET REPORT    */}
      {/* ======================================================== */}
      {activeReport === 'truck_dossier' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-xs font-mono text-slate-400">
              Generating Truck Logistics Report...
            </div>
          ) : !truckDossier ? (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-xs text-slate-500">
              Please select a truck or choose "All Trucks" from the dropdown above.
            </div>
          ) : (
            <>
              {/* Truck Profile Card / Consolidated Fleet Header */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-300 text-amber-800 flex items-center justify-center font-bold shrink-0">
                      <TruckIcon className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-mono font-bold text-xl text-slate-900 tracking-tight">
                          {truckDossier.isAllTrucks ? 'ALL TRUCKS (CONSOLIDATED FLEET REPORT)' : truckDossier.truck.plate_number}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold font-mono border ${
                            truckDossier.isAllTrucks
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : truckDossier.truck.is_active === 1
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {truckDossier.isAllTrucks
                            ? `${truckDossier.summary.distinctTrucksCount || trucks.length} Hired Trucks Mobilized`
                            : truckDossier.truck.is_active === 1
                            ? 'Active Fleet Unit'
                            : 'Inactive'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {truckDossier.isAllTrucks ? (
                          <span>Consolidated delivery matrix across all independent carriers &amp; trucks in the fleet</span>
                        ) : (
                          <>
                            Owner: <strong className="text-slate-900">{truckDossier.truck.owner_name}</strong>
                            {truckDossier.truck.owner_phone && (
                              <span className="font-mono ml-2 text-slate-500">({truckDossier.truck.owner_phone})</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {!truckDossier.isAllTrucks && (
                      <button
                        type="button"
                        onClick={() => setSelectedTruckId('all')}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors cursor-pointer"
                      >
                        ← View All Trucks in Once
                      </button>
                    )}

                    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">
                          {truckDossier.isAllTrucks ? 'Fleet Trucks' : 'Rated Capacity'}
                        </span>
                        <strong className="text-slate-900 text-sm">
                          {truckDossier.isAllTrucks
                            ? `${truckDossier.summary.distinctTrucksCount || trucks.length} Units`
                            : truckDossier.truck.capacity_m3
                            ? `${truckDossier.truck.capacity_m3.toFixed(2)} m³`
                            : 'Unspecified'}
                        </strong>
                      </div>
                      <div className="border-l border-slate-200 pl-4">
                        <span className="text-[10px] text-slate-500 block uppercase">
                          {truckDossier.isAllTrucks ? 'Fleet Capacity' : 'Capacity Util.'}
                        </span>
                        <strong className={`text-sm ${truckDossier.summary.capacityUtilization && truckDossier.summary.capacityUtilization > 100 ? 'text-red-700' : 'text-slate-900'}`}>
                          {truckDossier.isAllTrucks
                            ? truckDossier.truck.capacity_m3
                              ? `${truckDossier.truck.capacity_m3.toFixed(2)} m³`
                              : 'N/A'
                            : truckDossier.summary.capacityUtilization !== null
                            ? `${truckDossier.summary.capacityUtilization}%`
                            : 'N/A'}
                        </strong>
                      </div>
                      <div className="border-l border-slate-200 pl-4">
                        <span className="text-[10px] text-slate-500 block uppercase">Overloads</span>
                        <strong className={`text-sm ${truckDossier.summary.overloadTripsCount > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                          {truckDossier.summary.overloadTripsCount}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {truckDossier.truck.notes && (
                  <div className="pt-3 text-xs text-slate-500 italic">
                    Notes: {truckDossier.truck.notes}
                  </div>
                )}
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-mono uppercase">
                    {truckDossier.isAllTrucks ? 'Total Fleet Trips' : 'Total Dispatches'}
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                    {truckDossier.summary.totalTrips}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {truckDossier.isAllTrucks ? 'Across all trucks' : 'Trips logged in period'}
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-mono uppercase">Sand Loaded</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                    {truckDossier.summary.totalLoadedM3.toFixed(2)} <span className="text-xs font-normal">m³</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Avg: {truckDossier.summary.avgLoadM3.toFixed(2)} m³/trip</div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] text-emerald-800 font-mono uppercase">Sand Delivered</div>
                  <div className="text-xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
                    {truckDossier.summary.totalDeliveredM3.toFixed(2)} <span className="text-xs font-normal">m³</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Verified on-site drops</div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] text-amber-800 font-mono uppercase">Net Shortage</div>
                  <div className={`text-xl font-bold font-mono mt-1 tabular-nums ${truckDossier.summary.totalShortageM3 > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                    {truckDossier.summary.totalShortageM3.toFixed(2)} <span className="text-xs font-normal">m³</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{truckDossier.summary.shortageRate}% shortage rate</div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-mono uppercase">Success Rate</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                    {truckDossier.summary.successRate !== null ? (
                      <span className={truckDossier.summary.successRate >= 80 ? 'text-emerald-700' : 'text-amber-700'}>
                        {truckDossier.summary.successRate}%
                      </span>
                    ) : 'N/A'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{truckDossier.summary.successfulTrips} full deliveries</div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-mono uppercase">Delivery Outcomes</div>
                  <div className="text-xs font-mono text-slate-700 mt-1 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Full:</span>
                      <strong className="text-emerald-700">{truckDossier.summary.successfulTrips}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Partial:</span>
                      <strong className="text-amber-700">{truckDossier.summary.partialTrips}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed:</span>
                      <strong className="text-red-700">{truckDossier.summary.unsuccessfulTrips}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* ALL TRUCKS SIDE-BY-SIDE COMPARATIVE BREAKDOWN MATRIX */}
              {truckDossier.isAllTrucks && truckDossier.trucksComparison && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        All Trucks Comparative Performance Breakdown (All in Once)
                      </h3>
                      <p className="text-xs text-slate-500 font-mono">
                        Side-by-side volume, sand grades, capacity, and reliability comparison for all {truckDossier.trucksComparison.length} fleet trucks
                      </p>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      Click <strong className="text-amber-800">Inspect Dossier</strong> to zoom into any truck
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/90 border-b border-slate-200 font-mono text-[11px] text-slate-700 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Truck Plate</th>
                          <th className="py-2.5 px-3">Owner / Carrier</th>
                          <th className="py-2.5 px-3 text-right">Rated Cap</th>
                          <th className="py-2.5 px-3 text-right">Trips</th>
                          <th className="py-2.5 px-3 text-right">Loaded (m³)</th>
                          <th className="py-2.5 px-3 text-right">Delivered (m³)</th>
                          <th className="py-2.5 px-3 text-right">Shortage</th>
                          <th className="py-2.5 px-3 text-right">Sand 00</th>
                          <th className="py-2.5 px-3 text-right">Sand 01</th>
                          <th className="py-2.5 px-3 text-right">Sand 02</th>
                          <th className="py-2.5 px-3 text-center">Overloads</th>
                          <th className="py-2.5 px-3 text-center">Success Rate</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {truckDossier.trucksComparison.map((t) => (
                          <tr
                            key={t.truck_id}
                            className="hover:bg-slate-50 transition-colors group cursor-pointer"
                            onClick={() => setSelectedTruckId(t.truck_id)}
                          >
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {t.truck_plate}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              <div>{t.truck_owner}</div>
                              {t.owner_phone && (
                                <div className="text-[10px] text-slate-400 font-mono">{t.owner_phone}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                              {t.capacity_m3 ? `${Number(t.capacity_m3).toFixed(2)} m³` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {t.total_trips}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                              {Number(t.total_loaded_m3 || 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-800">
                              {Number(t.total_delivered_m3 || 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {Number(t.total_shortage_m3 || 0) > 0 ? (
                                <span className="text-amber-700 font-bold">
                                  {Number(t.total_shortage_m3).toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                              {Number(t.delivered_sand_00 || 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                              {Number(t.delivered_sand_01 || 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                              {Number(t.delivered_sand_02 || 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              {t.overload_count > 0 ? (
                                <span className="text-amber-700 font-bold px-1.5 py-0.5 bg-amber-50 rounded">
                                  {t.overload_count}
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold">
                              {t.success_rate !== null ? (
                                <span className={t.success_rate >= 80 ? 'text-emerald-700' : 'text-amber-700'}>
                                  {t.success_rate}%
                                </span>
                              ) : (
                                <span className="text-slate-400">N/A</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setSelectedTruckId(t.truck_id)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded border border-amber-300 transition-colors cursor-pointer"
                              >
                                Inspect Dossier →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100/90 border-t-2 border-slate-300 font-mono text-xs font-bold text-slate-900">
                        <tr>
                          <td className="py-2.5 px-3 uppercase text-[11px] text-slate-700">
                            Fleet Totals ({truckDossier.trucksComparison.length} Trucks)
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">Consolidated Fleet</td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                            {truckDossier.truck.capacity_m3 ? `${Number(truckDossier.truck.capacity_m3).toFixed(2)} m³` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {truckDossier.summary.totalTrips}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {truckDossier.summary.totalLoadedM3.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-emerald-800">
                            {truckDossier.summary.totalDeliveredM3.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-amber-800">
                            {truckDossier.summary.totalShortageM3.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                            {truckDossier.trucksComparison.reduce((acc, t) => acc + Number(t.delivered_sand_00 || 0), 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                            {truckDossier.trucksComparison.reduce((acc, t) => acc + Number(t.delivered_sand_01 || 0), 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                            {truckDossier.trucksComparison.reduce((acc, t) => acc + Number(t.delivered_sand_02 || 0), 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center text-amber-700">
                            {truckDossier.summary.overloadTripsCount}
                          </td>
                          <td className="py-2.5 px-3 text-center text-emerald-800">
                            {truckDossier.summary.successRate !== null ? `${truckDossier.summary.successRate}%` : 'N/A'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[11px] text-slate-500 font-sans">
                            {truckDossier.summary.distinctTrucksCount} Active Units
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Sand Type Distribution & Operations Split */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Sand Grades */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center justify-between">
                    <span>{truckDossier.isAllTrucks ? 'Fleet Sand Type Breakdown' : 'Sand Types for this Truck'}</span>
                    <Layers className="w-3.5 h-3.5 text-amber-500" />
                  </h4>
                  <div className="space-y-2">
                    {truckDossier.sandBreakdown.map((sb) => (
                      <div key={sb.sand_type} className="p-2.5 rounded bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold px-2 py-0.5 bg-amber-500 text-slate-950 rounded text-[11px]">
                            Grade {sb.sand_type}
                          </span>
                          <span className="text-slate-600 font-medium">
                            {sb.sand_type === '00' ? 'Fine Mortar' : sb.sand_type === '01' ? 'Medium Concrete' : 'Coarse Bedding'}
                          </span>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-bold text-slate-900">{sb.delivered_m3.toFixed(2)} m³</div>
                          <div className="text-[10px] text-slate-400">{sb.trip_count} trips</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Crusher Plants loaded */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center justify-between">
                    <span>Crusher Plants Loaded (Origins)</span>
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  </h4>
                  <div className="space-y-2">
                    {truckDossier.topCrusherSites.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">No loading activity in scope.</div>
                    ) : (
                      truckDossier.topCrusherSites.map((cp) => (
                        <div key={cp.loading_location_name} className="p-2.5 rounded bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                            {cp.loading_location_name}
                          </span>
                          <div className="text-right font-mono shrink-0">
                            <div className="font-bold text-slate-900">{cp.loaded_m3.toFixed(2)} m³</div>
                            <div className="text-[10px] text-slate-400">{cp.trips_count} loads</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Top Destinations delivered */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center justify-between">
                    <span>Construction Sites Delivered</span>
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  </h4>
                  <div className="space-y-2">
                    {truckDossier.topDestinations.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">No deliveries in scope.</div>
                    ) : (
                      truckDossier.topDestinations.map((dst) => (
                        <div key={dst.unloading_location_name} className="p-2.5 rounded bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                          <div className="truncate max-w-[180px]">
                            <div className="font-semibold text-slate-800 truncate">{dst.unloading_location_name}</div>
                            <div className="text-[10px] text-slate-500 truncate">{dst.company_name}</div>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <div className="font-bold text-slate-900">{dst.delivered_m3.toFixed(2)} m³</div>
                            <div className="text-[10px] text-slate-400">{dst.trips_count} deliveries</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Complete Chronological Trip Ledger */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Chronological Trip History &amp; Delivery Register {truckDossier.isAllTrucks ? '(All Hired Trucks in Fleet)' : `for Truck ${truckDossier.truck.plate_number}`}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {truckDossier.trips.length} historical trips recorded within current filter window
                    </p>
                  </div>
                  <button
                    onClick={handleExportCsv}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Export Trip Register (CSV)</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/90 border-b border-slate-200 font-mono text-[11px] text-slate-700 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Trip ID</th>
                        <th className="py-2.5 px-3">Date</th>
                        {truckDossier.isAllTrucks && <th className="py-2.5 px-3">Hired Truck</th>}
                        <th className="py-2.5 px-3">Crusher Plant (Origin)</th>
                        <th className="py-2.5 px-3">Construction Site (Destination)</th>
                        <th className="py-2.5 px-3">Client Company</th>
                        <th className="py-2.5 px-3 text-center">Grade</th>
                        <th className="py-2.5 px-3 text-right">Loaded (m³)</th>
                        <th className="py-2.5 px-3 text-right">Delivered (m³)</th>
                        <th className="py-2.5 px-3 text-right">Shortage</th>
                        <th className="py-2.5 px-3 text-center">Outcome</th>
                        <th className="py-2.5 px-3">POD Ticket</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {truckDossier.trips.length === 0 ? (
                        <tr>
                          <td colSpan={truckDossier.isAllTrucks ? 12 : 11} className="py-12 text-center text-slate-400 font-mono">
                            No trip records found within the selected filter window.
                          </td>
                        </tr>
                      ) : (
                        truckDossier.trips.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {t.id}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                              {t.trip_date}
                            </td>
                            {truckDossier.isAllTrucks && (
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedTruckId(t.truck_id)}
                                  className="font-mono font-bold text-slate-900 hover:text-amber-700 hover:underline cursor-pointer flex items-center gap-1"
                                  title="Click to view this truck's single dossier"
                                >
                                  <span>{t.truck_plate}</span>
                                </button>
                                <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{t.truck_owner}</div>
                              </td>
                            )}
                            <td className="py-2.5 px-3 text-slate-800 truncate max-w-[140px]">
                              {t.loading_location_name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-800 truncate max-w-[140px]">
                              {t.unloading_location_name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-800 truncate max-w-[140px]">
                              {t.company_name}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold">
                              <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-900">
                                {t.sand_type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                              {t.quantity_loaded_m3.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                              {t.quantity_delivered_m3.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {t.quantity_remaining_m3 > 0 ? (
                                <span className="text-amber-700 font-bold">
                                  {t.quantity_remaining_m3.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  t.status === 'Delivered'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : t.status === 'Partially Delivered'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : t.status === 'Unsuccessful'
                                    ? 'bg-red-50 text-red-800 border-red-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {t.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {t.delivery_proof_ref || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer Summary */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 font-mono gap-2">
                  <span>Total Trips: {truckDossier.trips.length}</span>
                  <span>
                    Total Delivered: <strong className="text-slate-900">{truckDossier.summary.totalDeliveredM3.toFixed(2)} m³</strong> | Net Shortage: <strong className="text-amber-800">{truckDossier.summary.totalShortageM3.toFixed(2)} m³</strong>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: SPECIFIC CLIENT COMPANY DOSSIER                  */}
      {/* ======================================================== */}
      {activeReport === 'company_dossier' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-xs font-mono text-slate-400">
              Generating Construction Client Dossier...
            </div>
          ) : !companyDossier ? (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-xs text-slate-500">
              Please select a construction company to view its detailed delivery dossier.
            </div>
          ) : (
            <>
              {/* Client Profile Card */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-300 text-blue-800 flex items-center justify-center font-bold">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl text-slate-900 tracking-tight">
                        {companyDossier.company.name}
                      </h3>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Contact: <strong className="text-slate-800">{companyDossier.company.contact_person || 'N/A'}</strong>
                        {companyDossier.company.phone && (
                          <span className="font-mono ml-2 text-slate-500">({companyDossier.company.phone})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Total Trips</span>
                      <strong className="text-slate-900 text-sm">{companyDossier.summary.total_trips || 0}</strong>
                    </div>
                    <div className="border-l border-slate-200 pl-4">
                      <span className="text-[10px] text-slate-500 block uppercase">Total Delivered</span>
                      <strong className="text-emerald-700 text-sm">
                        {(companyDossier.summary.total_delivered_m3 || 0).toFixed(2)} m³
                      </strong>
                    </div>
                    <div className="border-l border-slate-200 pl-4">
                      <span className="text-[10px] text-slate-500 block uppercase">Trucks Deployed</span>
                      <strong className="text-slate-900 text-sm">
                        {companyDossier.summary.distinct_trucks_used || 0}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Projects Breakdown for this Client */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
                    Site Deliveries Breakdown
                  </h4>
                  <div className="space-y-2">
                    {companyDossier.projects.map((p) => (
                      <div key={p.project_name} className="p-3 bg-slate-50 rounded border border-slate-100 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-900">
                          <span>{p.project_name}</span>
                          <span className="font-mono">{p.delivered_m3.toFixed(2)} m³</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 mt-1">
                          <span>Trips: {p.trip_count}</span>
                          <span>Grade 00: {p.sand_00.toFixed(2)} m³</span>
                          <span>Grade 01: {p.sand_01.toFixed(2)} m³</span>
                          <span>Grade 02: {p.sand_02.toFixed(2)} m³</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
                    Truck Carriers Utilized by this Client
                  </h4>
                  <div className="space-y-2">
                    {companyDossier.trucksUsed.map((t) => (
                      <div key={t.truck_plate} className="p-2.5 bg-slate-50 rounded border border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-mono font-bold text-slate-900 mr-2">{t.truck_plate}</span>
                          <span className="text-slate-600">{t.truck_owner}</span>
                        </div>
                        <div className="font-mono text-right">
                          <span className="font-bold text-slate-900">{t.delivered_m3.toFixed(2)} m³</span>
                          <span className="text-slate-400 text-[10px] ml-1.5">({t.trip_count} trips)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 3-10: GENERAL TABULAR REPORTS                       */}
      {/* ======================================================== */}
      {activeReport !== 'truck_dossier' && activeReport !== 'company_dossier' && activeReport !== 'financial' && (
        <div className="space-y-4">
          {/* Summary KPI Strip for Tabular Reports */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-mono text-slate-500 uppercase">Total Filtered Trips</div>
              <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{tabularKpis.trips}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-mono text-slate-500 uppercase">Total Loaded</div>
              <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{tabularKpis.loaded.toFixed(2)} m³</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-mono text-emerald-800 uppercase">Total Delivered</div>
              <div className="text-lg font-bold font-mono text-emerald-700 mt-0.5">{tabularKpis.delivered.toFixed(2)} m³</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-mono text-amber-800 uppercase">Shortage / Balance</div>
              <div className="text-lg font-bold font-mono text-amber-700 mt-0.5">{tabularKpis.shortage.toFixed(2)} m³</div>
            </div>
          </div>

          {activeReport === 'truck_performance' && (
            <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200 text-xs text-slate-700 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-950 font-bold">Trip Outcome Success Rate Formula:</strong>{' '}
                <span className="font-mono text-amber-900">
                  Fully successful deliveries ÷ (Fully successful + Partially delivered + Unsuccessful) × 100
                </span>
                . Cancelled and pending trips are excluded from the denominator. Click any truck to view its specific audit dossier.
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs print:text-[10px]">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 font-mono text-[11px] text-slate-700 uppercase tracking-wider">
                    {columns.map((c) => (
                      <th key={c.key} className="py-2.5 px-3 font-bold whitespace-nowrap">
                        {c.header}
                      </th>
                    ))}
                    {activeReport === 'truck_performance' && (
                      <th className="py-2.5 px-3 text-right">Specific Dossier</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={columns.length + 1} className="py-12 text-center text-slate-400 font-mono">
                        Compiling report data...
                      </td>
                    </tr>
                  ) : filteredReportData.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 1} className="py-12 text-center text-slate-500">
                        No matching records for this report period.
                      </td>
                    </tr>
                  ) : (
                    filteredReportData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        {columns.map((c) => {
                          let val = row[c.key];
                          if (c.format) val = c.format(val, row);
                          else if (val === null || val === undefined) val = '-';
                          const isNumber = !isNaN(Number(row[c.key])) && typeof row[c.key] === 'number';
                          return (
                            <td
                              key={c.key}
                              className={`py-2 px-3 whitespace-nowrap ${
                                isNumber ? 'font-mono tabular-nums text-slate-800' : 'text-slate-900'
                              }`}
                            >
                              {String(val)}
                            </td>
                          );
                        })}
                        {activeReport === 'truck_performance' && (
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTruckId(row.truck_id);
                                setActiveReport('truck_dossier');
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded border border-amber-300 transition-colors cursor-pointer"
                            >
                              Open Dossier →
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Total Rows: {filteredReportData.length}</span>
              <span>Quantities exclusively in cubic meters (m³)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
