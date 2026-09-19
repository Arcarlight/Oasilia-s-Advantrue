// 卡牌数据。
//
// 【数据本体不在这里】—— CARDS / CARD_ART / STARTER_DECK / ITEMS 全部由
// content/cards.json 生成（见下面的 GENERATED 区块）。要加卡牌就改那个 JSON，
// 然后跑 `node tools/build-content.mjs`，别手改生成区块。
//
// 每张卡由「效果数组」声明，战斗引擎负责解释执行，好处是 AI 也能用同一套卡。
//
// 效果种类（kind）：
//   damage    {power, hits?, ignoreDefPct?, execThreshold?, execBonus?, recoilPct?, drainPct?,
//              bonusPerStack?{status,per,max}, bonusIfDot?, plusShield?}
//   shield    {amount, scaleWithDef?, keep?}   —— 获得护盾，先于 HP 承受伤害（keep=下回合不清空）
//   heal      {amount, pct?}                   —— 回复 HP（pct 为最大生命百分比 0~1）
//   draw      {n}                              —— 抽 n 张
//   ap        {n}                              —— 立刻回复 n 点 AP
//   apBonus   {n}                              —— **下回合**额外 n 点 AP
//   plays     {n}                              —— 本回合多出 n 次出牌机会
//   strength  {n}                              —— 本场战斗每一次攻击威力 +n%
//   detonate  {perStack}                       —— 引爆对手身上的中毒/剧毒/灼伤层数（立刻结算并清空）
//   buff      {stat:'atk'|'def'|'agi'|'luck', amount | pct, target?}
//   status    {status:'poison'|'toxic'|'burn'|'weak'|'bleed', stacks, chance?, target?}
//   selfDmg   {amount | pct, reason?}          —— 自伤（不能低于 1 点 HP）
//   discard   {n}                              —— 弃掉**自己** n 张手牌（代价类，不是弃对手的）
//   exhaustHand                                —— 弃光自己的手牌
//
// 三个数值约定（踩过坑，加卡务必遵守）：
//   · **power 是「攻击力的百分比」**，不是点数：power 110 = 打出 1.1 倍攻击。
//     费用预算：0 费 25~45% / 1 费 95~140% / 2 费 200~260% / 3 费 310~420% / 4 费 430~560%。
//     多段伤害的 power 是**每段**威力（{power:45, hits:3} = 3 次，每次按 45% 攻击算）。
//     为什么改成乘法：见 battle.js 的 computeHit —— 加法版本下攻击长到 50+ 之后
//     0 费牌和 3 费牌打出来差不多疼（玩家实测「高费卡不如低费连打」）。
//   · buff / status 默认作用在**自己**身上，要打到对手必须写 target: 'enemy'。
//   · pct 类削弱（-0.3 = 削 30% 基础值）后期永远有效，固定值会被「削弱下限」卡住。

import { RARITY } from './balance.js';

