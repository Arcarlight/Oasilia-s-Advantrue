// 语言切换的**执行入口**。
//
// 单独一个文件是为了避开循环 import：screens.js / overlays.js 要用它，
// 而 ui.js 又要 import screens.js —— 如果这个函数放在 ui.js 里就成环了。
// 这里只依赖 i18n 机制和 window.__oasisUI（运行期才用到），谁都能安全地 import。

import { setLang, t } from '../core/i18n.js';
import { refreshI18nTables } from '../core/i18n-tables.js';

/**
 * 把**标签页标题**换成当前语言的那一份。
 *
 * 起因（用户点出来的）：「网页标题到现在都没改」—— 前一个标题是早期占位，
 * 而且它是**写死在 index.html 里的**，切了日语 / 英语标签页还是中文。
 * 所以这里跟 `<html lang>` 一起改：静态那一份（index.html / 单文件包）给爬虫和
 * 「JS 还没跑起来的那一瞬间」看，跑起来之后按语言走。
 */
export function applyDocumentTitle() {
  const title = t('欧亚西莉亚的大冒险 ～ Desert Spirit.');
  if (document.title !== title) document.title = title;
}

/**
 * 换语言。三步的顺序很重要：
 *   ① setLang() 改状态并写进跨局记录；
 *   ② refreshI18nTables() 把数据里的可见字段（卡名、状态名、地图名…）原地刷成新语言 ——
 *      必须在重画之前做，否则界面上读到的还是旧语言；
 *   ③ 重画当前那一屏。这里**必须用 forceRerender()**（它会把 UI.current 清空再渲染）：
 *      ui.render() 对「同一屏」是有防重复渲染的（`current` 一样就直接 return），
 *      而语言变了不等于「换屏」—— 用 game.changed() 的话标题页那种自己不刷新的屏**不会重画**
 *      （诊断当场抓到了：点「日本語」之后状态变了、卡名变了，标题却还是中文）。
 *      战斗界面另说：它自己持有一份演出副本，整屏重画会打断演出，
 *      所以战斗中只刷新「读数据的那几块」（角色卡 / 手牌 / 牌堆），战斗继续演下去。
 *
 * @param {string} id 'zh' | 'ja' | 'en'
 * @returns {boolean} 是否真的换了
 */
export function changeLanguage(id) {
  if (!setLang(id)) return false;
  refreshI18nTables();
  document.documentElement.lang = id;
  applyDocumentTitle();

  const ui = window.__oasisUI;
  const game = ui?.game;
  if (!ui || !game) return true;

  // 本局的玩家名 / 物种名是开局时从 BALANCE.player 抄下来的副本，切语言时要重取一次，
  // 否则「中文开局、中途切日语」之后结算页会冒出一个中文名字。
  try { game.syncPlayerLang?.(); } catch { /* 名字刷新失败不该挡住切语言 */ }

  if (game.phase === 'battle' && ui.battleScreen) {
    try { ui.battleScreen.refreshAll(); } catch { /* 刷新失败不该影响战斗 */ }
    return true;
  }
  ui.forceRerender();
  return true;
}
