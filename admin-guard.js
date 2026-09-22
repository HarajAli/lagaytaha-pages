// admin-guard.js
// حطه بأول كل صفحة إدارية (بدون الحاجة لسكربت supabase-js منفصل — هذا الملف
// يحمّل المكتبة بنفسه مع مصدر احتياطي لو فشل المصدر الأساسي) — يتحقق إن
// الداخل فعلاً staff (admin/moderator/super_admin) عبر is_staff() الحقيقية
// قبل ما يعرض أي محتوى.

const SUPABASE_URL = 'https://tnzxnjivkhyjijyotiog.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuenhuaml2a2h5amlqeW90aW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNTAxNzksImV4cCI6MjEwMjcyNjE3OX0.SGTRO7e6PcUq2MWYq8zVKkeC9yuiK5yvPLunlQz7oQs';

let supabase = null;

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function _ensureSupabaseLib() {
  if (typeof window.supabase !== 'undefined') return;
  try {
    await _loadScript('https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js');
  } catch (e) {
    await _loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js');
  }
}

// يُستدعى من الصفحة نفسها بعد تحميل الـ DOM، ويرجّع { user, role, fullName } أو null
async function requireAdmin() {
  try {
    await _ensureSupabaseLib();
  } catch (e) {
    document.body.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
      'font-family:sans-serif;color:#E24C4C;font-weight:700;text-align:center;padding:20px;">' +
      'تعذّر تحميل مكتبة النظام — تحقق من اتصال الإنترنت وأعد فتح الصفحة</div>';
    return null;
  }

  if (!supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = './admin-login.html';
    return null;
  }

  const { data: isStaff, error: staffErr } = await supabase.rpc('is_staff');

  if (staffErr || !isStaff) {
    await supabase.auth.signOut();
    window.location.href = './admin-login.html?denied=1';
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', session.user.id)
    .single();

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = './admin-login.html';
  });

  return {
    user: session.user,
    role: profile?.role || 'admin',
    fullName: profile?.full_name || session.user.email,
  };
}

async function adminLogout() {
  if (supabase) await supabase.auth.signOut();
  window.location.href = './admin-login.html';
}
