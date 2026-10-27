import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
import bcrypt from 'bcryptjs';
import {
  SEED_TRUCKS,
  SEED_COMPANIES,
  SEED_CRUSHERS,
  SEED_PROJECTS
} from './seedData';

const DB_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(process.cwd(), 'data');
const DB_PATH = path.resolve(DB_DIR, 'sand_logistics.sqlite');

interface SupabaseConfig {
  url: string;
  key: string;
  bucket: string;
}

let supabaseSyncDisabled = false;
let supabaseWarningLogged = false;

function getSupabaseConfig(): SupabaseConfig | null {
  if (supabaseSyncDisabled) return null;

  const rawUrl = process.env.SUPABASE_URL;
  const rawKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rawBucket = process.env.STORAGE_BUCKET || 'sandtrack-db';

  if (!rawUrl || !rawKey) return null;

  // Trim and strip accidental surrounding quotes
  const url = rawUrl.trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
  const key = rawKey.trim().replace(/^["']|["']$/g, '');
  const bucket = rawBucket.trim().replace(/^["']|["']$/g, '');

  if (!url || !key || !bucket) return null;

  // Check for placeholder URLs
  if (
    (!url.startsWith('http://') && !url.startsWith('https://')) ||
    url.includes('your-project-ref') ||
    url.includes('example.com')
  ) {
    if (!supabaseWarningLogged) {
      console.log('[Supabase Cloud Backup] Unconfigured or placeholder SUPABASE_URL detected. Running in local SQLite mode.');
      supabaseWarningLogged = true;
    }
    supabaseSyncDisabled = true;
    return null;
  }

  // Check for placeholder keys
  if (
    key.includes('your-supabase') ||
    key.includes('your-service-role') ||
    key.includes('MY_SUPABASE') ||
    key.includes('placeholder') ||
    key.length < 25
  ) {
    if (!supabaseWarningLogged) {
      console.log('[Supabase Cloud Backup] Placeholder SUPABASE_KEY detected. Running in local SQLite mode.');
      supabaseWarningLogged = true;
    }
    supabaseSyncDisabled = true;
    return null;
  }

  // Supabase JWT keys (anon/service_role) must follow Compact JWS format: 3 base64 segments separated by dots
  // Alternatively, Supabase personal access tokens start with 'sbp_'
  const isJwt = key.split('.').length === 3;
  const isPersonalToken = key.startsWith('sbp_');

  if (!isJwt && !isPersonalToken) {
    if (!supabaseWarningLogged) {
      console.log('[Supabase Cloud Backup] SUPABASE_KEY is not a valid Compact JWS JWT or token. Running in local SQLite mode.');
      supabaseWarningLogged = true;
    }
    supabaseSyncDisabled = true;
    return null;
  }

  return { url, key, bucket };
}

async function downloadCloudBackup(): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config) return false;

  try {
    const endpoints = [
      `${config.url}/storage/v1/object/${config.bucket}/sand_logistics.sqlite`,
      `${config.url}/storage/v1/object/authenticated/${config.bucket}/sand_logistics.sqlite`,
      `${config.url}/storage/v1/object/public/${config.bucket}/sand_logistics.sqlite`
    ];

    for (const endpointUrl of endpoints) {
      try {
        const res = await fetch(endpointUrl, {
          headers: {
            apikey: config.key,
            Authorization: `Bearer ${config.key}`
          },
        });
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          if (arrayBuffer.byteLength > 0) {
            fs.writeFileSync(DB_PATH, Buffer.from(arrayBuffer));
            console.log(`[Supabase Cloud Backup] Successfully restored SQLite database from bucket "${config.bucket}".`);
            return true;
          }
        } else if (res.status === 400 || res.status === 401 || res.status === 403) {
          const errText = await res.text().catch(() => '');
          if (errText.includes('Invalid Compact JWS') || errText.includes('AccessDenied') || errText.includes('Unauthorized')) {
            console.warn(`[Supabase Cloud Backup] Authentication check returned HTTP ${res.status}. Falling back to local SQLite storage.`);
            supabaseSyncDisabled = true;
            return false;
          }
        }
      } catch (_e) {
        // try next endpoint
      }
    }
  } catch (err) {
    console.warn('[Supabase Cloud Backup] Could not fetch cloud backup:', err);
  }
  return false;
}

let uploadTimeout: NodeJS.Timeout | null = null;
function uploadCloudBackup() {
  const config = getSupabaseConfig();
  if (!config || !db) return;

  if (uploadTimeout) clearTimeout(uploadTimeout);
  uploadTimeout = setTimeout(async () => {
    try {
      const activeConfig = getSupabaseConfig();
      if (!activeConfig || !db) return;

      const data = db.export();
      const buffer = Buffer.from(data);
      const url = `${activeConfig.url}/storage/v1/object/${activeConfig.bucket}/sand_logistics.sqlite`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: activeConfig.key,
          Authorization: `Bearer ${activeConfig.key}`,
          'x-upsert': 'true',
          'Content-Type': 'application/x-sqlite3',
        },
        body: buffer,
      });

      if (res.ok) {
        console.log(`[Supabase Cloud Backup] Successfully backed up SQLite database to "${activeConfig.bucket}".`);
      } else {
        const errText = await res.text().catch(() => '');
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          console.warn(`[Supabase Cloud Backup] Supabase rejected credentials (HTTP ${res.status}: ${errText}). Disabling cloud backup. Running safely in local SQLite mode.`);
          supabaseSyncDisabled = true;
        } else {
          console.warn(`[Supabase Cloud Backup] Upload returned HTTP ${res.status}: ${errText}`);
        }
      }
    } catch (err) {
      console.warn('[Supabase Cloud Backup] Failed to upload database backup:', err);
    }
  }, 1000);
}

let SQL: SqlJsStatic;
let db: Database;

