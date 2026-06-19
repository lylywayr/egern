/**
 * ============================================================================
 * 脚本名称：Sub-Store 节点重命名脚本 (rename.js)
 * 功能说明：对代理节点进行智能重命名、地区识别、关键词保留、过滤和排序。
 * 适用平台：Sub-Store (https://sub-store.app/)
 * 更新日期：2026-06-19
 * 版本：2.0
 * 作者：Keywos (根据开源脚本优化)
 *
 * ============================================================================
 * 使用方法：
 * 1. 将本脚本作为 Sub-Store 的“脚本操作”使用。
 * 2. 可以通过 URL 参数传递配置（推荐），格式如下：
 *    https://your-github-raw-url/rename.js#参数1&参数2=值&参数3...
 *    或者，在 Sub-Store 脚本配置的“参数”框中传递 JSON 对象（如 {"name":"我的机场"}）。
 *
 * ============================================================================
 * 支持的参数列表（完整说明）：
 *
 * --- 地区识别与输出格式 ---
 * [in=zh|en|quan|flag]     指定从节点名中识别地区的方式。
 *                           zh/cn：中文，en/us：英文缩写，quan：英文全称，flag/gq：国旗。
 *                           默认自动判断。
 * [out=zh|en|quan|flag]    指定输出地区名称的格式，默认与 in 相同，若 in 未指定则默认 zh。
 * [fgf=分隔符]             前缀/国旗与后续部分之间的分隔符，默认为空格（需 URL 编码）。
 * [sn=分隔符]              地区名与序号之间的分隔符，默认为空格。
 *
 * --- 前缀与排序 ---
 * [name=机场名称]          添加机场名称前缀。
 * [nf]                     若存在，将前缀放在节点名最前面（默认放在地区名之后）。
 * [one]                    移除只有一个节点时的 "01" 序号。
 *
 * --- 关键词保留与替换 ---
 * [blkey=关键词1+关键词2>新名]  保留指定的自定义关键词，多个用 + 连接。
 *                                可用 > 将旧关键词替换为新名称（例如 IPLC>专线）。
 * [blgd]                   保留预定义的固定格式标识（如 IPLC、IEPL、核心、边缘等）。
 * [bl]                     保留节点名中的倍率标识（如 x2、3×）。
 * [blnx]                   只保留高倍率（>1x）节点，删除 1x 或无倍率节点。
 * [nx]                     保留 1 倍率与不显示倍率的节点（与 bl 配合使用）。
 * [blpx]                   对保留的倍率标识进行分组排序（特殊标识优先）。
 *
 * --- 过滤与清理 ---
 * [clear]                  清理包含乱名关键词（如“套餐”、“到期”等）的节点。
 * [key]                    启用额外过滤规则（基于内部正则）。
 * [nm]                     保留未匹配到任何地区的节点（原样输出，仅添加前缀）。
 *
 * --- 其他功能 ---
 * [flag]                   在节点名中添加国旗图标（根据地区自动匹配）。
 * [blockquic=on|off]       控制是否添加 block-quic 参数。
 * [debug]                  调试模式（输出处理日志，需脚本支持）。
 *
 * ============================================================================
 */

// 从 Sub-Store 传入的参数对象（支持 URL 参数或直接 JSON）
const inArg = $arguments; // Sub-Store 会将 URL 参数解析为对象

// ========== 1. 解析基本参数 ==========
const nx = inArg.nx || false;                     // 保留 1x 或 无倍率
const bl = inArg.bl || false;                     // 保留倍率标识
const nf = inArg.nf || false;                     // 前缀放在最前面
const key = inArg.key || false;                   // 启用额外过滤
const blgd = inArg.blgd || false;                 // 保留固定格式标识
const blpx = inArg.blpx || false;                 // 对保留标识分组排序
const blnx = inArg.blnx || false;                 // 只保留高倍率
const numone = inArg.one || false;                // 移除单节点序号
const debug = inArg.debug || false;               // 调试模式
const clear = inArg.clear || false;               // 清理乱名
const addflag = inArg.flag || false;              // 添加国旗
const nm = inArg.nm || false;                     // 保留未匹配地区节点

