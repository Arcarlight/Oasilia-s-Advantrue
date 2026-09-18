// 事件效果的声明式解释器。
//
// 为什么要有这一层：地图事件以前是一堆手写的 run(game) 函数，
// 加事件必须写代码、也没法静态校验「引用的卡牌/道具 id 到底存不存在」。
// 现在 content/events/*.json 里只声明「发生什么」（DSL），改 state 的活由这里干：
//   · 加事件 = 加一段 JSON，不用碰代码；
//   · tools/build-content.mjs 能静态校验（id 是否存在、文本里的 {token} 有没有来源）。
//
// DSL 速查（每个元素只允许有一个「键」，控制节点除外）：
//   {"hp": -15}                    扣血（不会打死，最多扣到 1 点），{hp} = 实际扣掉多少
//   {"hp": 30}                     回血（受上限裁剪），{heal} = 实际回了多少
//   {"hpPct": -0.2} / {"hpPct": 0.25}  按最大生命的百分比
//   {"fullHeal": true}             回满
//   {"stat": {"atk": 3, "luck": 2}} 属性成长，{atk} / {luck} = 实际增加量
//   {"gold": 45} / {"goldRange": [25, 60]}   金币，{gold}
//   {"item": {"id": "potion_small", "n": 2}} 道具，{item} = 道具名，{n} = 数量
//   {"card": "quick_attack"}       指定卡牌，{card} = 卡名
//   {"cardRandom": 0.4}            随机卡（数字 = 稀有度加成），{card}
//   {"cardRarity": {"rarities": ["rare","epic"], "boost": 0.6}}  指定稀有度，{card}
//   {"removeCard": "tackle"}       从卡组里去掉一张，{removed} = 卡名
//   {"branch": [ {"weight": 50, "text": "…", "tone": "bad", "effects": [...]}, … ]}
//   {"if": {"goldAtLeast": 35}, "then": {...}, "else": {...}}   条件分支（then/else 是「块」）
//   {"special": "handlerName"}     逃生舱：调 src/data/event-handlers.js 里注册的函数

import { ITEMS, CARD_BY_ID } from '../data/cards.js';

/** 简单效果：对象里只允许有这些键之一 */
export const SIMPLE_EFFECT_KEYS = [
  'hp', 'hpPct', 'fullHeal', 'stat', 'gold', 'goldRange',
  'item', 'card', 'cardRandom', 'cardRarity', 'removeCard',
];

/** 控制节点 */
export const CONTROL_KEYS = ['branch', 'if', 'special'];

/** 每种效果会喂给文本的变量名（供校验器检查 {token} 有没有来源） */
export const VARS_OF_EFFECT = {
  hp: ['hp', 'heal'],
  hpPct: ['hp', 'heal'],
  fullHeal: ['heal'],
  stat: null, // 取决于 stat 的键
  gold: ['gold'],
  goldRange: ['gold'],
  item: ['item', 'n'],
  card: ['card'],
  cardRandom: ['card'],
  cardRarity: ['card'],
  removeCard: ['removed'],
  branch: null,
  if: null,
  special: null,
};

/**
 * 逃生舱：少数事件需要自定义逻辑（例如读了局部随机数再决定文案）。
 * 注册函数签名 (game, vars, ctx) => ({text?, tone?} | void)
 */
export const SPECIALS = {};

export function registerSpecial(name, fn) {
  SPECIALS[name] = fn;
  return name;
}

function weightedPick(rng, list) {
  const total = list.reduce((s, x) => s + (x.weight ?? 1), 0);
  let r = rng() * total;
  for (const x of list) {
    r -= (x.weight ?? 1);
    if (r <= 0) return x;
  }
  return list[list.length - 1];
}

function checkCondition(cond, game) {
  if (!cond) return true;
  const d = game.data;
  if (cond.hpBelowPct != null && d.hp / d.maxHp >= cond.hpBelowPct) return false;
  if (cond.hpAtLeastPct != null && d.hp / d.maxHp < cond.hpAtLeastPct) return false;
  if (cond.goldAtLeast != null && d.gold < cond.goldAtLeast) return false;
  if (cond.goldBelow != null && d.gold >= cond.goldBelow) return false;
  if (cond.hasItem != null && (d.items[cond.hasItem] ?? 0) <= 0) return false;
  if (cond.deckHas != null && !d.deck.includes(cond.deckHas)) return false;
  if (cond.deckLacks != null && d.deck.includes(cond.deckLacks)) return false;
  if (cond.stageAtLeast != null && d.stage < cond.stageAtLeast) return false;
  if (cond.chance != null && !game.rng.chance(cond.chance)) return false;
  return true;
}

/** 执行一个「块」（可以是数组，也可以是 {text, tone, effects}） */
function runBlock(block, game, vars) {
  if (!block) return {};
  if (Array.isArray(block)) {
    let out = {};
    for (const item of block) {
      const r = runEffect(item, game, vars);
      if (r && (r.text || r.tone)) out = { ...out, ...r };
    }
    return out;
  }
  let out = {};
  if (block.effects) out = { ...out, ...runBlock(block.effects, game, vars) };
  if (block.text) out.text = block.text;
  if (block.tone) out.tone = block.tone;
  if (block.special) out = { ...out, ...(runEffect({ special: block.special }, game, vars) ?? {}) };
  return out;
}

