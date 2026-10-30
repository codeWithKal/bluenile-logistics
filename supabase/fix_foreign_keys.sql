-- ==============================================================================
-- AB Trading (SandTrack Logistics) - Destination Project Constraint Fix
-- Run this short script in your Supabase Project -> SQL Editor -> Run
-- ==============================================================================

-- 1. Remove the outdated foreign key pointing to locations for destination projects
ALTER TABLE public.route_tariffs 
  DROP CONSTRAINT IF EXISTS route_tariffs_destination_location_id_fkey;

-- 2. Optional: connect destination_location_id to projects table
ALTER TABLE public.route_tariffs 
  ADD CONSTRAINT route_tariffs_destination_location_id_fkey 
  FOREIGN KEY (destination_location_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- 3. Remove the outdated foreign key pointing to locations for trip unloading
ALTER TABLE public.trips 
  DROP CONSTRAINT IF EXISTS trips_unloading_location_id_fkey;

-- 4. Optional: connect unloading_location_id to projects table
ALTER TABLE public.trips 
  ADD CONSTRAINT trips_unloading_location_id_fkey 
  FOREIGN KEY (unloading_location_id) REFERENCES public.projects(id) ON DELETE RESTRICT;