// 分隔符参数（需解码，默认为空格）
const FGF = inArg.fgf == undefined ? " " : decodeURI(inArg.fgf);     // 前缀/国旗分隔符
const XHFGF = inArg.sn == undefined ? " " : decodeURI(inArg.sn);    // 地区与序号分隔符
const FNAME = inArg.name == undefined ? "" : decodeURI(inArg.name); // 机场前缀
const BLKEY = inArg.blkey == undefined ? "" : decodeURI(inArg.blkey); // 保留的关键词列表
const blockquic = inArg.blockquic == undefined ? "" : decodeURI(inArg.blockquic); // block-quic 设置

// 名称格式映射
const nameMap = {
  cn: "cn",
  zh: "cn",
  us: "us",
  en: "us",
  quan: "quan",
  gq: "gq",
  flag: "gq",
};
const inname = nameMap[inArg.in] || "";       // 输入识别方式
const outputName = nameMap[inArg.out] || "";  // 输出格式

// ========== 2. 定义国家/地区映射数据 ==========
// 国旗列表（与中文、英文、英文全称一一对应，顺序必须一致）
// prettier-ignore
const FG = ['🇭🇰','🇲🇴','🇹🇼','🇯🇵','🇰🇷','🇸🇬','🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇦🇺','🇦🇪','🇦🇫','🇦🇱','🇩🇿','🇦🇴','🇦🇷','🇦🇲','🇦🇹','🇦🇿','🇧🇭','🇧🇩','🇧🇾','🇧🇪','🇧🇿','🇧🇯','🇧🇹','🇧🇴','🇧🇦','🇧🇼','🇧🇷','🇻🇬','🇧🇳','🇧🇬','🇧🇫','🇧🇮','🇰🇭','🇨🇲','🇨🇦','🇨🇻','🇰🇾','🇨🇫','🇹🇩','🇨🇱','🇨🇴','🇰🇲','🇨🇬','🇨🇩','🇨🇷','🇭🇷','🇨🇾','🇨🇿','🇩🇰','🇩🇯','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇬🇶','🇪🇷','🇪🇪','🇪🇹','🇫🇯','🇫🇮','🇬🇦','🇬🇲','🇬🇪','🇬🇭','🇬🇷','🇬🇱','🇬🇹','🇬🇳','🇬🇾','🇭🇹','🇭🇳','🇭🇺','🇮🇸','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪','🇮🇲','🇮🇱','🇮🇹','🇨🇮','🇯🇲','🇯🇴','🇰🇿','🇰🇪','🇰🇼','🇰🇬','🇱🇦','🇱🇻','🇱🇧','🇱🇸','🇱🇷','🇱🇾','🇱🇹','🇱🇺','🇲🇰','🇲🇬','🇲🇼','🇲🇾','🇲🇻','🇲🇱','🇲🇹','🇲🇷','🇲🇺','🇲🇽','🇲🇩','🇲🇨','🇲🇳','🇲🇪','🇲🇦','🇲🇿','🇲🇲','🇳🇦','🇳🇵','🇳🇱','🇳🇿','🇳🇮','🇳🇪','🇳🇬','🇰🇵','🇳🇴','🇴🇲','🇵🇰','🇵🇦','🇵🇾','🇵🇪','🇵🇭','🇵🇹','🇵🇷','🇶🇦','🇷🇴','🇷🇺','🇷🇼','🇸🇲','🇸🇦','🇸🇳','🇷🇸','🇸🇱','🇸🇰','🇸🇮','🇸🇴','🇿🇦','🇪🇸','🇱🇰','🇸🇩','🇸🇷','🇸🇿','🇸🇪','🇨🇭','🇸🇾','🇹🇯','🇹🇿','🇹🇭','🇹🇬','🇹🇴','🇹🇹','🇹🇳','🇹🇷','🇹🇲','🇻🇮','🇺🇬','🇺🇦','🇺🇾','🇺🇿','🇻🇪','🇻🇳','🇾🇪','🇿🇲','🇿🇼','🇦🇩','🇷🇪','🇵🇱','🇬🇺','🇻🇦','🇱🇮','🇨🇼','🇸🇨','🇦🇶','🇬🇮','🇨🇺','🇫🇴','🇦🇽','🇧🇲','🇹🇱'];