function runEffect(eff, game, vars) {
  if (!eff || typeof eff !== 'object') return {};

  // ---- 控制节点 ----
  if (eff.branch) {
    const pick = weightedPick(game.rng, eff.branch);
    return runBlock(pick, game, vars);
  }
  if (eff.if) {
    const ok = checkCondition(eff.if, game);
    return runBlock(ok ? eff.then : eff.else, game, vars);
  }
  if (eff.special) {
    const fn = SPECIALS[eff.special];
    if (!fn) throw new Error(`事件用了未注册的 special: ${eff.special}`);
    return fn(game, vars, eff) ?? {};
  }

  // ---- 简单效果：取唯一的那个键 ----
  const keys = Object.keys(eff);
  if (keys.length !== 1 || !SIMPLE_EFFECT_KEYS.includes(keys[0])) {
    throw new Error(`事件效果格式不对：${JSON.stringify(eff)}`);
  }
  const key = keys[0];
  const v = eff[key];

  switch (key) {
    case 'hp': {
      const n = Number(v);
      if (n < 0) {
        const cost = game.takeDamage(-n);
        vars.hp = (vars.hp ?? 0) + cost;
      } else {
        const healed = game.heal(n);
        vars.heal = (vars.heal ?? 0) + healed;
      }
      break;
    }
    case 'hpPct': {
      const amount = Math.round(game.data.maxHp * Number(v));
      if (amount < 0) {
        const cost = game.takeDamage(-amount);
        vars.hp = (vars.hp ?? 0) + cost;
      } else {
        const healed = game.heal(amount);
        vars.heal = (vars.heal ?? 0) + healed;
      }
      break;
    }
    case 'fullHeal': {
      const healed = game.heal(game.data.maxHp);
      vars.heal = (vars.heal ?? 0) + healed;
      break;
    }
    case 'stat': {
      for (const [k, n] of Object.entries(v)) {
        const gained = game.gainStat(k, Number(n));
        vars[k] = (vars[k] ?? 0) + gained;
      }
      break;
    }
    case 'gold': {
      const n = Number(v);
      game.data.gold = Math.max(0, game.data.gold + n);
      vars.gold = (vars.gold ?? 0) + n;
      break;
    }
    case 'goldRange': {
      const [a, b] = v;
      const g = game.rng.int(a, b);
      game.data.gold += g;
      vars.gold = (vars.gold ?? 0) + g;
      break;
    }
    case 'item': {
      const id = typeof v === 'string' ? v : v.id;
      const n = typeof v === 'string' ? 1 : (v.n ?? 1);
      game.giveItem(id, n);
      vars.item = ITEMS[id]?.name ?? id;
      vars.n = n;
      break;
    }
    case 'card': {
      const c = game.addCard(v);
      vars.card = c?.name ?? v;
      break;
    }
    case 'cardRandom': {
      const boost = typeof v === 'number' ? v : (v?.boost ?? 0);
      const c = game.offerRandomCard(boost);
      vars.card = c.name;
      break;
    }
    case 'cardRarity': {
      const c = game.offerCardOfRarity(v.rarities ?? ['rare'], v.boost ?? 0.5);
      vars.card = c.name;
      break;
    }
    case 'removeCard': {
      const ok = game.removeCard(v);
      vars.removed = ok ? (CARD_BY_ID[v]?.name ?? v) : '';
      break;
    }
    default:
      break;
  }
  return {};
}

/** 把 {token} 换成实际数值 */
export function renderText(text, vars) {
  if (!text) return '';
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}

/**
 * 把一个 JSON 选项编译成 game 需要的 {label, hint, run(game)}。
 * @param {{label:string, hint?:string, tone?:string, text?:string, effects?:any[]}} spec
 */
export function eventOption(spec) {
  return {
    label: spec.label,
    hint: spec.hint,
    run(game) {
      const vars = {};
      const res = runBlock(spec.effects ?? [], game, vars);
      return {
        text: renderText(res.text ?? spec.text ?? '', vars),
        tone: res.tone ?? spec.tone ?? 'neutral',
      };
    },
  };
}

/** 静态分析用：列出这段 effects 可能产出的变量名 */
export function varsProduced(effects, out = new Set()) {
  if (!effects) return out;
  const list = Array.isArray(effects) ? effects : [effects];
  for (const eff of list) {
    if (!eff || typeof eff !== 'object') continue;
    if (eff.branch) { for (const b of eff.branch) varsProduced(b.effects, out); continue; }
    if (eff.if) { varsProduced(eff.then, out); varsProduced(eff.else, out); continue; }
    if (eff.special) { out.add('*'); continue; }
    const key = Object.keys(eff)[0];
    if (!key) continue;
    if (key === 'stat' && eff.stat && typeof eff.stat === 'object') {
      for (const k of Object.keys(eff.stat)) out.add(k);
      continue;
    }
    if (key === 'hp' && Number(eff.hp) >= 0) { out.add('heal'); continue; }
    for (const name of (VARS_OF_EFFECT[key] ?? [])) out.add(name);
  }
  return out;
}
