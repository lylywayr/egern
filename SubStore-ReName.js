/**
 * ============================================================================
 * 脚本名称：Sub-Store 节点重命名脚本 (SubStore-ReName.js)
 * 功能说明：对代理节点进行智能重命名、地区识别、关键词保留、过滤和排序。
 * 适用平台：Sub-Store (https://sub-store.app/)
 * 更新日期：2026-06-22
 * 版本：2.6 (新增 pcgn 参数排除中国大陆节点)
 * 作者：lylywayr
 * 
 * ============================================================================
 * 使用方法：
 * 将本脚本作为 Sub-Store 的“脚本操作”，通过 URL 参数传递配置。
 * 格式：https://raw.githubusercontent.com/你的用户名/仓库名/SubStore-ReName.js#参数1=值&参数2=值...
 * 
 * 注意：所有布尔类型参数（如 flag、clear、bl 等）只有显式传递 =1 或 =true 时才启用。
 * 例如：flag=1 启用，flag=0 或 不传 则关闭。
 * 
 * ============================================================================
 * 完整参数列表（按功能分组）：
 * 
 * 1. 地区识别与输出格式
 *   in=zh|en|quan|flag       输入识别方式（zh/cn：中文，en/us：英文缩写，quan：英文全称，flag/gq：国旗），默认自动判断
 *   out=zh|en|quan|flag      输出格式（默认同 in 或 zh）
 *   fgf=分隔符               前缀/国旗与名称间的分隔符（默认空格，需 URL 编码，如 %20）
 *   sn=分隔符                地区名与序号间的分隔符（默认空格）
 * 
 * 2. 前缀与排序
 *   name=机场名称            添加机场前缀
 *   nf=1                     将前缀放在最前面（默认放在地区名之后）
 *   one=1                    移除只有一个节点时的 "01" 序号
 * 
 * 3. 关键词保留与替换
 *   blkey=关键词1+关键词2>新名  保留指定的自定义关键词，多个用 + 连接。
 *                             支持用 > 将原词替换为新词（如 IPLC>专线）
 *   blgd=1                   保留固定格式标识（如 IPLC、IEPL、核心、边缘、家宽等）
 *   bl=1                     提取并保留倍率标识（如 x2、3×），显示为 “数字×”
 *   blbz=1                   提取并保留倍率标识，显示为 “数字倍率”（如 2倍率）
 *                             ★ bl 与 blbz 互不依赖，可单独使用；若同时启用，blbz 覆盖 bl 的格式
 *   blnx=1                   只保留高倍率（>1x）节点，删除 1x 或无倍率节点
 *   nx=1                     保留 1x 或无倍率节点（与 bl 配合使用）
 *   blpx=1                   对保留的倍率标识进行分组排序（特殊标识优先）
 * 
 * 4. 过滤与清理
 *   clear=1                  清理含乱名关键词（如“套餐”“到期”“失效”“官网”“回国”等）的节点
 *   pcgn=1                   排除中国大陆节点（基于城市名、国家名等关键词），不影响港澳台
 *   key=1                    启用额外过滤规则（基于内部正则）
 *   nm=1                     保留未匹配到地区的节点（只添加前缀，不改变原名）
 * 
 * 5. 其他功能
 *   flag=1                   在节点名中添加国旗图标（根据地区自动匹配）
 *   blockquic=on|off         控制是否添加 block-quic 参数（on/off）
 *   debug=1                  调试模式（输出日志，需脚本支持）
 * 
 * ============================================================================
 * 使用示例：
 *   # 仅添加前缀和国旗
 *   https://.../SubStore-ReName.js#name=我的机场&flag=1
 * 
 *   # 提取倍率，标准化为“倍率”，保留 IPLC 和 GPT 关键词，清理乱名，排除国内节点
 *   https://.../SubStore-ReName.js#name=我的机场&blbz=1&blkey=IPLC+GPT&clear=1&pcgn=1
 * 
 *   # 只保留高倍率节点，输出英文缩写，自定义分隔符
 *   https://.../SubStore-ReName.js#blnx=1&out=en&fgf=-&sn=_
 * 
 *   # 同时启用 bl 和 blbz（blbz 生效）
 *   https://.../SubStore-ReName.js#bl=1&blbz=1
 * ============================================================================
 */

// ---------- Sub-Store 注入的参数对象 ----------
const inArg = $arguments;

