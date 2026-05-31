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
  // 颜色定义（遵循文档规范）
  // =========================
  const BG_COLOR = { light: '#FFFFFF', dark: '#2C2C2E' };
  const C_TITLE = { light: '#1A1A1A', dark: '#FFD700' };
  const C_SUB = { light: '#666666', dark: '#B0B0B0' };
  const C_MAIN = { light: '#1A1A1A', dark: '#FFFFFF' };
  const C_GREEN = { light: '#32D74B', dark: '#32D74B' };
  const C_RED = { light: '#FF3B30', dark: '#FF3B30' };
  const C_ICON = { light: '#007AFF', dark: '#0A84FF' };

  // =========================
  // 小尺寸组件处理（文档要求）
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
    if (policy && policy.trim() !== "") {
      opts.policy = policy;
    }
    return opts;
  }

  // =========================
  // HTTP 请求封装（错误处理）
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

  async function safePost(url, body, headers = {}, timeout = 6000) {
    try {
      const opts = withPolicy({ timeout, body, headers });
      const res = await ctx.http.post(url, opts);
      return await res.text();
    } catch (e) {
      return null;
    }
  }

  function parseJSON(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  // =========================
  // 流媒体检测函数（修复URL）
  // =========================
  async function checkChatGPT() {
    try {
      // 使用完整的URL
      const trace = await safeGet("https://chatgpt.com/cdn-cgi/trace");
      if (!trace) return "Cross";
      
      const locMatch = trace.match(/loc=([A-Z]{2})/);
      return locMatch ? locMatch[1] : "OK";
    } catch (e) {
      return "Cross";
    }
  }

  async function checkGemini() {
    try {
      const body = 'f.req=[["K4WWud","[[0],[\\"en-US\\"]]",null,"generic"]]';
      const headers = {
        "User-Agent": BASE_UA,
        "Content-Type": "application/x-www-form-urlencoded"
      };
      
      const response = await safePost("https://gemini.google.com/_/BardChatUi/data/batchexecute", body, headers);
      if (!response) return "Cross";
      
      const countryMatch = response.match(/"countryCode"\s*:\s*"([A-Z]{2})"/i);
      return countryMatch ? countryMatch[1].toUpperCase() : "OK";
    } catch (e) {
      return "Cross";
    }
  }

  async function checkYouTube() {
    try {
      const html = await safeGet("https://www.youtube.com/premium", {
        "User-Agent": BASE_UA,
        "Accept-Language": "en"
      });
      
      if (!html) return "Cross";
      if (html.includes('Premium is not available')) return "Cross";
      return "OK";
    } catch (e) {
      return "Cross";
    }
  }

  async function checkNetflix() {
    try {
      const html = await safeGet("https://www.netflix.com/title/81280792", {
        "User-Agent": BASE_UA
      });
      
      if (!html) return "Cross";
      if (html.includes('title-not-available') || html.includes('page-404')) return "Cross";
      return "OK";
    } catch (e) {
      return "Cross";
    }
  }

  async function checkTikTok() {
    try {
      const html = await safeGet("https://www.tiktok.com/", {
        "User-Agent": BASE_UA
      });
      
      if (!html) return "Cross";
      if (html.includes('Please wait...')) return "Cross";
      return "OK";
    } catch (e) {
      return "Cross";
    }
  }

  async function checkDisneyPlus() {
    try {
      const response = await safeGet("https://www.disneyplus.com/api/subscription/status", {
        "User-Agent": BASE_UA
      });
      
      if (!response) return "Cross";
      if (response.includes('"entitlements"')) return "OK";
      return "Cross";
    } catch (e) {
      return "Cross";
    }
  }

  async function checkSpotify() {
    try {
      const html = await safeGet("https://www.spotify.com/premium/", {
        "User-Agent": BASE_UA
      });
      
      if (!html) return "Cross";
      if (html.includes('Premium') && !html.includes('not available')) return "OK";
      return "Cross";
    } catch (e) {
      return "Cross";
    }
  }

  // =========================
  // IP信息获取（修复URL）
  // =========================
  
  // 本地IP（强制直连）
  let localIP = "获取失败";
  let localLocation = "未知位置";
  let localISP = "未知运营商";
  
  try {
    // 使用完整的URL
    const localResponse = await ctx.http.get("https://myip.ipip.net/json", {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 3000,
      policy: 'DIRECT'  // 📌 强制直连
    });
    
    const data = parseJSON(await localResponse.text());
    if (data?.data) {
      localIP = data.data.ip || "获取失败";
      const loc = data.data.location || [];
      localLocation = `${loc[0] || ""} ${loc[1] || ""} ${loc[2] || ""}`.trim() || "未知位置";
      localISP = loc[4] || loc[3] || "未知运营商";
    }
  } catch (e) {
    // 备用接口
    try {
      const backupResponse = await ctx.http.get("https://ipservice.ws.126.net/locate/api/getLocByIp", {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 3000,
        policy: 'DIRECT'  // 📌 强制直连
      });
      
      const backupData = parseJSON(await backupResponse.text());
      if (backupData?.result) {
        localIP = backupData.result.ip || "获取失败";
        localLocation = `${backupData.result.province || ""} ${backupData.result.city || ""}`.trim();
        localISP = backupData.result.operator || backupData.result.company || "未知运营商";
      }
    } catch (e2) {
      // 保持默认值
    }
  }

  // 落地IP（走策略组）
  let remoteIP = "获取失败";
  let remoteLocation = "未知位置";
  let isResidential = "未知";
  
  try {
    // 使用完整的URL
    const remoteResponse = await ctx.http.get("https://api.ipapi.is/?q=", withPolicy({ timeout: 4000 }));
    const data = parseJSON(await remoteResponse.text());
    
    if (data) {
      remoteIP = data.ip || "获取失败";
      remoteLocation = `${data.location?.country || ""} ${data.location?.city || ""}`.trim();
      isResidential = data.asn?.type === "isp" ? "🏠 原生住宅" : "🏢 商业机房";
    }
  } catch (e) {
    // 备用接口
    try {
      const backupResponse = await ctx.http.get("https://my.ippure.com/v1/info", withPolicy({ timeout: 4000 }));
      const backupData = parseJSON(await backupResponse.text());
      
      if (backupData) {
        remoteIP = backupData.ip || "获取失败";
        remoteLocation = `${backupData.country || ""} ${backupData.city || ""}`.trim();
        isResidential = backupData.isResidential === true ? "🏠 原生住宅" : "🏢 商业机房";
      }
    } catch (e2) {
      // 保持默认值
    }
  }

  // =========================
  // 流媒体解锁状态检测
  // =========================
  const [gpt, gemini, youtube, netflix, tiktok, disney, spotify] = await Promise.all([
    checkChatGPT(),
    checkGemini(),
    checkYouTube(),
    checkNetflix(),
    checkTikTok(),
    checkDisneyPlus(),
    checkSpotify()
  ]);

  // =========================
  // UI 渲染（遵循DSL规范）
  // =========================
  const SMALL_FONT = 10;
  const SMALL_ICON = 12;

  // 红绿灯行组件
  function UnlockRow(name, status) {
    const isAvailable = status !== "Cross";
    return {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      gap: 6,
      children: [
        {
          type: 'image',
          src: `sf-symbol:${isAvailable ? 'checkmark.circle.fill' : 'xmark.circle.fill'}`,
          color: isAvailable ? C_GREEN : C_RED,
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

  // 信息行组件
  function InfoRow(icon, label, value, valueColor = C_MAIN) {
    return {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      gap: 5,
      children: [
        { type: 'image', src: `sf-symbol:${icon}`, color: C_ICON, width: SMALL_ICON, height: SMALL_ICON },
        { type: 'text', text: label, font: { size: SMALL_FONT }, textColor: C_SUB },
        { type: 'spacer' },
        { type: 'text', text: value, font: { size: SMALL_FONT, weight: 'bold' }, textColor: valueColor, maxLines: 1, lineBreakMode: 'tail' }
      ]
    };
  }

  // 当前时间
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 判断是否为大尺寸
  const isLarge = widgetFamily === 'systemLarge';
  const padding = isLarge ? [10, 12] : [8, 10];

  return {
    type: 'widget',
    padding: padding,
    gap: 8,
    backgroundColor: BG_COLOR,
    children: [
      // 标题栏
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 4,
        children: [
          {
            type: 'text',
            text: `📡 数据中心`,
            font: { size: 13, weight: 'heavy' },
            textColor: C_TITLE,
            flex: 1
          },
          {
            type: 'text',
            text: `策略: ${policy || '未设置'}`,
            font: { size: 9 },
            textColor: C_SUB
          },
          {
            type: 'image',
            src: 'sf-symbol:arrow.clockwise',
            color: C_SUB,
            width: 10,
            height: 10
          },
          {
            type: 'text',
            text: timeStr,
            font: { size: 9 },
            textColor: C_SUB
          }
        ]
      },

      // IP信息
      {
        type: 'stack',
        direction: 'row',
        gap: 12,
        children: [
          {
            type: 'stack',
            direction: 'column',
            gap: 2.5,
            flex: 1,
            children: [
              InfoRow("house.fill", "本地IP：", localIP, C_GREEN),
              InfoRow("mappin.and.ellipse", "位置：", localLocation),
              InfoRow("simcard.fill", "运营商：", localISP)
            ]
          },
          {
            type: 'stack',
            direction: 'column',
            gap: 2.5,
            flex: 1,
            children: [
              InfoRow("network", "落地IP：", remoteIP, remoteIP !== "获取失败" ? C_GREEN : C_RED),
              InfoRow("map.fill", "位置：", remoteLocation),
              InfoRow("building.2.fill", "属性：", isResidential)
            ]
          }
        ]
      },

      // 分隔线
      {
        type: 'stack',
        height: 0.5,
        backgroundColor: { light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.12)' }
      },

      // 流媒体解锁状态
      {
        type: 'stack',
        direction: 'row',
        gap: 12,
        children: [
          {
            type: 'stack',
            direction: 'column',
            gap: 4,
            flex: 1,
            children: [
              UnlockRow("GPT", gpt),
              UnlockRow("Gemini", gemini),
              UnlockRow("YouTube", youtube),
              UnlockRow("Netflix", netflix)
            ]
          },
          {
            type: 'stack',
            direction: 'column',
            gap: 4,
            flex: 1,
            children: [
              UnlockRow("TikTok", tiktok),
              UnlockRow("Disney+", disney),
              UnlockRow("Spotify", spotify)
            ]
          }
        ]
      }
    ]
  };
}
