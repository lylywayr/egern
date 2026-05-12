/********************** 五菱签到补签抽奖.js ***********************
 *  功能：
 *   1. MITM 触发：智能抓取凭证（Cookie 有效不抓取，无效才抓取并通知）
 *   2. 定时任务：检查 Cookie 有效性，执行签到、补签、抽奖提醒
 *
 *  部署说明：
 *   - 添加 MITM 主机名：operation.wuling.com
 *   - 添加 HTTP 请求脚本：
 *     ^https://operation\.wuling\.com\/sign2023\/api\/info
 *   - 添加定时任务（每天 8:00）：
 *     cron "0 8 * * *" script-path=本脚本路径
 ***************************************************************/

// ===================== 通用工具函数 =====================
const cookieKey = 'wuling_sign_cookie';
const tokenKey = 'wuling_sign_token';
const userIdKey = 'wuling_sign_userId';

// 简易持久化存储适配
let _storage = null;
if (typeof $persistentStore !== 'undefined') {
    _storage = {
        read: (key) => $persistentStore.read(key),
        write: (key, val) => $persistentStore.write(val, key)
    };
} else if (typeof $prefs !== 'undefined') {
    _storage = {
        read: (key) => $prefs.valueForKey(key),
        write: (key, val) => $prefs.setValueForKey(val, key)
    };
} else {
    console.log('无持久化存储模块，脚本无法运行');
    $done();
}

function getStoredValue(key, defaultVal = '') {
    return _storage.read(key) || defaultVal;
}

function setStoredValue(key, val) {
    _storage.write(key, val);
}

// 发送 HTTP 请求 (通用)
function httpRequest(opt) {
    const method = opt.method || 'GET';
    const url = opt.url;
    const headers = opt.headers || {};
    const body = opt.body || null;
    const callback = opt.callback;

    const client = typeof $task !== 'undefined' ? $task : typeof $httpClient !== 'undefined' ? $httpClient : null;
    if (!client) {
        console.log('无网络请求模块');
        return;
    }

    if (typeof $task !== 'undefined') {
        $task.fetch({ url, method, headers, body }).then(response => {
            callback(null, response, response.body);
        }, reason => {
            callback(reason, null, null);
        });
    } else {
        const params = { url, method, headers };
        if (body) params.body = body;
        $httpClient[method.toLowerCase()](params, (err, response, data) => {
            callback(err, response, data);
        });
    }
}

// 发送 POST 表单
function postForm(url, params, headers = {}, callback) {
    const body = Object.keys(params).map(key => `${key}=${encodeURIComponent(params[key] || '')}`).join('&');
    httpRequest({
        url: url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            ...headers
        },
        body: body,
        callback: callback
    });
}

// 发送系统通知
function notify(title, subtitle, message) {
    if (typeof $notification !== 'undefined') {
        $notification.post(title, subtitle, message);
    } else {
        console.log(`${title} - ${subtitle}: ${message}`);
    }
}

// ===================== 业务常量 =====================
const URL = {
    info: 'https://operation.wuling.com/sign2023/api/info',
    sign: 'https://operation.wuling.com/sign2023/api/sign',
    lottery: 'https://operation.wuling.com/sign2023/api/lottery',
};

// ===================== 1. MITM 抓取逻辑 =====================
if ($request && $request.url.indexOf(URL.info) !== -1) {
    // 获取当前存储的凭证
    let storedCookie = getStoredValue(cookieKey);
    let storedToken = getStoredValue(tokenKey);
    let storedUserId = getStoredValue(userIdKey);

    // 提取当前请求中的凭证（备用）
    const extractCurrent = () => {
        let cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
        let sessionMatch = cookie.match(/210220fg0776_session=([^;]+)/);
        let sessionCookie = sessionMatch ? '210220fg0776_session=' + sessionMatch[1] : '';

        let body = $request.body || '';
        let originalToken = '';
        let userIdStr = '';
        if (body) {
            let params = {};
            body.split('&').forEach(pair => {
                let [key, value] = pair.split('=');
                params[key] = decodeURIComponent(value || '');
            });
            originalToken = params['originalToken'] || '';
            userIdStr = params['userIdStr'] || '';
        }

        if (sessionCookie && originalToken && userIdStr) {
            setStoredValue(cookieKey, sessionCookie);
            setStoredValue(tokenKey, originalToken);
            setStoredValue(userIdKey, userIdStr);
            return true;
        }
        return false;
    };

    // 如果没有存储凭证，直接抓取
    if (!storedCookie || !storedToken || !storedUserId) {
        if (extractCurrent()) {
            notify('五菱签到', '凭证获取成功', '首次获取凭证');
        }
        $done();
        return;
    }

    // 测试已有 Cookie 是否有效
    const testParams = {
        scene: '',
        originalToken: storedToken,
        userIdStr: storedUserId,
    };
    postForm(URL.info, testParams, { Cookie: storedCookie }, (err, resp, data) => {
        try {
            const result = JSON.parse(data);
            if (result.success) {
                // 有效，不更新也不通知
                console.log('Cookie 有效，无需更新');
            } else {
                // 失效，重新抓取
                if (extractCurrent()) {
                    notify('五菱签到', '凭证已更新', 'Cookie 已失效，已自动重新抓取');
                }
            }
        } catch (e) {
            // 异常，尝试重新抓取
            if (extractCurrent()) {
                notify('五菱签到', '凭证已更新', '检查异常，已重新抓取');
            }
        }
        $done();
    });
    return;
}

