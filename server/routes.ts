import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, queryOne, execute, transaction, getCloudBackupDiagnostics, forceCloudBackupSync, listCloudBackups, restoreCloudBackup } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'sandtrack-secret-key-2026-secure';

export const apiRouter = Router();

// Auth token helper
export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'data_entry' | 'viewer';
  avatar_url?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Middleware to parse auth token (Authorization header or cookie)
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.sandtrack_token) {
    token = req.cookies.sandtrack_token;
  }

  if (!token) {
    req.user = undefined;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (_err) {
    req.user = undefined;
    next();
  }
};

// Require at least a valid user
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Role guard for Data Entry Operator or Admin (blocks Viewer)
export const requireDataEntry = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'data_entry' && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Permission denied: Viewer role is not authorized to create or modify operational records.'
    });
  }
  next();
};

// Role guard for Admin only
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Permission denied: Administrator privileges required.'
    });
  }
  next();
};

// Audit Log Helper for administrative security & traceability
export function recordAuditLog(
  userId: string | null | undefined,
  userName: string | null | undefined,
  action: string,
  entityType: string,
  entityId: string,
  details: string
) {
  try {
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    execute(
      `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [auditId, userId || null, userName || 'System', action, entityType, entityId, details, now]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// Lightweight public health check endpoint for uptime pingers & monitors
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// Real-time Supabase persistent volume & SQLite backup diagnostics
apiRouter.get('/system/cloud-backup', async (_req: Request, res: Response) => {
  try {
    const diagnostics = await getCloudBackupDiagnostics();
    res.json(diagnostics);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// List all historic dated backup files stored in the Supabase bucket
apiRouter.get('/system/cloud-backups', async (_req: Request, res: Response) => {
  try {
    const backups = await listCloudBackups();
    res.json(backups);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Force manual backup sync to Supabase bucket (with optional timestamped snapshot)
apiRouter.post('/system/cloud-backup/sync', async (req: Request, res: Response) => {
  try {
    const timestamped = req.body?.timestamped === true;
    const result = await forceCloudBackupSync({ timestamped });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Download a specific dated backup file directly
apiRouter.get('/system/cloud-backups/download', async (req: Request, res: Response) => {
  const fileName = String(req.query.file || '');
  const cleanName = fileName.replace(/^backups\//, '').replace(/[^a-zA-Z0-9_.-]/g, '');
  if (!cleanName.endsWith('.sqlite')) {
    return res.status(400).json({ error: 'Invalid backup filename' });
  }

  const rawUrl = process.env.SUPABASE_URL?.trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
  const rawKey = (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim().replace(/^["']|["']$/g, '');
  let bucket = (process.env.STORAGE_BUCKET || 'sandtrack-db').trim().replace(/^["']|["']$/g, '');
  if (!bucket || bucket.startsWith('sb_') || bucket.startsWith('eyJ') || bucket.length > 30) {
    bucket = 'sandtrack-db';
  }

  if (!rawUrl || !rawKey) {
    return res.status(503).json({ error: 'Supabase cloud storage is not configured' });
  }

  try {
    const fileUrl = `${rawUrl}/storage/v1/object/${bucket}/backups/${cleanName}`;
    const upstreamRes = await fetch(fileUrl, {
      headers: {
        apikey: rawKey,
        Authorization: `Bearer ${rawKey}`,
      },
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ error: 'Failed to retrieve file from Supabase storage' });
    }

    const arrayBuffer = await upstreamRes.arrayBuffer();
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanName}"`);
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Restore database from a specific dated snapshot
apiRouter.post('/system/cloud-backups/restore', async (req: Request, res: Response) => {
  const fileName = String(req.body?.file || '');
  if (!fileName) {
    return res.status(400).json({ error: 'Backup filename is required' });
  }

  try {
    const result = await restoreCloudBackup(fileName);
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Apply auth parser across all API routes
apiRouter.use(authenticate);

// ==========================================
// AUTHENTICATION & USER MANAGEMENT
// ==========================================

// Login
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = queryOne<any>(
    'SELECT * FROM users WHERE username = ? OR email = ?',
    [username.trim().toLowerCase(), username.trim().toLowerCase()]
  );

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (user.is_active !== undefined && Number(user.is_active) === 0) {
    return res.status(403).json({ error: 'This account has been disabled. Please contact your system administrator.' });
  }

  const userData: AuthenticatedUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    avatar_url: user.avatar_url || null
  };

  const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('sandtrack_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 });
  return res.json({ token, user: userData });
});

// Register new user account with distinct login credentials
apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const { username, email, password, full_name, role } = req.body;
  if (!username || !email || !password || !full_name) {
    return res.status(400).json({ error: 'Full name, username, email, and password are all required.' });
  }

  const cleanRole = role === 'viewer' ? 'viewer' : 'data_entry';
  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const existing = queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [cleanUsername, cleanEmail]);
  if (existing) {
    return res.status(409).json({ error: 'A user with this username or email already exists. Please choose a different one or sign in.' });
  }

  const now = new Date().toISOString();
  const id = `usr_${Date.now()}`;
  const password_hash = bcrypt.hashSync(password, 10);

  execute(
    `INSERT INTO users (id, username, email, password_hash, full_name, role, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, cleanUsername, cleanEmail, password_hash, full_name.trim(), cleanRole, null, now, now]
  );

  const userData: AuthenticatedUser = {
    id,
    username: cleanUsername,
    email: cleanEmail,
    full_name: full_name.trim(),
    role: cleanRole,
    avatar_url: null
  };

  recordAuditLog(
    id,
    full_name.trim(),
    'REGISTER_USER',
    'user',
    id,
    `New user self-registered account @${cleanUsername} with role "${cleanRole}".`
  );

  const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('sandtrack_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 });
  return res.status(201).json({ token, user: userData });
});

// Current user profile (fetched fresh from db)
apiRouter.get('/auth/me', (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const user = queryOne<any>(
    'SELECT id, username, email, full_name, role, avatar_url, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user });
});

// Update profile (full_name and avatar_url) for any authenticated role
apiRouter.put('/auth/profile', (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { full_name, avatar_url } = req.body;
  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ error: 'Full name is required' });
  }

  const now = new Date().toISOString();
  execute(
    'UPDATE users SET full_name = ?, avatar_url = ?, updated_at = ? WHERE id = ?',
    [full_name.trim(), avatar_url !== undefined ? avatar_url : null, now, req.user.id]
  );

  const updatedUser = queryOne<any>(
    'SELECT id, username, email, full_name, role, avatar_url FROM users WHERE id = ?',
    [req.user.id]
  );

  const token = jwt.sign(updatedUser, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('sandtrack_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 });

  return res.json({ user: updatedUser, token });
});

// Change password for any authenticated role
apiRouter.put('/auth/change-password', (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Both current password and new password are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  const user = queryOne<any>('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!user || !bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  const now = new Date().toISOString();
  execute('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [newHash, now, req.user.id]);

  recordAuditLog(
    req.user.id,
    req.user.full_name,
    'SELF_PASSWORD_CHANGE',
    'user',
    req.user.id,
    `User @${req.user.username} successfully updated their own account password.`
  );

  return res.json({ success: true, message: 'Password changed successfully' });
});

// Logout
apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('sandtrack_token');
  return res.json({ success: true });
});

// Users list (Admin only)
apiRouter.get('/users', requireAdmin, (_req: Request, res: Response) => {
  const users = query<any>('SELECT id, username, email, full_name, role, avatar_url, COALESCE(is_active, 1) as is_active, created_at, updated_at FROM users ORDER BY created_at DESC');
  return res.json(users);
});

// Create new user (Admin only)
apiRouter.post('/users', requireAdmin, (req: Request, res: Response) => {
  const { username, email, password, full_name, role, avatar_url, is_active } = req.body;
  if (!username || !email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'All user fields (username, email, password, full name, role) are required' });
  }
  if (!['admin', 'data_entry', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin, data_entry, or viewer' });
  }
  if (password.trim().length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();

  const existing = queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [cleanUsername, cleanEmail]);
  if (existing) {
    return res.status(409).json({ error: 'Username or email already exists in the system' });
  }

  const now = new Date().toISOString();
  const id = `usr_${Date.now()}`;
  const password_hash = bcrypt.hashSync(password.trim(), 10);
  const activeState = is_active !== undefined ? (is_active ? 1 : 0) : 1;

  execute(
    `INSERT INTO users (id, username, email, password_hash, full_name, role, avatar_url, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, cleanUsername, cleanEmail, password_hash, full_name.trim(), role, avatar_url || null, activeState, now, now]
  );

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'CREATE_USER',
    'user',
    id,
    `Administrator created user account @${cleanUsername} (${full_name.trim()}) with role "${role}" and status "${activeState === 1 ? 'Active' : 'Disabled'}".`
  );

  return res.status(201).json({ id, username: cleanUsername, email: cleanEmail, full_name: full_name.trim(), role, avatar_url: avatar_url || null, is_active: activeState, created_at: now });
});

// Full User Edit: Update username, full_name, email, role, avatar_url, optional password, is_active (Admin only)
apiRouter.put('/users/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { username, email, full_name, role, avatar_url, password, is_active } = req.body;

  const target = queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
  if (!target) {
    return res.status(404).json({ error: 'User account not found' });
  }

  if (username && username.trim().toLowerCase() !== target.username) {
    const existingU = queryOne('SELECT id FROM users WHERE username = ? AND id != ?', [username.trim().toLowerCase(), id]);
    if (existingU) {
      return res.status(409).json({ error: 'Username is already taken by another user' });
    }
  }

  if (email && email.trim().toLowerCase() !== target.email) {
    const existingE = queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [email.trim().toLowerCase(), id]);
    if (existingE) {
      return res.status(409).json({ error: 'Email address is already in use by another user' });
    }
  }

  if (role && !['admin', 'data_entry', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role specified' });
  }

  // Prevent demoting or deactivating yourself
  if (req.user && req.user.id === id) {
    if (role && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove administrator privileges from your own active session.' });
    }
    if (is_active !== undefined && (is_active === 0 || is_active === false)) {
      return res.status(400).json({ error: 'You cannot disable your own active administrator account.' });
    }
  }

  const newUsername = username ? username.trim().toLowerCase() : target.username;
  const newEmail = email ? email.trim().toLowerCase() : target.email;
  const newFullName = full_name ? full_name.trim() : target.full_name;
  const newRole = role || target.role;
  const newAvatar = avatar_url !== undefined ? avatar_url : target.avatar_url;
  const newIsActive = is_active !== undefined ? (is_active ? 1 : 0) : (target.is_active ?? 1);
  const now = new Date().toISOString();

  let passwordChanged = false;
  let newPasswordHash = target.password_hash;
  if (password && password.trim().length > 0) {
    if (password.trim().length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }
    newPasswordHash = bcrypt.hashSync(password.trim(), 10);
    passwordChanged = true;
  }

  execute(
    `UPDATE users SET
       username = ?,
       email = ?,
       full_name = ?,
       role = ?,
       avatar_url = ?,
       password_hash = ?,
       is_active = ?,
       updated_at = ?
     WHERE id = ?`,
    [newUsername, newEmail, newFullName, newRole, newAvatar, newPasswordHash, newIsActive, now, id]
  );

  const changes: string[] = [];
  if (username && username.trim().toLowerCase() !== target.username) {
    changes.push(`username: @${target.username} -> @${newUsername}`);
  }
  if (email && email.trim().toLowerCase() !== target.email) {
    changes.push(`email: ${target.email} -> ${newEmail}`);
  }
  if (full_name && full_name.trim() !== target.full_name) {
    changes.push(`name: "${target.full_name}" -> "${newFullName}"`);
  }
  if (role && role !== target.role) {
    changes.push(`role: "${target.role}" -> "${newRole}"`);
  }
  if (is_active !== undefined && (is_active ? 1 : 0) !== (target.is_active ?? 1)) {
    changes.push(`status: ${(target.is_active ?? 1) === 0 ? 'Disabled' : 'Active'} -> ${newIsActive === 1 ? 'Active' : 'Disabled'}`);
  }
  if (passwordChanged) {
    changes.push('password reset');
  }

  const auditDetails = changes.length > 0
    ? `Administrator updated user @${target.username}: ${changes.join(', ')}`
    : `Administrator updated profile details for user @${target.username}`;

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'UPDATE_USER',
    'user',
    id,
    auditDetails
  );

  const updated = queryOne<any>('SELECT id, username, email, full_name, role, avatar_url, is_active, created_at, updated_at FROM users WHERE id = ?', [id]);
  return res.json(updated);
});

// Update user role quickly (Admin only)
apiRouter.put('/users/:id/role', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!['admin', 'data_entry', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (req.user && req.user.id === id && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot demote your own administrator account.' });
  }

  const target = queryOne<any>('SELECT id, username, role, full_name FROM users WHERE id = ?', [id]);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  const now = new Date().toISOString();
  execute('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, now, id]);

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'CHANGE_ROLE',
    'user',
    id,
    `Administrator changed role for user @${target.username} from "${target.role}" to "${role}".`
  );

  return res.json({ success: true, id, role });
});

// Admin Reset Password for any user (Admin only)
apiRouter.put('/users/:id/password', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password || password.trim().length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  const target = queryOne<any>('SELECT id, username, full_name FROM users WHERE id = ?', [id]);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }
  const hash = bcrypt.hashSync(password.trim(), 10);
  const now = new Date().toISOString();
  execute('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash, now, id]);

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'RESET_PASSWORD',
    'user',
    id,
    `Administrator reset password for user @${target.username} (${target.full_name || target.username}).`
  );

  return res.json({ success: true, message: `Password for ${target.username} updated successfully` });
});

// Enable / Disable user (Admin only)
apiRouter.put('/users/:id/status', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { is_active } = req.body;
  if (req.user && req.user.id === id && (is_active === 0 || is_active === false)) {
    return res.status(400).json({ error: 'You cannot disable your own active account.' });
  }
  const target = queryOne<any>('SELECT id, username, full_name FROM users WHERE id = ?', [id]);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }
  const activeState = (is_active === 1 || is_active === true) ? 1 : 0;
  const now = new Date().toISOString();
  execute('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?', [activeState, now, id]);

  const actionName = activeState === 1 ? 'ENABLE_USER' : 'DISABLE_USER';
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    actionName,
    'user',
    id,
    `Administrator ${activeState === 1 ? 'enabled (activated)' : 'disabled (deactivated)'} access for user @${target.username} (${target.full_name || target.username}).`
  );

  return res.json({ success: true, id, is_active: activeState, message: `User ${target.username} is now ${activeState === 1 ? 'Enabled' : 'Disabled'}.` });
});

// Delete user from system (Admin only)
apiRouter.delete('/users/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  if (req.user && req.user.id === id) {
    return res.status(400).json({ error: 'You cannot delete your own active administrator account.' });
  }
  const target = queryOne<any>('SELECT id, username, full_name, role FROM users WHERE id = ?', [id]);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }
  execute('DELETE FROM users WHERE id = ?', [id]);

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'DELETE_USER',
    'user',
    id,
    `Administrator permanently deleted user account @${target.username} (${target.full_name}, ${target.role}).`
  );

  return res.json({ success: true, id, message: `User account "${target.username}" has been permanently deleted from the system.` });
});

