export default async function(ctx) {
  // ============================================================
  // 📌 环境变量：POLICY（可选）
  // 有值：走指定策略组 | 无值：按正常分流
  // ============================================================
  const policy = ctx.env.POLICY || "";
  const widgetFamily = ctx.widgetFamily || 'systemMedium';

  // =========================
  // UI 颜色体系
  // =========================
  const C = {
    bg: { light: '#F2F2F7', dark: '#000000' },
    card: { light: '#FFFFFF', dark: '#1C1C1E' },
    text: { light: '#000000', dark: '#FFFFFF' },
    sub: { light: '#8E8E93', dark: '#8E8E93' },
    green: { light: '#34C759', dark: '#30D158' },
    orange: { light: '#FF9500', dark: '#FF9F0A' },
    red: { light: '#FF3B30', dark: '#FF453A' },
    blue: { light: '#007AFF', dark: '#0A84FF' },
    purple: { light: '#AF52DE', dark: '#BF5AF2' }
  };

  // =========================
  // 策略组路由（关键）
  // =========================
  function withPolicy(opts = {}) {
    if (policy && policy.trim() !== "") opts.policy = policy;
    return opts;
  }

  async function safeGet(url, opts = {}) {
    try {
      const finalOpts = { timeout: 4000, ...opts };
      const res = await ctx.http.get(url, finalOpts);
      return await res.text();
    } catch { return null; }
  }

  function parseJSON(t) {
    try { return JSON.parse(t); } catch { return null; }
  }

  // =========================
  // 本地网络信息
  // =========================
  const d = ctx.device || {};
  const netInfo = (typeof $network !== 'undefined') ? $network : (ctx.network || {});
  let netName = "离线", netIcon = "wifi.slash";
  let localIp = netInfo.v4?.primaryAddress || d.ipv4?.address || "N/A";

  if (d.wifi?.ssid) {
    netName = d.wifi.ssid;
    netIcon = "wifi";
  } else if (d.cellular?.radio) {
    netName = d.cellular.radio;
    netIcon = "antenna.radiowaves.left.and.right";
  }

  // =========================
  // 本地公网 IP（强制直连）
  // =========================
  let localPub = "N/A";
  try {
    const r = await ctx.http.get("https://myip.ipip.net/json", {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 3000,
      policy: 'DIRECT'
    });
    const j = parseJSON(await r.text());
    if (j?.data) localPub = j.data.ip;
  } catch {}

  // =========================
  // 代理 IP + 纯净度（走策略组）
  // =========================
  let proxyIP = "N/A", proxyISP = "Unknown";
  let isRes = "未知", fraud = 0, riskTxt = "无数据", riskCol = C.sub;

  try {
    const r = await ctx.http.get("https://my.ippure.com/v1/info", withPolicy({ timeout: 4000 }));
    const d = parseJSON(await r.text());
    if (d) {
      proxyIP = d.ip || "N/A";
      proxyISP = d.asOrganization || "Unknown";
      isRes = d.isResidential ? "🏠 原生住宅" : "🏢 商业机房";
      fraud = d.fraudScore || 0;

      // 高危 / 中危 / 低危
      if (fraud >= 70) { riskTxt = `高危 (${fraud})`; riskCol = C.red; }
      else if (fraud >= 30) { riskTxt = `中危 (${fraud})`; riskCol = C.orange; }
      else { riskTxt = `低危 (${fraud})`; riskCol = C.green; }
    }
  } catch {}

  // =========================
  // 解锁检测（按需）
  // =========================
  async function check(url, kw) {
    try {
      const r = await safeGet(url, withPolicy());
      return r && !r.includes(kw) ? "✅" : "❌";
    } catch { return "❌"; }
  }

  const basic = await Promise.all([
    check("https://www.netflix.com/title/81280792", "page-404"),
    check("https://www.disneyplus.com", "unavailable"),
    check("https://chatgpt.com/cdn-cgi/trace", "loc=")
  ]);

  let full = ["❌","❌","❌","❌"];
  if (widgetFamily === 'systemLarge') {
    full = await Promise.all([
      check("https://www.tiktok.com/explore", "Access Denied"),
      check("https://www.youtube.com/premium", "not available"),
      check("https://claude.ai/login", "App unavailable"),
      check("https://gemini.google.com/app", "faq")
    ]);
  }

  const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  // =========================
  // 📱 小尺寸：极简
  // =========================
  if (widgetFamily === 'systemSmall') {
    return {
      type: 'widget', padding: 12, backgroundColor: C.card, cornerRadius: 12,
      children: [
        { type: 'text', text: `📍 ${localPub}`, font: { size: 10 }, textColor: C.sub },
        { type: 'spacer' },
        { type: 'text', text: `🚀 ${proxyIP}`, font: { size: 10, weight: 'medium' }, textColor: C.blue },
        { type: 'text', text: riskTxt, font: { size: 9 }, textColor: riskCol }
      ]
    };
  }

  // =========================
  // 📗 中尺寸：网络全 + 纯净度 + 简解锁
  // =========================
  if (widgetFamily === 'systemMedium') {
    return {
      type: 'widget', padding: 16, backgroundColor: C.card, cornerRadius: 16,
      children: [
        { type: 'text', text: '🛡️ 网络诊断', font: { size: 15, weight: 'bold' }, textColor: C.text },
        { type: 'spacer', length: 12 },
        {
          type: 'stack', direction: 'row', gap: 12,
          children: [
            {
              type: 'stack', direction: 'column', gap: 4, flex: 1,
              children: [
                { type: 'text', text: '📶 本地', font: { size: 11 }, textColor: C.blue },
                { type: 'text', text: netName, font: { size: 10 }, textColor: C.text },
                { type: 'text', text: localPub, font: { size: 10 }, textColor: C.sub }
              ]
            },
            {
              type: 'stack', direction: 'column', gap: 4, flex: 1,
              children: [
                { type: 'text', text: '🌐 代理', font: { size: 11 }, textColor: C.purple },
                { type: 'text', text: proxyISP, font: { size: 10 }, textColor: C.text, maxLines: 1 },
                { type: 'text', text: proxyIP, font: { size: 10 }, textColor: C.sub, maxLines: 1 }
              ]
            }
          ]
        },
        { type: 'spacer', length: 10 },
        {
          type: 'stack', direction: 'row', justifyContent: 'space-between',
          children: [
            { type: 'text', text: isRes, font: { size: 10 }, textColor: C.text },
            { type: 'text', text: riskTxt, font: { size: 10, weight: 'medium' }, textColor: riskCol }
          ]
        }
      ]
    };
  }

  // =========================
  // 📘 大尺寸：全部不省略
  // =========================
  return {
    type: 'widget', padding: 20, backgroundColor: C.card, cornerRadius: 20,
    children: [
      {
        type: 'stack', direction: 'row', alignItems: 'center', gap: 8,
        children: [
          { type: 'text', text: '🛡️ 网络诊断雷达', font: { size: 17, weight: 'heavy' }, textColor: C.text },
          { type: 'spacer' },
          { type: 'text', text: time, font: { size: 11 }, textColor: C.sub }
        ]
      },
      { type: 'spacer', length: 16 },

      {
        type: 'stack', direction: 'row', gap: 20, flex: 1,
        children: [
          // 左：本地 + 影视
          {
            type: 'stack', direction: 'column', gap: 12, flex: 1,
            children: [
              { type: 'text', text: '📶 本地网络', font: { size: 13, weight: 'bold' }, textColor: C.blue },
              { type: 'text', text: netName, font: { size: 11 }, textColor: C.text },
              { type: 'text', text: `公网：${localPub}`, font: { size: 11 }, textColor: C.sub },
              { type: 'spacer' },
              { type: 'text', text: '🎬 影视解锁', font: { size: 13, weight: 'bold' }, textColor: C.blue },
              { type: 'text', text: `Netflix ${basic[0]}  Disney+ ${basic[1]}`, font: { size: 11 }, textColor: C.text },
              { type: 'text', text: `TikTok ${full[0]}  YouTube ${full[1]}`, font: { size: 11 }, textColor: C.text }
            ]
          },

          // 分隔线
          { type: 'stack', width: 1, backgroundColor: C.sub },

          // 右：代理 + AI + 纯净度
          {
            type: 'stack', direction: 'column', gap: 12, flex: 1,
            children: [
              { type: 'text', text: '🌐 代理网络', font: { size: 13, weight: 'bold' }, textColor: C.purple },
              { type: 'text', text: proxyIP, font: { size: 11 }, textColor: C.text },
              { type: 'text', text: proxyISP, font: { size: 11 }, textColor: C.sub, maxLines: 1 },
              { type: 'spacer' },
              { type: 'text', text: '🤖 AI 解锁', font: { size: 13, weight: 'bold' }, textColor: C.purple },
              { type: 'text', text: `ChatGPT ${basic[2]}  Claude ${full[2]}`, font: { size: 11 }, textColor: C.text },
              { type: 'text', text: `Gemini ${full[3]}`, font: { size: 11 }, textColor: C.text },
              { type: 'spacer' },
              { type: 'text', text: '🛡️ IP 纯净度', font: { size: 13, weight: 'bold' }, textColor: riskCol },
              { type: 'text', text: `${isRes} ｜ ${riskTxt}`, font: { size: 11 }, textColor: riskCol }
            ]
          }
        ]
      }
    ]
  };
}
