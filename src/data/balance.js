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
  // 最终伤害 = max(1, round(攻击 × (威力 + 力量) ÷ 100) × 减伤 - 护盾)
  //   减伤 = armorK / (armorK + 防守方防御)
  //
  // **威力是「攻击力的百分比」**（卡面写「威力 110」= 打出 1.1 倍攻击）。
  // 旧公式是 (攻击 + 威力)，攻击长到 50+ 之后威力就被淹没了：
  // 威力 2 的 0 费「撞击」和威力 17 的 3 费「爆音波」实际只差 72 → 87 点，
  // 而 0 费牌不花 AP、可以打满一回合 —— 这就是玩家实测的
  // 「高费卡完全不如低费卡的连打招」（量化见 tools/measure-cost.mjs：
  // 旧公式下 0 费每 AP 47 点、3 费每 AP 只有 18.3 点，费用越高越亏）。
  // 改成乘法之后「每 AP 买到的威力」随费用单调上升，付 AP 才不再是亏本买卖。
  armorK: 40,
  minDamage: 1,

  /**
   * 持续伤害的「按最大生命百分比」部分。
   *
   * 起因（玩家反馈）：「后期血量上限，上毒只扣个位数太少了」。
   * 旧规则是「流失等于层数的生命」—— 层数是个位数，后期敌人血量 1000+，
   * 挂满中毒一回合掉 3 点血，等于没上。
   * 现在每一层每回合掉 `最大生命 × 百分比 + 1`：
   * 血量越厚掉得越多，毒在后期依然是威胁；顺带也让「给对方上毒」在打首领时值得。
   */
  statusPct: { poison: 0.008, toxic: 0.006, burn: 0.004, bleed: 0.005 },

  /**
   * 「力量」（本场战斗的威力加成百分比）的上限。
   *
   * 为什么需要：力量是**永久叠加**的，而敌人牌组里有「过热」「长嚎」这类加力量的招 ——
   * 它们打完回牌堆底端，一个回合里能再抽回来。实测第 2 章的火系精英（风速狗，
   * 牌组里有 3 张过热）打上四五个回合，力量叠到 +480%，之后每张牌都是五倍伤害，
   * 玩家在「血量明明还够」的情况下被一波带走。给个上限，双方都别滚雪球。
   */
  strengthCap: 200,

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

  /**
   * 敌人卡牌伤害的系数（1 = 照卡面走）。
   *
   * 为什么会有这个旋钮：**敌我共用同一套卡**。玩家池那一版把 2 费 / 3 费攻击牌抬到
   * 190 / 285（用户要求「高费不能比 1 费还不划算」），敌人牌的伤害也一起变强了 ——
   * 而敌人的铺牌逻辑是「从最强往弱挑」，这 20% 几乎 1:1 落到了玩家头上：
   * 实测通关率 12% → 1.5%（400 局）。0.85 是扫出来的（1.0→1.5% · 0.9→8.0% ·
   * 0.85→11.5% · 0.8→18.0%），也就是「玩家的牌变好了，但敌人的输出回落到原来的水位」。
   */
  enemyAtkMul: 0.92,

  /**
   * 属性削减上限：各项最多被削到「基础值的这个比例」。
   *
   * 为什么需要：削弱牌的减益整场战斗永久叠加，敌人卡组里又不止一张 ——
   * 玩家的防御能被压到负数，减伤公式里的 0 防御等于裸奔，
   * 打小怪也会变成「站着挨打还手不动」。
   *
   * 但也不能像以前那样卡在 0.5：第 6 章敌人防御 16，-5 的削弱牌两下就顶到底，
   * 之后**所有**削弱牌都变成「已经降到底了」，玩家实测「削弱招后期完全无效」。
   * 攻击 / 防御放到 0.25（防御 16 → 最低 4），配合 armorK=40 让降防真的换来伤害。
   *
   * 敏捷单独给 0.5：它一个人管着 AP / 抽牌 / 出牌上限三件事，
   * 削到 25% 等于把玩家一回合能做的事砍掉一半以上（实测敏捷 10 → 4，
   * 出牌上限 8 → 5、抽牌 5 → 3、AP 7 → 4），那不是「被削弱」而是「被剥夺回合」。
   * 幸运同理（暴击 + 闪避），降到 0.5 就够痛了。
   */
  debuffFloorPct: { atk: 0.5, def: 0.5, agi: 0.6, luck: 0.6 },

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
    /**
     * 每一章的**分叉加成**（用户要求：「本体的地图也可以稍微越往后增加越多路径，
     * 到第三关之后则会逐渐回归，以给玩家更多选择」）。
     *
     * 索引 = 章节（0-based）：第 1 章 +0（2~3 条路）、第 2 章 +1（3~4 条）、
     * **第 3 章 +2（4~5 条，最多）**、第 4 章 +1、第 5~6 章 +0（回到原来的宽度）。
     * 超出这张表（无尽模式）用 BALANCE.endless.branchBonus。
     */
    branchBonusByStage: [0, 1, 2, 1, 0, 0],
  },

  /**
   * 无尽模式（通关一次之后解锁）：**地图更宽、敌人更强、一直走下去看能走多远**。
   *
   * 这些数字**只作用在正片章节之后**（stage ≥ 6），所以不会碰到用户定下的本体平衡。
   * 敌人用复利增长：第 7 章 ×1.18、第 8 章 ×1.18²……玩家每章也会变强（`powerFactor` 那一项），
   * 所以这是「早晚会被追上」的曲线 —— 无尽模式要的不是通关，而是**你走到第几章**。
   */
  endless: {
    /** 正片那 6 章也略微加压 —— 让无尽模式从第 1 章起就是「另一个模式」，而不是普通模式的续集 */
    hpEarlyPerChapter: 0.05,
    atkEarlyPerChapter: 0.03,
    /** 走过正片之后：复利叠加（第 7 章 ×1.18、第 8 章 ×1.18²…） */
    hpPerChapter: 0.18,
    atkPerChapter: 0.10,
    branchBonus: 1,
    /** 每 2 章多一行（路更长），最多多 3 行 */
    rowsPerTwoChapters: 1,
    maxRowsBonus: 3,
    /** 第 7 章起每章的通关金币：goldBase + 超出章节数 × goldPerChapter */
    goldBase: 40,
    goldPerChapter: 20,
  },

  // ============================================================
  // 敌人战力表
  // ============================================================
  /**
   * 设计目标：**击杀回合数**（难度 = 回合数 × 每回合压力，而不是「血包有多厚」）。
   *
   * 起因（玩家反馈）：「后面会有怪血量接近 2000，虽然玩家能过，但会被强行拉长战局」。
   * 旧表的血量是「二分搜索胜率」搜出来的，胜率对了，代价是后期怪变成了血包：
   * 第 6 章普通怪 1740 血（乘上章内深度与战力对齐最高能到 2100+），
   * 玩家每回合打三百多，一场要磨 5~6 回合，赢也赢得难受。
   *
   * 现在反过来：**先定回合数，再按玩家的真实每回合输出反推血量**。
   *   血量 = 该章玩家的实测每回合伤害 × 目标回合数
   *   → 全期回合数稳定在下面这张表里，后期难度全部由「敌人每回合打多疼」承担。
   * 推导脚本：tools/derive-enemy-curve.mjs（可用 --write 直接写回本文件）。
   *
   * 精英 / 首领的回合数后来从 3.5 / 4.5 收到 3.0 / 3.5：这两档的**卡组本来就比杂兵强将近 2 倍**
   * （同样的攻击力，每回合打掉的血是杂兵的 1.7 / 2.7 倍），回合拖得越久，玩家挨的总伤害越多 ——
   * 「战局被拉长」这件事在这两档上等于「被慢慢磨死」。收短之后首领战变成了
   * 「短、狠、需要交道具」，而不是「长、稳、看着血条一点点掉」。
   */
  targetTurns: { mob: 2.0, normal: 2.5, elite: 3.0, boss: 3.5 },

  // 索引 = 章节（0~5）；数值 = 该章「中段节点」的基础值，再乘章内深度与玩家战力对齐系数
  /**
   * 敌人数值表。两条**硬规则**，改表之前先读：
   *
   * ① **攻击力必须逐档递增**（每一章都满足 杂兵 < 较强 < 精英 < 首领）。
   *    玩家反馈原话：「较强的怪甚至比 boss 都强，攻击力比 boss 强 5 倍不止，绝对有问题」——
   *    旧的推导给每一档各自解一个攻击力，而攻击力是从「每点攻击造成多少伤害」反推的，
   *    卡组越强的档位反而需要的攻击力越小，于是解出了「较强 攻 128 / 首领 攻 25」。
   *    现在攻击力 = 该章基准 × 档位系数（0.88 / 1.0 / 1.06 / 1.14），基准只对准「较强」档的压力。
   * ② **档位之间的真实强度差由卡组与血量承担**，不再靠攻击力。
   *    把三档攻击力钉成同一个数实测（第 6 章）：每回合打掉玩家
   *    杂兵 5.5% / 较强 7.8% / 精英 9.3% / 首领 14.6% —— 卡组本身就是逐档变强的
   *    （招式包分 kit_xxx 与 kit_xxx_hi 两档，首领还有专属招式）。
   *
   * 血量与攻击力都由 tools/derive-enemy-curve.mjs 逐格实测反推（可用 --write 写回本文件），
   * 推导时就带着上面这两条约束，写文件前还会再校验一遍顺序。
   */
  enemyHp: {
    mob: [42, 123, 168, 239, 308, 335],
    normal: [51, 149, 223, 314, 439, 524],
    elite: [46, 186, 301, 349, 546, 580],
    boss: [49, 181, 379, 417, 608, 756],
  },
  enemyAtk: {
    mob: [10, 19, 27, 40, 46, 55],
    normal: [11, 22, 31, 45, 52, 62],
    elite: [12, 23, 32, 48, 55, 66],
    boss: [13, 25, 35, 51, 60, 71],
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
  healAfterBattlePct: 0.06,   // 6 章一趟很长，每场战斗后多回一点，让玩家有机会看到后面的地图
  fullHealAfterBoss: true, // 打完首领完全恢复，准备下一章
  restHealPct: 0.30,
  cardRewardChance: 0.7,
  /**
   * 道具掉落（用户要的第三条：敌人掉落，概率低，按属性加权）。
   *
   * `potionDropChance`（0.68，旧背包制「打赢大概率掉药」）已经删掉 —— 那一版药水能带进战斗嗑，
   * 现在的「使用道具」**只能在战斗外用**，掉落太频繁就等于白送续航。
   * 这里的数字是「打赢之后掉一件道具」的概率，按敌人档位分：
   * 普通怪很少掉，首领几乎每次都给点什么。
   */
  itemDropChance: { mob: 0.1, normal: 0.12, elite: 0.26, boss: 0.45 },
  /** 掉落的道具里，**这件敌人的属性**对应的那些权重 ×这么多（其余属性权重 1） */
  itemDropTypeWeight: 4,

  // ---- 玩家最少出战的卡牌数 ----
  minBattleDeck: 2,
  maxBattleDeck: 14,   // 卡池变大了（79 张），出战上限也跟着放宽一点，让玩家带得进「解场牌」

  // ---- 每个阶段结束后的收获 ----
  stageClearGold: [30, 55, 90, 130, 175, 225],

  // 走到首领节点时会先在这里恢复一点生命，避免「满血才能打首领」
  preBossHealPct: 0.35,
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
    "slots": [
      0
    ],
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
    "slots": [
      1
    ],
    "desc": "层层叠叠的红色岩壁，风在里面吹口哨。",
    "sky": [
      "#1d1420",
      "#5a2a28",
      "#c2553c"
    ],
    "ground": "#6d3123",
    "accent": "#ff8a5c",
    "shape": {
      "desc": "精英偏多，硬碰硬的图",
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
    "slots": [
      2
    ],
    "desc": "沙的尽头是一堵树墙。阳光被叶子切成碎片，落在地上还在动。",
    "sky": [
      "#0f1c14",
      "#1f4028",
      "#4e8a4a"
    ],
    "ground": "#2f4a2a",
    "accent": "#8ddc6a",
    "shape": {
      "desc": "怪事多，事件与宝箱偏多",
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
    "slots": [
      3
    ],
    "desc": "沙下面全是水。退潮时露出一片白得刺眼的盐壳，涨潮时整片地都在呼吸。",
    "sky": [
      "#0d1c33",
      "#1d4a68",
      "#5fb0c8"
    ],
    "ground": "#245363",
    "accent": "#7fe6ff",
    "shape": {
      "desc": "补给多（商店 / 宝箱），适合调整卡组",
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
    "slots": [
      4
    ],
    "desc": "风在这里被切成一把把刀。岩壁上全是它刻出来的沟，深得能塞进一个人。",
    "sky": [
      "#181822",
      "#3c3a4e",
      "#8a8aa8"
    ],
    "ground": "#4a4658",
    "accent": "#cfd6ff",
    "shape": {
      "desc": "战斗与精英最多，一路打上去",
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
    "slots": [
      5
    ],
    "desc": "星尘落进沙里，埋在下面的东西开始翻身。",
    "sky": [
      "#0d1030",
      "#241a4a",
      "#4a3a7a"
    ],
    "ground": "#2c2447",
    "accent": "#a98cff",
    "shape": {
      "desc": "终章：长、难、几乎没有商店",
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
  },
  "ruins": {
    "key": "ruins",
    "name": "沉沙遗迹",
    "slots": [
      1,
      2
    ],
    "desc": "半截石柱从沙里支出来，上面刻着谁也不认识的图。风穿过柱廊的时候，声音像有人在数数。",
    "sky": [
      "#15120d",
      "#3a3128",
      "#9c8a5e"
    ],
    "ground": "#55483a",
    "accent": "#e8d9a0",
    "bgm": "canyon",
    "shape": {
      "desc": "遗迹：事件多、精英中量，柱子后面常有东西",
      "rows": 9,
      "nodeWeights": {
        "battle": 46,
        "elite": 14,
        "event": 20,
        "chest": 14,
        "shop": 6
      },
      "guarantee": {
        "chest": 2,
        "shop": 1,
        "rest": 1
      }
    }
  },
  "fungal": {
    "key": "fungal",
    "name": "菌菇湿地",
    "slots": [
      2,
      3
    ],
    "desc": "树干下半截全被菌盖住了。脚一踩，孢子像雪一样扬起来，落回肩上还在发光。",
    "sky": [
      "#141a10",
      "#2e3a1e",
      "#7a8a4a"
    ],
    "ground": "#3a4426",
    "accent": "#c8ff8a",
    "bgm": "forest",
    "shape": {
      "desc": "菌林：事件与宝箱最多，路上怪事不断",
      "rows": 10,
      "nodeWeights": {
        "battle": 40,
        "elite": 8,
        "event": 30,
        "chest": 16,
        "shop": 6
      },
      "guarantee": {
        "chest": 2,
        "shop": 1,
        "rest": 1
      }
    }
  },
  "storm": {
    "key": "storm",
    "name": "雷暴台地",
    "slots": [
      3,
      4
    ],
    "desc": "云压得比岩壁还低。每走几步，头顶就亮一下，然后是很久的雷声。",
    "sky": [
      "#0a0e1c",
      "#232a52",
      "#6a7fd0"
    ],
    "ground": "#2e3a5e",
    "accent": "#ffe066",
    "bgm": "cliff",
    "shape": {
      "desc": "雷台：战斗与精英最多，一路打上去",
      "rows": 10,
      "nodeWeights": {
        "battle": 52,
        "elite": 18,
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
  "crystal": {
    "key": "crystal",
    "name": "水晶洞窟",
    "slots": [
      1,
      2,
      3,
      4
    ],
    "desc": "洞顶垂下来的全是水晶，亮得不用点火把。你走一步，整片洞壁就跟着亮一下 —— 像它在看你。",
    "sky": [
      "#0b1018",
      "#243a5e",
      "#7fd8e8"
    ],
    "ground": "#2a4a5e",
    "accent": "#a8f0ff",
    "bgm": "night",
    "shape": {
      "desc": "洞窟：宝箱最多（水晶里常嵌着东西），战斗也不少",
      "rows": 10,
      "nodeWeights": {
        "battle": 50,
        "elite": 12,
        "event": 14,
        "chest": 18,
        "shop": 6
      },
      "guarantee": {
        "chest": 3,
        "shop": 1,
        "rest": 1
      }
    }
  }
};

/** 每张地图能出现在第几章（0-based）。中间几章从这里随机抽，首章 / 终章固定 —— 见 game.newRun() */
export const BIOME_SLOTS = {
  "desert": [
    0
  ],
  "canyon": [
    1
  ],
  "forest": [
    2
  ],
  "tide": [
    3
  ],
  "cliff": [
    4
  ],
  "night": [
    5
  ],
  "ruins": [
    1,
    2
  ],
  "fungal": [
    2,
    3
  ],
  "storm": [
    3,
    4
  ],
  "crystal": [
    1,
    2,
    3,
    4
  ]
};

/** 新地图借用的 BGM（没写就用通用曲） */
export const BIOME_BGM = {
  "ruins": "canyon",
  "fungal": "forest",
  "storm": "cliff",
  "crystal": "night"
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

/** 战斗奖励的稀有度权重，按敌人档位分（普通怪 / 精英 / 首领）—— 见 content/rarity.json */
export const REWARD_WEIGHTS = {
  "normal": {
    "common": 100,
    "uncommon": 55,
    "rare": 26,
    "epic": 9
  },
  "elite": {
    "common": 70,
    "uncommon": 55,
    "rare": 40,
    "epic": 18
  },
  "boss": {
    "common": 40,
    "uncommon": 50,
    "rare": 55,
    "epic": 38
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
