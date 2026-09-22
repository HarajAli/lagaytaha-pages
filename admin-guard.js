// admin-guard.js
// حطه بأول كل صفحة إدارية (بعد سكربت supabase-js) — يتحقق إن الداخل
// فعلاً staff (admin/moderator/super_admin) عبر نفس دالة is_staff() المستخدمة
// أصلاً بنظام تليجرام الإداري، قبل ما يعرض أي محتوى.

const SUPABASE_URL = 'https://tnzxnjivkhyjijyotiog.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuenhuaml2a2h5amlqeW90aW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNTAxNzksImV4cCI6MjEwMjcyNjE3OX0.SGTRO7e6PcUq2MWYq8zVKkeC9yuiK5yvPLunlQz7oQs';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// يُستدعى من الصفحة نفسها بعد التحميل، ويرجّع { user, role } أو null (وبيكون رجّع المستخدم لصفحة الدخول)
async function requireAdmin() {
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

  // جلب الدور نفسه (admin / moderator / super_admin) لعرضه فقط —
  // profiles قابل للقراءة للجميع أصلاً (profiles_select: true)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', session.user.id)
    .single();

  // لو انتهت الجلسة لاحقًا وإنت باللوحة، رجّعه لتسجيل الدخول تلقائيًا
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
  await supabase.auth.signOut();
  window.location.href = './admin-login.html';
}
