/********************** 五菱签到补签抽奖.js ***********************
 *  功能：自动签到、补签、尝试抽奖（若需验证码则通知手动抽奖）
 *  Surge/Loon/Quantumult X 通用
 *
 *  请确保已在持久化存储中设置好以下 key：
 *    - wuling_sign_cookie
 *    - wuling_sign_token
 *    - wuling_sign_userId
 *
 *  每日 8:00 执行一次，自动处理签到、补签，
 *  并尝试抽奖，若因极验验证码无法自动抽奖则通知手动操作。
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
function postForm(url, params, callback) {
    const body = Object.keys(params).map(key => `${key}=${encodeURIComponent(params[key] || '')}`).join('&');
    httpRequest({
        url: url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
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

// ===================== 业务逻辑 =====================
const URL = {
    info: 'https://operation.wuling.com/sign2023/api/info',
    sign: 'https://operation.wuling.com/sign2023/api/sign',
    verify: 'https://operation.wuling.com/sign2023/api/is-need-verify',
    lottery: 'https://operation.wuling.com/sign2023/api/lottery',
};

let cookie = getStoredValue(cookieKey);
let token = getStoredValue(tokenKey);
let userId = getStoredValue(userIdKey);

if (!cookie || !token || !userId) {
    notify('五菱签到', '凭证缺失', '请先打开五菱APP任务中心页面获取凭证');
    $done();
}

// 公共请求参数
const baseParams = {
    scene: '',
    originalToken: token,
    userIdStr: userId,
};

// 获取用户信息（含签到状态和抽奖次数）
function getUserInfo(callback) {
    postForm(URL.info, baseParams, callback);
}

// 签到/补签
function doSign(stage, callback) {
    const params = { ...baseParams, stage: stage.toString() };
    postForm(URL.sign, params, callback);
}

// 尝试抽奖（处理验证码不可自动完成的情况）
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

            // 有剩余次数，尝试调用抽奖接口
            // 注意：因无法生成极验验证码，这里会在请求体中省略所有验证参数
            const lotteryParams = {
                scene: '',
                originalToken: token,
                userIdStr: userId,
                // 以下验证码参数全部留空
                lot_number: '',
                captcha_output: '',
                pass_token: '',
                gen_time: '',
                gee_token: '',
                validate: ''
            };
            postForm(URL.lottery, lotteryParams, (err, resp, lotteryData) => {
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
                        // 判断是否是验证码相关提示
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

// ===================== 主流程 =====================
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
        const today = new Date().toISOString().split('T')[0]; // yyyy-MM-dd
        const signedDates = signData.date_his || [];

        let alreadySigned = signedDates.includes(today);
        let tasks = [];

        // 1. 签到
        if (!alreadySigned) {
            tasks.push({ name: '签到', stage: 0 });
        }

        // 2. 补签 (假设 stage 1 为补签)
        if (!alreadySigned && signData.total_sign_count < signData.max_sign_count) {
            tasks.push({ name: '补签', stage: 1 });
        }

        // 执行签到/补签任务
        const runTask = (index) => {
            if (index >= tasks.length) {
                // 签到流程结束，尝试抽奖
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