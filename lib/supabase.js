// === Theo Sign - Supabase Client Helper ===
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Admin client (service_role) — bypasses RLS for full CRUD
let supabaseAdmin = null;

// Public client (anon) — respects RLS
let supabaseAnon = null;

function getAdmin() {
  if (!supabaseAdmin) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
      return null;
    }
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabaseAdmin;
}

function getAnon() {
  if (!supabaseAnon) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
      return null;
    }
    supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabaseAnon;
}

// ============================================================
// DATABASE HELPERS
// ============================================================

// Verify a connection by counting access_codes
async function testConnection() {
  try {
    const sb = getAdmin();
    if (!sb) return false;
    const { count, error } = await sb
      .from('access_codes')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    console.log(`[Supabase] Connected. Found ${count} access codes.`);
    return true;
  } catch (err) {
    console.error('[Supabase] Connection test failed:', err.message);
    return false;
  }
}

// ============================================================
// ACCESS CODES
// ============================================================

async function findAccessCode(code) {
  const sb = getAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('access_codes')
    .select('*')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getAllAccessCodes() {
  const sb = getAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('access_codes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createAccessCode({ code, usage_limit = -1, expires_at = null }) {
  const sb = getAdmin();
  if (!sb) throw new Error('Supabase not initialized');
  const { data, error } = await sb
    .from('access_codes')
    .insert({ code, usage_limit, expires_at })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateAccessCode(code, updates) {
  const sb = getAdmin();
  if (!sb) throw new Error('Supabase not initialized');
  const { data, error } = await sb
    .from('access_codes')
    .update(updates)
    .eq('code', code)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteAccessCode(code) {
  const sb = getAdmin();
  if (!sb) throw new Error('Supabase not initialized');
  const { error } = await sb
    .from('access_codes')
    .delete()
    .eq('code', code);
  if (error) throw error;
}

async function incrementUsage(code) {
  const sb = getAdmin();
  if (!sb) throw new Error('Supabase not initialized');
  const { data: current } = await sb
    .from('access_codes')
    .select('usage_count')
    .eq('code', code)
    .single();
  const newCount = (current?.usage_count || 0) + 1;
  const { error } = await sb
    .from('access_codes')
    .update({ usage_count: newCount })
    .eq('code', code);
  if (error) throw error;
}

// ============================================================
// UPLOADS
// ============================================================

async function createUpload({ access_code, filename, original_name, storage_path, analysis_result }) {
  const sb = getAdmin();
  if (!sb) throw new Error('Supabase not initialized');
  const { data, error } = await sb
    .from('uploads')
    .insert({ access_code, filename, original_name, storage_path, analysis_result })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getUploadsByCode(access_code) {
  const sb = getAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('uploads')
    .select('*')
    .eq('access_code', access_code)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getAllUploads() {
  const sb = getAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('uploads')
    .select('*')
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============================================================
// STORAGE (chart images)
// ============================================================

const STORAGE_BUCKET = 'charts';

async function ensureStorageBucket() {
  try {
    const sb = getAdmin();
    if (!sb) return;
    // Check if bucket exists
    const { data: buckets } = await sb.storage.listBuckets();
    const exists = buckets?.some(b => b.name === STORAGE_BUCKET);
    if (!exists) {
      const { error } = await sb.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
      });
      if (error) throw error;
      console.log(`[Supabase] Created storage bucket "${STORAGE_BUCKET}"`);
    }
  } catch (err) {
    console.error('[Supabase] Error ensuring storage bucket:', err.message);
  }
}

async function uploadChartImage(fileBuffer, fileName, mimeType) {
  const sb = getAdmin();
  if (!sb) throw new Error('Supabase not initialized');
  
  const filePath = `uploads/${Date.now()}_${fileName}`;
  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });
  if (error) throw error;

  // Get public URL
  const { data: { publicUrl } } = sb.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return { path: filePath, url: publicUrl };
}

// ============================================================
// ANALYTICS
// ============================================================

async function getAnalytics() {
  const sb = getAdmin();
  if (!sb) {
    return { totalCodes: 0, activeCodes: 0, disabledCodes: 0, totalUploads: 0, totalUsage: 0, expiredCodes: 0 };
  }

  try {
    const [codesResult, uploadsResult] = await Promise.all([
      sb.from('access_codes').select('*'),
      sb.from('uploads').select('id', { count: 'exact', head: true }),
    ]);

    const codes = codesResult.data || [];
    const totalUploads = uploadsResult.count || 0;

    const now = new Date();
    const activeCodes = codes.filter(c => !c.disabled && (!c.expires_at || new Date(c.expires_at) > now));
    const disabledCodes = codes.filter(c => c.disabled);
    const expiredCodes = codes.filter(c => c.expires_at && new Date(c.expires_at) <= now && !c.disabled);
    const totalUsage = codes.reduce((sum, c) => sum + (c.usage_count || 0), 0);

    return {
      totalCodes: codes.length,
      activeCodes: activeCodes.length,
      disabledCodes: disabledCodes.length,
      totalUploads,
      totalUsage,
      expiredCodes: expiredCodes.length,
    };
  } catch (err) {
    console.error('[Supabase] Analytics error:', err.message);
    return { totalCodes: 0, activeCodes: 0, disabledCodes: 0, totalUploads: 0, totalUsage: 0, expiredCodes: 0 };
  }
}

// ============================================================
// USERS (derived from access_codes + uploads)
// ============================================================

async function getActiveUsers() {
  const sb = getAdmin();
  if (!sb) return [];

  try {
    const { data: codes } = await sb.from('access_codes').select('*');
    const { data: uploads } = await sb.from('uploads').select('*');

    const uploadCounts = {};
    (uploads || []).forEach(u => {
      uploadCounts[u.access_code] = (uploadCounts[u.access_code] || 0) + 1;
    });

    return (codes || []).map(c => ({
      code: c.code,
      disabled: c.disabled,
      usage_count: c.usage_count,
      usage_limit: c.usage_limit,
      expires_at: c.expires_at,
      created_at: c.created_at,
      upload_count: uploadCounts[c.code] || 0,
      last_active: null,
    }));
  } catch (err) {
    console.error('[Supabase] Active users error:', err.message);
    return [];
  }
}

// ============================================================
// SETTINGS
// ============================================================

async function getSetting(key) {
  const sb = getAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data?.value || null;
}

module.exports = {
  testConnection,
  ensureStorageBucket,
  // Access codes
  findAccessCode,
  getAllAccessCodes,
  createAccessCode,
  updateAccessCode,
  deleteAccessCode,
  incrementUsage,
  // Uploads
  createUpload,
  getUploadsByCode,
  getAllUploads,
  // Storage
  uploadChartImage,
  // Analytics
  getAnalytics,
  getActiveUsers,
  // Settings
  getSetting,
};
