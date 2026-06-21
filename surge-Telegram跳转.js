/**
 * Telegram 跳转脚本（Surge 版）
 * 支持大小写不敏感的客户端名称
 * 优先读取 Surge 模块传递的 $argument，其次 env.CLIENT，默认 Telegram
 */

// 客户端名称（小写） -> URL Scheme 映射
const SCHEME = {
  telegram: "tg",
  swiftgram: "sg",
  turrit: "turrit",
  ime: "ime",
  nicegram: "ng",
  lingogram: "lingo",
};

// 从查询字符串中提取指定参数的值
function qval(qs, key) {
  if (!qs) return "";
  const re = new RegExp("(?:^|&)" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^&]*)");
  const m = qs.match(re);
  return m ? decodeURIComponent(m[1]) : "";
}

// 根据 URL Scheme 和路径生成客户端 deep link
function deeplink(s, path, qs) {
  const p = path.split("/").filter(Boolean);
  if (!p[0]) return "";

  // 私密邀请链接: t.me/+xxxx
  if (p[0][0] === "+") {
    return `${s}://join?invite=${encodeURIComponent(p[0].slice(1))}`;
  }

  // 群组邀请: t.me/joinchat/xxxx
  if (p[0] === "joinchat" && p[1]) {
    return `${s}://join?invite=${encodeURIComponent(p[1])}`;
  }

  // 贴纸包: t.me/addstickers/xxxx
  if (p[0] === "addstickers" && p[1]) {
    return `${s}://addstickers?set=${encodeURIComponent(p[1])}`;
  }

  // 分享链接: t.me/share/url?url=xxx&text=xxx
  if (p[0] === "share" && p[1] === "url") {
    return `${s}://msg_url?url=${encodeURIComponent(qval(qs, "url"))}&text=${encodeURIComponent(qval(qs, "text"))}`;
  }

  // 带消息ID的帖子: t.me/domain/post_id
  if (p[1] && /^\d+$/.test(p[1])) {
    return `${s}://resolve?domain=${encodeURIComponent(p[0])}&post=${encodeURIComponent(p[1])}`;
  }

  // 普通频道/用户: t.me/domain
  return `${s}://resolve?domain=${encodeURIComponent(p[0])}`;
}

// 主入口函数（Surge 环境）
export default async function (ctx) {
  const url = ctx.request.url;
  const m = url.match(/^https?:\/\/t\.me\/(.+)$/i);
  if (!m) return;

  // 获取客户端名称：
  // 1. 优先使用模块传递的 $argument（全局变量）
  // 2. 其次使用环境变量 CLIENT
  // 3. 默认 Telegram
  let client = ($argument || ctx.env?.CLIENT || "Telegram").trim();

  // 转为小写以实现大小写不敏感
  const key = client.toLowerCase();
  const scheme = SCHEME[key] || "tg"; // 如果不在映射表中，默认 tg（Telegram）

  let tail = m[1];
  if (tail.startsWith("s/")) tail = tail.slice(2); // 处理短链接 t.me/s/xxx

  const qi = tail.indexOf("?");
  const path = qi < 0 ? tail : tail.slice(0, qi);
  const qs = qi < 0 ? "" : tail.slice(qi + 1);

  const loc = deeplink(scheme, path, qs);
  if (!loc) return;

  // 返回 302 重定向响应
  return ctx.respond({
    status: 302,
    headers: {
      Location: loc,
      "Cache-Control": "no-store, no-cache",
    },
    body: "",
  });
}
