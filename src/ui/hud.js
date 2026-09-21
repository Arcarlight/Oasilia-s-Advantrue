// 顶部状态栏（HUD）+ 悬停说明条

import { el, clear } from './dom.js';
import { createPortrait } from '../core/portraits.js';
import { t } from '../core/i18n.js';
import { apFromAgi, drawFromAgi, playsFromAgi, critChance, dodgeChance, BALANCE } from '../data/balance.js';
import { heroById } from '../data/heroes.js';

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
  /**
   * 名字旁边的性别符号（index.html 里那个 `.gender`）以前是**写死的 ♀** ——
   * 换成阿特拉斯（♂）之后，HUD 上会写着「阿特拉斯 ♀」。
   * 它不在 JS 里重画（那个 span 是静态的），所以这里单独改一次。
   */
  const genderEl = document.getElementById('hud-gender');
  if (genderEl) genderEl.textContent = heroById(d.hero)?.gender ?? '';
  /**
   * 「物种 · 属性 · 特性」这一行**跟着主角走**（3.0 有两位主角）。
   * 以前这里是写死的一句 `t('{species} · 地面/龙 · 特性：飘浮')` ——
   * 换成暴飞龙（龙/飞行、威吓）之后那一行就会公然写错。
   */
  speciesEl.textContent = t('{species} · {types} · 特性：{ability}', {
    species: d.speciesName,
    types: (heroById(d.hero)?.types ?? []).join('/'),
    ability: heroById(d.hero)?.ability ?? '',
  });

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
    chip('ico-sword', t('攻'), d.atk, t('基础攻击 {atk}：决定你打出多少伤害。\n伤害 = 攻击 × 招式威力% × {K} ÷ ({K} + 对手防御)。\n卡面上的伤害数字就是按这个攻击力实时算的。', { atk: d.atk, K: BALANCE.armorK })),
    chip('ico-shield', t('防'), d.def, t('防御 {def}：受到伤害乘以 {K}/({K}+{def})。', { def: d.def, K: BALANCE.armorK })),
    chip('ico-shoe', t('敏'), d.agi,
      // 公式里的数字取 BALANCE，不抄第二份（以前写死过，改平衡时不会跟着动）
      t('敏捷 {agi}：**一回合的三项预算全看它**。\n', { agi: d.agi })
      + t('· 行动点 AP = {base} + 敏捷÷{per}（上限 {max}）→ 你现在 **{now} 点**\n', { base: BALANCE.apBase, per: BALANCE.apPerAgi, max: BALANCE.apMax, now: apFromAgi(d.agi) })
      + t('· 每回合抽牌 = {base} + 敏捷÷{per}（上限 {max}）→ 你现在 **{now} 张**\n', { base: BALANCE.drawBase, per: BALANCE.drawPerAgi, max: BALANCE.drawMax, now: drawFromAgi(d.agi) })
      + t('· 出牌上限 = {base} + 敏捷÷{per}（上限 {max}）→ 你现在 **{now} 张**\n', { base: BALANCE.playBase, per: BALANCE.playPerAgi, max: BALANCE.playMax, now: playsFromAgi(d.agi) })
      + t('战斗中这三项就写在底部：AP 圆点、以及「出牌 x/y」「抽牌 n」。')),
    chip('ico-clover', t('运'), d.luck, t('幸运 {luck}：暴击 {crit}%，闪避 {dodge}%', { luck: d.luck, crit: critChance(d.luck).toFixed(1), dodge: dodgeChance(d.luck).toFixed(1) })),
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
