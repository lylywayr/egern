export default async function(ctx) {
  // =========================
  // 环境变量策略组
  // 名称：POLICY
  // 值：你的策略组名字（如：🚀 节点选择）
  // =========================
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
  // 策略组封装（关键！）
  // =========================
  function withPolicy(opts = {}) {
    if (policy && policy !== "DIRECT") {
      opts.policy = policy;
    }
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

  async function getRaw(url, headers, extraOpts) {
    const opts = withPolicy({ timeout: 6000 });
    if (headers) opts.headers = headers;
    if (extraOpts) Object.assign(opts, extraOpts);
    return await ctx.http.get(url, opts);
  }

  function jp(s) { try { return JSON.parse(s); } catch(e){ return null; } }
  function ti(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; }

  // =========================
  // 流媒体检测（走策略组）
  // ==========================

  async function checkChatGPT() {
    try {
      const headRes = await getRaw("https://chatgpt.com", { "User-Agent": BASE_UA }, { redirect: 'manual' });
      if (!headRes) return "Cross";
      const trace = await get("https://chatgpt.com/cdn-cgi/trace");
      const m = trace.match(/loc=([A-Z]{2})/);
      return m ? m[1] : "OK";
    } catch(e) { return "Cross"; }
  }

  async function checkGemini() {
    try {
      const body = await post(
        'https://gemini.google.com/_/BardChatUi/data/batchexecute',
        'f.req=[["K4WWud","[[0],[\\"en-US\\"]]",null,"generic"]]',
        { "User-Agent": BASE_UA, "Content-Type": "application/x-www-form-urlencoded" }
      );
      const m = body.match(/"countryCode"\s*:\s*"([A-Z]{2})"/i);
      return m ? m[1].toUpperCase() : "OK";
    } catch(e) { return "Cross"; }
  }

  async function checkYouTube() {
    try {
      const body = await get('https://www.youtube.com/premium', { "User-Agent": BASE_UA });
      if (body.includes('www.google.cn')) return "CN";
      if (body.includes('Premium is not available')) return "Cross";
      const m = body.match(/"contentRegion"\s*:\s*"([A-Z]{2})"/);
      return m ? m[1] : "OK";
    } catch(e) { return "Cross"; }
  }

  async function checkNetflix() {
    try {
      const html = await get('https://www.netflix.com/50043056', { "User-Agent": BASE_UA });
      if (html.includes('page-404') || html.includes('title-not-available')) return "Cross";
      const m = html.match(/"countryCode"\s*:\s*"([A-Z]{2})"/);
      return m ? m[1] : "OK";
    } catch(e) { return "Cross"; }
  }

  async function checkTikTok() {
    try {
      const body = await get('https://www.tiktok.com/', { "User-Agent": BASE_UA });
      const m = body.match(/"region"\s*:\s*"([A-Z]{2})"/);
      return m ? m[1] : "OK";
    } catch(e) { return "Cross"; }
  }

  async function checkDisneyPlus() {
    try {
      const res = await get('https://www.disneyplus.com/api/subscription/status', { "User-Agent": BASE_UA });
      if (res.includes('"entitlements"')) {
        const m = res.match(/"countryCode"\s*:\s*"([A-Z]{2})"/);
        return m ? m[1] : "OK";
      }
      return "Cross";
    } catch(e) { return "Cross"; }
  }

  async function checkSpotify() {
    try {
      const res = await get('https://www.spotify.com/premium/', { "User-Agent": BASE_UA });
      if (res.includes('Premium') && !res.includes('not available')) return "OK";
      return "Cross";
    } catch(e) { return "Cross"; }
  }

  // =========================
  // IP 信息处理
  // =========================

  const fmtISP = (isp) => {
    if (!isp) return "未知";
    const s = String(isp).toLowerCase();
    if (/移动|mobile|cmcc/i.test(s)) return "中国移动";
    if (/电信|telecom|chinanet/i.test(s)) return "中国电信";
    if (/联通|unicom/i.test(s)) return "中国联通";
    if (/广电|broadcast|cbn/i.test(s)) return "中国广电";
    return isp;
  };

  const getFlagEmoji = (country) => {
    if (!country) return "🌐";
    if (country.includes("中国")) return "🇨🇳";
    if (country.includes("日本")) return "🇯🇵";
    if (country.includes("美国")) return "🇺🇸";
    if (country.includes("香港")) return "🇭🇰";
    if (country.includes("台湾")) return "🇹🇼";
    if (country.includes("新加坡")) return "🇸🇬";
    if (country.includes("韩国")) return "🇰🇷";
    return "📍";
  };

  // =========================
  // 本地 IP（强制直连）
  // =========================
  let lIp = "获取失败", lLoc = "未知位置", lIsp = "未知运营商";
  try {
    const lRes = await ctx.http.get('https://myip.ipip.net/json', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 3000,
      policy: 'DIRECT'  // 强制直连
    });
    const body = jp(await lRes.text());
    if (body?.data) {
      lIp = body.data.ip;
      const locArr = body.data.location || [];
      lLoc = `${getFlagEmoji(locArr[0])} ${locArr[1] ||