// ===================== 2. 定时任务签到逻辑 =====================
let storedCookie = getStoredValue(cookieKey);
let storedToken = getStoredValue(tokenKey);
let storedUserId = getStoredValue(userIdKey);

if (!storedCookie || !storedToken || !storedUserId) {
    notify('五菱签到', '凭证缺失', '请先打开五菱APP任务中心页面获取凭证');
    $done();
    return;
}

const baseParams = {
    scene: '',
    originalToken: storedToken,
    userIdStr: storedUserId,
};

// 检查 Cookie 有效性
function checkCookieValidity(callback) {
    postForm(URL.info, baseParams, { Cookie: storedCookie }, (err, resp, data) => {
        if (err || !data) {
            callback(false);
            return;
        }
        try {
            const result = JSON.parse(data);
            callback(result.success === true);
        } catch (e) {
            callback(false);
        }
    });
}

// 获取用户信息
function getUserInfo(callback) {
    postForm(URL.info, baseParams, { Cookie: storedCookie }, callback);
}

// 签到/补签
function doSign(stage, callback) {
    const params = { ...baseParams, stage: stage.toString() };
    postForm(URL.sign, params, { Cookie: storedCookie }, callback);
}

// 尝试抽奖
function attemptLottery() {
    console.log('尝试检查抽奖次数并抽奖...');
    getUserInfo((err, resp, data) => {
        if (err || !data) {
            notify('五菱抽奖', '网络错误', '获取抽奖信息失败');
            $done();
            return;
        }
        try {
            const result = JSON.parse(data);
            if (!result.success) {
                notify('五菱抽奖', '接口错误', result.msg);
                $done();
                return;
            }
            const signData = result.result.signData;
            const remaining = signData.lottery_count || 0;
            if (remaining <= 0) {
                console.log('当前无抽奖次数');
                $done();
                return;
            }

            // 尝试抽奖（验证码参数留空）
            const lotteryParams = {
                scene: '',
                originalToken: storedToken,
                userIdStr: storedUserId,
                lot_number: '',
                captcha_output: '',
                pass_token: '',
                gen_time: '',
                gee_token: '',
                validate: ''
            };
            postForm(URL.lottery, lotteryParams, { Cookie: storedCookie }, (err, resp, lotteryData) => {
                if (err) {
                    notify('五菱抽奖', '请求失败', '网络错误，请手动抽奖');
                    $done();
                    return;
                }
                try {
                    const lotteryRes = JSON.parse(lotteryData);
                    if (lotteryRes.success) {
                        notify('五菱抽奖', '抽奖成功', lotteryRes.msg || '恭喜中奖！');
                    } else {
                        const msg = lotteryRes.msg || '未知错误';
                        if (msg.includes('验证') || msg.includes('captcha') || msg.includes('验签')) {
                            notify('五菱抽奖', '需要手动验证', `您有 ${remaining} 次抽奖机会，请进入APP手动抽奖\n原因：${msg}`);
                        } else {
                            notify('五菱抽奖', '抽奖失败', msg);
                        }
                    }
                } catch (e) {
                    notify('五菱抽奖', '解析异常', '抽奖响应无法解析，建议手动操作');
                }
                $done();
            });
        } catch (e) {
            notify('五菱抽奖', '数据异常', e.message);
            $done();
        }
    });
}

// --- 主流程：先检查 Cookie 有效性 ---
checkCookieValidity((isValid) => {
    if (!isValid) {
        notify('五菱签到', 'Cookie已失效', '请打开五菱APP进入任务中心页面，以便自动更新凭证');
        $done();
        return;
    }

    getUserInfo((err, resp, data) => {
        if (err || !data) {
            notify('五菱签到', '网络错误', '获取用户信息失败');
            $done();
            return;
        }

        try {
            const result = JSON.parse(data);
            if (!result.success) {
                notify('五菱签到', '接口失败', result.msg || '未知错误');
                $done();
                return;
            }

            const signData = result.result.signData;
            const today = new Date().toISOString().split('T')[0];
            const signedDates = signData.date_his || [];
            const alreadySigned = signedDates.includes(today);
            let tasks = [];

            if (!alreadySigned) {
                tasks.push({ name: '签到', stage: 0 });
            }

            if (!alreadySigned && signData.total_sign_count < signData.max_sign_count) {
                tasks.push({ name: '补签', stage: 1 });
            }

            const runTask = (index) => {
                if (index >= tasks.length) {
                    attemptLottery();
                    return;
                }
                const task = tasks[index];
                doSign(task.stage, (err, resp, data) => {
                    if (err) {
                        notify('五菱签到', `${task.name}失败`, '网络错误');
                    } else {
                        try {
                            const res = JSON.parse(data);
                            if (res.success) {
                                notify('五菱签到', `${task.name}成功`, res.msg);
                            } else {
                                notify('五菱签到', `${task.name}失败`, res.msg);
                            }
                        } catch (e) {
                            notify('五菱签到', `${task.name}异常`, data);
                        }
                    }
                    runTask(index + 1);
                });
            };

            if (tasks.length === 0) {
                console.log('今日已签到，无需补签，直接检查抽奖');
                attemptLottery();
            } else {
                runTask(0);
            }
        } catch (e) {
            notify('五菱签到', '数据解析错误', e.message);
            $done();
        }
    });
});