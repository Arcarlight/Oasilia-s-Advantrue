// 回归测试：「0 费抽 1 张」类卡牌 + 小卡组不能无限轮换刷死对手。
//
// 起因（用户反馈）：卡组里只放「子弹拳 + 电光一闪」时，两张牌能一直来回抽、来回打，
// 每回合都把出牌上限打满，直接把对手揍死 —— 玩家管这个叫「无限循环」。
//
// 规则修法：**打出去的牌这一回合不会再被抽回来**（躺在牌堆底部、下回合自动归位）。
// 这份测试盯四件事：
//   ① 最小卡组（2 张 0 费抽牌）一回合最多各打一次，打不出第 5、第 8 张；
//   ② 同一张牌在同一回合不能被打第二次（哪怕卡组里有两份）；
//   ③ 正常大小的卡组不受影响：该抽到的一张不少，下回合能抽回上回合打过的牌；
//   ④ 「急速折返」这种回 AP 的牌也刷不起来。
//
// 用法：node tools/test-combo.mjs（秒级）
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.get(k) ?? null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

const { Game } = await imp('src/core/game.js');
const { CARD_BY_ID } = await imp('src/data/cards.js');

let pass = 0;
let fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass += 1; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`); }
  else { fail += 1; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); }
};

/** 开一场战斗：deck 指定卡组，battleDeck 也照抄（不然默认推荐会换掉它） */
function startBattleWith(deck, seed = 4321) {
  const game = new Game({ seed });
  game.newRun();
  game.data.deck = deck.slice();
  game.data.battleDeck = deck.slice();
  game.startBattle('normal', 0);
  return game.battle;
}

/** 把这一回合能打的牌全打掉，返回打出的牌名列表 */
function playOutTurn(b, cap = 40) {
  const names = [];
  for (;;) {
    if (names.length >= cap) break;
    const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
    if (!hand.length) break;
    const res = b.playCard(hand[0].uid);
    if (!res.ok) break;
    names.push(res.card);
    b.takeEvents();
  }
  return names;
}

const nameOf = (id) => CARD_BY_ID[id]?.name ?? id;

// ---------- ① 最小卡组：两张 0 费抽牌 ----------
console.log('\n① 卡组只有「子弹拳 + 电光一闪」（各 1 张，2 张卡组）');
{
  const b = startBattleWith(['bullet_punch', 'quick_attack']);
  const played = playOutTurn(b);
  const dmg = b.enemy.maxHp - Math.max(0, b.enemy.hp);
  // 一张牌的实伤 =（攻击 + 威力）× 60/(60+防御)，跟卡面写的展示值不是一回事 ——
  // 所以这里不写死数字，而是拿引擎自己的估算当基准比（留 1.7 倍余量给暴击）。
  const per = ['bullet_punch', 'quick_attack']
    .reduce((s, id) => s + b.cardDamage('player', CARD_BY_ID[id]), 0);
  ok(played.length === 2, '一回合只能各打一次（不再刷满出牌上限）',
    `打出 ${played.length} 张：${played.map(nameOf).join(' → ')}（出牌上限 ${b.player.playMax}）`);
  ok(played.filter((id) => id === 'bullet_punch').length <= 1, '子弹拳这一回合只打了一次');
  ok(dmg <= per * 1.7, '一回合伤害只是「两张牌」的量级（不是把出牌上限打满的 4 倍）',
    `打掉 ${Math.round(dmg)} HP；两张牌各一次约 ${per}，打满 8 张的话约 ${Math.round(per * 4)}`);
}

// ---------- ② 同一张牌两份也不能轮换 ----------
console.log('\n② 卡组是「子弹拳 ×2」（同一张牌有两份）');
{
  const b = startBattleWith(['bullet_punch', 'bullet_punch']);
  const played = playOutTurn(b);
  ok(played.length === 2, '两份各打一次就到头', `打出 ${played.length} 张：${played.map(nameOf).join(' → ')}`);
}

// ---------- ③ 正常卡组不受影响 ----------
console.log('\n③ 正常卡组（10 张，初始卡组那种）');
{
  const deck = ['tackle', 'tackle', 'tackle', 'tackle', 'sand_attack', 'harden', 'double_kick', 'bite', 'bite', 'bite'];
  const b = startBattleWith(deck);
  const before = b.decks.player.hand.length;
  ok(before >= 4, '开局照常抽到 4 张以上手牌', `手牌 ${before} 张，卡组剩 ${b.decks.player.draw.length} 张`);
  const played = playOutTurn(b);
  ok(played.length >= 3, '一回合该能打出的牌没有变少', `打出 ${played.length} 张：${played.map(nameOf).join(' → ')}`);
  // 打完这一回合，下回合必须能把上回合打过的牌抽回来
  const playedIds = new Set(played);
  b.endTurn();
  b.takeEvents();
  b.endTurn();   // 敌人回合结束 → 回到玩家回合（会重新抽牌）
  b.takeEvents();
  const handIds = b.hand('player').map((c) => c.card.id);
  ok(handIds.some((id) => playedIds.has(id)), '下回合能重新抽到上回合打过的牌（只是当回合抽不回来）',
    `手牌：${handIds.map(nameOf).join('、')}`);
  ok(handIds.length >= 4, '下回合手牌数量正常', `${handIds.length} 张`);
}

// ---------- ④ 回 AP 的牌也刷不起来 ----------
console.log('\n④ 卡组里加「急速折返」（0 费抽 2 张、回 1 AP）');
{
  const b = startBattleWith(['bullet_punch', 'quick_attack', 'u_turn']);
  const played = playOutTurn(b);
  ok(played.length <= 3, '三张牌最多各打一次，AP 不会被刷回去', `打出 ${played.length} 张：${played.map(nameOf).join(' → ')}`);
  ok(b.player.ap <= b.player.apMax, 'AP 没有超过上限', `AP ${b.player.ap}/${b.player.apMax}`);
}

// ---------- ⑤ 敌人的 0 费抽牌同样受限制 ----------
console.log('\n⑤ 敌人手上全是「急速折返」时也只打一次');
{
  const b = startBattleWith(['tackle', 'tackle']);
  const proto = b.decks.enemy.draw[0];
  b.decks.enemy.draw = ['u_turn', 'u_turn', 'u_turn'].map((id, i) => ({ ...proto, uid: `e${i}`, card: CARD_BY_ID[id] }));
  b.decks.enemy.discard = [];
  b.decks.enemy.hand = [];
  b.endTurn();
  b.takeEvents();
  const enemyPlays = (b.enemy.playMax ?? 0) - (b.enemy.playsLeft ?? 0);
  ok(enemyPlays <= 3, '敌人这回合出牌数有限（没有靠抽牌刷回合）', `敌人出牌 ${enemyPlays} 张（上限 ${b.enemy.playMax}）`);
  ok(b.turn >= 2, '回合正常推进', `现在是第 ${b.turn} 回合`);
}

// ---------------- ⑥ 卡组厚薄只能靠「拿卡 / 花钱删卡」 ----------------
console.log('\n⑥ 出战卡组 = 全部所持卡牌（不能挑着不带）');
{
  const b = startBattleWith(['tackle', 'tackle', 'bite', 'harden', 'sand_attack']);
  const inDeck = b.decks.player.draw.length + b.decks.player.discard.length + b.decks.player.hand.length;
  ok(inDeck === 5, '五张牌全部进了战斗牌堆（没有「没带的牌」）', `牌堆+弃牌+手牌 = ${inDeck}`);
}
{
  // 旧存档里可能留着一份 battleDeck 子集：现在必须被忽略
  const game = new Game({ seed: 99 });
  game.newRun();
  game.data.deck = ['tackle', 'tackle', 'bite', 'harden'];
  game.data.battleDeck = ['tackle'];            // 模拟旧存档里的「只带一张」
  game.startBattle('normal', 0);
  const total = game.battle.decks.player.draw.length + game.battle.decks.player.discard.length + game.battle.decks.player.hand.length;
  ok(total === 4, '旧存档里的出战子集被忽略，照样按全部卡牌开打', `实际进战斗 ${total} 张`);
}

// ---------------- ⑦ 商店花钱删卡：能连着删、越删越贵、取消退钱 ----------------
console.log('\n⑦ 商店「卡牌移除服务」是唯一的精简手段');
{
  const game = new Game({ seed: 555 });
  game.newRun();
  game.data.deck = ['tackle', 'tackle', 'tackle', 'bite', 'bite', 'harden'];
  game.data.gold = 1000;
  game.data.stage = 0;
  game.startShop('xiaoji_messenger');   // 小箭雀信使：删卡服务 45 金（最便宜的一家）
  const idx = game.shop.stock.findIndex((s) => s.kind === 'service');
  ok(idx >= 0, '这家商店有删卡服务', `货架第 ${idx + 1} 项：${game.shop.stock[idx]?.name}`);
  const price1 = game.shop.stock[idx].price;
  const gold0 = game.data.gold;
  const buy1 = game.buy(idx);
  ok(buy1.needRemove === true, '买下后要求选一张要删的卡', buy1.text);
  ok(game.data.gold === gold0 - price1, '先扣钱', `${gold0} → ${game.data.gold}（-${price1}）`);
  // 取消（关闭弹窗）→ 退钱
  const refund = game.refundRemove();
  ok(refund.ok && game.data.gold === gold0, '取消删卡会把钱退回来', `${refund.text}，金币回到 ${game.data.gold}`);
  // 真删两张：服务不售罄，且第二张更贵
  game.buy(idx);
  const r1 = game.doRemove('tackle');
  const price2 = game.shop.stock[idx].price;
  ok(r1.ok, '删掉一张', `${r1.text}（卡组剩 ${game.data.deck.length} 张）`);
  ok(price2 > price1, '同一家店里第二张更贵', `${price1} → ${price2}`);
  const before = game.data.deck.length;
  game.buy(idx);
  const r2 = game.doRemove('bite');
  ok(r2.ok && game.data.deck.length === before - 1, '还能接着删（服务不售罄）', `${r2.text}；报价变成 ${game.shop.stock[idx].price}`);
  ok(!game.shop.soldOut.includes(idx), '删卡服务没有被标记成「已售出」');
}

console.log(`\n连招与卡组循环的回归测试：通过 ${pass}，失败 ${fail}`);
if (fail) process.exitCode = 1;