// ---------- 辅助函数：严格解析布尔值 ----------
const parseBool = (val) => val === true || val === '1' || val === 1 || val === 'true';

// ---------- 解析所有参数 ----------
const nx = parseBool(inArg.nx);
const bl = parseBool(inArg.bl);
const blbz = parseBool(inArg.blbz);
const nf = parseBool(inArg.nf);
const key = parseBool(inArg.key);
const blgd = parseBool(inArg.blgd);
const blpx = parseBool(inArg.blpx);
const blnx = parseBool(inArg.blnx);
const numone = parseBool(inArg.one);
const debug = parseBool(inArg.debug);
const clear = parseBool(inArg.clear);
const addflag = parseBool(inArg.flag);
const nm = parseBool(inArg.nm);
const pcgn = parseBool(inArg.pcgn);  // 新增：排除中国大陆节点

const FGF = inArg.fgf == undefined ? " " : decodeURI(inArg.fgf);
const XHFGF = inArg.sn == undefined ? " " : decodeURI(inArg.sn);
const FNAME = inArg.name == undefined ? "" : decodeURI(inArg.name);
const BLKEY = inArg.blkey == undefined ? "" : decodeURI(inArg.blkey);
const blockquic = inArg.blockquic == undefined ? "" : decodeURI(inArg.blockquic);

const nameMap = { cn: "cn", zh: "cn", us: "us", en: "us", quan: "quan", gq: "gq", flag: "gq" };
const inname = nameMap[inArg.in] || "";
const outputName = nameMap[inArg.out] || "";

// ========== 地区数据（国旗、英文缩写、中文、英文全称） ==========
// 这些数据用于地区识别和输出，顺序必须一一对应
// 为了节省篇幅，此处仅保留占位，实际使用时请放入完整数组（下方已包含完整数据）

// 以下为完整数据（省略的数组内容请从之前的脚本复制，确保完整）
// 由于篇幅限制，这里只给出示意，实际脚本中需包含完整的 FG, EN, ZH, QC 数组。
// 为了确保完整性，您可以从之前的回答中复制这些数组，或使用下面完整版本。

// ==========================================================================
// 下面开始正式的数据定义（完整版）
// ==========================================================================

// 国旗列表
// prettier-ignore
const FG = ['🇭🇰','🇲🇴','🇹🇼','🇯🇵','🇰🇷','🇸🇬','🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇦🇺','🇦🇪','🇦🇫','🇦🇱','🇩🇿','🇦🇴','🇦🇷','🇦🇲','🇦🇹','🇦🇿','🇧🇭','🇧🇩','🇧🇾','🇧🇪','🇧🇿','🇧🇯','🇧🇹','🇧🇴','🇧🇦','🇧🇼','🇧🇷','🇻🇬','🇧🇳','🇧🇬','🇧🇫','🇧🇮','🇰🇭','🇨🇲','🇨🇦','🇨🇻','🇰🇾','🇨🇫','🇹🇩','🇨🇱','🇨🇴','🇰🇲','🇨🇬','🇨🇩','🇨🇷','🇭🇷','🇨🇾','🇨🇿','🇩🇰','🇩🇯','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇬🇶','🇪🇷','🇪🇪','🇪🇹','🇫🇯','🇫🇮','🇬🇦','🇬🇲','🇬🇪','🇬🇭','🇬🇷','🇬🇱','🇬🇹','🇬🇳','🇬🇾','🇭🇹','🇭🇳','🇭🇺','🇮🇸','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪','🇮🇲','🇮🇱','🇮🇹','🇨🇮','🇯🇲','🇯🇴','🇰🇿','🇰🇪','🇰🇼','🇰🇬','🇱🇦','🇱🇻','🇱🇧','🇱🇸','🇱🇷','🇱🇾','🇱🇹','🇱🇺','🇲🇰','🇲🇬','🇲🇼','🇲🇾','🇲🇻','🇲🇱','🇲🇹','🇲🇷','🇲🇺','🇲🇽','🇲🇩','🇲🇨','🇲🇳','🇲🇪','🇲🇦','🇲🇿','🇲🇲','🇳🇦','🇳🇵','🇳🇱','🇳🇿','🇳🇮','🇳🇪','🇳🇬','🇰🇵','🇳🇴','🇴🇲','🇵🇰','🇵🇦','🇵🇾','🇵🇪','🇵🇭','🇵🇹','🇵🇷','🇶🇦','🇷🇴','🇷🇺','🇷🇼','🇸🇲','🇸🇦','🇸🇳','🇷🇸','🇸🇱','🇸🇰','🇸🇮','🇸🇴','🇿🇦','🇪🇸','🇱🇰','🇸🇩','🇸🇷','🇸🇿','🇸🇪','🇨🇭','🇸🇾','🇹🇯','🇹🇿','🇹🇭','🇹🇬','🇹🇴','🇹🇹','🇹🇳','🇹🇷','🇹🇲','🇻🇮','🇺🇬','🇺🇦','🇺🇾','🇺🇿','🇻🇪','🇻🇳','🇾🇪','🇿🇲','🇿🇼','🇦🇩','🇷🇪','🇵🇱','🇬🇺','🇻🇦','🇱🇮','🇨🇼','🇸🇨','🇦🇶','🇬🇮','🇨🇺','🇫🇴','🇦🇽','🇧🇲','🇹🇱'];

