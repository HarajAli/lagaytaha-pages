// ═══════════════════════════════════════════════════════════
// POST /api/ai/enhance-description
// المرحلة 1 — بدون نقاط، بدون اشتراكات، بس تجربة مجانية (2/feature)
// ═══════════════════════════════════════════════════════════

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const SUPABASE_URL = 'https://tnzxnjivkhyjijyotiog.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4URJrD-YoQyrogg3YnBFkg_gXVIPder';
const FEATURE = 'enhance-description';
const FREE_TRIAL_LIMIT = 2;
const RATE_LIMIT_PER_MINUTE = 5;

export async function onRequestPost(context) {
  const { request, env } = context;
  const startTime = Date.now();

  try {
    // ── 1) Authentication ──────────────────────────────────
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

    // service_role key للعمليات الداخلية (تسجيل usage / idempotency)
    const svc = (path, opts = {}) => fetch(`${SUPABASE_URL}${path}`, {
      ...opts,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json',
        ...(opts.headers || {})
      }
    });

    // ── 2) Feature Enabled (Kill Switch) ───────────────────
    const settingsRes = await svc(`/rest/v1/app_settings?key=eq.ai_enabled&select=value`);
    const settingsData = settingsRes.ok ? await settingsRes.json() : [];
    const aiEnabled = settingsData[0]?.value === 'true';
    if (!aiEnabled) {
      return json({ error: 'AI غير متاح مؤقتاً' }, 503);
    }

    // ── 3) قراءة المدخلات ────────────────────────────────
    const body = await request.json();
    const description = (body.description || '').trim();
    const category = (body.category || '').trim();
    const idempotencyKey = (body.idempotency_key || '').trim();

    if (!idempotencyKey) {
      return json({ error: 'idempotency_key مطلوب' }, 400);
    }
    if (description.length < 2) {
      return json({ error: 'اكتب كلمة أو أكثر أولاً' }, 400);
    }
    if (description.length > 2000) {
      return json({ error: 'الوصف طويل جداً (2000 حرف كحد أقصى)' }, 400);
    }

    // ── 4) Idempotency Check ────────────────────────────────
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

    // إنشاء سجل pending جديد
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

    // ── 5) Rate Limit (5 طلبات/دقيقة لكل مستخدم لكل feature) ─
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const rateRes = await svc(
      `/rest/v1/ai_usage?user_id=eq.${user.id}&feature=eq.${FEATURE}&created_at=gte.${oneMinuteAgo}&select=id`
    );
    const rateRows = rateRes.ok ? await rateRes.json() : [];
    if (Array.isArray(rateRows) && rateRows.length >= RATE_LIMIT_PER_MINUTE) {
      await markIdempotency('failed');
      return json({ error: 'تجاوزت الحد المسموح، حاول بعد دقيقة' }, 429);
    }

    // ── 6) Free Trial (2 محاولات ناجحة لكل feature) ─────────
    const usageRes = await svc(
      `/rest/v1/ai_usage?user_id=eq.${user.id}&feature=eq.${FEATURE}&status=eq.success&select=id`
    );
    const usageRows = usageRes.ok ? await usageRes.json() : [];
    if (Array.isArray(usageRows) && usageRows.length >= FREE_TRIAL_LIMIT) {
      await markIdempotency('failed');
      return json({ error: 'استنفدت المحاولات المجانية لهذه الميزة' }, 402);
    }

    // ── 7) استدعاء DeepSeek ─────────────────────────────────
    const systemPrompt = `أنت مساعد متخصص في كتابة إعلانات جذابة لمنصة الحراج في اليمن.
المستخدم كتب النص التالي عن سلعته (قد يكون كلمة واحدة أو وصفاً كاملاً):
"${description}"

الفئة: ${category || 'غير محددة'}

مهمتك: حوّل هذا النص إلى إعلان جذاب واحترافي بنفس أسلوب إعلانات السوشيال ميديا، بحيث:
- ابدأ بسطر عنوان قصير وجذاب (يمكن استخدام إيموجي مناسب واحد في البداية).
- رتب المعلومات المذكورة فقط (لا غيرها) كنقاط، كل نقطة بإيموجي بسيط مناسب لها.
- إذا ذُكرت الحالة أو السعر أو أي تفصيل، رتبه كنقطة منفصلة بنفس المعلومة بالضبط دون تغييرها.
- اختم بجملة قصيرة تشجع على التواصل (مثل "للتواصل والاستفسار يرجى المراسلة").
- استخدم لغة عربية بسيطة وحماسية.

قيود صارمة يجب الالتزام بها دائماً:
- ممنوع منعاً باتاً إضافة أي مواصفة أو رقم أو موديل أو ميزة أو حالة أو سعر أو ضمان أو سبب بيع لم يذكره المستخدم صراحة.
- إذا كان النص المُدخل كلمة أو كلمتين فقط بدون تفاصيل إضافية، اكتب إعلاناً حماسياً قصيراً حول نفس الكلمات المذكورة فقط، دون اختراع أي مواصفة تقنية أو موديل فرعي غير مذكور (مثال: "ايفون 17" يجب أن يبقى "ايفون 17" ولا يتحول إلى "ايفون 17 برو" أو "برو ماكس").
- لا تتجاوز 100 كلمة إجمالاً.

أعد فقط نص الإعلان النهائي، بدون أي مقدمة أو شرح.`;

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
            { role: 'user', content: 'حسّن الوصف' }
          ],
          max_tokens: 400,
          temperature: 0.7
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
    const enhanced = aiData.choices?.[0]?.message?.content?.trim();
    if (!enhanced) {
      await markIdempotency('failed');
      await logUsage(svc, user.id, FEATURE, 'failed', Date.now() - startTime, 'empty_response');
      return json({ error: 'لم يتم استلام رد من الذكاء الاصطناعي' }, 502);
    }

    const u = aiData.usage || {};
    const responsePayload = { enhanced, tokens_used: u.total_tokens || 0 };

    // ── 8) Finalize: تسجيل النجاح + تحديث Idempotency ───────
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
