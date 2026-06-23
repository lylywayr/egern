/**
 * ============================================================================
 * 脚本名称：Sub-Store 节点重命名脚本 (SubStore-ReName.js)
 * 版本：4.3
 * 功能：节点重命名、地区识别、关键词保留、过滤、排序、添加国旗、去重。
 * 适用平台：Sub-Store (https://sub-store.app/)
 * 更新日期：2026-06-23
 * 作者：lylywayr
 * 
 * ============================================================================
 * 使用方法：
 * https://raw.githubusercontent.com/你的用户名/仓库名/SubStore-ReName.js#参数1=值&参数2=值...
 * 所有布尔参数传 =1 启用。
 * 
 * ============================================================================
 * 参数列表（按功能分组）：
 * 
 * 1. 地区识别与输出格式
 *   in=zh|en|quan|flag       输入识别方式（zh中文，en英文缩写，quan英文全称，flag国旗）
 *   out=zh|en|quan|flag      输出格式（默认同 in 或 zh）
 *   fgf=分隔符               唯一连接符（默认空格，传 0 无连接符）
 * 
 * 2. 前缀与编号
 *   name=机场名称            添加前缀，通过 fgf 连接
 *   one=1                    移除单节点编号
 * 
 * 3. 关键词保留与替换
 *   blkey=关键词1+关键词2>新名  保留自定义关键词，支持替换
 *   blgd=1                   保留固定格式标识（IPLC、IEPL等）
 *   bl=1                     倍率显示为 “数字×”
 *   blbz=1                   倍率显示为 “数字倍率”（覆盖 bl）
 *   blcs=1                   测速显示为 “数字Mbps”
 *   blnx=1                   只保留高倍率（>1x）节点
 *   nx=1                     保留 1x 或无倍率节点
 *   blpx=1                   对保留标识排序（特殊优先）
 * 
 * 4. 过滤
 *   clear=1                  清理乱名（套餐、到期、官网、回国等）
 *   pcgn=1                   排除中国大陆节点
 *   key=1                    额外过滤
 *   nm=1                     保留未匹配地区节点
 * 
 * 5. 去重
 *   jdqc=1                   去重（server+port+type 完全一致）
 *   jdqcyg=1                 去重（同一 server 只保留一个，优先级：Snell > hy2/tuic > AnyTLS > Trojan > Vmess > Shadowsocks > Vless > 其他UDP > 其他）
 *                             ★ jdqcyg 优先级高于 jdqc，启用时 jdqc 不生效
 *   jjdqc=1                  仅去重模式。启用后，其他所有参数均不生效，
 *                            只执行去重操作（规则由 jdqc 或 jdqcyg 决定），不进行重命名等操作
 * 
 * 6. 其他
 *   flag=1                   添加国旗
 *   blockquic=on|off         控制 block-quic
 *   debug=1                  调试模式
 * 
 * ============================================================================
 * 使用示例：
 *   # 仅按 server 去重，不重命名（使用 jdqcyg 规则）
 *   https://.../SubStore-ReName.js#jjdqc=1&jdqcyg=1
 * 
 *   # 仅三重去重，不重命名（使用 jdqc 规则）
 *   https://.../SubStore-ReName.js#jjdqc=1&jdqc=1
 * 
 *   # 按 server 去重并重命名（正常模式）
 *   https://.../SubStore-ReName.js#jdqcyg=1&name=机场&flag=1
 * ============================================================================
 */

// ---------- 参数解析 ----------
const inArg = $arguments;
const parseBool = (val) => val === true || val === '1' || val === 1 || val === 'true';

const nx = parseBool(inArg.nx);
const bl = parseBool(inArg.bl);
const blbz = parseBool(inArg.blbz);
const blcs = parseBool(inArg.blcs);
const key = parseBool(inArg.key);
const blgd = parseBool(inArg.blgd);
const blpx = parseBool(inArg.blpx);
const blnx = parseBool(inArg.blnx);
const numone = parseBool(inArg.one);
const clear = parseBool(inArg.clear);
const addflag = parseBool(inArg.flag);
const nm = parseBool(inArg.nm);
const pcgn = parseBool(inArg.pcgn);
const jdqc = parseBool(inArg.jdqc);
const jdqcyg = parseBool(inArg.jdqcyg);
const jjdqc = parseBool(inArg.jjdqc);