// Activity & Security Audit Logs (Admin only)
apiRouter.get('/audit-logs', requireAdmin, (req: Request, res: Response) => {
  const {
    entity_type,
    action,
    search,
    limit = 100,
    offset = 0
  } = req.query;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (entity_type && entity_type !== 'all') {
    whereClauses.push('entity_type = ?');
    params.push(String(entity_type));
  }

  if (action && action !== 'all') {
    whereClauses.push('action = ?');
    params.push(String(action));
  }

  if (search && String(search).trim()) {
    const s = `%${String(search).trim()}%`;
    whereClauses.push('(user_name LIKE ? OR action LIKE ? OR details LIKE ? OR entity_id LIKE ?)');
    params.push(s, s, s, s);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const totalRes = queryOne<any>(`SELECT COUNT(*) as total FROM audit_logs ${whereSql}`, params);
  const total = totalRes?.total || 0;

  const parsedLimit = Math.min(Math.max(1, Number(limit) || 100), 500);
  const parsedOffset = Math.max(0, Number(offset) || 0);

  const logs = query<any>(
    `SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, parsedLimit, parsedOffset]
  );

  const summaryRes = query<any>(`
    SELECT
      COUNT(*) as total_events,
      SUM(CASE WHEN action IN ('RESET_PASSWORD', 'SELF_PASSWORD_CHANGE') THEN 1 ELSE 0 END) as password_events,
      SUM(CASE WHEN action IN ('ENABLE_USER', 'DISABLE_USER') THEN 1 ELSE 0 END) as status_events,
      SUM(CASE WHEN action IN ('CREATE_USER', 'REGISTER_USER', 'DELETE_USER') THEN 1 ELSE 0 END) as lifecycle_events,
      SUM(CASE WHEN action IN ('UPDATE_USER', 'CHANGE_ROLE') THEN 1 ELSE 0 END) as edit_events
    FROM audit_logs
    WHERE entity_type = 'user'
  `)[0] || {};

  return res.json({
    logs,
    total,
    summary: {
      totalUserEvents: Number(summaryRes.total_events || 0),
      passwordEvents: Number(summaryRes.password_events || 0),
      statusEvents: Number(summaryRes.status_events || 0),
      lifecycleEvents: Number(summaryRes.lifecycle_events || 0),
      editEvents: Number(summaryRes.edit_events || 0)
    }
  });
});

// ==========================================
// TRUCKS REGISTRY
// ==========================================

// List trucks with trip counts & delivered stats
apiRouter.get('/trucks', (_req: Request, res: Response) => {
  const trucks = query<any>(`
    SELECT t.*,
      COUNT(tr.id) as total_trips,
      SUM(CASE WHEN tr.status = 'Delivered' THEN 1 ELSE 0 END) as successful_trips,
      SUM(CASE WHEN tr.status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_trips,
      SUM(CASE WHEN tr.status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_trips,
      SUM(CASE WHEN tr.status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_trips,
      SUM(CASE WHEN tr.status IN ('Registered', 'Loading', 'Loaded / In Transit') THEN 1 ELSE 0 END) as pending_trips,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as total_loaded_m3,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3
    FROM trucks t
    LEFT JOIN trips tr ON t.id = tr.truck_id
    GROUP BY t.id
    ORDER BY t.is_active DESC, t.created_at DESC, t.id DESC
  `);

  const enriched = trucks.map(t => {
    const eligibleCompleted = (t.successful_trips || 0) + (t.partial_trips || 0) + (t.unsuccessful_trips || 0);
    const successRate = eligibleCompleted > 0
      ? Number(((t.successful_trips / eligibleCompleted) * 100).toFixed(1))
      : null;
    return { ...t, success_rate: successRate };
  });

  return res.json(enriched);
});

// Register new truck (Role A only)
apiRouter.post('/trucks', requireDataEntry, (req: Request, res: Response) => {
  const { plate_number, owner_name, capacity_m3, owner_phone, notes } = req.body;
  if (!plate_number || !owner_name) {
    return res.status(400).json({ error: 'Plate number and owner name are required' });
  }

  const cleanPlate = plate_number.trim().toUpperCase();
  const existing = queryOne('SELECT id, is_active FROM trucks WHERE UPPER(plate_number) = ?', [cleanPlate]);
  if (existing) {
    if (existing.is_active === 1) {
      return res.status(409).json({ error: `An active truck with plate number "${cleanPlate}" is already registered.` });
    } else {
      return res.status(409).json({ error: `Truck "${cleanPlate}" is currently archived/inactive. Reactivate it from the truck list.` });
    }
  }

  const now = new Date().toISOString();
  const id = `TRK-${Date.now().toString().slice(-4)}`;
  const cap = capacity_m3 ? Number(parseFloat(capacity_m3).toFixed(2)) : null;

  execute(
    `INSERT INTO trucks (id, plate_number, owner_name, capacity_m3, owner_phone, is_active, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [id, cleanPlate, owner_name.trim(), cap, owner_phone?.trim() || null, notes?.trim() || null, now, now]
  );

  return res.status(201).json({ id, plate_number: cleanPlate, owner_name: owner_name.trim(), capacity_m3: cap, is_active: 1 });
});

// Update truck (Role A only)
apiRouter.put('/trucks/:id', requireDataEntry, (req: Request, res: Response) => {
  const { id } = req.params;
  const { plate_number, owner_name, capacity_m3, owner_phone, is_active, notes } = req.body;

  const truck = queryOne('SELECT * FROM trucks WHERE id = ?', [id]);
  if (!truck) {
    return res.status(404).json({ error: 'Truck not found' });
  }

  const cleanPlate = plate_number ? plate_number.trim().toUpperCase() : truck.plate_number;
  if (cleanPlate !== truck.plate_number) {
    const existing = queryOne('SELECT id FROM trucks WHERE UPPER(plate_number) = ? AND id != ? AND is_active = 1', [cleanPlate, id]);
    if (existing) {
      return res.status(409).json({ error: `Another active truck with plate "${cleanPlate}" already exists.` });
    }
  }

  const now = new Date().toISOString();
  const cap = capacity_m3 !== undefined && capacity_m3 !== null && capacity_m3 !== ''
    ? Number(parseFloat(capacity_m3).toFixed(2))
    : truck.capacity_m3;
  const activeStatus = is_active !== undefined ? (is_active ? 1 : 0) : truck.is_active;

  execute(
    `UPDATE trucks
     SET plate_number = ?, owner_name = ?, capacity_m3 = ?, owner_phone = ?, is_active = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [cleanPlate, owner_name ? owner_name.trim() : truck.owner_name, cap, owner_phone !== undefined ? owner_phone : truck.owner_phone, activeStatus, notes !== undefined ? notes : truck.notes, now, id]
  );

  return res.json({ success: true, id, plate_number: cleanPlate });
});

// Get truck details & historical trips
apiRouter.get('/trucks/:id/history', (req: Request, res: Response) => {
  const { id } = req.params;
  const truck = queryOne('SELECT * FROM trucks WHERE id = ?', [id]);
  if (!truck) return res.status(404).json({ error: 'Truck not found' });
  const trips = query<any>('SELECT * FROM trips WHERE truck_id = ? ORDER BY trip_date DESC, created_at DESC', [id]);
  return res.json({ truck, trips });
});

// ==========================================
// CONSTRUCTION COMPANIES & PROJECTS
// ==========================================

// List companies
apiRouter.get('/companies', (_req: Request, res: Response) => {
  const companies = query<any>(`
    SELECT c.*,
      COUNT(DISTINCT p.id) as project_count,
      COUNT(DISTINCT tr.id) as total_trips,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3
    FROM construction_companies c
    LEFT JOIN projects p ON c.id = p.company_id
    LEFT JOIN trips tr ON c.id = tr.company_id
    GROUP BY c.id
    ORDER BY c.is_active DESC, c.created_at DESC, c.id DESC
  `);
  return res.json(companies);
});

// Create company (Role A only)
apiRouter.post('/companies', requireDataEntry, (req: Request, res: Response) => {
  const { name, contact_person, phone, address, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Company name is required' });

  const existing = queryOne('SELECT id FROM construction_companies WHERE LOWER(name) = ?', [name.trim().toLowerCase()]);
  if (existing) {
    return res.status(409).json({ error: `Company "${name}" already exists.` });
  }

  const now = new Date().toISOString();
  const id = `CMP-${Date.now().toString().slice(-4)}`;
  execute(
    `INSERT INTO construction_companies (id, name, contact_person, phone, address, is_active, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [id, name.trim(), contact_person?.trim() || null, phone?.trim() || null, address?.trim() || null, notes?.trim() || null, now, now]
  );
  return res.status(201).json({ id, name: name.trim(), is_active: 1 });
});

// Update company (Role A only)
apiRouter.put('/companies/:id', requireDataEntry, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, contact_person, phone, address, is_active, notes } = req.body;

  const comp = queryOne('SELECT * FROM construction_companies WHERE id = ?', [id]);
  if (!comp) return res.status(404).json({ error: 'Company not found' });

  const now = new Date().toISOString();
  const activeStatus = is_active !== undefined ? (is_active ? 1 : 0) : comp.is_active;

  execute(
    `UPDATE construction_companies
     SET name = ?, contact_person = ?, phone = ?, address = ?, is_active = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [name ? name.trim() : comp.name, contact_person !== undefined ? contact_person : comp.contact_person, phone !== undefined ? phone : comp.phone, address !== undefined ? address : comp.address, activeStatus, notes !== undefined ? notes : comp.notes, now, id]
  );
  return res.json({ success: true, id });
});

// Get company details, associated projects & dispatches
apiRouter.get('/companies/:id/details', (req: Request, res: Response) => {
  const { id } = req.params;
  const company = queryOne<any>('SELECT * FROM construction_companies WHERE id = ?', [id]);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  const projects = query<any>('SELECT * FROM projects WHERE company_id = ? ORDER BY is_active DESC, created_at DESC, id DESC', [id]);
  const trips = query<any>('SELECT * FROM trips WHERE company_id = ? ORDER BY trip_date DESC, created_at DESC LIMIT 50', [id]);
  const summaryRes = queryOne<any>(`
    SELECT COUNT(*) as total_trips,
           ROUND(COALESCE(SUM(quantity_delivered_m3), 0), 2) as total_delivered_m3,
           ROUND(COALESCE(SUM(total_revenue_etb), 0), 2) as total_revenue_etb
    FROM trips WHERE company_id = ? AND status != 'Cancelled'
  `, [id]);
  return res.json({
    company,
    projects,
    trips,
    summary: {
      totalTrips: summaryRes?.total_trips || 0,
      totalDeliveredM3: summaryRes?.total_delivered_m3 || 0,
      totalRevenueEtb: summaryRes?.total_revenue_etb || 0,
    }
  });
});

// List projects
apiRouter.get('/projects', (req: Request, res: Response) => {
  const { company_id } = req.query;
  let sql = `
    SELECT p.*, c.name as company_name,
      COUNT(tr.id) as total_trips,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(tr.total_revenue_etb), 0), 2) as total_revenue_etb
    FROM projects p
    JOIN construction_companies c ON p.company_id = c.id
    LEFT JOIN trips tr ON p.id = tr.project_id
  `;
  const params: any[] = [];
  if (company_id) {
    sql += ` WHERE p.company_id = ? `;
    params.push(company_id);
  }
  sql += ` GROUP BY p.id ORDER BY p.is_active DESC, p.created_at DESC, p.id DESC`;
  const projects = query<any>(sql, params);
  return res.json(projects);
});

// Create project (Role A only)
apiRouter.post('/projects', requireDataEntry, (req: Request, res: Response) => {
  const { name, company_id, address, latitude, longitude, price_sand_00, price_sand_01, price_sand_02, notes } = req.body;
  if (!name || !company_id) {
    return res.status(400).json({ error: 'Project name and company are required' });
  }
  const comp = queryOne('SELECT id FROM construction_companies WHERE id = ?', [company_id]);
  if (!comp) return res.status(404).json({ error: 'Associated company not found' });

  const now = new Date().toISOString();
  const id = `PRJ-${Date.now().toString().slice(-4)}`;
  execute(
    `INSERT INTO projects (id, name, company_id, address, latitude, longitude, price_sand_00, price_sand_01, price_sand_02, is_active, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      id,
      name.trim(),
      company_id,
      address?.trim() || null,
      latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : null,
      longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : null,
      price_sand_00 !== undefined ? Number(price_sand_00) : 1650,
      price_sand_01 !== undefined ? Number(price_sand_01) : 1880,
      price_sand_02 !== undefined ? Number(price_sand_02) : 2100,
      notes?.trim() || null,
      now,
      now
    ]
  );
  return res.status(201).json({ id, name: name.trim(), company_id, is_active: 1 });
});

// Update project (Role A only)
apiRouter.put('/projects/:id', requireDataEntry, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, address, latitude, longitude, price_sand_00, price_sand_01, price_sand_02, is_active, notes } = req.body;

  const proj = queryOne<any>('SELECT * FROM projects WHERE id = ?', [id]);
  if (!proj) return res.status(404).json({ error: 'Project not found' });

  const now = new Date().toISOString();
  const activeStatus = is_active !== undefined ? (is_active ? 1 : 0) : proj.is_active;

  execute(
    `UPDATE projects
     SET name = ?, address = ?, latitude = ?, longitude = ?, price_sand_00 = ?, price_sand_01 = ?, price_sand_02 = ?, is_active = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [
      name ? name.trim() : proj.name,
      address !== undefined ? address : proj.address,
      latitude !== undefined ? (latitude !== null && latitude !== '' ? Number(latitude) : null) : proj.latitude,
      longitude !== undefined ? (longitude !== null && longitude !== '' ? Number(longitude) : null) : proj.longitude,
      price_sand_00 !== undefined ? Number(price_sand_00) : (proj.price_sand_00 || 1650),
      price_sand_01 !== undefined ? Number(price_sand_01) : (proj.price_sand_01 || 1880),
      price_sand_02 !== undefined ? Number(price_sand_02) : (proj.price_sand_02 || 2100),
      activeStatus,
      notes !== undefined ? notes : proj.notes,
      now,
      id
    ]
  );
  return res.json({ success: true, id });
});

// Get project details, company affiliation & recent dispatches
apiRouter.get('/projects/:id/details', (req: Request, res: Response) => {
  const { id } = req.params;
  const project = queryOne<any>('SELECT * FROM projects WHERE id = ?', [id]);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const company = queryOne<any>('SELECT * FROM construction_companies WHERE id = ?', [project.company_id]);
  const trips = query<any>('SELECT * FROM trips WHERE project_id = ? ORDER BY trip_date DESC, created_at DESC LIMIT 50', [id]);
  const summaryRes = queryOne<any>(`
    SELECT COUNT(*) as total_trips,
           ROUND(COALESCE(SUM(quantity_delivered_m3), 0), 2) as total_delivered_m3,
           ROUND(COALESCE(SUM(total_revenue_etb), 0), 2) as total_revenue_etb
    FROM trips WHERE project_id = ? AND status != 'Cancelled'
  `, [id]);
  return res.json({
    project,
    company,
    trips,
    summary: {
      totalTrips: summaryRes?.total_trips || 0,
      totalDeliveredM3: summaryRes?.total_delivered_m3 || 0,
      totalRevenueEtb: summaryRes?.total_revenue_etb || 0,
    }
  });
});

// ==========================================
// LOCATIONS (CRUSHER SITES & JOBSITE DESTINATIONS)
// ==========================================

apiRouter.get('/locations', (req: Request, res: Response) => {
  const { type, active_only } = req.query;
  let sql = `
    SELECT l.*,
      c.name as associated_company_name,
      p.name as associated_project_name,
      (SELECT COUNT(*) FROM trips WHERE loading_location_id = l.id) as trips_loaded_here,
      (SELECT COUNT(*) FROM trips WHERE unloading_location_id = l.id) as trips_unloaded_here,
      (SELECT ROUND(COALESCE(SUM(total_cost_etb), 0), 2) FROM trips WHERE loading_location_id = l.id) as total_cost_etb,
      (SELECT ROUND(COALESCE(SUM(total_revenue_etb), 0), 2) FROM trips WHERE unloading_location_id = l.id) as total_revenue_etb
    FROM locations l
    LEFT JOIN construction_companies c ON l.associated_company_id = c.id
    LEFT JOIN projects p ON l.associated_project_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (active_only === 'true') {
    sql += ' AND l.is_active = 1 ';
  }
  if (type === 'Loading' || !type) {
    sql += " AND l.location_type IN ('Loading', 'Both') ";
  } else if (type === 'Unloading') {
    sql += " AND l.location_type = 'Loading' ";
  }
  sql += ' ORDER BY l.is_active DESC, l.created_at DESC, l.id DESC ';
  const locations = query<any>(sql, params);
  return res.json(locations);
});

apiRouter.post('/locations', requireDataEntry, (req: Request, res: Response) => {
  const {
    name, location_type, address, associated_company_id, associated_project_id,
    contact_person, phone,
    latitude, longitude,
    price_sand_00, price_sand_01, price_sand_02,
    selling_price_sand_00, selling_price_sand_01, selling_price_sand_02,
    notes
  } = req.body;
  if (!name || !location_type) {
    return res.status(400).json({ error: 'Location name and location type (Loading, Unloading, Both) are required' });
  }
  if (!['Loading', 'Unloading', 'Both'].includes(location_type)) {
    return res.status(400).json({ error: 'Location type must be Loading, Unloading, or Both' });
  }
  const now = new Date().toISOString();
  const id = `LOC-${Date.now().toString().slice(-4)}`;
  execute(
    `INSERT INTO locations (
      id, name, location_type, address, associated_company_id, associated_project_id,
      contact_person, phone,
      latitude, longitude,
      price_sand_00, price_sand_01, price_sand_02,
      selling_price_sand_00, selling_price_sand_01, selling_price_sand_02,
      is_active, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      id, name.trim(), location_type, address?.trim() || null, associated_company_id || null, associated_project_id || null,
      contact_person?.trim() || null, phone?.trim() || null,
      latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : null,
      longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : null,
      price_sand_00 !== undefined ? Number(price_sand_00) : 920,
      price_sand_01 !== undefined ? Number(price_sand_01) : 1050,
      price_sand_02 !== undefined ? Number(price_sand_02) : 1180,
      selling_price_sand_00 !== undefined ? Number(selling_price_sand_00) : 1650,
      selling_price_sand_01 !== undefined ? Number(selling_price_sand_01) : 1880,
      selling_price_sand_02 !== undefined ? Number(selling_price_sand_02) : 2100,
      notes?.trim() || null, now, now
    ]
  );
  return res.status(201).json({ id, name: name.trim(), location_type, is_active: 1 });
});

apiRouter.put('/locations/:id', requireDataEntry, (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name, location_type, address, associated_company_id, associated_project_id,
    contact_person, phone,
    latitude, longitude,
    price_sand_00, price_sand_01, price_sand_02,
    selling_price_sand_00, selling_price_sand_01, selling_price_sand_02,
    is_active, notes
  } = req.body;

  const loc = queryOne<any>('SELECT * FROM locations WHERE id = ?', [id]);
  if (!loc) return res.status(404).json({ error: 'Location not found' });

  const now = new Date().toISOString();
  const activeStatus = is_active !== undefined ? (is_active ? 1 : 0) : loc.is_active;

  execute(
    `UPDATE locations
     SET name = ?, location_type = ?, address = ?, associated_company_id = ?, associated_project_id = ?,
         contact_person = ?, phone = ?,
         latitude = ?, longitude = ?,
         price_sand_00 = ?, price_sand_01 = ?, price_sand_02 = ?,
         selling_price_sand_00 = ?, selling_price_sand_01 = ?, selling_price_sand_02 = ?,
         is_active = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [
      name ? name.trim() : loc.name,
      location_type ? location_type : loc.location_type,
      address !== undefined ? address : loc.address,
      associated_company_id !== undefined ? associated_company_id : loc.associated_company_id,
      associated_project_id !== undefined ? associated_project_id : loc.associated_project_id,
      contact_person !== undefined ? contact_person : loc.contact_person,
      phone !== undefined ? phone : loc.phone,
      latitude !== undefined ? (latitude !== null && latitude !== '' ? Number(latitude) : null) : loc.latitude,
      longitude !== undefined ? (longitude !== null && longitude !== '' ? Number(longitude) : null) : loc.longitude,
      price_sand_00 !== undefined ? Number(price_sand_00) : loc.price_sand_00,
      price_sand_01 !== undefined ? Number(price_sand_01) : loc.price_sand_01,
      price_sand_02 !== undefined ? Number(price_sand_02) : loc.price_sand_02,
      selling_price_sand_00 !== undefined ? Number(selling_price_sand_00) : loc.selling_price_sand_00,
      selling_price_sand_01 !== undefined ? Number(selling_price_sand_01) : loc.selling_price_sand_01,
      selling_price_sand_02 !== undefined ? Number(selling_price_sand_02) : loc.selling_price_sand_02,
      activeStatus,
      notes !== undefined ? notes : loc.notes,
      now,
      id
    ]
  );
  return res.json({ success: true, id });
});

// Get location details (Crusher Site Loading or Destination Project Unloading)
apiRouter.get('/locations/:id/details', (req: Request, res: Response) => {
  const { id } = req.params;
  const location = queryOne<any>('SELECT * FROM locations WHERE id = ?', [id]);
  if (!location) return res.status(404).json({ error: 'Location not found' });
  const isCrusher = location.location_type === 'Loading';
  const trips = query<any>(
    isCrusher
      ? 'SELECT * FROM trips WHERE loading_location_id = ? ORDER BY trip_date DESC, created_at DESC LIMIT 50'
      : 'SELECT * FROM trips WHERE unloading_location_id = ? ORDER BY trip_date DESC, created_at DESC LIMIT 50',
    [id]
  );
  const summaryRes = queryOne<any>(
    isCrusher
      ? `SELECT COUNT(*) as total_trips,
                ROUND(COALESCE(SUM(quantity_loaded_m3), 0), 2) as total_loaded_m3,
                ROUND(COALESCE(SUM(quantity_delivered_m3), 0), 2) as total_delivered_m3
         FROM trips WHERE loading_location_id = ? AND status != 'Cancelled'`
      : `SELECT COUNT(*) as total_trips,
                ROUND(COALESCE(SUM(quantity_delivered_m3), 0), 2) as total_delivered_m3
         FROM trips WHERE unloading_location_id = ? AND status != 'Cancelled'`,
    [id]
  );
  return res.json({
    location,
    isCrusher,
    trips,
    summary: {
      totalTrips: summaryRes?.total_trips || 0,
      totalLoadedM3: summaryRes?.total_loaded_m3 || 0,
      totalDeliveredM3: summaryRes?.total_delivered_m3 || 0,
    }
  });
});

// ==========================================
// ==========================================
// ROUTE TRANSPORT TARIFFS (FIXED ROUTE FEES PER TRIP)
// ==========================================

apiRouter.get('/route-tariffs', (_req: Request, res: Response) => {
  const tariffs = query<any>(`
    SELECT rt.*,
      COALESCE(rt.fee_per_trip_etb, rt.fixed_trip_fee_etb, rt.rate_per_m3_etb * 20, 8500) as fee_per_trip_etb,
      l_orig.name as origin_name,
      l_orig.latitude as origin_lat,
      l_orig.longitude as origin_lng,
      COALESCE(p_dest.name, rt.destination_location_name, l_dest.name) as destination_name,
      COALESCE(p_dest.address, l_dest.address) as destination_address,
      c.name as company_name,
      COALESCE(p_dest.latitude, l_dest.latitude, 8.98) as destination_lat,
      COALESCE(p_dest.longitude, l_dest.longitude, 38.79) as destination_lng,
      COUNT(tr.id) as trips_count,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(tr.total_transport_fee_etb), 0), 2) as total_fees_etb
    FROM route_tariffs rt
    LEFT JOIN locations l_orig ON rt.origin_location_id = l_orig.id
    LEFT JOIN projects p_dest ON (rt.destination_location_id = p_dest.id)
    LEFT JOIN locations l_dest ON rt.destination_location_id = l_dest.id
    LEFT JOIN construction_companies c ON (p_dest.company_id = c.id OR l_dest.associated_company_id = c.id)
    LEFT JOIN trips tr ON tr.loading_location_id = rt.origin_location_id AND (tr.unloading_location_id = rt.destination_location_id OR tr.project_id = rt.destination_location_id)
    GROUP BY rt.id
    ORDER BY rt.updated_at DESC, rt.created_at DESC, rt.id DESC
  `);
  return res.json(tariffs);
});

apiRouter.get('/route-tariffs/lookup', (req: Request, res: Response) => {
  const { origin_id, destination_id } = req.query;
  if (!origin_id || !destination_id) {
    return res.status(400).json({ error: 'origin_id and destination_id required' });
  }

  // Find destination IDs if destination_id is a project ID or location ID
  const targetDestIds: string[] = [String(destination_id)];
  const matchingLoc = queryOne<any>(
    'SELECT id, associated_project_id FROM locations WHERE associated_project_id = ? OR id = ?',
    [destination_id, destination_id]
  );
  if (matchingLoc) {
    if (matchingLoc.id && !targetDestIds.includes(matchingLoc.id)) targetDestIds.push(matchingLoc.id);
    if (matchingLoc.associated_project_id && !targetDestIds.includes(matchingLoc.associated_project_id)) {
      targetDestIds.push(matchingLoc.associated_project_id);
    }
  }

  const placeholders = targetDestIds.map(() => '?').join(',');
  const tariff = queryOne<any>(
    `SELECT rt.*,
       COALESCE(rt.fee_per_trip_etb, rt.fixed_trip_fee_etb, rt.rate_per_m3_etb * 20, 8500) as fee_per_trip_etb,
       l_orig.latitude as origin_lat, l_orig.longitude as origin_lng,
       COALESCE(p_dest.latitude, l_dest.latitude, 8.98) as destination_lat,
       COALESCE(p_dest.longitude, l_dest.longitude, 38.79) as destination_lng
     FROM route_tariffs rt
     LEFT JOIN locations l_orig ON rt.origin_location_id = l_orig.id
     LEFT JOIN projects p_dest ON rt.destination_location_id = p_dest.id
     LEFT JOIN locations l_dest ON rt.destination_location_id = l_dest.id
     WHERE rt.origin_location_id = ? AND rt.destination_location_id IN (${placeholders})
     ORDER BY rt.updated_at DESC
     LIMIT 1`,
    [origin_id, ...targetDestIds]
  );
  if (tariff) {
    return res.json({ found: true, tariff });
  }
  // Fallback default route rate
  return res.json({
    found: false,
    tariff: {
      origin_location_id: origin_id,
      destination_location_id: destination_id,
      fee_per_trip_etb: 8500,
      rate_per_m3_etb: 450,
      fixed_trip_fee_etb: 8500,
      distance_km: null,
      notes: 'Standard route tariff rate'
    }
  });
});

apiRouter.post('/route-tariffs', requireDataEntry, (req: Request, res: Response) => {
  const { origin_location_id, destination_location_id, distance_km, fee_per_trip_etb, rate_per_m3_etb, notes } = req.body;
  if (!origin_location_id || !destination_location_id) {
    return res.status(400).json({ error: 'Origin Crusher Plant and Destination Project are required' });
  }
  const oLoc = queryOne<any>('SELECT name FROM locations WHERE id = ?', [origin_location_id]);
  const dProj = queryOne<any>('SELECT name, address FROM projects WHERE id = ?', [destination_location_id]);
  const dLoc = queryOne<any>('SELECT name FROM locations WHERE id = ?', [destination_location_id]);
  const dName = dProj?.name || dLoc?.name || 'Destination Project';
  const now = new Date().toISOString();
  const id = `RT-${Date.now().toString().slice(-4)}`;
  const tripFee = Number(parseFloat(fee_per_trip_etb || rate_per_m3_etb || '8500').toFixed(2));
  const rateM3 = Number((tripFee / 20).toFixed(2));

  execute(`
    INSERT OR REPLACE INTO route_tariffs (
      id, origin_location_id, destination_location_id,
      origin_location_name, destination_location_name,
      distance_km, fee_per_trip_etb, rate_per_m3_etb, fixed_trip_fee_etb,
      notes, created_at, updated_at
    ) VALUES (
      COALESCE((SELECT id FROM route_tariffs WHERE origin_location_id = ? AND destination_location_id = ?), ?),
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `, [
    origin_location_id, destination_location_id, id,
    origin_location_id, destination_location_id,
    oLoc?.name || 'Crusher Plant', dName,
    distance_km ? Number(distance_km) : null,
    tripFee, rateM3, tripFee, notes?.trim() || null, now, now
  ]);

  return res.status(201).json({ success: true, fee_per_trip_etb: tripFee, rate_per_m3_etb: rateM3 });
});

apiRouter.put('/route-tariffs/:id', requireDataEntry, (req: Request, res: Response) => {
  const { id } = req.params;
  const { origin_location_id, destination_location_id, fee_per_trip_etb, rate_per_m3_etb, distance_km, notes } = req.body;
  const tariff = queryOne<any>('SELECT * FROM route_tariffs WHERE id = ?', [id]);
  if (!tariff) return res.status(404).json({ error: 'Route tariff not found' });
  const now = new Date().toISOString();

  const oId = origin_location_id || tariff.origin_location_id;
  const dId = destination_location_id || tariff.destination_location_id;
  const oLoc = queryOne<any>('SELECT name FROM locations WHERE id = ?', [oId]);
  const dProj = queryOne<any>('SELECT name, address FROM projects WHERE id = ?', [dId]);
  const dLoc = queryOne<any>('SELECT name FROM locations WHERE id = ?', [dId]);
  const dName = dProj?.name || dLoc?.name || tariff.destination_location_name;

  const rawFee = fee_per_trip_etb !== undefined ? fee_per_trip_etb : (rate_per_m3_etb !== undefined ? rate_per_m3_etb : tariff.fee_per_trip_etb || tariff.rate_per_m3_etb * 20);
  const tripFee = Number(parseFloat(String(rawFee)).toFixed(2));
  const rateM3 = Number((tripFee / 20).toFixed(2));

  execute(`
    UPDATE route_tariffs
    SET origin_location_id = ?, destination_location_id = ?,
        origin_location_name = ?, destination_location_name = ?,
        fee_per_trip_etb = ?, fixed_trip_fee_etb = ?, rate_per_m3_etb = ?,
        distance_km = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `, [
    oId, dId,
    oLoc?.name || tariff.origin_location_name,
    dName,
    tripFee, tripFee, rateM3,
    distance_km !== undefined ? (distance_km ? Number(distance_km) : null) : tariff.distance_km,
    notes !== undefined ? notes : tariff.notes,
    now, id
  ]);

  return res.json({ success: true, id, fee_per_trip_etb: tripFee, rate_per_m3_etb: rateM3 });
});

// ==========================================
// UNIFIED TRUCK TRIP REGISTER
// ==========================================

apiRouter.post('/trips/check-duplicate', (req: Request, res: Response) => {
  const { truck_id, trip_date, loading_location_id, unloading_location_id, sand_type, exclude_trip_id } = req.body;
  if (!truck_id || !trip_date || !loading_location_id || !unloading_location_id || !sand_type) {
    return res.json({ duplicate: false });
  }

  let sql = `
    SELECT id, trip_date, truck_plate, loading_location_name, unloading_location_name, sand_type, quantity_loaded_m3, status
    FROM trips
    WHERE truck_id = ?
      AND trip_date = ?
      AND loading_location_id = ?
      AND unloading_location_id = ?
      AND sand_type = ?
      AND status != 'Cancelled'
  `;
  const params: any[] = [truck_id, trip_date, loading_location_id, unloading_location_id, sand_type];
  if (exclude_trip_id) {
    sql += ' AND id != ?';
    params.push(exclude_trip_id);
  }

  const existingTrips = query<any>(sql, params);
  if (existingTrips.length > 0) {
    return res.json({
      duplicate: true,
      existingTrip: existingTrips[0],
      message: `Warning: A trip with this exact Truck, Date (${trip_date}), Loading Point, Destination, and Sand Type (${sand_type}) already exists (Trip ID: ${existingTrips[0].id}).`
    });
  }
  return res.json({ duplicate: false });
});

// List trips with extensive filtering and pagination
apiRouter.get('/trips', (req: Request, res: Response) => {
  const {
    start_date,
    end_date,
    company_id,
    project_id,
    truck_id,
    sand_type,
    loading_location_id,
    unloading_location_id,
    status,
    search,
    limit = 50,
    offset = 0
  } = req.query;

  let whereClauses: string[] = ['1=1'];
  const params: any[] = [];

  if (start_date) {
    whereClauses.push('trip_date >= ?');
    params.push(start_date);
  }
  if (end_date) {
    whereClauses.push('trip_date <= ?');
    params.push(end_date);
  }
  if (company_id) {
    whereClauses.push('company_id = ?');
    params.push(company_id);
  }
  if (project_id) {
    whereClauses.push('project_id = ?');
    params.push(project_id);
  }
  if (truck_id) {
    whereClauses.push('truck_id = ?');
    params.push(truck_id);
  }
  if (sand_type) {
    whereClauses.push('sand_type = ?');
    params.push(sand_type);
  }
  if (loading_location_id) {
    whereClauses.push('loading_location_id = ?');
    params.push(loading_location_id);
  }
  if (unloading_location_id) {
    whereClauses.push('unloading_location_id = ?');
    params.push(unloading_location_id);
  }
  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
  }
  if (search) {
    const term = `%${(search as string).trim().toLowerCase()}%`;
    whereClauses.push(`(
      LOWER(id) LIKE ? OR
      LOWER(truck_plate) LIKE ? OR
      LOWER(truck_owner) LIKE ? OR
      LOWER(company_name) LIKE ? OR
      LOWER(COALESCE(project_name, '')) LIKE ? OR
      LOWER(loading_location_name) LIKE ? OR
      LOWER(unloading_location_name) LIKE ? OR
      LOWER(COALESCE(delivery_proof_ref, '')) LIKE ?
    )`);
    params.push(term, term, term, term, term, term, term, term);
  }

  const whereSql = whereClauses.join(' AND ');
  const countRes = queryOne<{ total: number }>(`SELECT COUNT(*) as total FROM trips WHERE ${whereSql}`, params);
  const total = countRes?.total || 0;

  const trips = query<any>(
    `SELECT tr.*,
       (SELECT owner_phone FROM trucks WHERE id = tr.truck_id) as truck_owner_phone,
       (SELECT capacity_m3 FROM trucks WHERE id = tr.truck_id) as truck_capacity_m3
     FROM trips tr WHERE ${whereSql} ORDER BY tr.trip_date DESC, tr.created_at DESC, tr.id DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return res.json({
    total,
    limit: Number(limit),
    offset: Number(offset),
    trips
  });
});

apiRouter.get('/trips/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const trip = queryOne('SELECT * FROM trips WHERE id = ?', [id]);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const history = query<any>(
    'SELECT * FROM trip_status_history WHERE trip_id = ? ORDER BY created_at ASC',
    [id]
  );
  const truck = queryOne('SELECT * FROM trucks WHERE id = ?', [trip.truck_id]);
  return res.json({ trip, history, truck });
});

function generateNextTripId(dateStr: string): string {
  const year = dateStr.slice(0, 4) || new Date().getFullYear().toString();
  const prefix = `TRP-${year}-`;
  const res = queryOne<{ max_seq: number | null }>(
    `SELECT MAX(CAST(SUBSTR(id, 10) AS INTEGER)) as max_seq FROM trips WHERE id LIKE ?`,
    [`${prefix}%`]
  );
  const nextSeq = (res?.max_seq || 0) + 1;
  return `${prefix}${nextSeq.toString().padStart(4, '0')}`;
}

apiRouter.post('/trips', requireDataEntry, (req: Request, res: Response) => {
  const {
    trip_date,
    truck_id,
    company_id,
    project_id,
    loading_location_id,
    loading_datetime,
    sand_type,
    quantity_loaded_m3,
    loading_notes,
    unloading_location_id,
    unloading_datetime,
    quantity_delivered_m3,
    delivery_outcome,
    delivery_proof_ref,
    unloading_notes,
    status,
    status_reason,
    capacity_warning_acknowledged,
    allow_duplicate
  } = req.body;

  if (!trip_date || !truck_id || !company_id || !loading_location_id || !unloading_location_id || !sand_type || quantity_loaded_m3 === undefined) {
    return res.status(400).json({ error: 'Trip date, truck, company, loading point, destination, sand type, and loaded quantity are required.' });
  }

  if (!['00', '01', '02'].includes(sand_type)) {
    return res.status(400).json({ error: 'Sand type must be exactly "00", "01", or "02".' });
  }

  const loadedQty = Number(parseFloat(quantity_loaded_m3).toFixed(2));
  if (isNaN(loadedQty) || loadedQty < 0) {
    return res.status(400).json({ error: 'Quantity loaded must be zero or a positive decimal number.' });
  }

  let deliveredQty = 0;
  if (quantity_delivered_m3 !== undefined && quantity_delivered_m3 !== null && quantity_delivered_m3 !== '') {
    deliveredQty = Number(parseFloat(quantity_delivered_m3).toFixed(2));
    if (isNaN(deliveredQty) || deliveredQty < 0) {
      return res.status(400).json({ error: 'Quantity delivered must be zero or a positive decimal number.' });
    }
  }

  if (deliveredQty > loadedQty) {
    return res.status(400).json({
      error: `Delivered quantity (${deliveredQty} m³) cannot exceed loaded quantity (${loadedQty} m³).`
    });
  }

  const remainingQty = Number((loadedQty - deliveredQty).toFixed(2));

  let finalStatus = status;
  if (!finalStatus) {
    if (deliveredQty === loadedQty && loadedQty > 0) {
      finalStatus = 'Delivered';
    } else if (deliveredQty > 0 && deliveredQty < loadedQty) {
      finalStatus = 'Partially Delivered';
    } else if (loading_datetime && !unloading_datetime) {
      finalStatus = 'Loaded / In Transit';
    } else {
      finalStatus = 'Registered';
    }
  }

  if (['Unsuccessful', 'Partially Delivered', 'Cancelled'].includes(finalStatus) && !status_reason) {
    return res.status(400).json({
      error: `An explanation is required when a trip is marked ${finalStatus}.`
    });
  }

  const truck = queryOne<any>('SELECT * FROM trucks WHERE id = ?', [truck_id]);
  if (!truck) return res.status(404).json({ error: 'Truck not found in registry' });

  if (truck.capacity_m3 && loadedQty > truck.capacity_m3 && !capacity_warning_acknowledged) {
    return res.status(400).json({
      capacityWarning: true,
      error: `Loaded quantity (${loadedQty} m³) exceeds truck registered capacity (${truck.capacity_m3} m³). Please confirm or adjust.`
    });
  }

  const company = queryOne<any>('SELECT * FROM construction_companies WHERE id = ?', [company_id]);
  if (!company) return res.status(404).json({ error: 'Construction company not found' });

  let targetProjectId = project_id;
  let projectName = null;
  if (targetProjectId) {
    const project = queryOne<any>('SELECT * FROM projects WHERE id = ?', [targetProjectId]);
    if (project) projectName = project.name;
  }

  const loadingLoc = queryOne<any>('SELECT * FROM locations WHERE id = ?', [loading_location_id]);
  if (!loadingLoc) return res.status(404).json({ error: 'Loading location not found' });

  let unloadingLoc = queryOne<any>('SELECT * FROM locations WHERE id = ?', [unloading_location_id]);
  if (!unloadingLoc) {
    const proj = queryOne<any>('SELECT * FROM projects WHERE id = ?', [unloading_location_id]);
    if (proj) {
      unloadingLoc = {
        id: proj.id,
        name: proj.name,
        address: proj.address,
        associated_company_id: proj.company_id,
        associated_project_id: proj.id
      };
      if (!targetProjectId) targetProjectId = proj.id;
      if (!projectName) projectName = proj.name;
    }
  }
  if (!unloadingLoc) return res.status(404).json({ error: 'Destination project unloading site not found' });

  if (!allow_duplicate) {
    const dup = queryOne(
      `SELECT id FROM trips WHERE truck_id = ? AND trip_date = ? AND loading_location_id = ? AND unloading_location_id = ? AND sand_type = ? AND status != 'Cancelled'`,
      [truck_id, trip_date, loading_location_id, unloading_location_id, sand_type]
    );
    if (dup) {
      return res.status(409).json({
        duplicateWarning: true,
        existingTripId: dup.id,
        error: `A trip with this Truck, Date, Loading Point, Destination, and Sand Type already exists (Trip #${dup.id}). Confirm if intentional.`
      });
    }
  }

  const tripId = generateNextTripId(trip_date);
  const now = new Date().toISOString();
  const userName = req.user ? req.user.full_name : 'Data Entry Operator';
  const userId = req.user ? req.user.id : 'usr_operator';

  const customUnitCost = req.body.unit_cost_etb;
  const customUnitPrice = req.body.unit_price_etb;

  const unitCostEtb = (customUnitCost !== undefined && customUnitCost !== '' && Number(customUnitCost) >= 0)
    ? Number(parseFloat(customUnitCost).toFixed(2))
    : sand_type === '00'
    ? (loadingLoc.price_sand_00 || 920)
    : sand_type === '01'
    ? (loadingLoc.price_sand_01 || 1050)
    : (loadingLoc.price_sand_02 || 1180);

  const projectObj = targetProjectId ? queryOne<any>('SELECT * FROM projects WHERE id = ?', [targetProjectId]) : null;
  const projectPrice = projectObj
    ? sand_type === '00'
      ? projectObj.price_sand_00
      : sand_type === '01'
      ? projectObj.price_sand_01
      : projectObj.price_sand_02
    : null;

  const unitPriceEtb = (customUnitPrice !== undefined && customUnitPrice !== '' && Number(customUnitPrice) >= 0)
    ? Number(parseFloat(customUnitPrice).toFixed(2))
    : (projectPrice && projectPrice > 0)
    ? projectPrice
    : sand_type === '00'
    ? (unloadingLoc.selling_price_sand_00 || 1650)
    : sand_type === '01'
    ? (unloadingLoc.selling_price_sand_01 || 1880)
    : (unloadingLoc.selling_price_sand_02 || 2100);

  const totalCostEtb = Number((loadedQty * unitCostEtb).toFixed(2));
  const totalRevenueEtb = Number((deliveredQty * unitPriceEtb).toFixed(2));
  const grossProfitEtb = Number((totalRevenueEtb - totalCostEtb).toFixed(2));
  const shortageLossEtb = Number((remainingQty * unitCostEtb).toFixed(2));

  // Route Tariff and Transport Fee calculation (Fixed Fee per Trip)
  const routeTariff = queryOne<any>(
    'SELECT * FROM route_tariffs WHERE origin_location_id = ? AND destination_location_id = ?',
    [loadingLoc.id, unloadingLoc.id]
  );
  const defaultTripFee = routeTariff ? Number(routeTariff.fee_per_trip_etb || routeTariff.rate_per_m3_etb * 20 || 8500) : 8500;
  const totalTransportFeeEtb = (req.body.total_transport_fee_etb !== undefined && req.body.total_transport_fee_etb !== '' && Number(req.body.total_transport_fee_etb) >= 0)
    ? Number(parseFloat(req.body.total_transport_fee_etb).toFixed(2))
    : finalStatus === 'Cancelled'
    ? 0
    : defaultTripFee;
  const transportRateEtbPerM3 = totalTransportFeeEtb; // Stored as fixed fee per trip
  const routeTariffId = routeTariff?.id || null;

  try {
    const created = transaction(() => {
      execute(
        `INSERT INTO trips (
          id, trip_date, truck_id, truck_plate, truck_owner, company_id, company_name,
          project_id, project_name, loading_location_id, loading_location_name,
          loading_datetime, sand_type, quantity_loaded_m3, loading_notes,
          unloading_location_id, unloading_location_name, unloading_datetime,
          quantity_delivered_m3, quantity_remaining_m3, delivery_outcome,
          delivery_proof_ref, unloading_notes, status, status_reason,
          capacity_warning_acknowledged,
          unit_cost_etb, total_cost_etb, unit_price_etb, total_revenue_etb, gross_profit_etb, shortage_loss_etb,
          transport_rate_etb_per_m3, total_transport_fee_etb, route_tariff_id,
          created_by_user_id, created_by_user_name,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tripId,
          trip_date,
          truck.id,
          truck.plate_number,
          truck.owner_name,
          company.id,
          company.name,
          targetProjectId || null,
          projectName,
          loadingLoc.id,
          loadingLoc.name,
          loading_datetime || null,
          sand_type,
          loadedQty,
          loading_notes?.trim() || null,
          unloadingLoc.id,
          unloadingLoc.name,
          unloading_datetime || null,
          deliveredQty,
          remainingQty,
          delivery_outcome || (finalStatus === 'Delivered' ? 'Delivered' : null),
          delivery_proof_ref?.trim() || null,
          unloading_notes?.trim() || null,
          finalStatus,
          status_reason?.trim() || null,
          capacity_warning_acknowledged ? 1 : 0,
          unitCostEtb,
          totalCostEtb,
          unitPriceEtb,
          totalRevenueEtb,
          grossProfitEtb,
          shortageLossEtb,
          transportRateEtbPerM3,
          totalTransportFeeEtb,
          routeTariffId,
          userId,
          userName,
          now,
          now
        ]
      );

      const histId = `hist_${tripId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      execute(
        `INSERT INTO trip_status_history (id, trip_id, previous_status, new_status, changed_by_user_id, changed_by_user_name, reason, created_at)
         VALUES (?, ?, null, ?, ?, ?, ?, ?)`,
        [histId, tripId, finalStatus, userId, userName, status_reason || 'Initial trip registration', now]
      );

      const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      execute(
        `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, 'CREATE_TRIP', 'trip', ?, ?, ?)`,
        [auditId, userId, userName, tripId, `Registered trip ${tripId} with ${loadedQty} m³ of sand ${sand_type}`, now]
      );

      return queryOne('SELECT * FROM trips WHERE id = ?', [tripId]);
    });

    return res.status(201).json(created);
  } catch (err: any) {
    console.error('Failed to create trip:', err);
    return res.status(500).json({ error: err.message || 'Failed to create trip' });
  }
});

