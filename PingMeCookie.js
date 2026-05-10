/**********************************
 * PingMe 获取 Cookie 脚本
 * 开关：$env.ENABLE_COOKIE
 * 存储：$persistentStore
 **********************************/

// 读取开关（默认 "true"）
const enableCookie = $env.ENABLE_COOKIE ?? 'true';
if (enableCookie !== 'true') {
    $done(); // 开关关闭，直接结束
}

// 实际抓取逻辑
const cookieKey = 'PingMeCookie'; // 持久化存储的键名
const url = $request.url;
const headers = $request.headers;

// 从请求头提取完整 Cookie 字符串
const cookie = headers['Cookie'] || headers['cookie'] || '';
if (cookie) {
    $persistentStore.write(cookie, cookieKey);
    $notification.post('PingMe Cookie', '获取成功 🍪', '已存储登录态，可执行签到');
} else {
    $notification.post('PingMe Cookie', '获取失败', '未在请求头中找到 Cookie');
}

$done();
