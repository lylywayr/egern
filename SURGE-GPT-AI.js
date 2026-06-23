// Surge 面板脚本：网络服务解锁监测（稳定版）
// 作者: lylywayr | 版本: 0.1

module.exports = async function() {
  // ----- 工具：HTTP GET 转 Promise -----
  function httpGet(url, options = {}) {
    return new Promise((resolve, reject) => {
      $httpClient.get(url, options, (err, resp, body) => {
        if (err) reject(err);
        else resolve({ status: resp.status, body });
      });
    });
  }

  // ----- 状态 Emoji -----
  const EMOJI = { OK: '🟢', SLOW: '🟡', FAIL: '🔴', UNKNOWN: '⚪' };
  function statusEmoji(ms, available) {
    if (!available) return EMOJI.FAIL;
    if (ms >= 800) return EMOJI.SLOW;
    return EMOJI.OK;
  }

  // ----- 检测函数（带超时）-----
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

  // ----- 计时器包装 -----
  async function timed(fn) {
    const start = Date.now();
    try {
      const result = await fn();
      return { ...result, ms: Date.now() - start };
    } catch {
      return { code: 'ERR', ms: Date.now() - start };
    }
  }

  // ----- 主逻辑（捕获所有异常）-----
  try {
    const [proxy, netflix, disney, chatgpt, claude, gemini] = await Promise.all([
      timed(fetchProxy),
      timed(checkNetflix),
      timed(checkDisney),
      timed(checkChatGPT),
      timed(checkClaude),
      timed(checkGemini)
    ]);

    const resultInfo = (result, fallbackRegion) => {
      const available = result.code !== 'ERR';
      const region = result.code === 'OK' ? fallbackRegion : result.code;
      return { available, region: available ? (region || 'XX') : '--', ms: result.ms };
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

    // ----- 构建美化面板文本 -----
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 进度条
    const pct = Math.round((okCount / total) * 100);
    const barLen = 10;
    const filled = Math.round((okCount / total) * barLen);
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);

    let content = '';
    content += `╭────────────────────────╮\n`;
    content += `│  📡 网络解锁监测  ${time}  │\n`;
    content += `╰────────────────────────╯\n`;
    content += `\n  ${bar}  ${okCount}/${total}\n`;
    content += `  ✅ 可用: ${okCount}  `;
    content += failCount > 0 ? `❌ 异常: ${failCount}` : `🎉 全部畅通`;
    content += `\n\n`;

    function formatItem(item) {
      const info = item.info;
      const emoji = statusEmoji(info.ms, info.available);
      const name = item.name.padEnd(8);
      const region = info.region.padEnd(4);
      const ms = info.ms ? `${info.ms}ms` : '----';
      return `  ${emoji}  ${name}  •  ${region}  •  ${ms}`;
    }

    content += `▸ 流媒体解锁\n`;
    content += `  ────────────────\n`;
    streaming.forEach(item => { content += formatItem(item) + '\n'; });

    content += `\n▸ AI 服务检测\n`;
    content += `  ────────────────\n`;
    ai.forEach(item => { content += formatItem(item) + '\n'; });

    content += `\n  ── 点击下方「刷新」更新 ──`;

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
  } catch (err) {
    // 捕获任何意外错误，显示错误面板
    return {
      title: '网络监测',
      content: `⚠️ 脚本执行出错\n${err.message || '未知错误'}`,
      icon: 'exclamationmark.triangle',
      'icon-color': '#FF9500'
    };
  }
};