// #region GENERATED-CARDS
export const CARDS = [
  {
    "id": "tackle",
    "name": "撞击",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "fist",
    "text": "造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 25
      }
    ]
  },
  {
    "id": "sand_attack",
    "name": "泼沙",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "dirt_1",
    "text": "造成 {d} 点伤害，并让对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 25
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ]
  },
  {
    "id": "bite",
    "name": "咬住",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 105
      }
    ]
  },
  {
    "id": "quick_attack",
    "name": "电光一闪",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "spark_1",
    "text": "造成 {d} 点伤害，抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 25
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "rock_throw",
    "name": "落石",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "dirt_2",
    "text": "造成 {d} 点伤害，并使对手防御 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 105
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -2,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "focus_energy",
    "name": "聚气",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "art": "magic_1",
    "text": "本场战斗攻击 +4。抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 4
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "harden",
    "name": "变硬",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "art": "shield",
    "text": "获得护盾（随防御成长，约 9 + 防御×0.75）。",
    "effects": [
      {
        "kind": "shield",
        "amount": 9,
        "scaleWithDef": true
      }
    ]
  },
  {
    "id": "double_kick",
    "name": "二连踢",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "fist",
    "text": "连续 2 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 55,
        "hits": 2
      }
    ]
  },
  {
    "id": "potion_berry",
    "name": "文柚果",
    "ap": 0,
    "rarity": "common",
    "targeting": "self",
    "art": "flask_half",
    "text": "回复 22 点 HP。",
    "effects": [
      {
        "kind": "heal",
        "amount": 22
      }
    ]
  },
  {
    "id": "dragon_breath",
    "name": "龙息",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "flare_1",
    "text": "造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 220
      }
    ]
  },
  {
    "id": "rock_slide",
    "name": "岩崩",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "dirt_2",
    "text": "造成 {d} 点伤害，40% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 210
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.4
      }
    ]
  },
  {
    "id": "bug_buzz",
    "name": "虫鸣",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "magic_2",
    "text": "抽 2 张。",
    "effects": [
      {
        "kind": "draw",
        "n": 2
      }
    ]
  },
  {
    "id": "roost",
    "name": "羽栖",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "flask_full",
    "text": "回复最大生命的 22%。",
    "effects": [
      {
        "kind": "heal",
        "pct": 0.22
      }
    ]
  },
  {
    "id": "dragon_dance",
    "name": "龙之舞",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "star_1",
    "text": "本场战斗攻击 +3、敏捷 +3。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 3
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 3
      }
    ]
  },
  {
    "id": "screech",
    "name": "刺耳声",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "ui_glitch",
    "text": "对手防御 -5，本场战斗有效。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": -5,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "iron_defense",
    "name": "铁壁",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "shield",
    "text": "获得护盾（随防御成长），本场战斗防御 +3。",
    "effects": [
      {
        "kind": "shield",
        "amount": 13,
        "scaleWithDef": true
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 3
      }
    ]
  },
  {
    "id": "rock_blast",
    "name": "岩石爆击",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "dirt_1",
    "text": "连续 3 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 80,
        "hits": 3
      }
    ]
  },
  {
    "id": "toxic",
    "name": "剧毒",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "flask_half",
    "text": "给对手 3 层剧毒（每回合流失「最大生命的 0.6% × 层数」，层数不衰减、每回合 +1）。",
    "effects": [
      {
        "kind": "status",
        "status": "toxic",
        "stacks": 3
      }
    ]
  },
  {
    "id": "u_turn",
    "name": "急速折返",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "cards_return",
    "text": "抽 2 张，回复 1 点 AP。",
    "effects": [
      {
        "kind": "draw",
        "n": 2
      },
      {
        "kind": "ap",
        "n": 1
      }
    ]
  },
  {
    "id": "fire_fang",
    "name": "火焰牙",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "flare_1",
    "text": "造成 {d} 点伤害，并给对手 2 层灼伤。",
    "effects": [
      {
        "kind": "damage",
        "power": 205
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 2
      }
    ]
  },
  {
    "id": "crunch",
    "name": "咬碎",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 {d} 点伤害，并使对手防御 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 110
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -2,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "dragon_claw",
    "name": "龙爪",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 {d} 点伤害。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 230
      }
    ]
  },
  {
    "id": "earthquake",
    "name": "地震",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "exploding",
    "text": "造成 {d} 点伤害，并让对手防御 -4。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 230
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -4,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "earth_power",
    "name": "大地之力",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "magic_2",
    "text": "造成 {d} 点伤害，无视对手 50% 防御。",
    "effects": [
      {
        "kind": "damage",
        "power": 100,
        "ignoreDefPct": 0.5
      }
    ]
  },
  {
    "id": "boomburst",
    "name": "爆音波",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "exploding",
    "text": "造成 {d} 点伤害。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 380
      }
    ]
  },
  {
    "id": "outrage",
    "name": "逆鳞",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "flare_1",
    "text": "造成 {d} 点伤害，自身受到 6 点反伤。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 235,
        "recoilPct": 0.2
      }
    ]
  },
  {
    "id": "dragon_rush",
    "name": "龙之俯冲",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "spark_1",
    "text": "造成 {d} 点伤害；若对手 HP 低于 40%，改为造成 {d2} 点。",
    "effects": [
      {
        "kind": "damage",
        "power": 225,
        "execThreshold": 0.4,
        "execBonus": 115
      }
    ]
  },
  {
    "id": "heat_wave",
    "name": "热风",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "flare_1",
    "text": "造成 {d} 点伤害，并给对手 3 层灼伤。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 220
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 3
      }
    ]
  },
  {
    "id": "bulk_up",
    "name": "健美",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "art": "fist",
    "text": "本场战斗攻击 +4、防御 +3。抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 4
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 3
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "sandstorm",
    "name": "沙暴",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "art": "smoke_1",
    "text": "本场战斗防御 +4、幸运 +3。抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": 4
      },
      {
        "kind": "buff",
        "stat": "luck",
        "amount": 3
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "protect",
    "name": "守住",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "art": "shield",
    "text": "获得大量护盾（随防御成长）。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "shield",
        "amount": 18,
        "scaleWithDef": true
      }
    ]
  },
  {
    "id": "draco_meteor",
    "name": "流星群",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "star_1",
    "text": "造成 {d} 点伤害，本场战斗攻击 -8。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 420
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -8
      }
    ]
  },
  {
    "id": "fissure",
    "name": "地裂",
    "ap": 2,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "exploding",
    "text": "造成 {d} 点伤害，无视对手全部防御。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 180,
        "ignoreDefPct": 1
      }
    ]
  },
  {
    "id": "superpower",
    "name": "蛮力",
    "ap": 2,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "fist",
    "text": "造成 {d} 点伤害，本场战斗攻击 -3、防御 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 250
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -3
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3
      }
    ]
  },
  {
    "id": "first_aid",
    "name": "急救",
    "ap": 0,
    "rarity": "epic",
    "targeting": "self",
    "art": "flask_full",
    "text": "回复最大生命的 16%，并抽 1 张。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "heal",
        "pct": 0.16
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "endure",
    "name": "挺住",
    "ap": 0,
    "rarity": "epic",
    "targeting": "self",
    "art": "shield",
    "text": "获得护盾（随防御成长），回复 3 点 AP。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "shield",
        "amount": 8,
        "scaleWithDef": true
      },
      {
        "kind": "ap",
        "n": 3
      }
    ]
  },
  {
    "id": "dragon_darts",
    "name": "龙箭",
    "ap": 1,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "spark_1",
    "text": "连续 4 次造成 {d} 点伤害。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 40,
        "hits": 4
      }
    ]
  },
  {
    "id": "absorb",
    "name": "吸取",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 {d} 点伤害，回复 5 点 HP。",
    "effects": [
      {
        "kind": "damage",
        "power": 105,
        "drainPct": 0.5
      }
    ]
  },
  {
    "id": "twineedle",
    "name": "双针",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "连续 2 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 50,
        "hits": 2
      }
    ]
  },
  {
    "id": "poison_sting",
    "name": "毒针",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "flask_half",
    "text": "造成 {d} 点伤害，并给对手 1 层中毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 105
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 1
      }
    ]
  },
  {
    "id": "fury_cutter",
    "name": "连切",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "连续 3 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 40,
        "hits": 3
      }
    ]
  },
  {
    "id": "silver_wind",
    "name": "银色旋风",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "magic_2",
    "text": "造成 {d} 点伤害，并抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 105
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "spider_web",
    "name": "蛛网",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "trace_1",
    "text": "造成 {d} 点伤害，并让对手敏捷 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 25
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "razor_leaf",
    "name": "飞叶快刀",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "连续 2 次造成 {d} 点伤害，并抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 115,
        "hits": 2
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "spore",
    "name": "蘑菇孢子",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "smoke_1",
    "text": "给对手 1 层中毒和 1 层虚弱。",
    "effects": [
      {
        "kind": "status",
        "status": "poison",
        "stacks": 1
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ]
  },
  {
    "id": "quiver_dance",
    "name": "蝶舞",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "twirl_1",
    "text": "本场战斗攻击 +3、敏捷 +3、幸运 +3。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 3
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 3
      },
      {
        "kind": "buff",
        "stat": "luck",
        "amount": 3
      }
    ]
  },
  {
    "id": "leech_seed",
    "name": "寄生种子",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "magic_2",
    "text": "给对手 1 层中毒，并回复 8 点 HP。",
    "effects": [
      {
        "kind": "status",
        "status": "poison",
        "stacks": 1
      },
      {
        "kind": "heal",
        "amount": 8
      }
    ]
  },
  {
    "id": "giga_drain",
    "name": "终极吸取",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 {d} 点伤害，回复所造成伤害的一半。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 200,
        "drainPct": 0.5
      }
    ]
  },
  {
    "id": "u_turn_dance",
    "name": "虫之抵抗",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 {d} 点伤害，并让对手攻击 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 105
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -3,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "water_pulse",
    "name": "水之波动",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 {d} 点伤害，并让对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 205
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ]
  },
  {
    "id": "aqua_ring",
    "name": "水流环",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "magic_2",
    "text": "回复最大生命的 20%，并获得护盾（随防御成长）。",
    "effects": [
      {
        "kind": "heal",
        "pct": 0.2
      },
      {
        "kind": "shield",
        "amount": 6,
        "scaleWithDef": true
      }
    ]
  },
  {
    "id": "life_dew",
    "name": "生命水滴",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "flask_full",
    "text": "回复 22 点 HP，并回复 1 点 AP。",
    "effects": [
      {
        "kind": "heal",
        "amount": 22
      },
      {
        "kind": "ap",
        "n": 1
      }
    ]
  },
  {
    "id": "withdraw",
    "name": "缩入壳中",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "shield",
    "text": "获得护盾（随防御成长，约 13 + 防御×0.75），并抽 1 张。",
    "effects": [
      {
        "kind": "shield",
        "amount": 13,
        "scaleWithDef": true
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "brine",
    "name": "盐水",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "flask_half",
    "text": "造成 {d} 点伤害；若对手 HP 低于 40%，改为造成 {d2} 点。",
    "effects": [
      {
        "kind": "damage",
        "power": 200,
        "execThreshold": 0.4,
        "execBonus": 100
      }
    ]
  },
  {
    "id": "bulldoze",
    "name": "重踏",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "dirt_1",
    "text": "造成 {d} 点伤害，并让对手敏捷 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 200
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "rolling_kick",
    "name": "滚动",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "dirt_2",
    "text": "连续 2 次造成 {d} 点伤害，并让对手防御 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 50,
        "hits": 2
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -2,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "tailwind",
    "name": "顺风",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "twirl_1",
    "text": "本场战斗敏捷 +3，回复 1 点 AP。",
    "effects": [
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 3
      },
      {
        "kind": "ap",
        "n": 1
      }
    ]
  },
  {
    "id": "safeguard",
    "name": "神秘守护",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "shield",
    "text": "本场战斗防御 +4，获得护盾（随防御成长）。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": 4
      },
      {
        "kind": "shield",
        "amount": 10,
        "scaleWithDef": true
      }
    ]
  },
  {
    "id": "super_luck",
    "name": "幸运咒语",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "star_1",
    "text": "本场战斗幸运 +4，抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "luck",
        "amount": 4
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "leaf_storm",
    "name": "飞叶风暴",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "连续 4 次造成 {d} 点伤害，本场战斗攻击 -5。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 105,
        "hits": 4
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -5
      }
    ]
  },
  {
    "id": "rest",
    "name": "睡觉",
    "ap": 3,
    "rarity": "epic",
    "targeting": "self",
    "art": "flask_full",
    "text": "回复最大生命的 50%，并抽 2 张。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "heal",
        "pct": 0.5
      },
      {
        "kind": "draw",
        "n": 2
      }
    ]
  },
  {
    "id": "sludge_bomb",
    "name": "污泥炸弹",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "flask_half",
    "text": "造成 {d} 点伤害，并给对手 3 层中毒，无视对手一半防御。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 290,
        "ignoreDefPct": 0.5
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 3
      }
    ]
  },
  {
    "id": "salt_cure",
    "name": "盐腌",
    "ap": 2,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "flask_half",
    "text": "给对手 2 层中毒和 2 层虚弱，并让对手防御 -4。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "status",
        "status": "poison",
        "stacks": 2
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 2
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -4,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "stone_edge",
    "name": "尖石攻击",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "dirt_2",
    "text": "造成 {d} 点伤害，并让对手防御 -5。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 385
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -5,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "surf",
    "name": "冲浪",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 {d} 点伤害，并让对手获得 1 层虚弱。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 345
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ]
  },
  {
    "id": "whirlpool",
    "name": "潮旋",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "twirl_1",
    "text": "连续 3 次造成 {d} 点伤害，并让对手攻击 -3。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 115,
        "hits": 3
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -3,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "knock_off",
    "name": "拍落",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 {d} 点伤害，并让对手攻击 -4、防御 -3。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 115
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -4,
        "target": "enemy"
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "exhaust": true
  },
  {
    "id": "double_edge",
    "name": "舍身冲撞",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "exploding",
    "text": "造成 {d} 点伤害，自身受到 8 点反伤。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 260,
        "recoilPct": 0.2
      }
    ]
  },
  {
    "id": "giga_impact",
    "name": "终极冲击",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "exploding",
    "text": "造成 {d} 点伤害，自身受到 5 点反伤。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 380,
        "recoilPct": 0.1
      }
    ]
  },
  {
    "id": "dragon_tail",
    "name": "龙尾",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 {d} 点伤害，并让对手防御 -4。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 230
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -4,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "swords_dance",
    "name": "剑舞",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "art": "sword",
    "text": "本场战斗攻击 +6。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 6
      }
    ]
  },
  {
    "id": "calm_mind",
    "name": "冥想",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "art": "magic_1",
    "text": "本场战斗攻击 +4、幸运 +3。抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 4
      },
      {
        "kind": "buff",
        "stat": "luck",
        "amount": 3
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "agility",
    "name": "高速移动",
    "ap": 2,
    "rarity": "rare",
    "targeting": "self",
    "art": "spark_1",
    "text": "本场战斗敏捷 +5，抽 1 张，回复 1 点 AP。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 5
      },
      {
        "kind": "draw",
        "n": 1
      },
      {
        "kind": "ap",
        "n": 1
      }
    ]
  },
  {
    "id": "bullet_punch",
    "name": "子弹拳",
    "ap": 0,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "fist",
    "text": "造成 {d} 点伤害，抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 45
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "focus_punch",
    "name": "真气拳",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "fist",
    "text": "造成 {d} 点伤害，本场战斗敏捷 -3。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 250
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3
      }
    ]
  },
  {
    "id": "feather_dance",
    "name": "羽毛舞",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "art": "twirl_1",
    "text": "获得护盾（随防御成长，约 9 + 防御×0.75），并让对手攻击 -3。",
    "effects": [
      {
        "kind": "shield",
        "amount": 9,
        "scaleWithDef": true
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -3,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "acrobatics",
    "name": "杂技",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "twirl_1",
    "text": "连续 3 次造成 {d} 点伤害，并让对手防御 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 75,
        "hits": 3
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "iron_head",
    "name": "铁头",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "shield",
    "text": "造成 {d} 点伤害，无视对手 50% 防御。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 200,
        "ignoreDefPct": 0.5
      }
    ]
  },
  {
    "id": "air_slash",
    "name": "空气利刃",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 {d} 点伤害，无视对手 50% 防御。",
    "effects": [
      {
        "kind": "damage",
        "power": 90,
        "ignoreDefPct": 0.5
      }
    ]
  },
  {
    "id": "mist",
    "name": "白雾",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "smoke_1",
    "text": "清除自己身上所有的属性下降与负面状态，并获得护盾（随防御成长）。",
    "effects": [
      {
        "kind": "cleanse",
        "statuses": true
      },
      {
        "kind": "shield",
        "amount": 10,
        "scaleWithDef": true
      }
    ]
  },
  {
    "id": "refresh",
    "name": "焕然一新",
    "ap": 0,
    "rarity": "rare",
    "targeting": "self",
    "art": "spark_1",
    "text": "清除自己所有的属性下降与负面状态，抽 1 张。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "cleanse",
        "statuses": true
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "mob_scratch",
    "name": "抓挠",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "dirt_1",
    "enemyOnly": true,
    "text": "造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 25
      }
    ]
  },
  {
    "id": "mob_sand",
    "name": "扬沙",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "dirt_2",
    "enemyOnly": true,
    "text": "造成 {d} 点伤害，并让对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 95
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ]
  },
  {
    "id": "mob_guard",
    "name": "缩壳",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "art": "trace_1",
    "enemyOnly": true,
    "text": "获得 5 点护盾。",
    "effects": [
      {
        "kind": "shield",
        "amount": 5
      }
    ]
  },
  {
    "id": "mob_growl",
    "name": "低吼",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "art": "smoke_1",
    "enemyOnly": true,
    "text": "本场战斗攻击 +2。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 2
      }
    ]
  },
  {
    "id": "mob_stare",
    "name": "瞪眼",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "magic_1",
    "enemyOnly": true,
    "text": "让对手防御 -1。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": -1,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "headbutt",
    "name": "头锤",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，30% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 105
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.3
      }
    ]
  },
  {
    "id": "flame_charge",
    "name": "蓄能焰袭",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害。本场战斗敏捷 +2。",
    "effects": [
      {
        "kind": "damage",
        "power": 95
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 2
      }
    ]
  },
  {
    "id": "rock_polish",
    "name": "岩石打磨",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "text": "本场战斗攻击 +2、敏捷 +2。抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 2
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 2
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "defense_curl",
    "name": "变圆",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "text": "获得护盾（随防御成长），本场战斗防御 +2。",
    "effects": [
      {
        "kind": "shield",
        "amount": 8,
        "scaleWithDef": true
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 2
      }
    ]
  },
  {
    "id": "sand_tomb",
    "name": "流沙地狱",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手敏捷 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 95
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "nuzzle",
    "name": "蹭蹭脸颊",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 100
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ]
  },
  {
    "id": "poison_fang",
    "name": "毒牙",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 1 层中毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 95
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 1
      }
    ]
  },
  {
    "id": "tail_whip",
    "name": "摇尾巴",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "让对手防御 -3，抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3,
        "target": "enemy"
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "toxic_spikes",
    "name": "毒菱",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "给对手 2 层中毒（每回合流失「最大生命的 0.8% × 层数」，之后层数 -1）。",
    "effects": [
      {
        "kind": "status",
        "status": "poison",
        "stacks": 2
      }
    ]
  },
  {
    "id": "toxic_thread",
    "name": "毒丝",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "给对手 1 层剧毒和 1 层虚弱。",
    "effects": [
      {
        "kind": "status",
        "status": "toxic",
        "stacks": 1
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ]
  },
  {
    "id": "acid_armor",
    "name": "酸液护甲",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "获得护盾（随防御成长），并给对手 1 层中毒。",
    "effects": [
      {
        "kind": "shield",
        "amount": 10,
        "scaleWithDef": true
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 1
      }
    ]
  },
  {
    "id": "slash",
    "name": "劈开",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层出血。",
    "effects": [
      {
        "kind": "damage",
        "power": 95
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 2
      }
    ]
  },
  {
    "id": "fury_swipes",
    "name": "狂抓",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害，并给对手 1 层出血。",
    "effects": [
      {
        "kind": "damage",
        "power": 50,
        "hits": 2
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 1
      }
    ]
  },
  {
    "id": "bullet_seed",
    "name": "种子机枪",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "连续 4 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 55,
        "hits": 4
      }
    ]
  },
  {
    "id": "scale_shot",
    "name": "鳞射",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "连续 3 次造成 {d} 点伤害。本场战斗防御 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 40,
        "hits": 3
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3
      }
    ]
  },
  {
    "id": "howl",
    "name": "长嚎",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "本场战斗攻击威力 +40%。抽 1 张。",
    "effects": [
      {
        "kind": "strength",
        "n": 40
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "metal_sound",
    "name": "金属音",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "让对手防御 -35%。抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "pct": -0.35,
        "target": "enemy"
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "scary_face",
    "name": "鬼脸",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "让对手敏捷 -35%。",
    "effects": [
      {
        "kind": "buff",
        "stat": "agi",
        "pct": -0.35,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "charm",
    "name": "撒娇",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "让对手攻击 -35%。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "pct": -0.35,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "recycle",
    "name": "回收",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "抽 2 张，回复 1 点 AP。",
    "effects": [
      {
        "kind": "draw",
        "n": 2
      },
      {
        "kind": "ap",
        "n": 1
      }
    ]
  },
  {
    "id": "quick_draw",
    "name": "快速抽牌",
    "ap": 0,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "抽 2 张，本回合多出 1 次出牌机会。",
    "effects": [
      {
        "kind": "draw",
        "n": 2
      },
      {
        "kind": "plays",
        "n": 1
      }
    ]
  },
  {
    "id": "synthesis",
    "name": "光合作用",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "回复最大生命的 25%，本场战斗攻击 +2。",
    "effects": [
      {
        "kind": "heal",
        "pct": 0.25
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 2
      }
    ]
  },
  {
    "id": "iron_barbs",
    "name": "铁刺",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "获得护盾（随防御成长），并给对手 2 层出血。",
    "effects": [
      {
        "kind": "shield",
        "amount": 10,
        "scaleWithDef": true
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 2
      }
    ]
  },
  {
    "id": "sand_veil",
    "name": "沙隐",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "本场战斗幸运 +5，获得护盾（随防御成长）。",
    "effects": [
      {
        "kind": "buff",
        "stat": "luck",
        "amount": 5
      },
      {
        "kind": "shield",
        "amount": 8,
        "scaleWithDef": true
      }
    ]
  },
  {
    "id": "venom_drain",
    "name": "毒液吸取",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，回复所造成伤害的 50%。",
    "effects": [
      {
        "kind": "damage",
        "power": 200,
        "drainPct": 0.5
      }
    ]
  },
  {
    "id": "water_shuriken",
    "name": "水手里剑",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 3 次造成 {d} 点伤害，抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 45,
        "hits": 3
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "triple_axel",
    "name": "三旋击",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 3 次造成 {d} 点伤害，并让对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 80,
        "hits": 3
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ]
  },
  {
    "id": "venoshock",
    "name": "毒液冲击",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害；对手身上有中毒或剧毒时，这一下额外 +90% 威力。",
    "effects": [
      {
        "kind": "damage",
        "power": 200,
        "bonusIfDot": 90
      }
    ]
  },
  {
    "id": "night_slash",
    "name": "暗影爪",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害；对手每有 1 层出血，这一下额外 +20% 威力（最多 +240%）。",
    "effects": [
      {
        "kind": "damage",
        "power": 200,
        "bonusPerStack": {
          "status": "bleed",
          "per": 20,
          "max": 240
        }
      }
    ]
  },
  {
    "id": "corrode",
    "name": "腐蚀",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手防御 -30%。",
    "effects": [
      {
        "kind": "damage",
        "power": 210
      },
      {
        "kind": "buff",
        "stat": "def",
        "pct": -0.3,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "crush_grip",
    "name": "硬压",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手防御 -40%。",
    "effects": [
      {
        "kind": "damage",
        "power": 200
      },
      {
        "kind": "buff",
        "stat": "def",
        "pct": -0.4,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "drain_punch",
    "name": "吸取拳",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，回复所造成伤害的 75%。",
    "effects": [
      {
        "kind": "damage",
        "power": 210,
        "drainPct": 0.75
      }
    ]
  },
  {
    "id": "leech_life",
    "name": "吸血",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，回复所造成伤害的 60%，并给对手 1 层中毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 200,
        "drainPct": 0.6
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 1
      }
    ]
  },
  {
    "id": "moonlight",
    "name": "月光",
    "ap": 2,
    "rarity": "rare",
    "targeting": "self",
    "text": "回复最大生命的 30%，并清除自身所有负面。",
    "effects": [
      {
        "kind": "heal",
        "pct": 0.3
      },
      {
        "kind": "cleanse",
        "statuses": true
      }
    ]
  },
  {
    "id": "cotton_guard",
    "name": "棉花防守",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "text": "本场战斗防御 +8。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": 8
      }
    ]
  },
  {
    "id": "body_press",
    "name": "重磅冲撞",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，威力随你当前的护盾提升 —— 护盾越厚打得越疼。",
    "effects": [
      {
        "kind": "damage",
        "power": 180,
        "plusShield": 1.2
      }
    ]
  },
  {
    "id": "wide_guard",
    "name": "广域防守",
    "ap": 2,
    "rarity": "rare",
    "targeting": "self",
    "text": "获得护盾（随防御成长），这一份护盾下回合不会消失。",
    "effects": [
      {
        "kind": "shield",
        "amount": 14,
        "scaleWithDef": true,
        "keep": true
      }
    ]
  },
  {
    "id": "mind_reader",
    "name": "读心",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "text": "抽 3 张，本回合多出 2 次出牌机会。",
    "effects": [
      {
        "kind": "draw",
        "n": 3
      },
      {
        "kind": "plays",
        "n": 2
      }
    ]
  },
  {
    "id": "blood_price",
    "name": "血祭",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "text": "自身失去最大生命 10% 的 HP，本场战斗攻击威力 +80%。使用后销毁。",
    "effects": [
      {
        "kind": "selfDmg",
        "pct": 0.1,
        "reason": "血祭"
      },
      {
        "kind": "strength",
        "n": 80
      }
    ],
    "exhaust": true
  },
  {
    "id": "overclock",
    "name": "超频",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "text": "回复 3 点 AP，本回合多出 1 次出牌机会。使用后销毁。",
    "effects": [
      {
        "kind": "ap",
        "n": 3
      },
      {
        "kind": "plays",
        "n": 1
      }
    ],
    "exhaust": true
  },
  {
    "id": "storm_throw",
    "name": "狂风投掷",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害，并让对手敏捷 -4。",
    "effects": [
      {
        "kind": "damage",
        "power": 120,
        "hits": 2
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -4,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "frost_breath",
    "name": "冰冻之风",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手敏捷 -30%。",
    "effects": [
      {
        "kind": "damage",
        "power": 110
      },
      {
        "kind": "buff",
        "stat": "agi",
        "pct": -0.3,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "hyper_beam",
    "name": "破坏死光",
    "ap": 4,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 520
      }
    ],
    "exhaust": true
  },
  {
    "id": "dynamax_cannon",
    "name": "极巨炮",
    "ap": 4,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，无视对手 50% 防御。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 450,
        "ignoreDefPct": 0.5
      }
    ],
    "exhaust": true
  },
  {
    "id": "solar_beam",
    "name": "日光束",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 205,
        "hits": 2
      }
    ],
    "exhaust": true
  },
  {
    "id": "megahorn",
    "name": "超级角击",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层出血。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 380
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 2
      }
    ],
    "exhaust": true
  },
  {
    "id": "doom_desire",
    "name": "破灭之愿",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，无视对手全部防御。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 300,
        "ignoreDefPct": 1
      }
    ],
    "exhaust": true
  },
  {
    "id": "plague",
    "name": "疫病",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "给对手 3 层中毒和 3 层剧毒。使用后销毁。",
    "effects": [
      {
        "kind": "status",
        "status": "poison",
        "stacks": 3
      },
      {
        "kind": "status",
        "status": "toxic",
        "stacks": 3
      }
    ],
    "exhaust": true
  },
  {
    "id": "venom_burst",
    "name": "毒爆",
    "ap": 2,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "引爆对手身上所有中毒 / 剧毒 / 灼伤层数，立刻结算并清空。使用后销毁。",
    "effects": [
      {
        "kind": "detonate",
        "perStack": 3
      }
    ],
    "exhaust": true
  },
  {
    "id": "toxic_overflow",
    "name": "剧毒泛滥",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害；对手每有 1 层中毒或剧毒，额外 +25% 威力（上限 +250%）。销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 300,
        "bonusPerStack": {
          "status": [
            "poison",
            "toxic"
          ],
          "per": 25,
          "max": 250
        }
      }
    ],
    "exhaust": true
  },
  {
    "id": "last_stand",
    "name": "背水一战",
    "ap": 2,
    "rarity": "epic",
    "targeting": "self",
    "text": "本场战斗攻击威力 +150%，防御 -8。使用后销毁。",
    "effects": [
      {
        "kind": "strength",
        "n": 150
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -8
      }
    ],
    "exhaust": true
  },
  {
    "id": "overheat",
    "name": "过热",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，本场战斗攻击威力 +120%。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 330
      },
      {
        "kind": "strength",
        "n": 120
      }
    ],
    "exhaust": true
  },
  {
    "id": "guardian_oath",
    "name": "守护誓约",
    "ap": 2,
    "rarity": "epic",
    "targeting": "self",
    "text": "获得大量护盾（随防御成长），本场防御 +6，并清除自身负面。使用后销毁。",
    "effects": [
      {
        "kind": "shield",
        "amount": 20,
        "scaleWithDef": true
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 6
      },
      {
        "kind": "cleanse",
        "statuses": true
      }
    ],
    "exhaust": true
  },
  {
    "id": "life_spring",
    "name": "生命之泉",
    "ap": 2,
    "rarity": "epic",
    "targeting": "self",
    "text": "回复最大生命的 45%，并回复 2 点 AP。使用后销毁。",
    "effects": [
      {
        "kind": "heal",
        "pct": 0.45
      },
      {
        "kind": "ap",
        "n": 2
      }
    ],
    "exhaust": true
  },
  {
    "id": "dragon_ascension",
    "name": "龙之升华",
    "ap": 3,
    "rarity": "epic",
    "targeting": "self",
    "text": "本场战斗攻击 +8、敏捷 +4、幸运 +6，抽 2 张。使用后销毁。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 8
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 4
      },
      {
        "kind": "buff",
        "stat": "luck",
        "amount": 6
      },
      {
        "kind": "draw",
        "n": 2
      }
    ],
    "exhaust": true
  },
  {
    "id": "sig_sand_fang",
    "name": "流沙獠牙",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害。本场战斗防御 +5。",
    "effects": [
      {
        "kind": "damage",
        "power": 240
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 5
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "tyranitar"
  },
  {
    "id": "sig_dual_chomp",
    "name": "烈咬突袭",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害，并给对手 1 层出血。",
    "effects": [
      {
        "kind": "damage",
        "power": 135,
        "hits": 2
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 1
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "garchomp"
  },
  {
    "id": "sig_meteor_mash",
    "name": "彗星拳",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害。本场战斗攻击 +4。",
    "effects": [
      {
        "kind": "damage",
        "power": 260
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 4
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "metagross"
  },
  {
    "id": "sig_land_wrath",
    "name": "大地神力",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手敏捷 -4。",
    "effects": [
      {
        "kind": "damage",
        "power": 320
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -4,
        "target": "enemy"
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "zygarde"
  },
  {
    "id": "sig_leaf_blade",
    "name": "叶刃",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层出血。",
    "effects": [
      {
        "kind": "damage",
        "power": 250
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 2
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "sceptile"
  },
  {
    "id": "sig_origin_pulse",
    "name": "根源波动",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层剧毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 240
      },
      {
        "kind": "status",
        "status": "toxic",
        "stacks": 2
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "kyogre"
  },
  {
    "id": "sig_heavy_slam",
    "name": "重锤坠落",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手防御 -30%。",
    "effects": [
      {
        "kind": "damage",
        "power": 280
      },
      {
        "kind": "buff",
        "stat": "def",
        "pct": -0.3,
        "target": "enemy"
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "aggron"
  },
  {
    "id": "sig_iron_tail_wall",
    "name": "铁尾壁垒",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并获得护盾（随防御成长）。",
    "effects": [
      {
        "kind": "damage",
        "power": 210
      },
      {
        "kind": "shield",
        "amount": 10,
        "scaleWithDef": true
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "steelix"
  },
  {
    "id": "sig_rage_wave",
    "name": "暴怒巨浪",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害。本场战斗攻击 +3。",
    "effects": [
      {
        "kind": "damage",
        "power": 220
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 3
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "gyarados"
  },
  {
    "id": "sig_sand_pit",
    "name": "流沙陷坑",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手敏捷 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 230
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "sig_ancient_beam",
    "name": "古代射线",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手防御 -30%。",
    "effects": [
      {
        "kind": "damage",
        "power": 220
      },
      {
        "kind": "buff",
        "stat": "def",
        "pct": -0.3,
        "target": "enemy"
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "sig_magma_erupt",
    "name": "熔岩喷发",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害，并给对手 2 层灼伤。",
    "effects": [
      {
        "kind": "damage",
        "power": 140,
        "hits": 2
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 2
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "sig_white_smoke",
    "name": "白烟",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "获得护盾（随防御成长），并给对手 2 层灼伤。",
    "effects": [
      {
        "kind": "shield",
        "amount": 12,
        "scaleWithDef": true
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 2
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "sig_bullet_slash",
    "name": "子弹斩",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 3 次造成 {d} 点伤害。本场战斗攻击 +3。",
    "effects": [
      {
        "kind": "damage",
        "power": 90,
        "hits": 3
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 3
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "sig_megahorn_charge",
    "name": "巨角突击",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层中毒和 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 230
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 2
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "sig_dragon_water",
    "name": "龙水炮",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层剧毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 300
      },
      {
        "kind": "status",
        "status": "toxic",
        "stacks": 2
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "sig_tide_ride",
    "name": "乘浪滑翔",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "获得护盾（随防御成长），抽 1 张。",
    "effects": [
      {
        "kind": "shield",
        "amount": 14,
        "scaleWithDef": true
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "sig_brave_bird",
    "name": "勇鸟猛攻",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，自身也受到一部分反冲。",
    "effects": [
      {
        "kind": "damage",
        "power": 330,
        "recoilPct": 0.2
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "sig_rock_slide_wing",
    "name": "岩翼俯冲",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手防御 -4。",
    "effects": [
      {
        "kind": "damage",
        "power": 240
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -4,
        "target": "enemy"
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "sig_soul_flame",
    "name": "魂之火",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层灼伤和 1 层剧毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 240
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 2
      },
      {
        "kind": "status",
        "status": "toxic",
        "stacks": 1
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "sig_curse_mummy",
    "name": "诅咒棺",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "给对手 3 层中毒，并让对手攻击 -35%。",
    "effects": [
      {
        "kind": "status",
        "status": "poison",
        "stacks": 3
      },
      {
        "kind": "buff",
        "stat": "atk",
        "pct": -0.35,
        "target": "enemy"
      }
    ],
    "enemyOnly": true
  }
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** 卡面美术：图标 mask 类名 + 背景特效图（写在 content/cards.json 的 ico / fx 字段里） */
export const CARD_ART = {
  "tackle": {
    "ico": "ico-fist",
    "fx": "dirt_1"
  },
  "sand_attack": {
    "ico": "ico-target",
    "fx": "dirt_2"
  },
  "bite": {
    "ico": "ico-dagger",
    "fx": "slash_1"
  },
  "quick_attack": {
    "ico": "ico-lightning",
    "fx": "spark_1"
  },
  "rock_throw": {
    "ico": "ico-stone",
    "fx": "dirt_1"
  },
  "focus_energy": {
    "ico": "ico-temperature_up",
    "fx": "magic_1"
  },
  "harden": {
    "ico": "ico-shield",
    "fx": "trace_1"
  },
  "double_kick": {
    "ico": "ico-double",
    "fx": "slash_1"
  },
  "potion_berry": {
    "ico": "ico-pill",
    "fx": "spark_1"
  },
  "dragon_breath": {
    "ico": "ico-volcanic_eruption",
    "fx": "flare_1"
  },
  "rock_slide": {
    "ico": "ico-stone",
    "fx": "dirt_2"
  },
  "bug_buzz": {
    "ico": "ico-bug",
    "fx": "magic_2"
  },
  "roost": {
    "ico": "ico-heart",
    "fx": "spark_1"
  },
  "dragon_dance": {
    "ico": "ico-temperature_up",
    "fx": "twirl_1"
  },
  "screech": {
    "ico": "ico-audio_waves",
    "fx": "magic_2"
  },
  "iron_defense": {
    "ico": "ico-shield_02",
    "fx": "trace_1"
  },
  "rock_blast": {
    "ico": "ico-triple",
    "fx": "dirt_1"
  },
  "toxic": {
    "ico": "ico-poison",
    "fx": "magic_1"
  },
  "u_turn": {
    "ico": "ico-change",
    "fx": "trace_1"
  },
  "fire_fang": {
    "ico": "ico-flame",
    "fx": "flare_1"
  },
  "crunch": {
    "ico": "ico-dagger",
    "fx": "slash_1"
  },
  "dragon_claw": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "earthquake": {
    "ico": "ico-earthquake",
    "fx": "dirt_2"
  },
  "earth_power": {
    "ico": "ico-earthquake",
    "fx": "magic_1"
  },
  "boomburst": {
    "ico": "ico-audio_waves",
    "fx": "flare_1"
  },
  "outrage": {
    "ico": "ico-volcanic_eruption",
    "fx": "flare_1"
  },
  "dragon_rush": {
    "ico": "ico-meteor",
    "fx": "spark_1"
  },
  "heat_wave": {
    "ico": "ico-flame",
    "fx": "flare_1"
  },
  "bulk_up": {
    "ico": "ico-temperature_up",
    "fx": "twirl_1"
  },
  "sandstorm": {
    "ico": "ico-wind",
    "fx": "smoke_1"
  },
  "protect": {
    "ico": "ico-protect",
    "fx": "trace_1"
  },
  "draco_meteor": {
    "ico": "ico-meteor",
    "fx": "star_1"
  },
  "fissure": {
    "ico": "ico-earthquake",
    "fx": "dirt_2"
  },
  "superpower": {
    "ico": "ico-mace",
    "fx": "spark_1"
  },
  "first_aid": {
    "ico": "ico-heal",
    "fx": "spark_1"
  },
  "endure": {
    "ico": "ico-action_points",
    "fx": "trace_1"
  },
  "dragon_darts": {
    "ico": "ico-triple",
    "fx": "spark_1"
  },
  "absorb": {
    "ico": "ico-heart_break_02",
    "fx": "magic_1"
  },
  "twineedle": {
    "ico": "ico-spear",
    "fx": "slash_1"
  },
  "poison_sting": {
    "ico": "ico-poison",
    "fx": "magic_1"
  },
  "fury_cutter": {
    "ico": "ico-triple",
    "fx": "slash_1"
  },
  "silver_wind": {
    "ico": "ico-wind",
    "fx": "twirl_1"
  },
  "spider_web": {
    "ico": "ico-fog",
    "fx": "trace_1"
  },
  "razor_leaf": {
    "ico": "ico-leaves",
    "fx": "slash_1"
  },
  "spore": {
    "ico": "ico-poison",
    "fx": "smoke_1"
  },
  "quiver_dance": {
    "ico": "ico-clover",
    "fx": "twirl_1"
  },
  "leech_seed": {
    "ico": "ico-leaves",
    "fx": "magic_2"
  },
  "giga_drain": {
    "ico": "ico-heart_break_02",
    "fx": "magic_1"
  },
  "u_turn_dance": {
    "ico": "ico-battery_negative",
    "fx": "slash_1"
  },
  "water_pulse": {
    "ico": "ico-water",
    "fx": "magic_1"
  },
  "aqua_ring": {
    "ico": "ico-water",
    "fx": "magic_2"
  },
  "life_dew": {
    "ico": "ico-water",
    "fx": "spark_1"
  },
  "withdraw": {
    "ico": "ico-shield_03",
    "fx": "trace_1"
  },
  "brine": {
    "ico": "ico-water",
    "fx": "magic_1"
  },
  "bulldoze": {
    "ico": "ico-temperature_down",
    "fx": "dirt_1"
  },
  "rolling_kick": {
    "ico": "ico-double",
    "fx": "dirt_2"
  },
  "tailwind": {
    "ico": "ico-shoe",
    "fx": "twirl_1"
  },
  "safeguard": {
    "ico": "ico-protect",
    "fx": "trace_1"
  },
  "super_luck": {
    "ico": "ico-clover",
    "fx": "star_1"
  },
  "leaf_storm": {
    "ico": "ico-leaves",
    "fx": "slash_1"
  },
  "rest": {
    "ico": "ico-bed",
    "fx": "light_1"
  },
  "sludge_bomb": {
    "ico": "ico-skull",
    "fx": "smoke_1"
  },
  "salt_cure": {
    "ico": "ico-poison",
    "fx": "dirt_1"
  },
  "stone_edge": {
    "ico": "ico-stone",
    "fx": "dirt_2"
  },
  "surf": {
    "ico": "ico-water",
    "fx": "magic_1"
  },
  "whirlpool": {
    "ico": "ico-triple",
    "fx": "twirl_1"
  },
  "knock_off": {
    "ico": "ico-battery_negative",
    "fx": "slash_1"
  },
  "double_edge": {
    "ico": "ico-counter",
    "fx": "flare_1"
  },
  "giga_impact": {
    "ico": "ico-counter",
    "fx": "dirt_2"
  },
  "dragon_tail": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "swords_dance": {
    "ico": "ico-sword",
    "fx": "twirl_1"
  },
  "calm_mind": {
    "ico": "ico-clover",
    "fx": "magic_1"
  },
  "agility": {
    "ico": "ico-shoe",
    "fx": "spark_1"
  },
  "bullet_punch": {
    "ico": "ico-lightning",
    "fx": "spark_1"
  },
  "focus_punch": {
    "ico": "ico-mace",
    "fx": "smoke_1"
  },
  "feather_dance": {
    "ico": "ico-battery_negative",
    "fx": "twirl_1"
  },
  "acrobatics": {
    "ico": "ico-triple",
    "fx": "twirl_1"
  },
  "iron_head": {
    "ico": "ico-gear",
    "fx": "spark_1"
  },
  "air_slash": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "mist": {
    "ico": "ico-fog",
    "fx": "smoke_1"
  },
  "refresh": {
    "ico": "ico-refresh",
    "fx": "spark_1"
  },
  "mob_scratch": {
    "ico": "ico-fist",
    "fx": "dirt_1"
  },
  "mob_sand": {
    "ico": "ico-fog",
    "fx": "dirt_2"
  },
  "mob_guard": {
    "ico": "ico-shield_03",
    "fx": "trace_1"
  },
  "mob_growl": {
    "ico": "ico-audio_waves",
    "fx": "smoke_1"
  },
  "mob_stare": {
    "ico": "ico-temperature_down",
    "fx": "magic_1"
  },
  "headbutt": {
    "ico": "ico-fist",
    "fx": "dirt_1"
  },
  "flame_charge": {
    "ico": "ico-flame",
    "fx": "flare_1"
  },
  "rock_polish": {
    "ico": "ico-stone",
    "fx": "spark_02"
  },
  "defense_curl": {
    "ico": "ico-shield",
    "fx": "smoke_1"
  },
  "sand_tomb": {
    "ico": "ico-earthquake",
    "fx": "dirt_2"
  },
  "nuzzle": {
    "ico": "ico-lightning",
    "fx": "spark_03"
  },
  "poison_fang": {
    "ico": "ico-poison",
    "fx": "magic_1"
  },
  "tail_whip": {
    "ico": "ico-target",
    "fx": "twirl_1"
  },
  "toxic_spikes": {
    "ico": "ico-poison",
    "fx": "magic_2"
  },
  "toxic_thread": {
    "ico": "ico-bug",
    "fx": "trace_02"
  },
  "acid_armor": {
    "ico": "ico-shield_02",
    "fx": "magic_1"
  },
  "slash": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "fury_swipes": {
    "ico": "ico-fist",
    "fx": "slash_1"
  },
  "bullet_seed": {
    "ico": "ico-leaves",
    "fx": "trace_01"
  },
  "scale_shot": {
    "ico": "ico-dagger",
    "fx": "spark_04"
  },
  "howl": {
    "ico": "ico-wolf",
    "fx": "twirl_02"
  },
  "metal_sound": {
    "ico": "ico-battery_negative",
    "fx": "spark_05"
  },
  "scary_face": {
    "ico": "ico-demon",
    "fx": "smoke_1"
  },
  "charm": {
    "ico": "ico-heart",
    "fx": "twirl_03"
  },
  "recycle": {
    "ico": "ico-refresh",
    "fx": "magic_2"
  },
  "quick_draw": {
    "ico": "ico-cards",
    "fx": "light_1"
  },
  "synthesis": {
    "ico": "ico-leaves",
    "fx": "star_01"
  },
  "iron_barbs": {
    "ico": "ico-shield_03",
    "fx": "spark_06"
  },
  "sand_veil": {
    "ico": "ico-fog",
    "fx": "smoke_1"
  },
  "venom_drain": {
    "ico": "ico-flask",
    "fx": "magic_1"
  },
  "water_shuriken": {
    "ico": "ico-water",
    "fx": "spark_07"
  },
  "triple_axel": {
    "ico": "ico-wind",
    "fx": "twirl_1"
  },
  "venoshock": {
    "ico": "ico-poison",
    "fx": "magic_1"
  },
  "night_slash": {
    "ico": "ico-demon_02",
    "fx": "slash_1"
  },
  "corrode": {
    "ico": "ico-poison",
    "fx": "magic_2"
  },
  "crush_grip": {
    "ico": "ico-mace",
    "fx": "dirt_2"
  },
  "drain_punch": {
    "ico": "ico-fist",
    "fx": "spark_02"
  },
  "leech_life": {
    "ico": "ico-bug",
    "fx": "magic_1"
  },
  "moonlight": {
    "ico": "ico-night",
    "fx": "star_02"
  },
  "cotton_guard": {
    "ico": "ico-heart",
    "fx": "smoke_1"
  },
  "body_press": {
    "ico": "ico-mace",
    "fx": "dirt_1"
  },
  "wide_guard": {
    "ico": "ico-protect",
    "fx": "light_1"
  },
  "mind_reader": {
    "ico": "ico-target",
    "fx": "trace_03"
  },
  "blood_price": {
    "ico": "ico-heart_break_02",
    "fx": "slash_1"
  },
  "overclock": {
    "ico": "ico-lightning",
    "fx": "spark_01"
  },
  "storm_throw": {
    "ico": "ico-wind",
    "fx": "twirl_02"
  },
  "frost_breath": {
    "ico": "ico-water",
    "fx": "light_1"
  },
  "hyper_beam": {
    "ico": "ico-lightning",
    "fx": "spark_05"
  },
  "dynamax_cannon": {
    "ico": "ico-mace",
    "fx": "flare_1"
  },
  "solar_beam": {
    "ico": "ico-leaves",
    "fx": "star_03"
  },
  "megahorn": {
    "ico": "ico-bug",
    "fx": "spark_06"
  },
  "doom_desire": {
    "ico": "ico-meteor",
    "fx": "star_06"
  },
  "plague": {
    "ico": "ico-skull",
    "fx": "magic_2"
  },
  "venom_burst": {
    "ico": "ico-poison",
    "fx": "flare_1"
  },
  "toxic_overflow": {
    "ico": "ico-flask",
    "fx": "magic_2"
  },
  "last_stand": {
    "ico": "ico-demon",
    "fx": "slash_1"
  },
  "overheat": {
    "ico": "ico-flame",
    "fx": "flare_1"
  },
  "guardian_oath": {
    "ico": "ico-shield",
    "fx": "light_1"
  },
  "life_spring": {
    "ico": "ico-heal",
    "fx": "star_04"
  },
  "dragon_ascension": {
    "ico": "ico-star",
    "fx": "star_05"
  },
  "sig_sand_fang": {
    "ico": "ico-stone",
    "fx": "dirt_1"
  },
  "sig_dual_chomp": {
    "ico": "ico-demon_02",
    "fx": "slash_1"
  },
  "sig_meteor_mash": {
    "ico": "ico-meteor",
    "fx": "spark_05"
  },
  "sig_land_wrath": {
    "ico": "ico-earthquake",
    "fx": "dirt_2"
  },
  "sig_leaf_blade": {
    "ico": "ico-leaves",
    "fx": "slash_1"
  },
  "sig_origin_pulse": {
    "ico": "ico-water",
    "fx": "magic_1"
  },
  "sig_heavy_slam": {
    "ico": "ico-mace",
    "fx": "dirt_2"
  },
  "sig_iron_tail_wall": {
    "ico": "ico-shield_03",
    "fx": "spark_02"
  },
  "sig_rage_wave": {
    "ico": "ico-water",
    "fx": "twirl_1"
  },
  "sig_sand_pit": {
    "ico": "ico-earthquake",
    "fx": "dirt_2"
  },
  "sig_ancient_beam": {
    "ico": "ico-demon_02",
    "fx": "magic_2"
  },
  "sig_magma_erupt": {
    "ico": "ico-volcanic_eruption",
    "fx": "flare_1"
  },
  "sig_white_smoke": {
    "ico": "ico-fog",
    "fx": "smoke_1"
  },
  "sig_bullet_slash": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "sig_megahorn_charge": {
    "ico": "ico-spear",
    "fx": "spark_06"
  },
  "sig_dragon_water": {
    "ico": "ico-water",
    "fx": "magic_1"
  },
  "sig_tide_ride": {
    "ico": "ico-wind",
    "fx": "twirl_02"
  },
  "sig_brave_bird": {
    "ico": "ico-bow",
    "fx": "slash_1"
  },
  "sig_rock_slide_wing": {
    "ico": "ico-stone",
    "fx": "spark_02"
  },
  "sig_soul_flame": {
    "ico": "ico-flame",
    "fx": "magic_2"
  },
  "sig_curse_mummy": {
    "ico": "ico-gravestone",
    "fx": "magic_1"
  }
};

export const STARTER_DECK = [
  "tackle",
  "tackle",
  "tackle",
  "tackle",
  "sand_attack",
  "bite",
  "bite",
  "bite",
  "harden",
  "double_kick"
];

export const STARTER_ITEMS = {
  "potion_small": 2,
  "potion_big": 0
};

export const ITEMS = {
  "potion_small": {
    "id": "potion_small",
    "name": "好伤药",
    "art": "flask_half",
    "ico": "ico-pill",
    "desc": "回复最大生命的 25%。",
    "healPct": 0.25,
    "price": 34
  },
  "potion_big": {
    "id": "potion_big",
    "name": "厉害伤药",
    "art": "flask_full",
    "ico": "ico-flask",
    "desc": "回复最大生命的 50%。",
    "healPct": 0.5,
    "price": 60
  },
  "charm_luck": {
    "id": "charm_luck",
    "name": "幸运护符",
    "art": "shield",
    "ico": "ico-clover",
    "desc": "本局幸运 +3。",
    "price": 70,
    "stat": {
      "luck": 3
    }
  },
  "charm_atk": {
    "id": "charm_atk",
    "name": "锐爪护符",
    "art": "sword",
    "ico": "ico-sword",
    "desc": "本局攻击 +4。",
    "price": 78,
    "stat": {
      "atk": 4
    }
  },
  "charm_def": {
    "id": "charm_def",
    "name": "硬壳护符",
    "art": "shield",
    "ico": "ico-shield",
    "desc": "本局防御 +3。",
    "price": 70,
    "stat": {
      "def": 3
    }
  },
  "charm_agi": {
    "id": "charm_agi",
    "name": "疾风护符",
    "art": "shield",
    "ico": "ico-shoe",
    "desc": "本局敏捷 +3。",
    "price": 82,
    "stat": {
      "agi": 3
    }
  },
  "elixir": {
    "id": "elixir",
    "name": "活力药",
    "art": "flask_full",
    "ico": "ico-heal",
    "desc": "本局最大生命 +18。",
    "price": 66,
    "stat": {
      "maxHp": 18
    }
  }
};
// #endregion GENERATED-CARDS

function weightedPick(pool) {
  const total = pool.reduce((s, [w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [w, v] of pool) {
    r -= w;
    if (r <= 0) return v;
  }
  return pool[pool.length - 1][1];
}

/** 按稀有度权重抽一张卡（排除 exclude 里的 id）；敌人专用牌不会进玩家的奖励池 */
export function rollCard(rarityBoost = 0, exclude = []) {
  const pool = [];
  for (const card of CARDS) {
    if (exclude.includes(card.id)) continue;
    // 敌人专用弱招（content/cards.json 里 enemyOnly: true）只给敌人用，别发给玩家
    if (card.enemyOnly) continue;
    const base = RARITY[card.rarity].weight;
    // rarityBoost 提高稀有卡出现概率
    const mult = card.rarity === 'common' ? 1 : 1 + rarityBoost * (card.rarity === 'epic' ? 0.5 : card.rarity === 'rare' ? 0.7 : 1);
    pool.push([base * mult, card]);
  }
  return weightedPick(pool);
}

/** 随机抽 n 张不重复的卡 */
export function rollCards(n, rarityBoost = 0, exclude = []) {
  const out = [];
  const used = [...exclude];
  for (let i = 0; i < n; i++) {
    const c = rollCard(rarityBoost, used);
    out.push(c);
    used.push(c.id);
  }
  return out;
}

/** 把效果里的数字套用到描述文本（供 UI 显示动态数值） */
export function cardDamagePreview(card, atk, enemyDef, strengthBonus = 0) {
  const dmg = card.effects.filter((e) => e.kind === 'damage');
  if (!dmg.length) return null;
  let total = 0;
  for (const e of dmg) {
    const mult = e.hits ?? 1;
    const raw = Math.max(1, atk + strengthBonus + e.power);
    const def = Math.max(0, Math.round(enemyDef * (1 - (e.ignoreDefPct ?? 0))));
    total += mult * Math.max(1, Math.round((raw * 100) / (100 + def)));
  }
  return total;
}