apiRouter.put('/trips/:id', requireDataEntry, (req: Request, res: Response) => {
  const { id } = req.params;
  const currentTrip = queryOne<any>('SELECT * FROM trips WHERE id = ?', [id]);
  if (!currentTrip) return res.status(404).json({ error: 'Trip not found' });

  const {
    trip_date,
    truck_id,
    company_id,
    project_id,
    loading_location_id,
    loading_datetime,
    sand_type,
    quantity_loaded_m3,
    loading_notes,
    unloading_location_id,
    unloading_datetime,
    quantity_delivered_m3,
    delivery_outcome,
    delivery_proof_ref,
    unloading_notes,
    status,
    status_reason,
    capacity_warning_acknowledged,
    allow_capacity_override
  } = req.body;

  const sandTypeToUse = sand_type || currentTrip.sand_type;
  if (!['00', '01', '02'].includes(sandTypeToUse)) {
    return res.status(400).json({ error: 'Sand type must be "00", "01", or "02".' });
  }

  const loadedQty = quantity_loaded_m3 !== undefined
    ? Number(parseFloat(quantity_loaded_m3).toFixed(2))
    : currentTrip.quantity_loaded_m3;
  if (isNaN(loadedQty) || loadedQty < 0) {
    return res.status(400).json({ error: 'Quantity loaded must be non-negative.' });
  }

  const deliveredQty = quantity_delivered_m3 !== undefined
    ? Number(parseFloat(quantity_delivered_m3).toFixed(2))
    : currentTrip.quantity_delivered_m3;
  if (isNaN(deliveredQty) || deliveredQty < 0) {
    return res.status(400).json({ error: 'Quantity delivered must be non-negative.' });
  }

  if (deliveredQty > loadedQty) {
    return res.status(400).json({
      error: `Delivered quantity (${deliveredQty} m³) cannot exceed loaded quantity (${loadedQty} m³).`
    });
  }

  const remainingQty = Number((loadedQty - deliveredQty).toFixed(2));
  const newStatus = status || currentTrip.status;

  if (['Unsuccessful', 'Partially Delivered', 'Cancelled'].includes(newStatus) && !status_reason && currentTrip.status !== newStatus) {
    return res.status(400).json({
      error: `An explanation is required when marking a trip as ${newStatus}.`
    });
  }

  const truckToUseId = truck_id || currentTrip.truck_id;
  const truck = queryOne<any>('SELECT * FROM trucks WHERE id = ?', [truckToUseId]);
  if (!truck) return res.status(404).json({ error: 'Truck not found' });

  if (truck.capacity_m3 && loadedQty > truck.capacity_m3 && !capacity_warning_acknowledged && !allow_capacity_override) {
    return res.status(400).json({
      capacityWarning: true,
      error: `Loaded quantity (${loadedQty} m³) exceeds truck registered capacity (${truck.capacity_m3} m³).`
    });
  }

  const companyToUseId = company_id || currentTrip.company_id;
  const company = queryOne<any>('SELECT * FROM construction_companies WHERE id = ?', [companyToUseId]);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  let projectName = currentTrip.project_name;
  const projIdToUse = project_id !== undefined ? project_id : currentTrip.project_id;
  if (projIdToUse) {
    const proj = queryOne<any>('SELECT * FROM projects WHERE id = ?', [projIdToUse]);
    projectName = proj ? proj.name : null;
  } else {
    projectName = null;
  }

  const loadingLocId = loading_location_id || currentTrip.loading_location_id;
  const loadingLoc = queryOne<any>('SELECT * FROM locations WHERE id = ?', [loadingLocId]);
  const unloadingLocId = unloading_location_id || currentTrip.unloading_location_id;
  const unloadingLoc = queryOne<any>('SELECT * FROM locations WHERE id = ?', [unloadingLocId]);

  const customUnitCost = req.body.unit_cost_etb;
  const customUnitPrice = req.body.unit_price_etb;

  const unitCostEtb = (customUnitCost !== undefined && customUnitCost !== '' && Number(customUnitCost) >= 0)
    ? Number(parseFloat(customUnitCost).toFixed(2))
    : currentTrip.unit_cost_etb > 0 && sandTypeToUse === currentTrip.sand_type && loadingLocId === currentTrip.loading_location_id
    ? currentTrip.unit_cost_etb
    : sandTypeToUse === '00'
    ? (loadingLoc?.price_sand_00 || 920)
    : sandTypeToUse === '01'
    ? (loadingLoc?.price_sand_01 || 1050)
    : (loadingLoc?.price_sand_02 || 1180);

  const projectObj = projIdToUse ? queryOne<any>('SELECT * FROM projects WHERE id = ?', [projIdToUse]) : null;
  const projectPrice = projectObj
    ? sandTypeToUse === '00'
      ? projectObj.price_sand_00
      : sandTypeToUse === '01'
      ? projectObj.price_sand_01
      : projectObj.price_sand_02
    : null;

  const unitPriceEtb = (customUnitPrice !== undefined && customUnitPrice !== '' && Number(customUnitPrice) >= 0)
    ? Number(parseFloat(customUnitPrice).toFixed(2))
    : (projectPrice && projectPrice > 0)
    ? projectPrice
    : currentTrip.unit_price_etb > 0 && sandTypeToUse === currentTrip.sand_type && unloadingLocId === currentTrip.unloading_location_id
    ? currentTrip.unit_price_etb
    : sandTypeToUse === '00'
    ? (unloadingLoc?.selling_price_sand_00 || 1650)
    : sandTypeToUse === '01'
    ? (unloadingLoc?.selling_price_sand_01 || 1880)
    : (unloadingLoc?.selling_price_sand_02 || 2100);

  const totalCostEtb = Number((loadedQty * unitCostEtb).toFixed(2));
  const totalRevenueEtb = Number((deliveredQty * unitPriceEtb).toFixed(2));
  const grossProfitEtb = Number((totalRevenueEtb - totalCostEtb).toFixed(2));
  const shortageLossEtb = Number((remainingQty * unitCostEtb).toFixed(2));

  const now = new Date().toISOString();
  const userId = (req as any).user ? (req as any).user.id : 'usr_operator';
  const userName = (req as any).user ? (req as any).user.full_name : 'System Operator';

  const effectiveLoadingLocId = loadingLoc ? loadingLoc.id : currentTrip.loading_location_id;
  const effectiveUnloadingLocId = unloadingLoc ? unloadingLoc.id : currentTrip.unloading_location_id;
  const routeTariff = queryOne<any>(
    'SELECT * FROM route_tariffs WHERE origin_location_id = ? AND destination_location_id = ?',
    [effectiveLoadingLocId, effectiveUnloadingLocId]
  );
  const defaultTripFee = routeTariff ? Number(routeTariff.fee_per_trip_etb || routeTariff.rate_per_m3_etb * 20 || 8500) : 8500;
  const totalTransportFeeEtb = (req.body.total_transport_fee_etb !== undefined && req.body.total_transport_fee_etb !== '' && Number(req.body.total_transport_fee_etb) >= 0)
    ? Number(parseFloat(req.body.total_transport_fee_etb).toFixed(2))
    : (newStatus === 'Cancelled')
    ? 0
    : (currentTrip.total_transport_fee_etb > 0 && effectiveLoadingLocId === currentTrip.loading_location_id && effectiveUnloadingLocId === currentTrip.unloading_location_id)
    ? currentTrip.total_transport_fee_etb
    : defaultTripFee;
  const transportRateEtbPerM3 = totalTransportFeeEtb; // Fixed fee per trip
  const routeTariffId = routeTariff?.id || currentTrip.route_tariff_id || null;

  try {
    const updated = transaction(() => {
      execute(
        `UPDATE trips SET
          trip_date = ?,
          truck_id = ?,
          truck_plate = ?,
          truck_owner = ?,
          company_id = ?,
          company_name = ?,
          project_id = ?,
          project_name = ?,
          loading_location_id = ?,
          loading_location_name = ?,
          loading_datetime = ?,
          sand_type = ?,
          quantity_loaded_m3 = ?,
          loading_notes = ?,
          unloading_location_id = ?,
          unloading_location_name = ?,
          unloading_datetime = ?,
          quantity_delivered_m3 = ?,
          quantity_remaining_m3 = ?,
          delivery_outcome = ?,
          delivery_proof_ref = ?,
          unloading_notes = ?,
          status = ?,
          status_reason = ?,
          capacity_warning_acknowledged = ?,
          unit_cost_etb = ?,
          total_cost_etb = ?,
          unit_price_etb = ?,
          total_revenue_etb = ?,
          gross_profit_etb = ?,
          shortage_loss_etb = ?,
          transport_rate_etb_per_m3 = ?,
          total_transport_fee_etb = ?,
          route_tariff_id = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          trip_date || currentTrip.trip_date,
          truck.id,
          truck.plate_number,
          truck.owner_name,
          company.id,
          company.name,
          projIdToUse || null,
          projectName,
          loadingLoc ? loadingLoc.id : currentTrip.loading_location_id,
          loadingLoc ? loadingLoc.name : currentTrip.loading_location_name,
          loading_datetime !== undefined ? loading_datetime : currentTrip.loading_datetime,
          sandTypeToUse,
          loadedQty,
          loading_notes !== undefined ? loading_notes : currentTrip.loading_notes,
          unloadingLoc ? unloadingLoc.id : currentTrip.unloading_location_id,
          unloadingLoc ? unloadingLoc.name : currentTrip.unloading_location_name,
          unloading_datetime !== undefined ? unloading_datetime : currentTrip.unloading_datetime,
          deliveredQty,
          remainingQty,
          delivery_outcome !== undefined ? delivery_outcome : currentTrip.delivery_outcome,
          delivery_proof_ref !== undefined ? delivery_proof_ref : currentTrip.delivery_proof_ref,
          unloading_notes !== undefined ? unloading_notes : currentTrip.unloading_notes,
          newStatus,
          status_reason !== undefined ? status_reason : currentTrip.status_reason,
          capacity_warning_acknowledged ? 1 : currentTrip.capacity_warning_acknowledged,
          unitCostEtb,
          totalCostEtb,
          unitPriceEtb,
          totalRevenueEtb,
          grossProfitEtb,
          shortageLossEtb,
          transportRateEtbPerM3,
          totalTransportFeeEtb,
          routeTariffId,
          now,
          id
        ]
      );

      if (currentTrip.status !== newStatus) {
        execute(
          `INSERT INTO trip_status_history (id, trip_id, previous_status, new_status, changed_by_user_id, changed_by_user_name, reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [`hist_${id}_${Date.now()}`, id, currentTrip.status, newStatus, userId, userName, status_reason || `Status updated from ${currentTrip.status} to ${newStatus}`, now]
        );
      }

      execute(
        `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, 'UPDATE_TRIP', 'trip', ?, ?, ?)`,
        [`audit_${Date.now()}`, userId, userName, id, `Updated trip ${id} (Status: ${newStatus}, Delivered: ${deliveredQty} m³)`, now]
      );

      return queryOne('SELECT * FROM trips WHERE id = ?', [id]);
    });

    return res.json(updated);
  } catch (err: any) {
    console.error('Failed to update trip:', err);
    return res.status(500).json({ error: err.message || 'Failed to update trip' });
  }
});

