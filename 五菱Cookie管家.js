// ==UserAgent==
// @name         五菱签到-获取凭证
// @namespace    wuling_sign_credential
// @description  打开五菱APP任务中心页面自动获取Cookie与Token
// @version      1.0
// @author       你的名字
// @cron         无
// @http-request https://operation.wuling.com/sign2023/api/info script-path=该脚本的路径
// ==/UserAgent==

const cookieKey = 'wuling_sign_cookie';
const tokenKey = 'wuling_sign_token';
const userIdKey = 'wuling_sign_userId';

if ($request && $request.url.indexOf('operation.wuling.com/sign2023/api/info') !== -1) {
  // 提取 Cookie
  let cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
  let sessionMatch = cookie.match(/210220fg0776_session=([^;]+)/);
  let sessionCookie = sessionMatch ? '210220fg0776_session=' + sessionMatch[1] : '';

  // 提取请求体中的参数
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
    // 保存凭证
    $persistentStore.write(sessionCookie, cookieKey);
    $persistentStore.write(originalToken, tokenKey);
    $persistentStore.write(userIdStr, userIdKey);
    console.log('五菱签到凭证获取成功');
    $notification.post('五菱签到', '凭证获取成功', '已成功获取Cookie与Token');
  } else {
    console.log('五菱签到凭证获取失败：缺少必要参数');
  }
  $done({});
} else {
  $done({});
}