export async function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Restore from free cloud storage if configured
  await downloadCloudBackup();

  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Disable foreign keys during startup schema migrations and seeding
  db.run('PRAGMA foreign_keys = OFF;');

  // Create tables
  createTables();
  migrateUserAvatar();
  seedInitialData();
  migrateCrusherLocations();
  migrateFinancialColumns();
  migrateRouteTransportFees();
  migrateCrusherOnlyAndProjectDestinations();
  seedEthiopianSampleData();
  migrateInitialUserAuditLogs();

  // Re-enable foreign keys for operations
  db.run('PRAGMA foreign_keys = ON;');
  saveDb();

  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  uploadCloudBackup();
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'data_entry', 'viewer')),
      avatar_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trucks (
      id TEXT PRIMARY KEY,
      plate_number TEXT UNIQUE NOT NULL,
      owner_name TEXT NOT NULL,
      capacity_m3 REAL,
      owner_phone TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS construction_companies (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      contact_person TEXT,
      phone TEXT,
      address TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company_id TEXT NOT NULL REFERENCES construction_companies(id),
      address TEXT,
      latitude REAL,
      longitude REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location_type TEXT NOT NULL CHECK(location_type IN ('Loading', 'Unloading', 'Both')),
      address TEXT,
      associated_company_id TEXT REFERENCES construction_companies(id),
      associated_project_id TEXT REFERENCES projects(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      trip_date TEXT NOT NULL,
      truck_id TEXT NOT NULL REFERENCES trucks(id),
      truck_plate TEXT NOT NULL,
      truck_owner TEXT NOT NULL,
      company_id TEXT NOT NULL REFERENCES construction_companies(id),
      company_name TEXT NOT NULL,
      project_id TEXT REFERENCES projects(id),
      project_name TEXT,
      loading_location_id TEXT NOT NULL REFERENCES locations(id),
      loading_location_name TEXT NOT NULL,
      loading_datetime TEXT,
      sand_type TEXT NOT NULL CHECK(sand_type IN ('00', '01', '02')),
      quantity_loaded_m3 REAL NOT NULL CHECK(quantity_loaded_m3 >= 0),
      loading_notes TEXT,
      unloading_location_id TEXT NOT NULL REFERENCES locations(id),
      unloading_location_name TEXT NOT NULL,
      unloading_datetime TEXT,
      quantity_delivered_m3 REAL NOT NULL DEFAULT 0 CHECK(quantity_delivered_m3 >= 0),
      quantity_remaining_m3 REAL NOT NULL DEFAULT 0,
      delivery_outcome TEXT,
      delivery_proof_ref TEXT,
      unloading_notes TEXT,
      status TEXT NOT NULL CHECK(status IN ('Registered', 'Loading', 'Loaded / In Transit', 'Delivered', 'Partially Delivered', 'Unsuccessful', 'Cancelled')),
      status_reason TEXT,
      capacity_warning_acknowledged INTEGER DEFAULT 0,
      created_by_user_id TEXT,
      created_by_user_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trip_status_history (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL REFERENCES trips(id),
      previous_status TEXT,
      new_status TEXT NOT NULL,
      changed_by_user_id TEXT NOT NULL,
      changed_by_user_name TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

function seedInitialData() {
  const userCountRes = db.exec('SELECT COUNT(*) as count FROM users');
  const count = (userCountRes[0]?.values[0]?.[0] as number) || 0;
  if (count > 0) return;

  const now = new Date().toISOString();
  const passwordSalt = bcrypt.genSaltSync(10);
  const defaultPasswordHash = bcrypt.hashSync('sandtrack123', passwordSalt);

  // 1. Initial Users
  const initialUsers = [
    {
      id: 'usr_admin',
      username: 'admin',
      email: 'admin@sandtrack.local',
      password_hash: defaultPasswordHash,
      full_name: 'System Administrator',
      role: 'admin',
      created_at: now,
      updated_at: now
    },
    {
      id: 'usr_operator',
      username: 'operator',
      email: 'operator@sandtrack.local',
      password_hash: defaultPasswordHash,
      full_name: 'Elena Vance (Dispatcher)',
      role: 'data_entry',
      created_at: now,
      updated_at: now
    },
    {
      id: 'usr_viewer',
      username: 'viewer',
      email: 'viewer@sandtrack.local',
      password_hash: defaultPasswordHash,
      full_name: 'Marcus Brody (Auditor)',
      role: 'viewer',
      created_at: now,
      updated_at: now
    }
  ];

  for (const u of initialUsers) {
    db.run(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.username, u.email, u.password_hash, u.full_name, u.role, u.created_at, u.updated_at]
    );
  }

  // 2. Initial External Trucks
  const initialTrucks = [
    { id: 'TRK-001', plate_number: 'TX-4892-A', owner_name: 'Apex Haulage Logistics', capacity_m3: 22.00, owner_phone: '+1 555-0192', notes: 'Tri-axle Mack Granite, heavy duty' },
    { id: 'TRK-002', plate_number: 'TX-7731-B', owner_name: 'Falcon Transport LLC', capacity_m3: 18.50, owner_phone: '+1 555-0245', notes: 'Tandem dump truck' },
    { id: 'TRK-003', plate_number: 'TX-1054-C', owner_name: 'Rodriguez Independent Hauling', capacity_m3: 25.00, owner_phone: '+1 555-0318', notes: 'Heavy quad-axle end dump' },
    { id: 'TRK-004', plate_number: 'TX-9280-D', owner_name: 'Lone Star Aggregate Transport', capacity_m3: 20.00, owner_phone: '+1 555-0472', notes: 'Reliable weekend operator' },
    { id: 'TRK-005', plate_number: 'TX-3319-E', owner_name: 'Barton Brothers Trucking', capacity_m3: 24.00, owner_phone: '+1 555-0589', notes: 'Kenworth W900, high sideboards' },
    { id: 'TRK-006', plate_number: 'TX-6120-F', owner_name: 'Falcon Transport LLC', capacity_m3: 18.00, owner_phone: '+1 555-0245', notes: 'Secondary unit for Falcon' }
  ];

  for (const t of initialTrucks) {
    db.run(
      `INSERT INTO trucks (id, plate_number, owner_name, capacity_m3, owner_phone, is_active, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [t.id, t.plate_number, t.owner_name, t.capacity_m3, t.owner_phone, t.notes, now, now]
    );
  }

  // 3. Construction Companies
  const initialCompanies = [
    { id: 'CMP-001', name: 'Metroplex Infrastructure Partners', contact_person: 'David Chen', phone: '+1 555-1101', address: '400 Northway Blvd, Suite 800', notes: 'Civil engineering & municipal highway projects' },
    { id: 'CMP-002', name: 'Vanguard Commercial Builders', contact_person: 'Sarah Jenkins', phone: '+1 555-1202', address: '125 Industrial Parkway', notes: 'Commercial tilt-wall and distribution centers' },
    { id: 'CMP-003', name: 'Summit Horizon Residential', contact_person: 'Carlos Mendez', phone: '+1 555-1303', address: '880 Creekview Drive', notes: 'Master planned residential community developments' },
    { id: 'CMP-004', name: 'Keystone Concrete & Paving', contact_person: 'Brian Kelly', phone: '+1 555-1404', address: '910 Quarry Road', notes: 'Ready-mix batch plant operator' }
  ];

  for (const c of initialCompanies) {
    db.run(
      `INSERT INTO construction_companies (id, name, contact_person, phone, address, is_active, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [c.id, c.name, c.contact_person, c.phone, c.address, c.notes, now, now]
    );
  }

  // 4. Projects
  const initialProjects = [
    { id: 'PRJ-001', name: 'Highway 35 Interchange Expansion', company_id: 'CMP-001', address: 'Mile Marker 142, North Corridor', notes: 'Sub-base compaction sand' },
    { id: 'PRJ-002', name: 'Gateway Logistics Center Phase 2', company_id: 'CMP-002', address: 'Lot 14 Gateway Commerce Park', notes: 'Structural slab foundation pad' },
    { id: 'PRJ-003', name: 'Oakridge Estates Sector 4', company_id: 'CMP-003', address: 'Oakridge Blvd & Meadow Way', notes: 'Trench backfill and paving prep' },
    { id: 'PRJ-004', name: 'Airport South Taxiway Rehabilitation', company_id: 'CMP-001', address: 'Airport Perimeter Rd Gate 9', notes: 'FAA graded spec sand' },
    { id: 'PRJ-005', name: 'Keystone Main Batch Plant Silo Feed', company_id: 'CMP-004', address: '910 Quarry Road, Silo Yard', notes: 'Continuous ready-mix aggregate feed' }
  ];

  for (const p of initialProjects) {
    db.run(
      `INSERT INTO projects (id, name, company_id, address, is_active, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      [p.id, p.name, p.company_id, p.address, p.notes, now, now]
    );
  }

  // 5. Locations (Crusher Sites for Loading, Construction Sites for Unloading, Both)
  const initialLocations = [
    { id: 'LOC-001', name: 'Red River Sand Crusher Plant #1', location_type: 'Loading', address: 'County Road 214, River Valley', associated_company_id: null, associated_project_id: null, notes: 'Primary crusher station for fine grade 00 and 01 sand' },
    { id: 'LOC-002', name: 'Trinity Basin Sand Crusher Depot', location_type: 'Loading', address: 'East Basin Access Gate B', associated_company_id: null, associated_project_id: null, notes: 'Heavy rotary crusher plant for washed aggregate 02' },
    { id: 'LOC-003', name: 'Clear Creek Quarry & Crusher Terminal', location_type: 'Loading', address: 'Highway 183 South Bypass', associated_company_id: null, associated_project_id: null, notes: 'Automated high-capacity jaw & cone crusher hoppers' },
    { id: 'LOC-004', name: 'HWY 35 Interchange Construction Site (Pier 7)', location_type: 'Unloading', address: 'Interstate 35 Pier Section 7', associated_company_id: 'CMP-001', associated_project_id: 'PRJ-001', notes: 'Direct dump to construction staging trench' },
    { id: 'LOC-005', name: 'Gateway Logistics Construction Site Phase 2', location_type: 'Unloading', address: 'Lot 14 Commerce Park, Gate 3', associated_company_id: 'CMP-002', associated_project_id: 'PRJ-002', notes: 'Foundation pad compaction unloading area' },
    { id: 'LOC-006', name: 'Oakridge Estates Sector 4 Construction Site', location_type: 'Unloading', address: 'Sector 4 Staging Point', associated_company_id: 'CMP-003', associated_project_id: 'PRJ-003', notes: 'Utility trench backfill dump point' },
    { id: 'LOC-007', name: 'Keystone Concrete Construction Site & Silos', location_type: 'Both', address: '910 Quarry Road Batch Facility', associated_company_id: 'CMP-004', associated_project_id: 'PRJ-005', notes: 'On-site secondary crusher and ready-mix receiver' },
    { id: 'LOC-008', name: 'Regional Municipal Stockpile Yard', location_type: 'Both', address: 'Public Works Depot, East Loop', associated_company_id: null, associated_project_id: null, notes: 'Dual-purpose transfer stockpile site' }
  ];

  for (const loc of initialLocations) {
    db.run(
      `INSERT INTO locations (id, name, location_type, address, associated_company_id, associated_project_id, is_active, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [loc.id, loc.name, loc.location_type, loc.address, loc.associated_company_id, loc.associated_project_id, loc.notes, now, now]
    );
  }

  // 6. Realistic Seed Trips covering all trucks, statuses, sand types (00, 01, 02), partial deliveries, and outcomes
  const dateBase = new Date();
  const dStr = (offsetDays: number) => {
    const d = new Date(dateBase);
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString().split('T')[0];
  };

  const initialTrips = [
    {
      id: 'TRP-2026-0001',
      trip_date: dStr(5),
      truck_id: 'TRK-001',
      truck_plate: 'TX-4892-A',
      truck_owner: 'Apex Haulage Logistics',
      company_id: 'CMP-001',
      company_name: 'Metroplex Infrastructure Partners',
      project_id: 'PRJ-001',
      project_name: 'Highway 35 Interchange Expansion',
      loading_location_id: 'LOC-001',
      loading_location_name: 'Red River Sand Crusher Plant #1',
      loading_datetime: `${dStr(5)}T07:15:00Z`,
      sand_type: '00',
      quantity_loaded_m3: 20.00,
      loading_notes: 'Moisture content nominal, scale certified at crusher hopper',
      unloading_location_id: 'LOC-004',
      unloading_location_name: 'HWY 35 Interchange Construction Site (Pier 7)',
      unloading_datetime: `${dStr(5)}T09:30:00Z`,
      quantity_delivered_m3: 20.00,
      quantity_remaining_m3: 0.00,
      delivery_outcome: 'Delivered',
      delivery_proof_ref: 'POD-88102',
      unloading_notes: 'Site supervisor J. Martinez signed ticket',
      status: 'Delivered',
      status_reason: 'Full delivery verified against site scale',
      capacity_warning_acknowledged: 0,
      created_by_user_id: 'usr_operator',
      created_by_user_name: 'Elena Vance (Dispatcher)',
      created_at: `${dStr(5)}T07:00:00Z`,
      updated_at: `${dStr(5)}T10:00:00Z`
    },
    {
      id: 'TRP-2026-0002',
      trip_date: dStr(4),
      truck_id: 'TRK-002',
      truck_plate: 'TX-7731-B',
      truck_owner: 'Falcon Transport LLC',
      company_id: 'CMP-002',
      company_name: 'Vanguard Commercial Builders',
      project_id: 'PRJ-002',
      project_name: 'Gateway Logistics Center Phase 2',
      loading_location_id: 'LOC-002',
      loading_location_name: 'Trinity Basin Sand Crusher Depot',
      loading_datetime: `${dStr(4)}T08:00:00Z`,
      sand_type: '01',
      quantity_loaded_m3: 18.00,
      loading_notes: 'Medium coarse grain 01 from secondary cone crusher',
      unloading_location_id: 'LOC-005',
      unloading_location_name: 'Gateway Logistics Construction Site Phase 2',
      unloading_datetime: `${dStr(4)}T11:15:00Z`,
      quantity_delivered_m3: 14.50,
      quantity_remaining_m3: 3.50,
      delivery_outcome: 'Partial Delivery',
      delivery_proof_ref: 'POD-88190',
      unloading_notes: 'Excavator clearance limited; customer requested halting dump due to trench wall stability.',
      status: 'Partially Delivered',
      status_reason: 'Site trench stability risk stopped unloading before completion; 3.50 m³ returned to hopper',
      capacity_warning_acknowledged: 0,
      created_by_user_id: 'usr_operator',
      created_by_user_name: 'Elena Vance (Dispatcher)',
      created_at: `${dStr(4)}T07:45:00Z`,
      updated_at: `${dStr(4)}T11:45:00Z`
    },
    {
      id: 'TRP-2026-0003',
      trip_date: dStr(3),
      truck_id: 'TRK-003',
      truck_plate: 'TX-1054-C',
      truck_owner: 'Rodriguez Independent Hauling',
      company_id: 'CMP-003',
      company_name: 'Summit Horizon Residential',
      project_id: 'PRJ-003',
      project_name: 'Oakridge Estates Sector 4',
      loading_location_id: 'LOC-003',
      loading_location_name: 'Clear Creek Quarry & Crusher Terminal',
      loading_datetime: `${dStr(3)}T06:40:00Z`,
      sand_type: '02',
      quantity_loaded_m3: 24.00,
      loading_notes: 'Heavy coarse sand 02 for road bedding',
      unloading_location_id: 'LOC-006',
      unloading_location_name: 'Oakridge Estates Sector 4 Construction Site',
      unloading_datetime: `${dStr(3)}T09:10:00Z`,
      quantity_delivered_m3: 0.00,
      quantity_remaining_m3: 24.00,
      delivery_outcome: 'Access Blocked',
      delivery_proof_ref: null,
      unloading_notes: 'Main residential access culvert flooded following thunderstorm. Truck could not enter safety apron.',
      status: 'Unsuccessful',
      status_reason: 'Severe site access blockage due to flash flooding; delivery aborted',
      capacity_warning_acknowledged: 0,
      created_by_user_id: 'usr_operator',
      created_by_user_name: 'Elena Vance (Dispatcher)',
      created_at: `${dStr(3)}T06:30:00Z`,
      updated_at: `${dStr(3)}T10:00:00Z`
    },
    {
      id: 'TRP-2026-0004',
      trip_date: dStr(2),
      truck_id: 'TRK-004',
      truck_plate: 'TX-9280-D',
      truck_owner: 'Lone Star Aggregate Transport',
      company_id: 'CMP-004',
      company_name: 'Keystone Concrete & Paving',
      project_id: 'PRJ-005',
      project_name: 'Keystone Main Batch Plant Silo Feed',
      loading_location_id: 'LOC-001',
      loading_location_name: 'Red River Sand Crusher Plant #1',
      loading_datetime: `${dStr(2)}T10:00:00Z`,
      sand_type: '00',
      quantity_loaded_m3: 19.50,
      loading_notes: 'Silo intake load from crusher stockpile A',
      unloading_location_id: 'LOC-007',
      unloading_location_name: 'Keystone Concrete Construction Site & Silos',
      unloading_datetime: `${dStr(2)}T12:30:00Z`,
      quantity_delivered_m3: 19.50,
      quantity_remaining_m3: 0.00,
      delivery_outcome: 'Delivered',
      delivery_proof_ref: 'POD-88241',
      unloading_notes: 'Dumped directly into aggregate chute 3',
      status: 'Delivered',
      status_reason: 'Successful batch delivery',
      capacity_warning_acknowledged: 0,
      created_by_user_id: 'usr_operator',
      created_by_user_name: 'Elena Vance (Dispatcher)',
      created_at: `${dStr(2)}T09:40:00Z`,
      updated_at: `${dStr(2)}T13:00:00Z`
    },
    {
      id: 'TRP-2026-0005',
      trip_date: dStr(2),
      truck_id: 'TRK-005',
      truck_plate: 'TX-3319-E',
      truck_owner: 'Barton Brothers Trucking',
      company_id: 'CMP-001',
      company_name: 'Metroplex Infrastructure Partners',
      project_id: 'PRJ-004',
      project_name: 'Airport South Taxiway Rehabilitation',
      loading_location_id: 'LOC-003',
      loading_location_name: 'Clear Creek Quarry & Crusher Terminal',
      loading_datetime: `${dStr(2)}T13:30:00Z`,
      sand_type: '01',
      quantity_loaded_m3: 23.00,
      loading_notes: 'FAA certified grade 01',
      unloading_location_id: 'LOC-008',
      unloading_location_name: 'Regional Municipal Stockpile Yard',
      unloading_datetime: `${dStr(2)}T16:15:00Z`,
      quantity_delivered_m3: 23.00,
      quantity_remaining_m3: 0.00,
      delivery_outcome: 'Delivered',
      delivery_proof_ref: 'POD-88299',
      unloading_notes: 'Received by airport security escort dispatcher',
      status: 'Delivered',
      status_reason: 'Full delivery verified',
      capacity_warning_acknowledged: 0,
      created_by_user_id: 'usr_operator',
      created_by_user_name: 'Elena Vance (Dispatcher)',
      created_at: `${dStr(2)}T13:00:00Z`,
      updated_at: `${dStr(2)}T16:30:00Z`
    },
    {
      id: 'TRP-2026-0006',
      trip_date: dStr(1),
      truck_id: 'TRK-001',
      truck_plate: 'TX-4892-A',
      truck_owner: 'Apex Haulage Logistics',
      company_id: 'CMP-002',
      company_name: 'Vanguard Commercial Builders',
      project_id: 'PRJ-002',
      project_name: 'Gateway Logistics Center Phase 2',
      loading_location_id: 'LOC-001',
      loading_location_name: 'Red River Sand Crusher Plant #1',
      loading_datetime: `${dStr(1)}T08:15:00Z`,
      sand_type: '02',
      quantity_loaded_m3: 21.00,
      loading_notes: '',
      unloading_location_id: 'LOC-005',
      unloading_location_name: 'Gateway Logistics Construction Site Phase 2',
      unloading_datetime: null,
      quantity_delivered_m3: 0.00,
      quantity_remaining_m3: 21.00,
      delivery_outcome: 'Cancelled',
      delivery_proof_ref: null,
      unloading_notes: 'Client halted concrete pour due to heavy frost notice',
      status: 'Cancelled',
      status_reason: 'Project manager cancelled concrete batch schedule due to sudden weather freeze',
      capacity_warning_acknowledged: 0,
      created_by_user_id: 'usr_operator',
      created_by_user_name: 'Elena Vance (Dispatcher)',
      created_at: `${dStr(1)}T08:00:00Z`,
      updated_at: `${dStr(1)}T09:00:00Z`
    },
    {
      id: 'TRP-2026-0007',
      trip_date: dStr(0),
      truck_id: 'TRK-003',
      truck_plate: 'TX-1054-C',
      truck_owner: 'Rodriguez Independent Hauling',
      company_id: 'CMP-001',
      company_name: 'Metroplex Infrastructure Partners',
      project_id: 'PRJ-001',
      project_name: 'Highway 35 Interchange Expansion',
      loading_location_id: 'LOC-001',
      loading_location_name: 'Red River Sand Crusher Plant #1',
      loading_datetime: `${dStr(0)}T07:45:00Z`,
      sand_type: '00',
      quantity_loaded_m3: 22.50,
      loading_notes: 'Morning priority dispatch from primary crusher',
      unloading_location_id: 'LOC-004',
      unloading_location_name: 'HWY 35 Interchange Construction Site (Pier 7)',
      unloading_datetime: null,
      quantity_delivered_m3: 0.00,
      quantity_remaining_m3: 22.50,
      delivery_outcome: 'Pending',
      delivery_proof_ref: null,
      unloading_notes: 'En route to Highway 35 site',
      status: 'Loaded / In Transit',
      status_reason: null,
      capacity_warning_acknowledged: 0,
      created_by_user_id: 'usr_operator',
      created_by_user_name: 'Elena Vance (Dispatcher)',
      created_at: `${dStr(0)}T07:30:00Z`,
      updated_at: `${dStr(0)}T07:50:00Z`
    },
    {
      id: 'TRP-2026-0008',
      trip_date: dStr(0),
      truck_id: 'TRK-001',
      truck_plate: 'TX-4892-A',
      truck_owner: 'Apex Haulage Logistics',
      company_id: 'CMP-004',
      company_name: 'Keystone Concrete & Paving',
      project_id: 'PRJ-005',
      project_name: 'Keystone Main Batch Plant Silo Feed',
      loading_location_id: 'LOC-002',
      loading_location_name: 'Trinity Basin Sand Crusher Depot',
      loading_datetime: `${dStr(0)}T09:15:00Z`,
      sand_type: '01',
      quantity_loaded_m3: 21.50,
      loading_notes: 'Washed concrete aggregate',
      unloading_location_id: 'LOC-007',
      unloading_location_name: 'Keystone Concrete Construction Site & Silos',
      unloading_datetime: `${dStr(0)}T11:45:00Z`,
      quantity_delivered_m3: 21.50,
      quantity_remaining_m3: 0.00,
      delivery_outcome: 'Delivered',
      delivery_proof_ref: 'POD-88314',
      unloading_notes: 'Discharged directly into silo receptor',
      status: 'Delivered',
      status_reason: 'Successful batch delivery',
      capacity_warning_acknowledged: 0,
      created_by_user_id: 'usr_operator',
      created_by_user_name: 'Elena Vance (Dispatcher)',
      created_at: `${dStr(0)}T09:00:00Z`,
      updated_at: `${dStr(0)}T12:00:00Z`
    },
    {
      id: 'TRP-2026-0009',
      trip_date: dStr(1),
      truck_id: 'TRK-002',
      truck_plate: 'TX-7731-B',
      truck_owner: 'Falcon Transport LLC',
      company_id: 'CMP-003',
      company_name: 'Summit Horizon Residential',
      project_id: 'PRJ-003',
      project_name: 'Oakridge Estates Sector 4',
      loading_location_id: 'LOC-001',
      loading_location_name: 'Red River Sand Crusher Plant #1',
      loading_datetime: `${dStr(1)}T13:00:00Z`,
      sand_type: '00',
      quantity_loaded_m3: 18.00,
      loading_notes: 'Mortar sand for brickwork phase',
      unloading_location_id: 'LOC-006',
      unloading_location_name: 'Oakridge Estates Sector 4 Construction Site',
      unloading_datetime: `${dStr(1)}T15:30:00Z`,
      quantity_delivered_m3: 18.00,
      quantity_remaining_m3: 0.00,
      delivery_outcome: 'Delivered',
      delivery_proof_ref: 'POD-88320',
      unloading_notes: 'Received by masonry foreman',
      status: 'Delivered',
      status_reason: 'Full delivery complete',
      capacity_warning_acknowledged: 0,
      created_by_user_id: 'usr_operator',
      created_by_user_name: 'Elena Vance (Dispatcher)',
      created_at: `${dStr(1)}T12:45:00Z`,
      updated_at: `${dStr(1)}T15:45:00Z`
    }
  ];

  for (const t of initialTrips) {
    db.run(
      `INSERT INTO trips (
        id, trip_date, truck_id, truck_plate, truck_owner, company_id, company_name,
        project_id, project_name, loading_location_id, loading_location_name,
        loading_datetime, sand_type, quantity_loaded_m3, loading_notes,
        unloading_location_id, unloading_location_name, unloading_datetime,
        quantity_delivered_m3, quantity_remaining_m3, delivery_outcome,
        delivery_proof_ref, unloading_notes, status, status_reason,
        capacity_warning_acknowledged, created_by_user_id, created_by_user_name,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id, t.trip_date, t.truck_id, t.truck_plate, t.truck_owner, t.company_id, t.company_name,
        t.project_id, t.project_name, t.loading_location_id, t.loading_location_name,
        t.loading_datetime, t.sand_type, t.quantity_loaded_m3, t.loading_notes,
        t.unloading_location_id, t.unloading_location_name, t.unloading_datetime,
        t.quantity_delivered_m3, t.quantity_remaining_m3, t.delivery_outcome,
        t.delivery_proof_ref, t.unloading_notes, t.status, t.status_reason,
        t.capacity_warning_acknowledged, t.created_by_user_id, t.created_by_user_name,
        t.created_at, t.updated_at
      ]
    );

    // Initial status history
    db.run(
      `INSERT INTO trip_status_history (id, trip_id, previous_status, new_status, changed_by_user_id, changed_by_user_name, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `hist_${t.id}_1`,
        t.id,
        null,
        t.status,
        t.created_by_user_id,
        t.created_by_user_name,
        t.status_reason || 'Initial creation',
        t.updated_at
      ]
    );
  }

  // Audit log entry
  db.run(
    `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['audit_001', 'usr_admin', 'System Administrator', 'SYSTEM_INIT', 'system', 'sandtrack', 'Database initialized and seeded with baseline operations', now]
  );
}

export function query<T = any>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

let inTransaction = false;

export function execute(sql: string, params: any[] = []): void {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  if (!inTransaction) {
    saveDb();
  }
}

export function transaction<T>(fn: () => T): T {
  if (!db) throw new Error('Database not initialized');
  inTransaction = true;
  db.run('BEGIN TRANSACTION;');
  try {
    const result = fn();
    db.run('COMMIT;');
    inTransaction = false;
    saveDb();
    return result;
  } catch (err) {
    try {
      db.run('ROLLBACK;');
    } catch (_e) {
      // ignore
    }
    inTransaction = false;
    throw err;
  }
}

function migrateCrusherLocations() {
  if (!db) return;
  try {
    db.run(`
      UPDATE locations SET name = 'Red River Sand Crusher Plant #1', notes = 'Primary industrial crusher plant for fine grades 00 and 01 sand' WHERE id = 'LOC-001';
      UPDATE locations SET name = 'Trinity Basin Sand Crusher Depot', notes = 'Rotary crusher and wash plant for coarse aggregate grade 02' WHERE id = 'LOC-002';
      UPDATE locations SET name = 'Clear Creek Quarry & Crusher Terminal', notes = 'Automated high-capacity jaw & cone crusher hoppers' WHERE id = 'LOC-003';
      
      UPDATE locations SET name = 'HWY 35 Interchange Construction Site (Pier 7)', notes = 'Direct dump to construction staging trench' WHERE id = 'LOC-004';
      UPDATE locations SET name = 'Gateway Logistics Construction Site Phase 2', notes = 'Foundation pad compaction unloading area' WHERE id = 'LOC-005';
      UPDATE locations SET name = 'Oakridge Estates Sector 4 Construction Site', notes = 'Utility trench backfill dump point' WHERE id = 'LOC-006';
      UPDATE locations SET name = 'Keystone Concrete Construction Site & Silos', notes = 'On-site secondary crusher and ready-mix receiver' WHERE id = 'LOC-007';

      UPDATE trips SET loading_location_name = 'Red River Sand Crusher Plant #1' WHERE loading_location_id = 'LOC-001';
      UPDATE trips SET loading_location_name = 'Trinity Basin Sand Crusher Depot' WHERE loading_location_id = 'LOC-002';
      UPDATE trips SET loading_location_name = 'Clear Creek Quarry & Crusher Terminal' WHERE loading_location_id = 'LOC-003';
      UPDATE trips SET unloading_location_name = 'HWY 35 Interchange Construction Site (Pier 7)' WHERE unloading_location_id = 'LOC-004';
      UPDATE trips SET unloading_location_name = 'Gateway Logistics Construction Site Phase 2' WHERE unloading_location_id = 'LOC-005';
      UPDATE trips SET unloading_location_name = 'Oakridge Estates Sector 4 Construction Site' WHERE unloading_location_id = 'LOC-006';
      UPDATE trips SET unloading_location_name = 'Keystone Concrete Construction Site & Silos' WHERE unloading_location_id = 'LOC-007';
    `);
  } catch (err) {
    console.error('Migration error:', err);
  }
}

function migrateUserAvatar() {
  if (!db) return;
  try {
    const userCols = (db.exec('PRAGMA table_info(users)')[0]?.values || []).map((v: any[]) => v[1]);
    if (!userCols.includes('avatar_url')) {
      db.run('ALTER TABLE users ADD COLUMN avatar_url TEXT');
    }
    if (!userCols.includes('is_active')) {
      db.run('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
    }
  } catch (err) {
    console.error('Migration error on user avatar/is_active:', err);
  }
}

function migrateFinancialColumns() {
  if (!db) return;
  try {
    // Check and add columns to locations
    const locCols = (db.exec('PRAGMA table_info(locations)')[0]?.values || []).map((v: any[]) => v[1]);
    if (!locCols.includes('price_sand_00')) db.run('ALTER TABLE locations ADD COLUMN price_sand_00 REAL DEFAULT 950');
    if (!locCols.includes('price_sand_01')) db.run('ALTER TABLE locations ADD COLUMN price_sand_01 REAL DEFAULT 1100');
    if (!locCols.includes('price_sand_02')) db.run('ALTER TABLE locations ADD COLUMN price_sand_02 REAL DEFAULT 1250');
    if (!locCols.includes('selling_price_sand_00')) db.run('ALTER TABLE locations ADD COLUMN selling_price_sand_00 REAL DEFAULT 1600');
    if (!locCols.includes('selling_price_sand_01')) db.run('ALTER TABLE locations ADD COLUMN selling_price_sand_01 REAL DEFAULT 1850');
    if (!locCols.includes('selling_price_sand_02')) db.run('ALTER TABLE locations ADD COLUMN selling_price_sand_02 REAL DEFAULT 2100');

    // Check and add columns to projects
    const projCols = (db.exec('PRAGMA table_info(projects)')[0]?.values || []).map((v: any[]) => v[1]);
    if (!projCols.includes('price_sand_00')) db.run('ALTER TABLE projects ADD COLUMN price_sand_00 REAL DEFAULT 1600');
    if (!projCols.includes('price_sand_01')) db.run('ALTER TABLE projects ADD COLUMN price_sand_01 REAL DEFAULT 1850');
    if (!projCols.includes('price_sand_02')) db.run('ALTER TABLE projects ADD COLUMN price_sand_02 REAL DEFAULT 2100');

    // Check and add columns to trips
    const tripCols = (db.exec('PRAGMA table_info(trips)')[0]?.values || []).map((v: any[]) => v[1]);
    if (!tripCols.includes('unit_cost_etb')) db.run('ALTER TABLE trips ADD COLUMN unit_cost_etb REAL DEFAULT 0');
    if (!tripCols.includes('total_cost_etb')) db.run('ALTER TABLE trips ADD COLUMN total_cost_etb REAL DEFAULT 0');
    if (!tripCols.includes('unit_price_etb')) db.run('ALTER TABLE trips ADD COLUMN unit_price_etb REAL DEFAULT 0');
    if (!tripCols.includes('total_revenue_etb')) db.run('ALTER TABLE trips ADD COLUMN total_revenue_etb REAL DEFAULT 0');
    if (!tripCols.includes('gross_profit_etb')) db.run('ALTER TABLE trips ADD COLUMN gross_profit_etb REAL DEFAULT 0');
    if (!tripCols.includes('shortage_loss_etb')) db.run('ALTER TABLE trips ADD COLUMN shortage_loss_etb REAL DEFAULT 0');

    // Differentiate crusher purchase prices in ETB/m³ and destination project selling prices in ETB/m³
    db.run(`
      UPDATE locations SET 
        price_sand_00 = 920, price_sand_01 = 1050, price_sand_02 = 1180 
      WHERE id = 'LOC-001';
      UPDATE locations SET 
        price_sand_00 = 980, price_sand_01 = 1120, price_sand_02 = 1260 
      WHERE id = 'LOC-002';
      UPDATE locations SET 
        price_sand_00 = 890, price_sand_01 = 1020, price_sand_02 = 1150 
      WHERE id = 'LOC-003';

      UPDATE locations SET 
        selling_price_sand_00 = 1650, selling_price_sand_01 = 1880, selling_price_sand_02 = 2100 
      WHERE id = 'LOC-004';
      UPDATE locations SET 
        selling_price_sand_00 = 1720, selling_price_sand_01 = 1950, selling_price_sand_02 = 2200 
      WHERE id = 'LOC-005';
      UPDATE locations SET 
        selling_price_sand_00 = 1600, selling_price_sand_01 = 1820, selling_price_sand_02 = 2050 
      WHERE id = 'LOC-006';
      UPDATE locations SET 
        selling_price_sand_00 = 1580, selling_price_sand_01 = 1790, selling_price_sand_02 = 2000,
        price_sand_00 = 950, price_sand_01 = 1080, price_sand_02 = 1200
      WHERE id = 'LOC-007';
      UPDATE locations SET 
        selling_price_sand_00 = 1550, selling_price_sand_01 = 1750, selling_price_sand_02 = 1980,
        price_sand_00 = 940, price_sand_01 = 1060, price_sand_02 = 1190
      WHERE id = 'LOC-008';

      UPDATE projects SET price_sand_00 = 1650, price_sand_01 = 1880, price_sand_02 = 2100 WHERE id = 'PRJ-001';
      UPDATE projects SET price_sand_00 = 1720, price_sand_01 = 1950, price_sand_02 = 2200 WHERE id = 'PRJ-002';
      UPDATE projects SET price_sand_00 = 1600, price_sand_01 = 1820, price_sand_02 = 2050 WHERE id = 'PRJ-003';
      UPDATE projects SET price_sand_00 = 1750, price_sand_01 = 1980, price_sand_02 = 2250 WHERE id = 'PRJ-004';
      UPDATE projects SET price_sand_00 = 1580, price_sand_01 = 1790, price_sand_02 = 2000 WHERE id = 'PRJ-005';

      -- Rename to Destination Projects
      UPDATE projects SET name = 'Highway 35 Interchange Expansion Destination Project' WHERE id = 'PRJ-001';
      UPDATE projects SET name = 'Gateway Logistics Center Phase 2 Destination Project' WHERE id = 'PRJ-002';
      UPDATE projects SET name = 'Oakridge Estates Sector 4 Destination Project' WHERE id = 'PRJ-003';
      UPDATE projects SET name = 'Airport South Taxiway Rehabilitation Destination Project' WHERE id = 'PRJ-004';
      UPDATE projects SET name = 'Keystone Main Batch Plant Silo Feed Destination Project' WHERE id = 'PRJ-005';

      UPDATE locations SET name = 'HWY 35 Interchange Destination Project (Pier 7)' WHERE id = 'LOC-004';
      UPDATE locations SET name = 'Gateway Logistics Destination Project Phase 2' WHERE id = 'LOC-005';
      UPDATE locations SET name = 'Oakridge Estates Sector 4 Destination Project' WHERE id = 'LOC-006';
      UPDATE locations SET name = 'Keystone Concrete Destination Project & Silos' WHERE id = 'LOC-007';

      UPDATE trips SET project_name = 'Highway 35 Interchange Expansion Destination Project', unloading_location_name = 'HWY 35 Interchange Destination Project (Pier 7)' WHERE project_id = 'PRJ-001' OR unloading_location_id = 'LOC-004';
      UPDATE trips SET project_name = 'Gateway Logistics Center Phase 2 Destination Project', unloading_location_name = 'Gateway Logistics Destination Project Phase 2' WHERE project_id = 'PRJ-002' OR unloading_location_id = 'LOC-005';
      UPDATE trips SET project_name = 'Oakridge Estates Sector 4 Destination Project', unloading_location_name = 'Oakridge Estates Sector 4 Destination Project' WHERE project_id = 'PRJ-003' OR unloading_location_id = 'LOC-006';
      UPDATE trips SET project_name = 'Keystone Main Batch Plant Silo Feed Destination Project', unloading_location_name = 'Keystone Concrete Destination Project & Silos' WHERE project_id = 'PRJ-005' OR unloading_location_id = 'LOC-007';
    `);

    // Backfill calculations for any trips with 0 cost or revenue
    const allTrips = db.exec(`
      SELECT tr.id, tr.sand_type, tr.quantity_loaded_m3, tr.quantity_delivered_m3, tr.quantity_remaining_m3,
             tr.loading_location_id, tr.unloading_location_id,
             l_in.price_sand_00 as in_00, l_in.price_sand_01 as in_01, l_in.price_sand_02 as in_02,
             l_out.selling_price_sand_00 as out_00, l_out.selling_price_sand_01 as out_01, l_out.selling_price_sand_02 as out_02
      FROM trips tr
      LEFT JOIN locations l_in ON tr.loading_location_id = l_in.id
      LEFT JOIN locations l_out ON tr.unloading_location_id = l_out.id
    `)[0];

    if (allTrips && allTrips.values) {
      for (const row of allTrips.values) {
        const [
          tId, sType, qLoaded, qDelivered, qRemaining,
          lInId, lOutId,
          in00, in01, in02,
          out00, out01, out02
        ] = row as any[];

        const unitCost = sType === '00' ? (Number(in00) || 920) : sType === '01' ? (Number(in01) || 1050) : (Number(in02) || 1180);
        const unitPrice = sType === '00' ? (Number(out00) || 1650) : sType === '01' ? (Number(out01) || 1880) : (Number(out02) || 2100);

        const loadedM3 = Number(qLoaded || 0);
        const deliveredM3 = Number(qDelivered || 0);
        const remainingM3 = Number(qRemaining || 0);

        const totalCost = Number((loadedM3 * unitCost).toFixed(2));
        const totalRevenue = Number((deliveredM3 * unitPrice).toFixed(2));
        const grossProfit = Number((totalRevenue - totalCost).toFixed(2));
        const shortageLoss = Number((remainingM3 * unitCost).toFixed(2));

        db.run(`
          UPDATE trips SET 
            unit_cost_etb = ?,
            total_cost_etb = ?,
            unit_price_etb = ?,
            total_revenue_etb = ?,
            gross_profit_etb = ?,
            shortage_loss_etb = ?
          WHERE id = ?
        `, [unitCost, totalCost, unitPrice, totalRevenue, grossProfit, shortageLoss, tId]);
      }
    }
  } catch (err) {
    console.error('Financial migration error:', err);
  }
}

function migrateRouteTransportFees() {
  if (!db) return;
  try {
    // 1. Add coordinates columns to locations if missing
    const locCols = (db.exec('PRAGMA table_info(locations)')[0]?.values || []).map((v: any[]) => v[1]);
    if (!locCols.includes('latitude')) {
      db.run('ALTER TABLE locations ADD COLUMN latitude REAL');
    }
    if (!locCols.includes('longitude')) {
      db.run('ALTER TABLE locations ADD COLUMN longitude REAL');
    }

    // Set coordinates for realistic distances (Addis Ababa & surrounding aggregate quarries/construction hubs)
    db.run(`
      UPDATE locations SET latitude = 9.0650, longitude = 38.6800 WHERE id = 'LOC-001'; -- Red River Sand Crusher Plant #1
      UPDATE locations SET latitude = 9.0980, longitude = 38.8350 WHERE id = 'LOC-002'; -- Trinity Basin Sand Crusher Depot
      UPDATE locations SET latitude = 8.8920, longitude = 38.7420 WHERE id = 'LOC-003'; -- Clear Creek Quarry & Crusher Terminal
      UPDATE locations SET latitude = 9.0120, longitude = 38.7510 WHERE id = 'LOC-004'; -- HWY 35 Interchange Destination Project
      UPDATE locations SET latitude = 8.9830, longitude = 38.7940 WHERE id = 'LOC-005'; -- Gateway Logistics Destination Project Phase 2
      UPDATE locations SET latitude = 9.0430, longitude = 38.7180 WHERE id = 'LOC-006'; -- Oakridge Estates Sector 4 Destination Project
      UPDATE locations SET latitude = 8.9240, longitude = 38.8150 WHERE id = 'LOC-007'; -- Keystone Concrete Destination Project & Silos
      UPDATE locations SET latitude = 9.0250, longitude = 38.8450 WHERE id = 'LOC-008'; -- Regional Municipal Stockpile Yard
    `);

    // 2. Create route_tariffs table with fee_per_trip_etb
    db.run(`
      CREATE TABLE IF NOT EXISTS route_tariffs (
        id TEXT PRIMARY KEY,
        origin_location_id TEXT NOT NULL REFERENCES locations(id),
        destination_location_id TEXT NOT NULL REFERENCES locations(id),
        origin_location_name TEXT,
        destination_location_name TEXT,
        distance_km REAL,
        fee_per_trip_etb REAL NOT NULL DEFAULT 8500,
        rate_per_m3_etb REAL NOT NULL DEFAULT 450,
        fixed_trip_fee_etb REAL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(origin_location_id, destination_location_id)
      );
    `);

    const tariffCols = (db.exec('PRAGMA table_info(route_tariffs)')[0]?.values || []).map((v: any[]) => v[1]);
    if (!tariffCols.includes('fee_per_trip_etb')) {
      db.run('ALTER TABLE route_tariffs ADD COLUMN fee_per_trip_etb REAL NOT NULL DEFAULT 8500');
    }

    // 3. Add transport fee columns to trips if missing
    const tripCols = (db.exec('PRAGMA table_info(trips)')[0]?.values || []).map((v: any[]) => v[1]);
    if (!tripCols.includes('transport_rate_etb_per_m3')) {
      db.run('ALTER TABLE trips ADD COLUMN transport_rate_etb_per_m3 REAL DEFAULT 8500');
    }
    if (!tripCols.includes('total_transport_fee_etb')) {
      db.run('ALTER TABLE trips ADD COLUMN total_transport_fee_etb REAL DEFAULT 8500');
    }
    if (!tripCols.includes('route_tariff_id')) {
      db.run('ALTER TABLE trips ADD COLUMN route_tariff_id TEXT');
    }

    const now = new Date().toISOString();

    // 4. Pre-seed fixed routes tariffs with FIXED FEE PER TRIP (ETB / trip)
    const routesConfig = [
      // From LOC-001: Red River Sand Crusher Plant #1
      { id: 'RT-001', oId: 'LOC-001', oName: 'Red River Sand Crusher Plant #1', dId: 'LOC-004', dName: 'HWY 35 Interchange Destination Project (Pier 7)', km: 34, tripFee: 9500, notes: 'Direct corridor via Northway Expressway' },
      { id: 'RT-002', oId: 'LOC-001', oName: 'Red River Sand Crusher Plant #1', dId: 'LOC-005', dName: 'Gateway Logistics Destination Project Phase 2', km: 42, tripFee: 11000, notes: 'Industrial park perimeter haul' },
      { id: 'RT-003', oId: 'LOC-001', oName: 'Red River Sand Crusher Plant #1', dId: 'LOC-006', dName: 'Oakridge Estates Sector 4 Destination Project', km: 28, tripFee: 8500, notes: 'Suburban access route' },
      { id: 'RT-004', oId: 'LOC-001', oName: 'Red River Sand Crusher Plant #1', dId: 'LOC-007', dName: 'Keystone Concrete Destination Project & Silos', km: 38, tripFee: 10500, notes: 'Heavy axle route to quarry silos' },
      { id: 'RT-005', oId: 'LOC-001', oName: 'Red River Sand Crusher Plant #1', dId: 'LOC-008', dName: 'Regional Municipal Stockpile Yard', km: 30, tripFee: 9000, notes: 'Loop transit to public works depot' },

      // From LOC-002: Trinity Basin Sand Crusher Depot
      { id: 'RT-006', oId: 'LOC-002', oName: 'Trinity Basin Sand Crusher Depot', dId: 'LOC-004', dName: 'HWY 35 Interchange Destination Project (Pier 7)', km: 46, tripFee: 11500, notes: 'Cross-basin haulage' },
      { id: 'RT-007', oId: 'LOC-002', oName: 'Trinity Basin Sand Crusher Depot', dId: 'LOC-005', dName: 'Gateway Logistics Destination Project Phase 2', km: 26, tripFee: 8000, notes: 'Short corridor to Gateway Phase 2' },
      { id: 'RT-008', oId: 'LOC-002', oName: 'Trinity Basin Sand Crusher Depot', dId: 'LOC-006', dName: 'Oakridge Estates Sector 4 Destination Project', km: 55, tripFee: 12500, notes: 'Long-haul residential delivery' },
      { id: 'RT-009', oId: 'LOC-002', oName: 'Trinity Basin Sand Crusher Depot', dId: 'LOC-007', dName: 'Keystone Concrete Destination Project & Silos', km: 22, tripFee: 7500, notes: 'Direct connecting bypass' },
      { id: 'RT-010', oId: 'LOC-002', oName: 'Trinity Basin Sand Crusher Depot', dId: 'LOC-008', dName: 'Regional Municipal Stockpile Yard', km: 35, tripFee: 9500, notes: 'Standard municipal feed' },

      // From LOC-003: Clear Creek Quarry & Crusher Terminal
      { id: 'RT-011', oId: 'LOC-003', oName: 'Clear Creek Quarry & Crusher Terminal', dId: 'LOC-004', dName: 'HWY 35 Interchange Destination Project (Pier 7)', km: 24, tripFee: 7800, notes: 'South bypass quick transfer' },
      { id: 'RT-012', oId: 'LOC-003', oName: 'Clear Creek Quarry & Crusher Terminal', dId: 'LOC-005', dName: 'Gateway Logistics Destination Project Phase 2', km: 39, tripFee: 10200, notes: 'East loop logistics access' },
      { id: 'RT-013', oId: 'LOC-003', oName: 'Clear Creek Quarry & Crusher Terminal', dId: 'LOC-006', dName: 'Oakridge Estates Sector 4 Destination Project', km: 18, tripFee: 6500, notes: 'Adjacent residential feeder route' },
      { id: 'RT-014', oId: 'LOC-003', oName: 'Clear Creek Quarry & Crusher Terminal', dId: 'LOC-007', dName: 'Keystone Concrete Destination Project & Silos', km: 31, tripFee: 9000, notes: 'Commercial aggregate transit' },
      { id: 'RT-015', oId: 'LOC-003', oName: 'Clear Creek Quarry & Crusher Terminal', dId: 'LOC-008', dName: 'Regional Municipal Stockpile Yard', km: 21, tripFee: 7200, notes: 'Airport perimeter corridor' },

      // From LOC-007: Keystone Concrete & Silos (When acting as loading origin)
      { id: 'RT-016', oId: 'LOC-007', oName: 'Keystone Concrete Destination Project & Silos', dId: 'LOC-004', dName: 'HWY 35 Interchange Destination Project (Pier 7)', km: 29, tripFee: 8500, notes: 'Direct highway staging' },
      { id: 'RT-017', oId: 'LOC-007', oName: 'Keystone Concrete Destination Project & Silos', dId: 'LOC-005', dName: 'Gateway Logistics Destination Project Phase 2', km: 25, tripFee: 7800, notes: 'Inter-complex transfer' },
      { id: 'RT-018', oId: 'LOC-007', oName: 'Keystone Concrete Destination Project & Silos', dId: 'LOC-006', dName: 'Oakridge Estates Sector 4 Destination Project', km: 36, tripFee: 9500, notes: 'Residential foundation supply' },
      { id: 'RT-019', oId: 'LOC-007', oName: 'Keystone Concrete Destination Project & Silos', dId: 'LOC-008', dName: 'Regional Municipal Stockpile Yard', km: 20, tripFee: 7000, notes: 'Municipal overflow route' },

      // From LOC-008: Regional Municipal Stockpile Yard
      { id: 'RT-020', oId: 'LOC-008', oName: 'Regional Municipal Stockpile Yard', dId: 'LOC-004', dName: 'HWY 35 Interchange Destination Project (Pier 7)', km: 27, tripFee: 8200, notes: 'East loop direct' },
      { id: 'RT-021', oId: 'LOC-008', oName: 'Regional Municipal Stockpile Yard', dId: 'LOC-005', dName: 'Gateway Logistics Destination Project Phase 2', km: 32, tripFee: 9000, notes: 'Logistics center transit' },
      { id: 'RT-022', oId: 'LOC-008', oName: 'Regional Municipal Stockpile Yard', dId: 'LOC-006', dName: 'Oakridge Estates Sector 4 Destination Project', km: 23, tripFee: 7500, notes: 'East sector residential delivery' },
      { id: 'RT-023', oId: 'LOC-008', oName: 'Regional Municipal Stockpile Yard', dId: 'LOC-007', dName: 'Keystone Concrete Destination Project & Silos', km: 20, tripFee: 7000, notes: 'Ready-mix batch emergency feed' }
    ];

    for (const r of routesConfig) {
      db.run(`
        INSERT OR REPLACE INTO route_tariffs (
          id, origin_location_id, destination_location_id,
          origin_location_name, destination_location_name,
          distance_km, fee_per_trip_etb, rate_per_m3_etb, fixed_trip_fee_etb,
          notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [r.id, r.oId, r.dId, r.oName, r.dName, r.km, r.tripFee, Math.round(r.tripFee / 20), r.tripFee, r.notes, now, now]);
    }

    // 5. Backfill trips with the route fixed fee per trip
    const trips = query<any>('SELECT id, loading_location_id, unloading_location_id, status FROM trips');
    for (const t of trips) {
      const tariff = queryOne<any>(
        'SELECT id, fee_per_trip_etb, rate_per_m3_etb FROM route_tariffs WHERE origin_location_id = ? AND destination_location_id = ?',
        [t.loading_location_id, t.unloading_location_id]
      );
      const feePerTrip = tariff ? Number(tariff.fee_per_trip_etb || tariff.rate_per_m3_etb * 20) : 8500;
      const totalFee = t.status === 'Cancelled' ? 0 : feePerTrip;

      db.run(`
        UPDATE trips SET
          transport_rate_etb_per_m3 = ?,
          total_transport_fee_etb = ?,
          route_tariff_id = ?
        WHERE id = ?
      `, [feePerTrip, totalFee, tariff?.id || null, t.id]);
    }

  } catch (err) {
    console.error('Route transport fees migration error:', err);
  }
}

function migrateCrusherOnlyAndProjectDestinations() {
  if (!db) return;
  try {
    // 1. Ensure latitude and longitude columns exist on projects
    const projCols = (db.exec('PRAGMA table_info(projects)')[0]?.values || []).map((v: any[]) => v[1]);
    if (!projCols.includes('latitude')) {
      db.run('ALTER TABLE projects ADD COLUMN latitude REAL');
    }
    if (!projCols.includes('longitude')) {
      db.run('ALTER TABLE projects ADD COLUMN longitude REAL');
    }

    // 2. Backfill coordinates on projects from SEED_PROJECTS and existing locations
    SEED_PROJECTS.forEach((sp) => {
      db.run(
        `UPDATE projects SET latitude = ?, longitude = ? WHERE (name = ? OR name LIKE ?) AND (latitude IS NULL OR longitude IS NULL)`,
        [sp.lat, sp.lng, sp.project_name, `%${sp.project_name}%`]
      );
    });

    // Also populate any remaining coordinates from locations that had associated_project_id
    db.run(`
      UPDATE projects SET
        latitude = (SELECT latitude FROM locations WHERE locations.associated_project_id = projects.id LIMIT 1),
        longitude = (SELECT longitude FROM locations WHERE locations.associated_project_id = projects.id LIMIT 1)
      WHERE latitude IS NULL AND EXISTS (
        SELECT 1 FROM locations WHERE locations.associated_project_id = projects.id AND latitude IS NOT NULL
      );
    `);

    // 3. For route_tariffs: if destination_location_id points to an unloading location (e.g. DST-xxx or LOC-xxx),
    // update it to point directly to the destination project ID
    db.run(`
      UPDATE route_tariffs
      SET destination_location_id = (
        SELECT associated_project_id FROM locations WHERE locations.id = route_tariffs.destination_location_id
      )
      WHERE destination_location_id IN (
        SELECT id FROM locations WHERE associated_project_id IS NOT NULL
      );
    `);

    // 4. Update route_tariffs destination_location_name to project name
    db.run(`
      UPDATE route_tariffs
      SET destination_location_name = (SELECT name FROM projects WHERE projects.id = route_tariffs.destination_location_id)
      WHERE destination_location_id IN (SELECT id FROM projects);
    `);

    // 5. Update trips: ensure unloading_location_id is set to project_id, and unloading_location_name is project_name
    db.run(`
      UPDATE trips
      SET unloading_location_id = project_id,
          unloading_location_name = project_name
      WHERE project_id IS NOT NULL;
    `);

    // 6. PURGE all Unloading sites from locations: Crusher plants ONLY in locations!
    db.run(`
      DELETE FROM locations WHERE location_type = 'Unloading';
      UPDATE locations SET location_type = 'Loading' WHERE location_type = 'Both';
    `);

  } catch (err) {
    console.error('migrateCrusherOnlyAndProjectDestinations error:', err);
  }
}

export function seedEthiopianSampleData() {
  if (!db) return;
  try {
    // 1. Ensure contact_person & phone columns exist on locations
    const locCols = (db.exec('PRAGMA table_info(locations)')[0]?.values || []).map((v: any[]) => v[1]);
    if (!locCols.includes('contact_person')) {
      db.run('ALTER TABLE locations ADD COLUMN contact_person TEXT');
    }
    if (!locCols.includes('phone')) {
      db.run('ALTER TABLE locations ADD COLUMN phone TEXT');
    }

    const projCols = (db.exec('PRAGMA table_info(projects)')[0]?.values || []).map((v: any[]) => v[1]);
    if (!projCols.includes('latitude')) {
      db.run('ALTER TABLE projects ADD COLUMN latitude REAL');
    }
    if (!projCols.includes('longitude')) {
      db.run('ALTER TABLE projects ADD COLUMN longitude REAL');
    }

    const now = new Date().toISOString();

    // 2. Check if Ethiopian trucks already exist
    const sampleCheck = queryOne<any>('SELECT COUNT(*) as count FROM trucks WHERE plate_number = ?', ['A12453']);
    if (sampleCheck && sampleCheck.count > 0) {
      return; // Already seeded
    }

    // 3. Clear old placeholder records to make way for user-requested dataset
    db.run('DELETE FROM audit_logs');
    db.run('DELETE FROM trip_status_history');
    db.run('DELETE FROM trips');
    db.run('DELETE FROM route_tariffs');
    db.run('DELETE FROM locations');
    db.run('DELETE FROM projects');
    db.run('DELETE FROM construction_companies');
    db.run('DELETE FROM trucks');

    // 4. Seed 31 Construction Companies
    const companyIdMap: Record<string, string> = {};
    SEED_COMPANIES.forEach((c, idx) => {
      const id = `CMP-${String(idx + 1).padStart(3, '0')}`;
      companyIdMap[c.name] = id;
      db.run(
        `INSERT INTO construction_companies (id, name, contact_person, phone, address, is_active, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        [id, c.name, c.contact_person, c.phone, c.address, 'Registered Construction Client', now, now]
      );
    });

    // 5. Seed 30 Hired Trucks (exact capacities 16.74 or 16.14 m³)
    const truckIdMap: Record<string, string> = {};
    SEED_TRUCKS.forEach((t, idx) => {
      const id = `TRK-${String(idx + 1).padStart(3, '0')}`;
      truckIdMap[t.plate_number] = id;
      db.run(
        `INSERT INTO trucks (id, plate_number, owner_name, capacity_m3, owner_phone, is_active, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        [id, t.plate_number, t.owner_name, t.capacity_m3, t.owner_phone, t.notes || 'Hired dump truck', now, now]
      );
    });

    // 6. Seed 7 Crusher Sites (strictly Loading sites - ONLY Crusher Plants in locations)
    const crusherIdMap: Record<string, string> = {};
    SEED_CRUSHERS.forEach((cr, idx) => {
      const id = `CRU-${String(idx + 1).padStart(3, '0')}`;
      crusherIdMap[cr.name] = id;
      db.run(
        `INSERT INTO locations (
          id, name, location_type, address, contact_person, phone,
          latitude, longitude,
          price_sand_00, price_sand_01, price_sand_02,
          selling_price_sand_00, selling_price_sand_01, selling_price_sand_02,
          is_active, notes, created_at, updated_at
        ) VALUES (?, ?, 'Loading', ?, ?, ?, ?, ?, 950, 1100, 1250, 1750, 1980, 2250, 1, ?, ?, ?)`,
        [id, cr.name, cr.address, cr.contact_person, cr.phone, cr.lat, cr.lng, `Crusher plant in ${cr.address}`, now, now]
      );
    });

    // 7. Seed 31 Destination Projects (one company can have one or more Destination projects)
    const projectIdMap: Record<string, string> = {};
    SEED_PROJECTS.forEach((p, idx) => {
      const pId = `PRJ-${String(idx + 1).padStart(3, '0')}`;
      const compId = companyIdMap[p.company_name] || Object.values(companyIdMap)[0];
      projectIdMap[p.project_name] = pId;

      // Project table record with coordinates directly on project
      db.run(
        `INSERT INTO projects (
          id, name, company_id, address, latitude, longitude,
          price_sand_00, price_sand_01, price_sand_02,
          is_active, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1750, 1980, 2250, 1, ?, ?, ?)`,
        [pId, p.project_name, compId, p.address, p.lat, p.lng, `Destination project: ${p.address}`, now, now]
      );
    });

    // 8. Generate Route Tariffs connecting Crusher Sites to Destination Projects
    let tariffCount = 0;
    SEED_CRUSHERS.forEach((cr) => {
      const crId = crusherIdMap[cr.name];
      SEED_PROJECTS.forEach((pr) => {
        const pId = projectIdMap[pr.project_name];
        tariffCount++;
        const tId = `RT-${String(tariffCount).padStart(3, '0')}`;

        // Compute approximate road distance
        const R = 6371;
        const dLat = ((pr.lat - cr.lat) * Math.PI) / 180;
        const dLon = ((pr.lng - cr.lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((cr.lat * Math.PI) / 180) * Math.cos((pr.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        const straightKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const roadKm = Math.max(12, Math.round(straightKm * 1.25));

        // Fixed corridor tariff per trip
        const rawFee = 5500 + roadKm * 115;
        const tripFee = Math.round(rawFee / 250) * 250;

        db.run(
          `INSERT OR REPLACE INTO route_tariffs (
            id, origin_location_id, destination_location_id,
            origin_location_name, destination_location_name,
            distance_km, fee_per_trip_etb, rate_per_m3_etb, fixed_trip_fee_etb,
            notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tId, crId, pId, cr.name, pr.project_name, roadKm, tripFee, Math.round(tripFee / 20), tripFee, `Corridor: ${cr.name} → ${pr.project_name}`, now, now]
        );
      });
    });

    // 9. Seed 50 realistic dispatches using the trucks with exact capacity
    const dateBase = new Date();
    const dStr = (daysAgo: number) => {
      const d = new Date(dateBase);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    };

    const sandGrades: Array<'00' | '01' | '02'> = ['00', '01', '02'];
    const statuses = ['Delivered', 'Delivered', 'Delivered', 'Delivered', 'Partially Delivered', 'Delivered', 'Loaded / In Transit'];

    for (let i = 0; i < 50; i++) {
      const truck = SEED_TRUCKS[i % SEED_TRUCKS.length];
      const truckId = truckIdMap[truck.plate_number];
      const project = SEED_PROJECTS[i % SEED_PROJECTS.length];
      const projectId = projectIdMap[project.project_name];
      const destLocId = projectId;
      const companyId = companyIdMap[project.company_name] || Object.values(companyIdMap)[0];
      const crusher = SEED_CRUSHERS[i % SEED_CRUSHERS.length];
      const crusherId = crusherIdMap[crusher.name];

      const daysAgo = Math.floor(i / 4);
      const tripDate = dStr(daysAgo);
      const sandType = sandGrades[i % 3];
      const status = statuses[i % statuses.length];

      // Exact truck capacity auto-loaded (16.74 or 16.14 m³)
      const loadedM3 = truck.capacity_m3;
      const deliveredM3 = status === 'Delivered'
        ? loadedM3
        : status === 'Partially Delivered'
        ? Number((loadedM3 - 2.80).toFixed(2))
        : 0;
      const remainingM3 = Number((loadedM3 - deliveredM3).toFixed(2));

      // Route tariff lookup
      const tariff = queryOne<any>(
        'SELECT id, fee_per_trip_etb FROM route_tariffs WHERE origin_location_id = ? AND destination_location_id = ?',
        [crusherId, destLocId]
      );
      const feePerTrip = tariff ? Number(tariff.fee_per_trip_etb) : 8500;
      const totalTransportFee = status === 'Cancelled' ? 0 : feePerTrip;

      const unitCost = sandType === '00' ? 950 : sandType === '01' ? 1100 : 1250;
      const unitPrice = sandType === '00' ? 1750 : sandType === '01' ? 1980 : 2250;

      const totalCost = Number((loadedM3 * unitCost).toFixed(2));
      const totalRevenue = Number((deliveredM3 * unitPrice).toFixed(2));
      const grossProfit = Number((totalRevenue - totalCost).toFixed(2));
      const shortageLoss = Number((remainingM3 * unitCost).toFixed(2));

      const tripId = `TRP-2026-${String(i + 1).padStart(4, '0')}`;
      const loadingTime = `${tripDate}T${String(7 + (i % 5)).padStart(2, '0')}:30:00Z`;
      const unloadingTime = `${tripDate}T${String(11 + (i % 5)).padStart(2, '0')}:45:00Z`;

      db.run(
        `INSERT INTO trips (
          id, trip_date, truck_id, truck_plate, truck_owner,
          company_id, company_name, project_id, project_name,
          loading_location_id, loading_location_name, loading_datetime,
          sand_type, quantity_loaded_m3, loading_notes,
          unloading_location_id, unloading_location_name, unloading_datetime,
          quantity_delivered_m3, quantity_remaining_m3,
          delivery_outcome, delivery_proof_ref, unloading_notes,
          status, status_reason, capacity_warning_acknowledged,
          transport_rate_etb_per_m3, total_transport_fee_etb, route_tariff_id,
          unit_cost_etb, total_cost_etb, unit_price_etb, total_revenue_etb, gross_profit_etb, shortage_loss_etb,
          created_by_user_id, created_by_user_name, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, 0,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          'usr_operator', 'Elena Vance (Dispatcher)', ?, ?
        )`,
        [
          tripId, tripDate, truckId, truck.plate_number, truck.owner_name,
          companyId, project.company_name, projectId, project.project_name,
          crusherId, crusher.name, loadingTime,
          sandType, loadedM3, `Scale ticket from ${crusher.name} (${crusher.address})`,
          destLocId, project.project_name, status === 'Delivered' || status === 'Partially Delivered' ? unloadingTime : null,
          deliveredM3, remainingM3,
          status === 'Delivered' ? 'Delivered' : status === 'Partially Delivered' ? 'Partial Delivery' : 'In Transit',
          `POD-ET-${String(1000 + i)}`, `Site supervisor verified at ${project.address}`,
          status, status === 'Partially Delivered' ? 'Jobsite staging storage limited' : 'Dispatched',
          feePerTrip, totalTransportFee, tariff?.id || null,
          unitCost, totalCost, unitPrice, totalRevenue, grossProfit, shortageLoss,
          loadingTime, unloadingTime
        ]
      );
    }
    console.log('Successfully seeded Ethiopian Logistics sample dataset!');
  } catch (err) {
    console.error('Error seeding Ethiopian sample dataset:', err);
  }
}

export function migrateInitialUserAuditLogs() {
  if (!db) return;
  try {
    const existing = queryOne<any>("SELECT COUNT(*) as count FROM audit_logs WHERE entity_type = 'user'");
    if (existing && Number(existing.count) > 0) return;

    const now = new Date();
    const dStr = (minutesAgo: number) => {
      const d = new Date(now.getTime() - minutesAgo * 60 * 1000);
      return d.toISOString();
    };

    const initialAuditRecords = [
      {
        id: 'audit_init_usr_01',
        user_id: 'usr_admin',
        user_name: 'System Administrator',
        action: 'CREATE_USER',
        entity_type: 'user',
        entity_id: 'usr_admin',
        details: 'System Administrator super-user account initialized with administrative security access.',
        created_at: dStr(180)
      },
      {
        id: 'audit_init_usr_02',
        user_id: 'usr_admin',
        user_name: 'System Administrator',
        action: 'CREATE_USER',
        entity_type: 'user',
        entity_id: 'usr_operator',
        details: 'Administrator created user account @operator (Elena Vance) with role "data_entry" and status "Active".',
        created_at: dStr(120)
      },
      {
        id: 'audit_init_usr_03',
        user_id: 'usr_admin',
        user_name: 'System Administrator',
        action: 'CREATE_USER',
        entity_type: 'user',
        entity_id: 'usr_viewer',
        details: 'Administrator created user account @viewer (Marcus Brody) with role "viewer" and status "Active".',
        created_at: dStr(90)
      },
      {
        id: 'audit_init_usr_04',
        user_id: 'usr_admin',
        user_name: 'System Administrator',
        action: 'ENABLE_USER',
        entity_type: 'user',
        entity_id: 'usr_operator',
        details: 'Administrator verified and enabled active status for dispatcher account @operator.',
        created_at: dStr(60)
      }
    ];

    for (const r of initialAuditRecords) {
      db.run(
        `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.user_id, r.user_name, r.action, r.entity_type, r.entity_id, r.details, r.created_at]
      );
    }
    saveDb();
  } catch (err) {
    console.error('migrateInitialUserAuditLogs error:', err);
  }
}

