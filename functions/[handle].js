// صفحة الملف الشخصي العام على الرابط laqaytaha.com/@username
// — Cloudflare Pages Function.
//
// الملف يطابق أي مسار من مقطع واحد (/شيء)، لكنه يتعامل فقط مع المسارات
// التي تبدأ بـ @ ؛ أي مسار آخر (login.html، search.html…) يُمرَّر كما هو
// للملفات الثابتة عبر context.next() بدون أي تغيير.
//
// خصوصية: الصفحة لا تجلب ولا تعرض رقم الجوال أبداً.

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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(price, currency) {
  if (price == null) return 'السعر عند الاتصال';
  return Number(price).toLocaleString('en-US') + ' ' + (currency === 'YER' ? 'ريال' : (currency || ''));
}

// نسمح فقط بروابط http/https للصور (حماية من روابط javascript: وغيرها).
function safeUrl(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '';
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

const STYLE = `
  body{font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;margin:0;background:#f5f5f4;color:#222}
  .header{background:#0F6E56;color:#fff;padding:14px 16px;font-weight:700;font-size:18px}
  .header a{color:#fff;text-decoration:none}
  .container{max-width:640px;margin:0 auto;padding:0 0 28px}
  .card{background:#fff;margin:12px;padding:18px;border-radius:12px}
  .profile{display:flex;align-items:center;gap:14px}
  .avatar{width:72px;height:72px;border-radius:50%;background:#e5e5e5;object-fit:cover;flex:none;
          display:flex;align-items:center;justify-content:center;font-size:28px;color:#0F6E56;font-weight:800}
  .name{font-size:19px;font-weight:800;margin:0}
  .verified{color:#2563eb;font-size:14px;font-weight:700}
  .username{color:#777;font-size:13.5px;margin:2px 0 0;direction:ltr;text-align:right}
  .meta{color:#666;font-size:13px;margin-top:6px}
  .bio{white-space:pre-wrap;line-height:1.6;font-size:14.5px;margin:12px 0 0}
  .cta{display:flex;gap:10px;margin:12px}
  .btn{flex:1;text-align:center;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;display:block}
  .btn-primary{background:#0F6E56;color:#fff}
  .section{margin:18px 14px 8px;font-size:16px;font-weight:800}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 12px}
  .ad{background:#fff;border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;display:block}
  .ad .img{width:100%;aspect-ratio:4/3;background:#e5e5e5}
  .ad .img img{width:100%;height:100%;object-fit:cover;display:block}
  .ad .body{padding:10px}
  .ad .t{font-size:13.5px;font-weight:700;margin:0 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ad .p{font-size:13.5px;font-weight:800;color:#0F6E56;margin:0}
  .ad .c{font-size:12px;color:#777;margin:3px 0 0}
  .empty{text-align:center;color:#777;padding:28px 16px}
`;

function page({ title, description, canonical, image, robots, body, status }) {
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${robots}">
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ''}
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ''}
${canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}">` : ''}
<meta property="og:site_name" content="لقيتها">
<style>${STYLE}</style>
</head>
<body>
<div class="header"><a href="/">لقيتها</a></div>
<div class="container">
${body}
</div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': status === 200 ? 'public, max-age=120' : 'no-store',
    },
  });
}

function notFound() {
  return page({
    title: 'الحساب غير موجود - لقيتها',
    description: 'هذا الحساب غير موجود على لقيتها.',
    canonical: '',
    image: '',
    robots: 'noindex',
    status: 404,
    body: `<div class="card empty">
      <p style="font-size:17px;font-weight:800;color:#222;margin:0 0 6px">الحساب غير موجود</p>
      <p style="margin:0">تأكد من الرابط، أو تصفح أحدث الإعلانات.</p>
    </div>
    <div class="cta"><a class="btn btn-primary" href="/">الصفحة الرئيسية</a></div>`,
  });
}

