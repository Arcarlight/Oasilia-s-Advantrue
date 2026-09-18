// 全局平衡常数：所有数值调参都集中在这里，方便统一感受手感。

export const BALANCE = {
  // ---- 玩家初始属性 ----
  player: {
    // 主角名字只写在这里；日志 / 标题 / 结局都从 run 数据里的 name 取，别再往代码里写死
    name: '欧亚西莉亚',
    species: 'flygon',
    speciesName: '沙漠蜻蜓',
    speciesEn: 'Flygon',
    dex: '0330',
    type1: '地面',
    type2: '龙',
    ability: '飘浮',
    gender: '♀',
    atk: 16,
    def: 12,
    maxHp: 260,
    agi: 10,
    luck: 5,
  },

  // ---- 属性成长上限 ----
  cap: { atk: 70, def: 50, maxHp: 520, agi: 24, luck: 25 },

  // ---- 战斗公式 ----
  // 最终伤害 = max(1, round(原始伤害 * 100/(100+防守方DF)) - 护盾)
  armorK: 60,
  minDamage: 1,

  // AP / 敏捷：每 2 点敏捷 +1 AP
  apBase: 2,
  apPerAgi: 2,
  apMax: 8,

  // 每回合最多打出几张牌：AP 才是主要瓶颈，这个上限只防止 0 费牌无限连打
  playBase: 3,
  playPerAgi: 2,
  playMax: 9,

  // 抽卡：抽牌数 > 手牌上限，逼玩家每回合把牌打出去（否则会囤牌导致输出崩掉）
  drawBase: 3,
  drawPerAgi: 5,
  drawMax: 8,
  handBase: 4,
  handPerAgi: 5,
  handMax: 9,

  // 敌方输出不做额外打折，平衡直接写在 enemies.js 的「战力曲线」里
  enemyAtkMul: 1,

  /**
   * 属性削减上限：攻击 / 防御 / 敏捷 最多被削到「基础值的这个比例」。
   * 为什么需要：削弱牌的减益整场战斗永久叠加，敌人卡组里又不止一张 ——
   * 玩家的防御能被压到负数，减伤公式里的 0 防御等于裸奔，
   * 打小怪也会变成「站着挨打还手不动」。现在最低只到基础值的一半：
   * 削弱依然有意义（防御 12 → 最低 6），但不会滚成不可逆的雪球。
   */
  debuffFloorPct: 0.5,

  // 幸运
  luckCritDivisor: 2.4, // 暴击率% = luck * 100 / (100 + luck*2.4)
  luckCritMult: 1.6,
  luckDodgeDivisor: 3.2, // 闪避率% = luck * 100 / (100 + luck*3.2)

  // 回合开始被动
  regenPerTurn: 0, // 玩家每回合自动回血（护符可加）

  // ---- 地图 ----
  map: {
    rowsPerStage: 9,
    minBranches: 2,
    maxBranches: 3,
  },

  // ============================================================
  // 敌人战力表（唯一数据源，enemies.js 只负责挑物种和招式）
  // 这套数值是「先定设计目标 → 反推 → 再用真实引擎验证」调出来的：
  //   目标击杀回合：野生 ~2 / 较强 ~2.5 / 精英 ~3.5 / 首领 ~4.5
  //   目标敌方输出：约为玩家最大生命的 17%~30%
  //                → 不靠回复能撑 4~5 回合，靠护盾和治疗可以把首领战拖到 6 回合以上
  // 推导脚本：tools/check-balance.mjs、tools/measure-balance.mjs、tools/autotune.mjs
  // 索引 = 章节（0~5）；数值 = 该章「中段节点」的基础值，再乘章内深度与玩家战力对齐系数
  // 第 4~6 章是加新地图（藤蔓密林 / 潮汐盐海 / 风蚀峭壁）时按同一条曲线外推的：
  // 玩家每章大约长「攻击 +9 / 防御 +6 / 生命 +45」，敌方输出维持在玩家最大生命的 15%~22%。
  // ============================================================
  enemyHp: {
    // 杂兵 / 较强：保持「短平快」（3~4.5 回合、胜率 95%+）—— 它们是资源消耗，不是门槛。
    // 精英 / 首领：第 4 章起明显加厚，让胜率按目标曲线掉下来。
    // 这套数字是 tune-curve 逐格二分 + sweep-curve 复核挑出来的。注意：
    // 单格胜率在这个样本量下有 ±10 个点的噪声，所以挑的时候**优先看回合数与每回合压力**
    // （这两个量稳定得多），胜率只要求落在合理区间、整体逐章下降。
    mob: [253, 377, 388, 633, 652, 1153],
    normal: [152, 521, 789, 1116, 1608, 1740],
    elite: [166, 433, 678, 1088, 1527, 1822],
    boss: [108, 295, 436, 755, 958, 1168],
  },
  // 敌攻 ×1.7（配合「出战卡组 = 全部卡牌」这一版）：
  // 玩家每回合能打的牌变多之后，光靠加血只会把战斗拖成 6~8 回合的持久战，
  // 而「回合数 × 每回合压力」才是难度本身。想在不拖长战斗的前提下把胜率压到目标曲线，
  // 只能让敌人打得更疼 —— 这正好回到 README 里那个 15%~22%/回合 的设计区间
  // （实测压力：杂兵 10~14%、精英 15~20%、首领 23~28%）。HP 随后由 tune-curve.mjs 逐格重定。
  enemyAtk: {
    mob: [10, 14, 19, 22, 26, 31],
    normal: [12, 14, 19, 24, 27, 32],
    elite: [17, 19, 26, 34, 39, 44],
    boss: [20, 26, 36, 44, 51, 53],
  },
  depthBonus: 0.06, // 章内越深越强：章末最多 +6%
  nodeAtkStep: 0.01,

  // 「玩家战力」参考值：用来判断这一局的玩家是否跟得上章节强度。
  // 如果玩家没怎么成长（没拿到好卡、没吃到属性事件），敌人会相应变弱，
  // 这样新手不会在第二章被直接劝退，而成长顺利的玩家仍然会感到压力。
  playerPowerRef: [30, 52, 62, 82, 98, 112],   // 期望战力 = 攻击 + 防御 + 生命/25 + 敏捷/3
  powerScaleMin: 0.62,
  powerScaleMax: 1.18,

  // ---- 奖励 ----
  goldPerBattle: [18, 30],
  goldPerElite: [45, 70],
  healAfterBattlePct: 0.12,   // 6 章一趟很长，每场战斗后多回一点，让玩家有机会看到后面的地图
  fullHealAfterBoss: true, // 打完首领完全恢复，准备下一章
  restHealPct: 0.40,
  cardRewardChance: 0.7,
  potionDropChance: 0.68,

  // ---- 玩家最少出战的卡牌数 ----
  minBattleDeck: 2,
  maxBattleDeck: 14,   // 卡池变大了（79 张），出战上限也跟着放宽一点，让玩家带得进「解场牌」

  // ---- 每个阶段结束后的收获 ----
  stageClearGold: [30, 55, 90, 130, 175, 225],

  // 走到首领节点时会先在这里恢复一点生命，避免「满血才能打首领」
  preBossHealPct: 0.6,
};

