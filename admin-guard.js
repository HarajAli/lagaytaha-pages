// admin-guard.js
// بدون أي مكتبة خارجية (CDN) — نفس أسلوب login.html الأصلي: fetch() مباشر
// على Supabase REST/Auth API. هذا يتجنب مشكلة حجب/بطء تحميل مكتبات خارجية.

const SUPABASE_URL = 'https://tnzxnjivkhyjijyotiog.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4URJrD-YoQyrogg3YnBFkg_gXVIPder';
const SESSION_KEY = 'laqaytaha_admin_session';

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch (e) { return null; }
}
function clearSession() { localStorage.removeItem(SESSION_KEY); }

async function apiFetch(path, opts = {}) {
  const session = getSession();
  const headers = Object.assign({
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  }, opts.headers || {});
  if (session?.access_token) headers['Authorization'] = 'Bearer ' + session.access_token;
  return fetch(SUPABASE_URL + path, Object.assign({}, opts, { headers }));
}

async function rpc(name, params = {}) {
  const res = await apiFetch('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(params) });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) return { data: null, error: data || { message: res.statusText }, status: res.status };
  return { data, error: null, status: res.status };
}

async function selectCount(table, filterQuery = '') {
  const res = await apiFetch(`/rest/v1/${table}?select=id${filterQuery}`, {
    method: 'GET',
    headers: { Prefer: 'count=exact' },
  });
  const range = res.headers.get('content-range'); // مثال: "0-24/137"
  const total = range ? parseInt(range.split('/')[1], 10) : null;
  return { count: Number.isFinite(total) ? total : null, ok: res.ok };
}

async function selectRows(table, query = '') {
  const res = await apiFetch(`/rest/v1/${table}?${query}`, { method: 'GET' });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { data: null, error: data };
  return { data, error: null };
}

// يُستدعى من الصفحة بعد تحميل الـ DOM — يرجّع { user, role, fullName } أو null
async function requireAdmin() {
  const session = getSession();
  if (!session?.access_token) {
    window.location.href = './admin-login.html';
    return null;
  }

  const { data: isStaff, error, status } = await rpc('is_staff');

  if (status === 401 || error || isStaff !== true) {
    clearSession();
    window.location.href = './admin-login.html?denied=1';
    return null;
  }

  const { data: rows } = await selectRows('profiles', `id=eq.${session.user.id}&select=role,full_name`);
  const profile = rows && rows[0];

  return {
    user: session.user,
    role: profile?.role || 'admin',
    fullName: profile?.full_name || session.user.email,
  };
}

function adminLogout() {
  clearSession();
  window.location.href = './admin-login.html';
}
