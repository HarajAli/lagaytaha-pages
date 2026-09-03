// نسخة SSR من الصفحة الرئيسية — Cloudflare Pages Function، مو ملف
// ثابت. تجيب الإعلانات المميزة والأحدث من Supabase وقت الطلب وتبنيها
// بالـHTML الأصلي مباشرة، فمحركات البحث تشوف المحتوى الحقيقي فوراً
// بدل ما تعتمد على جافاسكربت يشتغل بالمتصفح بعد التحميل.

const SUPABASE_URL = 'https://tnzxnjivkhyjijyotiog.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4URJrD-YoQyrogg3YnBFkg_gXVIPder';
const SITE_URL = 'https://laqaytaha.com';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.laqaytaha.market';

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return 'منذ ' + Math.max(1, Math.floor(diff / 60)) + ' دقيقة';
  if (diff < 86400) return 'منذ ' + Math.floor(diff / 3600) + ' ساعة';
  return 'منذ ' + Math.floor(diff / 86400) + ' يوم';
}

function formatPrice(price, currency) {
  if (price == null) return 'السعر عند الاتصال';
  const f = Number(price).toLocaleString('en-US');
  return f + ' ' + (currency === 'YER' ? 'ريال' : currency);
}

function adCardHtml(ad) {
  const img =
    ad.ad_images && ad.ad_images.length
      ? ad.ad_images.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0].image_url
      : '';
  const city = ad.cities ? ad.cities.name_ar : '';
  return `<a class="ad-card" href="/ad/${escapeHtml(ad.id)}">
    <div class="img-wrap">
      ${ad.is_featured ? '<span class="badge-featured">مميز</span>' : ''}
      ${img ? `<img src="${escapeHtml(img)}" loading="lazy" alt="${escapeHtml(ad.title)}">` : ''}
    </div>
    <div class="ad-body">
      <p class="ad-title">${escapeHtml(ad.title)}</p>
      <p class="ad-city">${escapeHtml(city)}</p>
      <p class="ad-price">${escapeHtml(formatPrice(ad.price, ad.currency))}</p>
      <p class="ad-time">${escapeHtml(timeAgo(ad.created_at))}</p>
    </div>
  </a>`;
}

