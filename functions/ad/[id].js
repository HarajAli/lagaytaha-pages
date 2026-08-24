// صفحة إعلان ديناميكية — تُعرَض من جهة الخادم (Server-Side) عبر
// Cloudflare Pages Functions، مو JavaScript بالمتصفح — عشان جوجل يقدر
// يفهرس محتوى كل إعلان فعلياً (عنوان/وصف/صورة حقيقية بالـHTML الأصلي).
//
// يجيب البيانات مباشرة من نفس مشروع Supabase اللي يستخدمه التطبيق
// (بمفتاح anon العام، آمن — نفس المفتاح المستخدم داخل التطبيق نفسه).

const SUPABASE_URL = 'https://tnzxnjivkhyjijyotiog.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4URJrD-YoQyrogg3YnBFkg_gXVIPder';
const SITE_URL = 'https://laqaytaha.com';
// رابط متجر Play الفعلي — عدّله فور نشر التطبيق رسمياً.
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.laqaytaha.market';

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrice(price, currency) {
  if (price == null) return 'السعر عند الاتصال';
  const formatted = Number(price).toLocaleString('en-US');
  return `${formatted} ${currency === 'YER' ? 'ر.ي' : currency}`;
}

const STATUS_LABELS = {
  active: null,
  sold: 'تم بيع هذا الإعلان.',
  expired: 'هذا الإعلان انتهت صلاحيته.',
  draft: 'هذا الإعلان غير منشور بعد.',
};

export async function onRequestGet(context) {
  const { params } = context;
  const adId = params.id;

  const selectFields =
    'id,title,description,price,currency,condition,status,created_at,' +
    'ad_images(image_url,order_index),' +
    'profiles!ads_user_id_fkey(full_name,username,is_verified),' +
    'cities(name_ar)';

  const apiUrl =
    `${SUPABASE_URL}/rest/v1/ads?id=eq.${encodeURIComponent(adId)}&select=${encodeURIComponent(selectFields)}`;

  let ad = null;
  try {
    const res = await fetch(apiUrl, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      ad = data && data.length > 0 ? data[0] : null;
    }
  } catch (e) {
    // فشل الاتصال — نعرض صفحة "غير موجود" بدل كسر الصفحة بالكامل.
  }

  if (!ad || ad.status === 'deleted') {
    return new Response(notFoundHtml(), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const images = (ad.ad_images || []).sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
  );
  const mainImage = images.length > 0 ? images[0].image_url : `${SITE_URL}/og-default.jpg`;
  const seller = ad.profiles || {};
  const cityName = ad.cities ? ad.cities.name_ar : null;
  const statusMessage = STATUS_LABELS[ad.status] || null;
  const priceText = formatPrice(ad.price, ad.currency);
  const canonicalUrl = `${SITE_URL}/ad/${encodeURIComponent(adId)}`;
  const description = ad.description
    ? ad.description.slice(0, 160)
    : `${ad.title} - ${priceText} على لقيتها، سوق اليمن المفتوح.`;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(ad.title)} - لقيتها</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:type" content="product">
<meta property="og:title" content="${escapeHtml(ad.title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(mainImage)}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:site_name" content="لقيتها">
<style>
  body{font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;margin:0;background:#f5f5f4;color:#222}
  .header{background:#0F6E56;color:#fff;padding:14px 16px;font-weight:700;font-size:18px}
  .container{max-width:640px;margin:0 auto;padding:0 0 24px}
  .gallery{width:100%;aspect-ratio:4/3;background:#e5e5e5;overflow:hidden}
  .gallery img{width:100%;height:100%;object-fit:cover;display:block}
  .card{background:#fff;margin:12px;padding:16px;border-radius:12px}
  .title{font-size:20px;font-weight:700;margin:0 0 6px}
  .price{font-size:22px;font-weight:800;color:#0F6E56;margin:0 0 8px}
  .meta{color:#777;font-size:13px;margin-bottom:12px}
  .status-banner{background:#333;color:#fff;padding:10px 16px;text-align:center;font-weight:600}
  .desc{white-space:pre-wrap;line-height:1.6;font-size:14.5px}
  .seller{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;margin-top:8px}
  .cta{display:flex;gap:10px;margin:12px}
  .btn{flex:1;text-align:center;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;display:block}
  .btn-primary{background:#0F6E56;color:#fff}
  .btn-outline{background:#fff;color:#0F6E56;border:1.5px solid #0F6E56}
  .disclaimer{margin:12px;padding:12px;background:#fff8e6;border-radius:10px;font-size:12.5px;color:#7a5c00;line-height:1.6}
</style>
</head>
<body>
<div class="header">لقيتها — سوق اليمن المفتوح</div>
${statusMessage ? `<div class="status-banner">${escapeHtml(statusMessage)}</div>` : ''}
<div class="container">
  <div class="gallery"><img src="${escapeHtml(mainImage)}" alt="${escapeHtml(ad.title)}"></div>
  <div class="card">
    <p class="title">${escapeHtml(ad.title)}</p>
    <p class="price">${escapeHtml(priceText)}</p>
    <p class="meta">${cityName ? escapeHtml(cityName) : ''}</p>
    ${ad.description ? `<div class="desc">${escapeHtml(ad.description)}</div>` : ''}
    <div class="seller">${escapeHtml(seller.full_name || 'مستخدم')}${seller.is_verified ? ' ✓' : ''}</div>
  </div>
  <div class="cta">
    <a class="btn btn-primary" href="${canonicalUrl}">فتح في تطبيق لقيتها</a>
    <a class="btn btn-outline" href="${PLAY_STORE_URL}">تحميل التطبيق</a>
  </div>
  <div class="disclaimer">
    تنبيه: لقيتها منصة إعلانات وتواصل، وليست طرفاً في عملية البيع أو
    الدفع أو التوصيل. احرص على التحقق من السلعة والطرف الآخر قبل الدفع.
  </div>
</div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function notFoundHtml() {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>الإعلان غير موجود - لقيتها</title></head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:60px 20px;color:#444">
<h2>هذا الإعلان غير موجود أو أُزيل</h2>
<p><a href="${SITE_URL}" style="color:#0F6E56">العودة للرئيسية</a></p>
</body></html>`;
}
