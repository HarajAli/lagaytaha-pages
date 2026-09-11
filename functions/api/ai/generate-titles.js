// ═══════════════════════════════════════════════════════════
// POST /api/ai/generate-titles
// المرحلة 1 — بدون نقاط، بدون اشتراكات، بس تجربة مجانية (2/feature)
// ═══════════════════════════════════════════════════════════

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const SUPABASE_URL = 'https://tnzxnjivkhyjijyotiog.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4URJrD-YoQyrogg3YnBFkg_gXVIPder';
const FEATURE = 'generate-titles';
const FREE_TRIAL_LIMIT = 2;
const RATE_LIMIT_PER_MINUTE = 5;

export async function onRequestPost(context) {
  const { request, env } = context;
  const startTime = Date.now();

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: 'يجب تسجيل الدخول' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });
    if (!userRes.ok) return json({ error: 'جلسة غير صالحة' }, 401);
    const user = await userRes.json();

    const svc = (path, opts = {}) => fetch(`${SUPABASE_URL}${path}`, {
      ...opts,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json',
        ...(opts.headers || {})
      }
    });

    const settingsRes = await svc(`/rest/v1/app_settings?key=eq.ai_enabled&select=value`);
    const settingsData = settingsRes.ok ? await settingsRes.json() : [];
    const aiEnabled = settingsData[0]?.value === 'true';
    if (!aiEnabled) {
      return json({ error: 'AI غير متاح مؤقتاً' }, 503);
    }

    const body = await request.json();
    const description = (body.description || '').trim();
    const category = (body.category || '').trim();
    const idempotencyKey = (body.idempotency_key || '').trim();

    if (!idempotencyKey) {
      return json({ error: 'idempotency_key مطلوب' }, 400);
    }
    if (description.length < 10) {
      return json({ error: 'الوصف قصير جداً (10 أحرف على الأقل)' }, 400);
    }
    if (description.length > 2000) {
      return json({ error: 'الوصف طويل جداً (2000 حرف كحد أقصى)' }, 400);
    }

    const idemRes = await svc(
      `/rest/v1/ai_idempotency?user_id=eq.${user.id}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=*`
    );
    const idemRows = idemRes.ok ? await idemRes.json() : [];
    const existing = idemRows[0];

    if (existing) {
      if (existing.status === 'pending') {
        return json({ error: 'الطلب قيد المعالجة بالفعل' }, 409);
      }
      if (existing.status === 'completed') {
        return json(existing.response, 200);
      }
      if (existing.status === 'failed') {
        return json({ error: 'فشل الطلب السابق، استخدم مفتاح جديد' }, 410);
      }
    }

    await svc(`/rest/v1/ai_idempotency`, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: user.id,
        idempotency_key: idempotencyKey,
        feature: FEATURE,
        status: 'pending'
      })
    });

    const markIdempotency = (status, response = null) =>
      svc(
        `/rest/v1/ai_idempotency?user_id=eq.${user.id}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status, response })
        }
      ).catch(() => {});

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const rateRes = await svc(
      `/rest/v1/ai_usage?user_id=eq.${user.id}&feature=eq.${FEATURE}&created_at=gte.${oneMinuteAgo}&select=id`
    );
    const rateRows = rateRes.ok ? await rateRes.json() : [];
    if (Array.isArray(rateRows) && rateRows.length >= RATE_LIMIT_PER_MINUTE) {
      await markIdempotency('failed');
      return json({ error: 'تجاوزت الحد المسموح، حاول بعد دقيقة' }, 429);
    }

    const usageRes = await svc(
      `/rest/v1/ai_usage?user_id=eq.${user.id}&feature=eq.${FEATURE}&status=eq.success&select=id`
    );
    const usageRows = usageRes.ok ? await usageRes.json() : [];
    if (Array.isArray(usageRows) && usageRows.length >= FREE_TRIAL_LIMIT) {
      await markIdempotency('failed');
      return json({ error: 'استنفدت المحاولات المجانية لهذه الميزة' }, 402);
    }

    const systemPrompt = `أنت مساعد متخصص في كتابة عناوين إعلانات الحراج في اليمن.
المستخدم كتب الوصف التالي:
"${description}"

الفئة: ${category || 'غير محددة'}

اقترح 3 عناوين جذابة لهذا الإعلان بحيث:
- كل عنوان أقل من 60 حرفاً.
- بدون معلومات مخترعة أو مبالغة.
- تعتمد فقط على ما ذُكر بالوصف.
- بنفس اللغة (عربية يمنية بسيطة).

أعد فقط قائمة العناوين الثلاثة، كل عنوان بسطر منفصل، بدون ترقيم أو شرح.`;

    let aiRes;
    try {
      aiRes = await fetchWithTimeout(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'اقترح العناوين' }
          ],
          max_tokens: 200,
          temperature: 0.8
        })
      }, 15000);
    } catch (e) {
      await markIdempotency('failed');
      await logUsage(svc, user.id, FEATURE, 'failed', Date.now() - startTime, 'timeout_or_network_error');
      return json({ error: 'تعذر الاتصال بالذكاء الاصطناعي، حاول لاحقاً' }, 502);
    }

    if (!aiRes.ok) {
      const errBody = await aiRes.text();
      await markIdempotency('failed');
      await logUsage(svc, user.id, FEATURE, 'failed', Date.now() - startTime, `deepseek_error: ${errBody.slice(0, 200)}`);
      return json({ error: 'تعذر الاتصال بالذكاء الاصطناعي، حاول لاحقاً' }, 502);
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      await markIdempotency('failed');
      await logUsage(svc, user.id, FEATURE, 'failed', Date.now() - startTime, 'empty_response');
      return json({ error: 'لم يتم استلام رد من الذكاء الاصطناعي' }, 502);
    }

    const titles = raw.split('\n').map(t => t.trim()).filter(Boolean).slice(0, 3);
    const u = aiData.usage || {};
    const responsePayload = { titles, tokens_used: u.total_tokens || 0 };

    await markIdempotency('completed', responsePayload);
    await logUsage(
      svc, user.id, FEATURE, 'success', Date.now() - startTime, null,
      u.prompt_tokens || 0, u.completion_tokens || 0, u.total_tokens || 0
    );

    return json(responsePayload);

  } catch (e) {
    return json({ error: 'حدث خطأ غير متوقع' }, 500);
  }
}

function fetchWithTimeout(url, opts, ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

async function logUsage(svc, userId, feature, status, latencyMs, errorMessage, inputTokens = 0, outputTokens = 0, totalTokens = 0) {
  return svc(`/rest/v1/ai_usage`, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      feature,
      status,
      latency_ms: latencyMs,
      error_message: errorMessage,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens
    })
  }).catch(() => {});
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
         }