/** 敏捷 -> 每回合 AP */
export function apFromAgi(agi) {
  return Math.min(BALANCE.apMax, BALANCE.apBase + Math.floor(agi / BALANCE.apPerAgi));
}
/** 敏捷 -> 每回合抽几张贴 */
export function drawFromAgi(agi) {
  return Math.min(BALANCE.drawMax, BALANCE.drawBase + Math.floor(agi / BALANCE.drawPerAgi));
}
/** 敏捷 -> 手牌上限 */
export function handFromAgi(agi) {
  return Math.min(BALANCE.handMax, BALANCE.handBase + Math.floor(agi / BALANCE.handPerAgi));
}
/** 敏捷 -> 每回合最多出几张牌 */
export function playsFromAgi(agi) {
  return Math.min(BALANCE.playMax, BALANCE.playBase + Math.floor(agi / BALANCE.playPerAgi));
}
export function critChance(luck) {
  return Math.min(75, (luck * 100) / (100 + luck * BALANCE.luckCritDivisor));
}
export function dodgeChance(luck) {
  return Math.min(45, (luck * 100) / (100 + luck * BALANCE.luckDodgeDivisor));
}

// #region GENERATED-BIOMES
export const STAGE_BIOME = [
  "desert",
  "canyon",
  "forest",
  "tide",
  "cliff",
  "night"
];

