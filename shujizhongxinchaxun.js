/**
 * 📌 Egern Widget: 🛡️ 全栈网络诊断雷达 (ENV 正式版)
 * ✅ 支持 POLICY 环境变量
 * ✅ 不删减 · 双源并存
 */

export default async function (ctx) {
  // =========================
  // 1️⃣ 环境变量 & 策略
  // =========================
  const POLICY = ctx.env.POLICY || "";
  const withPolicy = (opts = {}) => {
    if (POLICY && POLICY !== "DIRECT") opts.policy = POLICY;
    return opts;
  };

  // =========================
  // 2️⃣ UI 色彩规范
  // =========================
  const C = {
    bg: { light: '#FFFFFF', dark: '#121212' },
    bar: { light: '#0000001A', dark: '#FFFFFF22' },
    text: { light: '#1C1C1E', dark: '#FFFFFF' },
    dim: { light: '#8E8E93', dark: '#8E8E93' },
    local: { light: '#007AFF', dark: '#0A84FF' },
    proxy: { light: '#AF52DE', dark: '#BF5AF2' },
    safe: { light: '#34C759', dark: '#30D158' },
    warn: { light: '#FF9500', dark: '#FF9F0A' },
    danger: { light: '#FF3B30', dark: '#FF453A' }
  };

  // =========================
  // 3️⃣ 工具函数
  // =========================
  const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)";
  const hdr = () => ({ "User-Agent": UA });

  const flag = (cc = "") => {
    if (!cc) return "🌐";
    if (cc.toUpperCase() === "TW") return "🇨🇳";
    if (cc.length === 2)
      return String.fromCodePoint(...cc.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
    return "🌍";
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

  const toInt = v => Number.isFinite(+v) ? Math.round(+v) : null;

  // =========================
  // 4️⃣ 本地 IP（强制直连）
  // =========================
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

  // =========================
  // 5️⃣ 出口 IP（走 POLICY）
  // =========================
  let proxyIP = "获取失败", proxyLoc = "未知", proxyISP = "未知", proxyCC = "XX";
  let isResidential = null, fraudScore = null;

  try {
    const [ipApi, ipPure] = await Promise.all([
      ctx.http.get("http://ip-api.com/json/?lang=zh-CN", withPolicy({ timeout: 4000 })),
      ctx.http.get("https://my.ippure.com/v1/info", withPolicy({ timeout: 4000 }))
    ]);

    const a = JSON.parse(await ipApi.text());
    const p = JSON.parse(await ipPure.text());

    proxyIP = a.query || p.ip || proxyIP;
    proxyLoc = `${flag(a.countryCode)} ${a.city || ""}`.trim();
    proxyISP = fmtISP(a.isp || a.org);
    proxyCC = a.countryCode || "XX";

    isResidential = p.isResidential;
    fraudScore = toInt(p.fraudScore);
  } catch {}

  // =========================
  // 6️⃣ 风险评分
  // =========================
  let riskTxt = "无数据", riskCol = C.dim;
  if (fraudScore !== null) {
    if (fraudScore >= 70) { riskTxt = `高危 (${fraudScore})`; riskCol = C.danger; }
    else if (fraudScore >= 30) { riskTxt = `中危 (${fraudScore})`; riskCol = C.warn; }
    else { riskTxt = `纯净 (${fraudScore})`; riskCol = C.safe; }
  }

  const nativeTxt =
    isResidential === true ? "原生住宅" :
    isResidential === false ? "商业机房" : "未知属性";

  // =========================
  // 7️⃣ 流媒体检测
  // =========================
  const check = async (url, ok) =>
    (await ctx.http.get(url, withPolicy({ timeout: 4000 })).then(r => r.status).catch(() => 0)) === 200 ? "OK" : "❌";

  const [nf, yt, ds, tt] = await Promise.all([
    check("https://www.netflix.com/title/70143836"),
    check("https://www.youtube.com/premium"),
    check("https://www.disneyplus.com"),
    check("https://www.tiktok.com/explore")
  ]);

  // =========================
  // 8️⃣ AI 检测
  // =========================
  const checkGPT = async () => {
    try {
      const r = await ctx.http.get("https://chatgpt.com/cdn-cgi/trace", withPolicy({ timeout: 3000 }));
      const m = (await r.text()).match(/loc=([A-Z]{2})/);
      return m?.[1] || "OK";
    } catch { return "❌"; }
  };

  const checkClaude = async () =>
    (await ctx.http.get("https://claude.ai/login", withPolicy({ timeout: 5000 })).then(r => r.status).catch(() => 0)) === 200 ? "OK" : "❌";

  const checkGemini = async () =>
    (await ctx.http.get("https://gemini.google.com/app", withPolicy({ timeout: 4000 })).then(r => r.status).catch(() => 0)) === 200 ? "OK" : "❌";

  const [gpt, claude, gemini] = await Promise.all([
    checkGPT(), checkClaude(), checkGemini()
  ]);

  // =========================
  // 9️⃣ 延迟
  // =========================
  const ping = async url =>
    await new Promise(async r => {
      const s = Date.now();
      await ctx.http.get(url, withPolicy({ timeout: 2000 })).catch(() => {});
      r(`${Date.now() - s} ms`);
    });

  const [localDelay, proxyDelay] = await Promise.all([
    ping("http://www.baidu.com"),
    ping("http://cp.cloudflare.com")
  ]);

  // =========================
  // 🔟 渲染
  // =========================
  const Row = (icon, col, label, value) => ({
    type: "stack", direction: "row", alignItems: "center", gap: 5,
    children: [
      { type: "image", src: `sf-symbol:${icon}`, color: col, width: 11, height: 11 },
      { type: "text", text: label, font: { size: 10 }, textColor: C.dim },
      { type: "spacer" },
      { type: "text", text: value, font: { size: 10, weight: "medium" }, textColor: C.text, maxLines: 1 }
    ]
  });

  const now = new Date();
  const time = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;

  return {
    type: "widget",
    padding: 14,
    backgroundColor: C.bg,
    children: [
      {
        type: "stack", direction: "row", alignItems: "center", gap: 6,
        children: [
          { type: "image", src: "sf-symbol:waveform.path.ecg", color: C.text, width: 16, height: 16 },
          { type: "text", text: `网络雷达 (${POLICY || "DIRECT"})`, font: { size: 14, weight: "bold" }, textColor: C.text },
          { type: "spacer" },
          { type: "text", text: time, font: { size: 10 }, textColor: C.dim }
        ]
      },
      { type: "spacer", length: 12 },
      {
        type: "stack", direction: "row", gap: 10,
        children: [
          {
            type: "stack", direction: "column", gap: 4.5, flex: 1,
            children: [
              Row("wifi", C.local, "本地 IP", localIP),
              Row("map", C.local, "位置", localLoc),
              Row("simcard", C.local, "运营商", localISP),
              Row("timer", C.local, "延迟", localDelay),
              Row("play.tv", C.local, "影视", `NF ${nf}  YT ${yt}  DS ${ds}`)
            ]
          },
          { type: "stack", width: 0.5, backgroundColor: C.bar },
          {
            type: "stack", direction: "column", gap: 4.5, flex: 1,
            children: [
              Row("paperplane", C.proxy, "出口 IP", proxyIP),
              Row("mappin", C.proxy, "落地", proxyLoc),
              Row("server.rack", C.proxy, "厂商", proxyISP),
              Row("house", C.proxy, "属性", nativeTxt),
              Row("checkmark.shield", riskCol, "风险", riskTxt),
              Row("cpu", C.proxy, "AI", `GPT ${gpt}  CL ${claude}  GM ${gemini}`),
              Row("timer", C.proxy, "延迟", proxyDelay)
            ]
          }
        ]
      }
    ]
  };
}
