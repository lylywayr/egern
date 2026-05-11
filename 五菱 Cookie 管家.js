// 五菱汽车 - Cookie 管家 (静默版)
// 运行时机：打开 App 时触发 (HTTP Request)

const COOKIE_KEY = "WULING_COOKIE";
const CHECK_URL = "https://operation.wuling.com/sign2023/api/datehis?ym=" + getMonth();

// 主逻辑
function main() {
    let cookie = $persistentStore.read(COOKIE_KEY);
    
    if (cookie) {
        // 有 Cookie，验证是否有效
        validateCookie(cookie);
    } else {
        // 没 Cookie，直接获取并通知
        fetchCookie();
    }
}

function validateCookie(cookie) {
    $httpClient.get({
        url: CHECK_URL,
        headers: { "Cookie": cookie }
    }, (error, response, data) => {
        if (error || response.status !== 200) {
            notifyAndFetch("Cookie 失效", "网络错误或接口异常");
            return;
        }
        try {
            let json = JSON.parse(data);
            if (json.success === true) {
                // 关键：Cookie 有效，直接放行，不发任何通知
                console.log("Cookie 有效，静默放行。");
                $done();
            } else {
                notifyAndFetch("Cookie 已过期", "正在尝试重新获取...");
            }
        } catch (e) {
            notifyAndFetch("Cookie 解析失败", "正在重新获取...");
        }
    });
}

function notifyAndFetch(title, subtitle) {
    $notification.post("五菱汽车", title, subtitle);
    fetchCookie();
}

function fetchCookie() {
    // 抓取登录接口的 Set-Cookie
    $httpClient.get({ url: "https://operation.wuling.com" }, (error, response) => {
        let setCookie = response.headers["Set-Cookie"] || response.headers["set-cookie"];
        if (setCookie && setCookie.includes("210220fg0776_session")) {
            let cookieStr = formatCookie(setCookie);
            $persistentStore.write(cookieStr, COOKIE_KEY);
            $notification.post("五菱汽车", "✅ Cookie 更新成功", "自动签到已恢复");
        } else {
            $notification.post("五菱汽车", "❌ Cookie 获取失败", "请尝试重启 App");
        }
        $done();
    });
}

function formatCookie(setCookie) {
    let cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    return cookies.map(item => item.match(/([^=]+=[^;]+)/)?.[1]).filter(Boolean).join("; ");
}

function getMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

main();
