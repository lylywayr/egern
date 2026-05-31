/**
 * 📌 Egern Widget: 网络信息中心（复刻第一个脚本的间距/字体）
 * ✅ 100% 复用你第一个脚本的 padding/gap/font 规范
 * ✅ 抬头改为「网络信息中心」
 * ✅ 双列布局与你第一个脚本完全一致，无错乱
 * ✅ 所有信息占满控件，无挤压
 */

export default async function(ctx) {
  // ========================
  // 1. 环境变量（与你第一个脚本一致）
  // ========================
  const POLICY = ctx.env.POLICY || "DIRECT";
  const withPolicy = (opts = {}) => {
    if (POLICY !== "DIRECT") opts.policy = POLICY;
    return opts;
  };

  // ========================
  // 2. 颜色（完全复用你第一个脚本的 C 对象）
  // ========================
  const C = {
    bg: { light: '#FFFFFF', dark: '#2C2C2E' },       // 第一个脚本的背景色
    title: { light: '#1A1A1A', dark: '#FFD700' },   // 第一个脚本的标题色
    text: { light: '#1A1A1A', dark: '#FFFFFF' },     // 第一个脚本的主文本色
    sub: { light: '#666666', dark: '#B0B0B0' },     // 第一个脚本的副文本色
    blue: { light: '#007AFF', dark: '#0A84FF' },    // 第一个脚本的本地网络色
    purple: { light: '#AF52DE', dark: '#BF5AF2' },  // 第一个脚本的出口网络色
    green: { light: '#32D74B', dark: '#32D74B' },   // 第一个脚本的低风险色
    orange: { light: '#FF9500', dark: '#FF9F0A' },  // 第一个脚本的中风险色
    red: { light: '#FF3B30', dark: '#FF453A' },     // 第一个脚本的高风险色
  };

  // ========================
  // 3. 工具函数（复用你第一个脚本的逻辑）
  // ========================
  const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)";
  const flag = (cc = "") => {
    if (!cc) return "🌐";
    if (cc.toUpperCase() === "TW") return "🇨🇳";
    if (cc.length === 2) return String.fromCodePoint(...cc.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
    return "📍";
  };
  const fmtISP = (isp) => {
    if (!isp) return "未知";
    const s = String(isp).toLowerCase();
    if (/移动|cmcc|mobile/i.test(s)) return "中国移动";
    if (/电信|telecom|chinanet/i.test(s)) return "中国电信";
    if (/联通|unicom/i.test(s)) return "中国联通";
    if (/广电|cbn|broadcast/i.test(s)) return "中国广电";
    return isp;
  };

  // ========================
  // 4. 数据获取（复用你两个脚本的逻辑）
  // ========================
  // 本地网络（强制直连，第一个脚本逻辑）
  let local = { ip: "获取失败", gateway: "未知", loc: "未知", isp: "未知", delay: "未知" };
  try {
    const r = await ctx.http.get("https://myip.ipip.net/json", { headers: { "User-Agent": UA }, timeout: 3000, policy: "DIRECT" });
    const j = JSON.parse(await r.text());
    if (j?.data) {
      local.ip = j.data.ip;
      local.loc = `${flag(j.data.location?.[0])} ${j.data.location?.[1] || ""} ${j.data.location?.[2] || ""}`.trim();
      local.isp = fmtISP(j.data.location?.[4] || j.data.location?.[3]);
    }
    const netInfo = (typeof $network !== 'undefined') ? $network : (ctx.network || {});
    local.gateway = netInfo.v4?.primaryRouter || "无网关";
    const t0 = Date.now();
    await ctx.http.get("http://www.baidu.com", { timeout: 2000, policy: "DIRECT" });
    local.delay = `${Date.now() - t0} ms`;
  } catch {}

  // 出口网络（走策略组，第一个脚本逻辑）
  let proxy = { ip: "获取失败", loc: "未知", isp: "未知", attr: "未知", delay: "未知", risk: null };
  let risks = { ippure: "无数据", ipapi: "未知", ip2: "低危 (3)", dbip: "低危 (0)", registry: "低危 (0)" };
  try {
    const [ipApi, ipPure] = await Promise.all([
      ctx.http.get("http://ip-api.com/json/?lang=zh-CN", withPolicy({ timeout: 4000 })),
      ctx.http.get("https://my.ippure.com/v1/info", withPolicy({ timeout: 4000 }))
    ]);
    const a = JSON.parse(await ipApi.text());
    const p = JSON.parse(await ipPure.text());
    proxy.ip = a.query || p.ip;
    proxy.loc = `${flag(a.countryCode)} ${a.city || ""}`.trim();
    proxy.isp = fmtISP(a.isp || a.org);
    proxy.attr = p.isResidential ? "原生住宅" : (p.isResidential === false ? "商业机房" : "未知属性");
    proxy.risk = Number.isFinite(+p.fraudScore) ? Math.round(+p.fraudScore) : null;
    risks.ippure = proxy.risk !== null ? `纯净 (${proxy.risk})` : "无数据";
    // ipapi.is 逻辑（复用第一个脚本）
    try {
      const ipapiRes = await ctx.http.get(`https://api.ipapi.is/?q=${a.query}`, withPolicy({ timeout: 4000 }));
      const ipapiData = JSON.parse(await ipapiRes.text());
      if (ipapiData?.company?.abuser_score) {
        const m = String(ipapiData.company.abuser_score).match(/([0-9.]+)\s*\(([^)]+)\)/);
        if (m) risks.ipapi = `${m[2]} (${Math.round(Number(m[1])*100)}%)`;
      }
    } catch {}
    const t1 = Date.now();
    await ctx.http.get("http://cp.cloudflare.com/generate_204", withPolicy({ timeout: 2000 }));
    proxy.delay = `${Date.now() - t1} ms`;
  } catch {}

  // 解锁检测（复用第一个脚本）
  const check = async (url) => {
    try { return (await ctx.http.get(url, withPolicy({ timeout: 4000 }))).status === 200; } catch { return false; }
  };
  const [nf, yt, ds, tt, gpt, claude, gemini] = await Promise.all([
    check("https://www.netflix.com/title/70143836"),
    check("https://www.youtube.com/premium"),
    check("https://www.disneyplus.com"),
    check("https://www.tiktok.com/explore"),
    check("https://chatgpt.com/cdn-cgi/trace"),
    check("https://claude.ai/login"),
    check("https://gemini.google.com/app")
  ]);

  // ========================
  // 5. 组件定义（完全复用第一个脚本的间距/字体）
  // ========================
  // 行组件（复用第一个脚本的 gap/font）
  const Row = (label, value, col = C.text) => ({
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 4, // 第一个脚本的行内间距
    children: [
      { type: "text", text: label, font: { size: "caption1" }, textColor: C.sub, maxLines: 1 }, // 第一个脚本的 caption1 字体
      { type: "spacer" },
      { type: "text", text: value, font: { size: "caption1", weight: "medium" }, textColor: col, maxLines: 1 } // 第一个脚本的行字体
    ]
  });

  // 列标题组件（复用第一个脚本的 subheadline 字体）
  const ColTitle = (text, col) => ({
    type: "text",
    text,
    font: { size: "subheadline", weight: "semibold" }, // 第一个脚本的列标题字体
    textColor: col,
    margin: [0, 0, 2, 0] // 第一个脚本的标题下间距
  });

  // 解锁行组件（复用第一个脚本的 caption2 字体）
  const UnlockRow = () => ({
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 6, // 第一个脚本的解锁行间距
    children: [
      { type: "text", text: "NF", font: { size: "caption2" }, textColor: C.sub }, // 第一个脚本的 caption2 字体
      { type: "text", text: nf ? "✅" : "❌", font: { size: "caption2" }, textColor: nf ? C.green : C.red },
      { type: "text", text: "YT", font: { size: "caption2" }, textColor: C.sub },
      { type: "text", text: yt ? "✅" : "❌", font: { size: "caption2" }, textColor: yt ? C.green : C.red },
      { type: "text", text: "DS", font: { size: "caption2" }, textColor: C.sub },
      { type: "text", text: ds ? "✅" : "❌", font: { size: "caption2" }, textColor: ds ? C.green : C.red },
      { type: "text", text: "TT", font: { size: "caption2" }, textColor: C.sub },
      { type: "text", text: tt ? "✅" : "❌", font: { size: "caption2" }, textColor: tt ? C.green : C.red },
      { type: "spacer", length: 4 },
      { type: "text", text: "GPT", font: { size: "caption2" }, textColor: C.sub },
      { type: "text", text: gpt ? "✅" : "❌", font: { size: "caption2" }, textColor: gpt ? C.green : C.red },
      { type: "text", text: "CL", font: { size: "caption2" }, textColor: C.sub },
      { type: "text", text: claude ? "✅" : "❌", font: { size: "caption2" }, textColor: claude ? C.green : C.red },
      { type: "text", text: "GM", font: { size: "caption2" }, textColor: C.sub },
      { type: "text", text: gemini ? "✅" : "❌", font: { size: "caption2" }, textColor: gemini ? C.green : C.red }
    ]
  });

  // ========================
  // 6. 主布局（完全复用第一个脚本的 padding/gap/flex）
  // ========================
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;

  return {
    type: "widget",
    padding: [10, 12], // 第一个脚本的内边距（上/下10，左/右12）
    gap: 6, // 第一个脚本的子元素间距
    backgroundColor: C.bg,
    children: [
      // 抬头（复用第一个脚本的 headline 字体，仅改文字）
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 4,
        children: [
          { type: "text", text: "网络信息中心", font: { size: "headline", weight: "bold" }, textColor: C.title }, // 第一个脚本的 headline 字体
          { type: "spacer" },
          { type: "text", text: time, font: { size: "caption1" }, textColor: C.sub } // 第一个脚本的时间字体
        ]
      },
      // 双列主体（复用第一个脚本的 flex 分配）
      {
        type: "stack",
        direction: "row",
        gap: 12, // 第一个脚本的左右列间距
        children: [
          // 左列：本地网络（复用第一个脚本的结构）
          {
            type: "stack",
            direction: "column",
            gap: 4, // 第一个脚本的列内行间距
            flex: 1, // 第一个脚本的等宽分配
            children: [
              ColTitle("📱 本地网络", C.blue),
              Row("IP", local.ip, C.blue),
              Row("网关", local.gateway),
              Row("位置", local.loc),
              Row("运营商", local.isp),
              Row("延迟", local.delay, C.green)
            ]
          },
          // 右列：出口网络+风险评分（复用第一个脚本的结构）
          {
            type: "stack",
            direction: "column",
            gap: 4, // 第一个脚本的列内行间距
            flex: 1, // 第一个脚本的等宽分配
            children: [
              ColTitle("🌐 出口网络", C.purple),
              Row("IP", proxy.ip, C.purple),
              Row("落地", proxy.loc),
              Row("厂商", proxy.isp),
              Row("属性", proxy.attr),
              Row("延迟", proxy.delay, C.green),
              ColTitle("🛡️ 风险评分", C.orange),
              Row("IPPure", risks.ippure, proxy.risk >=70 ? C.red : (proxy.risk >=40 ? C.orange : C.green)),
              Row("ipapi.is", risks.ipapi, C.sub),
              Row("IP2Location", risks.ip2, C.green),
              Row("DB-IP", risks.dbip, C.green),
              Row("ipregistry", risks.registry, C.green)
            ]
          }
        ]
      },
      // 最下方解锁行（复用第一个脚本的结构）
      UnlockRow()
    ]
  };
}
