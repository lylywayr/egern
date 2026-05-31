/**
 * 📌 Egern Widget: 🛡️ 全栈网络诊断雷达（中尺寸·信息满载版）
 * ✅ IP 纯净度：完整显示风险评分
 * ✅ 流媒体/AI：单行紧凑，✅/❌ 显示
 * ✅ 完全复用你第一个脚本的双列布局
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
    bg: { light: '#FFFFFF', dark: '#121212' },
    bar: { light: '#0000001A', dark: '#FFFFFF22' },
    title: { light: '#1A1A1A', dark: '#FFD700' },
    text: { light: '#1A1A1A', dark: '#FFFFFF' },
    sub: { light: '#666666', dark: '#B0B0B0' },
    green: { light: '#32D74B', dark: '#32D74B' },
    orange: { light: '#FF9500', dark: '#FF9F0A' },
    red: { light: '#FF3B30', dark: '#FF453A' },
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
    if (/广电|cbn/i.test(s)) return "中国广电";
    return isp;
  };

  // ========================
  // 数据获取
  // ========================
  let localIP = "获取失败", localLoc = "未知", localISP = "未知";
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
  } catch {}

  let proxyIP = "获取失败", proxyLoc = "未知", proxyISP = "未知", proxyCC = "XX";
  let isResidential = null, fraudScore = null;
  
  try {
    const [ipApi, ipPure] = await Promise.all([
      ctx.http.get("http://ip-api.com/json/?lang=zh-CN", withPolicy({ timeout: 4000 })),
      ctx.http.get("https://my.ippure.com/v1/info", withPolicy({ timeout: 4000 }))
    ]);

    const a = JSON.parse(await ipApi.text());
    const p = JSON.parse(await ipPure.text());

    proxyIP = a.query || p.ip;
    proxyLoc = `${flag(a.countryCode)} ${a.city || ""}`.trim();
    proxyISP = fmtISP(a.isp || a.org);
    proxyCC = a.countryCode || "XX";

    isResidential = p.isResidential;
    fraudScore = Number.isFinite(+p.fraudScore) ? Math.round(+p.fraudScore) : null;
  } catch {}

  const nativeTxt = isResidential === true ? "原生住宅" :
                    isResidential === false ? "商业机房" : "未知属性";

  // ✅ IP 纯净度：完整显示（参考第二个脚本）
  const riskTxt = fraudScore === null ? "无数据" :
                  fraudScore >= 70 ? `高危 (${fraudScore})` :
                  fraudScore >= 30 ? `中危 (${fraudScore})` :
                  `纯净 (${fraudScore})`;

  const riskCol = fraudScore >= 70 ? C.red :
                  fraudScore >= 30 ? C.orange : C.green;

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

  const ping = async url => {
    const s = Date.now();
    await ctx.http.get(url, withPolicy({ timeout: 2000 })).catch(() => {});
    return `${Date.now() - s} ms`;
  };

  const [localDelay, proxyDelay] = await Promise.all([
    ping("http://www.baidu.com"),
    ping("http://cp.cloudflare.com")
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

  // ✅ 紧凑型解锁状态（单行，✅/❌）
  const CompactUnlock = (items) => ({
    type: "stack", direction: "row", alignItems: "center", gap: 12,
    children: items.map(item => ({
      type: "stack", direction: "row", alignItems: "center", gap: 2,
      children: [
        { type: "text", text: item.icon, font: { size: 9 } },
        { type: "text", text: item.status ? "✅" : "❌", font: { size: 9 } }
      ]
    }))
  });

  const now = new Date();
  const time = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;

  // ========================
  // 中尺寸布局（你的要求）
  // ========================
  if (widgetFamily === 'systemMedium') {
    return {
      type: "widget",
      padding: [10, 12],
      backgroundColor: C.bg,
      gap: 6,
      children: [
        // 标题
        {
          type: "stack", direction: "row", alignItems: "center", gap: 4,
          children: [
            { type: "text", text: `网络雷达 (${POLICY || "DIRECT"})`, font: { size: 13, weight: "heavy" }, textColor: C.title, flex: 1 },
            { type: "text", text: time, font: { size: 10 }, textColor: C.sub }
          ]
        },

        // 本地 / 出口 双列
        {
          type: "stack", direction: "row", gap: 12,
          children: [
            // 本地网络
            {
              type: "stack", direction: "column", gap: 2, flex: 1,
              children: [
                Row("本地 IP", localIP, C.blue),
                Row("位置", localLoc),
                Row("运营商", localISP),
                Row("延迟", localDelay)
              ]
            },
            // 出口网络
            {
              type: "stack", direction: "column", gap: 2, flex: 1,
              children: [
                Row("出口 IP", proxyIP, C.blue),
                Row("落地", proxyLoc),
                Row("厂商", proxyISP),
                Row("属性", nativeTxt),
                Row("风险", riskTxt, riskCol),  // ✅ 完整显示风险评分
                Row("延迟", proxyDelay)
              ]
            }
          ]
        },

        { type: "stack", height: 0.5, backgroundColor: C.bar },

        // ✅ 流媒体解锁（单行紧凑）
        CompactUnlock([
          { icon: "📺", status: nf },
          { icon: "▶️", status: yt },
          { icon: "🏰", status: ds },
          { icon: "🎵", status: tt }
        ]),

        // ✅ AI 解锁（单行紧凑）
        CompactUnlock([
          { icon: "🤖", status: gpt },
          { icon: "🧠", status: claude },
          { icon: "💎", status: gemini }
        ])
      ]
    };
  }

  // ========================
  // 其他尺寸（保持原有逻辑）
  // ========================
  if (widgetFamily === 'systemSmall') {
    return {
      type: "widget",
      padding: 12,
      backgroundColor: C.bg,
      children: [
        {
          type: "stack", direction: "row", alignItems: "center", gap: 4,
          children: [
            { type: "text", text: "🌐", font: { size: 14 } },
            { type: "text", text: POLICY || "DIRECT", font: { size: 12, weight: "bold" }, textColor: C.title },
            { type: "spacer" },
            { type: "text", text: time, font: { size: 9 }, textColor: C.sub }
          ]
        },
        { type: "spacer", length: 8 },
        Row("出口", proxyIP, C.blue),
        Row("位置", proxyLoc),
        Row("风险", riskTxt, riskCol),
        { type: "spacer", length: 6 },
        CompactUnlock([
          { icon: "NF", status: nf },
          { icon: "YT", status: yt },
          { icon: "GPT", status: gpt }
        ])
      ]
    };
  }

  // 大尺寸
  return {
    type: "widget",
    padding: 14,
    backgroundColor: C.bg,
    gap: 10,
    children: [
      {
        type: "stack", direction: "row", alignItems: "center", gap: 6,
        children: [
          { type: "image", src: "sf-symbol:waveform.path.ecg", color: C.title, width: 18, height: 18 },
          { type: "text", text: `网络雷达 (${POLICY || "DIRECT"})`, font: { size: 16, weight: "heavy" }, textColor: C.title },
          { type: "spacer" },
          { type: "text", text: time, font: { size: 11 }, textColor: C.sub }
        ]
      },
      {
        type: "stack", direction: "row", gap: 12,
        children: [
          // 本地网络
          {
            type: "stack", direction: "column", gap: 4, flex: 1,
            children: [
              { type: "text", text: "📱 本地网络", font: { size: 11, weight: "semibold" }, textColor: C.blue },
              Row("IP", localIP, C.blue),
              Row("位置", localLoc),
              Row("运营商", localISP),
              Row("延迟", localDelay, C.green)
            ]
          },
          { type: "stack", width: 0.5, backgroundColor: C.bar },
          // 出口网络
          {
            type: "stack", direction: "column", gap: 4, flex: 1,
            children: [
              { type: "text", text: "🌐 出口网络", font: { size: 11, weight: "semibold" }, textColor: C.purple },
              Row("IP", proxyIP, C.blue),
              Row("落地", proxyLoc),
              Row("厂商", proxyISP),
              Row("属性", nativeTxt),
              Row("风险", riskTxt, riskCol),
              Row("延迟", proxyDelay, C.green)
            ]
          },
          { type: "stack", width: 0.5, backgroundColor: C.bar },
          // 解锁状态
          {
            type: "stack", direction: "column", gap: 4, flex: 1,
            children: [
              { type: "text", text: "🎯 解锁状态", font: { size: 11, weight: "semibold" }, textColor: C.green },
              Row("Netflix", nf ? "✅" : "❌", nf ? C.green : C.red),
              Row("YouTube", yt ? "✅" : "❌", yt ? C.green : C.red),
              Row("Disney+", ds ? "✅" : "❌", ds ? C.green : C.red),
              Row("TikTok", tt ? "✅" : "❌", tt ? C.green : C.red),
              Row("ChatGPT", gpt ? "✅" : "❌", gpt ? C.green : C.red),
              Row("Claude", claude ? "✅" : "❌", claude ? C.green : C.red),
              Row("Gemini", gemini ? "✅" : "❌", gemini ? C.green : C.red)
            ]
          }
        ]
      }
    ]
  };
}
