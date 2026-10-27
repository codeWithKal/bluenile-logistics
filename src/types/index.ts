export type SandType = '00' | '01' | '02';

export type TripStatus =
  | 'Registered'
  | 'Loading'
  | 'Loaded / In Transit'
  | 'Delivered'
  | 'Partially Delivered'
  | 'Unsuccessful'
  | 'Cancelled';

export type UserRole = 'admin' | 'data_entry' | 'viewer';

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string | null;
  is_active?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string | null;
  created_at: string;
}

export interface AuditLogSummary {
  totalUserEvents: number;
  passwordEvents: number;
  statusEvents: number;
  lifecycleEvents: number;
  editEvents: number;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  summary: AuditLogSummary;
}

export interface Truck {
  id: string;
  plate_number: string;
  owner_name: string;
  capacity_m3: number | null;
  owner_phone: string | null;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  total_trips?: number;
  successful_trips?: number;
  partial_trips?: number;
  unsuccessful_trips?: number;
  cancelled_trips?: number;
  pending_trips?: number;
  total_loaded_m3?: number;
  total_delivered_m3?: number;
  success_rate?: number | null;
}

export interface ConstructionCompany {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  address: string | null;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  project_count?: number;
  total_trips?: number;
  total_delivered_m3?: number;
}

export interface Project {
  id: string;
  name: string;
  company_id: string;
  company_name?: string;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  price_sand_00?: number;
  price_sand_01?: number;
  price_sand_02?: number;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  total_trips?: number;
  total_delivered_m3?: number;
  total_revenue_etb?: number;
}

export type LocationType = 'Loading' | 'Unloading' | 'Both';

export interface Location {
  id: string;
  name: string;
  location_type: LocationType;
  address: string | null;
  associated_company_id: string | null;
  associated_company_name?: string | null;
  associated_project_id: string | null;
  contact_person?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  price_sand_00?: number; // Crusher loading cost ETB/m³
  price_sand_01?: number;
  price_sand_02?: number;
  selling_price_sand_00?: number; // Destination selling price ETB/m³
  selling_price_sand_01?: number;
  selling_price_sand_02?: number;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  trips_loaded_here?: number;
  trips_unloaded_here?: number;
  total_cost_etb?: number;
  total_revenue_etb?: number;
}

export interface RouteTariff {
  id: string;
  origin_location_id: string;
  destination_location_id: string;
  origin_location_name?: string;
  destination_location_name?: string;
  origin_name?: string;
  destination_name?: string;
  company_name?: string;
  destination_address?: string;
  origin_lat?: number | null;
  origin_lng?: number | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  distance_km?: number | null;
  rate_per_m3_etb: number; // Retained for backwards compatibility
  fee_per_trip_etb?: number; // Fixed transport fee in ETB per trip
  fixed_trip_fee_etb?: number; // Flat fee per trip (ETB)
  notes?: string | null;
  created_at: string;
  updated_at: string;
  trips_count?: number;
  total_delivered_m3?: number;
  total_fees_etb?: number;
}