// ==========================================
// DASHBOARD ANALYTICS
// ==========================================

apiRouter.get('/analytics/dashboard', (req: Request, res: Response) => {
  const {
    start_date,
    end_date,
    company_id,
    project_id,
    truck_id,
    sand_type,
    loading_location_id,
    unloading_location_id,
    status
  } = req.query;

  let whereClauses: string[] = ['1=1'];
  const params: any[] = [];

  if (start_date) {
    whereClauses.push('trip_date >= ?');
    params.push(start_date);
  }
  if (end_date) {
    whereClauses.push('trip_date <= ?');
    params.push(end_date);
  }
  if (company_id) {
    whereClauses.push('company_id = ?');
    params.push(company_id);
  }
  if (project_id) {
    whereClauses.push('project_id = ?');
    params.push(project_id);
  }
  if (truck_id) {
    whereClauses.push('truck_id = ?');
    params.push(truck_id);
  }
  if (sand_type) {
    whereClauses.push('sand_type = ?');
    params.push(sand_type);
  }
  if (loading_location_id) {
    whereClauses.push('loading_location_id = ?');
    params.push(loading_location_id);
  }
  if (unloading_location_id) {
    whereClauses.push('unloading_location_id = ?');
    params.push(unloading_location_id);
  }
  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.join(' AND ');

  const kpiRes = queryOne<any>(`
    SELECT
      COUNT(*) as total_trips,
      SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as fully_successful_trips,
      SUM(CASE WHEN status = 'Partially Delivered' THEN 1 ELSE 0 END) as partially_delivered_trips,
      SUM(CASE WHEN status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_trips,
      SUM(CASE WHEN status IN ('Registered', 'Loading', 'Loaded / In Transit') THEN 1 ELSE 0 END) as active_pending_trips,
      SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_trips,
      ROUND(COALESCE(SUM(quantity_loaded_m3), 0), 2) as total_loaded_m3,
      ROUND(COALESCE(SUM(quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(quantity_remaining_m3), 0), 2) as total_outstanding_m3,
      COUNT(DISTINCT truck_id) as distinct_trucks_count,
      ROUND(COALESCE(SUM(total_revenue_etb), 0), 2) as total_revenue_etb,
      ROUND(COALESCE(SUM(total_cost_etb), 0), 2) as total_cost_etb,
      ROUND(COALESCE(SUM(gross_profit_etb), 0), 2) as gross_profit_etb,
      ROUND(COALESCE(SUM(shortage_loss_etb), 0), 2) as shortage_loss_etb,
      ROUND(COALESCE(SUM(total_transport_fee_etb), 0), 2) as total_transport_fees_etb
    FROM trips
    WHERE ${whereSql}
  `, params);

  const sandRes = query<any>(`
    SELECT
      sand_type,
      COUNT(*) as trip_count,
      ROUND(COALESCE(SUM(quantity_loaded_m3), 0), 2) as loaded_m3,
      ROUND(COALESCE(SUM(quantity_delivered_m3), 0), 2) as delivered_m3,
      ROUND(COALESCE(SUM(quantity_remaining_m3), 0), 2) as outstanding_m3,
      ROUND(COALESCE(SUM(total_cost_etb), 0), 2) as total_cost_etb,
      ROUND(COALESCE(SUM(total_revenue_etb), 0), 2) as total_revenue_etb,
      ROUND(COALESCE(SUM(gross_profit_etb), 0), 2) as gross_profit_etb,
      ROUND(COALESCE(SUM(total_transport_fee_etb), 0), 2) as total_transport_fees_etb,
      CASE WHEN SUM(quantity_loaded_m3) > 0 THEN ROUND(SUM(total_cost_etb) / SUM(quantity_loaded_m3), 2) ELSE 0 END as unit_cost_etb,
      CASE WHEN SUM(quantity_delivered_m3) > 0 THEN ROUND(SUM(total_revenue_etb) / SUM(quantity_delivered_m3), 2) ELSE 0 END as unit_price_etb,
      CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(gross_profit_etb) / COUNT(*), 2) ELSE 0 END as avg_profit_per_truck_etb
    FROM trips
    WHERE ${whereSql}
    GROUP BY sand_type
    ORDER BY sand_type ASC
  `, params);

  const sandMap: Record<string, any> = {
    '00': { sand_type: '00', trip_count: 0, loaded_m3: 0, delivered_m3: 0, outstanding_m3: 0, unit_cost_etb: 0, unit_price_etb: 0, total_cost_etb: 0, total_revenue_etb: 0, gross_profit_etb: 0, avg_profit_per_truck_etb: 0 },
    '01': { sand_type: '01', trip_count: 0, loaded_m3: 0, delivered_m3: 0, outstanding_m3: 0, unit_cost_etb: 0, unit_price_etb: 0, total_cost_etb: 0, total_revenue_etb: 0, gross_profit_etb: 0, avg_profit_per_truck_etb: 0 },
    '02': { sand_type: '02', trip_count: 0, loaded_m3: 0, delivered_m3: 0, outstanding_m3: 0, unit_cost_etb: 0, unit_price_etb: 0, total_cost_etb: 0, total_revenue_etb: 0, gross_profit_etb: 0, avg_profit_per_truck_etb: 0 }
  };
  sandRes.forEach(r => {
    sandMap[r.sand_type] = r;
  });

  const timeline = query<any>(`
    SELECT
      trip_date,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial,
      SUM(CASE WHEN status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful,
      SUM(CASE WHEN status IN ('Registered', 'Loading', 'Loaded / In Transit') THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
      ROUND(COALESCE(SUM(quantity_delivered_m3), 0), 2) as delivered_m3,
      ROUND(COALESCE(SUM(total_revenue_etb), 0), 2) as total_revenue_etb,
      ROUND(COALESCE(SUM(gross_profit_etb), 0), 2) as gross_profit_etb,
      ROUND(COALESCE(SUM(total_transport_fee_etb), 0), 2) as total_transport_fees_etb
    FROM trips
    WHERE ${whereSql}
    GROUP BY trip_date
    ORDER BY trip_date ASC
  `, params);

  const truckPerformance = query<any>(`
    SELECT
      truck_id,
      truck_plate,
      truck_owner,
      COUNT(*) as total_trips,
      SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as successful_trips,
      SUM(CASE WHEN status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_trips,
      SUM(CASE WHEN status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_trips,
      ROUND(COALESCE(SUM(quantity_delivered_m3), 0), 2) as delivered_m3,
      ROUND(COALESCE(SUM(total_revenue_etb), 0), 2) as total_revenue_etb,
      ROUND(COALESCE(SUM(total_cost_etb), 0), 2) as total_cost_etb,
      ROUND(COALESCE(SUM(gross_profit_etb), 0), 2) as gross_profit_etb,
      ROUND(COALESCE(SUM(total_transport_fee_etb), 0), 2) as total_transport_fees_etb,
      CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(total_revenue_etb) / COUNT(*), 2) ELSE 0 END as avg_revenue_per_trip_etb,
      CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(gross_profit_etb) / COUNT(*), 2) ELSE 0 END as avg_profit_per_trip_etb,
      CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(total_transport_fee_etb) / COUNT(*), 2) ELSE 0 END as avg_transport_fee_per_trip_etb
    FROM trips
    WHERE ${whereSql}
    GROUP BY truck_id
    ORDER BY delivered_m3 DESC
    LIMIT 6
  `, params);

  const companyVolumes = query<any>(`
    SELECT
      company_name,
      COUNT(*) as trip_count,
      ROUND(COALESCE(SUM(quantity_delivered_m3), 0), 2) as delivered_m3,
      ROUND(COALESCE(SUM(total_revenue_etb), 0), 2) as total_revenue_etb,
      ROUND(COALESCE(SUM(total_transport_fee_etb), 0), 2) as total_transport_fees_etb
    FROM trips
    WHERE ${whereSql}
    GROUP BY company_id
    ORDER BY delivered_m3 DESC
    LIMIT 6
  `, params);

  const destinationVolumes = query<any>(`
    SELECT
      unloading_location_name,
      COUNT(*) as trip_count,
      ROUND(COALESCE(SUM(quantity_delivered_m3), 0), 2) as delivered_m3,
      ROUND(COALESCE(SUM(total_revenue_etb), 0), 2) as total_revenue_etb,
      ROUND(COALESCE(SUM(gross_profit_etb), 0), 2) as gross_profit_etb,
      ROUND(COALESCE(SUM(total_transport_fee_etb), 0), 2) as total_transport_fees_etb,
      CASE WHEN SUM(quantity_delivered_m3) > 0 THEN ROUND(SUM(total_revenue_etb) / SUM(quantity_delivered_m3), 2) ELSE 0 END as avg_price_per_m3_etb
    FROM trips
    WHERE ${whereSql}
    GROUP BY unloading_location_id
    ORDER BY delivered_m3 DESC
    LIMIT 6
  `, params);

  const loadingPointActivity = query<any>(`
    SELECT
      loading_location_name,
      COUNT(*) as trip_count,
      ROUND(COALESCE(SUM(quantity_loaded_m3), 0), 2) as loaded_m3,
      ROUND(COALESCE(SUM(total_cost_etb), 0), 2) as total_cost_etb,
      ROUND(COALESCE(SUM(total_transport_fee_etb), 0), 2) as total_transport_fees_etb,
      CASE WHEN SUM(quantity_loaded_m3) > 0 THEN ROUND(SUM(total_cost_etb) / SUM(quantity_loaded_m3), 2) ELSE 0 END as avg_cost_per_m3_etb
    FROM trips
    WHERE ${whereSql}
    GROUP BY loading_location_id
    ORDER BY loaded_m3 DESC
    LIMIT 6
  `, params);

  const topRoutes = query<any>(`
    SELECT
      tr.loading_location_name as origin_name,
      tr.unloading_location_name as destination_name,
      COALESCE(rt.fee_per_trip_etb, rt.fixed_trip_fee_etb, rt.rate_per_m3_etb * 20, 8500) as fee_per_trip_etb,
      COALESCE(rt.rate_per_m3_etb, 450) as rate_per_m3_etb,
      rt.distance_km,
      COUNT(tr.id) as trips_count,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(tr.total_transport_fee_etb), 0), 2) as total_transport_fees_etb,
      CASE WHEN COUNT(tr.id) > 0 THEN ROUND(SUM(tr.total_transport_fee_etb) / COUNT(tr.id), 2) ELSE 0 END as avg_fee_per_truck_etb
    FROM trips tr
    LEFT JOIN route_tariffs rt ON tr.loading_location_id = rt.origin_location_id AND tr.unloading_location_id = rt.destination_location_id
    WHERE ${whereSql}
    GROUP BY tr.loading_location_id, tr.unloading_location_id
    ORDER BY total_transport_fees_etb DESC
    LIMIT 6
  `, params);

  const pendingAlerts = query<any>(`
    SELECT id, trip_date, truck_plate, status, loading_location_name, unloading_location_name
    FROM trips
    WHERE status IN ('Registered', 'Loading', 'Loaded / In Transit')
    ORDER BY trip_date ASC
    LIMIT 5
  `);

  const partialAlerts = query<any>(`
    SELECT id, trip_date, truck_plate, quantity_loaded_m3, quantity_delivered_m3, quantity_remaining_m3, status_reason
    FROM trips
    WHERE status = 'Partially Delivered'
    ORDER BY trip_date DESC
    LIMIT 5
  `);

  const unsuccessfulAlerts = query<any>(`
    SELECT id, trip_date, truck_plate, delivery_outcome, status_reason
    FROM trips
    WHERE status = 'Unsuccessful'
    ORDER BY trip_date DESC
    LIMIT 5
  `);

  const capacityWarnings = query<any>(`
    SELECT tr.id, tr.trip_date, tr.truck_plate, tr.quantity_loaded_m3, t.capacity_m3
    FROM trips tr
    JOIN trucks t ON tr.truck_id = t.id
    WHERE t.capacity_m3 IS NOT NULL AND tr.quantity_loaded_m3 > t.capacity_m3
    ORDER BY tr.trip_date DESC
    LIMIT 5
  `);

  const totTrips = kpiRes?.total_trips || 0;
  const totRev = kpiRes?.total_revenue_etb || 0;
  const totCost = kpiRes?.total_cost_etb || 0;
  const grossProfit = kpiRes?.gross_profit_etb || 0;
  const totDelivered = kpiRes?.total_delivered_m3 || 0;
  const totLoaded = kpiRes?.total_loaded_m3 || 0;
  const totTransportFees = kpiRes?.total_transport_fees_etb || 0;

  // Real-time Today Summary metrics from trip registry
  const todayDateIso = new Date().toISOString().split('T')[0];
  const maxTripDateRes = queryOne<any>('SELECT MAX(trip_date) as max_date FROM trips WHERE status != "Cancelled"');
  const maxDate = maxTripDateRes?.max_date;

  // Check if there are dispatches recorded for current system date, fallback to active operational date
  const todayCountRes = queryOne<any>('SELECT COUNT(*) as cnt FROM trips WHERE trip_date = ? AND status != "Cancelled"', [todayDateIso]);
  const activeDate = (todayCountRes && todayCountRes.cnt > 0) ? todayDateIso : (maxDate || todayDateIso);
  const isActualToday = (activeDate === todayDateIso);

  const todayMetrics = queryOne<any>(`
    SELECT
      COUNT(*) as total_trips_today,
      COUNT(DISTINCT truck_id) as active_trucks,
      ROUND(COALESCE(SUM(quantity_loaded_m3), 0), 2) as total_daily_load_m3,
      ROUND(COALESCE(SUM(quantity_delivered_m3), 0), 2) as total_daily_delivered_m3,
      SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as delivered_today_trips,
      SUM(CASE WHEN status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_today_trips,
      SUM(CASE WHEN status IN ('Loaded / In Transit', 'Loading', 'Registered') THEN 1 ELSE 0 END) as active_in_transit_trips,
      SUM(CASE WHEN status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_today_trips,
      ROUND(COALESCE(SUM(total_transport_fee_etb), 0), 2) as total_daily_transport_fees_etb,
      ROUND(COALESCE(SUM(total_revenue_etb), 0), 2) as total_daily_revenue_etb
    FROM trips
    WHERE trip_date = ? AND status != 'Cancelled'
  `, [activeDate]) || {};

  const fleetStats = queryOne<any>(`
    SELECT
      COUNT(*) as total_fleet_trucks,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_fleet_trucks
    FROM trucks
  `) || { total_fleet_trucks: 0, active_fleet_trucks: 0 };

  const recentTodayTrips = query<any>(`
    SELECT
      id, trip_date, truck_plate, truck_owner, sand_type,
      quantity_loaded_m3, quantity_delivered_m3,
      loading_location_name, unloading_location_name,
      status, loading_datetime
    FROM trips
    WHERE trip_date = ? AND status != 'Cancelled'
    ORDER BY loading_datetime DESC, updated_at DESC
    LIMIT 4
  `, [activeDate]);

  const totalDailyLoadM3 = Number(todayMetrics.total_daily_load_m3 || 0);
  const totalDailyDeliveredM3 = Number(todayMetrics.total_daily_delivered_m3 || 0);
  const activeTrucksCount = Number(todayMetrics.active_trucks || 0);
  const totalTripsToday = Number(todayMetrics.total_trips_today || 0);
  const totalFleet = Number(fleetStats.total_fleet_trucks || 0);

  const fulfillmentPercent = totalDailyLoadM3 > 0 ? Number(((totalDailyDeliveredM3 / totalDailyLoadM3) * 100).toFixed(1)) : 0;
  const fleetUtilizationPercent = totalFleet > 0 ? Number(((activeTrucksCount / totalFleet) * 100).toFixed(1)) : 0;

  const todaySummary = {
    date: activeDate,
    isToday: isActualToday,
    totalTripsToday,
    activeTrucks: activeTrucksCount,
    totalDailyLoadM3,
    totalDailyDeliveredM3,
    activeInTransitTrips: Number(todayMetrics.active_in_transit_trips || 0),
    deliveredTodayTrips: Number(todayMetrics.delivered_today_trips || 0),
    partialTodayTrips: Number(todayMetrics.partial_today_trips || 0),
    unsuccessfulTodayTrips: Number(todayMetrics.unsuccessful_today_trips || 0),
    totalFleetTrucks: totalFleet,
    activeFleetTrucks: Number(fleetStats.active_fleet_trucks || 0),
    fleetUtilizationPercent,
    deliveryFulfillmentPercent: fulfillmentPercent,
    totalDailyTransportFeesEtb: Number(todayMetrics.total_daily_transport_fees_etb || 0),
    totalDailyRevenueEtb: Number(todayMetrics.total_daily_revenue_etb || 0),
    recentTodayTrips
  };

  return res.json({
    kpi: {
      totalTrips: totTrips,
      fullySuccessfulTrips: kpiRes?.fully_successful_trips || 0,
      partiallyDeliveredTrips: kpiRes?.partially_delivered_trips || 0,
      unsuccessfulTrips: kpiRes?.unsuccessful_trips || 0,
      activePendingTrips: kpiRes?.active_pending_trips || 0,
      cancelledTrips: kpiRes?.cancelled_trips || 0,
      totalLoadedM3: totLoaded,
      totalDeliveredM3: totDelivered,
      totalOutstandingM3: kpiRes?.total_outstanding_m3 || 0,
      distinctTrucksCount: kpiRes?.distinct_trucks_count || 0,
      totalRevenueEtb: totRev,
      totalCostEtb: totCost,
      grossProfitEtb: grossProfit,
      shortageLossEtb: kpiRes?.shortage_loss_etb || 0,
      totalTransportFeesEtb: totTransportFees,
      avgTransportFeePerTruckEtb: totTrips > 0 ? Number((totTransportFees / totTrips).toFixed(2)) : 0,
      avgTransportRatePerM3Etb: totDelivered > 0 ? Number((totTransportFees / totDelivered).toFixed(2)) : 0,
      avgRevenuePerTruckEtb: totTrips > 0 ? Number((totRev / totTrips).toFixed(2)) : 0,
      avgCostPerTruckEtb: totTrips > 0 ? Number((totCost / totTrips).toFixed(2)) : 0,
      avgProfitPerTruckEtb: totTrips > 0 ? Number((grossProfit / totTrips).toFixed(2)) : 0,
      avgSellingPricePerM3Etb: totDelivered > 0 ? Number((totRev / totDelivered).toFixed(2)) : 0,
      avgCostPricePerM3Etb: totLoaded > 0 ? Number((totCost / totLoaded).toFixed(2)) : 0,
    },
    sandBreakdown: Object.values(sandMap),
    timeline,
    truckPerformance,
    companyVolumes,
    destinationVolumes,
    loadingPointActivity,
    topRoutes,
    alerts: {
      pending: pendingAlerts,
      partial: partialAlerts,
      unsuccessful: unsuccessfulAlerts,
      capacity: capacityWarnings
    },
    todaySummary
  });
});

