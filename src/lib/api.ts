import {
  User,
  Truck,
  ConstructionCompany,
  Project,
  Location,
  Trip,
  TripStatusHistory,
  DashboardData,
  ReportFilterParams,
  SpecificTruckDossier,
  SpecificCompanyDossier,
  FinancialReportData,
  RouteTariff,
  TruckTransportPivotData,
  AuditLog,
  AuditLogResponse
} from '../types';

class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = localStorage.getItem('sandtrack_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || 'Network request failed', res.status, data);
  }
  return data as T;
}

export const api = {
  // Auth
  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('sandtrack_token', res.token);
    return res;
  },

  async register(data: {
    username: string;
    email: string;
    password: string;
    full_name: string;
    role: 'data_entry' | 'viewer';
  }): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    localStorage.setItem('sandtrack_token', res.token);
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/auth/me');
  },

  async updateProfile(data: { full_name: string; avatar_url?: string | null }): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (res.token) {
      localStorage.setItem('sandtrack_token', res.token);
    }
    return res;
  },

  async changePassword(data: { current_password: string; new_password: string }): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async logout(): Promise<void> {
    localStorage.removeItem('sandtrack_token');
    await request('/auth/logout', { method: 'POST' }).catch(() => {});
  },

  // Users (Admin only)
  async getUsers(): Promise<User[]> {
    return request<User[]>('/users');
  },

  async createUser(user: Partial<User> & { password: string }): Promise<User> {
    return request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  async updateUserRole(id: string, role: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  async updateUser(id: string, user: Partial<User> & { password?: string }): Promise<User> {
    return request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
  },

  async updateUserPassword(id: string, password: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });
  },

  async toggleUserStatus(id: string, is_active: number): Promise<{ success: boolean; id: string; is_active: number; message: string }> {
    return request<{ success: boolean; id: string; is_active: number; message: string }>(`/users/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active }),
    });
  },

  async deleteUser(id: string): Promise<{ success: boolean; id: string; message: string }> {
    return request<{ success: boolean; id: string; message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Audit Logs (Admin only)
  async getAuditLogs(params?: {
    entity_type?: string;
    action?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogResponse> {
    const queryParts: string[] = [];
    if (params?.entity_type) queryParts.push(`entity_type=${encodeURIComponent(params.entity_type)}`);
    if (params?.action) queryParts.push(`action=${encodeURIComponent(params.action)}`);
    if (params?.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
    if (params?.limit !== undefined) queryParts.push(`limit=${params.limit}`);
    if (params?.offset !== undefined) queryParts.push(`offset=${params.offset}`);
    const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return request<AuditLogResponse>(`/audit-logs${qs}`);
  },

  // Trucks
  async getTrucks(): Promise<Truck[]> {
    return request<Truck[]>('/trucks');
  },

  async createTruck(truck: Partial<Truck>): Promise<Truck> {
    return request<Truck>('/trucks', {
      method: 'POST',
      body: JSON.stringify(truck),
    });
  },

  async updateTruck(id: string, truck: Partial<Truck>): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/trucks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(truck),
    });
  },

  async getTruckHistory(id: string): Promise<{ truck: Truck; trips: Trip[] }> {
    return request<{ truck: Truck; trips: Trip[] }>(`/trucks/${id}/history`);
  },

  async deleteTruck(id: string, force: boolean = false): Promise<{ success: boolean; message: string; id: string }> {
    return request<{ success: boolean; message: string; id: string }>(`/trucks/${id}${force ? '?force=true' : ''}`, {
      method: 'DELETE',
    });
  },

  // Companies
  async getCompanies(): Promise<ConstructionCompany[]> {
    return request<ConstructionCompany[]>('/companies');
  },

  async createCompany(comp: Partial<ConstructionCompany>): Promise<ConstructionCompany> {
    return request<ConstructionCompany>('/companies', {
      method: 'POST',
      body: JSON.stringify(comp),
    });
  },

  async updateCompany(id: string, comp: Partial<ConstructionCompany>): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(comp),
    });
  },

  async deleteCompany(id: string, force: boolean = false): Promise<{ success: boolean; message: string; id: string }> {
    return request<{ success: boolean; message: string; id: string }>(`/companies/${id}${force ? '?force=true' : ''}`, {
      method: 'DELETE',
    });
  },

  async getCompanyDetails(id: string): Promise<{ company: ConstructionCompany; projects: Project[]; trips: Trip[]; summary: { totalTrips: number; totalDeliveredM3: number; totalRevenueEtb: number } }> {
    return request(`/companies/${id}/details`);
  },

  // Projects
  async getProjects(companyId?: string): Promise<Project[]> {
    const query = companyId ? `?company_id=${companyId}` : '';
    return request<Project[]>(`/projects${query}`);
  },

  async getProjectDetails(id: string): Promise<{ project: Project; company?: ConstructionCompany; trips: Trip[]; summary: { totalTrips: number; totalDeliveredM3: number; totalRevenueEtb: number } }> {
    return request(`/projects/${id}/details`);
  },

  async createProject(proj: Partial<Project>): Promise<Project> {
    return request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(proj),
    });
  },

  async updateProject(id: string, proj: Partial<Project>): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(proj),
    });
  },

  async deleteProject(id: string, force: boolean = false): Promise<{ success: boolean; message: string; id: string }> {
    return request<{ success: boolean; message: string; id: string }>(`/projects/${id}${force ? '?force=true' : ''}`, {
      method: 'DELETE',
    });
  },

  // Locations
  async getLocations(type?: 'Loading' | 'Unloading', activeOnly: boolean = false): Promise<Location[]> {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (activeOnly) params.set('active_only', 'true');
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<Location[]>(`/locations${qs}`);
  },

  async getLocationDetails(id: string): Promise<{ location: Location; isCrusher: boolean; trips: Trip[]; summary: { totalTrips: number; totalLoadedM3?: number; totalDeliveredM3?: number } }> {
    return request(`/locations/${id}/details`);
  },

  async createLocation(loc: Partial<Location>): Promise<Location> {
    return request<Location>('/locations', {
      method: 'POST',
      body: JSON.stringify(loc),
    });
  },

  async updateLocation(id: string, loc: Partial<Location>): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(loc),
    });
  },

  async deleteLocation(id: string, force: boolean = false): Promise<{ success: boolean; message: string; id: string }> {
    return request<{ success: boolean; message: string; id: string }>(`/locations/${id}${force ? '?force=true' : ''}`, {
      method: 'DELETE',
    });
  },

  // Route Transport Tariffs (Fixed Route Transport Fees)
  async getRouteTariffs(): Promise<RouteTariff[]> {
    return request<RouteTariff[]>('/route-tariffs');
  },

  async lookupRouteTariff(originId: string, destinationId: string): Promise<{ found: boolean; tariff: RouteTariff }> {
    return request<{ found: boolean; tariff: RouteTariff }>(
      `/route-tariffs/lookup?origin_id=${encodeURIComponent(originId)}&destination_id=${encodeURIComponent(destinationId)}`
    );
  },

  async createRouteTariff(tariff: Partial<RouteTariff>): Promise<{ success: boolean; rate_per_m3_etb: number }> {
    return request('/route-tariffs', {
      method: 'POST',
      body: JSON.stringify(tariff),
    });
  },

  async updateRouteTariff(id: string, tariff: Partial<RouteTariff>): Promise<{ success: boolean; rate_per_m3_etb: number }> {
    return request(`/route-tariffs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tariff),
    });
  },

  async deleteRouteTariff(id: string): Promise<{ success: boolean; message: string; id: string }> {
    return request<{ success: boolean; message: string; id: string }>(`/route-tariffs/${id}`, {
      method: 'DELETE',
    });
  },

  // Trips
  async getTrips(filters: Record<string, any> = {}): Promise<{ total: number; limit: number; offset: number; trips: Trip[] }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.set(k, String(v));
      }
    });
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ total: number; limit: number; offset: number; trips: Trip[] }>(`/trips${qs}`);
  },

  async getTrip(id: string): Promise<{ trip: Trip; history: TripStatusHistory[]; truck?: Truck }> {
    return request<{ trip: Trip; history: TripStatusHistory[]; truck?: Truck }>(`/trips/${id}`);
  },

  async checkDuplicateTrip(payload: {
    truck_id: string;
    trip_date: string;
    loading_location_id: string;
    unloading_location_id: string;
    sand_type: string;
    exclude_trip_id?: string;
  }): Promise<{ duplicate: boolean; existingTrip?: any; message?: string }> {
    return request('/trips/check-duplicate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async createTrip(tripData: any): Promise<Trip> {
    return request<Trip>('/trips', {
      method: 'POST',
      body: JSON.stringify(tripData),
    });
  },

  async updateTrip(id: string, tripData: any): Promise<Trip> {
    return request<Trip>(`/trips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tripData),
    });
  },

  async deleteTrip(id: string): Promise<{ success: boolean; message: string; id: string }> {
    return request<{ success: boolean; message: string; id: string }>(`/trips/${id}`, {
      method: 'DELETE',
    });
  },

  // Dashboard Analytics
  async getDashboardAnalytics(filters: ReportFilterParams = {}): Promise<DashboardData> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.set(k, String(v));
      }
    });
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<DashboardData>(`/analytics/dashboard${qs}`);
  },

  // Reports
  async getTruckPerformanceReport(filters: ReportFilterParams = {}): Promise<any[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    return request<any[]>(`/reports/truck-performance?${params.toString()}`);
  },

  async getSingleTruckReport(truckId: string, filters: ReportFilterParams = {}): Promise<SpecificTruckDossier> {
    const params = new URLSearchParams();
    params.set('truck_id', truckId);
    Object.entries(filters).forEach(([k, v]) => {
      if (k !== 'truck_id' && v !== undefined && v !== null && v !== '') {
        params.set(k, String(v));
      }
    });
    return request<SpecificTruckDossier>(`/reports/single-truck?${params.toString()}`);
  },

  async getSingleCompanyReport(companyId: string, filters: ReportFilterParams = {}): Promise<SpecificCompanyDossier> {
    const params = new URLSearchParams();
    params.set('company_id', companyId);
    Object.entries(filters).forEach(([k, v]) => {
      if (k !== 'company_id' && v !== undefined && v !== null && v !== '') {
        params.set(k, String(v));
      }
    });
    return request<SpecificCompanyDossier>(`/reports/single-company?${params.toString()}`);
  },

  async getSandTypeReport(filters: ReportFilterParams = {}): Promise<any[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    return request<any[]>(`/reports/sand-type?${params.toString()}`);
  },

  async getDestinationReport(filters: ReportFilterParams = {}): Promise<any[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    return request<any[]>(`/reports/destinations?${params.toString()}`);
  },

  async getLoadingPointReport(filters: ReportFilterParams = {}): Promise<any[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    return request<any[]>(`/reports/loading-points?${params.toString()}`);
  },

  async getCompanyProjectReport(filters: ReportFilterParams = {}): Promise<any[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    return request<any[]>(`/reports/companies-projects?${params.toString()}`);
  },

  async getTimeSummaryReport(filters: ReportFilterParams = {}, period: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<any[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    params.set('period', period);
    return request<any[]>(`/reports/time-summary?${params.toString()}`);
  },

  async getDetailedRegisterReport(filters: ReportFilterParams = {}): Promise<any[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    return request<any[]>(`/reports/detailed-register?${params.toString()}`);
  },

  async getExceptionsReport(filters: ReportFilterParams = {}): Promise<any[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    return request<any[]>(`/reports/exceptions?${params.toString()}`);
  },

  async getFinancialReport(filters: ReportFilterParams = {}): Promise<FinancialReportData> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    return request<FinancialReportData>(`/reports/financial?${params.toString()}`);
  },

  async getTruckTransportPivotReport(filters: ReportFilterParams = {}): Promise<TruckTransportPivotData> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    return request<TruckTransportPivotData>(`/reports/truck-transport-pivot?${params.toString()}`);
  },

  async getCloudBackupStatus(): Promise<any> {
    return request<any>('/system/cloud-backup');
  },

  async getCloudBackupsList(): Promise<Array<{
    name: string;
    path: string;
    sizeBytes: number;
    sizeKb: number;
    updatedAt: string;
    dateKey?: string;
    isDaily: boolean;
  }>> {
    return request<any[]>('/system/cloud-backups');
  },

  async syncCloudBackup(): Promise<{ success: boolean; message: string; sizeBytes?: number; snapshotName?: string }> {
    return request<any>('/system/cloud-backup/sync', {
      method: 'POST',
    });
  },

  async pruneCloudBackups(): Promise<{ success: boolean; deletedCount: number; retainedCount: number; message: string }> {
    return request<any>('/system/cloud-backups/prune', {
      method: 'POST',
    });
  },

  async deleteCloudBackup(filename: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/system/cloud-backups/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
  },

  async restoreCloudBackup(file: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>('/system/cloud-backups/restore', {
      method: 'POST',
      body: JSON.stringify({ file }),
    });
  },

  async runSupabaseMigration(): Promise<{
    success: boolean;
    results: Array<{ table: string; sqliteRows: number; migratedRows: number; success: boolean; error?: string }>;
    summary: string;
  }> {
    return request<any>('/system/migrate-to-supabase', {
      method: 'POST',
    });
  },
};