const FGF = inArg.fgf === undefined ? " " : (inArg.fgf === "0" ? "" : inArg.fgf);
const FNAME = inArg.name == undefined ? "" : inArg.name;
const BLKEY = inArg.blkey == undefined ? "" : inArg.blkey;
const blockquic = inArg.blockquic == undefined ? "" : inArg.blockquic;

const nameMap = { cn: "cn", zh: "cn", us: "us", en: "us", quan: "quan", gq: "gq", flag: "gq" };
const inname = nameMap[inArg.in] || "";
const outputName = nameMap[inArg.out] || "";

// ==========================================================================
// 1. 地区映射数据（国旗、英文缩写、中文、英文全称）
//    顺序必须一一对应
// ==========================================================================

// 国旗（Emoji）
const FG = [
  '🇭🇰','🇲🇴','🇹🇼','🇯🇵','🇰🇷','🇸🇬','🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇦🇺','🇦🇪',
  '🇦🇫','🇦🇱','🇩🇿','🇦🇴','🇦🇷','🇦🇲','🇦🇹','🇦🇿','🇧🇭','🇧🇩','🇧🇾','🇧🇪',
  '🇧🇿','🇧🇯','🇧🇹','🇧🇴','🇧🇦','🇧🇼','🇧🇷','🇻🇬','🇧🇳','🇧🇬','🇧🇫','🇧🇮',
  '🇰🇭','🇨🇲','🇨🇦','🇨🇻','🇰🇾','🇨🇫','🇹🇩','🇨🇱','🇨🇴','🇰🇲','🇨🇬','🇨🇩',
  '🇨🇷','🇭🇷','🇨🇾','🇨🇿','🇩🇰','🇩🇯','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇬🇶','🇪🇷',
  '🇪🇪','🇪🇹','🇫🇯','🇫🇮','🇬🇦','🇬🇲','🇬🇪','🇬🇭','🇬🇷','🇬🇱','🇬🇹','🇬🇳',
  '🇬🇾','🇭🇹','🇭🇳','🇭🇺','🇮🇸','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪','🇮🇲','🇮🇱',
  '🇮🇹','🇨🇮','🇯🇲','🇯🇴','🇰🇿','🇰🇪','🇰🇼','🇰🇬','🇱🇦','🇱🇻','🇱🇧','🇱🇸',
  '🇱🇷','🇱🇾','🇱🇹','🇱🇺','🇲🇰','🇲🇬','🇲🇼','🇲🇾','🇲🇻','🇲🇱','🇲🇹','🇲🇷',
  '🇲🇺','🇲🇽','🇲🇩','🇲🇨','🇲🇳','🇲🇪','🇲🇦','🇲🇿','🇲🇲','🇳🇦','🇳🇵','🇳🇱',
  '🇳🇿','🇳🇮','🇳🇪','🇳🇬','🇰🇵','🇳🇴','🇴🇲','🇵🇰','🇵🇦','🇵🇾','🇵🇪','🇵🇭',
  '🇵🇹','🇵🇷','🇶🇦','🇷🇴','🇷🇺','🇷🇼','🇸🇲','🇸🇦','🇸🇳','🇷🇸','🇸🇱','🇸🇰',
  '🇸🇮','🇸🇴','🇿🇦','🇪🇸','🇱🇰','🇸🇩','🇸🇷','🇸🇿','🇸🇪','🇨🇭','🇸🇾','🇹🇯',
  '🇹🇿','🇹🇭','🇹🇬','🇹🇴','🇹🇹','🇹🇳','🇹🇷','🇹🇲','🇻🇮','🇺🇬','🇺🇦','🇺🇾',
  '🇺🇿','🇻🇪','🇻🇳','🇾🇪','🇿🇲','🇿🇼','🇦🇩','🇷🇪','🇵🇱','🇬🇺','🇻🇦','🇱🇮',
  '🇨🇼','🇸🇨','🇦🇶','🇬🇮','🇨🇺','🇫🇴','🇦🇽','🇧🇲','🇹🇱'
];

