export default async function(ctx) {
  // ============================================================
  // 📌 环境变量配置
  // POLICY: 指定策略组名称（可选，无则按正常分流）
  // ============================================================
  const policy = ctx.env.POLICY || "";
  const widgetFamily = ctx.widgetFamily || 'systemMedium';

  // =========================
  // 统一 UI 颜色规范
  // =========================
  const C = {
    bg: { light: '#F8F9FA', dark: '#000000' },
    card: { light: '#FFFFFF', dark: '#1C1C1E' },
    text: { light: '#000000', dark: '#FFFFFF' },
    sub: { light: '#6C757D', dark: '#8E8E93' },
    accent: { light: '#007AFF', dark: '#0A84FF' },
    green: { light: '#34C759', dark: '#30D158' },
    orange: { light: '#FF9500', dark: '#FF9F0A' },
    red: { light: '#FF3B30', dark: '#FF453A' },
    purple: { light: '#AF52DE', dark: '#BF5AF2' }
  };

  // =========================
  // 策略组路由（核心规则）
  // =========================
  function withPolicy(opts = {}) {
    if (policy && policy.trim() !== "") opts.policy = policy;
    return opts;
  }

  // =========================
  // 辅助函数（省略重复部分，同之前完整版）
  // =========================
  async function safeGet(url, opts = {}) {
    try {
      const finalOpts = { timeout: 5000, ...opts };
      const res = await ctx.http.get(url, finalOpts);
      return await res.text();
    } catch { return null; }
  }

  function parseJSON(text) {
    try { return JSON.parse(text); } catch { return null; }
  }

  const fmtLocalISP = (isp) => {
    if (!isp) return "未知";
    const s = String(isp).toLowerCase();
    if (/移动|mobile|cmcc/i.test(s)) return "中国移动";
    if (/电信|telecom|chinanet/i.test(s)) return "中国电信";
    if (/联通|unicom/i.test(s)) return "中国联通";
    if (/广电|broadcast|cbn/i.test(s)) return "中国广电";
    return isp;
  };

  const fmtProxyISP = (isp) => {
    if (!isp) return "未知";
    let s = String(isp);
    if (/it7/i.test(s)) return "IT7 Network";
    if (/dmit/i.test(s)) return "DMIT Network";
    if (/cloudflare/i.test(s)) return "Cloudflare";
    if (/amazon|aws/i.test(s)) return "AWS";
    if (/google/i.test(s)) return "Google Cloud";
    if (/microsoft|azure/i.test(s)) return "Azure";
    if (/alibaba|aliyun/i.test(s)) return "阿里云";
    if (/tencent/i.test(s)) return "腾讯云";
    if (/oracle/i.test(s)) return "Oracle Cloud";
    return s.length > 12 ? s.substring(0, 12) + "..." : s;
  };

  const getFlag = (code) => {
    if (!code || code.toUpperCase() === 'TW') return '🇨🇳';
    if (code.toUpperCase() === 'XX' || code === 'OK') return '✅';
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
  };

  // =========================
  // 本地网络信息（强制直连）
  // =========================
  const d = ctx.device || {};
  const netInfo = (typeof $network !== 'undefined') ? $network : (ctx.network || {});
  let netType = "离线", netIcon = "wifi.slash";
  const isWifi = !!d.wifi?.ssid;
  if (isWifi) {
    netType = d.wifi.ssid;
    netIcon = "wifi";
  } else if (d.cellular?.radio) {
    const radioMap = { "GPRS": "2G", "EDGE": "2.5G", "WCDMA": "3G", "LTE": "4G", "NR": "5G" };
    netType = radioMap[d.cellular.radio.toUpperCase()] || d.cellular.radio;
    netIcon = "antenna.radiowaves.left.and.right";
  }

  const localInnerIP = netInfo.v4?.primaryAddress || d.ipv4?.address || "N/A";
  let localPublicIP = "N/A", localLocation = "未知位置", localISP = "未知运营商";
  try {
    const res = await ctx.http.get("https://myip.ipip.net/json", {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 3000,
      policy: 'DIRECT'
    });
    const data = parseJSON(await res.text());
    if (data?.data) {
      localPublicIP = data.data.ip;
      const loc = data.data.location || [];
      localLocation = `${loc[0] || ""} ${loc[1] || ""} ${loc[2] || ""}`.trim();
      localISP = fmtLocalISP(loc[4] || loc[3] || "未知");
    }
  } catch {}

  // =========================
  // 代理网络信息（走策略组）
  // =========================
  let proxyIP = "N/A", proxyISP = "未知", proxyCountry = "XX";
  let isResidential = "未知属性", fraudScore = 0, riskLevel = "无数据", riskColor = C.sub;
  try {
    const res = await ctx.http.get("https://my.ippure.com/v1/info", withPolicy({ timeout: 4000 }));
    const data = parseJSON(await res.text());
    if (data) {
      proxyIP = data.ip || "N/A";
      proxyISP = fmtProxyISP(data.asOrganization || data.isp || "未知");
      proxyCountry = data.countryCode || "XX";
      isResidential = data.isResidential === true ? "🏠 原生住宅" : data.isResidential === false ? "🏢 商业机房" : "未知属性";
      fraudScore = data.fraudScore || 0;
      if (fraudScore >= 70) { riskLevel = `高危 (${fraudScore})`; riskColor = C.red; }
      else if (fraudScore >= 30) { riskLevel = `中危 (${fraudScore})`; riskColor = C.orange; }
      else { riskLevel = `低危 (${fraudScore})`; riskColor = C.green; }
    }
  } catch {}

  // =========================
  // 解锁检测（全量，中尺寸简化显示）
  // =========================
  async function checkUnlock(url, keyword) {
    try {
      const res = await safeGet(url, withPolicy({ timeout: 3000 }));
      return res && !res.includes(keyword) ? "✅" : "❌";
    } catch { return "❌"; }
  }

  const [nf, dp, tk, yt] = await Promise.all([
    checkUnlock("https://www.netflix.com/title/81280792", "page-404"),
    checkUnlock("https://www.disneyplus.com", "unavailable"),
    checkUnlock("https://www.tiktok.com/explore", "Access Denied"),
    checkUnlock("https://www.youtube.com/premium", "not available")
  ]);

  const [gpt, cl, gm] = await Promise.all([
    checkUnlock("https://chatgpt.com/cdn-cgi/trace", "loc="),
    checkUnlock("https://claude.ai/login", "App unavailable"),
    checkUnlock("https://gemini.google.com/app", "faq")
  ]);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // =========================
  // 📱 小尺寸（极简，保留核心）
  // =========================
  if (widgetFamily === 'systemSmall') {
    return {
      type: 'widget',
      padding: 12,
      backgroundColor: C.card,
      cornerRadius: 12,
      children: [
        { type: 'text', text: `📍 ${localPublicIP}`, font: { size: 10 }, textColor: C.sub },
        { type: 'spacer' },
        { type: 'text', text: `🚀 ${proxyIP}`, font: { size: 10 }, textColor: C.purple },
        { type: 'text', text: `${isResidential} | ${riskLevel}`, font: { size: 9 }, textColor: riskColor },
        {
          type: 'stack',
          direction: 'row',
          justifyContent: 'center',
          gap: 6,
          marginTop: 4,
          children: [
            { type: 'text', text: `NF ${nf}`, font: { size: 9 } },
            { type: 'text', text: `DP ${dp}`, font: { size: 9 } },
            { type: 'text', text: `GPT ${gpt}`, font: { size: 9 } }
          ]
        }
      ]
    };
  }

  // =========================
  // 📗 中尺寸（左右布局 + 左右最下层解锁）
  // =========================
  if (widgetFamily === 'systemMedium') {
    return {
      type: 'widget',
      padding: 16,
      backgroundColor: C.card,
      cornerRadius: 16,
      children: [
        // Header
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 8,
          children: [
            { type: 'image', src: 'sf-symbol:network', color: C.accent, width: 18, height: 18 },
            { type: 'text', text: '网络诊断', font: { size: 16, weight: 'bold' }, textColor: C.text },
            { type: 'spacer' },
            { type: 'text', text: timeStr, font: { size: 11 }, textColor: C.sub }
          ]
        },
        { type: 'spacer', length: 16 },

        // 左右布局：本地网络 + 代理网络（各列最下层放解锁信息）
        {
          type: 'stack',
          direction: 'row',
          gap: 16,
          flex: 1,
          children: [
            // 左列：本地网络（全显示） + 影视解锁（最下层）
            {
              type: 'stack',
              direction: 'column',
              gap: 12,
              flex: 1,
              children: [
                // 本地网络（全显示）
                {
                  type: 'stack',
                  direction: 'column',
                  gap: 6,
                  children: [
                    { type: 'text', text: '📶 本地网络', font: { size: 12, weight: 'semibold' }, textColor: C.accent },
                    { type: 'text', text: `类型：${netType}`, font: { size: 11 }, textColor: C.text },
                    { type: 'text', text: `内网IP：${localInnerIP}`, font: { size: 11 }, textColor: C.sub, maxLines: 1 },
                    { type: 'text', text: `公网IP：${localPublicIP}`, font: { size: 11 }, textColor: C.sub, maxLines: 1 },
                    { type: 'text', text: `位置：${localLocation}`, font: { size: 11 }, textColor: C.sub, maxLines: 1 },
                    { type: 'text', text: `运营商：${localISP}`, font: { size: 11 }, textColor: C.sub, maxLines: 1 }
                  ]
                },
                { type: 'spacer', flex: 1 }, // 推到最下层
                // 影视解锁（简化）
                {
                  type: 'stack',
                  direction: 'column',
                  gap: 6,
                  children: [
                    { type: 'text', text: '🎬 影视解锁', font: { size: 12, weight: 'semibold' }, textColor: C.accent },
                    { type: 'text', text: `NF ${nf}  DP ${dp}  TK ${tk}  YT ${yt}`, font: { size: 11 }, textColor: C.text }
                  ]
                }
              ]
            },

            // 分隔线
            { type: 'stack', width: 0.5, backgroundColor: C.sub },

            // 右列：代理网络（全显示） + AI解锁（最下层）
            {
              type: 'stack',
              direction: 'column',
              gap: 12,
              flex: 1,
              children: [
                // 代理网络（全显示）
                {
                  type: 'stack',
                  direction: 'column',
                  gap: 6,
                  children: [
                    { type: 'text', text: '🌐 代理网络', font: { size: 12, weight: 'semibold' }, textColor: C.purple },
                    { type: 'text', text: `出口IP：${proxyIP}`, font: { size: 11 }, textColor: C.text, maxLines: 1 },
                    { type: 'text', text: `ISP：${proxyISP}`, font: { size: 11 }, textColor: C.sub, maxLines: 1 },
                    { type: 'text', text: `属性：${isResidential}`, font: { size: 11 }, textColor: C.text },
                    { type: 'text', text: `纯净度：${riskLevel}`, font: { size: 11, weight: 'medium' }, textColor: riskColor }
                  ]
                },
                { type: 'spacer', flex: 1 }, // 推到最下层
                // AI解锁（简化）
                {
                  type: 'stack',
                  direction: 'column',
                  gap: 6,
                  children: [
                    { type: 'text', text: '🤖 AI解锁', font: { size: 12, weight: 'semibold' }, textColor: C.purple },
                    { type: 'text', text: `GPT ${gpt}  CL ${cl}  GM ${gm}`, font: { size: 11 }, textColor: C.text }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
  }

  // =========================
  // 📘 大尺寸（全显示，无省略）
  // =========================
  return {
    type: 'widget',
    padding: 20,
    backgroundColor: C.card,
    cornerRadius: 20,
    children: [
      // Header
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 10,
        children: [
          { type: 'image', src: 'sf-symbol:waveform.path.ecg', color: C.accent, width: 22, height: 22 },
          { type: 'text', text: '🛡️ 网络诊断雷达', font: { size: 18, weight: 'heavy' }, textColor: C.text },
          { type: 'spacer' },
          { type: 'text', text: `策略：${policy || '自动分流'}`, font: { size: 11 }, textColor: C.sub },
          { type: 'text', text: timeStr, font: { size: 11 }, textColor: C.sub }
        ]
      },
      { type: 'spacer', length: 20 },

      // 主内容网格
      {
        type: 'stack',
        direction: 'row',
        gap: 24,
        flex: 1,
        children: [
          // 左列：本地网络 + 影视解锁
          {
            type: 'stack',
            direction: 'column',
            gap: 16,
            flex: 1,
            children: [
              { type: 'text', text: '📶 本地网络', font: { size: 14, weight: 'bold' }, textColor: C.accent },
              { type: 'text', text: `类型：${netType}`, font: { size: 12 }, textColor: C.text },
              { type: 'text', text: `内网IP：${localInnerIP}`, font: { size: 12 }, textColor: C.sub, maxLines: 1 },
              { type: 'text', text: `公网IP：${localPublicIP}`, font: { size: 12 }, textColor: C.sub, maxLines: 1 },
              { type: 'text', text: `位置：${localLocation}`, font: { size: 12 }, textColor: C.sub, maxLines: 1 },
              { type: 'text', text: `运营商：${localISP}`, font: { size: 12 }, textColor: C.sub, maxLines: 1 },
              { type: 'spacer' },
              { type: 'text', text: '🎬 影视解锁', font: { size: 14, weight: 'bold' }, textColor: C.accent },
              { type: 'text', text: `Netflix：${nf} ${getFlag(proxyCountry)}`, font: { size: 12 }, textColor: C.text },
              { type: 'text', text: `Disney+：${dp} ${getFlag(proxyCountry)}`, font: { size: 12 }, textColor: C.text },
              { type: 'text', text: `TikTok：${tk} ${getFlag(proxyCountry)}`, font: { size: 12 }, textColor: C.text },
              { type: 'text', text: `YouTube：${yt} ${getFlag(proxyCountry)}`, font: { size: 12 }, textColor: C.text }
            ]
          },

          // 分隔线
          { type: 'stack', width: 1, backgroundColor: { light: '#E5E5EA', dark: '#48484A' } },

          // 右列：代理网络 + AI解锁
          {
            type: 'stack',
            direction: 'column',
            gap: 16,
            flex: 1,
            children: [
              { type: 'text', text: '🌐 代理网络', font: { size: 14, weight: 'bold' }, textColor: C.purple },
              { type: 'text', text: `出口IP：${proxyIP}`, font: { size: 12 }, textColor: C.text, maxLines: 1 },
              { type: 'text', text: `ISP：${proxyISP}`, font: { size: 12 }, textColor: C.sub, maxLines: 1 },
              { type: 'text', text: `属性：${isResidential}`, font: { size: 12 }, textColor: C.text },
              { type: 'text', text: `纯净度：${riskLevel}`, font: { size: 12, weight: 'medium' }, textColor: riskColor },
              { type: 'text', text: `风险分：${fraudScore}`, font: { size: 12 }, textColor: C.sub },
              { type: 'spacer' },
              { type: 'text', text: '🤖 AI解锁', font: { size: 14, weight: 'bold' }, textColor: C.purple },
              { type: 'text', text: `ChatGPT：${gpt} ${getFlag(proxyCountry)}`, font: { size: 12 }, textColor: C.text },
              { type: 'text', text: `Claude：${cl} ${getFlag(proxyCountry)}`, font: { size: 12 }, textColor: C.text },
              { type: 'text', text: `Gemini：${gm} ${getFlag(proxyCountry)}`, font: { size: 12 }, textColor: C.text }
            ]
          }
        ]
      }
    ]
  };
}