export async function onRequest(context) {
  const { request, params } = context;

  let handle = '';
  try {
    handle = decodeURIComponent(String(params.handle || ''));
  } catch (e) {
    return context.next();
  }

  // أي مسار لا يبدأ بـ @ ليس لنا — نمرّره للملفات الثابتة كما هو.
  if (!handle.startsWith('@')) return context.next();
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next();

  const username = handle.slice(1);
  // أسماء المستخدمين: حروف إنجليزية وأرقام و _ و . فقط — هذا أيضاً يمنع
  // حقن أي رموز خاصة في استعلام قاعدة البيانات.
  if (!/^[A-Za-z0-9_.]{2,40}$/.test(username)) return notFound();

  let profile = null;
  let ads = [];
  try {
    const pattern = username.replace(/_/g, '\\_'); // _ حرف بدل في ilike
    const rows = await sbGet(
      'profiles?username=ilike.' + encodeURIComponent(pattern) +
      '&select=' + encodeURIComponent(
        'id,full_name,username,avatar_url,bio,is_verified,rating,ratings_count,created_at,cities(name_ar)') +
      '&limit=1');
    profile = rows.length ? rows[0] : null;

    if (profile) {
      ads = await sbGet(
        'ads?user_id=eq.' + encodeURIComponent(profile.id) +
        '&status=eq.active' +
        '&select=' + encodeURIComponent(
          'id,title,price,currency,created_at,ad_images(image_url,order_index),cities(name_ar)') +
        '&order=created_at.desc&limit=24');
    }
  } catch (e) {
    // فشل الاتصال بقاعدة البيانات — نعرض «غير موجود» بدل كسر الصفحة.
  }

  if (!profile) return notFound();

  const name = profile.full_name || profile.username;
  const avatar = safeUrl(profile.avatar_url);
  const city = profile.cities ? profile.cities.name_ar : '';
  const year = profile.created_at ? new Date(profile.created_at).getFullYear() : '';
  const rating = Number(profile.rating || 0);
  const ratingsCount = Number(profile.ratings_count || 0);
  const canonical = `${SITE_URL}/@${profile.username}`;

  const metaParts = [];
  if (city) metaParts.push(escapeHtml(city));
  if (year) metaParts.push('عضو منذ ' + escapeHtml(String(year)));
  if (ratingsCount > 0) metaParts.push('★ ' + rating.toFixed(1) + ' (' + ratingsCount + ')');

  const adsHtml = ads.length
    ? `<div class="grid">${ads.map((ad) => {
        const imgs = Array.isArray(ad.ad_images) ? ad.ad_images.slice() : [];
        imgs.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        const img = imgs.length ? safeUrl(imgs[0].image_url) : '';
        const adCity = ad.cities ? ad.cities.name_ar : '';
        return `<a class="ad" href="/ad/${escapeHtml(ad.id)}">
          <div class="img">${img ? `<img src="${escapeHtml(img)}" loading="lazy" alt="${escapeHtml(ad.title)}">` : ''}</div>
          <div class="body">
            <p class="t">${escapeHtml(ad.title)}</p>
            <p class="p">${escapeHtml(formatPrice(ad.price, ad.currency))}</p>
            ${adCity ? `<p class="c">${escapeHtml(adCity)}</p>` : ''}
          </div>
        </a>`;
      }).join('')}</div>`
    : `<div class="card empty">لا توجد إعلانات نشطة حالياً.</div>`;

  const body = `
    <div class="card">
      <div class="profile">
        ${avatar
          ? `<img class="avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}">`
          : `<div class="avatar">${escapeHtml(String(name).trim().charAt(0) || '؟')}</div>`}
        <div style="min-width:0">
          <p class="name">${escapeHtml(name)} ${profile.is_verified ? '<span class="verified">✔ موثّق</span>' : ''}</p>
          <p class="username">@${escapeHtml(profile.username)}</p>
          ${metaParts.length ? `<div class="meta">${metaParts.join(' · ')}</div>` : ''}
        </div>
      </div>
      ${profile.bio ? `<p class="bio">${escapeHtml(profile.bio)}</p>` : ''}
    </div>
    <div class="cta">
      <a class="btn btn-primary" href="${PLAY_STORE_URL}">تواصل معه عبر تطبيق لقيتها</a>
    </div>
    <div class="section">الإعلانات (${ads.length})</div>
    ${adsHtml}`;

  return page({
    title: `${name} (@${profile.username}) - لقيتها`,
    description: profile.bio
      ? String(profile.bio).slice(0, 150)
      : `تصفح إعلانات ${name} على لقيتها — سوق اليمن المفتوح.`,
    canonical,
    image: avatar,
    robots: 'index,follow',
    status: 200,
    body,
  });
}
