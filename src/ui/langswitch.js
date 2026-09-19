// 语言切换的**执行入口**。
//
// 单独一个文件是为了避开循环 import：screens.js / overlays.js 要用它，
// 而 ui.js 又要 import screens.js —— 如果这个函数放在 ui.js 里就成环了。
// 这里只依赖 i18n 机制和 window.__oasisUI（运行期才用到），谁都能安全地 import。

import { setLang } from '../core/i18n.js';
import { refreshI18nTables } from '../core/i18n-tables.js';

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

  const ui = window.__oasisUI;
  const game = ui?.game;
  if (!ui || !game) return true;

  if (game.phase === 'battle' && ui.battleScreen) {
    try { ui.battleScreen.refreshAll(); } catch { /* 刷新失败不该影响战斗 */ }
    return true;
  }
  ui.forceRerender();
  return true;
}