// 英文缩写
// prettier-ignore
const EN = ['HK','MO','TW','JP','KR','SG','US','GB','FR','DE','AU','AE','AF','AL','DZ','AO','AR','AM','AT','AZ','BH','BD','BY','BE','BZ','BJ','BT','BO','BA','BW','BR','VG','BN','BG','BF','BI','KH','CM','CA','CV','KY','CF','TD','CL','CO','KM','CG','CD','CR','HR','CY','CZ','DK','DJ','DO','EC','EG','SV','GQ','ER','EE','ET','FJ','FI','GA','GM','GE','GH','GR','GL','GT','GN','GY','HT','HN','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','CI','JM','JO','KZ','KE','KW','KG','LA','LV','LB','LS','LR','LY','LT','LU','MK','MG','MW','MY','MV','ML','MT','MR','MU','MX','MD','MC','MN','ME','MA','MZ','MM','NA','NP','NL','NZ','NI','NE','NG','KP','NO','OM','PK','PA','PY','PE','PH','PT','PR','QA','RO','RU','RW','SM','SA','SN','RS','SL','SK','SI','SO','ZA','ES','LK','SD','SR','SZ','SE','CH','SY','TJ','TZ','TH','TG','TO','TT','TN','TR','TM','VI','UG','UA','UY','UZ','VE','VN','YE','ZM','ZW','AD','RE','PL','GU','VA','LI','CW','SC','AQ','GI','CU','FO','AX','BM','TL'];

// 中文名称
// prettier-ignore
const ZH = ['香港','澳门','台湾','日本','韩国','新加坡','美国','英国','法国','德国','澳大利亚','阿联酋','阿富汗','阿尔巴尼亚','阿尔及利亚','安哥拉','阿根廷','亚美尼亚','奥地利','阿塞拜疆','巴林','孟加拉国','白俄罗斯','比利时','伯利兹','贝宁','不丹','玻利维亚','波斯尼亚和黑塞哥维那','博茨瓦纳','巴西','英属维京群岛','文莱','保加利亚','布基纳法索','布隆迪','柬埔寨','喀麦隆','加拿大','佛得角','开曼群岛','中非共和国','乍得','智利','哥伦比亚','科摩罗','刚果(布)','刚果(金)','哥斯达黎加','克罗地亚','塞浦路斯','捷克','丹麦','吉布提','多米尼加共和国','厄瓜多尔','埃及','萨尔瓦多','赤道几内亚','厄立特里亚','爱沙尼亚','埃塞俄比亚','斐济','芬兰','加蓬','冈比亚','格鲁吉亚','加纳','希腊','格陵兰','危地马拉','几内亚','圭亚那','海地','洪都拉斯','匈牙利','冰岛','印度','印尼','伊朗','伊拉克','爱尔兰','马恩岛','以色列','意大利','科特迪瓦','牙买加','约旦','哈萨克斯坦','肯尼亚','科威特','吉尔吉斯斯坦','老挝','拉脱维亚','黎巴嫩','莱索托','利比里亚','利比亚','立陶宛','卢森堡','马其顿','马达加斯加','马拉维','马来','马尔代夫','马里','马耳他','毛利塔尼亚','毛里求斯','墨西哥','摩尔多瓦','摩纳哥','蒙古','黑山共和国','摩洛哥','莫桑比克','缅甸','纳米比亚','尼泊尔','荷兰','新西兰','尼加拉瓜','尼日尔','尼日利亚','朝鲜','挪威','阿曼','巴基斯坦','巴拿马','巴拉圭','秘鲁','菲律宾','葡萄牙','波多黎各','卡塔尔','罗马尼亚','俄罗斯','卢旺达','圣马力诺','沙特阿拉伯','塞内加尔','塞尔维亚','塞拉利昂','斯洛伐克','斯洛文尼亚','索马里','南非','西班牙','斯里兰卡','苏丹','苏里南','斯威士兰','瑞典','瑞士','叙利亚','塔吉克斯坦','坦桑尼亚','泰国','多哥','汤加','特立尼达和多巴哥','突尼斯','土耳其','土库曼斯坦','美属维尔京群岛','乌干达','乌克兰','乌拉圭','乌兹别克斯坦','委内瑞拉','越南','也门','赞比亚','津巴布韦','安道尔','留尼汪','波兰','关岛','梵蒂冈','列支敦士登','库拉索','塞舌尔','南极','直布罗陀','古巴','法罗群岛','奥兰群岛','百慕达','东帝汶'];