// 英文缩写列表（与 FG 顺序一致）
// prettier-ignore
const EN = ['HK','MO','TW','JP','KR','SG','US','GB','FR','DE','AU','AE','AF','AL','DZ','AO','AR','AM','AT','AZ','BH','BD','BY','BE','BZ','BJ','BT','BO','BA','BW','BR','VG','BN','BG','BF','BI','KH','CM','CA','CV','KY','CF','TD','CL','CO','KM','CG','CD','CR','HR','CY','CZ','DK','DJ','DO','EC','EG','SV','GQ','ER','EE','ET','FJ','FI','GA','GM','GE','GH','GR','GL','GT','GN','GY','HT','HN','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','CI','JM','JO','KZ','KE','KW','KG','LA','LV','LB','LS','LR','LY','LT','LU','MK','MG','MW','MY','MV','ML','MT','MR','MU','MX','MD','MC','MN','ME','MA','MZ','MM','NA','NP','NL','NZ','NI','NE','NG','KP','NO','OM','PK','PA','PY','PE','PH','PT','PR','QA','RO','RU','RW','SM','SA','SN','RS','SL','SK','SI','SO','ZA','ES','LK','SD','SR','SZ','SE','CH','SY','TJ','TZ','TH','TG','TO','TT','TN','TR','TM','VI','UG','UA','UY','UZ','VE','VN','YE','ZM','ZW','AD','RE','PL','GU','VA','LI','CW','SC','AQ','GI','CU','FO','AX','BM','TL'];

// 中文名称列表（与 FG 顺序一致）
// prettier-ignore
const ZH = ['香港','澳门','台湾','日本','韩国','新加坡','美国','英国','法国','德国','澳大利亚','阿联酋','阿富汗','阿尔巴尼亚','阿尔及利亚','安哥拉','阿根廷','亚美尼亚','奥地利','阿塞拜疆','巴林','孟加拉国','白俄罗斯','比利时','伯利兹','贝宁','不丹','玻利维亚','波斯尼亚和黑塞哥维那','博茨瓦纳','巴西','英属维京群岛','文莱','保加利亚','布基纳法索','布隆迪','柬埔寨','喀麦隆','加拿大','佛得角','开曼群岛','中非共和国','乍得','智利','哥伦比亚','科摩罗','刚果(布)','刚果(金)','哥斯达黎加','克罗地亚','塞浦路斯','捷克','丹麦','吉布提','多米尼加共和国','厄瓜多尔','埃及','萨尔瓦多','赤道几内亚','厄立特里亚','爱沙尼亚','埃塞俄比亚','斐济','芬兰','加蓬','冈比亚','格鲁吉亚','加纳','希腊','格陵兰','危地马拉','几内亚','圭亚那','海地','洪都拉斯','匈牙利','冰岛','印度','印尼','伊朗','伊拉克','爱尔兰','马恩岛','以色列','意大利','科特迪瓦','牙买加','约旦','哈萨克斯坦','肯尼亚','科威特','吉尔吉斯斯坦','老挝','拉脱维亚','黎巴嫩','莱索托','利比里亚','利比亚','立陶宛','卢森堡','马其顿','马达加斯加','马拉维','马来','马尔代夫','马里','马耳他','毛利塔尼亚','毛里求斯','墨西哥','摩尔多瓦','摩纳哥','蒙古','黑山共和国','摩洛哥','莫桑比克','缅甸','纳米比亚','尼泊尔','荷兰','新西兰','尼加拉瓜','尼日尔','尼日利亚','朝鲜','挪威','阿曼','巴基斯坦','巴拿马','巴拉圭','秘鲁','菲律宾','葡萄牙','波多黎各','卡塔尔','罗马尼亚','俄罗斯','卢旺达','圣马力诺','沙特阿拉伯','塞内加尔','塞尔维亚','塞拉利昂','斯洛伐克','斯洛文尼亚','索马里','南非','西班牙','斯里兰卡','苏丹','苏里南','斯威士兰','瑞典','瑞士','叙利亚','塔吉克斯坦','坦桑尼亚','泰国','多哥','汤加','特立尼达和多巴哥','突尼斯','土耳其','土库曼斯坦','美属维尔京群岛','乌干达','乌克兰','乌拉圭','乌兹别克斯坦','委内瑞拉','越南','也门','赞比亚','津巴布韦','安道尔','留尼汪','波兰','关岛','梵蒂冈','列支敦士登','库拉索','塞舌尔','南极','直布罗陀','古巴','法罗群岛','奥兰群岛','百慕达','东帝汶'];

