// 地图生成：分叉路线图（类似杀戮尖塔的节点图），每个节点只能往下走。
// 一张图 = 一个章节，走到最后一个节点（首领）后进入下一章。

import { BALANCE, BIOMES, STAGE_BIOME } from '../data/balance.js';

export const NODE_TYPES = {
  battle: { key: 'battle', name: '野生宝可梦', icon: 'sword', color: '#e0b070', desc: '一场普通战斗，可能掉落卡牌与金币。' },
  elite: { key: 'elite', name: '强敌', icon: 'skull', color: '#ff7a7a', desc: '更强的对手，奖励也更丰厚。' },
  event: { key: 'event', name: '未知事件', icon: 'question', color: '#9fd8ff', desc: '路上总会发生点奇怪的事。' },
  chest: { key: 'chest', name: '宝箱', icon: 'pouch', color: '#ffd76e', desc: '打开看看，也许是道具，也许是别的。' },
  // 商队与营地按地图换叫法（names 里没有这张图就退回 name）：不然第六章的墓原上还写着「沙漠商队」
  shop: {
    key: 'shop', name: '商队', icon: 'house', color: '#8ce0c0', desc: '用金币换卡牌或补给。',
    names: {
      desert: '沙漠商队', canyon: '峡谷货栈', forest: '林间货摊',
      tide: '海市商船', cliff: '崖顶货郎', night: '夜市灯摊',
    },
  },
  rest: {
    key: 'rest', name: '营地', icon: 'campfire', color: '#7ee08a', desc: '休息一下，回复生命。',
    names: {
      desert: '绿洲营地', canyon: '岩荫歇脚处', forest: '树洞营地',
      tide: '礁石营地', cliff: '崖穴避风处', night: '守夜火堆',
    },
  },
  boss: { key: 'boss', name: '章节首领', icon: 'crown', color: '#ff9bd0', desc: '这一章的终点。' },
};

/** 某个节点在某张地图上的叫法（地图改名的那几类用 names，其余用通用名） */
export function nodeName(type, biome) {
  const t = NODE_TYPES[type] ?? NODE_TYPES.battle;
  return t.names?.[biome] ?? t.name;
}

/** 章节顺序写在 content/biomes.json 的 stageOrder 里，这里不再重复一份 */

/**
 * 这一章的分叉加成（路有多宽）。
 *
 * 用户要求：「本体的地图也可以稍微越往后增加越多路径，到第三关之后则会逐渐回归」
 *   → 正片按 BALANCE.map.branchBonusByStage 走（第 3 章最宽，之后收回）。
 * 超出正片（无尽模式）：固定给 BALANCE.endless.branchBonus 的加成 —— 无尽模式「地图有更多分叉」。
 */
export function branchBonusFor(stage) {
  const table = BALANCE.map.branchBonusByStage ?? [];
  if (stage < table.length) return table[stage] ?? 0;
  return BALANCE.endless?.branchBonus ?? 0;
}

/**
 * **无尽模式**这一章的分叉加成：正片那张计划表 + 无尽额外的 +1。
 *
 * ⚠ 这一条是测试抓出来的：第一版在无尽局里只传了 rowBonus，
 * 分叉还是走 `branchBonusFor(stage)`（= 正片计划表），于是**无尽模式第 1~6 章根本不比正片宽** ——
 * 「地图有更多分叉」这条用户要求实际上没落地。
 */
export function endlessBranchBonus(stage) {
  return (BALANCE.map.branchBonusByStage?.[stage] ?? 0) + (BALANCE.endless?.branchBonus ?? 0);
}

/** 无尽模式里这一章比正片长几行（每 2 章 +1 行，最多 +maxRowsBonus） */export function endlessRowBonus(stage) {
  const e = BALANCE.endless ?? {};
  const over = stage - (BALANCE.map.branchBonusByStage?.length ?? 6);
  if (over < 0) return 0;
  return Math.min(e.maxRowsBonus ?? 3, Math.floor((over + 1) / (e.rowsPerTwoChapters ? 2 : 99)) + (over >= 0 ? 1 : 0));
}

/**
 * 生成一张章节地图。
 * @param {number} stage 0-based 章节序号
 * @param {Function} rng
 * @param {string} [biomeKey] 这一章用哪张地图 —— 开局时抽好的序列（`game.data.biomes`）说了算。
 *   不传就退回默认顺序 STAGE_BIOME（诊断脚本、老存档都还能跑）。
 * @param {{branchBonus?:number, rowBonus?:number}} [opts] 覆盖分叉 / 行数加成
 *   （无尽模式与诊断脚本用；不传就按章节自动算）
 */
