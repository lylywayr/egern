export default async function(ctx) {
  // ============================================================
  // 📌 环境变量配置说明
  // ------------------------------------------------------------
  // 变量名: POLICY
  // 值: 填写你在 Egern 里设置的「策略组名称」
  // 例如: 🚀 节点选择 | 🌍 全球直连 | Proxy
  //
  // ⚠️ 重要逻辑:
  // 1. 本地 IP 检测: 强制 DIRECT (直连)
  // 2. 落地 IP / 流媒体检测: 走下方指定的 POLICY
  // ============================================================
  const policy = ctx.env.POLICY || ""; 
  const widgetFamily = ctx.widgetFamily || 'systemMedium';

  // =========================
  // 颜色定义
  // =========================
  const BG_COLOR = { light: '#FFFFFF', dark: '#2C2C2E' };
  const C_TITLE = { light: '#1A1A1A', dark: '#FFD700' };
  const C_SUB = { light: '#666666', dark: '#B0B0B0' };
  const C_MAIN = { light: '#1A1A1A', dark: '#FFFFFF' };
  const C_GREEN = { light: '#32D74B', dark: '#32D74B' };
  const C_RED = { light: '#FF3B30', dark: '#FF3B30' };
  const C_ICON = { light: '#007AFF', dark: '#0A84FF' };

  // =========================
  // 小号组件提示
  // =========================
  if (['systemSmall', 'accessoryCircular', 'accessoryInline', 'accessoryRectangular'].includes(widgetFamily)) {
    return {
      type: 'widget',
      padding: 16,
      backgroundColor: BG_COLOR,
      children: [{
        type: 'text',
        text: '请使用中号或大号组件',
        font: { size: 'callout' },
        textColor: C_MAIN,
        textAlign: 'center'
      }]
    };
  }

  const BASE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

  // =========================
  // 📌 策略组请求封装（核心）
  // =========================
  function withPolicy(opts = {}) {
    // 如果设置了 POLICY 且不为空，则使用该策略组
    if (policy && policy.trim() !== "") {
      opts.policy = policy;
    }
    // 本地直连的请求会在调用时单独覆盖此设置
    return opts;
  }

  // =========================
  // HTTP 请求封装
  // =========================
  async function get(url, headers) {
    const opts = withPolicy({ timeout: 6000 });
    if (headers) opts.headers = headers;
    const res = await ctx.http.get(url, opts);
    return await res.text();
  }

  async function post(url, body, headers) {
    const opts = withPolicy({ timeout: 6000, body });
    if (headers) opts.headers = headers;
    const res = await ctx.http.post(url, opts);
    return await res.text();
  }

  function jp(s) { try { return JSON.parse(s); } catch(e){ return null; } }

  // =========================
  // 流媒体检测（走策略组）
  // ==========================
  async function checkChatGPT() {
    try {
      const trace = await get("https://chatgpt.com/cdn-cgi/trace");
      const m = trace.match(/loc=([A-Z]{2})/);
      return m ? m[1] : "OK";
    } catch(e) { return "Cross"; }
  }

  async function checkYouTube() {
    try {
      const body = await get('https://www.youtube.com/premium', { "User-Agent": BASE_UA });
      if (body.includes('Premium is not available')) return "Cross";
      return "OK";
    } catch(e) { return "Cross"; }
  }

  async function checkNetflix() {
    try {
      const html = await get('https://www.netflix.com/50043056', { "User-Agent": BASE_UA });
      if (html.includes('title-not-available')) return "Cross";
      return "OK";
    } catch(e) { return "Cross"; }
  }

  async function checkDisneyPlus() {
    try {
      await get('https://www.disneyplus.com/api/subscription/status', { "User-Agent": BASE_UA });
      return "OK";
    } catch(e) { return "Cross"; }
  }

  async function checkSpotify() {
    try {
      const res = await get('https://www.spotify.com/premium/', { "User-Agent": BASE_UA });
      return res.includes('Premium') ? "OK" : "Cross";
    } catch(e) { return "Cross"; }
  }

  // =========================
  // 本地 IP（📌 强制直连）
  // =========================
  let lIp = "获取失败";
  try {
    const lRes = await ctx.http.get('https://myip.ipip.net/json', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 3000,
      policy: 'DIRECT'  // 📌 关键点：强制不走代理
    });
    const body = jp(await lRes.text());
    lIp = body?.data?.ip || "获取失败";
  } catch(e) { lIp = "获取失败"; }

  // =========================
  // 落地 IP（📌 走策略组）
  // =========================
  let nIp = "获取失败";
  try {
    const res = await ctx.http.get('https://api.ipify.org?format=json', withPolicy({ timeout: 4000 }));
    const data = jp(await res.text());
    nIp = data?.ip || "获取失败";
  } catch(e) { nIp = "获取失败"; }

  // =========================
  // 流媒体解锁状态
  // =========================
  const [gpt, yt, nf, disney, spotify] = await Promise.all([
    checkChatGPT(),
    checkYouTube(),
    checkNetflix(),
    checkDisneyPlus(),
    checkSpotify()
  ]);

  // =========================
  // UI 渲染
  // =========================
  const SMALL_FONT = 10;
  const SMALL_ICON = 12;

  function UnlockRow(name, status) {
    const isOk = status !== "Cross";
    return {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      gap: 6,
      children: [
        { 
          type: 'image', 
          src: `sf-symbol:${isOk ? 'checkmark.circle.fill' : 'xmark.circle.fill'}`, 
          color: isOk ? C_GREEN : C_RED, 
          width: SMALL_ICON, 
          height: SMALL_ICON 
        },
        { 
          type: 'text', 
          text: name, 
          font: { size: SMALL_FONT, weight: 'medium' }, 
          textColor: C_MAIN 
        }
      ]
    };
  }

  return {
    type: 'widget',
    padding: [10, 12],
    gap: 8,
    backgroundColor: BG_COLOR,
    children: [
      // Header
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          { type: 'text', text: `📡 数据中心`, font: { size: 13, weight: 'heavy' }, textColor: C_TITLE, flex: 1 },
          { type: 'text', text: `策略: ${policy || '未设置'}`, font: { size: 9 }, textColor: C_SUB }
        ]
      },
      // IP Info
      {
        type: 'stack',
        direction: 'row',
        justifyContent: 'space-between',
        children: [
          { type: 'text', text: `本地: ${lIp}`, font: { size: 10 }, textColor: C_SUB },
          { type: 'text', text: `落地: ${nIp}`, font: { size: 10 }, textColor: C_SUB }
        ]
      },
      // Divider
      { type: 'stack', height: 0.5, backgroundColor: { light: 'rgba(0,0,0,0.1)', dark: 'rgba(255,255,255,0.1)' } },
      // Streaming Status
      {
        type: 'stack',
        direction: 'row',
        wrap: 'wrap',
        gap: 8,
        children: [
          UnlockRow("GPT", gpt),
          UnlockRow("YouTube", yt),
          UnlockRow("Netflix", nf),
          UnlockRow("Disney+", disney),
          UnlockRow("Spotify", spotify)
        ]
      }
    ]
  };
}