export const BIOMES = {
  "desert": {
    "key": "desert",
    "name": "流沙之海",
    "sub": "第一章",
    "desc": "热风卷着石英砂，地平线像被烤化了一样摇晃。",
    "sky": [
      "#2a1c14",
      "#6b4a2a",
      "#c98f4a"
    ],
    "ground": "#8a5a2b",
    "accent": "#f0b95c",
    "shape": {
      "desc": "第一章：什么都有一点，当作教学图",
      "rows": 9,
      "nodeWeights": {
        "battle": 52,
        "elite": 9,
        "event": 18,
        "chest": 13,
        "shop": 8
      },
      "guarantee": {
        "chest": 2,
        "shop": 2,
        "rest": 1
      }
    }
  },
  "canyon": {
    "key": "canyon",
    "name": "赤岩峡谷",
    "sub": "第二章",
    "desc": "层层叠叠的红色岩壁，风在里面吹口哨。",
    "sky": [
      "#1d1420",
      "#5a2a28",
      "#c2553c"
    ],
    "ground": "#6d3123",
    "accent": "#ff8a5c",
    "shape": {
      "desc": "第二章：精英偏多，硬碰硬的图",
      "rows": 9,
      "nodeWeights": {
        "battle": 46,
        "elite": 16,
        "event": 16,
        "chest": 14,
        "shop": 8
      },
      "guarantee": {
        "chest": 2,
        "shop": 1,
        "rest": 1
      }
    }
  },
  "forest": {
    "key": "forest",
    "name": "藤蔓密林",
    "sub": "第三章",
    "desc": "沙的尽头是一堵树墙。阳光被叶子切成碎片，落在地上还在动。",
    "sky": [
      "#0f1c14",
      "#1f4028",
      "#4e8a4a"
    ],
    "ground": "#2f4a2a",
    "accent": "#8ddc6a",
    "shape": {
      "desc": "第三章：怪事多，事件与宝箱偏多",
      "rows": 10,
      "nodeWeights": {
        "battle": 40,
        "elite": 9,
        "event": 30,
        "chest": 16,
        "shop": 5
      },
      "guarantee": {
        "chest": 2,
        "shop": 1,
        "rest": 1
      }
    }
  },
  "tide": {
    "key": "tide",
    "name": "潮汐盐海",
    "sub": "第四章",
    "desc": "沙下面全是水。退潮时露出一片白得刺眼的盐壳，涨潮时整片地都在呼吸。",
    "sky": [
      "#0d1c33",
      "#1d4a68",
      "#5fb0c8"
    ],
    "ground": "#245363",
    "accent": "#7fe6ff",
    "shape": {
      "desc": "第四章：补给多（商店 / 宝箱），适合调整卡组",
      "rows": 10,
      "nodeWeights": {
        "battle": 44,
        "elite": 10,
        "event": 16,
        "chest": 16,
        "shop": 14
      },
      "guarantee": {
        "chest": 2,
        "shop": 2,
        "rest": 1
      }
    }
  },
  "cliff": {
    "key": "cliff",
    "name": "风蚀峭壁",
    "sub": "第五章",
    "desc": "风在这里被切成一把把刀。岩壁上全是它刻出来的沟，深得能塞进一个人。",
    "sky": [
      "#181822",
      "#3c3a4e",
      "#8a8aa8"
    ],
    "ground": "#4a4658",
    "accent": "#cfd6ff",
    "shape": {
      "desc": "第五章：战斗与精英最多，一路打上去",
      "rows": 10,
      "nodeWeights": {
        "battle": 54,
        "elite": 16,
        "event": 13,
        "chest": 12,
        "shop": 5
      },
      "guarantee": {
        "chest": 1,
        "shop": 1,
        "rest": 1
      }
    }
  },
  "night": {
    "key": "night",
    "name": "夜砂墓原",
    "sub": "第六章",
    "desc": "星尘落进沙里，埋在下面的东西开始翻身。",
    "sky": [
      "#0d1030",
      "#241a4a",
      "#4a3a7a"
    ],
    "ground": "#2c2447",
    "accent": "#a98cff",
    "shape": {
      "desc": "第六章（终章）：长、难、几乎没有商店",
      "rows": 11,
      "nodeWeights": {
        "battle": 50,
        "elite": 20,
        "event": 16,
        "chest": 12,
        "shop": 2
      },
      "guarantee": {
        "chest": 1,
        "shop": 1,
        "rest": 1
      }
    }
  }
};

export const RARITY = {
  "common": {
    "key": "common",
    "name": "普通",
    "color": "#c8bda6",
    "weight": 100
  },
  "uncommon": {
    "key": "uncommon",
    "name": "精良",
    "color": "#6fd3a0",
    "weight": 55
  },
  "rare": {
    "key": "rare",
    "name": "稀有",
    "color": "#7fb8ff",
    "weight": 26
  },
  "epic": {
    "key": "epic",
    "name": "史诗",
    "color": "#d08cff",
    "weight": 9
  }
};
// #endregion GENERATED-BIOMES

// ============================================================
// 战斗演出速度
// ============================================================

/**
 * 演出倍率：1 = 标准，越大越慢。
 * 放在 balance 里是因为战斗界面和设置弹窗都要用它，避免两边各写一份。
 */
export const BATTLE_SPEED_KEY = 'oasis.battleSpeed';

export const SPEED_OPTIONS = [
  { key: 'slow', label: '慢（看清每个动作）', mul: 1.4 },
  { key: 'normal', label: '标准', mul: 1 },
  { key: 'fast', label: '快（老手速刷）', mul: 0.55 },
];

export function speedMulOf(key) {
  return SPEED_OPTIONS.find((o) => o.key === key)?.mul ?? 1;
}

/** 读取当前演出速度：URL 上的 ?speed= 优先（方便自动测试），其次 localStorage */
export function loadBattleSpeed() {
  try {
    const q = new URLSearchParams(location.search).get('speed');
    if (q && SPEED_OPTIONS.some((o) => o.key === q)) return q;
  } catch { /* 忽略 */ }
  try {
    const v = localStorage.getItem(BATTLE_SPEED_KEY);
    if (v && SPEED_OPTIONS.some((o) => o.key === v)) return v;
  } catch { /* 忽略 */ }
  return 'normal';
}