// 英文全称
// prettier-ignore
const QC = ['Hong Kong','Macao','Taiwan','Japan','Korea','Singapore','United States','United Kingdom','France','Germany','Australia','Dubai','Afghanistan','Albania','Algeria','Angola','Argentina','Armenia','Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','British Virgin Islands','Brunei','Bulgaria','Burkina-faso','Burundi','Cambodia','Cameroon','Canada','CapeVerde','CaymanIslands','Central African Republic','Chad','Chile','Colombia','Comoros','Congo-Brazzaville','Congo-Kinshasa','CostaRica','Croatia','Cyprus','Czech Republic','Denmark','Djibouti','Dominican Republic','Ecuador','Egypt','EISalvador','Equatorial Guinea','Eritrea','Estonia','Ethiopia','Fiji','Finland','Gabon','Gambia','Georgia','Ghana','Greece','Greenland','Guatemala','Guinea','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Isle of Man','Israel','Italy','Ivory Coast','Jamaica','Jordan','Kazakstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Lithuania','Luxembourg','Macedonia','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Mauritania','Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar(Burma)','Namibia','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','NorthKorea','Norway','Oman','Pakistan','Panama','Paraguay','Peru','Philippines','Portugal','PuertoRico','Qatar','Romania','Russia','Rwanda','SanMarino','SaudiArabia','Senegal','Serbia','SierraLeone','Slovakia','Slovenia','Somalia','SouthAfrica','Spain','SriLanka','Sudan','Suriname','Swaziland','Sweden','Switzerland','Syria','Tajikstan','Tanzania','Thailand','Togo','Tonga','TrinidadandTobago','Tunisia','Turkey','Turkmenistan','U.S.Virgin Islands','Uganda','Ukraine','Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe','Andorra','Reunion','Poland','Guam','Vatican','Liechtensteins','Curacao','Seychelles','Antarctica','Gibraltar','Cuba','Faroe Islands','Ahvenanmaa','Bermuda','Timor-Leste'];

// ==========================================================================
// 2. 定义用于保留或过滤的正则表达式
// ==========================================================================

// specialRegex 用于 blpx 排序
const specialRegex = [
  /(\d\.)?\d+×/,
  /IPLC|IEPL|Kern|Edge|Pro|Std|Exp|Biz|Fam|Game|Buy|Zx|LB|Game/,
];

// nameclear：用于 clear 参数，清理乱名
const nameclear =
  /(套餐|到期|有效|剩余|版本|已用|过期|失联|测试|官方|网址|备用|群|TEST|客服|网站|获取|订阅|流量|机场|下次|官址|联系|邮箱|工单|学术|USE|USED|TOTAL|EXPIRE|EMAIL|官网|回国)/i;

// regexArray 和 valueArray 用于 blgd
// prettier-ignore
const regexArray=[/ˣ²/, /ˣ³/, /ˣ⁴/, /ˣ⁵/, /ˣ⁶/, /ˣ⁷/, /ˣ⁸/, /ˣ⁹/, /ˣ¹⁰/, /ˣ²⁰/, /ˣ³⁰/, /ˣ⁴⁰/, /ˣ⁵⁰/, /IPLC/i, /IEPL/i, /核心/, /边缘/, /高级/, /标准/, /实验/, /商宽/, /家宽/, /游戏|game/i, /购物/, /专线/, /LB/, /cloudflare/i, /\budp\b/i, /\bgpt\b/i,/udpn\b/];
// prettier-ignore
const valueArray= [ "2×","3×","4×","5×","6×","7×","8×","9×","10×","20×","30×","40×","50×","IPLC","IEPL","Kern","Edge","Pro","Std","Exp","Biz","Fam","Game","Buy","Zx","LB","CF","UDP","GPT","UDPN"];

