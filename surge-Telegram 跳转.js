// ==================== 用户配置 ====================
// 修改为你的客户端名称，支持：
// Telegram, Swiftgram, Turrit, iMe, Nicegram, Lingogram
var targetClient = "Telegram";
// =================================================

const SCHEME = {
    "Telegram":   "tg",
    "Swiftgram":  "sg",
    "Turrit":     "turrit",
    "iMe":        "ime",
    "Nicegram":   "ng",
    "Lingogram":  "lingo"
};

function buildDeepLink(scheme, path, qs) {
    const parts = path.split("/").filter(p => p);
    if (!parts.length) return "";
    const first = parts[0];
    // 邀请链接 t.me/+xxxx
    if (first.startsWith("+")) {
        return `${scheme}://join?invite=${encodeURIComponent(first.slice(1))}`;
    }
    // joinchat 链接
    if (first === "joinchat" && parts[1]) {
        return `${scheme}://join?invite=${encodeURIComponent(parts[1])}`;
    }
    // 贴纸链接
    if (first === "addstickers" && parts[1]) {
        return `${scheme}://addstickers?set=${encodeURIComponent(parts[1])}`;
    }
    // 分享链接
    if (first === "share" && parts[1] === "url") {
        const params = new URLSearchParams(qs);
        const url = params.get("url") || "";
        const text = params.get("text") || "";
        return `${scheme}://msg_url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    }
    // 普通用户/频道链接 或 消息链接
    if (parts.length === 1) {
        return `${scheme}://resolve?domain=${encodeURIComponent(parts[0])}`;
    }
    if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
        return `${scheme}://resolve?domain=${encodeURIComponent(parts[0])}&post=${encodeURIComponent(parts[1])}`;
    }
    return `${scheme}://resolve?domain=${encodeURIComponent(parts[0])}`;
}

const url = $request.url;
const match = url.match(/^https?:\/\/t\.me\/(.+)$/i);
if (match) {
    let tail = match[1];
    if (tail.startsWith("s/")) tail = tail.slice(2);
    const qIndex = tail.indexOf("?");
    const path = qIndex === -1 ? tail : tail.slice(0, qIndex);
    const qs = qIndex === -1 ? "" : tail.slice(qIndex + 1);
    const scheme = SCHEME[targetClient];
    if (!scheme) {
        console.log(`未知客户端: ${targetClient}，使用官方 Telegram`);
        targetClient = "Telegram";
    }
    const finalScheme = scheme || "tg";
    const location = buildDeepLink(finalScheme, path, qs);
    if (location) {
        $done({
            status: 302,
            headers: {
                Location: location,
                "Cache-Control": "no-store, no-cache"
            }
        });
        return;
    }
}
$done({});