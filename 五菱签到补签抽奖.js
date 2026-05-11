// 五菱汽车 - 签到/补签/抽奖/提醒
// 运行时机：每日定时 (Cron Job)

const COOKIE_KEY = "WULING_COOKIE";
const INFO_URL = "https://operation.wuling.com/sign2023/api/datehis";
const SIGN_URL = "https://probe.sgmwsales.com/api/log/appBuringPoint";

let cookie = $persistentStore.read(COOKIE_KEY);
if (!cookie) { $notification.post("五菱汽车", "❌ 未配置 Cookie", "请打开 App 获取"); $done(); }

// 1. 获取本月数据
getMonthInfo(cookie, (data) => {
    if (!data?.result) { $notification.post("五菱汽车", "❌ 签到失败", "Cookie 可能已失效"); $done(); return; }
    
    const result = data.result;
    let signedDates = result.date_his || []; // ["11", "10", "08"]
    const repairCards = result.cur_sign_count || 0;
    const today = new Date().getDate();
    
    // 2. 判断是否已签到
    if (signedDates.includes(String(today))) {
        $notification.post("五菱汽车", "ℹ️ 今日已签", `连续签到 ${result.monthlyUser?.continuousSignCount || 0} 天`);
        checkLottery(cookie, result); // 检查抽奖
        $done();
        return;
    }

    // 3. 智能补签（向前追溯）
    let repaired = false;
    for (let i = 1; i < today; i++) {
        let checkDay = today - i;
        if (!signedDates.includes(String(checkDay))) {
            // 找到断签点
            if (repairCards > 0) {
                doRepair(cookie, checkDay, result, () => {
                    // 补签成功后，再次检查今日是否已签，然后抽奖
                    checkLottery(cookie, result);
                });
                repaired = true;
                break;
            } else {
                break;
            }
        }
    }

    // 4. 如果没有补签，则执行今日签到
    if (!repaired) {
        doSign(cookie, "今日签到", result, () => {
            checkLottery(cookie, result);
        });
    }
});

// 补签函数
function doRepair(cookie, day, result, callback) {
    doSign(cookie, `补签 ${day} 号`, result, callback);
}

// 通用签到请求
function doSign(cookie, type, result, callback) {
    const body = "project=app-llb&token=qMPPRr2vGLC8LrdChtvevuPt";
    const headers = { "Cookie": cookie, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "SensorsAnalytics iOs SDK" };
    
    $httpClient.post({ url: SIGN_URL, headers, body }, (error, response) => {
        if (response?.status === 200) {
            const contDays = result.monthlyUser?.continuousSignCount || 0;
            $notification.post("五菱汽车", `✅ ${type}成功`, `当前连续签到 ${contDays} 天`);
        } else {
            $notification.post("五菱汽车", `❌ ${type}失败`, "请检查接口");
        }
        if (callback) callback();
    });
}

// 检查抽奖次数（预留接口）
function checkLottery(cookie, result) {
    // 根据您的抓包，连续签到会增加抽奖次数，这里模拟提醒
    // 实际使用时，需要替换为真实的“查询抽奖次数”接口
    const lotteryTimes = result.monthlyUser?.lotteryTimes || 0; 
    if (lotteryTimes > 0) {
        $notification.post("五菱汽车", "🎁 获得抽奖机会", `当前剩余 ${lotteryTimes} 次，等待您手动抽取`);
    }
}

// 获取月度数据
function getMonthInfo(cookie, callback) {
    const url = `${INFO_URL}?ym=${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    $httpClient.get({ url, headers: {"Cookie": cookie} }, (err, res, data) => {
        try { callback(JSON.parse(data)); } catch { callback(null); }
    });
}