const nameblnx = /(高倍|(?!1)2+(x|倍)|ˣ²|ˣ³|ˣ⁴|ˣ⁵|ˣ¹⁰)/i;
const namenx = /(高倍|(?!1)(0\.|\d)+(x|倍)|ˣ²|ˣ³|ˣ⁴|ˣ⁵|ˣ¹⁰)/i;
const keya =
  /港|Hong|HK|新加坡|SG|Singapore|日本|Japan|JP|美国|United States|US|韩|土耳其|TR|Turkey|Korea|KR|🇸🇬|🇭🇰|🇯🇵|🇺🇸|🇰🇷|🇹🇷/i;
const keyb =
  /(((1|2|3|4)\d)|(香港|Hong|HK) 0[5-9]|((新加坡|SG|Singapore|日本|Japan|JP|美国|United States|US|韩|土耳其|TR|Turkey|Korea|KR) 0[3-9]))/i;

// 预替换映射表（扩充版）
const rurekey = {
  // ----- 美洲 -----
  "美国": /美西|美东|洛杉矶|圣何塞|硅谷|俄勒冈|西雅图|达拉斯|亚特兰大|迈阿密|纽约|芝加哥|凤凰城|丹佛|拉斯维加斯|休斯顿|华盛顿|旧金山|USA|America|United States|波特兰|哥伦布/gi,
  "加拿大": /温哥华|多伦多|蒙特利尔|卡尔加里|渥太华|CA|Canada/gi,
  "墨西哥": /墨西哥城|MX|Mexico/gi,
  "巴西": /圣保罗|里约热内卢|巴西利亚|BR|Brazil/gi,
  "阿根廷": /布宜诺斯艾利斯|AR|Argentina/gi,
  "智利": /圣地亚哥|CL|Chile/gi,
  "哥伦比亚": /波哥大|CO|Colombia/gi,
  "秘鲁": /利马|PE|Peru/gi,
  "委内瑞拉": /加拉加斯|VE|Venezuela/gi,
  // ----- 欧洲 -----
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
  // ----- 亚洲 -----
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
  // ----- 大洋洲 -----
  "澳大利亚": /悉尼|墨尔本|布里斯班|珀斯|阿德莱德|AU|Australia/gi,
  "新西兰": /奥克兰|惠灵顿|NZ|New Zealand/gi,
  // ----- 非洲 -----
  "南非": /约翰内斯堡|开普敦|比勒陀利亚|ZA|South Africa/gi,
  "埃及": /开罗|亚历山大|EG|Egypt/gi,
  "尼日利亚": /拉各斯|阿布贾|NG|Nigeria/gi,
  "肯尼亚": /内罗毕|蒙巴萨|KE|Kenya/gi,
  "摩洛哥": /卡萨布兰卡|拉巴特|MA|Morocco/gi,
  // ----- 其他原有（保留兼容） -----
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

/**
 * 根据参数获取对应的地区列表
 */
// prettier-ignore
function getList(arg) {
  switch (arg) {
    case 'us': return EN;
    case 'gq': return FG;
    case 'quan': return QC;
    default: return ZH;
  }
}

/**
 * 对节点进行分组编号
 */
// prettier-ignore
function jxh(e) {
  const n = e.reduce((e, n) => {
    const t = e.find((e) => e.name === n.name);
    if (t) {
      t.count++;
      t.items.push({ ...n, name: `${n.name}${XHFGF}${t.count.toString().padStart(2, "0")}` });
    } else {
      e.push({ name: n.name, count: 1, items: [{ ...n, name: `${n.name}${XHFGF}01` }] });
    }
    return e;
  }, []);
  const t = (typeof Array.prototype.flatMap === 'function'
    ? n.flatMap((e) => e.items)
    : n.reduce((acc, e) => acc.concat(e.items), [])
  );
  e.splice(0, e.length, ...t);
  return e;
}

/**
 * 移除单节点序号
 */
// prettier-ignore
function oneP(e) {
  const t = e.reduce((e, t) => {
    const n = t.name.replace(/[^A-Za-z0-9\u00C0-\u017F\u4E00-\u9FFF]+\d+$/, "");
    if (!e[n]) { e[n] = []; }
    e[n].push(t);
    return e;
  }, {});
  for (const e in t) {
    if (t[e].length === 1 && t[e][0].name.endsWith("01")) {
      t[e][0].name = t[e][0].name.replace(/[^.]01/, "");
    }
  }
  return e;
}

/**
 * 对保留标识排序
 */
// prettier-ignore
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

// 缓存映射表
let GetK = false, AMK = [];
function ObjKA(i) {
  GetK = true;
  AMK = Object.entries(i);
}

// ==========================================================================
// 4. 主函数 operator
// ==========================================================================
function operator(pro) {
  // ---------- 新增：排除中国大陆节点（pcgn 参数） ----------
  if (pcgn) {
    // 匹配中国大陆主要城市名、国家名关键词，不包含港澳台
    const chinaRegex = /(?:^|\s)(北京|上海|广州|深圳|杭州|成都|武汉|南京|重庆|天津|苏州|郑州|长沙|西安|东莞|青岛|沈阳|宁波|昆明|大连|厦门|合肥|佛山|福州|哈尔滨|济南|长春|温州|石家庄|贵阳|常州|徐州|嘉兴|金华|南宁|泉州|呼和浩特|太原|乌鲁木齐|兰州|银川|海口|拉萨|西宁|南昌|郑州|中国|国内|CN|China)(?=\s|$)/i;
    pro = pro.filter(p => !chinaRegex.test(p.name));
  }

  // ---------- 构建地区映射表 ----------
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

  // ---------- 执行过滤（clear, nx, blnx, key） ----------
  if (clear || nx || blnx || key) {
    pro = pro.filter((res) => {
      const resname = res.name;
      const shouldKeep =
        !(clear && nameclear.test(resname)) &&
        !(nx && namenx.test(resname)) &&
        !(blnx && !nameblnx.test(resname)) &&
        !(key && !(keya.test(resname) && /2|4|6|7/i.test(resname)));
      return shouldKeep;
    });
  }

  const BLKEYS = BLKEY ? BLKEY.split("+") : "";

  pro.forEach((e) => {
    let bktf = false, ens = e.name;

    // 预替换
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

    // block-quic
    if (blockquic == "on") {
      e["block-quic"] = "on";
    } else if (blockquic == "off") {
      e["block-quic"] = "off";
    } else {
      delete e["block-quic"];
    }

    // blkey 未在预替换中处理
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

    // blgd
    let ikey = "", ikeys = "";
    if (blgd) {
      regexArray.forEach((regex, index) => {
        if (regex.test(e.name)) {
          ikeys = valueArray[index];
        }
      });
    }

    // 倍率处理
    const extractRate = bl || blbz;
    if (extractRate) {
      const match = e.name.match(
        /((倍率|X|x|×)\D?((\d{1,3}\.)?\d+)\D?)|((\d{1,3}\.)?\d+)(倍|X|x|×)/
      );
      if (match) {
        const rev = match[0].match(/(\d[\d.]*)/)[0];
        if (rev !== "1") {
          const newValue = blbz ? rev + "倍率" : rev + "×";
          ikey = newValue;
        }
      }
    }

    // 地区匹配
    !GetK && ObjKA(Allmap);
    const findKey = AMK.find(([key]) => e.name.includes(key));

    let firstName = "", nNames = "";
    if (nf) {
      firstName = FNAME;
    } else {
      nNames = FNAME;
    }

    if (findKey?.[1]) {
      const findKeyValue = findKey[1];
      let keyover = [], usflag = "";
      if (addflag) {
        const index = outList.indexOf(findKeyValue);
        if (index !== -1) {
          usflag = FG[index];
          usflag = usflag === "🇹🇼" ? "🇨🇳" : usflag;
        }
      }
      keyover = keyover
        .concat(firstName, usflag, nNames, findKeyValue, retainKey, ikey, ikeys)
        .filter((k) => k !== "");
      e.name = keyover.join(FGF);
    } else {
      if (nm) {
        e.name = FNAME + FGF + e.name;
      } else {
        e.name = null;
      }
    }
  });

  pro = pro.filter((e) => e.name !== null);
  jxh(pro);
  numone && oneP(pro);
  blpx && (pro = fampx(pro));
  key && (pro = pro.filter((e) => !keyb.test(e.name)));

  return pro;
}