// ==========================================
// REPORTS MODULE (EXPANDED REPORTING ENGINE)
// ==========================================

function buildReportFilter(req: Request) {
  const {
    start_date,
    end_date,
    company_id,
    project_id,
    truck_id,
    sand_type,
    loading_location_id,
    unloading_location_id,
    status
  } = req.query;

  const whereClauses: string[] = ['1=1'];
  const params: any[] = [];

  if (start_date) {
    whereClauses.push('tr.trip_date >= ?');
    params.push(start_date);
  }
  if (end_date) {
    whereClauses.push('tr.trip_date <= ?');
    params.push(end_date);
  }
  if (company_id) {
    whereClauses.push('tr.company_id = ?');
    params.push(company_id);
  }
  if (project_id) {
    whereClauses.push('tr.project_id = ?');
    params.push(project_id);
  }
  if (truck_id && truck_id !== 'all' && truck_id !== 'ALL') {
    whereClauses.push('tr.truck_id = ?');
    params.push(truck_id);
  }
  if (sand_type) {
    whereClauses.push('tr.sand_type = ?');
    params.push(sand_type);
  }
  if (loading_location_id) {
    whereClauses.push('tr.loading_location_id = ?');
    params.push(loading_location_id);
  }
  if (unloading_location_id) {
    whereClauses.push('tr.unloading_location_id = ?');
    params.push(unloading_location_id);
  }
  if (status) {
    whereClauses.push('tr.status = ?');
    params.push(status);
  }

  return { whereSql: whereClauses.join(' AND '), params };
}

