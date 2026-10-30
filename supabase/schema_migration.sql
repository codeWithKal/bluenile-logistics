-- ==============================================================================
-- AB Trading (SandTrack Logistics) - Complete Supabase PostgreSQL Schema Migration
-- Run this script in your Supabase Project Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enhance existing tables with any missing columns
-- Users
ALTER TABLE IF EXISTS public.users 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Trucks
ALTER TABLE IF EXISTS public.trucks 
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS capacity_m3 NUMERIC,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Construction Companies
CREATE TABLE IF NOT EXISTS public.construction_companies (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  tin_number TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.construction_companies
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Locations (Crusher Plants / Quarries / Delivery Sites)
CREATE TABLE IF NOT EXISTS public.locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL CHECK(location_type IN ('Loading', 'Unloading', 'Both')),
  address TEXT,
  associated_company_id TEXT REFERENCES public.construction_companies(id) ON DELETE SET NULL,
  associated_project_id TEXT,
  price_sand_00 NUMERIC DEFAULT 950,
  price_sand_01 NUMERIC DEFAULT 1100,
  price_sand_02 NUMERIC DEFAULT 1250,
  selling_price_sand_00 NUMERIC DEFAULT 1600,
  selling_price_sand_01 NUMERIC DEFAULT 1850,
  selling_price_sand_02 NUMERIC DEFAULT 2100,
  latitude NUMERIC,
  longitude NUMERIC,
  contact_person TEXT,
  phone TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.locations
  ADD COLUMN IF NOT EXISTS price_sand_00 NUMERIC DEFAULT 950,
  ADD COLUMN IF NOT EXISTS price_sand_01 NUMERIC DEFAULT 1100,
  ADD COLUMN IF NOT EXISTS price_sand_02 NUMERIC DEFAULT 1250,
  ADD COLUMN IF NOT EXISTS selling_price_sand_00 NUMERIC DEFAULT 1600,
  ADD COLUMN IF NOT EXISTS selling_price_sand_01 NUMERIC DEFAULT 1850,
  ADD COLUMN IF NOT EXISTS selling_price_sand_02 NUMERIC DEFAULT 2100,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Destination Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.construction_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_address TEXT,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  contact_person TEXT,
  phone TEXT,
  price_sand_00 NUMERIC DEFAULT 1600,
  price_sand_01 NUMERIC DEFAULT 1850,
  price_sand_02 NUMERIC DEFAULT 2100,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.projects
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS price_sand_00 NUMERIC DEFAULT 1600,
  ADD COLUMN IF NOT EXISTS price_sand_01 NUMERIC DEFAULT 1850,
  ADD COLUMN IF NOT EXISTS price_sand_02 NUMERIC DEFAULT 2100,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Route Tariffs (Fixed Route Transport Rates)
CREATE TABLE IF NOT EXISTS public.route_tariffs (
  id TEXT PRIMARY KEY,
  origin_location_id TEXT NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  destination_location_id TEXT NOT NULL,
  origin_location_name TEXT,
  destination_location_name TEXT,
  distance_km NUMERIC,
  fee_per_trip_etb NUMERIC NOT NULL DEFAULT 8500,
  rate_per_m3_etb NUMERIC NOT NULL DEFAULT 450,
  fixed_trip_fee_etb NUMERIC DEFAULT 0,
  effective_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(origin_location_id, destination_location_id)
);

ALTER TABLE IF EXISTS public.route_tariffs
  DROP CONSTRAINT IF EXISTS route_tariffs_destination_location_id_fkey;

ALTER TABLE IF EXISTS public.route_tariffs
  ADD COLUMN IF NOT EXISTS origin_location_name TEXT,
  ADD COLUMN IF NOT EXISTS destination_location_name TEXT,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC,
  ADD COLUMN IF NOT EXISTS fee_per_trip_etb NUMERIC NOT NULL DEFAULT 8500,
  ADD COLUMN IF NOT EXISTS fixed_trip_fee_etb NUMERIC DEFAULT 0;

-- Trips
CREATE TABLE IF NOT EXISTS public.trips (
  id TEXT PRIMARY KEY,
  trip_date TEXT NOT NULL,
  truck_id TEXT NOT NULL REFERENCES public.trucks(id) ON DELETE RESTRICT,
  truck_plate TEXT NOT NULL,
  truck_owner TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES public.construction_companies(id) ON DELETE RESTRICT,
  company_name TEXT NOT NULL,
  project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name TEXT,
  loading_location_id TEXT NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  loading_location_name TEXT NOT NULL,
  loading_datetime TEXT,
  sand_type TEXT NOT NULL CHECK(sand_type IN ('00', '01', '02')),
  quantity_loaded_m3 NUMERIC NOT NULL CHECK(quantity_loaded_m3 >= 0),
  loading_notes TEXT,
  unloading_location_id TEXT NOT NULL,
  unloading_location_name TEXT NOT NULL,
  unloading_datetime TEXT,
  quantity_delivered_m3 NUMERIC NOT NULL DEFAULT 0 CHECK(quantity_delivered_m3 >= 0),
  quantity_remaining_m3 NUMERIC NOT NULL DEFAULT 0,
  delivery_outcome TEXT,
  delivery_proof_ref TEXT,
  unloading_notes TEXT,
  status TEXT NOT NULL CHECK(status IN ('Registered', 'Loading', 'Loaded / In Transit', 'Delivered', 'Partially Delivered', 'Unsuccessful', 'Cancelled')),
  status_reason TEXT,
  capacity_warning_acknowledged INTEGER DEFAULT 0,
  unit_cost_etb NUMERIC DEFAULT 0,
  total_cost_etb NUMERIC DEFAULT 0,
  unit_price_etb NUMERIC DEFAULT 0,
  total_revenue_etb NUMERIC DEFAULT 0,
  gross_profit_etb NUMERIC DEFAULT 0,
  shortage_loss_etb NUMERIC DEFAULT 0,
  transport_rate_etb_per_m3 NUMERIC DEFAULT 8500,
  total_transport_fee_etb NUMERIC DEFAULT 8500,
  route_tariff_id TEXT,
  created_by_user_id TEXT,
  created_by_user_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.trips
  DROP CONSTRAINT IF EXISTS trips_unloading_location_id_fkey;

ALTER TABLE IF EXISTS public.trips
  ADD COLUMN IF NOT EXISTS unit_cost_etb NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price_etb NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shortage_loss_etb NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS route_tariff_id TEXT;

-- Trip Status History
CREATE TABLE IF NOT EXISTS public.trip_status_history (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_user_id TEXT NOT NULL,
  changed_by_user_name TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_trips_trip_date ON public.trips(trip_date DESC);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_truck_id ON public.trips(truck_id);
CREATE INDEX IF NOT EXISTS idx_trips_company_id ON public.trips(company_id);
CREATE INDEX IF NOT EXISTS idx_trip_status_history_trip_id ON public.trip_status_history(trip_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_tariffs_origin_dest ON public.route_tariffs(origin_location_id, destination_location_id);

-- Enable Row Level Security (RLS) with permissive access for authenticated API service
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role / backend API full access
DO $$
BEGIN
  DROP POLICY IF EXISTS "Service role access" ON public.users;
  DROP POLICY IF EXISTS "Service role access" ON public.trucks;
  DROP POLICY IF EXISTS "Service role access" ON public.construction_companies;
  DROP POLICY IF EXISTS "Service role access" ON public.locations;
  DROP POLICY IF EXISTS "Service role access" ON public.projects;
  DROP POLICY IF EXISTS "Service role access" ON public.route_tariffs;
  DROP POLICY IF EXISTS "Service role access" ON public.trips;
  DROP POLICY IF EXISTS "Service role access" ON public.trip_status_history;
  DROP POLICY IF EXISTS "Service role access" ON public.audit_logs;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Service role access" ON public.users FOR ALL USING (true);
CREATE POLICY "Service role access" ON public.trucks FOR ALL USING (true);
CREATE POLICY "Service role access" ON public.construction_companies FOR ALL USING (true);
CREATE POLICY "Service role access" ON public.locations FOR ALL USING (true);
CREATE POLICY "Service role access" ON public.projects FOR ALL USING (true);
CREATE POLICY "Service role access" ON public.route_tariffs FOR ALL USING (true);
CREATE POLICY "Service role access" ON public.trips FOR ALL USING (true);
CREATE POLICY "Service role access" ON public.trip_status_history FOR ALL USING (true);
CREATE POLICY "Service role access" ON public.audit_logs FOR ALL USING (true);