// 英文全称列表（与 FG 顺序一致）
// prettier-ignore
const QC = ['Hong Kong','Macao','Taiwan','Japan','Korea','Singapore','United States','United Kingdom','France','Germany','Australia','Dubai','Afghanistan','Albania','Algeria','Angola','Argentina','Armenia','Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','British Virgin Islands','Brunei','Bulgaria','Burkina-faso','Burundi','Cambodia','Cameroon','Canada','CapeVerde','CaymanIslands','Central African Republic','Chad','Chile','Colombia','Comoros','Congo-Brazzaville','Congo-Kinshasa','CostaRica','Croatia','Cyprus','Czech Republic','Denmark','Djibouti','Dominican Republic','Ecuador','Egypt','EISalvador','Equatorial Guinea','Eritrea','Estonia','Ethiopia','Fiji','Finland','Gabon','Gambia','Georgia','Ghana','Greece','Greenland','Guatemala','Guinea','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Isle of Man','Israel','Italy','Ivory Coast','Jamaica','Jordan','Kazakstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Lithuania','Luxembourg','Macedonia','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Mauritania','Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar(Burma)','Namibia','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','NorthKorea','Norway','Oman','Pakistan','Panama','Paraguay','Peru','Philippines','Portugal','PuertoRico','Qatar','Romania','Russia','Rwanda','SanMarino','SaudiArabia','Senegal','Serbia','SierraLeone','Slovakia','Slovenia','Somalia','SouthAfrica','Spain','SriLanka','Sudan','Suriname','Swaziland','Sweden','Switzerland','Syria','Tajikstan','Tanzania','Thailand','Togo','Tonga','TrinidadandTobago','Tunisia','Turkey','Turkmenistan','U.S.Virgin Islands','Uganda','Ukraine','Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe','Andorra','Reunion','Poland','Guam','Vatican','Liechtensteins','Curacao','Seychelles','Antarctica','Gibraltar','Cuba','Faroe Islands','Ahvenanmaa','Bermuda','Timor-Leste'];

// ========== 3. 定义用于保留或过滤的正则表达式 ==========
// 用于 blgd 的预定义标识匹配（与 valueArray 一一对应）
const specialRegex = [
  /(\d\.)?\d+×/,
  /IPLC|IEPL|Kern|Edge|Pro|Std|Exp|Biz|Fam|Game|Buy|Zx|LB|Game/,
];

// 用于 clear 的乱名关键词（匹配则删除节点）
const nameclear =
  /(套餐|到期|有效|剩余|版本|已用|过期|失联|测试|官方|网址|备用|群|TEST|客服|网站|获取|订阅|流量|机场|下次|官址|联系|邮箱|工单|学术|USE|USED|TOTAL|EXPIRE|EMAIL)/i;

// 与 blgd 搭配的值列表（与 regexArray 顺序相同）
// prettier-ignore
const regexArray=[/ˣ²/, /ˣ³/, /ˣ⁴/, /ˣ⁵/, /ˣ⁶/, /ˣ⁷/, /ˣ⁸/, /ˣ⁹/, /ˣ¹⁰/, /ˣ²⁰/, /ˣ³⁰/, /ˣ⁴⁰/, /ˣ⁵⁰/, /IPLC/i, /IEPL/i, /核心/, /边缘/, /高级/, /标准/, /实验/, /商宽/, /家宽/, /游戏|game/i, /购物/, /专线/, /LB/, /cloudflare/i, /\budp\b/i, /\bgpt\b/i,/udpn\b/];
// prettier-ignore
const valueArray= [ "2×","3×","4×","5×","6×","7×","8×","9×","10×","20×","30×","40×","50×","IPLC","IEPL","Kern","Edge","Pro","Std","Exp","Biz","Fam","Game","Buy","Zx","LB","CF","UDP","GPT","UDPN"];