// ------------------------------------------
// Report on a Specific Truck OR All Trucks in Once (Consolidated Fleet Report)
// ------------------------------------------
apiRouter.get('/reports/single-truck', (req: Request, res: Response) => {
  const { truck_id } = req.query;
  const isAll = !truck_id || truck_id === 'all' || truck_id === 'ALL';

  const { whereSql, params } = buildReportFilter(req);

  // If "All Trucks" is requested:
  if (isAll) {
    const kpiRes = queryOne<any>(`
      SELECT
        COUNT(tr.id) as total_trips,
        COUNT(DISTINCT tr.truck_id) as distinct_trucks_count,
        SUM(CASE WHEN tr.status = 'Delivered' THEN 1 ELSE 0 END) as successful_trips,
        SUM(CASE WHEN tr.status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_trips,
        SUM(CASE WHEN tr.status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_trips,
        SUM(CASE WHEN tr.status IN ('Registered', 'Loading', 'Loaded / In Transit') THEN 1 ELSE 0 END) as pending_trips,
        SUM(CASE WHEN tr.status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_trips,
        ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as total_loaded_m3,
        ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
        ROUND(COALESCE(SUM(tr.quantity_remaining_m3), 0), 2) as total_shortage_m3,
        ROUND(AVG(tr.quantity_loaded_m3), 2) as avg_load_m3,
        ROUND(AVG(tr.quantity_delivered_m3), 2) as avg_delivered_m3,
        ROUND(COALESCE(SUM(tr.total_revenue_etb), 0), 2) as total_revenue_etb,
        ROUND(COALESCE(SUM(tr.total_cost_etb), 0), 2) as total_cost_etb,
        ROUND(COALESCE(SUM(tr.gross_profit_etb), 0), 2) as gross_profit_etb,
        ROUND(COALESCE(SUM(tr.shortage_loss_etb), 0), 2) as shortage_loss_etb
      FROM trips tr
      WHERE ${whereSql}
    `, params);

    const eligibleCompleted = (kpiRes?.successful_trips || 0) + (kpiRes?.partial_trips || 0) + (kpiRes?.unsuccessful_trips || 0);
    const successRate = eligibleCompleted > 0
      ? Number(((kpiRes.successful_trips / eligibleCompleted) * 100).toFixed(1))
      : null;

    const shortageRate = (kpiRes?.total_loaded_m3 || 0) > 0
      ? Number(((kpiRes.total_shortage_m3 / kpiRes.total_loaded_m3) * 100).toFixed(1))
      : 0;

    // Breakdown for every individual truck for side-by-side comparison
    const trucksComparison = query<any>(`
      SELECT
        t.id as truck_id,
        t.plate_number as truck_plate,
        t.owner_name as truck_owner,
        t.capacity_m3,
        t.owner_phone,
        t.is_active,
        COUNT(tr.id) as total_trips,
        SUM(CASE WHEN tr.status = 'Delivered' THEN 1 ELSE 0 END) as successful_trips,
        SUM(CASE WHEN tr.status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_trips,
        SUM(CASE WHEN tr.status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_trips,
        SUM(CASE WHEN tr.status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_trips,
        ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as total_loaded_m3,
        ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
        ROUND(COALESCE(SUM(tr.quantity_remaining_m3), 0), 2) as total_shortage_m3,
        ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '00' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_00,
        ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '01' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_01,
        ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '02' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_02,
        ROUND(COALESCE(SUM(tr.total_revenue_etb), 0), 2) as total_revenue_etb,
        ROUND(COALESCE(SUM(tr.total_cost_etb), 0), 2) as total_cost_etb,
        ROUND(COALESCE(SUM(tr.gross_profit_etb), 0), 2) as gross_profit_etb,
        SUM(CASE WHEN t.capacity_m3 IS NOT NULL AND tr.quantity_loaded_m3 > t.capacity_m3 THEN 1 ELSE 0 END) as overload_count
      FROM trucks t
      LEFT JOIN trips tr ON t.id = tr.truck_id AND (${whereSql})
      GROUP BY t.id
      ORDER BY total_delivered_m3 DESC, total_trips DESC
    `, params);

    const enrichedTrucks = trucksComparison.map(t => {
      const eligible = (t.successful_trips || 0) + (t.partial_trips || 0) + (t.unsuccessful_trips || 0);
      const sRate = eligible > 0 ? Number(((t.successful_trips / eligible) * 100).toFixed(1)) : null;
      const tTrips = t.total_trips || 0;
      const tDeliv = t.total_delivered_m3 || 0;
      const tLoad = t.total_loaded_m3 || 0;
      return {
        ...t,
        eligible_trips: eligible,
        success_rate: sRate,
        success_rate_label: sRate !== null ? `${sRate}%` : 'N/A',
        avg_revenue_per_trip_etb: tTrips > 0 ? Number(((t.total_revenue_etb || 0) / tTrips).toFixed(2)) : 0,
        avg_profit_per_trip_etb: tTrips > 0 ? Number(((t.gross_profit_etb || 0) / tTrips).toFixed(2)) : 0,
        avg_selling_price_etb: tDeliv > 0 ? Number(((t.total_revenue_etb || 0) / tDeliv).toFixed(2)) : 0,
        avg_cost_price_etb: tLoad > 0 ? Number(((t.total_cost_etb || 0) / tLoad).toFixed(2)) : 0,
      };
    });

    const sandBreakdownRaw = query<any>(`
      SELECT
        tr.sand_type,
        COUNT(tr.id) as trip_count,
        ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as loaded_m3,
        ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as delivered_m3,
        ROUND(COALESCE(SUM(tr.quantity_remaining_m3), 0), 2) as shortage_m3,
        ROUND(COALESCE(SUM(tr.total_cost_etb), 0), 2) as total_cost_etb,
        ROUND(COALESCE(SUM(tr.total_revenue_etb), 0), 2) as total_revenue_etb,
        ROUND(COALESCE(SUM(tr.gross_profit_etb), 0), 2) as gross_profit_etb,
        CASE WHEN SUM(tr.quantity_loaded_m3) > 0 THEN ROUND(SUM(tr.total_cost_etb) / SUM(tr.quantity_loaded_m3), 2) ELSE 0 END as unit_cost_etb,
        CASE WHEN SUM(tr.quantity_delivered_m3) > 0 THEN ROUND(SUM(tr.total_revenue_etb) / SUM(tr.quantity_delivered_m3), 2) ELSE 0 END as unit_price_etb
      FROM trips tr
      WHERE ${whereSql}
      GROUP BY tr.sand_type
      ORDER BY tr.sand_type ASC
    `, params);

    const sandMap: Record<string, any> = {
      '00': { sand_type: '00', trip_count: 0, loaded_m3: 0, delivered_m3: 0, shortage_m3: 0, total_cost_etb: 0, total_revenue_etb: 0, gross_profit_etb: 0, unit_cost_etb: 0, unit_price_etb: 0 },
      '01': { sand_type: '01', trip_count: 0, loaded_m3: 0, delivered_m3: 0, shortage_m3: 0, total_cost_etb: 0, total_revenue_etb: 0, gross_profit_etb: 0, unit_cost_etb: 0, unit_price_etb: 0 },
      '02': { sand_type: '02', trip_count: 0, loaded_m3: 0, delivered_m3: 0, shortage_m3: 0, total_cost_etb: 0, total_revenue_etb: 0, gross_profit_etb: 0, unit_cost_etb: 0, unit_price_etb: 0 }
    };
    sandBreakdownRaw.forEach(s => {
      sandMap[s.sand_type] = s;
    });

    const topCrusherSites = query<any>(`
      SELECT
        tr.loading_location_name,
        COUNT(tr.id) as trips_count,
        ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as loaded_m3,
        ROUND(COALESCE(SUM(tr.total_cost_etb), 0), 2) as total_cost_etb,
        CASE WHEN SUM(tr.quantity_loaded_m3) > 0 THEN ROUND(SUM(tr.total_cost_etb) / SUM(tr.quantity_loaded_m3), 2) ELSE 0 END as avg_cost_per_m3_etb
      FROM trips tr
      WHERE ${whereSql}
      GROUP BY tr.loading_location_id
      ORDER BY trips_count DESC, loaded_m3 DESC
      LIMIT 6
    `, params);

    const topDestinations = query<any>(`
      SELECT
        tr.unloading_location_name,
        tr.company_name,
        COUNT(tr.id) as trips_count,
        ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as delivered_m3,
        ROUND(COALESCE(SUM(tr.total_revenue_etb), 0), 2) as total_revenue_etb,
        CASE WHEN SUM(tr.quantity_delivered_m3) > 0 THEN ROUND(SUM(tr.total_revenue_etb) / SUM(tr.quantity_delivered_m3), 2) ELSE 0 END as avg_price_per_m3_etb
      FROM trips tr
      WHERE ${whereSql}
      GROUP BY tr.unloading_location_id, tr.company_id
      ORDER BY delivered_m3 DESC, trips_count DESC
      LIMIT 6
    `, params);

    const trips = query<any>(`
      SELECT tr.*,
        CASE WHEN t.capacity_m3 IS NOT NULL AND tr.quantity_loaded_m3 > t.capacity_m3 THEN 1 ELSE 0 END as is_over_capacity
      FROM trips tr
      LEFT JOIN trucks t ON tr.truck_id = t.id
      WHERE ${whereSql}
      ORDER BY tr.trip_date DESC, tr.created_at DESC
    `, params);

    const totalCapRes = queryOne<any>('SELECT ROUND(SUM(capacity_m3), 2) as total_cap, COUNT(*) as total_count FROM trucks');
    const fleetCapacity = totalCapRes?.total_cap || 0;
    const totalFleetTrucks = totalCapRes?.total_count || 0;

    const totTrips = kpiRes?.total_trips || 0;
    const totDeliv = kpiRes?.total_delivered_m3 || 0;
    const totLoad = kpiRes?.total_loaded_m3 || 0;
    const totRev = kpiRes?.total_revenue_etb || 0;
    const totCost = kpiRes?.total_cost_etb || 0;
    const grossProfit = kpiRes?.gross_profit_etb || 0;

    return res.json({
      isAllTrucks: true,
      truck: {
        id: 'all',
        plate_number: 'ALL TRUCKS',
        owner_name: `Consolidated Fleet (${totalFleetTrucks} Hired Trucks)`,
        capacity_m3: fleetCapacity,
        owner_phone: null,
        is_active: 1,
        notes: 'Consolidated report across all registered external trucks and operations'
      },
      summary: {
        totalTrips: totTrips,
        distinctTrucksCount: kpiRes?.distinct_trucks_count || 0,
        successfulTrips: kpiRes?.successful_trips || 0,
        partialTrips: kpiRes?.partial_trips || 0,
        unsuccessfulTrips: kpiRes?.unsuccessful_trips || 0,
        pendingTrips: kpiRes?.pending_trips || 0,
        cancelledTrips: kpiRes?.cancelled_trips || 0,
        totalLoadedM3: totLoad,
        totalDeliveredM3: totDeliv,
        totalShortageM3: kpiRes?.total_shortage_m3 || 0,
        avgLoadM3: kpiRes?.avg_load_m3 || 0,
        avgDeliveredM3: kpiRes?.avg_delivered_m3 || 0,
        overloadTripsCount: enrichedTrucks.reduce((acc, t) => acc + (t.overload_count || 0), 0),
        successRate,
        shortageRate,
        capacityUtilization: null,
        totalRevenueEtb: totRev,
        totalCostEtb: totCost,
        grossProfitEtb: grossProfit,
        shortageLossEtb: kpiRes?.shortage_loss_etb || 0,
        avgRevenuePerTripEtb: totTrips > 0 ? Number((totRev / totTrips).toFixed(2)) : 0,
        avgCostPerTripEtb: totTrips > 0 ? Number((totCost / totTrips).toFixed(2)) : 0,
        avgProfitPerTripEtb: totTrips > 0 ? Number((grossProfit / totTrips).toFixed(2)) : 0,
        avgRevenuePerM3Etb: totDeliv > 0 ? Number((totRev / totDeliv).toFixed(2)) : 0,
        avgCostPerM3Etb: totLoad > 0 ? Number((totCost / totLoad).toFixed(2)) : 0,
      },
      trucksComparison: enrichedTrucks,
      sandBreakdown: Object.values(sandMap),
      topCrusherSites,
      topDestinations,
      trips
    });
  }

  // Otherwise, handle a specific truck
  const truck = queryOne<any>('SELECT * FROM trucks WHERE id = ? OR plate_number = ?', [truck_id, truck_id]);
  if (!truck) {
    return res.status(404).json({ error: 'Truck not found in registry' });
  }

  // Reuse whereSql and params filter built above

  // Overall KPI summary for this truck in the filtered period
  const kpiRes = queryOne<any>(`
    SELECT
      COUNT(tr.id) as total_trips,
      SUM(CASE WHEN tr.status = 'Delivered' THEN 1 ELSE 0 END) as successful_trips,
      SUM(CASE WHEN tr.status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_trips,
      SUM(CASE WHEN tr.status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_trips,
      SUM(CASE WHEN tr.status IN ('Registered', 'Loading', 'Loaded / In Transit') THEN 1 ELSE 0 END) as pending_trips,
      SUM(CASE WHEN tr.status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_trips,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as total_loaded_m3,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(tr.quantity_remaining_m3), 0), 2) as total_shortage_m3,
      ROUND(AVG(tr.quantity_loaded_m3), 2) as avg_load_m3,
      ROUND(AVG(tr.quantity_delivered_m3), 2) as avg_delivered_m3,
      ROUND(COALESCE(SUM(tr.total_revenue_etb), 0), 2) as total_revenue_etb,
      ROUND(COALESCE(SUM(tr.total_cost_etb), 0), 2) as total_cost_etb,
      ROUND(COALESCE(SUM(tr.gross_profit_etb), 0), 2) as gross_profit_etb,
      ROUND(COALESCE(SUM(tr.shortage_loss_etb), 0), 2) as shortage_loss_etb,
      SUM(CASE WHEN ? IS NOT NULL AND tr.quantity_loaded_m3 > ? THEN 1 ELSE 0 END) as overload_trips_count
    FROM trips tr
    WHERE tr.truck_id = ? AND (${whereSql})
  `, [truck.capacity_m3, truck.capacity_m3, truck.id, ...params]);

  const eligibleCompleted = (kpiRes?.successful_trips || 0) + (kpiRes?.partial_trips || 0) + (kpiRes?.unsuccessful_trips || 0);
  const successRate = eligibleCompleted > 0
    ? Number(((kpiRes.successful_trips / eligibleCompleted) * 100).toFixed(1))
    : null;

  const shortageRate = (kpiRes?.total_loaded_m3 || 0) > 0
    ? Number(((kpiRes.total_shortage_m3 / kpiRes.total_loaded_m3) * 100).toFixed(1))
    : 0;

  const capacityUtilization = (truck.capacity_m3 && truck.capacity_m3 > 0 && kpiRes?.avg_load_m3)
    ? Number(((kpiRes.avg_load_m3 / truck.capacity_m3) * 100).toFixed(1))
    : null;

  // Breakdown by Sand Category specifically for this truck
  const sandBreakdownRaw = query<any>(`
    SELECT
      tr.sand_type,
      COUNT(tr.id) as trip_count,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as loaded_m3,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as delivered_m3,
      ROUND(COALESCE(SUM(tr.quantity_remaining_m3), 0), 2) as shortage_m3,
      ROUND(COALESCE(SUM(tr.total_cost_etb), 0), 2) as total_cost_etb,
      ROUND(COALESCE(SUM(tr.total_revenue_etb), 0), 2) as total_revenue_etb,
      ROUND(COALESCE(SUM(tr.gross_profit_etb), 0), 2) as gross_profit_etb,
      CASE WHEN SUM(tr.quantity_loaded_m3) > 0 THEN ROUND(SUM(tr.total_cost_etb) / SUM(tr.quantity_loaded_m3), 2) ELSE 0 END as unit_cost_etb,
      CASE WHEN SUM(tr.quantity_delivered_m3) > 0 THEN ROUND(SUM(tr.total_revenue_etb) / SUM(tr.quantity_delivered_m3), 2) ELSE 0 END as unit_price_etb
    FROM trips tr
    WHERE tr.truck_id = ? AND (${whereSql})
    GROUP BY tr.sand_type
    ORDER BY tr.sand_type ASC
  `, [truck_id, ...params]);

  const sandMap: Record<string, any> = {
    '00': { sand_type: '00', trip_count: 0, loaded_m3: 0, delivered_m3: 0, shortage_m3: 0, total_cost_etb: 0, total_revenue_etb: 0, gross_profit_etb: 0, unit_cost_etb: 0, unit_price_etb: 0 },
    '01': { sand_type: '01', trip_count: 0, loaded_m3: 0, delivered_m3: 0, shortage_m3: 0, total_cost_etb: 0, total_revenue_etb: 0, gross_profit_etb: 0, unit_cost_etb: 0, unit_price_etb: 0 },
    '02': { sand_type: '02', trip_count: 0, loaded_m3: 0, delivered_m3: 0, shortage_m3: 0, total_cost_etb: 0, total_revenue_etb: 0, gross_profit_etb: 0, unit_cost_etb: 0, unit_price_etb: 0 }
  };
  sandBreakdownRaw.forEach(s => {
    sandMap[s.sand_type] = s;
  });

  // Top Crusher Plants (Loading points) used by this truck
  const topCrusherSites = query<any>(`
    SELECT
      tr.loading_location_name,
      COUNT(tr.id) as trips_count,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as loaded_m3
    FROM trips tr
    WHERE tr.truck_id = ? AND (${whereSql})
    GROUP BY tr.loading_location_id
    ORDER BY trips_count DESC, loaded_m3 DESC
  `, [truck_id, ...params]);

  // Top Construction Sites (Unloading destinations) served by this truck
  const topDestinations = query<any>(`
    SELECT
      tr.unloading_location_name,
      tr.company_name,
      COUNT(tr.id) as trips_count,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as delivered_m3
    FROM trips tr
    WHERE tr.truck_id = ? AND (${whereSql})
    GROUP BY tr.unloading_location_id, tr.company_id
    ORDER BY delivered_m3 DESC, trips_count DESC
  `, [truck_id, ...params]);

  // Chronological itemized trip logs for this truck
  const trips = query<any>(`
    SELECT
      tr.*,
      CASE
        WHEN ? IS NOT NULL AND tr.quantity_loaded_m3 > ? THEN 1
        ELSE 0
      END as is_over_capacity
    FROM trips tr
    WHERE tr.truck_id = ? AND (${whereSql})
    ORDER BY tr.trip_date DESC, tr.created_at DESC
  `, [truck.capacity_m3, truck.capacity_m3, truck_id, ...params]);

  const totTrips = kpiRes?.total_trips || 0;
  const totDeliv = kpiRes?.total_delivered_m3 || 0;
  const totLoad = kpiRes?.total_loaded_m3 || 0;
  const totRev = kpiRes?.total_revenue_etb || 0;
  const totCost = kpiRes?.total_cost_etb || 0;
  const grossProfit = kpiRes?.gross_profit_etb || 0;

  return res.json({
    truck,
    summary: {
      totalTrips: totTrips,
      successfulTrips: kpiRes?.successful_trips || 0,
      partialTrips: kpiRes?.partial_trips || 0,
      unsuccessfulTrips: kpiRes?.unsuccessful_trips || 0,
      pendingTrips: kpiRes?.pending_trips || 0,
      cancelledTrips: kpiRes?.cancelled_trips || 0,
      totalLoadedM3: totLoad,
      totalDeliveredM3: totDeliv,
      totalShortageM3: kpiRes?.total_shortage_m3 || 0,
      avgLoadM3: kpiRes?.avg_load_m3 || 0,
      avgDeliveredM3: kpiRes?.avg_delivered_m3 || 0,
      overloadTripsCount: kpiRes?.overload_trips_count || 0,
      successRate,
      shortageRate,
      capacityUtilization,
      totalRevenueEtb: totRev,
      totalCostEtb: totCost,
      grossProfitEtb: grossProfit,
      shortageLossEtb: kpiRes?.shortage_loss_etb || 0,
      avgRevenuePerTripEtb: totTrips > 0 ? Number((totRev / totTrips).toFixed(2)) : 0,
      avgCostPerTripEtb: totTrips > 0 ? Number((totCost / totTrips).toFixed(2)) : 0,
      avgProfitPerTripEtb: totTrips > 0 ? Number((grossProfit / totTrips).toFixed(2)) : 0,
      avgRevenuePerM3Etb: totDeliv > 0 ? Number((totRev / totDeliv).toFixed(2)) : 0,
      avgCostPerM3Etb: totLoad > 0 ? Number((totCost / totLoad).toFixed(2)) : 0,
    },
    sandBreakdown: Object.values(sandMap),
    topCrusherSites,
    topDestinations,
    trips
  });
});

