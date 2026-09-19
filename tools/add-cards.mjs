// 一次性脚本：把「扩展卡池」这一批新卡追加进 content/cards.json。
//
// 用户需求：「大幅扩展卡池，增加玩家可选择的搭配，并强化稀有和特稀有的卡」。
// 这一批新卡的定位：
//   · 每条流派都有自己的**完整链条**（不再只是「一张牌管一个效果」）：
//       毒/剧毒（上毒 → 叠加 → 引爆）、出血（叠层 → 越打越疼）、
//       连击（多段 → 吃力量与出血加成）、坦克（护盾 → 护盾转伤害）、
//       力量爆发（本场威力 +N%）、抽牌循环（抽牌 + 出牌次数）
//   · 稀有 / 史诗改成「有条件的强」而不是「数值稍大的普通卡」：
//       威力看对手身上有几层毒/血、护盾转伤害、下回合不清空的护盾、引爆收尾
//
// 用法: node tools/add-cards.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'content', 'cards.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const WRITE = process.argv.includes('--write');

const N = (id, name, ap, rarity, targeting, ico, fx, text, effects, extra = {}) =>
  ({ id, name, ap, rarity, targeting, ico, fx, text, effects, ...extra });

const NEW = [
  // ---------------- 普通：给新玩家多几条起手路线 ----------------
  N('headbutt', '头锤', 1, 'common', 'enemy', 'ico-fist', 'dirt_1',
    '造成 {d} 点伤害，30% 概率使对手获得 1 层虚弱。',
    [{ kind: 'damage', power: 105 }, { kind: 'status', status: 'weak', stacks: 1, chance: 0.3 }]),
  N('flame_charge', '蓄能焰袭', 1, 'common', 'enemy', 'ico-flame', 'flare_1',
    '造成 {d} 点伤害。本场战斗敏捷 +2。',
    [{ kind: 'damage', power: 95 }, { kind: 'buff', stat: 'agi', amount: 2 }]),
  N('rock_polish', '岩石打磨', 1, 'common', 'self', 'ico-stone', 'spark_02',
    '本场战斗攻击 +2、敏捷 +2。抽 1 张。',
    [{ kind: 'buff', stat: 'atk', amount: 2 }, { kind: 'buff', stat: 'agi', amount: 2 }, { kind: 'draw', n: 1 }]),
  N('defense_curl', '变圆', 1, 'common', 'self', 'ico-shield', 'smoke_1',
    '获得护盾（随防御成长），本场战斗防御 +2。',
    [{ kind: 'shield', amount: 8, scaleWithDef: true }, { kind: 'buff', stat: 'def', amount: 2 }]),
  N('sand_tomb', '流沙地狱', 1, 'common', 'enemy', 'ico-earthquake', 'dirt_2',
    '造成 {d} 点伤害，并让对手敏捷 -3。',
    [{ kind: 'damage', power: 95 }, { kind: 'buff', stat: 'agi', amount: -3, target: 'enemy' }]),
  N('nuzzle', '蹭蹭脸颊', 1, 'common', 'enemy', 'ico-lightning', 'spark_03',
    '造成 {d} 点伤害，并让对手获得 1 层虚弱。',
    [{ kind: 'damage', power: 100 }, { kind: 'status', status: 'weak', stacks: 1 }]),
  N('poison_fang', '毒牙', 1, 'common', 'enemy', 'ico-poison', 'magic_1',
    '造成 {d} 点伤害，并给对手 1 层中毒。',
    [{ kind: 'damage', power: 95 }, { kind: 'status', status: 'poison', stacks: 1 }]),
  N('tail_whip', '摇尾巴', 1, 'common', 'enemy', 'ico-target', 'twirl_1',
    '让对手防御 -3，抽 1 张。',
    [{ kind: 'buff', stat: 'def', amount: -3, target: 'enemy' }, { kind: 'draw', n: 1 }]),

  // ---------------- 精良：流派零件 ----------------
  N('toxic_spikes', '毒菱', 1, 'uncommon', 'enemy', 'ico-poison', 'magic_2',
    '给对手 2 层剧毒。',
    [{ kind: 'status', status: 'toxic', stacks: 2 }]),
  N('toxic_thread', '毒丝', 1, 'uncommon', 'enemy', 'ico-bug', 'trace_02',
    '给对手 1 层剧毒和 1 层虚弱。',
    [{ kind: 'status', status: 'toxic', stacks: 1 }, { kind: 'status', status: 'weak', stacks: 1 }]),
  N('acid_armor', '酸液护甲', 1, 'uncommon', 'self', 'ico-shield_02', 'magic_1',
    '获得护盾（随防御成长），并给对手 1 层中毒。',
    [{ kind: 'shield', amount: 10, scaleWithDef: true }, { kind: 'status', status: 'poison', stacks: 1 }]),
  N('slash', '劈开', 1, 'uncommon', 'enemy', 'ico-sword', 'slash_1',
    '造成 {d} 点伤害，并给对手 2 层出血。',
    [{ kind: 'damage', power: 95 }, { kind: 'status', status: 'bleed', stacks: 2 }]),
  N('fury_swipes', '狂抓', 1, 'uncommon', 'enemy', 'ico-fist', 'slash_1',
    '连续 2 次造成 {d} 点伤害，并给对手 1 层出血。',
    [{ kind: 'damage', power: 50, hits: 2 }, { kind: 'status', status: 'bleed', stacks: 1 }]),
  N('bullet_seed', '种子机关枪', 2, 'uncommon', 'enemy', 'ico-leaves', 'trace_01',
    '连续 4 次造成 {d} 点伤害。',
    [{ kind: 'damage', power: 55, hits: 4 }]),
  N('scale_shot', '鳞射', 1, 'uncommon', 'enemy', 'ico-dagger', 'spark_04',
    '连续 3 次造成 {d} 点伤害。本场战斗防御 -3。',
    [{ kind: 'damage', power: 40, hits: 3 }, { kind: 'buff', stat: 'def', amount: -3 }]),
  N('howl', '长嚎', 1, 'uncommon', 'self', 'ico-wolf', 'twirl_2',
    '本场战斗攻击威力 +40%。抽 1 张。',
    [{ kind: 'strength', n: 40 }, { kind: 'draw', n: 1 }]),
  N('metal_sound', '金属音', 2, 'uncommon', 'enemy', 'ico-battery_negative', 'spark_05',
    '让对手防御 -35%。抽 1 张。',
    [{ kind: 'buff', stat: 'def', pct: -0.35, target: 'enemy' }, { kind: 'draw', n: 1 }]),
  N('scary_face', '鬼脸', 1, 'uncommon', 'enemy', 'ico-demon', 'smoke_1',
    '让对手敏捷 -35%。',
    [{ kind: 'buff', stat: 'agi', pct: -0.35, target: 'enemy' }]),
  N('charm', '撒娇', 1, 'uncommon', 'enemy', 'ico-heart', 'twirl_3',
    '让对手攻击 -35%。',
    [{ kind: 'buff', stat: 'atk', pct: -0.35, target: 'enemy' }]),
  N('recycle', '回收', 1, 'uncommon', 'self', 'ico-refresh', 'magic_2',
    '抽 2 张，回复 1 点 AP。',
    [{ kind: 'draw', n: 2 }, { kind: 'ap', n: 1 }]),
  N('quick_draw', '快速抽牌', 0, 'uncommon', 'self', 'ico-cards', 'light_1',
    '抽 2 张，本回合多出 1 次出牌机会。',
    [{ kind: 'draw', n: 2 }, { kind: 'plays', n: 1 }]),
  N('synthesis', '光合作用', 1, 'uncommon', 'self', 'ico-leaves', 'star_01',
    '回复最大生命的 25%，本场战斗攻击 +2。',
    [{ kind: 'heal', pct: 0.25 }, { kind: 'buff', stat: 'atk', amount: 2 }]),
  N('iron_barbs', '铁刺', 1, 'uncommon', 'self', 'ico-shield_03', 'spark_06',
    '获得护盾（随防御成长），并给对手 2 层出血。',
    [{ kind: 'shield', amount: 10, scaleWithDef: true }, { kind: 'status', status: 'bleed', stacks: 2 }]),
  N('sand_veil', '沙隐', 1, 'uncommon', 'self', 'ico-fog', 'smoke_1',
    '本场战斗幸运 +5，获得护盾（随防御成长）。',
    [{ kind: 'buff', stat: 'luck', amount: 5 }, { kind: 'shield', amount: 8, scaleWithDef: true }]),
  N('venom_drain', '毒液吸取', 2, 'uncommon', 'enemy', 'ico-flask', 'magic_1',
    '造成 {d} 点伤害，回复所造成伤害的 50%。',
    [{ kind: 'damage', power: 200, drainPct: 0.5 }]),

  // ---------------- 稀有：有条件的强 ----------------
  N('water_shuriken', '水手里剑', 1, 'rare', 'enemy', 'ico-water', 'spark_07',
    '连续 3 次造成 {d} 点伤害，抽 1 张。',
    [{ kind: 'damage', power: 45, hits: 3 }, { kind: 'draw', n: 1 }]),
  N('triple_axel', '三旋击', 2, 'rare', 'enemy', 'ico-wind', 'twirl_1',
    '连续 3 次造成 {d} 点伤害，并让对手获得 1 层虚弱。',
    [{ kind: 'damage', power: 80, hits: 3 }, { kind: 'status', status: 'weak', stacks: 1 }]),
  N('venoshock', '毒液冲击', 2, 'rare', 'enemy', 'ico-poison', 'magic_1',
    '造成 {d} 点伤害；对手身上有中毒或剧毒时，这一下额外 +90% 威力。',
    [{ kind: 'damage', power: 200, bonusIfDot: 90 }]),
  N('night_slash', '暗影爪', 2, 'rare', 'enemy', 'ico-demon_02', 'slash_1',
    '造成 {d} 点伤害；对手每有 1 层出血，这一下额外 +20% 威力（最多 +240%）。',
    [{ kind: 'damage', power: 200, bonusPerStack: { status: 'bleed', per: 20, max: 240 } }]),
  N('corrode', '腐蚀', 2, 'rare', 'enemy', 'ico-poison', 'magic_2',
    '造成 {d} 点伤害，并让对手防御 -30%。',
    [{ kind: 'damage', power: 210 }, { kind: 'buff', stat: 'def', pct: -0.3, target: 'enemy' }]),
  N('crush_grip', '硬压', 2, 'rare', 'enemy', 'ico-mace', 'earthquake',
    '造成 {d} 点伤害，并让对手防御 -40%。',
    [{ kind: 'damage', power: 200 }, { kind: 'buff', stat: 'def', pct: -0.4, target: 'enemy' }]),
  N('drain_punch', '吸取拳', 2, 'rare', 'enemy', 'ico-fist', 'spark_02',
    '造成 {d} 点伤害，回复所造成伤害的 75%。',
    [{ kind: 'damage', power: 210, drainPct: 0.75 }]),
  N('leech_life', '吸血', 2, 'rare', 'enemy', 'ico-bug', 'magic_1',
    '造成 {d} 点伤害，回复所造成伤害的 60%，并给对手 1 层中毒。',
    [{ kind: 'damage', power: 200, drainPct: 0.6 }, { kind: 'status', status: 'poison', stacks: 1 }]),
  N('moonlight', '月光', 2, 'rare', 'self', 'ico-night', 'star_02',
    '回复最大生命的 30%，并清除自身所有的属性下降与负面状态。',
    [{ kind: 'heal', pct: 0.3 }, { kind: 'cleanse', statuses: true }]),
  N('cotton_guard', '棉花防守', 1, 'rare', 'self', 'ico-heart', 'smoke_1',
    '本场战斗防御 +8。',
    [{ kind: 'buff', stat: 'def', amount: 8 }]),
  N('body_press', '重磅冲撞', 2, 'rare', 'enemy', 'ico-mace', 'dirt_1',
    '造成 {d} 点伤害，威力随你当前的护盾提升 —— 护盾越厚打得越疼。',
    [{ kind: 'damage', power: 180, plusShield: 1.2 }]),
  N('wide_guard', '广域防守', 2, 'rare', 'self', 'ico-protect', 'light_1',
    '获得护盾（随防御成长），这一份护盾下回合不会消失。',
    [{ kind: 'shield', amount: 14, scaleWithDef: true, keep: true }]),
  N('mind_reader', '读心', 1, 'rare', 'self', 'ico-target', 'trace_03',
    '抽 3 张，本回合多出 2 次出牌机会。',
    [{ kind: 'draw', n: 3 }, { kind: 'plays', n: 2 }]),
  N('blood_price', '血祭', 1, 'rare', 'self', 'ico-heart_break_02', 'slash_1',
    '自身失去最大生命 10% 的 HP，本场战斗攻击威力 +80%。使用后销毁。',
    [{ kind: 'selfDmg', pct: 0.1, reason: '血祭' }, { kind: 'strength', n: 80 }], { exhaust: true }),
  N('overclock', '超频', 1, 'rare', 'self', 'ico-lightning', 'spark_01',
    '回复 3 点 AP，本回合多出 1 次出牌机会。使用后销毁。',
    [{ kind: 'ap', n: 3 }, { kind: 'plays', n: 1 }], { exhaust: true }),
  N('storm_throw', '狂风投掷', 2, 'rare', 'enemy', 'ico-wind', 'twirl_2',
    '连续 2 次造成 {d} 点伤害，并让对手敏捷 -4。',
    [{ kind: 'damage', power: 120, hits: 2 }, { kind: 'buff', stat: 'agi', amount: -4, target: 'enemy' }]),
  N('frost_breath', '冰冻之风', 1, 'rare', 'enemy', 'ico-water', 'light_1',
    '造成 {d} 点伤害，并让对手敏捷 -30%。',
    [{ kind: 'damage', power: 110 }, { kind: 'buff', stat: 'agi', pct: -0.3, target: 'enemy' }]),

  // ---------------- 史诗：终结技与流派收尾 ----------------
  N('hyper_beam', '破坏死光', 4, 'epic', 'enemy', 'ico-lightning', 'spark_05',
    '造成 {d} 点伤害。使用后销毁。',
    [{ kind: 'damage', power: 520 }], { exhaust: true }),
  N('dynamax_cannon', '极巨炮', 4, 'epic', 'enemy', 'ico-mace', 'flare_1',
    '造成 {d} 点伤害，无视对手 50% 防御。使用后销毁。',
    [{ kind: 'damage', power: 450, ignoreDefPct: 0.5 }], { exhaust: true }),
  N('solar_beam', '日光束', 3, 'epic', 'enemy', 'ico-leaves', 'star_03',
    '连续 2 次造成 {d} 点伤害。使用后销毁。',
    [{ kind: 'damage', power: 205, hits: 2 }], { exhaust: true }),
  N('megahorn', '超级角击', 3, 'epic', 'enemy', 'ico-bug', 'spark_06',
    '造成 {d} 点伤害，并给对手 2 层出血。使用后销毁。',
    [{ kind: 'damage', power: 380 }, { kind: 'status', status: 'bleed', stacks: 2 }], { exhaust: true }),
  N('doom_desire', '破灭之愿', 3, 'epic', 'enemy', 'ico-meteor', 'star_06',
    '造成 {d} 点伤害，无视对手全部防御。使用后销毁。',
    [{ kind: 'damage', power: 300, ignoreDefPct: 1 }], { exhaust: true }),
  N('plague', '疫病', 3, 'epic', 'enemy', 'ico-skull', 'magic_2',
    '给对手 3 层中毒和 3 层剧毒。使用后销毁。',
    [{ kind: 'status', status: 'poison', stacks: 3 }, { kind: 'status', status: 'toxic', stacks: 3 }], { exhaust: true }),
  N('venom_burst', '毒爆', 2, 'epic', 'enemy', 'ico-poison', 'flare_1',
    '引爆对手身上所有的中毒 / 剧毒 / 灼伤层数：立刻结算成伤害（每层约 3 倍中毒伤害）并清空。使用后销毁。',
    [{ kind: 'detonate', perStack: 3 }], { exhaust: true }),
  N('toxic_overflow', '剧毒泛滥', 3, 'epic', 'enemy', 'ico-flask', 'magic_2',
    '造成 {d} 点伤害；对手每有 1 层中毒或剧毒，这一下额外 +25% 威力（最多 +250%）。使用后销毁。',
    [{ kind: 'damage', power: 300, bonusPerStack: { status: ['poison', 'toxic'], per: 25, max: 250 } }], { exhaust: true }),
  N('last_stand', '背水一战', 2, 'epic', 'self', 'ico-demon', 'slash_1',
    '本场战斗攻击威力 +150%，防御 -8。使用后销毁。',
    [{ kind: 'strength', n: 150 }, { kind: 'buff', stat: 'def', amount: -8 }], { exhaust: true }),
  N('overheat', '过热', 3, 'epic', 'enemy', 'ico-flame', 'flare_1',
    '造成 {d} 点伤害，本场战斗攻击威力 +120%。使用后销毁。',
    [{ kind: 'damage', power: 330 }, { kind: 'strength', n: 120 }], { exhaust: true }),
  N('guardian_oath', '守护誓约', 2, 'epic', 'self', 'ico-shield', 'light_1',
    '获得大量护盾（随防御成长），本场战斗防御 +6，并清除自身所有负面状态。使用后销毁。',
    [{ kind: 'shield', amount: 20, scaleWithDef: true }, { kind: 'buff', stat: 'def', amount: 6 }, { kind: 'cleanse', statuses: true }], { exhaust: true }),
  N('life_spring', '生命之泉', 2, 'epic', 'self', 'ico-heal', 'star_04',
    '回复最大生命的 45%，并回复 2 点 AP。使用后销毁。',
    [{ kind: 'heal', pct: 0.45 }, { kind: 'ap', n: 2 }], { exhaust: true }),
  N('dragon_ascension', '龙之升华', 3, 'epic', 'self', 'ico-star', 'star_05',
    '本场战斗攻击 +8、敏捷 +4、幸运 +6，抽 2 张。使用后销毁。',
    [{ kind: 'buff', stat: 'atk', amount: 8 }, { kind: 'buff', stat: 'agi', amount: 4 },
      { kind: 'buff', stat: 'luck', amount: 6 }, { kind: 'draw', n: 2 }], { exhaust: true }),
];

const existing = new Set(data.cards.map((c) => c.id));
const clash = NEW.filter((c) => existing.has(c.id));
if (clash.length) {
  console.error('✗ 这些 id 已经存在：', clash.map((c) => c.id).join(', '));
  process.exit(1);
}
const dup = NEW.map((c) => c.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dup.length) { console.error('✗ 新卡里 id 重复：', dup.join(', ')); process.exit(1); }

data.cards.push(...NEW);
const byRar = {};
for (const c of data.cards) byRar[c.rarity] = (byRar[c.rarity] ?? 0) + 1;
console.log(`新增 ${NEW.length} 张 → 卡池共 ${data.cards.length} 张`);
console.log('稀有度分布：', JSON.stringify(byRar));
if (WRITE) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('已写回 content/cards.json');
} else {
  console.log('（没有写文件；加 --write 才会写回）');
}
