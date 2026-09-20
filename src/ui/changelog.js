// 更新日志（标题页的「更新日志」按钮打开）。
//
// 数据在 src/core/changelog-data.js（纯数据模块）—— 因为待翻清单只扫得到 `t('字面量')`，
// 而这一页的文案是列表里的裸字符串；数据放在纯数据模块里，由 i18n-tables.js 登记进清单。
//
// ⚠ 渲染时才过 `t()`，**不能**在模块顶层调 —— 顶层调用会把文案冻在加载那一刻的语言上，
//   切语言时这一页不会跟着变。

import { el, modal, richText } from './dom.js';
import { t } from '../core/i18n.js';
import { audio } from '../core/audio.js';
import { CHANGELOG } from '../core/changelog-data.js';

export { CHANGELOG };

/**
 * 打开更新日志。
 * 排版上**新的在最上面**：玩家点进来多半是想看「这次多了什么」。
 */
export function showChangelog() {
  const body = el('div', { class: 'changelog' });
  for (const entry of CHANGELOG) {
    body.append(el('div', { class: 'cl-entry' }, [
      el('div', { class: 'cl-head' }, [
        el('span', { class: 'cl-version', text: `v${entry.version}` }),
        el('span', { class: 'cl-date', text: entry.date }),
      ]),
      // `**重点**` 要变成粗体：文案是给玩家读的，星号不能原样露出来（richText 与悬停说明共用一份）
      el('ul', { class: 'cl-items' }, entry.items.map((line) => el('li', { html: richText(t(line)) }))),
    ]));
  }
  body.append(el('div', { class: 'help-card', style: { marginTop: '14px' } }, [
    el('h4', { text: t('更新日志怎么读') }),
    el('ul', {}, [
      el('li', { text: t('版本号越新排得越上面；每条都是玩家能直接看到的变化。') }),
      el('li', { text: t('带粗体的是这一版最值得看的几件事。') }),
    ]),
  ]));
  audio.ui('open');
  return modal({ title: t('更新日志'), wide: true, body });
}
