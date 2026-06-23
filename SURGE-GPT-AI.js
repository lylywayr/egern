// Surge 面板脚本：网络服务解锁监测（美化版）
// 适用 Surge 5+，支持 async/await

module.exports = async function() {
  // ----- 工具函数：HTTP GET -----
  function httpGet(url, options = {}) {
    return new Promise((resolve, reject) => {
      $httpClient.get(url, options, (err, resp, body) => {
        if (err) reject(err);
        else resolve({ status: resp.status, body });
      });
    });
  }

  // ----- Emoji 与状态标识 -----
  const EMOJI = {
    OK: '🟢',
    SLOW: '🟡',
    FAIL: '🔴',
    UNKNOWN: '⚪'
  };

  function statusEmoji(ms, available) {
    if (!available) return EMOJI.FAIL;
    if (ms >= 800) return EMOJI.SLOW;
    return EMOJI.OK;
  }

  // ----- 并发检测函数 -----
  const BASE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  const commonHeaders = { 'User-Agent': BASE_UA };

  async function fetchProxy() {
    try {
      const resp = await httpGet('http://ip-api.com/json/?lang=zh-CN', { timeout: 4000 });
      const data = JSON.parse(resp.body);
      const cc = data.countryCode || 'XX';
      return { code: cc === 'XX' ? 'ERR' : 'OK', cc };
    } catch {
      return { code: 'ERR', cc: 'XX' };
    }
  }

  async function checkNetflix() {
    try {
      const resp = await httpGet('https://www.netflix.com/title/70143836', {
        timeout: 4000,
        headers: commonHeaders,
        followRedirect: false
      });
      return { code: resp.status === 200 ? 'OK' : 'ERR' };
    } catch {
      return { code: 'ERR' };
    }
  }

  async function checkDisney() {
    try {
      const resp = await httpGet('https://www.disneyplus.com', {
        timeout: 4000,
        headers: commonHeaders,
        followRedirect: false
      });
      return { code: (resp.status && resp.status !== 403) ? 'OK' : 'ERR' };
    } catch {
      return { code: 'ERR' };
    }
  }

  async function checkChatGPT() {
    try {
      const resp = await httpGet('https://chatgpt.com/cdn-cgi/trace', { timeout: 3000 });
      const match = resp.body.match(/loc=([A-Z]{2})/);
      return match ? { code: match[1] } : { code: 'ERR' };
    } catch {
      return { code: 'ERR' };
    }
  }

  async function checkClaude() {
    try {
      await httpGet('https://claude.ai/login', { timeout: 5000, headers: commonHeaders });
      return { code: 'OK' };
    } catch {
      return { code: 'ERR' };
    }
  }

  async function checkGemini() {
    try {
      await httpGet('https://gemini.google.com/app', {
        timeout: 4000,
        headers: commonHeaders,
        followRedirect: false
      });
      return { code: 'OK' };
    } catch {
      return { code: 'ERR' };
    }
  }

  // ----- 带计时器执行 -----
  async function timed(fn) {
    const start = Date.now();
    try {
      const result = await fn();
      return { ...result, ms: Date.now() - start };
    } catch {
      return { code: 'ERR', ms: Date.now() - start };
    }
  }

  // ----- 执行检测 -----
  const [proxy, netflix, disney, chatgpt, claude, gemini] = await Promise.all([
    timed(fetchProxy),
    timed(checkNetflix),
    timed(checkDisney),
    timed(checkChatGPT),
    timed(checkClaude),
    timed(checkGemini)
  ]);

  // ----- 解析结果 -----
  const resultInfo = (result, fallbackRegion) => {
    const available = result.code !== 'ERR';
    const region = result.code === 'OK' ? fallbackRegion : result.code;
    return {
      available,
      region: available ? (region || 'XX') : '--',
      ms: result.ms
    };
  };

  const streaming = [
    { name: 'YouTube', info: { available: proxy.code === 'OK', region: proxy.cc, ms: proxy.ms } },
    { name: 'Netflix', info: resultInfo(netflix, proxy.cc) },
    { name: 'Disney+', info: resultInfo(disney, proxy.cc) }
  ];

  const ai = [
    { name: 'ChatGPT', info: resultInfo(chatgpt, proxy.cc) },
    { name: 'Claude', info: resultInfo(claude, proxy.cc) },
    { name: 'Gemini', info: resultInfo(gemini, proxy.cc) }
  ];

  const allServices = [...streaming, ...ai];
  const okCount = allServices.filter(item => item.info.available).length;
  const failCount = allServices.length - okCount;
  const total = allServices.length;

  // ----- 生成美化 UI 文本 -----
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 1. 进度条（10格）
  const pct = Math.round((okCount / total) * 100);
  const barLen = 10;
  const filled = Math.round((okCount / total) * barLen);
  const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);

  // 2. 构造内容
  let content = '';

  // 顶部标题栏
  content += `╭────────────────────────╮\n`;
  content += `│  📡 网络解锁监测  ${time}  │\n`;
  content += `╰────────────────────────╯\n`;

  // 总览与进度
  content += `\n  ${bar}  ${okCount}/${total}\n`;
  content += `  ✅ 可用: ${okCount}  `;
  content += failCount > 0 ? `❌ 异常: ${failCount}` : `🎉 全部畅通`;
  content += `\n\n`;

  // 辅助生成服务行（统一占位，观感整洁）
  function formatItem(item) {
    const info = item.info;
    const emoji = statusEmoji(info.ms, info.available);
    const name = item.name.padEnd(8);
    const region = info.region.padEnd(4);
    const ms = info.ms ? `${info.ms}ms` : '----';
    return `  ${emoji}  ${name}  •  ${region}  •  ${ms}`;
  }

  // 流媒体分组
  content += `▸ 流媒体解锁\n`;
  content += `  ────────────────\n`;
  streaming.forEach(item => { content += formatItem(item) + '\n'; });

  // AI 分组
  content += `\n▸ AI 服务检测\n`;
  content += `  ────────────────\n`;
  ai.forEach(item => { content += formatItem(item) + '\n'; });

  // 底部刷新提示（可选，视觉点缀）
  content += `\n  ── 点击下方「刷新」更新 ──`;

  // ----- 返回 Surge 面板 -----
  return {
    title: '网络监测',
    content: content,
    icon: 'antenna.radiowaves.left.and.right',
    'icon-color': failCount === 0 ? '#32D74B' : '#FF453A',
    actions: [
      {
        title: '🔄 刷新',
        type: 'update'
      }
    ]
  };
};