// 英文缩写
const EN = [
  'HK','MO','TW','JP','KR','SG','US','GB','FR','DE','AU','AE',
  'AF','AL','DZ','AO','AR','AM','AT','AZ','BH','BD','BY','BE',
  'BZ','BJ','BT','BO','BA','BW','BR','VG','BN','BG','BF','BI',
  'KH','CM','CA','CV','KY','CF','TD','CL','CO','KM','CG','CD',
  'CR','HR','CY','CZ','DK','DJ','DO','EC','EG','SV','GQ','ER',
  'EE','ET','FJ','FI','GA','GM','GE','GH','GR','GL','GT','GN',
  'GY','HT','HN','HU','IS','IN','ID','IR','IQ','IE','IM','IL',
  'IT','CI','JM','JO','KZ','KE','KW','KG','LA','LV','LB','LS',
  'LR','LY','LT','LU','MK','MG','MW','MY','MV','ML','MT','MR',
  'MU','MX','MD','MC','MN','ME','MA','MZ','MM','NA','NP','NL',
  'NZ','NI','NE','NG','KP','NO','OM','PK','PA','PY','PE','PH',
  'PT','PR','QA','RO','RU','RW','SM','SA','SN','RS','SL','SK',
  'SI','SO','ZA','ES','LK','SD','SR','SZ','SE','CH','SY','TJ',
  'TZ','TH','TG','TO','TT','TN','TR','TM','VI','UG','UA','UY',
  'UZ','VE','VN','YE','ZM','ZW','AD','RE','PL','GU','VA','LI',
  'CW','SC','AQ','GI','CU','FO','AX','BM','TL'
];

// 中文名称
const ZH = [
  '香港','澳门','台湾','日本','韩国','新加坡','美国','英国','法国','德国','澳大利亚','阿联酋',
  '阿富汗','阿尔巴尼亚','阿尔及利亚','安哥拉','阿根廷','亚美尼亚','奥地利','阿塞拜疆','巴林','孟加拉国','白俄罗斯','比利时',
  '伯利兹','贝宁','不丹','玻利维亚','波斯尼亚和黑塞哥维那','博茨瓦纳','巴西','英属维京群岛','文莱','保加利亚','布基纳法索','布隆迪',
  '柬埔寨','喀麦隆','加拿大','佛得角','开曼群岛','中非共和国','乍得','智利','哥伦比亚','科摩罗','刚果(布)','刚果(金)',
  '哥斯达黎加','克罗地亚','塞浦路斯','捷克','丹麦','吉布提','多米尼加共和国','厄瓜多尔','埃及','萨尔瓦多','赤道几内亚','厄立特里亚',
  '爱沙尼亚','埃塞俄比亚','斐济','芬兰','加蓬','冈比亚','格鲁吉亚','加纳','希腊','格陵兰','危地马拉','几内亚',
  '圭亚那','海地','洪都拉斯','匈牙利','冰岛','印度','印尼','伊朗','伊拉克','爱尔兰','马恩岛','以色列',
  '意大利','科特迪瓦','牙买加','约旦','哈萨克斯坦','肯尼亚','科威特','吉尔吉斯斯坦','老挝','拉脱维亚','黎巴嫩','莱索托',
  '利比里亚','利比亚','立陶宛','卢森堡','马其顿','马达加斯加','马拉维','马来','马尔代夫','马里','马耳他','毛利塔尼亚',
  '毛里求斯','墨西哥','摩尔多瓦','摩纳哥','蒙古','黑山共和国','摩洛哥','莫桑比克','缅甸','纳米比亚','尼泊尔','荷兰',
  '新西兰','尼加拉瓜','尼日尔','尼日利亚','朝鲜','挪威','阿曼','巴基斯坦','巴拿马','巴拉圭','秘鲁','菲律宾',
  '葡萄牙','波多黎各','卡塔尔','罗马尼亚','俄罗斯','卢旺达','圣马力诺','沙特阿拉伯','塞内加尔','塞尔维亚','塞拉利昂','斯洛伐克',
  '斯洛文尼亚','索马里','南非','西班牙','斯里兰卡','苏丹','苏里南','斯威士兰','瑞典','瑞士','叙利亚','塔吉克斯坦',
  '坦桑尼亚','泰国','多哥','汤加','特立尼达和多巴哥','突尼斯','土耳其','土库曼斯坦','美属维尔京群岛','乌干达','乌克兰','乌拉圭',
  '乌兹别克斯坦','委内瑞拉','越南','也门','赞比亚','津巴布韦','安道尔','留尼汪','波兰','关岛','梵蒂冈','列支敦士登',
  '库拉索','塞舌尔','南极','直布罗陀','古巴','法罗群岛','奥兰群岛','百慕达','东帝汶'
];

