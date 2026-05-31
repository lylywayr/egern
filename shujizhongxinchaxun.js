export default async function(ctx) {
  // ============================================================
  // 📌 环境变量配置
  // ============================================================
  const policy = ctx.env.POLICY || "";
  const widgetFamily = ctx.widgetFamily || 'systemMedium';

  // =========================
  // 统一 UI 规范颜色
  // =========================
  const C = {
    bg: { light: '#FFFFFF', dark: '#121212' },
    barBg: { light: '#0000001A', dark: '#FFFFFF22' },
    text: { light: '#1C1C1E', dark: '#FFFFFF' },
    dim: { light: '#8E8E93', dark: '#8E8E93' },
    cpu: { light: '#007AFF', dark: '#0A84FF' },
    mem: { light: '#AF52DE', dark: '#BF5AF2' },
    disk: { light: '#FF9500', dark: '#FF9F0A' },
    netRx: { light: '#34C759', dark: '#30D158' },
    netTx: { light: '#5856D6', dark: '#5E5CE6' },
    yellow: { light: '#FFCC00', dark: '#FFD60A' },
    red: { light: '#FF3B30', dark: '#FF453A' }
  };

  // =========================
  // 辅助函数
  // =========================
  function withPolicy(opts = {}) {
    if (policy && policy.trim() !== "") opts.policy = policy;
    return opts;
  }

  async function safeGet(url, headers = {}, timeout = 4000) {
    try {
      const opts = withPolicy({ timeout, headers });
      const res = await ctx.http.get(url, opts);
      return await res.text();
    } catch (e) { return null; }
  }

  function parseJSON(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  const fmtProxyISP = (isp) => {
    if (!isp) return "Unknown";
    let s = String(isp);
    if (/it7/i.test(s)) return "IT7";
    if (/dmit/i.test(s)) return "DMIT";
    if (/cloudflare/i.test(s)) return "CF";
    if (/amazon|aws/i.test(s)) return "AWS";
    if (/google/i.test(s)) return "GCP";
    if (/microsoft|azure/i.test(s)) return "Azure";
    if (/alibaba|aliyun/i.test(s)) return "Aliyun";
    if (/tencent/i.test(s)) return "Tencent";
    if (/oracle/i.test(s)) return "Oracle";
    return s.length > 8 ? s.substring(0, 8) + ".." : s;
  };

  const getFlag = (code) => {
    if (!code || code.toUpperCase() === 'TW') return '🇨🇳';
    if (code.toUpperCase() === 'XX' || code === 'OK') return '✅';
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
  };

  // =========================
  // 网络信息获取
  // =========================
  const d = ctx.device || {};
  const netInfo = (typeof $network !== 'undefined') ? $network : (ctx.network || {});
  
  let netName = "Offline", netIcon = "antenna.radiowaves.left.and.right";
  let localIp = netInfo.v4?.primaryAddress || d.ipv4?.address || "N/A";
  
  const isWifi = !!d.wifi?.ssid;
  if (isWifi) {
    netName = d.wifi.ssid;
    netIcon = "wifi";
  } else if (d.cellular?.radio) {
    const radioMap = { "GPRS": "2G", "EDGE": "2G", "WCDMA": "3G", "LTE": "4G", "NR": "5G", "NRNSA": "5G" };
    netName = radioMap[d.cellular.radio.toUpperCase().replace(/\s+/g, "")] || d.cellular.radio;
  }

  // 本地IP（直连）
  let localIP = "N/A";
  try {
    const res = await ctx.http.get("https://myip.ipip.net/json", { 
      headers: { 'User-Agent': 'Mozilla/5.0' }, 
      timeout: 3000, 
      policy: 'DIRECT' 
    });
    const data = parseJSON(await res.text());
    if (data?.data) localIP = data.data.ip;
  } catch (e) {}

  // 代理IP（走策略组）
  let remoteIP = "N/A", remoteISP = "Unknown";
  try {
    const res = await ctx.http.get("https://my.ippure.com/v1/info", withPolicy({ timeout: 4000 }));
    const data = parseJSON(await res.text());
    if (data) {
      remoteIP = data.ip || "N/A";
      remoteISP = fmtProxyISP(data.asOrganization || "Unknown");
    }
  } catch (e) {}

  // 解锁检测（简化版，确保速度）
  async function checkUnlock(url, keyword) {
    try {
      const res = await ctx.http.get(url, withPolicy({ timeout: 3000 }));
      const text = await res.text();
      return text.includes(keyword) ? "✅" : "❌";
    } catch { return "❌"; }
  }

  // 基础解锁检测
  const [nf, dp, gpt] = await Promise.all([
    checkUnlock("https://www.netflix.com/title/81280792", "page-404"),
    checkUnlock("https://www.disneyplus.com", "unavailable"),
    checkUnlock("https://chatgpt.com/cdn-cgi/trace", "loc=")
  ]);

  // 完整解锁检测（仅大组件使用）
  let fullUnlocks = { nf: "❌", dp: "❌", tk: "❌", yt: "❌", gpt: "❌", cl: "❌", gm: "❌" };
  if (widgetFamily === 'systemLarge') {
    const results = await Promise.all([
      checkUnlock("https://www.netflix.com/title/81280792", "page-404"),
      checkUnlock("https://www.disneyplus.com", "unavailable"),
      checkUnlock("https://www.tiktok.com/explore", "Access Denied"),
      checkUnlock("https://www.youtube.com/premium", "Premium is not available"),
      checkUnlock("https://chatgpt.com/cdn-cgi/trace", "loc="),
      checkUnlock("https://claude.ai/login", "App unavailable"),
      checkUnlock("https://gemini.google.com/app", "faq")
    ]);
    fullUnlocks = {
      nf: results[0], dp: results[1], tk: results[2], 
      yt: results[3], gpt: results[4], cl: results[5], gm: results[6]
    };
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // =========================
  // 📱 小尺寸组件 (systemSmall) - 仅基本信息
  // =========================
  if (widgetFamily === 'systemSmall') {
    return {
      type: 'widget',
      padding: 12,
      backgroundColor: C.bg,
      children: [
        // 顶部：网络状态
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 6,
          children: [
            { type: 'image', src: `sf-symbol:${netIcon}`, color: C.cpu, width: 14, height: 14 },
            { type: 'text', text: netName, font: { size: 10, weight: 'medium' }, textColor: C.text, maxLines: 1 }
          ]
        },
        { type: 'spacer', length: 6 },
        
        // 中间：IP信息（简化）
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          children: [
            { type: 'text', text: `📍 ${localIP}`, font: { size: 9 }, textColor: C.dim },
            { type: 'text', text: `🚀 ${remoteIP}`, font: { size: 9 }, textColor: C.mem }
          ]
        },
        
        // 底部：解锁状态（仅核心3项）
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
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
  // 📗 中尺寸组件 (systemMedium) - 网络全显，解锁简化
  // =========================
  if (widgetFamily === 'systemMedium') {
    return {
      type: 'widget',
      padding: 14,
      backgroundColor: C.bg,
      children: [
        // Header
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 6,
          children: [
            { type: 'image', src: 'sf-symbol:waveform.path.ecg', color: C.text, width: 16, height: 16 },
            { type: 'text', text: '网络诊断', font: { size: 14, weight: 'bold' }, textColor: C.text },
            { type: 'spacer' },
            { type: 'text', text: timeStr, font: { size: 10 }, textColor: C.dim }
          ]
        },
        { type: 'spacer', length: 10 },
        
        // 网络信息（全显示）
        {
          type: 'stack',
          direction: 'row',
          gap: 10,
          children: [
            // 左列：本地网络
            {
              type: 'stack',
              direction: 'column',
              gap: 4,
              flex: 1,
              children: [
                { type: 'text', text: '📶 本地网络', font: { size: 10, weight: 'semibold' }, textColor: C.cpu },
                { type: 'text', text: `${netName}`, font: { size: 9 }, textColor: C.text, maxLines: 1 },
                { type: 'text', text: `内网: ${localIp}`, font: { size: 9 }, textColor: C.dim, maxLines: 1 },
                { type: 'text', text: `公网: ${localIP}`, font: { size: 9 }, textColor: C.dim, maxLines: 1 }
              ]
            },
            
            // 分隔线
            { type: 'stack', width: 0.5, backgroundColor: C.barBg },
            
            // 右列：代理网络
            {
              type: 'stack',
              direction: 'column',
              gap: 4,
              flex: 1,
              children: [
                { type: 'text', text: '🌐 代理网络', font: { size: 10, weight: 'semibold' }, textColor: C.mem },
                { type: 'text', text: `策略: ${policy || 'Direct'}`, font: { size: 9 }, textColor: C.text, maxLines: 1 },
                { type: 'text', text: `出口: ${remoteIP}`, font: { size: 9 }, textColor: C.dim, maxLines: 1 },
                { type: 'text', text: `厂商: ${remoteISP}`, font: { size: 9 }, textColor: C.dim, maxLines: 1 }
              ]
            }
          ]
        },
        
        // 解锁状态（简化显示）
        {
          type: 'stack',
          direction: 'row',
          justifyContent: 'space-around',
          marginTop: 8,
          children: [
            { type: 'text', text: `NF ${nf}`, font: { size: 10, weight: 'medium' }, textColor: C.text },
            { type: 'text', text: `DP ${dp}`, font: { size: 10, weight: 'medium' }, textColor: C.text },
            { type: 'text', text: `GPT ${gpt}`, font: { size: 10, weight: 'medium' }, textColor: C.text }
          ]
        }
      ]
    };
  }

  // =========================
  // 📘 大尺寸组件 (systemLarge) - 全部不简化
  // =========================
  return {
    type: 'widget',
    padding: 16,
    backgroundColor: C.bg,
    children: [
      // Header
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 8,
        children: [
          { type: 'image', src: 'sf-symbol:waveform.path.ecg', color: C.text, width: 18, height: 18 },
          { type: 'text', text: '🛡️ 网络诊断雷达', font: { size: 16, weight: 'heavy' }, textColor: C.text },
          { type: 'spacer' },
          { type: 'text', text: `策略: ${policy || 'Direct'}`, font: { size: 9 }, textColor: C.dim },
          { type: 'text', text: timeStr, font: { size: 10 }, textColor: C.dim }
        ]
      },
      { type: 'spacer', length: 12 },
      
      // 主内容网格
      {
        type: 'stack',
        direction: 'row',
        gap: 16,
        flex: 1,
        children: [
          // 左列：本地网络（详细信息）
          {
            type: 'stack',
            direction: 'column',
            gap: 6,
            flex: 1,
            children: [
              { type: 'text', text: '📶 本地网络', font: { size: 11, weight: 'bold' }, textColor: C.cpu },
              { type: 'text', text: `环境: ${netName}`, font: { size: 10 }, textColor: C.text },
              { type: 'text', text: `内网: ${localIp}`, font: { size: 10 }, textColor: C.dim, maxLines: 1 },
              { type: 'text', text: `公网: ${localIP}`, font: { size: 10 }, textColor: C.dim, maxLines: 1 },
              { type: 'spacer' },
              { type: 'text', text: '📺 影视解锁', font: { size: 11, weight: 'bold' }, textColor: C.cpu },
              { type: 'text', text: `Netflix: ${fullUnlocks.nf}`, font: { size: 10 }, textColor: C.text },
              { type: 'text', text: `Disney+: ${fullUnlocks.dp}`, font: { size: 10 }, textColor: C.text },
              { type: 'text', text: `TikTok: ${fullUnlocks.tk}`, font: { size: 10 }, textColor: C.text },
              { type: 'text', text: `YouTube: ${fullUnlocks.yt}`, font: { size: 10 }, textColor: C.text }
            ]
          },
          
          // 分隔线
          { type: 'stack', width: 0.5, backgroundColor: C.barBg },
          
          // 右列：代理网络（详细信息）
          {
            type: 'stack',
            direction: 'column',
            gap: 6,
            flex: 1,
            children: [
              { type: 'text', text: '🌐 代理网络', font: { size: 11, weight: 'bold' }, textColor: C.mem },
              { type: 'text', text: `出口IP: ${remoteIP}`, font: { size: 10 }, textColor: C.dim, maxLines: 1 },
              { type: 'text', text: `服务商: ${remoteISP}`, font: { size: 10 }, textColor: C.dim, maxLines: 1 },
              { type: 'text', text: `策略组: ${policy || 'Direct'}`, font: { size: 10 }, textColor: C.dim, maxLines: 1 },
              { type: 'spacer' },
              { type: 'text', text: '🤖 AI 解锁', font: { size: 11, weight: 'bold' }, textColor: C.mem },
              { type: 'text', text: `ChatGPT: ${fullUnlocks.gpt}`, font: { size: 10 }, textColor: C.text },
              { type: 'text', text: `Claude: ${fullUnlocks.cl}`, font: { size: 10 }, textColor: C.text },
              { type: 'text', text: `Gemini: ${fullUnlocks.gm}`, font: { size: 10 }, textColor: C.text }
            ]
          }
        ]
      }
    ]
  };
}
