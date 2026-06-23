/**
 * Egern小组件: 网络服务解锁监测
 */
export default async function(ctx) {
  const C = {
    bg:          { light: '#FFFFFF', dark: '#050506' },
    text:        { light: '#111114', dark: '#F7F7F8' },
    dim:         { light: '#7B7B84', dark: '#85858E' },
    panel:       { light: '#F5F5F7', dark: '#111114' },
    hairline:    { light: '#E4E4E8', dark: '#242429' },
    chip:        { light: '#E8E8ED', dark: '#202025' },
    accent:      { light: '#7446D8', dark: '#B765FF' },
    ok:          { light: '#2F9E58', dark: '#C7FF18' },
    warn:        { light: '#8A4FC4', dark: '#C887FF' },
    fail:        { light: '#D64545', dark: '#FF626A' },
    terminalDim: { light: '#696971', dark: '#A5A5AE' }
  };

  const BASE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  const commonHeaders = { 'User-Agent': BASE_UA };

  async function timed(fn) {
    const start = Date.now();
    try {
      const result = await fn();
      return { ...result, ms: Date.now() - start };
    } catch {
      return { code: 'ERR', ms: Date.now() - start };
    }
  }

  const fetchProxy = async () => {
    try {
      const res = await ctx.http.get('http://ip-api.com/json/?lang=zh-CN', { timeout: 4000 });
      if (!res) return { code: 'ERR', cc: 'XX' };
      const data = JSON.parse(await res.text());
      const cc = data.countryCode || 'XX';
      return { code: cc === 'XX' ? 'ERR' : 'OK', cc };
    } catch {
      return { code: 'ERR', cc: 'XX' };
    }
  };

  async function checkNetflix() {
    const res = await ctx.http.get('https://www.netflix.com/title/70143836', {
      timeout: 4000,
      headers: commonHeaders,
      followRedirect: false
    }).catch(() => null);
    return { code: res?.status === 200 ? 'OK' : 'ERR' };
  }

  async function checkDisney() {
    const res = await ctx.http.get('https://www.disneyplus.com', {
      timeout: 4000,
      headers: commonHeaders,
      followRedirect: false
    }).catch(() => null);
    return { code: res && res.status !== 403 ? 'OK' : 'ERR' };
  }

  async function checkChatGPT() {
    const res = await ctx.http.get('https://chatgpt.com/cdn-cgi/trace', {
      timeout: 3000
    }).catch(() => null);
    if (!res) return { code: 'ERR' };

    const body = await res.text().catch(() => '');
    const match = body.match(/loc=([A-Z]{2})/);
    return match ? { code: match[1] } : { code: 'ERR' };
  }

  async function checkClaude() {
    const res = await ctx.http.get('https://claude.ai/login', {
      timeout: 5000,
      headers: commonHeaders
    }).catch(() => null);
    return { code: res ? 'OK' : 'ERR' };
  }

  async function checkGemini() {
    const res = await ctx.http.get('https://gemini.google.com/app', {
      timeout: 4000,
      headers: commonHeaders,
      followRedirect: false
    }).catch(() => null);
    return { code: res ? 'OK' : 'ERR' };
  }

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
  const lockedCount = allServices.length - okCount;

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const responseColor = (ms, available) => {
    if (!available) return C.fail;
    if (ms >= 800) return C.warn;
    return C.terminalDim;
  };

  const TerminalReadout = (info) => ({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 6,
    width: 108,
    children: [
      {
        type: 'stack',
        padding: [2, 6],
        backgroundColor: C.chip,
        borderRadius: 4,
        children: [
          {
            type: 'text',
            text: info.region,
            font: { size: 10, weight: 'semibold', design: 'monospaced' },
            textColor: C.text,
            maxLines: 1
          }
        ]
      },
      { type: 'spacer' },
      {
        type: 'text',
        text: `${info.ms}ms`,
        font: { size: 10, weight: 'medium', design: 'monospaced' },
        textColor: responseColor(info.ms, info.available),
        maxLines: 1
      },
      {
        type: 'stack',
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: info.available ? C.ok : C.fail,
        children: []
      }
    ]
  });

  const ServiceRow = item => ({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 8,
    children: [
      {
        type: 'text',
        text: item.name,
        font: { size: 13, weight: 'medium' },
        textColor: C.text,
        flex: 1,
        maxLines: 1
      },
      TerminalReadout(item.info)
    ]
  });

  const Hairline = () => ({
    type: 'stack',
    height: 1,
    backgroundColor: C.hairline
  });

  const Group = (label, items) => {
    const groupOk = items.filter(item => item.info.available).length;
    const rows = items.map(ServiceRow);

    return {
      type: 'stack',
      direction: 'column',
      gap: 8,
      padding: [10, 12],
      backgroundColor: C.panel,
      borderRadius: 10,
      children: [
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          children: [
            {
              type: 'text',
              text: label,
              font: { size: 10, weight: 'bold' },
              textColor: C.accent,
              maxLines: 1
            },
            { type: 'spacer' },
            {
              type: 'text',
              text: `${groupOk}/${items.length}`,
              font: { size: 10, weight: 'semibold', design: 'monospaced' },
              textColor: C.dim,
              maxLines: 1
            }
          ]
        },
        ...rows.flatMap((row, index) => index === 0 ? [row] : [Hairline(), row])
      ]
    };
  };

  return {
    type: 'widget',
    backgroundColor: C.bg,
    padding: [14, 16, 14, 16],
    gap: 10,
    children: [
      {
        type: 'stack',
        direction: 'column',
        gap: 2,
        children: [
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            children: [
              {
                type: 'text',
                text: 'NETWORK MONITOR',
                font: { size: 10, weight: 'bold' },
                textColor: C.dim,
                maxLines: 1
              },
              { type: 'spacer' },
              {
                type: 'text',
                text: time,
                font: { size: 11, weight: 'medium', design: 'monospaced' },
                textColor: C.dim,
                maxLines: 1
              }
            ]
          },
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 6,
            children: [
              {
                type: 'image',
                src: 'sf-symbol:antenna.radiowaves.left.and.right',
                color: C.ok,
                width: 14,
                height: 14
              },
              {
                type: 'text',
                text: '解锁检测',
                font: { size: 14, weight: 'bold' },
                textColor: C.text,
                maxLines: 1
              }
            ]
          }
        ]
      },

      {
        type: 'stack',
        direction: 'column',
        gap: 1,
        children: [
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 7,
            children: [
              {
                type: 'stack',
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: lockedCount === 0 ? C.ok : C.fail,
                children: []
              },
              {
                type: 'text',
                text: `${okCount}/${allServices.length}`,
                font: { size: 25, weight: 'bold', design: 'monospaced' },
                textColor: C.text,
                maxLines: 1
              }
            ]
          },
          {
            type: 'text',
            text: lockedCount === 0 ? '全部服务已解锁' : `${lockedCount} 项服务不可用`,
            font: { size: 11, weight: 'medium' },
            textColor: lockedCount === 0 ? C.dim : C.fail,
            maxLines: 1
          }
        ]
      },

      Group('流媒体解锁', streaming),
      Group('AI 服务检测', ai)
    ]
  };
}