export interface Trip {
  id: string;
  trip_date: string;
  truck_id: string;
  truck_plate: string;
  truck_owner: string;
  truck_owner_phone?: string | null;
  truck_capacity_m3?: number | null;
  company_id: string;
  company_name: string;
  project_id: string | null;
  project_name: string | null;
  loading_location_id: string;
  loading_location_name: string;
  loading_datetime: string | null;
  sand_type: SandType;
  quantity_loaded_m3: number;
  loading_notes: string | null;
  unloading_location_id: string;
  unloading_location_name: string;
  unloading_datetime: string | null;
  quantity_delivered_m3: number;
  quantity_remaining_m3: number;
  delivery_outcome: string | null;
  delivery_proof_ref: string | null;
  unloading_notes: string | null;
  status: TripStatus;
  status_reason: string | null;
  capacity_warning_acknowledged: number;
  unit_cost_etb?: number; // ETB/m³ cost at crusher
  total_cost_etb?: number; // Total ETB cost per truck trip
  unit_price_etb?: number; // ETB/m³ selling price at destination
  total_revenue_etb?: number; // Total ETB revenue per truck trip
  gross_profit_etb?: number; // Total gross profit (Revenue - Cost)
  shortage_loss_etb?: number; // Lost ETB due to material shortage
  transport_rate_etb_per_m3?: number; // Fixed Route Transport Rate in ETB/m³
  total_transport_fee_etb?: number; // Total Transport Fee per truck trip (ETB)
  route_tariff_id?: string | null;
  created_by_user_id: string | null;
  created_by_user_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripStatusHistory {
  id: string;
  trip_id: string;
  previous_status: TripStatus | null;
  new_status: TripStatus;
  changed_by_user_id: string;
  changed_by_user_name: string;
  reason: string | null;
  created_at: string;
}

export interface DashboardKPI {
  totalTrips: number;
  fullySuccessfulTrips: number;
  partiallyDeliveredTrips: number;
  unsuccessfulTrips: number;
  activePendingTrips: number;
  cancelledTrips: number;
  totalLoadedM3: number;
  totalDeliveredM3: number;
  totalOutstandingM3: number;
  distinctTrucksCount: number;
  // Financial metrics in ETB
  totalRevenueEtb: number;
  totalCostEtb: number;
  grossProfitEtb: number;
  shortageLossEtb: number;
  totalTransportFeesEtb?: number;
  avgTransportFeePerTruckEtb?: number; // Total / truck
  avgTransportRatePerM3Etb?: number; // ETB / m³
  avgRevenuePerTruckEtb: number; // Total / truck
  avgCostPerTruckEtb: number; // Total / truck
  avgProfitPerTruckEtb: number; // Total / truck
  avgSellingPricePerM3Etb: number; // ETB / m³
  avgCostPricePerM3Etb: number; // ETB / m³
}

export interface SandBreakdown {
  sand_type: SandType;
  trip_count: number;
  loaded_m3: number;
  delivered_m3: number;
  outstanding_m3: number;
  // Financial metrics in ETB
  unit_cost_etb: number; // ETB/m³
  unit_price_etb: number; // ETB/m³
  total_cost_etb: number; // Total ETB
  total_revenue_etb: number; // Total ETB
  gross_profit_etb: number; // Total Gross Profit ETB
  avg_profit_per_truck_etb: number; // Total / truck
  total_transport_fees_etb?: number;
}

export interface TimelineDataPoint {
  trip_date: string;
  total: number;
  successful: number;
  partial: number;
  unsuccessful: number;
  pending: number;
  cancelled: number;
  delivered_m3: number;
  total_revenue_etb?: number;
  gross_profit_etb?: number;
  total_transport_fees_etb?: number;
}

export interface DashboardData {
  kpi: DashboardKPI;
  sandBreakdown: SandBreakdown[];
  timeline: TimelineDataPoint[];
  truckPerformance: Array<{
    truck_id?: string;
    truck_plate: string;
    truck_owner: string;
    total_trips: number;
    successful_trips: number;
    partial_trips: number;
    unsuccessful_trips: number;
    delivered_m3: number;
    total_revenue_etb?: number;
    total_cost_etb?: number;
    gross_profit_etb?: number;
    total_transport_fees_etb?: number;
    avg_revenue_per_trip_etb?: number;
    avg_profit_per_trip_etb?: number;
    avg_transport_fee_per_trip_etb?: number;
  }>;
  companyVolumes: Array<{
    company_name: string;
    trip_count: number;
    delivered_m3: number;
    total_revenue_etb?: number;
    total_transport_fee_etb?: number;
  }>;
  destinationVolumes: Array<{
    unloading_location_name: string;
    trip_count: number;
    delivered_m3: number;
    total_revenue_etb?: number;
    total_transport_fee_etb?: number;
    avg_price_per_m3_etb?: number;
    gross_profit_etb?: number;
  }>;
  loadingPointActivity: Array<{
    loading_location_name: string;
    trip_count: number;
    loaded_m3: number;
    total_cost_etb?: number;
    total_transport_fee_etb?: number;
    avg_cost_per_m3_etb?: number;
  }>;
  topRoutes?: Array<{
    origin_name: string;
    destination_name: string;
    rate_per_m3_etb: number;
    distance_km?: number | null;
    trips_count: number;
    total_delivered_m3: number;
    total_transport_fees_etb: number;
    avg_fee_per_truck_etb: number;
  }>;
  alerts: {
    pending: any[];
    partial: any[];
    unsuccessful: any[];
    capacity: any[];
  };
  todaySummary?: TodayRealtimeSummary;
}

export interface TodayRecentTrip {
  id: string;
  trip_date: string;
  truck_plate: string;
  truck_owner: string;
  sand_type: SandType;
  quantity_loaded_m3: number;
  quantity_delivered_m3: number;
  loading_location_name: string;
  unloading_location_name: string;
  status: TripStatus;
  loading_datetime: string | null;
}

export interface TodayRealtimeSummary {
  date: string;
  isToday: boolean;
  totalTripsToday: number;
  activeTrucks: number;
  totalDailyLoadM3: number;
  totalDailyDeliveredM3: number;
  activeInTransitTrips: number;
  deliveredTodayTrips: number;
  partialTodayTrips: number;
  unsuccessfulTodayTrips: number;
  totalFleetTrucks: number;
  activeFleetTrucks: number;
  fleetUtilizationPercent: number;
  deliveryFulfillmentPercent: number;
  totalDailyTransportFeesEtb: number;
  totalDailyRevenueEtb: number;
  recentTodayTrips?: TodayRecentTrip[];
}

export interface ReportFilterParams {
  start_date?: string;
  end_date?: string;
  company_id?: string;
  project_id?: string;
  truck_id?: string;
  sand_type?: SandType;
  loading_location_id?: string;
  unloading_location_id?: string;
  status?: TripStatus;
}

export interface SpecificTruckDossier {
  isAllTrucks?: boolean;
  truck: Truck;
  summary: {
    totalTrips: number;
    distinctTrucksCount?: number;
    successfulTrips: number;
    partialTrips: number;
    unsuccessfulTrips: number;
    pendingTrips: number;
    cancelledTrips: number;
    totalLoadedM3: number;
    totalDeliveredM3: number;
    totalShortageM3: number;
    avgLoadM3: number;
    avgDeliveredM3: number;
    overloadTripsCount: number;
    successRate: number | null;
    shortageRate: number;
    capacityUtilization: number | null;
    // Financial calculations
    totalRevenueEtb: number;
    totalCostEtb: number;
    grossProfitEtb: number;
    shortageLossEtb: number;
    avgRevenuePerTripEtb: number;
    avgCostPerTripEtb: number;
    avgProfitPerTripEtb: number;
    avgRevenuePerM3Etb: number;
    avgCostPerM3Etb: number;
  };
  trucksComparison?: Array<{
    truck_id: string;
    truck_plate: string;
    truck_owner: string;
    capacity_m3: number | null;
    owner_phone: string | null;
    is_active: number;
    total_trips: number;
    successful_trips: number;
    partial_trips: number;
    unsuccessful_trips: number;
    cancelled_trips: number;
    total_loaded_m3: number;
    total_delivered_m3: number;
    total_shortage_m3: number;
    delivered_sand_00: number;
    delivered_sand_01: number;
    delivered_sand_02: number;
    overload_count: number;
    eligible_trips: number;
    success_rate: number | null;
    success_rate_label: string;
    // Financial columns
    total_revenue_etb: number;
    total_cost_etb: number;
    gross_profit_etb: number;
    avg_revenue_per_trip_etb: number;
    avg_profit_per_trip_etb: number;
    avg_selling_price_etb: number;
    avg_cost_price_etb: number;
  }>;
  sandBreakdown: Array<{
    sand_type: SandType;
    trip_count: number;
    loaded_m3: number;
    delivered_m3: number;
    shortage_m3: number;
    unit_cost_etb?: number;
    unit_price_etb?: number;
    total_cost_etb?: number;
    total_revenue_etb?: number;
    gross_profit_etb?: number;
  }>;
  topCrusherSites: Array<{
    loading_location_name: string;
    trips_count: number;
    loaded_m3: number;
  }>;
  topDestinations: Array<{
    unloading_location_name: string;
    company_name: string;
    trips_count: number;
    delivered_m3: number;
  }>;
  trips: Trip[];
}

export interface SpecificCompanyDossier {
  company: ConstructionCompany;
  summary: {
    total_trips: number;
    successful_trips: number;
    partial_trips: number;
    unsuccessful_trips: number;
    total_loaded_m3: number;
    total_delivered_m3: number;
    total_shortage_m3: number;
    distinct_trucks_used: number;
  };
  projects: Array<{
    project_name: string;
    trip_count: number;
    delivered_m3: number;
    sand_00: number;
    sand_01: number;
    sand_02: number;
  }>;
  trucksUsed: Array<{
    truck_plate: string;
    truck_owner: string;
    trip_count: number;
    delivered_m3: number;
  }>;
  trips: Trip[];
}

export interface FinancialReportData {
  kpi: {
    totalRevenueEtb: number;
    totalCostEtb: number;
    grossProfitEtb: number;
    shortageLossEtb: number;
    totalTransportFeesEtb?: number;
    profitMarginPct: number;
    avgRevenuePerTruckEtb: number;
    avgCostPerTruckEtb: number;
    avgProfitPerTruckEtb: number;
    avgTransportFeePerTruckEtb?: number;
    avgTransportRatePerM3Etb?: number;
    avgSellingPricePerM3Etb: number;
    avgCostPricePerM3Etb: number;
    totalTrips: number;
    totalDeliveredM3: number;
    totalLoadedM3: number;
    totalShortageM3: number;
  };
  byRoute?: Array<{
    origin_location_name: string;
    destination_location_name: string;
    rate_per_m3_etb: number;
    fixed_fee_per_trip_etb?: number;
    distance_km?: number | null;
    trip_count: number;
    loaded_m3: number;
    delivered_m3: number;
    total_transport_fee_etb: number;
    avg_fee_per_truck_etb: number;
    avg_rate_per_m3_etb: number;
  }>;
  bySandType: Array<{
    sand_type: SandType;
    trip_count: number;
    loaded_m3: number;
    delivered_m3: number;
    unit_cost_etb: number;
    unit_price_etb: number;
    total_cost_etb: number;
    total_revenue_etb: number;
    gross_profit_etb: number;
    avg_profit_per_truck_etb: number;
  }>;
  byCrusherSite: Array<{
    loading_location_name: string;
    trip_count: number;
    loaded_m3: number;
    total_cost_etb: number;
    avg_cost_per_m3_etb: number;
    avg_cost_per_truck_etb: number;
  }>;
  byDestinationProject: Array<{
    unloading_location_name: string;
    company_name: string;
    trip_count: number;
    delivered_m3: number;
    total_revenue_etb: number;
    avg_price_per_m3_etb: number;
    gross_profit_etb: number;
    avg_revenue_per_truck_etb: number;
  }>;
  byTruck: Array<{
    truck_plate: string;
    truck_owner: string;
    trip_count: number;
    delivered_m3: number;
    total_revenue_etb: number;
    total_cost_etb: number;
    gross_profit_etb: number;
    avg_revenue_per_truck_etb: number;
    avg_profit_per_truck_etb: number;
  }>;
  trips: Trip[];
}

export interface TruckPivotTrip {
  id: string;
  trip_date: string;
  truck_id: string;
  truck_plate: string;
  truck_owner: string;
  loading_location_id: string;
  loading_location_name: string;
  loading_datetime?: string | null;
  unloading_location_id: string;
  unloading_location_name: string;
  company_id: string;
  company_name: string;
  project_id?: string;
  project_name?: string;
  sand_type: SandType;
  quantity_loaded_m3: number;
  quantity_delivered_m3: number;
  quantity_remaining_m3: number;
  status: TripStatus;
  status_reason?: string;
  delivery_outcome?: string;
  delivery_proof_ref?: string;
  individual_transport_fee_etb: number;
  transport_rate_etb_per_m3?: number;
  calculated_total_transport_fee_etb?: number;
  truck_capacity_m3?: number | null;
  owner_phone?: string | null;
  truck_total_trips?: number;
  truck_total_delivered_m3?: number;
  created_at: string;
}

export interface TruckPivotGroup {
  truck_id: string;
  truck_plate: string;
  truck_owner: string;
  owner_phone?: string | null;
  capacity_m3: number | null;
  is_active: number;
  total_trips: number;
  calculated_total_transport_fee_etb: number;
  total_delivered_m3: number;
  total_loaded_m3: number;
  total_shortage_m3?: number;
  successful_trips: number;
  partial_trips?: number;
  unsuccessful_trips?: number;
  cancelled_trips: number;
  pending_trips?: number;
  trips: TruckPivotTrip[];
}

export interface TruckTransportPivotData {
  kpis: {
    totalHiredTrucks: number;
    totalTrips: number;
    totalTransportFeesEtb: number;
    avgFeePerTruckEtb: number;
    avgFeePerTripEtb: number;
    totalDeliveredM3: number;
    totalLoadedM3: number;
    successfulTrips: number;
    partialTrips: number;
    cancelledTrips: number;
  };
  truckGroups: TruckPivotGroup[];
  allTripsFlat: TruckPivotTrip[];
}