// ------------------------------------------
// NEW FEATURE: Report on a Specific Construction Client / Company
// ------------------------------------------
apiRouter.get('/reports/single-company', (req: Request, res: Response) => {
  const { company_id } = req.query;
  if (!company_id) {
    return res.status(400).json({ error: 'company_id is required' });
  }

  const company = queryOne<any>('SELECT * FROM construction_companies WHERE id = ?', [company_id]);
  if (!company) {
    return res.status(404).json({ error: 'Construction company not found' });
  }

  const { whereSql, params } = buildReportFilter(req);

  const kpiRes = queryOne<any>(`
    SELECT
      COUNT(tr.id) as total_trips,
      SUM(CASE WHEN tr.status = 'Delivered' THEN 1 ELSE 0 END) as successful_trips,
      SUM(CASE WHEN tr.status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_trips,
      SUM(CASE WHEN tr.status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_trips,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as total_loaded_m3,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(tr.quantity_remaining_m3), 0), 2) as total_shortage_m3,
      COUNT(DISTINCT tr.truck_id) as distinct_trucks_used
    FROM trips tr
    WHERE tr.company_id = ? AND (${whereSql})
  `, [company_id, ...params]);

  const projects = query<any>(`
    SELECT
      COALESCE(tr.project_name, 'General Site Delivery') as project_name,
      COUNT(tr.id) as trip_count,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as delivered_m3,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '00' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as sand_00,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '01' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as sand_01,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '02' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as sand_02
    FROM trips tr
    WHERE tr.company_id = ? AND (${whereSql})
    GROUP BY tr.project_id
    ORDER BY delivered_m3 DESC
  `, [company_id, ...params]);

  const trucksUsed = query<any>(`
    SELECT
      tr.truck_plate,
      tr.truck_owner,
      COUNT(tr.id) as trip_count,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as delivered_m3
    FROM trips tr
    WHERE tr.company_id = ? AND (${whereSql})
    GROUP BY tr.truck_id
    ORDER BY delivered_m3 DESC
  `, [company_id, ...params]);

  const trips = query<any>(`
    SELECT * FROM trips tr
    WHERE tr.company_id = ? AND (${whereSql})
    ORDER BY tr.trip_date DESC, tr.created_at DESC
  `, [company_id, ...params]);

  return res.json({
    company,
    summary: kpiRes,
    projects,
    trucksUsed,
    trips
  });
});

// ------------------------------------------
// Report 1: Truck Performance
// ------------------------------------------
apiRouter.get('/reports/truck-performance', (req: Request, res: Response) => {
  const { whereSql, params } = buildReportFilter(req);
  const rows = query<any>(`
    SELECT
      tr.truck_id,
      tr.truck_plate,
      tr.truck_owner,
      (SELECT owner_phone FROM trucks WHERE id = tr.truck_id) as owner_phone,
      (SELECT capacity_m3 FROM trucks WHERE id = tr.truck_id) as capacity_m3,
      COUNT(tr.id) as total_trips,
      SUM(CASE WHEN tr.status = 'Delivered' THEN 1 ELSE 0 END) as successful_trips,
      SUM(CASE WHEN tr.status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_trips,
      SUM(CASE WHEN tr.status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_trips,
      SUM(CASE WHEN tr.status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_trips,
      SUM(CASE WHEN tr.status IN ('Registered', 'Loading', 'Loaded / In Transit') THEN 1 ELSE 0 END) as pending_trips,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as total_loaded_m3,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(tr.quantity_remaining_m3), 0), 2) as total_shortage_m3,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '00' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_00,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '01' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_01,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '02' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_02
    FROM trips tr
    WHERE ${whereSql}
    GROUP BY tr.truck_id
    ORDER BY total_delivered_m3 DESC, total_trips DESC
  `, params);

  const reportData = rows.map(r => {
    const eligible = (r.successful_trips || 0) + (r.partial_trips || 0) + (r.unsuccessful_trips || 0);
    const successRate = eligible > 0
      ? Number(((r.successful_trips / eligible) * 100).toFixed(1))
      : null;
    return {
      ...r,
      eligible_trips: eligible,
      success_rate: successRate,
      success_rate_label: successRate !== null ? `${successRate}%` : 'N/A'
    };
  });

  return res.json(reportData);
});

// ------------------------------------------
// Report 2: Sand Type Report (00, 01, 02 separate categories)
// ------------------------------------------
apiRouter.get('/reports/sand-type', (req: Request, res: Response) => {
  const { whereSql, params } = buildReportFilter(req);
  const rows = query<any>(`
    SELECT
      tr.sand_type,
      COUNT(tr.id) as total_trips,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as total_loaded_m3,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(tr.quantity_remaining_m3), 0), 2) as total_not_delivered_m3,
      SUM(CASE WHEN tr.status = 'Delivered' THEN 1 ELSE 0 END) as successful_trips,
      SUM(CASE WHEN tr.status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_trips,
      SUM(CASE WHEN tr.status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_trips,
      SUM(CASE WHEN tr.status IN ('Registered', 'Loading', 'Loaded / In Transit') THEN 1 ELSE 0 END) as pending_trips,
      SUM(CASE WHEN tr.status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_trips
    FROM trips tr
    WHERE ${whereSql}
    GROUP BY tr.sand_type
    ORDER BY tr.sand_type ASC
  `, params);

  const fullCategories: Record<string, any> = {
    '00': { sand_type: '00', total_trips: 0, total_loaded_m3: 0, total_delivered_m3: 0, total_not_delivered_m3: 0, successful_trips: 0, partial_trips: 0, unsuccessful_trips: 0, pending_trips: 0, cancelled_trips: 0 },
    '01': { sand_type: '01', total_trips: 0, total_loaded_m3: 0, total_delivered_m3: 0, total_not_delivered_m3: 0, successful_trips: 0, partial_trips: 0, unsuccessful_trips: 0, pending_trips: 0, cancelled_trips: 0 },
    '02': { sand_type: '02', total_trips: 0, total_loaded_m3: 0, total_delivered_m3: 0, total_not_delivered_m3: 0, successful_trips: 0, partial_trips: 0, unsuccessful_trips: 0, pending_trips: 0, cancelled_trips: 0 }
  };
  rows.forEach(r => {
    fullCategories[r.sand_type] = r;
  });

  return res.json(Object.values(fullCategories));
});

// ------------------------------------------
// Report 3: Unloading Destination Report
// ------------------------------------------
apiRouter.get('/reports/destinations', (req: Request, res: Response) => {
  const { whereSql, params } = buildReportFilter(req);
  const rows = query<any>(`
    SELECT
      tr.unloading_location_id,
      tr.unloading_location_name,
      COUNT(tr.id) as total_trips,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(tr.quantity_remaining_m3), 0), 2) as total_shortage_m3,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '00' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_00,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '01' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_01,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '02' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_02,
      SUM(CASE WHEN tr.status = 'Delivered' THEN 1 ELSE 0 END) as successful_trips,
      SUM(CASE WHEN tr.status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_trips,
      SUM(CASE WHEN tr.status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_trips,
      GROUP_CONCAT(DISTINCT tr.company_name) as companies_served,
      GROUP_CONCAT(DISTINCT tr.project_name) as projects_served
    FROM trips tr
    WHERE ${whereSql}
    GROUP BY tr.unloading_location_id
    ORDER BY total_delivered_m3 DESC, total_trips DESC
  `, params);

  return res.json(rows);
});

// ------------------------------------------
// Report 4: Loading Point (Crusher Sites) Report
// ------------------------------------------
apiRouter.get('/reports/loading-points', (req: Request, res: Response) => {
  const { whereSql, params } = buildReportFilter(req);
  const rows = query<any>(`
    SELECT
      tr.loading_location_id,
      tr.loading_location_name,
      COUNT(tr.id) as total_trips,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as total_loaded_m3,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '00' THEN tr.quantity_loaded_m3 ELSE 0 END), 0), 2) as loaded_sand_00,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '01' THEN tr.quantity_loaded_m3 ELSE 0 END), 0), 2) as loaded_sand_01,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '02' THEN tr.quantity_loaded_m3 ELSE 0 END), 0), 2) as loaded_sand_02,
      SUM(CASE WHEN tr.status = 'Delivered' THEN 1 ELSE 0 END) as successful_trips,
      SUM(CASE WHEN tr.status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_trips,
      SUM(CASE WHEN tr.status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_trips
    FROM trips tr
    WHERE ${whereSql}
    GROUP BY tr.loading_location_id
    ORDER BY total_loaded_m3 DESC, total_trips DESC
  `, params);

  return res.json(rows);
});

// ------------------------------------------
// Report 5: Construction Company & Project Report
// ------------------------------------------
apiRouter.get('/reports/companies-projects', (req: Request, res: Response) => {
  const { whereSql, params } = buildReportFilter(req);
  const rows = query<any>(`
    SELECT
      tr.company_id,
      tr.company_name,
      tr.project_id,
      COALESCE(tr.project_name, 'General / Direct Deliveries') as project_name,
      COUNT(tr.id) as total_trips,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as total_loaded_m3,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(tr.quantity_remaining_m3), 0), 2) as total_shortage_m3,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '00' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_00,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '01' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_01,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '02' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_02,
      COUNT(DISTINCT tr.truck_id) as distinct_trucks_used,
      SUM(CASE WHEN tr.status = 'Delivered' THEN 1 ELSE 0 END) as successful_trips,
      SUM(CASE WHEN tr.status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_trips,
      SUM(CASE WHEN tr.status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_trips
    FROM trips tr
    WHERE ${whereSql}
    GROUP BY tr.company_id, tr.project_id
    ORDER BY tr.company_name ASC, total_delivered_m3 DESC
  `, params);

  return res.json(rows);
});

// ------------------------------------------
// Report 6: Daily, Weekly, and Monthly Time Summary
// ------------------------------------------
apiRouter.get('/reports/time-summary', (req: Request, res: Response) => {
  const { period = 'daily' } = req.query;
  const { whereSql, params } = buildReportFilter(req);

  let dateGroupExpr = "strftime('%Y-%m-%d', tr.trip_date)";
  if (period === 'weekly') {
    dateGroupExpr = "strftime('%Y-W%W', tr.trip_date)";
  } else if (period === 'monthly') {
    dateGroupExpr = "strftime('%Y-%m', tr.trip_date)";
  }

  const rows = query<any>(`
    SELECT
      ${dateGroupExpr} as period_label,
      COUNT(tr.id) as total_trips,
      SUM(CASE WHEN tr.status = 'Delivered' THEN 1 ELSE 0 END) as successful_trips,
      SUM(CASE WHEN tr.status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_trips,
      SUM(CASE WHEN tr.status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_trips,
      SUM(CASE WHEN tr.status IN ('Registered', 'Loading', 'Loaded / In Transit') THEN 1 ELSE 0 END) as pending_trips,
      SUM(CASE WHEN tr.status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_trips,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as total_loaded_m3,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(tr.quantity_remaining_m3), 0), 2) as total_shortage_m3,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '00' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_00,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '01' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_01,
      ROUND(COALESCE(SUM(CASE WHEN tr.sand_type = '02' THEN tr.quantity_delivered_m3 ELSE 0 END), 0), 2) as delivered_sand_02
    FROM trips tr
    WHERE ${whereSql}
    GROUP BY ${dateGroupExpr}
    ORDER BY period_label DESC
  `, params);

  return res.json(rows);
});

// ------------------------------------------
// Report 7: Detailed Unified Trip Register
// ------------------------------------------
apiRouter.get('/reports/detailed-register', (req: Request, res: Response) => {
  const { whereSql, params } = buildReportFilter(req);
  const rows = query<any>(`
    SELECT
      tr.id,
      tr.trip_date,
      tr.truck_id,
      tr.truck_plate,
      tr.truck_owner,
      (SELECT owner_phone FROM trucks WHERE id = tr.truck_id) as truck_owner_phone,
      (SELECT capacity_m3 FROM trucks WHERE id = tr.truck_id) as truck_capacity_m3,
      tr.company_id,
      tr.company_name,
      tr.project_id,
      COALESCE(tr.project_name, '-') as project_name,
      tr.loading_location_id,
      tr.loading_location_name,
      tr.unloading_location_id,
      tr.unloading_location_name,
      tr.sand_type,
      tr.quantity_loaded_m3,
      tr.quantity_delivered_m3,
      tr.quantity_remaining_m3,
      tr.unit_cost_etb,
      tr.total_cost_etb,
      tr.unit_price_etb,
      tr.total_revenue_etb,
      tr.gross_profit_etb,
      tr.shortage_loss_etb,
      tr.transport_rate_etb_per_m3,
      tr.total_transport_fee_etb,
      tr.route_tariff_id,
      tr.status,
      tr.delivery_outcome,
      tr.delivery_proof_ref,
      COALESCE(tr.status_reason, tr.unloading_notes, tr.loading_notes, '') as notes,
      tr.created_at
    FROM trips tr
    WHERE ${whereSql}
    ORDER BY tr.trip_date DESC, tr.created_at DESC
  `, params);

  return res.json(rows);
});