// 高倍率识别（用于 blnx）
const nameblnx = /(高倍|(?!1)2+(x|倍)|ˣ²|ˣ³|ˣ⁴|ˣ⁵|ˣ¹⁰)/i;
// 保留 1x 或 无倍率（用于 nx）
const namenx = /(高倍|(?!1)(0\.|\d)+(x|倍)|ˣ²|ˣ³|ˣ⁴|ˣ⁵|ˣ¹⁰)/i;

// 用于 key 参数的额外过滤规则
const keya =
  /港|Hong|HK|新加坡|SG|Singapore|日本|Japan|JP|美国|United States|US|韩|土耳其|TR|Turkey|Korea|KR|🇸🇬|🇭🇰|🇯🇵|🇺🇸|🇰🇷|🇹🇷/i;
const keyb =
  /(((1|2|3|4)\d)|(香港|Hong|HK) 0[5-9]|((新加坡|SG|Singapore|日本|Japan|JP|美国|United States|US|韩|土耳其|TR|Turkey|Korea|KR) 0[3-9]))/i;

// 预替换映射表：在地区匹配前对节点名进行规范化的替换（提高匹配准确率）
const rurekey = {
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

// ========== 4. 辅助函数 ==========

// 根据参数获取对应的列表（中文、英文、国旗、英文全称）
// prettier-ignore
function getList(arg) {
  switch (arg) {
    case 'us': return EN;
    case 'gq': return FG;
    case 'quan': return QC;
    default: return ZH;
  }
}

// 对节点进行分组编号（按照当前 name 分组，添加序号）
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

// 移除单节点时的 "01" 序号（配合 one 参数）
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
      // 移除末尾的 01（保留分隔符？原脚本仅移除 "01"）
      t[e][0].name = t[e][0].name.replace(/[^.]01/, "");
    }
  }
  return e;
}

// 对保留的标识进行分组排序（将含特殊标识的节点排前面）
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

// 以下变量用于缓存地区映射表（提高性能）
let GetK = false,
  AMK = [];

function ObjKA(i) {
  GetK = true;
  AMK = Object.entries(i);
}