// 英文全称
const QC = [
  'Hong Kong','Macao','Taiwan','Japan','Korea','Singapore','United States','United Kingdom','France','Germany','Australia','Dubai',
  'Afghanistan','Albania','Algeria','Angola','Argentina','Armenia','Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium',
  'Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','British Virgin Islands','Brunei','Bulgaria','Burkina-faso','Burundi',
  'Cambodia','Cameroon','Canada','CapeVerde','CaymanIslands','Central African Republic','Chad','Chile','Colombia','Comoros','Congo-Brazzaville','Congo-Kinshasa',
  'CostaRica','Croatia','Cyprus','Czech Republic','Denmark','Djibouti','Dominican Republic','Ecuador','Egypt','EISalvador','Equatorial Guinea','Eritrea',
  'Estonia','Ethiopia','Fiji','Finland','Gabon','Gambia','Georgia','Ghana','Greece','Greenland','Guatemala','Guinea',
  'Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Isle of Man','Israel',
  'Italy','Ivory Coast','Jamaica','Jordan','Kazakstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho',
  'Liberia','Libya','Lithuania','Luxembourg','Macedonia','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Mauritania',
  'Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar(Burma)','Namibia','Nepal','Netherlands',
  'New Zealand','Nicaragua','Niger','Nigeria','NorthKorea','Norway','Oman','Pakistan','Panama','Paraguay','Peru','Philippines',
  'Portugal','PuertoRico','Qatar','Romania','Russia','Rwanda','SanMarino','SaudiArabia','Senegal','Serbia','SierraLeone','Slovakia',
  'Slovenia','Somalia','SouthAfrica','Spain','SriLanka','Sudan','Suriname','Swaziland','Sweden','Switzerland','Syria','Tajikstan',
  'Tanzania','Thailand','Togo','Tonga','TrinidadandTobago','Tunisia','Turkey','Turkmenistan','U.S.Virgin Islands','Uganda','Ukraine','Uruguay',
  'Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe','Andorra','Reunion','Poland','Guam','Vatican','Liechtensteins',
  'Curacao','Seychelles','Antarctica','Gibraltar','Cuba','Faroe Islands','Ahvenanmaa','Bermuda','Timor-Leste'
];

// ==========================================================================
// 2. 正则与关键词
// ==========================================================================

const specialRegex = [
  /(\d\.)?\d+×/,
  /IPLC|IEPL|Kern|Edge|Pro|Std|Exp|Biz|Fam|Game|Buy|Zx|LB|Game/
];

const nameclear =
  /(套餐|到期|有效|剩余|版本|已用|过期|失联|测试|官方|网址|备用|群|TEST|客服|网站|获取|订阅|流量|机场|下次|官址|联系|邮箱|工单|学术|USE|USED|TOTAL|EXPIRE|EMAIL|官网|回国)/i;

const regexArray = [
  /ˣ²/, /ˣ³/, /ˣ⁴/, /ˣ⁵/, /ˣ⁶/, /ˣ⁷/, /ˣ⁸/, /ˣ⁹/, /ˣ¹⁰/,
  /ˣ²⁰/, /ˣ³⁰/, /ˣ⁴⁰/, /ˣ⁵⁰/,
  /IPLC/i, /IEPL/i, /核心/, /边缘/, /高级/, /标准/, /实验/, /商宽/, /家宽/,
  /游戏|game/i, /购物/, /专线/, /LB/, /cloudflare/i, /\budp\b/i, /\bgpt\b/i, /udpn\b/
];
const valueArray = [
  "2×","3×","4×","5×","6×","7×","8×","9×","10×",
  "20×","30×","40×","50×",
  "IPLC","IEPL","Kern","Edge","Pro","Std","Exp","Biz","Fam","Game",
  "Buy","Zx","LB","CF","UDP","GPT","UDPN"
];

const nameblnx = /(高倍|(?!1)2+(x|倍)|ˣ²|ˣ³|ˣ⁴|ˣ⁵|ˣ¹⁰)/i;
const namenx   = /(高倍|(?!1)(0\.|\d)+(x|倍)|ˣ²|ˣ³|ˣ⁴|ˣ⁵|ˣ¹⁰)/i;