// ------------------------------------------
// Report 8: Incomplete and Exception Report
// ------------------------------------------
apiRouter.get('/reports/exceptions', (req: Request, res: Response) => {
  const { whereSql, params } = buildReportFilter(req);
  const rows = query<any>(`
    SELECT
      tr.*,
      t.capacity_m3 as truck_capacity_m3,
      CASE
        WHEN tr.status IN ('Registered', 'Loading', 'Loaded / In Transit') THEN 'Pending Dispatch'
        WHEN tr.status = 'Partially Delivered' THEN 'Partial Delivery Shortage'
        WHEN tr.status = 'Unsuccessful' THEN 'Unsuccessful Delivery Outcome'
        WHEN tr.status = 'Delivered' AND (tr.delivery_proof_ref IS NULL OR tr.delivery_proof_ref = '') THEN 'Missing Proof of Delivery'
        WHEN t.capacity_m3 IS NOT NULL AND tr.quantity_loaded_m3 > t.capacity_m3 THEN 'Exceeded Truck Capacity'
        ELSE 'Review Required'
      END as exception_type
    FROM trips tr
    LEFT JOIN trucks t ON tr.truck_id = t.id
    WHERE (${whereSql})
      AND (
        tr.status IN ('Registered', 'Loading', 'Loaded / In Transit', 'Partially Delivered', 'Unsuccessful')
        OR (tr.status = 'Delivered' AND (tr.delivery_proof_ref IS NULL OR tr.delivery_proof_ref = ''))
        OR (t.capacity_m3 IS NOT NULL AND tr.quantity_loaded_m3 > t.capacity_m3)
      )
    ORDER BY tr.trip_date DESC, tr.created_at DESC
  `, params);

  return res.json(rows);
});

// ------------------------------------------
// Report 9: Transport Fees & Financial Report
// ------------------------------------------
apiRouter.get('/reports/financial', (req: Request, res: Response) => {
  const { whereSql, params } = buildReportFilter(req);

  const kpiRes = queryOne<any>(`
    SELECT
      COUNT(tr.id) as total_trips,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as total_loaded_m3,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(tr.quantity_remaining_m3), 0), 2) as total_shortage_m3,
      ROUND(COALESCE(SUM(tr.total_revenue_etb), 0), 2) as total_revenue_etb,
      ROUND(COALESCE(SUM(tr.total_cost_etb), 0), 2) as total_cost_etb,
      ROUND(COALESCE(SUM(tr.gross_profit_etb), 0), 2) as gross_profit_etb,
      ROUND(COALESCE(SUM(tr.shortage_loss_etb), 0), 2) as shortage_loss_etb,
      ROUND(COALESCE(SUM(tr.total_transport_fee_etb), 0), 2) as total_transport_fees_etb
    FROM trips tr
    WHERE ${whereSql}
  `, params);

  const totalTrips = kpiRes?.total_trips || 0;
  const totalRev = kpiRes?.total_revenue_etb || 0;
  const totalCost = kpiRes?.total_cost_etb || 0;
  const grossProfit = kpiRes?.gross_profit_etb || 0;
  const shortageLoss = kpiRes?.shortage_loss_etb || 0;
  const totalTransportFees = kpiRes?.total_transport_fees_etb || 0;
  const totalDelivered = kpiRes?.total_delivered_m3 || 0;
  const totalLoaded = kpiRes?.total_loaded_m3 || 0;

  const byRoute = query<any>(`
    SELECT
      tr.loading_location_name as origin_location_name,
      tr.unloading_location_name as destination_location_name,
      COALESCE(rt.fee_per_trip_etb, rt.fixed_trip_fee_etb, rt.rate_per_m3_etb * 20, 8500) as fee_per_trip_etb,
      COALESCE(rt.rate_per_m3_etb, 450) as rate_per_m3_etb,
      rt.distance_km,
      COUNT(tr.id) as trip_count,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as loaded_m3,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as delivered_m3,
      ROUND(COALESCE(SUM(tr.total_transport_fee_etb), 0), 2) as total_transport_fee_etb,
      CASE WHEN COUNT(tr.id) > 0 THEN ROUND(SUM(tr.total_transport_fee_etb) / COUNT(tr.id), 2) ELSE 0 END as avg_fee_per_truck_etb,
      CASE WHEN SUM(tr.quantity_delivered_m3) > 0 THEN ROUND(SUM(tr.total_transport_fee_etb) / SUM(tr.quantity_delivered_m3), 2) ELSE COALESCE(rt.rate_per_m3_etb, 450) END as avg_rate_per_m3_etb
    FROM trips tr
    LEFT JOIN route_tariffs rt ON tr.loading_location_id = rt.origin_location_id AND tr.unloading_location_id = rt.destination_location_id
    WHERE ${whereSql}
    GROUP BY tr.loading_location_id, tr.unloading_location_id
    ORDER BY total_transport_fee_etb DESC
  `, params);

  const bySandType = query<any>(`
    SELECT
      tr.sand_type,
      COUNT(tr.id) as trip_count,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as loaded_m3,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as delivered_m3,
      ROUND(COALESCE(SUM(tr.total_cost_etb), 0), 2) as total_cost_etb,
      ROUND(COALESCE(SUM(tr.total_revenue_etb), 0), 2) as total_revenue_etb,
      ROUND(COALESCE(SUM(tr.gross_profit_etb), 0), 2) as gross_profit_etb,
      ROUND(COALESCE(SUM(tr.total_transport_fee_etb), 0), 2) as total_transport_fee_etb,
      CASE WHEN SUM(tr.quantity_loaded_m3) > 0 THEN ROUND(SUM(tr.total_cost_etb) / SUM(tr.quantity_loaded_m3), 2) ELSE 0 END as unit_cost_etb,
      CASE WHEN SUM(tr.quantity_delivered_m3) > 0 THEN ROUND(SUM(tr.total_revenue_etb) / SUM(tr.quantity_delivered_m3), 2) ELSE 0 END as unit_price_etb,
      CASE WHEN COUNT(tr.id) > 0 THEN ROUND(SUM(tr.gross_profit_etb) / COUNT(tr.id), 2) ELSE 0 END as avg_profit_per_truck_etb
    FROM trips tr
    WHERE ${whereSql}
    GROUP BY tr.sand_type
    ORDER BY tr.sand_type ASC
  `, params);

  const byCrusherSite = query<any>(`
    SELECT
      tr.loading_location_name,
      COUNT(tr.id) as trip_count,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as loaded_m3,
      ROUND(COALESCE(SUM(tr.total_cost_etb), 0), 2) as total_cost_etb,
      ROUND(COALESCE(SUM(tr.total_transport_fee_etb), 0), 2) as total_transport_fee_etb,
      CASE WHEN SUM(tr.quantity_loaded_m3) > 0 THEN ROUND(SUM(tr.total_cost_etb) / SUM(tr.quantity_loaded_m3), 2) ELSE 0 END as avg_cost_per_m3_etb,
      CASE WHEN COUNT(tr.id) > 0 THEN ROUND(SUM(tr.total_cost_etb) / COUNT(tr.id), 2) ELSE 0 END as avg_cost_per_truck_etb
    FROM trips tr
    WHERE ${whereSql}
    GROUP BY tr.loading_location_id
    ORDER BY total_cost_etb DESC
  `, params);

  const byDestinationProject = query<any>(`
    SELECT
      tr.unloading_location_name,
      tr.company_name,
      COUNT(tr.id) as trip_count,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as delivered_m3,
      ROUND(COALESCE(SUM(tr.total_revenue_etb), 0), 2) as total_revenue_etb,
      ROUND(COALESCE(SUM(tr.gross_profit_etb), 0), 2) as gross_profit_etb,
      ROUND(COALESCE(SUM(tr.total_transport_fee_etb), 0), 2) as total_transport_fee_etb,
      CASE WHEN SUM(tr.quantity_delivered_m3) > 0 THEN ROUND(SUM(tr.total_revenue_etb) / SUM(tr.quantity_delivered_m3), 2) ELSE 0 END as avg_price_per_m3_etb,
      CASE WHEN COUNT(tr.id) > 0 THEN ROUND(SUM(tr.total_revenue_etb) / COUNT(tr.id), 2) ELSE 0 END as avg_revenue_per_truck_etb
    FROM trips tr
    WHERE ${whereSql}
    GROUP BY tr.unloading_location_id
    ORDER BY total_revenue_etb DESC
  `, params);

  const byTruck = query<any>(`
    SELECT
      tr.truck_plate,
      tr.truck_owner,
      COUNT(tr.id) as trip_count,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as delivered_m3,
      ROUND(COALESCE(SUM(tr.total_revenue_etb), 0), 2) as total_revenue_etb,
      ROUND(COALESCE(SUM(tr.total_cost_etb), 0), 2) as total_cost_etb,
      ROUND(COALESCE(SUM(tr.gross_profit_etb), 0), 2) as gross_profit_etb,
      ROUND(COALESCE(SUM(tr.total_transport_fee_etb), 0), 2) as total_transport_fee_etb,
      CASE WHEN COUNT(tr.id) > 0 THEN ROUND(SUM(tr.total_revenue_etb) / COUNT(tr.id), 2) ELSE 0 END as avg_revenue_per_truck_etb,
      CASE WHEN COUNT(tr.id) > 0 THEN ROUND(SUM(tr.gross_profit_etb) / COUNT(tr.id), 2) ELSE 0 END as avg_profit_per_truck_etb,
      CASE WHEN COUNT(tr.id) > 0 THEN ROUND(SUM(tr.total_transport_fee_etb) / COUNT(tr.id), 2) ELSE 0 END as avg_fee_per_truck_etb
    FROM trips tr
    WHERE ${whereSql}
    GROUP BY tr.truck_id
    ORDER BY total_transport_fee_etb DESC
  `, params);

  const trips = query<any>(`
    SELECT
      tr.id,
      tr.trip_date,
      tr.truck_plate,
      tr.truck_owner,
      tr.company_name,
      COALESCE(tr.project_name, '-') as project_name,
      tr.loading_location_name,
      tr.unloading_location_name,
      tr.sand_type,
      tr.quantity_loaded_m3,
      tr.quantity_delivered_m3,
      tr.quantity_remaining_m3,
      tr.unit_cost_etb,
      tr.total_cost_etb,
      tr.unit_price_etb,
      tr.total_revenue_etb,
      tr.gross_profit_etb,
      tr.shortage_loss_etb,
      tr.transport_rate_etb_per_m3,
      tr.total_transport_fee_etb,
      tr.route_tariff_id,
      tr.status,
      tr.created_at
    FROM trips tr
    WHERE ${whereSql}
    ORDER BY tr.trip_date DESC, tr.created_at DESC
  `, params);

  return res.json({
    kpi: {
      totalRevenueEtb: totalRev,
      totalCostEtb: totalCost,
      grossProfitEtb: grossProfit,
      shortageLossEtb: shortageLoss,
      totalTransportFeesEtb: totalTransportFees,
      profitMarginPct: totalRev > 0 ? Number(((grossProfit / totalRev) * 100).toFixed(1)) : 0,
      avgRevenuePerTruckEtb: totalTrips > 0 ? Number((totalRev / totalTrips).toFixed(2)) : 0,
      avgCostPerTruckEtb: totalTrips > 0 ? Number((totalCost / totalTrips).toFixed(2)) : 0,
      avgProfitPerTruckEtb: totalTrips > 0 ? Number((grossProfit / totalTrips).toFixed(2)) : 0,
      avgTransportFeePerTruckEtb: totalTrips > 0 ? Number((totalTransportFees / totalTrips).toFixed(2)) : 0,
      avgTransportRatePerM3Etb: totalDelivered > 0 ? Number((totalTransportFees / totalDelivered).toFixed(2)) : 0,
      avgSellingPricePerM3Etb: totalDelivered > 0 ? Number((totalRev / totalDelivered).toFixed(2)) : 0,
      avgCostPricePerM3Etb: totalLoaded > 0 ? Number((totalCost / totalLoaded).toFixed(2)) : 0,
      totalTrips,
      totalDeliveredM3: totalDelivered,
      totalLoadedM3: totalLoaded,
      totalShortageM3: kpiRes?.total_shortage_m3 || 0,
    },
    byRoute,
    bySandType,
    byCrusherSite,
    byDestinationProject,
    byTruck,
    trips
  });
});

// ------------------------------------------
// Hired Trucks & Trip History with Transport Fees Pivot Report
// ------------------------------------------
apiRouter.get('/reports/truck-transport-pivot', (req: Request, res: Response) => {
  const { whereSql, params } = buildReportFilter(req);

  // 1. Overall KPIs across filtered trips
  const kpiRes = queryOne<any>(`
    SELECT
      COUNT(DISTINCT tr.truck_id) as total_hired_trucks,
      COUNT(tr.id) as total_trips,
      ROUND(COALESCE(SUM(tr.total_transport_fee_etb), 0), 2) as total_transport_fees_etb,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as total_loaded_m3,
      SUM(CASE WHEN tr.status = 'Delivered' THEN 1 ELSE 0 END) as successful_trips,
      SUM(CASE WHEN tr.status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_trips,
      SUM(CASE WHEN tr.status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_trips
    FROM trips tr
    WHERE ${whereSql}
  `, params);

  // 2. Aggregate per truck: Pivoted summary around truck plate number
  const truckGroupsRaw = query<any>(`
    SELECT
      t.id as truck_id,
      t.plate_number as truck_plate,
      t.owner_name as truck_owner,
      t.owner_phone,
      t.capacity_m3,
      t.is_active,
      COUNT(tr.id) as total_trips,
      ROUND(COALESCE(SUM(tr.total_transport_fee_etb), 0), 2) as calculated_total_transport_fee_etb,
      ROUND(COALESCE(SUM(tr.quantity_delivered_m3), 0), 2) as total_delivered_m3,
      ROUND(COALESCE(SUM(tr.quantity_loaded_m3), 0), 2) as total_loaded_m3,
      ROUND(COALESCE(SUM(tr.quantity_remaining_m3), 0), 2) as total_shortage_m3,
      SUM(CASE WHEN tr.status = 'Delivered' THEN 1 ELSE 0 END) as successful_trips,
      SUM(CASE WHEN tr.status = 'Partially Delivered' THEN 1 ELSE 0 END) as partial_trips,
      SUM(CASE WHEN tr.status = 'Unsuccessful' THEN 1 ELSE 0 END) as unsuccessful_trips,
      SUM(CASE WHEN tr.status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_trips,
      SUM(CASE WHEN tr.status IN ('Registered', 'Loading', 'Loaded / In Transit') THEN 1 ELSE 0 END) as pending_trips
    FROM trucks t
    INNER JOIN trips tr ON t.id = tr.truck_id
    WHERE ${whereSql}
    GROUP BY t.id
    ORDER BY calculated_total_transport_fee_etb DESC, total_trips DESC, t.plate_number ASC
  `, params);

  // 3. Itemized multiple rows of trip history
  const allTrips = query<any>(`
    SELECT
      tr.id,
      tr.trip_date,
      tr.truck_id,
      tr.truck_plate,
      tr.truck_owner,
      tr.loading_location_id,
      tr.loading_location_name,
      tr.unloading_location_id,
      tr.unloading_location_name,
      tr.company_id,
      tr.company_name,
      tr.project_id,
      COALESCE(tr.project_name, '-') as project_name,
      tr.sand_type,
      tr.quantity_loaded_m3,
      tr.quantity_delivered_m3,
      tr.quantity_remaining_m3,
      tr.status,
      tr.status_reason,
      tr.delivery_outcome,
      tr.delivery_proof_ref,
      COALESCE(tr.total_transport_fee_etb, tr.transport_rate_etb_per_m3, 8500) as individual_transport_fee_etb,
      tr.transport_rate_etb_per_m3,
      tr.loading_datetime,
      tr.created_at
    FROM trips tr
    WHERE ${whereSql}
    ORDER BY tr.truck_plate ASC, tr.trip_date DESC, tr.created_at DESC
  `, params);

  // Map trips to their corresponding truck
  const tripsByTruckMap = new Map<string, any[]>();
  for (const trip of allTrips) {
    if (!tripsByTruckMap.has(trip.truck_id)) {
      tripsByTruckMap.set(trip.truck_id, []);
    }
    tripsByTruckMap.get(trip.truck_id)!.push(trip);
  }

  const truckGroups = truckGroupsRaw.map(tg => ({
    ...tg,
    trips: tripsByTruckMap.get(tg.truck_id) || []
  }));

  const totalTrucksCount = truckGroups.length;
  const totalFees = kpiRes?.total_transport_fees_etb || 0;
  const avgFeePerTruck = totalTrucksCount > 0 ? Number((totalFees / totalTrucksCount).toFixed(2)) : 0;
  const avgFeePerTrip = (kpiRes?.total_trips || 0) > 0 ? Number((totalFees / kpiRes.total_trips).toFixed(2)) : 0;

  return res.json({
    kpis: {
      totalHiredTrucks: totalTrucksCount,
      totalTrips: kpiRes?.total_trips || 0,
      totalTransportFeesEtb: totalFees,
      avgFeePerTruckEtb: avgFeePerTruck,
      avgFeePerTripEtb: avgFeePerTrip,
      totalDeliveredM3: kpiRes?.total_delivered_m3 || 0,
      totalLoadedM3: kpiRes?.total_loaded_m3 || 0,
      successfulTrips: kpiRes?.successful_trips || 0,
      partialTrips: kpiRes?.partial_trips || 0,
      cancelledTrips: kpiRes?.cancelled_trips || 0,
    },
    truckGroups,
    allTripsFlat: allTrips.map(tr => {
      const parent = truckGroups.find(tg => tg.truck_id === tr.truck_id);
      return {
        ...tr,
        calculated_total_transport_fee_etb: parent?.calculated_total_transport_fee_etb || 0,
        truck_capacity_m3: parent?.capacity_m3 || null,
        owner_phone: parent?.owner_phone || null,
        truck_total_trips: parent?.total_trips || 0,
        truck_total_delivered_m3: parent?.total_delivered_m3 || 0
      };
    })
  });
});

