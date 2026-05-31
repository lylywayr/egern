export default async function(ctx) {
  // ============================================================
  // 📌 环境变量配置
  // POLICY: 指定策略组名称（可选）
  // ============================================================
  const policy = ctx.env.POLICY || "";
  const widgetFamily = ctx.widgetFamily || 'systemMedium';

  // =========================
  // 现代化 UI 颜色方案
  // =========================
  const C = {
    bg: { light: '#F2F2F7', dark: '#000000' },
    card: { light: '#FFFFFF', dark: '#1C1C1E' },
    text: { light: '#000000', dark: '#FFFFFF' },
    subtext: { light: '#8E8E93', dark: '#8E8E93' },
    accent: { light: '#007AFF', dark: '#0A84FF' },
    green: { light: '#34C759', dark: '#30D158' },
    orange: { light: '#FF9500', dark: '#FF9F0A' },
    red: { light: '#FF3B30', dark: '#FF453A' },
    purple: { light: '#AF52DE', dark: '#BF5AF2' }
  };

  // =========================
  // 策略组路由处理
  // =========================
  function withPolicy(opts = {}) {
    // 只有在明确设置了POLICY时才指定策略组
    if (policy && policy.trim() !== "") {
      opts.policy = policy;
    }
    // 否则不设置policy，让Egern按正常分流规则处理
    return opts;
  }

  // =========================
  // HTTP 请求封装
  // =========================
  async function safeGet(url, options = {}) {
    try {
      const opts = { timeout: 5000, ...options };
      const res = await ctx.http.get(url, opts);
      return await res.text();
    } catch (e) {
      return null;
    }
  }

  function parseJSON(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  // =========================
  // 网络信息获取
  // =========================
  const d = ctx.device || {};
  const netInfo = (typeof $network !== 'undefined') ? $network : (ctx.network || {});
  
  // 本地网络信息
  let netName = "离线", netIcon = "wifi.slash";
  let localIp = netInfo.v4?.primaryAddress || d.ipv4?.address || "N/A";
  
  const isWifi = !!d.wifi?.ssid;
  if (isWifi) {
    netName = d.wifi.ssid;
    netIcon = "wifi";
  } else if (d.cellular?.radio) {
    const radioMap = { "GPRS": "2G", "EDGE": "2.5G", "WCDMA": "3G", "LTE": "4G", "NR": "5G" };
    netName = radioMap[d.cellular.radio.toUpperCase()] || d.cellular.radio;
    netIcon = "antenna.radiowaves.left.and.right";
  }

  // 本地IP（强制直连）
  let localPublicIP = "获取中...";
  try {
    const res = await ctx.http.get("https://myip.ipip.net/json", {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 3000,
      policy: 'DIRECT'  // 本地IP强制直连
    });
    const data = parseJSON(await res.text());
    if (data?.data) {
      localPublicIP = data.data.ip;
    }
  } catch (e) {
    localPublicIP = "N/A";
  }

  // 代理IP（走策略组或正常分流）
  let proxyIP = "获取中...";
  try {
    const res = await ctx.http.get("https://api.ipify.org?format=json", 
      withPolicy({ timeout: 3000 }));  // 使用策略组或正常分流
    const data = parseJSON(await res.text());
    proxyIP = data?.ip || "N/A";
  } catch (e) {
    proxyIP = "N/A";
  }

  // =========================
  // 解锁检测（按需执行）
  // =========================
  async function checkBasicUnlocks() {
    const results = {};
    
    // Netflix 检测
    try {
      const res = await safeGet("https://www.netflix.com/title/81280792", 
        withPolicy({ timeout: 3000 }));
      results.nf = res && !res.includes('page-404') ? "✅" : "❌";
    } catch { results.nf = "❌"; }
    
    // Disney+ 检测
    try {
      const res = await safeGet("https://www.disneyplus.com", 
        withPolicy({ timeout: 3000 }));
      results.dp = res && !res.includes('unavailable') ? "✅" : "❌";
    } catch { results.dp = "❌"; }
    
    // ChatGPT 检测
    try {
      const res = await safeGet("https://chatgpt.com/cdn-cgi/trace", 
        withPolicy({ timeout: 3000 }));
      results.gpt = res && res.includes('loc=') ? "✅" : "❌";
    } catch { results.gpt = "❌"; }
    
    return results;
  }

  async function checkFullUnlocks() {
    const basic = await checkBasicUnlocks();
    const results = { ...basic };
    
    // TikTok 检测
    try {
      const res = await safeGet("https://www.tiktok.com/explore", 
        withPolicy({ timeout: 3000 }));
      results.tk = res && !res.includes('Access Denied') ? "✅" : "❌";
    } catch { results.tk = "❌"; }
    
    // YouTube 检测
    try {
      const res = await safeGet("https://www.youtube.com/premium", 
        withPolicy({ timeout: 3000 }));
      results.yt = res && !res.includes('not available') ? "✅" : "❌";
    } catch { results.yt = "❌"; }
    
    // Claude 检测
    try {
      const res = await safeGet("https://claude.ai/login", 
        withPolicy({ timeout: 3000 }));
      results.cl = res && !res.includes('App unavailable') ? "✅" : "❌";
    } catch { results.cl = "❌"; }
    
    // Gemini 检测
    try {
      const res = await safeGet("https://gemini.google.com/app", 
        withPolicy({ timeout: 3000 }));
      results.gm = res && !res.includes('faq') ? "✅" : "❌";
    } catch { results.gm = "❌"; }
    
    return results;
  }

  // 根据尺寸决定检测哪些解锁
  const unlocks = widgetFamily === 'systemLarge' 
    ? await checkFullUnlocks() 
    : await checkBasicUnlocks();

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // =========================
  // 📱 小尺寸组件 - 极简风格
  // =========================
  if (widgetFamily === 'systemSmall') {
    return {
      type: 'widget',
      padding: 12,
      backgroundColor: C.card,
      cornerRadius: 12,
      children: [
        // 顶部：网络状态
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 6,
          children: [
            { type: 'image', src: `sf-symbol:${netIcon}`, color: C.accent, width: 14, height: 14 },
            { type: 'text', text: netName, font: { size: 11, weight: 'medium' }, textColor: C.text, maxLines: 1 }
          ]
        },
        { type: 'spacer', length: 8 },
        
        // 中间：IP信息
        {
          type: 'stack',
          direction: 'column',
          alignItems: 'center',
          gap: 4,
          children: [
            { type: 'text', text: `📍 ${localPublicIP}`, font: { size: 10 }, textColor: C.subtext },
            { type: 'text', text: `🚀 ${proxyIP}`, font: { size: 10 }, textColor: C.purple }
          ]
        },
        { type: 'spacer', length: 8 },
        
        // 底部：解锁状态
        {
          type: 'stack',
          direction: 'row',
          justifyContent: 'center',
          gap: 8,
          children: [
            { type: 'text', text: `NF ${unlocks.nf}`, font: { size: 10 } },
            { type: 'text', text: `DP ${unlocks.dp}`, font: { size: 10 } },
            { type: 'text', text: `GPT ${unlocks.gpt}`, font: { size: 10 } }
          ]
        }
      ]
    };
  }

  // =========================
  // 📗 中尺寸组件 - 网络全显，解锁简化
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
            { type: 'text', text: timeStr, font: { size: 11 }, textColor: C.subtext }
          ]
        },
        { type: 'spacer', length: 16 },
        
        // 网络信息（全显示）
        {
          type: 'stack',
          direction: 'row',
          gap: 16,
          children: [
            // 左列：本地网络
            {
              type: 'stack',
              direction: 'column',
              gap: 6,
              flex: 1,
              children: [
                { type: 'text', text: '📶 本地网络', font: { size: 12, weight: 'semibold' }, textColor: C.accent },
                { type: 'text', text: `网络: ${netName}`, font: { size: 11 }, textColor: C.text, maxLines: 1 },
                { type: 'text', text: `内网: ${localIp}`, font: { size: 11 }, textColor: C.subtext, maxLines: 1 },
                { type: 'text', text: `公网: ${localPublicIP}`, font: { size: 11 }, textColor: C.subtext, maxLines: 1 }
              ]
            },
            
            // 右列：代理网络
            {
              type: 'stack',
              direction: 'column',
              gap: 6,
              flex: 1,
              children: [
                { type: 'text', text: '🌐 代理网络', font: { size: 12, weight: 'semibold' }, textColor: C.purple },
                { type: 'text', text: `策略: ${policy || '自动分流'}`, font: { size: 11 }, textColor: C.text, maxLines: 1 },
                { type: 'text', text: `出口: ${proxyIP}`, font: { size: 11 }, textColor: C.subtext, maxLines: 1 },
                { type: 'text', text: `状态: ${proxyIP !== 'N/A' ? '已连接' : '未连接'}`, font: { size: 11 }, textColor: proxyIP !== 'N/A' ? C.green : C.red }
              ]
            }
          ]
        },
        
        { type: 'spacer', length: 16 },
        
        // 解锁状态（简化）
        {
          type: 'stack',
          direction: 'row',
          justifyContent: 'space-around',
          children: [
            { type: 'text', text: `Netflix ${unlocks.nf}`, font: { size: 12, weight: 'medium' }, textColor: C.text },
            { type: 'text', text: `Disney+ ${unlocks.dp}`, font: { size: 12, weight: 'medium' }, textColor: C.text },
            { type: 'text', text: `ChatGPT ${unlocks.gpt}`, font: { size: 12, weight: 'medium' }, textColor: C.text }
          ]
        }
      ]
    };
  }

  // =========================
  // 📘 大尺寸组件 - 全部不简化
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
          { type: 'text', text: `策略: ${policy || '自动分流'}`, font: { size: 11 }, textColor: C.subtext },
          { type: 'text', text: timeStr, font: { size: 11 }, textColor: C.subtext }
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
              // 本地网络
              {
                type: 'stack',
                direction: 'column',
                gap: 8,
                children: [
                  { type: 'text', text: '📶 本地网络', font: { size: 14, weight: 'bold' }, textColor: C.accent },
                  { type: 'text', text: `环境: ${netName}`, font: { size: 12 }, textColor: C.text },
                  { type: 'text', text: `内网IP: ${localIp}`, font: { size: 12 }, textColor: C.subtext, maxLines: 1 },
                  { type: 'text', text: `公网IP: ${localPublicIP}`, font: { size: 12 }, textColor: C.subtext, maxLines: 1 }
                ]
              },
              
              // 影视解锁
              {
                type: 'stack',
                direction: 'column',
                gap: 8,
                children: [
                  { type: 'text', text: '📺 影视解锁', font: { size: 14, weight: 'bold' }, textColor: C.accent },
                  { type: 'text', text: `Netflix: ${unlocks.nf}`, font: { size: 12 }, textColor: C.text },
                  { type: 'text', text: `Disney+: ${unlocks.dp}`, font: { size: 12 }, textColor: C.text },
                  { type: 'text', text: `TikTok: ${unlocks.tk}`, font: { size: 12 }, textColor: C.text },
                  { type: 'text', text: `YouTube: ${unlocks.yt}`, font: { size: 12 }, textColor: C.text }
                ]
              }
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
              // 代理网络
              {
                type: 'stack',
                direction: 'column',
                gap: 8,
                children: [
                  { type: 'text', text: '🌐 代理网络', font: { size: 14, weight: 'bold' }, textColor: C.purple },
                  { type: 'text', text: `出口IP: ${proxyIP}`, font: { size: 12 }, textColor: C.subtext, maxLines: 1 },
                  { type: 'text', text: `策略组: ${policy || '自动分流'}`, font: { size: 12 }, textColor: C.text, maxLines: 1 },
                  { type: 'text', text: `连接状态: ${proxyIP !== 'N/A' ? '✅ 已连接' : '❌ 未连接'}`, font: { size: 12 }, textColor: proxyIP !== 'N/A' ? C.green : C.red }
                ]
              },
              
              // AI解锁
              {
                type: 'stack',
                direction: 'column',
                gap: 8,
                children: [
                  { type: 'text', text: '🤖 AI 解锁', font: { size: 14, weight: 'bold' }, textColor: C.purple },
                  { type: 'text', text: `ChatGPT: ${unlocks.gpt}`, font: { size: 12 }, textColor: C.text },
                  { type: 'text', text: `Claude: ${unlocks.cl}`, font: { size: 12 }, textColor: C.text },
                  { type: 'text', text: `Gemini: ${unlocks.gm}`, font: { size: 12 }, textColor: C.text }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}