const keya = /港|Hong|HK|新加坡|SG|Singapore|日本|Japan|JP|美国|United States|US|韩|土耳其|TR|Turkey|Korea|KR|🇸🇬|🇭🇰|🇯🇵|🇺🇸|🇰🇷|🇹🇷/i;
const keyb = /(((1|2|3|4)\d)|(香港|Hong|HK) 0[5-9]|((新加坡|SG|Singapore|日本|Japan|JP|美国|United States|US|韩|土耳其|TR|Turkey|Korea|KR) 0[3-9]))/i;

const rurekey = {
  "美国": /美西|美东|洛杉矶|圣何塞|硅谷|俄勒冈|西雅图|达拉斯|亚特兰大|迈阿密|纽约|芝加哥|凤凰城|丹佛|拉斯维加斯|休斯顿|华盛顿|旧金山|USA|America|United States|波特兰|哥伦布/gi,
  "加拿大": /温哥华|多伦多|蒙特利尔|卡尔加里|渥太华|CA|Canada/gi,
  "墨西哥": /墨西哥城|MX|Mexico/gi,
  "巴西": /圣保罗|里约热内卢|巴西利亚|BR|Brazil/gi,
  "阿根廷": /布宜诺斯艾利斯|AR|Argentina/gi,
  "智利": /圣地亚哥|CL|Chile/gi,
  "哥伦比亚": /波哥大|CO|Colombia/gi,
  "秘鲁": /利马|PE|Peru/gi,
  "委内瑞拉": /加拉加斯|VE|Venezuela/gi,
  "英国": /伦敦|曼彻斯特|伯明翰|UK|United Kingdom|Britain|Great Britain/gi,
  "德国": /法兰克福|柏林|慕尼黑|杜塞尔多夫|DE|Germany|Frankfurt/gi,
  "法国": /巴黎|马赛|里昂|FR|France/gi,
  "荷兰": /阿姆斯特丹|鹿特丹|NL|Netherlands/gi,
  "瑞典": /斯德哥尔摩|哥德堡|SE|Sweden/gi,
  "挪威": /奥斯陆|卑尔根|NO|Norway/gi,
  "芬兰": /赫尔辛基|FI|Finland/gi,
  "丹麦": /哥本哈根|DK|Denmark/gi,
  "波兰": /华沙|克拉科夫|PL|Poland/gi,
  "意大利": /米兰|罗马|都灵|IT|Italy/gi,
  "西班牙": /马德里|巴塞罗那|ES|Spain/gi,
  "葡萄牙": /里斯本|波尔图|PT|Portugal/gi,
  "比利时": /布鲁塞尔|BE|Belgium/gi,
  "瑞士": /苏黎世|日内瓦|CH|Switzerland|Zurich/gi,
  "奥地利": /维也纳|AT|Austria/gi,
  "爱尔兰": /都柏林|IE|Ireland/gi,
  "捷克": /布拉格|CZ|Czech/gi,
  "匈牙利": /布达佩斯|HU|Hungary/gi,
  "罗马尼亚": /布加勒斯特|RO|Romania/gi,
  "乌克兰": /基辅|UA|Ukraine/gi,
  "俄罗斯": /莫斯科|圣彼得堡|RU|Russia/gi,
  "土耳其": /伊斯坦布尔|安卡拉|TR|Turkey/gi,
  "香港": /香港|Hongkong|HONG KONG|HK/gi,
  "台湾": /台北|新北|台中|高雄|台南|台(?!.*线)|Taipei|Taiwan|TW/gi,
  "日本": /东京|大阪|名古屋|福冈|札幌|JP|Japan|Tokyo|Osaka/gi,
  "韩国": /首尔|春川|KR|Korea|Seoul|Chuncheon/gi,
  "新加坡": /狮城|SG|Singapore/gi,
  "马来西亚": /吉隆坡|MY|Malaysia/gi,
  "菲律宾": /马尼拉|PH|Philippines/gi,
  "泰国": /曼谷|TH|Thailand/gi,
  "越南": /河内|胡志明|VN|Vietnam/gi,
  "印尼": /雅加达|ID|Indonesia|印度尼西亚/gi,
  "印度": /孟买|新德里|班加罗尔|IN|India/gi,
  "巴基斯坦": /卡拉奇|拉合尔|PK|Pakistan/gi,
  "孟加拉": /达卡|BD|Bangladesh/gi,
  "斯里兰卡": /科伦坡|LK|Sri Lanka/gi,
  "尼泊尔": /加德满都|NP|Nepal/gi,
  "缅甸": /仰光|内比都|MM|Myanmar/gi,
  "老挝": /万象|LA|Laos/gi,
  "柬埔寨": /金边|KH|Cambodia/gi,
  "阿联酋": /迪拜|阿布扎比|AE|UAE|Dubai/gi,
  "沙特阿拉伯": /利雅得|吉达|SA|Saudi/gi,
  "以色列": /特拉维夫|耶路撒冷|IL|Israel/gi,
  "伊朗": /德黑兰|IR|Iran/gi,
  "伊拉克": /巴格达|IQ|Iraq/gi,
  "科威特": /科威特城|KW|Kuwait/gi,
  "卡塔尔": /多哈|QA|Qatar/gi,
  "阿曼": /马斯喀特|OM|Oman/gi,
  "巴林": /麦纳麦|BH|Bahrain/gi,
  "澳大利亚": /悉尼|墨尔本|布里斯班|珀斯|阿德莱德|AU|Australia/gi,
  "新西兰": /奥克兰|惠灵顿|NZ|New Zealand/gi,
  "南非": /约翰内斯堡|开普敦|比勒陀利亚|ZA|South Africa/gi,
  "埃及": /开罗|亚历山大|EG|Egypt/gi,
  "尼日利亚": /拉各斯|阿布贾|NG|Nigeria/gi,
  "肯尼亚": /内罗毕|蒙巴萨|KE|Kenya/gi,
  "摩洛哥": /卡萨布兰卡|拉巴特|MA|Morocco/gi,
  GB: /UK/g,
  "B-G-P": /BGP/g,
  "Russia Moscow": /Moscow/g,
  "Korea Chuncheon": /Chuncheon|Seoul/g,
  "Hong Kong": /Hongkong|HONG KONG/gi,
  "United Kingdom London": /London|Great Britain/g,
  "Dubai United Arab Emirates": /United Arab Emirates/g,
  "Taiwan TW 台湾 🇹🇼": /(台|Tai\s?wan|TW).*?🇨🇳|🇨🇳.*?(台|Tai\s?wan|TW)/g,
  "United States": /USA|Los Angeles|San Jose|Silicon Valley|Michigan/g,
  澳大利亚: /澳洲|墨尔本|悉尼|土澳|(深|沪|呼|京|广|杭)澳/g,
  德国: /(深|沪|呼|京|广|杭)德(?!.*(I|线))|法兰克福|滬德/g,
  香港: /(深|沪|呼|京|广|杭)港(?!.*(I|线))/g,
  日本: /(深|沪|呼|京|广|杭|中|辽)日(?!.*(I|线))|东京|大坂/g,
  新加坡: /狮城|(深|沪|呼|京|广|杭)新/g,
  美国: /(深|沪|呼|京|广|杭)美|波特兰|芝加哥|哥伦布|纽约|硅谷|俄勒冈|西雅图|芝加哥/g,
  波斯尼亚和黑塞哥维那: /波黑共和国/g,
  印尼: /印度尼西亚|雅加达/g,
  印度: /孟买/g,
  阿联酋: /迪拜|阿拉伯联合酋长国/g,
  孟加拉国: /孟加拉/g,
  捷克: /捷克共和国/g,
  台湾: /新台|新北|台(?!.*线)/g,
  Taiwan: /Taipei/g,
  韩国: /春川|韩|首尔/g,
  Japan: /Tokyo|Osaka/g,
  英国: /伦敦/g,
  India: /Mumbai/g,
  Germany: /Frankfurt/g,
  Switzerland: /Zurich/g,
  俄罗斯: /莫斯科/g,
  土耳其: /伊斯坦布尔/g,
  泰国: /泰國|曼谷/g,
  法国: /巴黎/g,
  G: /\d\s?GB/gi,
  Esnc: /esnc/gi,
};

