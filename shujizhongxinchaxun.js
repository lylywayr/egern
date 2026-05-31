export default async function(ctx) {
  // ============================================================
  // 📌 环境变量配置说明
  // ============================================================
  // 变量名: POLICY
  // 值: 填写Egern中的策略组名称（如：🚀 节点选择）
  // 作用: 落地IP检测和流媒体检测将使用此策略组
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
  // 小尺寸组件处理
  // =========================
  if (['systemSmall', 'accessoryCircular', 'accessoryInline', 'accessoryRectangular'].includes(widgetFamily)) {
    return {
      type: 'widget',
      padding: 16,
      backgroundColor: C.bg,
      children: [{
        type: 'text',
        text: '请使用中号或大号组件',
        font: { size: 'callout' },
        textColor: C.text,
        textAlign: 'center'
      }]
    };
  }

  const BASE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
  const commonHeaders = { "User-Agent": BASE_UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };

  // =========================
  // 策略组请求封装
  // =========================
  function withPolicy(opts = {}) {
    if (policy && policy.trim() !== "") {
      opts.policy = policy;
    }
    return opts;
  }

  // =========================
  // HTTP 请求封装
  // =========================
  async function safeGet(url, headers = {}, timeout = 6000) {
    try {
      const opts = withPolicy({ timeout, headers });
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
  // ISP 格式化
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

  const fmtProxyISP = (isp) => {
    if (!isp) return "未知";
    let s = String(isp);
    if (/it7/i.test(s)) return "IT7 Network";
    if (/dmit/i.test(s)) return "DMIT Network";
    if (/cloudflare/i.test(s)) return "Cloudflare";
    if (/akamai/i.test(s)) return "Akamai";
    if (/amazon|aws/i.test(s)) return "AWS";
    if (/google/i.test(s)) return "Google Cloud";
    if (/microsoft|azure/i.test(s)) return "Azure";
    if (/alibaba|aliyun/i.test(s)) return "阿里云";
    if (/tencent/i.test(s)) return "腾讯云";
    if (/oracle/i.test(s)) return "Oracle Cloud";
    return s.length > 11 ? s.substring(0, 11) + "..." : s;
  };

  const getFlag = (code) => {
    if (!code || code.toUpperCase() === 'TW') return '🇨🇳';
    if (code.toUpperCase() === 'XX' || code === 'OK') return '✅';
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
  };

  // =========================
  // 本地网络信息
  // =========================
  const d = ctx.device || {};
  const netInfo = (typeof $network !== 'undefined') ? $network : (ctx.network || {});
  
  let netName = "未连接", netIcon = "antenna.radiowaves.left.and.right";
  let localIp = netInfo.v4?.primaryAddress || d.ipv4?.address || "获取失败";
  let gateway = netInfo.v4?.primaryRouter || d.ipv4?.gateway || "无网关";

  const isWifi = !!d.wifi?.ssid;
  if (isWifi) {
    netName = d.wifi.ssid;
    netIcon = "wifi";
  } else if (d.cellular?.radio) {
    const radioMap = { "GPRS": "2.5G", "EDGE": "2.75G", "WCDMA": "3G", "LTE": "4G", "NR": "5G", "NRNSA": "5G" };
    netName = `${radioMap[d.cellular.radio.toUpperCase().replace(/\s+/g, "")] || d.cellular.radio}`;
    gateway = "蜂窝内网";
  }

  // =========================
  // 获取 IP 信息
  // =========================
  
  // 本地IP（强制直连）
  let localIP = "获取失败", localLocation = "未知位置", localISP = "未知运营商";
  try {
    const localResponse = await ctx.http.get("https://myip.ipip.net/json", {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 3000,
      policy: 'DIRECT'
    });
    
    const data = parseJSON(await localResponse.text());
    if (data?.data) {
      localIP = data.data.ip || "获取失败";
      const loc = data.data.location || [];
      localLocation = `${loc[0] || ""} ${loc[1] || ""} ${loc[2] || ""}`.trim() || "未知位置";
      localISP = fmtISP(loc[4] || loc[3] || "未知");
    }
  } catch (e) {
    try {
      const backupResponse = await ctx.http.get("https://ipservice.ws.126.net/locate/api/getLocByIp", {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 3000,
        policy: 'DIRECT'
      });
      
      const backupData = parseJSON(await backupResponse.text());
      if (backupData?.result) {
        localIP = backupData.result.ip || "获取失败";
        localLocation = `${backupData.result.province || ""} ${backupData.result.city || ""}`.trim();
        localISP = fmtISP(backupData.result.operator || backupData.result.company || "未知");
      }
    } catch (e2) {
      // 保持默认值
    }
  }

  // 落地IP（走策略组）
  let remoteIP = "获取失败", remoteLocation = "未知位置", remoteISP = "未知", remoteCountryCode = "XX";
  let isResidential = "未知", fraudScore = 0;
  
  try {
    const remoteResponse = await ctx.http.get("https://my.ippure.com/v1/info", withPolicy({ timeout: 4000 }));
    const data = parseJSON(await remoteResponse.text());
    
    if (data) {
      remoteIP = data.ip || "获取失败";
      remoteLocation = `${data.country || ""} ${data.city || ""}`.trim();
      remoteISP = fmtProxyISP(data.asOrganization || data.isp || "未知");
      remoteCountryCode = data.countryCode || "XX";
      isResidential = data.isResidential;
      fraudScore = data.fraudScore || 0;
    }
  } catch (e) {
    try {
      const backupResponse = await ctx.http.get("http://ip-api.com/json/?lang=zh-CN", withPolicy({ timeout: 4000 }));
      const backupData = parseJSON(await backupResponse.text());
      
      if (backupData) {
        remoteIP = backupData.query || "获取失败";
        remoteLocation = `${backupData.country || ""} ${backupData.city || ""}`.trim();
        remoteISP = fmtProxyISP(backupData.isp || backupData.org || "未知");
        remoteCountryCode = backupData.countryCode || "XX";
      }
    } catch (e2) {
      // 保持默认值
    }
  }

  // =========================
  // 延迟检测
  // =========================
  async function checkDelay(url, timeout = 2000) {
    const start = Date.now();
    try {
      await ctx.http.get(url, { timeout, policy: 'DIRECT' });
      return `${Date.now() - start} ms`;
    } catch (e) {
      return "超时";
    }
  }

  async function checkProxyDelay(url, timeout = 2000) {
    const start = Date.now();
    try {
      await ctx.http.get(url, withPolicy({ timeout }));
      return `${Date.now() - start} ms`;
    } catch (e) {
      return "超时";
    }
  }

  const [localDelay, proxyDelay] = await Promise.all([
    checkDelay('http://www.baidu.com'),
    checkProxyDelay('http://cp.cloudflare.com/generate_204')
  ]);

  // =========================
  // 流媒体解锁检测
  // =========================
  async function checkNetflix() {
    try {
      const checkStatus = async (id) => {
        const r = await ctx.http.get(`https://www.netflix.com/title/${id}`, 
          withPolicy({ timeout: 4000, headers: commonHeaders, followRedirect: false })).catch(() => null);
        return r ? r.status : 0;
      };
      
      const sFull = await checkStatus(70143836);
      const sOrig = await checkStatus(81280792);
      
      if (sFull === 200) return "OK";
      if (sOrig === 200) return "🍿";
      return "❌";
    } catch {
      return "❌";
    }
  }

  async function checkDisney() {
    try {
      const res = await ctx.http.get("https://www.disneyplus.com", 
        withPolicy({ timeout: 4000, headers: commonHeaders, followRedirect: false })).catch(() => null);
      
      if (!res || res.status === 403) return "❌";
      const loc = res.headers?.location || res.headers?.Location || "";
      if (loc.includes("unavailable")) return "❌";
      return "OK";
    } catch {
      return "❌";
    }
  }

  async function checkTikTok() {
    try {
      const r = await ctx.http.get("https://www.tiktok.com/explore", 
        withPolicy({ timeout: 4000, headers: commonHeaders, followRedirect: false })).catch(() => null);
      
      if (!r || r.status === 403 || r.status === 401) return "❌";
      const body = await safeGet("https://www.tiktok.com/explore", commonHeaders);
      if (body.includes("Access Denied") || body.includes("Please wait...")) return "❌";
      
      const m = body.match(/"region":"([A-Z]{2})"/i);
      return m?.[1] ? m[1].toUpperCase() : "OK";
    } catch {
      return "❌";
    }
  }

  async function checkYouTube() {
    try {
      const html = await safeGet("https://www.youtube.com/premium", { "User-Agent": BASE_UA, "Accept-Language": "en" });
      if (!html) return "❌";
      if (html.includes('Premium is not available')) return "❌";
      return "OK";
    } catch {
      return "❌";
    }
  }

  // =========================
  // AI 解锁检测
  // =========================
  async function checkChatGPT() {
    try {
      const trace = await safeGet("https://chatgpt.com/cdn-cgi/trace");
      if (!trace) return "❌";
      
      const m = trace.match(/loc=([A-Z]{2})/);
      return m?.[1] ? m[1].toUpperCase() : "OK";
    } catch {
      return "❌";
    }
  }

  async function checkClaude() {
    try {
      const res = await ctx.http.get("https://claude.ai/login", 
        withPolicy({ 
          timeout: 5000, 
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        })).catch(() => null);
      
      if (!res) return "❌";
      const status = res.status;
      const body = await safeGet("https://claude.ai/login");
      
      if (body.includes("App unavailable") || body.includes("certain regions")) return "❌";
      if (status === 403 && body.includes("1020")) return "❌";
      if (status === 403 && (body.includes("cf-turnstile") || body.includes("Just a moment") || body.includes("Challenge"))) return "OK";
      if (status === 200 || status === 301 || status === 302) return "OK";
      return "❌";
    } catch {
      return "❌";
    }
  }

  async function checkGemini() {
    try {
      const res = await ctx.http.get("https://gemini.google.com/app", 
        withPolicy({ timeout: 4000, headers: commonHeaders, followRedirect: false })).catch(() => null);
      
      if (!res) return "❌";
      const loc = res.headers?.location || res.headers?.Location || "";
      if (loc.includes("faq")) return "❌";
      return "OK";
    } catch {
      return "❌";
    }
  }

  // =========================
  // 并发执行所有检测
  // =========================
  const [rNF, rDP, rTK, rYT, rGPT, rCL, rGM] = await Promise.all([
    checkNetflix(),
    checkDisney(),
    checkTikTok(),
    checkYouTube(),
    checkChatGPT(),
    checkClaude(),
    checkGemini()
  ]);

  // =========================
  // 数据处理与格式化
  // =========================
  let nativeText = "未知属性", nativeIc = "questionmark.building.fill", nativeCol = C.dim;
  if (isResidential === true) { 
    nativeText = "原生住宅"; 
    nativeIc = "house.fill"; 
    nativeCol = C.netRx; 
  } else if (isResidential === false) { 
    nativeText = "商业机房"; 
    nativeIc = "building.2.fill"; 
    nativeCol = C.disk; 
  }

  let riskTxt = "无数据", riskCol = C.dim, riskIc = "questionmark.circle.fill";
  if (fraudScore !== undefined) {
    if (fraudScore >= 70) { 
      riskTxt = `高危 (${fraudScore})`; 
      riskCol = C.red; 
      riskIc = "xmark.shield.fill"; 
    } else if (fraudScore >= 30) { 
      riskTxt = `中危 (${fraudScore})`; 
      riskCol = C.disk; 
      riskIc = "exclamationmark.triangle.fill"; 
    } else { 
      riskTxt = `纯净 (${fraudScore})`; 
      riskCol = C.netRx; 
      riskIc = "checkmark.shield.fill"; 
    }
  }

  const fmtUnlock = (name, res, cc) => {
    let flag = "🚫";
    if (res === "🍿" || res === "APP") flag = res;
    else if (res !== "❌") flag = getFlag(res === "OK" || res === "XX" ? cc : res);
    return `${name} ${flag}`;
  };

  const textVideo = `${fmtUnlock('NF', rNF, remoteCountryCode)} ${fmtUnlock('DP', rDP, remoteCountryCode)} ${fmtUnlock('TK', rTK, remoteCountryCode)} ${fmtUnlock('YT', rYT, remoteCountryCode)}`;
  const textAI = `${fmtUnlock('GPT', rGPT, remoteCountryCode)} ${fmtUnlock('CL', rCL, remoteCountryCode)} ${fmtUnlock('GM', rGM, remoteCountryCode)}`;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const TIME_COL = { light: 'rgba(0,0,0,0.3)', dark: 'rgba(255,255,255,0.3)' };

  // =========================
  // UI 组件
  // =========================
  const Row = (ic, icCol, label, val, valCol) => ({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 5,
    children: [
      { type: 'image', src: `sf-symbol:${ic}`, color: icCol, width: 11, height: 11 },
      { type: 'text', text: label, font: { size: 10, weight: 'regular' }, textColor: C.dim, maxLines: 1 },
      { type: 'spacer' },
      { type: 'text', text: val, font: { size: 10, weight: 'medium' }, textColor: valCol, maxLines: 1, minScale: 0.4 }
    ]
  });

  // =========================
  // 最终渲染
  // =========================
  return {
    type: 'widget',
    padding: 14,
    backgroundColor: C.bg,
    children: [
      // 顶部 Header
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          { type: 'image', src: 'sf-symbol:waveform.path.ecg', color: C.text, width: 16, height: 16 },
          { type: 'text', text: '网络诊断雷达', font: { size: 14, weight: 'bold' }, textColor: C.text },
          { type: 'spacer' },
          { type: 'text', text: `策略: ${policy || '未设置'}`, font: { size: 9 }, textColor: C.dim },
          { type: 'text', text: timeStr, font: { size: 10, weight: 'medium' }, textColor: TIME_COL }
        ]
      },
      { type: 'spacer', length: 12 },
      
      // 双列网格
      {
        type: 'stack',
        direction: 'row',
        gap: 10,
        children: [
          // 【左列】：本地网络与影视解锁
          {
            type: 'stack',
            direction: 'column',
            gap: 4.5,
            flex: 1,
            children: [
              Row(netIcon, C.cpu, "网络环境", netName, C.text),
              Row("wifi.router.fill", C.cpu, "网关", gateway, C.text),
              Row("iphone", C.cpu, "内网IP", localIp, C.text),
              Row("globe.asia.australia.fill", C.cpu, "公网IP", localIP, C.text),
              Row("map.fill", C.cpu, "位置", localLocation, C.text),
              Row("timer", C.cpu, "本地延迟", localDelay, C.text),
              Row("play.tv.fill", C.cpu, "影视解锁", textVideo, C.text)
            ]
          },
          
          // 中轴线
          { type: 'stack', width: 0.5, backgroundColor: C.barBg },
          
          // 【右列】：代理网络与AI解锁
          {
            type: 'stack',
            direction: 'column',
            gap: 4.5,
            flex: 1,
            children: [
              Row("paperplane.fill", C.mem, "出口IP", remoteIP, C.text),
              Row("mappin.and.ellipse", C.mem, "落地位置", remoteLocation, C.text),
              Row("server.rack", C.mem, "服务商", remoteISP, C.text),
              Row(nativeIc, nativeCol, "IP属性", nativeText, nativeCol),
              Row(riskIc, riskCol, "风险评分", riskTxt, riskCol),
              Row("timer", C.mem, "代理延迟", proxyDelay, C.text),
              Row("cpu", C.mem, "AI解锁", textAI, C.text)
            ]
          }
        ]
      },
      { type: 'spacer' }
    ]
  };
}
