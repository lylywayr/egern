// ==UserAgent==
// @name         五菱签到-定时签到补签（含Ling值提醒）
// @namespace    wuling_sign_daily_v2
// @description  定时签到，自动补签，获取Ling值并通知
// @version      2.0
// @author       你的名字
// @cron         0 8 * * *   // 每天8点执行，可自行修改
// @background   true
// ==/UserAgent==

const cookieKey = 'wuling_sign_cookie';
const tokenKey = 'wuling_sign_token';
const userIdKey = 'wuling_sign_userId';
const baseUrl = 'https://operation.wuling.com';

// -------------------- 工具函数 --------------------
function getStoredValue(key) {
  return $persistentStore.read(key) || '';
}

function notify(title, subtitle, message) {
  $notification.post(title, subtitle, message);
}

function httpPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    let options = {
      url: url,
      method: 'POST',
      headers: headers || {},
      body: body || ''
    };
    $httpClient.post(options, (error, response, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

// 获取当前Ling值
async function getUserLing(originalToken, userIdStr, headers) {
  let body = 'scene=&originalToken=' + encodeURIComponent(originalToken) + '&userIdStr=' + encodeURIComponent(userIdStr);
  try {
    let resp = await httpPost(baseUrl + '/sign2023/api/user-ling', body, headers);
    let data = JSON.parse(resp);
    if (data.success) {
      return data.result.userLing || 0;
    } else {
      throw new Error(data.msg || '获取Ling值失败');
    }
  } catch (e) {
    throw e;
  }
}

// -------------------- 主流程 --------------------
async function main() {
  let cookie = getStoredValue(cookieKey);
  let originalToken = getStoredValue(tokenKey);
  let userIdStr = getStoredValue(userIdKey);

  if (!cookie || !originalToken || !userIdStr) {
    notify('五菱签到', '缺少凭证', '请先运行获取凭证脚本');
    return;
  }

  let headers = {
    'Cookie': cookie,
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) DWD_HSQ/LingLingBang',
    'Origin': baseUrl,
    'Referer': baseUrl + '/task2021/index'
  };

  // 1. 记录签到前的Ling值
  let preLing;
  try {
    preLing = await getUserLing(originalToken, userIdStr, headers);
  } catch (e) {
    notify('五菱签到', '获取Ling值失败', String(e));
    return;
  }

  // 2. 获取签到状态（可能自动签到）
  let infoBody = 'scene=&originalToken=' + encodeURIComponent(originalToken) + '&userIdStr=' + encodeURIComponent(userIdStr);
  let infoResp;
  try {
    infoResp = await httpPost(baseUrl + '/sign2023/api/info', infoBody, headers);
  } catch (e) {
    notify('五菱签到', '网络错误', '获取签到状态失败');
    return;
  }

  let infoData;
  try {
    infoData = JSON.parse(infoResp);
  } catch (e) {
    notify('五菱签到', '数据解析失败', '签到状态响应异常');
    return;
  }

  if (!infoData.success) {
    notify('五菱签到', '获取状态失败', infoData.msg || '');
    return;
  }

  let signData = infoData.result.signData || {};
  let dateHis = signData.date_his || [];
  let addCardNum = signData.add_card_num || 0;

  // 3. 判断今日是否已签到
  let today = new Date();
  let todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  let isSignedToday = dateHis.includes(todayStr);
  let signedMsg = '';

  if (!isSignedToday) {
    signedMsg = '今日签到成功（已自动触发）';
  } else {
    // 已签到 -> 检查补签卡并自动补签
    if (addCardNum > 0) {
      let missedDate = '';
      let checkDate = new Date(today);
      while (true) {
        checkDate.setDate(checkDate.getDate() - 1);
        let checkStr = checkDate.getFullYear() + '-' + String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + String(checkDate.getDate()).padStart(2, '0');
        if (!dateHis.includes(checkStr)) {
          missedDate = checkStr;
          break;
        }
      }
      if (missedDate) {
        let supBody = 'sup_day=' + missedDate + '&scene=&originalToken=' + encodeURIComponent(originalToken) + '&userIdStr=' + encodeURIComponent(userIdStr);
        try {
          let supResp = await httpPost(baseUrl + '/sign2023/api/sup-sign', supBody, headers);
          let supData = JSON.parse(supResp);
          if (supData.success) {
            signedMsg = '补签成功：' + missedDate + ' 已补签';
          } else {
            signedMsg = '补签失败：' + (supData.msg || '');
          }
        } catch (e) {
          signedMsg = '补签请求异常';
        }
      }
    } else {
      signedMsg = '今日已签到，无补签卡';
    }
  }

  // 4. 再次获取签到状态（刷新数据）
  let finalInfoResp;
  try {
    finalInfoResp = await httpPost(baseUrl + '/sign2023/api/info', infoBody, headers);
  } catch (e) {
    notify('五菱签到', '网络错误', '刷新状态失败');
    return;
  }
  let finalInfoData;
  try {
    finalInfoData = JSON.parse(finalInfoResp);
  } catch (e) {
    notify('五菱签到', '数据解析失败', '刷新状态响应异常');
    return;
  }
  if (finalInfoData.success) {
    signData = finalInfoData.result.signData || {};
  }

  // 5. 记录签到后的Ling值
  let postLing;
  try {
    postLing = await getUserLing(originalToken, userIdStr, headers);
  } catch (e) {
    notify('五菱签到', '获取Ling值失败', String(e));
    return;
  }

  let curSignCount = signData.cur_sign_count || 0;
  let maxSignCount = signData.max_sign_count || 0;
  let totalSignCount = signData.total_sign_count || 0;
  let lotteryCount = signData.lottery_count || 0;
  let lottery25Count = signData.lottery25_count || 0;
  let addCardNumFinal = signData.add_card_num || 0;

  let todayLing = postLing - preLing;

  // 6. 构建通知消息
  let notifyMsg = signedMsg + '\n';
  notifyMsg += '连续签到：' + curSignCount + '天，最长连续：' + maxSignCount + '天，总计签到：' + totalSignCount + '天\n';
  notifyMsg += '补签卡剩余：' + addCardNumFinal + '张\n';
  notifyMsg += '签到前Ling值：' + preLing + '，签到后Ling值：' + postLing + '，今日新增：' + todayLing + '\n';
  notifyMsg += '当前累计Ling值：' + postLing + '\n';
  notifyMsg += '普通抽奖次数：' + lotteryCount + '，25次抽奖次数：' + lottery25Count + '（抽奖接口待完善）';

  notify('五菱签到', '签到报告', notifyMsg);
}

main();