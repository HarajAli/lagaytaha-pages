// يبني sitemap.xml ديناميكياً عند كل طلب — يشمل الصفحات الثابتة، كل
// الأقسام الرئيسية، وكل الإعلانات النشطة (تُجلب حياً من Supabase، فما
// يحتاج تحديث يدوي كل ما ينضاف إعلان جديد).

const SUPABASE_URL = 'https://tnzxnjivkhyjijyotiog.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4URJrD-YoQyrogg3YnBFkg_gXVIPder';
const SITE_URL = 'https://laqaytaha.com';

// الأقسام الرئيسية الثابتة (نفس القائمة المستخدمة بصفحة category.html)
const MAIN_CATEGORY_IDS = [1, 2, 3, 4, 5, 6, 7, 28];

function xmlEscape(str) {
  return String(str).replace(/&/g, '&amp;');
}

export async function onRequestGet() {
  const staticUrls = [
    { loc: `${SITE_URL}/`, changefreq: 'hourly', priority: '1.0' },
    { loc: `${SITE_URL}/search.html`, changefreq: 'daily', priority: '0.6' },
    { loc: `${SITE_URL}/login.html`, changefreq: 'monthly', priority: '0.3' },
    { loc: `${SITE_URL}/register.html`, changefreq: 'monthly', priority: '0.3' },
    { loc: `${SITE_URL}/privacy.html`, changefreq: 'yearly', priority: '0.2' },
    { loc: `${SITE_URL}/terms.html`, changefreq: 'yearly', priority: '0.2' },
    { loc: `${SITE_URL}/delete-account.html`, changefreq: 'yearly', priority: '0.2' },
  ];

  const categoryUrls = MAIN_CATEGORY_IDS.map((id) => ({
    loc: `${SITE_URL}/category.html?id=${id}`,
    changefreq: 'daily',
    priority: '0.7',
  }));

  let adUrls = [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ads?status=eq.active&select=id,created_at&order=created_at.desc&limit=5000`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (res.ok) {
      const ads = await res.json();
      adUrls = ads.map((ad) => ({
        loc: `${SITE_URL}/ad/${ad.id}`,
        lastmod: ad.created_at ? ad.created_at.slice(0, 10) : undefined,
        changefreq: 'weekly',
        priority: '0.8',
      }));
    }
  } catch (e) {
    // لو فشل جلب الإعلانات لأي سبب، نكمل بالصفحات الثابتة والأقسام فقط
    // بدل ما يفشل الـsitemap بالكامل.
  }

  const allUrls = [...staticUrls, ...categoryUrls, ...adUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${xmlEscape(u.loc)}</loc>
${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
