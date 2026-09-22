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

// ===== عناصر واجهة مشتركة بين كل صفحات لوحة الإدارة =====

const NAV_ITEMS = [
  { key: 'dashboard',    href: './admin-dashboard.html',    icon: '🏠', label: 'لوحة التحكم' },
  { key: 'ads',          href: './admin-ads.html',          icon: '🗂️', label: 'الإعلانات' },
  { key: 'users',        href: './admin-users.html',        icon: '👥', label: 'المستخدمون' },
  { key: 'reports',      href: './admin-reports.html',      icon: '🚩', label: 'البلاغات' },
  { key: 'verification', href: './admin-verification.html', icon: '⭐', label: 'التوثيق والتقييمات' },
  { key: 'points',       href: './admin-points.html',       icon: '🪙', label: 'النقاط والباقات' },
  { key: 'settings',     href: './admin-settings.html',     icon: '⚙️', label: 'الإعدادات' },
];

function renderSidebar(activeKey) {
  const items = NAV_ITEMS.map(it =>
    `<a href="${it.href}"${it.key === activeKey ? ' class="active"' : ''}>${it.icon} ${it.label}</a>`
  ).join('');
  return `
    <div class="sidebar">
      <div class="brand">
        <div class="icon">🔍</div>
        <div class="name">لقيتها<small>Laqaytaha Admin</small></div>
      </div>
      <div class="nav">
        ${items}
        <div style="height:1px; background:rgba(255,255,255,.08); margin:10px 16px;"></div>
        <a href="#" class="disabled">🕓 سجل العمليات <span class="soon">قريباً</span></a>
        <a href="#" class="disabled">🔐 الصلاحيات <span class="soon">قريباً</span></a>
      </div>
      <div class="footer">
        <button onclick="adminLogout()">↩ تسجيل الخروج</button>
      </div>
    </div>`;
}

function renderTopbar(title, subtitle) {
  return `
    <div class="topbar">
      <div style="display:flex; align-items:center;">
        <button class="hamburger-btn" onclick="toggleSidebar()" aria-label="القائمة">☰</button>
        <div>
          <h2>${title}</h2>
          <div class="subtitle">${subtitle || 'لقيتها — سوق اليمن المفتوح'}</div>
        </div>
      </div>
      <div class="who">
        <div class="avatar" id="avatarLetter">أ</div>
        <div>
          <div style="font-size:13px; font-weight:700;" id="userName">—</div>
          <div class="role" id="userRole">—</div>
        </div>
      </div>
    </div>`;
}

// ===== التحكم بالقائمة الجانبية على الجوال (تظهر/تختفي كقائمة منسدلة) =====
function openSidebar() {
  document.querySelector('.sidebar')?.classList.add('open');
  document.getElementById('sidebarOverlay')?.classList.add('open');
}
function closeSidebar() {
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}
function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  if (!sb) return;
  sb.classList.contains('open') ? closeSidebar() : openSidebar();
}

function fillUserInfo(result) {
  document.getElementById('userName').textContent = result.fullName;
  document.getElementById('userRole').textContent =
    result.role === 'super_admin' ? 'مدير عام' : (result.role === 'admin' ? 'مدير' : 'مشرف');
  document.getElementById('avatarLetter').textContent = (result.fullName || 'أ')[0].toUpperCase();
}

// روابط ملفات bucket خاص (verification-docs, payment-receipts) تحتاج توقيع مؤقت
async function getSignedUrl(bucket, path, expiresIn = 300) {
  const res = await apiFetch(`/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.signedURL) return null;
  return data.signedURL.startsWith('http') ? data.signedURL : SUPABASE_URL + '/storage/v1' + data.signedURL;
}

async function openSignedFile(bucket, path) {
  const url = await getSignedUrl(bucket, path);
  if (!url) { alert('تعذّر فتح الملف'); return; }
  window.open(url, '_blank', 'noopener');
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

// يهيّئ الصفحة: يتحقق من الصلاحية، يركّب القائمة الجانبية والشريط العلوي،
// ويرجّع { user, role, fullName } أو null (وبيكون رجّع المستخدم لصفحة الدخول)
async function bootAdminPage(activeKey, title, subtitle) {
  const result = await requireAdmin();
  if (!result) return null;

  document.getElementById('sidebarSlot').outerHTML = renderSidebar(activeKey);
  document.getElementById('topbarSlot').outerHTML = renderTopbar(title, subtitle);
  fillUserInfo(result);

  // طبقة تعتيم خلف القائمة الجانبية على الجوال — تُغلق القائمة عند الضغط عليها
  if (!document.getElementById('sidebarOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    overlay.className = 'sidebar-overlay';
    overlay.onclick = closeSidebar;
    document.body.appendChild(overlay);
  }
  // إغلاق القائمة تلقائيًا عند الضغط على أي رابط تنقّل بالجوال
  document.querySelectorAll('.sidebar .nav a:not(.disabled)').forEach(a => {
    a.addEventListener('click', closeSidebar);
  });

  document.getElementById('accessDenied').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  return result;
}
