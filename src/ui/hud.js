// 顶部状态栏（HUD）+ 悬停说明条

import { el, clear } from './dom.js';
import { createPortrait } from '../core/portraits.js';
import { apFromAgi, drawFromAgi, playsFromAgi, critChance, dodgeChance, BALANCE } from '../data/balance.js';

/**
 * 记录已经挂好的头像节点，避免每次刷新 HUD 都重建 <img>。
 * 注意：这里以前只用一个「画过没有」的布尔标志，结果 newRun() 重建 HUD 之后，
 * 那张头像 DOM 就变成游离节点、再也挂不回去，HUD 上只剩一个空框。
 * 现在每次刷新都会检查「当前容器里到底有没有这张图」，没有就补上。
 */
let portraitState = { slug: null, node: null };

export function renderHud(game) {
  const hud = document.getElementById('hud');
  const d = game.data;
  if (!d) { hud.classList.add('hidden'); return; }
  hud.classList.remove('hidden');

  const nameEl = document.getElementById('hud-name');
  const speciesEl = document.getElementById('hud-species');
  const hpFill = document.getElementById('hud-hp-fill');
  const hpText = document.getElementById('hud-hp-text');
  const stats = document.getElementById('hud-stats');
  const goldEl = document.getElementById('hud-gold');
  if (!nameEl || !hpFill || !stats) return; // 界面结构变了就安静退出，别把整个游戏搞崩

  nameEl.textContent = d.name;
  speciesEl.textContent = `${d.speciesName} · 地面/龙 · 特性：飘浮`;

  const pct = Math.max(0, (d.hp / d.maxHp) * 100);
  hpFill.style.width = `${pct}%`;
  hpFill.className = `hp-fill${pct <= 25 ? ' crit' : pct <= 55 ? ' warn' : ''}`;
  hpText.textContent = `${d.hp} / ${d.maxHp}`;

  clear(stats);
  // 四项属性的图标各自对应语义：剑=攻击、盾=防御、鞋=敏捷（拳是「物理攻击」不是速度）、三叶草=幸运
  // 说明必须走 data-tip（全站那套浮层），不能用 title：
  // title 是浏览器原生提示，要悬停一两秒才出来、样式也不受控，
  // 等于「敏捷影响什么」这件事在界面上根本看不见（用户反馈过）。
  stats.append(
    chip('ico-sword', '攻', d.atk, `基础攻击 ${d.atk}：决定你打出多少伤害。\n伤害 = 攻击 × 招式威力% × ${BALANCE.armorK} ÷ (${BALANCE.armorK} + 对手防御)。\n卡面上的伤害数字就是按这个攻击力实时算的。`),
    chip('ico-shield', '防', d.def, `防御 ${d.def}：受到伤害乘以 ${BALANCE.armorK}/(${BALANCE.armorK}+${d.def})。`),
    chip('ico-shoe', '敏', d.agi,
      `敏捷 ${d.agi}：**一回合的三项预算全看它**。\n`
      + `· 行动点 AP = 2 + 敏捷÷2（上限 8）→ 你现在 **${apFromAgi(d.agi)} 点**\n`
      + `· 每回合抽牌 = 3 + 敏捷÷5（上限 8）→ 你现在 **${drawFromAgi(d.agi)} 张**\n`
      + `· 出牌上限 = 3 + 敏捷÷2（上限 9）→ 你现在 **${playsFromAgi(d.agi)} 张**\n`
      + '战斗中这三项就写在底部：AP 圆点、以及「出牌 x/y」「抽牌 n」。'),
    chip('ico-clover', '运', d.luck, `幸运 ${d.luck}：暴击 ${critChance(d.luck).toFixed(1)}%，闪避 ${dodgeChance(d.luck).toFixed(1)}%`),
  );

  goldEl.textContent = String(d.gold);

  updatePortrait(d);
}

/**
 * 属性胶囊。说明文本走 `data-tip`（src/ui/tips.js 的全站浮层），支持 **加粗**。
 * 以前这里传的是原生 title，既不跟游戏主题一致，也没人会悬停两秒去等它弹出来。
 */
function chip(ico, label, value, tip) {
  return el('span', { class: 'stat-chip', dataset: { tip } }, [
    el('span', { class: ico, style: { width: '13px', height: '13px' } }),
    el('span', { text: label }),
    el('b', { text: String(value) }),
  ]);
}

/**
 * 保证 HUD 上那张头像真的挂在 DOM 里。
 * 每次 renderHud 都会调用 —— 只要发现「当前节点不在（新的）容器里」就重新挂一张，
 * 这样 newRun() / 切界面重建 HUD 之后也能补回来，不会再出现空框。
 */
function updatePortrait(d) {
  const box = document.getElementById('hud-portrait');
  if (!box) return;
  const alive = portraitState.node && box.contains(portraitState.node) && portraitState.slug === d.slug;
  if (alive) return;

  portraitState = { slug: d.slug, node: null };
  createPortrait(d.slug, { emotion: 'normal', size: 40, alt: d.speciesName }).then((img) => {
    const target = document.getElementById('hud-portrait');
    if (!target || portraitState.slug !== d.slug) return;
    clear(target);
    if (img) {
      portraitState.node = img;
      target.append(img);
    }
  });
}

export function hideHud() {
  document.getElementById('hud').classList.add('hidden');
}