// ==========================================================================
// 3. 辅助函数
// ==========================================================================

function getList(arg) {
  switch (arg) {
    case 'us':   return EN;
    case 'gq':   return FG;
    case 'quan': return QC;
    default:     return ZH;
  }
}

function fampx(pro) {
  const wis = [];
  const wnout = [];
  for (const proxy of pro) {
    const fan = specialRegex.some((regex) => regex.test(proxy.name));
    if (fan) {
      wis.push(proxy);
    } else {
      wnout.push(proxy);
    }
  }
  const sps = wis.map((proxy) => specialRegex.findIndex((regex) => regex.test(proxy.name)));
  wis.sort(
    (a, b) => sps[wis.indexOf(a)] - sps[wis.indexOf(b)] || a.name.localeCompare(b.name)
  );
  wnout.sort((a, b) => pro.indexOf(a) - pro.indexOf(b));
  return wnout.concat(wis);
}

let GetK = false, AMK = [];
function ObjKA(i) {
  GetK = true;
  AMK = Object.entries(i);
}

// ---------- 协议优先级函数（用于 jdqcyg） ----------
function getPriority(type) {
  if (!type) return 10;
  const t = type.toLowerCase();
  if (t.includes('snell')) return 1;
  if (t.includes('hy2') || t.includes('hysteria2') || t.includes('tuic')) return 2;
  if (t.includes('anytls')) return 3;
  if (t.includes('trojan')) return 4;
  if (t.includes('vmess')) return 5;
  if (t.includes('ss') && !t.includes('vless')) return 6;
  if (t.includes('vless')) return 7;
  if (t.includes('wireguard') || t.includes('hysteria') || t.includes('quic') || t.includes('udp')) return 8;
  return 9;
}