export function generateMap(stage, rng, biomeKey = null, opts = {}) {
  const biome = BIOMES[biomeKey] ?? BIOMES[STAGE_BIOME[stage] ?? 'night'];
  // 每张地图的性格（行数 / 节点权重 / 保底数量）写在 content/biomes.json 的 shape 里：
  // 密林事件多、盐海商店多、峭壁精英多、终章又长又狠。缺配置就用全局默认。
  const shape = biome.shape ?? {};
  const branchBonus = opts.branchBonus ?? branchBonusFor(stage);
  const rows = (shape.rows ?? BALANCE.map.rowsPerStage) + (opts.rowBonus ?? 0);
  const weights = shape.nodeWeights ?? { battle: 52, elite: 9, event: 18, chest: 13, shop: 8 };
  const guarantee = shape.guarantee ?? { chest: 2, shop: 1, rest: 1 };

  /** @type {{id:string,row:number,col:number,type:string,next:string[],x:number,y:number}[]} */
  const nodes = [];
  const grid = [];
  const W = 3;
  const minB = Math.max(1, BALANCE.map.minBranches + branchBonus);
  const maxB = Math.max(minB, BALANCE.map.maxBranches + branchBonus);

  for (let r = 0; r < rows; r++) {
    const cols = r === rows - 1 ? 1 : rng.int(minB, maxB);
    const row = [];
    for (let c = 0; c < cols; c++) {
      const id = `s${stage}r${r}n${c}`;
      const node = {
        id, row: r, col: c, type: 'battle', next: [],
        x: cols === 1 ? 0.5 : c / (cols - 1),
        y: r / (rows - 1),
        visited: false,
      };
      row.push(node);
      nodes.push(node);
    }
    grid.push(row);
  }

  // 连接：每一行向下就近连接，保证每个节点至少有一条出路、一条入路
  for (let r = 0; r < rows - 1; r++) {
    const cur = grid[r];
    const nxt = grid[r + 1];
    for (let c = 0; c < cur.length; c++) {
      const from = cur[c];
      let targets;
      if (nxt.length === 1) targets = [nxt[0]];
      else if (nxt.length >= cur.length) {
        targets = [nxt[Math.min(c, nxt.length - 1)]];
        if (c + 1 < nxt.length && rng.chance(0.55)) targets.push(nxt[c + 1]);
      } else {
        const idx = Math.round((c / Math.max(1, cur.length - 1)) * (nxt.length - 1));
        targets = [nxt[idx]];
        if (rng.chance(0.3)) {
          const alt = nxt[Math.max(0, idx - 1)];
          if (!targets.includes(alt)) targets.push(alt);
        }
      }
      from.next = [...new Set(targets.map((t) => t.id))];
    }
    // 保证下一行的每个节点都有入路
    for (const t of nxt) {
      const hasIn = cur.some((f) => f.next.includes(t.id));
      if (!hasIn) {
        const near = cur.reduce((best, f) => (Math.abs(f.x - t.x) < Math.abs(best.x - t.x) ? f : best), cur[0]);
        near.next.push(t.id);
      }
    }
  }

  // ---- 分配节点类型 ----
  // 权重表来自 content/biomes.json 的 shape.nodeWeights（转成 rng.weighted 需要的 [权重, 值] 形式）
  const w = Object.entries(weights).filter(([, v]) => v > 0).map(([k, v]) => [v, k]);
  for (const n of nodes) {
    if (n.row === rows - 1) { n.type = 'boss'; continue; }
    if (n.row === 0) { n.type = 'battle'; continue; }
    let t;
    // 首领前一行固定给「准备节点」：营地或商队，让玩家有补血/补货的机会
    if (n.row === rows - 2) t = 'rest';
    else if (n.row === rows - 3) t = rng.weighted([[52, 'battle'], [20, 'elite'], [18, 'event'], [10, 'chest']]);
    else if (n.row <= 2) t = rng.weighted([[70, 'battle'], [30, 'event']]);
    else t = rng.weighted(w);
    n.type = t;
  }

  // 保底数量（每张地图自己定：宝箱 / 商店 / 营地）
  for (const [type, n] of Object.entries(guarantee)) ensureCount(nodes, type, n, rng);

  return { stage, biome: biome.key, rows, nodes, gridIds: grid.map((row) => row.map((n) => n.id)), branchBonus };
}

/** 保证某种节点至少出现 n 次 */
function ensureCount(nodes, type, n, rng) {
  const candidates = nodes.filter((x) => x.row > 0 && x.row < nodes.length - 1 && x.type !== 'boss');
  let have = candidates.filter((x) => x.type === type).length;
  let guard = 0;
  while (have < n && guard++ < 50) {
    const pool = candidates.filter((x) => x.type === 'battle');
    if (!pool.length) break;
    const pick = rng.pick(pool);
    pick.type = type;
    have++;
  }
}

/** 找出从某个节点出发的所有可选下一站 */
export function nextNodes(map, nodeId) {
  const node = map.nodes.find((n) => n.id === nodeId);
  if (!node) return [];
  return node.next.map((id) => map.nodes.find((n) => n.id === id)).filter(Boolean);
}

/** 初始可选的起点（第 0 行） */
export function startNodes(map) {
  return map.nodes.filter((n) => n.row === 0);
}

export function nodeById(map, id) {
  return map.nodes.find((n) => n.id === id);
}

export function stageCount() {
  return STAGE_BIOME.length;
}
