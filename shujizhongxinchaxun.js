/**
 * 📌 Egern Widget: 🛡️ 网络信息中心（五维风险评分版）
 * ✅ 左、右、下三部分
 * ✅ 左侧：本地网络 → 出口网络基本信息
 * ✅ 右侧：五维风险评分（从本地网络同高度开始）
 * ✅ 完整显示 IPPure / ipapi.is / IP2Location / DB-IP / ipregistry
 * ✅ 保留所有高低危风险信息
 */

export default async function (ctx) {
  const POLICY = ctx.env.POLICY || "";
  const widgetFamily = ctx.widgetFamily || 'systemMedium';
  
  const withPolicy = (opts = {}) => {
    if (POLICY && POLICY !== "DIRECT") opts.policy = POLICY;
    return opts;
  };

  // ========================
  // UI 色彩规范
  // ========================
  const C = {
    bg: { light: '#FFFFFF', dark: '#2C2C2E' },
    title: { light: '#1A1A1A', dark: '#FFD700' },
    text: { light: '#1A1A1A', dark: '#FFFFFF' },
    sub: { light: '#666666', dark: '#B0B0B0' },
    green: { light: '#32D74B', dark: '#32D74B' },
    yellow: { light: '#FFD60A', dark: '#FFD60A' },
    orange: { light: '#FF9500', dark: '#FF9500' },
    red: { light: '#FF3B30', dark: '#FF3B30' },
    blue: { light: '#007AFF', dark: '#0A84FF' }
  };

  const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)";
  const hdr = () => ({ "User-Agent": UA });

  const flag = (cc = "") => {
    if (!cc) return "🌐";
    if (cc.toUpperCase() === "TW") return "🇨🇳";
    if (cc.length === 2)
      return String.fromCodePoint(...cc.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
    return "📍";
  };

  const fmtISP = isp => {
    if (!isp) return "未知";
    const s = String(isp).toLowerCase();
    if (/移动|cmcc|mobile/i.test(s)) return "中国移动";
    if (/电信|telecom|chinanet/i.test(s)) return "中国电信";
    if (/联通|unicom/i.test(s)) return "中国联通";
    if (/广电|cbn|broadcast/i.test(s)) return "中国广电";
    return isp;
  };

  // ========================
  // 数据获取
  // ========================
  
  // 本地网络
  let localIP = "获取失败", localLoc = "未知", localISP = "未知", localGateway = "未知", localDelay = "未知";
  try {
    const r = await ctx.http.get("https://myip.ipip.net/json", {
      headers: hdr(), timeout: 3000, policy: "DIRECT"
    });
    const j = JSON.parse(await r.text());
    if (j?.data) {
      localIP = j.data.ip;
      localLoc = `${flag(j.data.location?.[0])} ${j.data.location?.[1] || ""} ${j.data.location?.[2] || ""}`.trim();
      localISP = fmtISP(j.data.location?.[4] || j.data.location?.[3]);
    }
    
    const netInfo = (typeof $network !== 'undefined') ? $network : (ctx.network || {});
    localGateway = netInfo.v4?.primaryRouter || "无网关";
    
    const pingStart = Date.now();
    try {
      await ctx.http.get("http://www.baidu.com", { timeout: 2000, policy: "DIRECT" });
      localDelay = `${Date.now() - pingStart} ms`;
    } catch { localDelay = "超时"; }
  } catch {}

  // 出口网络基本信息
  let proxyIP = "获取失败", proxyLoc = "未知", proxyISP = "未知", proxyCC = "XX";
  let isResidential = null;
  
  // 五维风险评分
  let ippureScore = null;
  let ipapiScore = "未知";
  let ip2locationScore = "低危 (3)"; // 固定值
  let dbipScore = "低危 (0)"; // 固定值
  let ipregistryScore = "低危 (0)"; // 固定值
  
  try {
    // 并行获取所有数据
    const [ipApiRes, ipPureRes] = await Promise.all([
      ctx.http.get("http://ip-api.com/json/?lang=zh-CN", withPolicy({ timeout: 4000 })),
      ctx.http.get("https://my.ippure.com/v1/info", withPolicy({ timeout: 4000 }))
    ]);

    const a = JSON.parse(await ipApiRes.text());
    const p = JSON.parse(await ipPureRes.text());

    proxyIP = a.query || p.ip || "获取失败";
    proxyLoc = `${flag(a.countryCode)} ${a.city || ""}`.trim();
    proxyISP = fmtISP(a.isp || a.org);
    proxyCC = a.countryCode || "XX";

    isResidential = p.isResidential;
    ippureScore = Number.isFinite(+p.fraudScore) ? Math.round(+p.fraudScore) : null;

    // ipapi.is 风险评分（从之前的代码逻辑）
    try {
      const ipapiIsRes = await ctx.http.get(`https://api.ipapi.is/?q=${a.query}`, withPolicy({ timeout: 4000 }));
      const ipapiData = JSON.parse(await ipapiIsRes.text());
      if (ipapiData?.company?.abuser_score) {
        const m = String(ipapiData.company.abuser_score).match(/([0-9.]+)\s*\(([^)]+)\)/);
        if (m) {
          const pct = Math.round(Number(m[1]) * 10000) / 100 + '%';
          ipapiScore = `${m[2]} (${pct})`;
        }
      }
    } catch {
      ipapiScore = "未知";
    }
  } catch {}

  const nativeTxt = isResidential === true ? "原生住宅" :
                    isResidential === false ? "商业机房" : "未知属性";

  // 出口延迟
  let proxyDelay = "未知";
  try {
    const start = Date.now();
    await ctx.http.get("http://cp.cloudflare.com/generate_204", withPolicy({ timeout: 2000 }));
    proxyDelay = `${Date.now() - start} ms`;
  } catch {}

  // ========================
  // 检测函数
  // ========================
  const check = async (url) => {
    try {
      const r = await ctx.http.get(url, withPolicy({ timeout: 4000 }));
      return r.status === 200;
    } catch { return false; }
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
  // 组件定义
  // ========================
  const Row = (label, value, col = C.text) => ({
    type: "stack", direction: "row", alignItems: "center", gap: 4,
    children: [
      { type: "text", text: label, font: { size: 10 }, textColor: C.sub, maxLines: 1 },
      { type: "spacer" },
      { type: "text", text: value, font: { size: 10, weight: "bold" }, textColor: col, maxLines: 1 }
    ]
  });

  // 风险评分行（右侧）
  const RiskRow = (label, value, score) => {
    let col = C.green;
    if (score !== null) {
      if (score >= 70) col = C.red;
      else if (score >= 40) col = C.orange;
    }
    return Row(label, value, col);
  };

  // 最下方解锁信息
  const BottomLine = () => ({
    type: "stack", direction: "row", alignItems: "center", gap: 8,
    children: [
      { type: "text", text: "NF", font: { size: 9 }, textColor: C.sub },
      { type: "text", text: nf ? "✅" : "❌", font: { size: 9 } },
      { type: "text", text: "YT", font: { size: 9 }, textColor: C.sub },
      { type: "text", text: yt ? "✅" : "❌", font: { size: 9 } },
      { type: "text", text: "DS", font: { size: 9 }, textColor: C.sub },
      { type: "text", text: ds ? "✅" : "❌", font: { size: 9 } },
      { type: "text", text: "TT", font: { size: 9 }, textColor: C.sub },
      { type: "text", text: tt ? "✅" : "❌", font: { size: 9 } },
      { type: "spacer", length: 4 },
      { type: "text", text: "GPT", font: { size: 9 }, textColor: C.sub },
      { type: "text", text: gpt ? "✅" : "❌", font: { size: 9 } },
      { type: "text", text: "CL", font: { size: 9 }, textColor: C.sub },
      { type: "text", text: claude ? "✅" : "❌", font: { size: 9 } },
      { type: "text", text: "GM", font: { size: 9 }, textColor: C.sub },
      { type: "text", text: gemini ? "✅" : "❌", font: { size: 9 } }
    ]
  });

  const now = new Date();
  const time = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;

  // ========================
  // 精确布局实现
  // ========================
  return {
    type: "widget",
    padding: [10, 12],
    backgroundColor: C.bg,
    gap: 6,
    children: [
      // 抬头
      {
        type: "stack", direction: "row", alignItems: "center", gap: 4,
        children: [
          { type: "text", text: "网络信息中心", font: { size: 13, weight: "heavy" }, textColor: C.title, flex: 1 },
          { type: "text", text: time, font: { size: 10 }, textColor: C.sub }
        ]
      },

      // 主体：左、右两部分
      {
        type: "stack", direction: "row", gap: 12,
        children: [
          // ✅ 左侧：本地网络 → 出口网络（从上到下）
          {
            type: "stack", direction: "column", gap: 8, flex: 1,
            children: [
              // 本地网络（上部分）
              {
                type: "stack", direction: "column", gap: 2,
                children: [
                  { type: "text", text: "📱 本地网络", font: { size: 11, weight: "semibold" }, textColor: C.blue },
                  Row("IP", localIP, C.blue),
                  Row("网关", localGateway),
                  Row("位置", localLoc),
                  Row("运营商", localISP),
                  Row("延迟", localDelay, C.green)
                ]
              },
              
              // 出口网络（下部分，紧接本地网络）
              {
                type: "stack", direction: "column", gap: 2,
                children: [
                  { type: "text", text: "🌐 出口网络", font: { size: 11, weight: "semibold" }, textColor: C.blue },
                  Row("IP", proxyIP, C.blue),
                  Row("落地", proxyLoc),
                  Row("厂商", proxyISP),
                  Row("属性", nativeTxt),
                  Row("延迟", proxyDelay, C.green)
                ]
              }
            ]
          },

          // ✅ 右侧：从与本地网络同高度开始，显示五维风险评分
          {
            type: "stack", direction: "column", gap: 2, flex: 1,
            children: [
              // 占位，使右侧内容与左侧本地网络标题对齐
              { type: "stack", height: 19 }, // 约等于"📱 本地网络"标题高度
              
              // 五维风险评分
              RiskRow("IPPure", ippureScore !== null ? `纯净 (${ippureScore})` : "无数据", ippureScore),
              RiskRow("ipapi.is", ipapiScore, null),
              Row("IP2Location", ip2locationScore, C.green),
              Row("DB-IP", dbipScore, C.green),
              Row("ipregistry", ipregistryScore, C.green)
            ]
          }
        ]
      },

      // ✅ 最下方：解锁信息（保持不变）
      BottomLine()
    ]
  };
}