// ==========================================================================
// 4. 主函数 operator
// ==========================================================================
function operator(pro) {
  // ========================================================================
  // 第一步：去重（无论 jjdqc 是否启用，都先执行去重）
  // ========================================================================
  if (jdqcyg) {
    // 按 server 去重，优先保留高优先级协议
    const groupMap = new Map();
    pro.forEach(node => {
      const server = node.server || '';
      if (!groupMap.has(server)) groupMap.set(server, []);
      groupMap.get(server).push(node);
    });
    const result = [];
    for (const [server, nodes] of groupMap) {
      let best = nodes[0];
      let bestPriority = getPriority(best.type);
      for (let i = 1; i < nodes.length; i++) {
        const p = getPriority(nodes[i].type);
        if (p < bestPriority) {
          bestPriority = p;
          best = nodes[i];
        }
      }
      result.push(best);
    }
    pro = result;
  } else if (jdqc) {
    // 三重去重（server + port + type 完全一致）
    const seen = new Set();
    pro = pro.filter(node => {
      const key = `${node.server || ''}:${node.port || ''}:${node.type || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ========================================================================
  // 第二步：检查 jjdqc（仅去重模式）
  // 如果 jjdqc=1，直接返回去重后的结果，不进行任何其他操作
  // ========================================================================
  if (jjdqc) {
    return pro;
  }

  // ========================================================================
  // 第三步：以下为正常模式（执行所有其他操作）
  // ========================================================================

  // ---------- 排除中国大陆节点 ----------
  if (pcgn) {
    const chinaRegex = /(?:^|\s)(北京|上海|广州|深圳|杭州|成都|武汉|南京|重庆|天津|苏州|郑州|长沙|西安|东莞|青岛|沈阳|宁波|昆明|大连|厦门|合肥|佛山|福州|哈尔滨|济南|长春|温州|石家庄|贵阳|常州|徐州|嘉兴|金华|南宁|泉州|呼和浩特|太原|乌鲁木齐|兰州|银川|海口|拉萨|西宁|南昌|中国|国内|CN|China)(?=\s|$)/i;
    pro = pro.filter(p => !chinaRegex.test(p.name));
  }

  // ---------- 构建地区映射 ----------
  const Allmap = {};
  const outList = getList(outputName);
  let inputList, retainKey = "";
  if (inname !== "") {
    inputList = [getList(inname)];
  } else {
    inputList = [ZH, FG, QC, EN];
  }
  inputList.forEach((arr) => {
    arr.forEach((value, valueIndex) => {
      Allmap[value] = outList[valueIndex];
    });
  });

  // ---------- 过滤 ----------
  if (clear || nx || blnx || key) {
    pro = pro.filter((res) => {
      const resname = res.name;
      return !(clear && nameclear.test(resname)) &&
             !(nx && namenx.test(resname)) &&
             !(blnx && !nameblnx.test(resname)) &&
             !(key && !(keya.test(resname) && /2|4|6|7/i.test(resname)));
    });
  }

  const BLKEYS = BLKEY ? BLKEY.split("+") : "";
  const regionCount = {};
  const regionTotal = {};

  if (numone) {
    pro.forEach(e => {
      !GetK && ObjKA(Allmap);
      const findKey = AMK.find(([key]) => e.name.includes(key));
      if (findKey?.[1]) {
        const region = findKey[1];
        regionTotal[region] = (regionTotal[region] || 0) + 1;
      }
    });
  }

  // ---------- 重命名每个节点 ----------
  pro.forEach((e) => {
    let bktf = false, ens = e.name;

    Object.keys(rurekey).forEach((ikey) => {
      if (rurekey[ikey].test(e.name)) {
        e.name = e.name.replace(rurekey[ikey], ikey);
        if (BLKEY) {
          bktf = true;
          let BLKEY_REPLACE = "", re = false;
          BLKEYS.forEach((i) => {
            if (i.includes(">") && ens.includes(i.split(">")[0])) {
              if (rurekey[ikey].test(i.split(">")[0])) {
                e.name += " " + i.split(">")[0];
              }
              if (i.split(">")[1]) {
                BLKEY_REPLACE = i.split(">")[1];
                re = true;
              }
            } else {
              if (ens.includes(i)) {
                e.name += " " + i;
              }
            }
            retainKey = re ? BLKEY_REPLACE : BLKEYS.filter((items) => e.name.includes(items));
          });
        }
      }
    });

    if (blockquic == "on") {
      e["block-quic"] = "on";
    } else if (blockquic == "off") {
      e["block-quic"] = "off";
    } else {
      delete e["block-quic"];
    }

    if (!bktf && BLKEY) {
      let BLKEY_REPLACE = "", re = false;
      BLKEYS.forEach((i) => {
        if (i.includes(">") && e.name.includes(i.split(">")[0])) {
          if (i.split(">")[1]) {
            BLKEY_REPLACE = i.split(">")[1];
            re = true;
          }
        }
      });
      retainKey = re ? BLKEY_REPLACE : BLKEYS.filter((items) => e.name.includes(items));
    }

    let ikey = "", ikeys = "";
    if (blgd) {
      regexArray.forEach((regex, index) => {
        if (regex.test(e.name)) {
          ikeys = valueArray[index];
        }
      });
    }

    const extractRate = bl || blbz;
    if (extractRate) {
      const match = e.name.match(
        /((倍率|X|x|×)\D?((\d{1,3}\.)?\d+)\D?)|((\d{1,3}\.)?\d+)(倍|X|x|×)/
      );
      if (match) {
        const rev = match[0].match(/(\d[\d.]*)/)[0];
        if (rev !== "1") {
          ikey = blbz ? rev + "倍率" : rev + "×";
        }
      }
    }

    let csStr = "";
    if (blcs) {
      const speedMatch = e.name.match(/(\d+(?:\.\d+)?)\s*([Mm]bps)/);
      if (speedMatch) {
        csStr = speedMatch[1] + "Mbps";
      }
    }

    !GetK && ObjKA(Allmap);
    const findKey = AMK.find(([key]) => e.name.includes(key));

    let usflag = "";
    let regionPure = "";
    if (findKey?.[1]) {
      regionPure = findKey[1];
      if (addflag) {
        const index = outList.indexOf(regionPure);
        if (index !== -1) {
          usflag = FG[index];
          usflag = usflag === "🇹🇼" ? "🇨🇳" : usflag;
        }
      }
      if (!regionCount[regionPure]) regionCount[regionPure] = 0;
      regionCount[regionPure]++;
      const num = String(regionCount[regionPure]).padStart(2, '0');
      const regionWithNum = regionPure + FGF + num;

      const restParts = [regionWithNum, retainKey, ikey, csStr, ikeys].filter(k => k !== "");
      let mainPart = restParts.join(FGF);
      if (FNAME) mainPart = FNAME + FGF + mainPart;
      e.name = usflag ? usflag + (mainPart ? FGF : '') + mainPart : mainPart;
      e._region = regionPure;
    } else {
      if (nm) {
        e.name = FNAME ? FNAME + FGF + e.name : e.name;
      } else {
        e.name = null;
      }
    }
  });

  pro = pro.filter(e => e.name !== null);

  if (numone) {
    pro.forEach(e => {
      if (e._region && regionTotal[e._region] === 1) {
        const regex = new RegExp(e._region + FGF + '\\d{2}');
        e.name = e.name.replace(regex, e._region);
      }
    });
  }

  if (blpx) pro = fampx(pro);
  if (key) pro = pro.filter(e => !keyb.test(e.name));

  return pro;
}