async function fetchAds(url) {
  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

export async function onRequestGet() {
  const fields =
    'id,title,price,currency,is_featured,created_at,ad_images(image_url,order_index),cities(name_ar)';

  const [featured, latest] = await Promise.all([
    fetchAds(
      `${SUPABASE_URL}/rest/v1/ads?status=eq.active&is_featured=eq.true&select=${encodeURIComponent(fields)}&order=created_at.desc&limit=4`
    ),
    fetchAds(
      `${SUPABASE_URL}/rest/v1/ads?status=eq.active&select=${encodeURIComponent(fields)}&order=created_at.desc&limit=8`
    ),
  ]);

  const featuredHtml = featured.length
    ? featured.map(adCardHtml).join('')
    : '<div class="empty-note">لا توجد إعلانات مميزة حالياً</div>';
  const latestHtml = latest.length
    ? latest.map(adCardHtml).join('')
    : '<div class="empty-note">لا توجد إعلانات حالياً</div>';

  // بيانات هيكلية (Organization + ItemList) — تساعد جوجل يفهم هوية
  // الموقع وقائمة الإعلانات المعروضة بالرئيسية.
  const itemListData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: latest.map((ad, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/ad/${ad.id}`,
    })),
  };
  const orgData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'لقيتها',
    url: SITE_URL,
    description: 'السوق الأول للإعلانات المبوبة في اليمن',
  };

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>لقيتها — سوق اليمن المفتوح</title>
<meta name="description" content="لقيتها: السوق الأول للإعلانات المبوبة في اليمن. سيارات، عقارات، جوالات، إلكترونيات، أثاث والمزيد.">
<link rel="canonical" href="${SITE_URL}/">
<meta property="og:type" content="website">
<meta property="og:title" content="لقيتها — سوق اليمن المفتوح">
<meta property="og:description" content="السوق الأول للإعلانات المبوبة في اليمن. بيع، اشترِ، واكتشف كل ما تبحث عنه.">
<meta property="og:url" content="${SITE_URL}/">
<script type="application/ld+json">${JSON.stringify(orgData)}</script>
<script type="application/ld+json">${JSON.stringify(itemListData)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
  :root{
    --green:#0F6E56;
    --green-dark:#0b5443;
    --bg:#f5f5f4;
    --card:#ffffff;
    --text:#1e1e1e;
    --muted:#777;
    --border:#eceae7;
  }
  *{box-sizing:border-box}
  body{font-family:'Tajawal',system-ui,sans-serif;margin:0;background:var(--bg);color:var(--text)}
  a{text-decoration:none;color:inherit}
  .wrap{max-width:1180px;margin:0 auto;padding:0 16px}

  header.site{background:#fff;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:20}
  .header-inner{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;max-width:1180px;margin:0 auto;gap:10px}
  .logo{font-weight:800;font-size:20px;color:var(--green)}
  .logo span{display:block;font-size:11px;font-weight:400;color:var(--muted)}
  .nav-links{display:none}
  @media(min-width:860px){.nav-links{display:flex;gap:22px;font-size:14px;font-weight:500}}
  .header-right{display:flex;align-items:center;gap:10px}
  .header-cta{background:var(--green);color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:700;white-space:nowrap}
  .login-link{font-size:13px;font-weight:700;color:var(--green);white-space:nowrap}
  .user-chip{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;cursor:pointer;background:none;border:none;font-family:inherit;padding:6px 4px;border-radius:8px}
  .user-chip:hover{background:var(--bg)}
  .user-avatar{width:28px;height:28px;border-radius:50%;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;overflow:hidden}
  .user-avatar img{width:100%;height:100%;object-fit:cover;display:block}
  .account-menu-wrap{position:relative}
  .account-dropdown{
    position:absolute;top:calc(100% + 8px);left:0;background:#fff;border:1px solid var(--border);
    border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);min-width:190px;padding:6px;z-index:30;
    display:none
  }
  .account-dropdown.show{display:block}
  .account-dropdown a,.account-dropdown button{
    display:flex;align-items:center;gap:10px;width:100%;text-align:right;padding:10px 12px;border-radius:8px;
    font-family:inherit;font-size:13.5px;font-weight:600;color:var(--text);background:none;border:none;cursor:pointer
  }
  .account-dropdown a:hover,.account-dropdown button:hover{background:var(--bg)}
  .account-dropdown .logout-item{color:#c0392b;border-top:1px solid var(--border);margin-top:4px;padding-top:10px}
  .logout-btn{font-size:12px;color:#c0392b;font-weight:700;background:none;border:none;cursor:pointer;font-family:inherit}

  .hero{background:var(--green);color:#fff;border-radius:0 0 20px 20px;padding:28px 16px 32px}
  .hero-inner{max-width:1180px;margin:0 auto}
  .hero h1{font-size:26px;margin:0 0 6px;font-weight:800}
  .hero p{opacity:.92;margin:0 0 18px;font-size:14px;line-height:1.7}
  .search-box{background:#fff;border-radius:12px;padding:6px;display:flex;gap:6px;max-width:640px}
  .search-box input{flex:1;border:none;outline:none;padding:10px 12px;font-family:inherit;font-size:14px;border-radius:8px}
  .search-box button{background:var(--green);color:#fff;border:none;border-radius:8px;padding:0 18px;font-weight:700;cursor:pointer}
  .trust-row{display:flex;gap:24px;margin-top:20px;flex-wrap:wrap}
  .trust-item{display:flex;align-items:center;gap:8px;font-size:12.5px;opacity:.95}

  .section{padding:28px 16px 8px}
  .section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
  .section-head h2{font-size:18px;margin:0;font-weight:800}
  .section-head a{font-size:13px;color:var(--green);font-weight:700}

  .cat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  @media(min-width:640px){.cat-grid{grid-template-columns:repeat(8,1fr)}}
  .cat-card{background:var(--card);border-radius:12px;padding:16px 8px;text-align:center;border:1px solid var(--border)}
  .cat-card .icon{font-size:26px;margin-bottom:6px}
  .cat-card .name{font-size:12.5px;font-weight:600}

  .ad-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
  @media(min-width:640px){.ad-grid{grid-template-columns:repeat(4,1fr)}}
  .ad-card{background:var(--card);border-radius:12px;overflow:hidden;border:1px solid var(--border);position:relative}
  .ad-card .img-wrap{aspect-ratio:4/3;background:#e5e5e5;overflow:hidden;position:relative}
  .ad-card img{width:100%;height:100%;object-fit:cover;display:block}
  .badge-featured{position:absolute;top:8px;right:8px;background:#f2a900;color:#fff;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:6px}
  .ad-body{padding:10px}
  .ad-title{font-size:13.5px;font-weight:700;margin:0 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ad-city{font-size:11.5px;color:var(--muted);margin:0 0 6px}
  .ad-price{font-size:14.5px;font-weight:800;color:var(--green)}
  .ad-time{font-size:10.5px;color:#999;margin-top:4px}

  .cta-band{margin:28px 16px;background:#fff;border:1px solid var(--border);border-radius:16px;padding:24px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
  .cta-band h3{margin:0 0 4px;font-size:16px}
  .cta-band p{margin:0;font-size:13px;color:var(--muted)}
  .cta-btn{background:var(--green);color:#fff;padding:10px 20px;border-radius:10px;font-weight:700;font-size:13.5px;white-space:nowrap}

  footer{margin-top:20px;padding:28px 16px;text-align:center;font-size:12.5px;color:var(--muted);border-top:1px solid var(--border)}
  footer a{color:var(--green);margin:0 6px}

  .empty-note{grid-column:1/-1;text-align:center;color:var(--muted);font-size:13px;padding:20px 0}
</style>
</head>
<body>

<header class="site">
  <div class="header-inner">
    <div class="logo">لقيتها<span>سوق اليمن المفتوح</span></div>
    <nav class="nav-links">
      <a href="/">الرئيسية</a>
      <a href="/#featured">المميزة</a>
      <a href="/#latest">الأحدث</a>
    </nav>
    <div class="header-right" id="authArea">
      <a class="login-link" href="/login">تسجيل الدخول</a>
      <a class="header-cta" href="${PLAY_STORE_URL}">حمّل التطبيق</a>
    </div>
  </div>
</header>

<section class="hero">
  <div class="hero-inner">
    <h1>لقيتها — سوق اليمن المفتوح</h1>
    <p>اشترِ، بيع، واكتشف كل ما تبحث عنه في اليمن. سيارات، عقارات، جوالات، إلكترونيات، أثاث والمزيد.</p>
    <div class="search-box">
      <input id="searchInput" type="text" placeholder="ابحث عن سيارة، جوال، شقة، وأكثر...">
      <button onclick="doSearch()">بحث</button>
    </div>
    <div class="trust-row">
      <div class="trust-item">🛡️ آمن وموثوق</div>
      <div class="trust-item">⚡ سهل وسريع</div>
      <div class="trust-item">🎁 نشر الإعلانات مجاني</div>
    </div>
  </div>
</section>

<section class="section">
  <div class="section-head"><h2>تصفح الأقسام</h2></div>
  <div class="cat-grid">
    <a class="cat-card" href="/category.html?id=1"><div class="icon">🚗</div><div class="name">سيارات</div></a>
    <a class="cat-card" href="/category.html?id=2"><div class="icon">🏠</div><div class="name">عقارات</div></a>
    <a class="cat-card" href="/category.html?id=15"><div class="icon">📱</div><div class="name">جوالات</div></a>
    <a class="cat-card" href="/category.html?id=5"><div class="icon">🛋️</div><div class="name">أثاث ومفروشات</div></a>
    <a class="cat-card" href="/category.html?id=7"><div class="icon">💼</div><div class="name">وظائف وأعمال</div></a>
    <a class="cat-card" href="/category.html?id=3"><div class="icon">🎧</div><div class="name">إلكترونيات</div></a>
    <a class="cat-card" href="/category.html?id=6"><div class="icon">👗</div><div class="name">ملابس وأزياء</div></a>
    <a class="cat-card" href="${PLAY_STORE_URL}"><div class="icon">•••</div><div class="name">المزيد</div></a>
  </div>
</section>

<section class="section" id="featured">
  <div class="section-head"><h2>إعلانات مميزة</h2></div>
  <div class="ad-grid" id="featuredGrid">${featuredHtml}</div>
</section>

<section class="section" id="latest">
  <div class="section-head"><h2>أحدث الإعلانات</h2></div>
  <div class="ad-grid" id="latestGrid">${latestHtml}</div>
</section>

<div class="cta-band">
  <div>
    <h3>عندك شيء للبيع؟</h3>
    <p>أضف إعلانك الآن ووصل لآلاف المشترين في جميع أنحاء اليمن.</p>
  </div>
  <a class="cta-btn" href="/post-ad">أضف إعلانك مجاناً</a>
</div>

<footer>
  <div>
    <a href="/privacy">الخصوصية</a> ·
    <a href="/terms">الشروط</a> ·
    <a href="/delete-account">حذف الحساب</a>
  </div>
  <div style="margin-top:10px">© 2026 لقيتها. جميع الحقوق محفوظة.</div>
</footer>

<script>
function escapeHtml(s){
  if(s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function renderAuthArea(){
  const el = document.getElementById('authArea');
  const raw = localStorage.getItem('laqaytaha_session');
  if(!raw) return; // الحالة الافتراضية (زر دخول) مرسومة أصلاً من السيرفر
  try{
    const session = JSON.parse(raw);
    const name = (session.user && session.user.user_metadata && session.user.user_metadata.full_name) || (session.user && session.user.email) || 'حسابي';
    const initial = escapeHtml(name[0] || 'م');
    const avatarUrl = session.user && session.user.user_metadata && session.user.user_metadata.avatar_url;
    el.innerHTML = \`
      <div class="account-menu-wrap">
        <button class="user-chip" id="accountMenuBtn" type="button">
          <div class="user-avatar">\${avatarUrl ? '<img src="'+escapeHtml(avatarUrl)+'">' : initial}</div>
          <span>\${escapeHtml(name.split(' ')[0])}</span>
        </button>
        <div class="account-dropdown" id="accountDropdown">
          <a href="/profile">👤 الملف الشخصي</a>
          <a href="/my-ads">📢 إعلاناتي</a>
          <a href="/messages">📬 الرسائل</a>
          <a href="/settings">⚙️ الإعدادات</a>
          <button type="button" class="logout-item" onclick="doLogout()">🚪 تسجيل الخروج</button>
        </div>
      </div>\`;

    const btn = document.getElementById('accountMenuBtn');
    const dropdown = document.getElementById('accountDropdown');
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', function(e){
      if(!e.target.closest('.account-menu-wrap')){
        dropdown.classList.remove('show');
      }
    });
  }catch(e){
    localStorage.removeItem('laqaytaha_session');
  }
}
function doLogout(){
  localStorage.removeItem('laqaytaha_session');
  window.location.reload();
}
renderAuthArea();

function doSearch(){
  const q = document.getElementById('searchInput').value.trim();
  if(q) window.location.href = '/search.html?q=' + encodeURIComponent(q);
}
document.getElementById('searchInput').addEventListener('keydown', function(e){
  if(e.key === 'Enter') doSearch();
});
</script>

</body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