// ========== 5. 主函数 operator ==========
function operator(pro) {
  // 构建地区映射表：将输入格式（由 in 参数决定）映射到输出格式（由 out 参数决定）
  // 如果 in 未指定，则尝试所有格式（ZH, FG, QC, EN）并按顺序匹配
  const Allmap = {};
  const outList = getList(outputName);
  let inputList,
    retainKey = "";
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

  // ---------- 5a. 根据过滤参数预处理节点（删除不符合条件的节点） ----------
  if (clear || nx || blnx || key) {
    pro = pro.filter((res) => {
      const resname = res.name;
      const shouldKeep =
        !(clear && nameclear.test(resname)) &&                // 清除乱名
        !(nx && namenx.test(resname)) &&                      // 不保留 1x 或无倍率？逻辑待确认（原脚本如此）
        !(blnx && !nameblnx.test(resname)) &&                 // 只保留高倍率
        !(key && !(keya.test(resname) && /2|4|6|7/i.test(resname))); // 额外过滤
      return shouldKeep;
    });
  }

  // ---------- 5b. 解析 blkey 参数（保留的关键词列表） ----------
  const BLKEYS = BLKEY ? BLKEY.split("+") : "";

  // ---------- 5c. 遍历每个节点进行重命名 ----------
  pro.forEach((e) => {
    let bktf = false,
      ens = e.name;

    // ---------- 5c1. 预替换（将常见别名统一） ----------
    Object.keys(rurekey).forEach((ikey) => {
      if (rurekey[ikey].test(e.name)) {
        e.name = e.name.replace(rurekey[ikey], ikey);
        // 若存在 blkey，则同时处理替换逻辑
        if (BLKEY) {
          bktf = true;
          let BLKEY_REPLACE = "",
            re = false;
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
            retainKey = re
              ? BLKEY_REPLACE
              : BLKEYS.filter((items) => e.name.includes(items));
          });
        }
      }
    });

    // ---------- 5c2. 处理 block-quic 参数 ----------
    if (blockquic == "on") {
      e["block-quic"] = "on";
    } else if (blockquic == "off") {
      e["block-quic"] = "off";
    } else {
      delete e["block-quic"];
    }

    // ---------- 5c3. 处理 blkey（如果未在预替换中处理） ----------
    if (!bktf && BLKEY) {
      let BLKEY_REPLACE = "",
        re = false;
      BLKEYS.forEach((i) => {
        if (i.includes(">") && e.name.includes(i.split(">")[0])) {
          if (i.split(">")[1]) {
            BLKEY_REPLACE = i.split(">")[1];
            re = true;
          }
        }
      });
      retainKey = re
        ? BLKEY_REPLACE
        : BLKEYS.filter((items) => e.name.includes(items));
    }

    // ---------- 5c4. 保留固定格式标识（blgd） ----------
    let ikey = "",
      ikeys = "";
    if (blgd) {
      regexArray.forEach((regex, index) => {
        if (regex.test(e.name)) {
          ikeys = valueArray[index];
        }
      });
    }

    // ---------- 5c5. 使用正则匹配并保留倍率（bl） ----------
    if (bl) {
      const match = e.name.match(
        /((倍率|X|x|×)\D?((\d{1,3}\.)?\d+)\D?)|((\d{1,3}\.)?\d+)(倍|X|x|×)/
      );
      if (match) {
        const rev = match[0].match(/(\d[\d.]*)/)[0];
        if (rev !== "1") {
          const newValue = rev + "×";
          ikey = newValue;
        }
      }
    }

    // ---------- 5c6. 地区匹配（使用 Allmap 映射表） ----------
    !GetK && ObjKA(Allmap);
    const findKey = AMK.find(([key]) => e.name.includes(key));

    let firstName = "",
      nNames = "";

    if (nf) {
      firstName = FNAME;
    } else {
      nNames = FNAME;
    }

    if (findKey?.[1]) {
      const findKeyValue = findKey[1];
      let keyover = [],
        usflag = "";
      if (addflag) {
        const index = outList.indexOf(findKeyValue);
        if (index !== -1) {
          usflag = FG[index];
          usflag = usflag === "🇹🇼" ? "🇨🇳" : usflag; // 台湾用中国国旗
        }
      }
      // 组装最终名称：前缀 + 国旗 + 地区名 + 保留关键词 + 倍率标识 + 固定格式标识
      keyover = keyover
        .concat(firstName, usflag, nNames, findKeyValue, retainKey, ikey, ikeys)
        .filter((k) => k !== "");
      e.name = keyover.join(FGF);
    } else {
      // ---------- 5c7. 未匹配到地区 ----------
      if (nm) {
        // 保留原名称，仅加前缀
        e.name = FNAME + FGF + e.name;
      } else {
        // 否则删除该节点（标记为 null）
        e.name = null;
      }
    }
  });

  // ---------- 5d. 移除被标记为 null 的节点 ----------
  pro = pro.filter((e) => e.name !== null);

  // ---------- 5e. 执行分组编号（添加序号） ----------
  jxh(pro);

  // ---------- 5f. 若 one 参数启用，移除单节点序号 ----------
  numone && oneP(pro);

  // ---------- 5g. 若 blpx 启用，对保留标识进行分组排序 ----------
  blpx && (pro = fampx(pro));

  // ---------- 5h. 若 key 参数启用，执行最终过滤 ----------
  key && (pro = pro.filter((e) => !keyb.test(e.name)));

  return pro;
}

// 导出函数（Sub-Store 会调用 operator）