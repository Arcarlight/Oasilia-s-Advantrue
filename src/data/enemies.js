// 敌人数据。HP / 攻击 / 防御 是「基准值」，实际数值会随章节和地图深度成长。
// 敌人用的招式直接复用卡牌表（cards.js），所以敌人和玩家遵守同一套 AP / 抽卡规则。
//
// 【数据本体不在这里】—— TIERS / MOVE_POOLS / ENEMIES 由 content/enemies.json 生成
// （见下面的 GENERATED 区块）。要加敌人就改那个 JSON + content/species.json，
// 然后跑 `node tools/build-content.mjs`。

import { BIOMES, BALANCE } from './balance.js';

// #region GENERATED-ENEMIES
export const TIERS = {
  "mob": {
    "name": "野生",
    "baseDef": 2,
    "agi": [
      5,
      9
    ],
    "gold": "normal",
    "reward": 1
  },
  "normal": {
    "name": "较强",
    "baseDef": 3,
    "agi": [
      8,
      13
    ],
    "gold": "normal",
    "reward": 1.6
  },
  "elite": {
    "name": "精英",
    "baseDef": 5,
    "agi": [
      11,
      17
    ],
    "gold": "elite",
    "reward": 2.6
  },
  "boss": {
    "name": "首领",
    "baseDef": 8,
    "agi": [
      13,
      19
    ],
    "gold": "boss",
    "reward": 5
  }
};

export const MOVE_POOLS = {
  "weak": [
    "mob_scratch",
    "tackle",
    "mob_sand",
    "mob_guard"
  ],
  "basic": [
    "mob_scratch",
    "tackle",
    "bite",
    "mob_sand",
    "mob_guard",
    "double_kick",
    "mob_stare"
  ],
  "strong": [
    "bite",
    "rock_throw",
    "crunch",
    "double_kick",
    "mob_growl",
    "mob_guard",
    "fire_fang",
    "harden"
  ],
  "elite": [
    "dragon_breath",
    "rock_slide",
    "crunch",
    "fire_fang",
    "earthquake",
    "dragon_claw",
    "iron_defense",
    "bulk_up",
    "screech"
  ],
  "boss": [
    "earthquake",
    "dragon_claw",
    "dragon_rush",
    "heat_wave",
    "superpower",
    "crunch",
    "iron_defense",
    "bulk_up",
    "mist"
  ],
  "forest_mid": [
    "mob_scratch",
    "bite",
    "bug_buzz",
    "toxic",
    "double_kick",
    "mob_growl",
    "harden",
    "u_turn"
  ],
  "tide_mid": [
    "bite",
    "crunch",
    "mob_guard",
    "harden",
    "roost",
    "mob_sand",
    "dragon_breath",
    "mob_growl"
  ],
  "cliff_mid": [
    "bite",
    "rock_throw",
    "rock_slide",
    "double_kick",
    "harden",
    "iron_defense",
    "mob_growl",
    "mob_stare"
  ],
  "kit_ground": [
    "mob_scratch",
    "tackle",
    "rock_throw",
    "bulldoze",
    "sand_tomb",
    "rock_slide",
    "mob_guard",
    "earth_power"
  ],
  "kit_ground_hi": [
    "mob_scratch",
    "tackle",
    "rock_throw",
    "bulldoze",
    "sand_tomb",
    "rock_slide",
    "mob_guard",
    "earth_power",
    "earthquake",
    "body_press",
    "bulk_up"
  ],
  "kit_rock": [
    "mob_scratch",
    "tackle",
    "rock_throw",
    "harden",
    "mob_guard",
    "rock_blast",
    "stone_edge",
    "mob_stare"
  ],
  "kit_rock_hi": [
    "mob_scratch",
    "tackle",
    "rock_throw",
    "harden",
    "mob_guard",
    "rock_blast",
    "stone_edge",
    "mob_stare",
    "rock_slide",
    "protect",
    "iron_defense"
  ],
  "kit_steel": [
    "mob_scratch",
    "tackle",
    "iron_head",
    "harden",
    "mob_guard",
    "metal_sound",
    "headbutt",
    "double_kick"
  ],
  "kit_steel_hi": [
    "mob_scratch",
    "tackle",
    "iron_head",
    "harden",
    "mob_guard",
    "metal_sound",
    "headbutt",
    "double_kick",
    "iron_defense",
    "protect",
    "bulk_up"
  ],
  "kit_bug": [
    "mob_scratch",
    "tackle",
    "twineedle",
    "fury_cutter",
    "poison_sting",
    "bug_buzz",
    "u_turn",
    "mob_sand"
  ],
  "kit_bug_hi": [
    "mob_scratch",
    "tackle",
    "twineedle",
    "fury_cutter",
    "poison_sting",
    "bug_buzz",
    "u_turn",
    "mob_sand",
    "megahorn",
    "bullet_seed",
    "swords_dance"
  ],
  "kit_grass": [
    "mob_scratch",
    "tackle",
    "absorb",
    "razor_leaf",
    "leech_seed",
    "spore",
    "giga_drain",
    "mob_guard"
  ],
  "kit_grass_hi": [
    "mob_scratch",
    "tackle",
    "absorb",
    "razor_leaf",
    "leech_seed",
    "spore",
    "giga_drain",
    "mob_guard",
    "synthesis",
    "leaf_storm",
    "quiver_dance"
  ],
  "kit_poison": [
    "mob_scratch",
    "tackle",
    "poison_sting",
    "acid_armor",
    "venom_drain",
    "sludge_bomb",
    "toxic",
    "mob_sand"
  ],
  "kit_poison_hi": [
    "mob_scratch",
    "tackle",
    "poison_sting",
    "acid_armor",
    "venom_drain",
    "sludge_bomb",
    "toxic",
    "mob_sand",
    "toxic_spikes",
    "plague",
    "venom_burst"
  ],
  "kit_water": [
    "mob_scratch",
    "tackle",
    "water_pulse",
    "aqua_ring",
    "withdraw",
    "brine",
    "whirlpool",
    "mob_guard"
  ],
  "kit_water_hi": [
    "mob_scratch",
    "tackle",
    "water_pulse",
    "aqua_ring",
    "withdraw",
    "brine",
    "whirlpool",
    "mob_guard",
    "surf",
    "moonlight",
    "guardian_oath"
  ],
  "kit_flying": [
    "mob_scratch",
    "tackle",
    "nuzzle",
    "air_slash",
    "acrobatics",
    "tailwind",
    "storm_throw",
    "mob_sand"
  ],
  "kit_flying_hi": [
    "mob_scratch",
    "tackle",
    "nuzzle",
    "air_slash",
    "acrobatics",
    "tailwind",
    "storm_throw",
    "mob_sand",
    "feather_dance",
    "water_shuriken",
    "dragon_ascension"
  ],
  "kit_fire": [
    "mob_scratch",
    "tackle",
    "flame_charge",
    "fire_fang",
    "heat_wave",
    "slash",
    "bite",
    "mob_sand"
  ],
  "kit_fire_hi": [
    "mob_scratch",
    "tackle",
    "flame_charge",
    "fire_fang",
    "heat_wave",
    "slash",
    "bite",
    "mob_sand",
    "overheat",
    "last_stand",
    "howl"
  ],
  "kit_dark": [
    "mob_scratch",
    "tackle",
    "bite",
    "crunch",
    "knock_off",
    "night_slash",
    "headbutt",
    "mob_guard"
  ],
  "kit_dark_hi": [
    "mob_scratch",
    "tackle",
    "bite",
    "crunch",
    "knock_off",
    "night_slash",
    "headbutt",
    "mob_guard",
    "scary_face",
    "blood_price",
    "charm"
  ],
  "kit_dragon": [
    "mob_scratch",
    "tackle",
    "dragon_breath",
    "dragon_claw",
    "dragon_tail",
    "bite",
    "mob_guard",
    "mob_sand"
  ],
  "kit_dragon_hi": [
    "mob_scratch",
    "tackle",
    "dragon_breath",
    "dragon_claw",
    "dragon_tail",
    "bite",
    "mob_guard",
    "mob_sand",
    "dragon_rush",
    "draco_meteor",
    "dragon_ascension"
  ],
  "kit_ghost": [
    "mob_scratch",
    "tackle",
    "toxic_thread",
    "night_slash",
    "mob_stare",
    "sand_tomb",
    "bite",
    "mob_sand"
  ],
  "kit_ghost_hi": [
    "mob_scratch",
    "tackle",
    "toxic_thread",
    "night_slash",
    "mob_stare",
    "sand_tomb",
    "bite",
    "mob_sand",
    "toxic_overflow",
    "moonlight",
    "venom_burst"
  ],
  "kit_fighting": [
    "mob_scratch",
    "tackle",
    "double_kick",
    "rolling_kick",
    "headbutt",
    "bite",
    "mob_guard",
    "mob_sand"
  ],
  "kit_fighting_hi": [
    "mob_scratch",
    "tackle",
    "double_kick",
    "rolling_kick",
    "headbutt",
    "bite",
    "mob_guard",
    "mob_sand",
    "superpower",
    "bulk_up",
    "body_press"
  ],
  "kit_normal": [
    "mob_scratch",
    "tackle",
    "bite",
    "mob_sand",
    "mob_guard",
    "double_kick",
    "headbutt",
    "mob_stare"
  ],
  "kit_normal_hi": [
    "mob_scratch",
    "tackle",
    "bite",
    "mob_sand",
    "mob_guard",
    "double_kick",
    "headbutt",
    "mob_stare",
    "bulk_up",
    "last_stand",
    "recycle"
  ],
  "kit_crystal": [
    "mob_scratch",
    "tackle",
    "rock_throw",
    "rock_slide",
    "harden",
    "mob_sand",
    "stone_edge",
    "moonlight"
  ],
  "kit_crystal_hi": [
    "mob_scratch",
    "tackle",
    "rock_throw",
    "rock_slide",
    "harden",
    "mob_sand",
    "stone_edge",
    "moonlight",
    "iron_defense",
    "charm",
    "crystal_wall",
    "guardian_oath",
    "sunder",
    "languor"
  ],
  "kit_electric": [
    "mob_scratch",
    "tackle",
    "nuzzle",
    "double_kick",
    "iron_head",
    "body_press",
    "metal_sound",
    "earth_power",
    "headbutt"
  ],
  "kit_electric_hi": [
    "mob_scratch",
    "tackle",
    "nuzzle",
    "double_kick",
    "iron_head",
    "body_press",
    "metal_sound",
    "earth_power",
    "headbutt",
    "tailwind",
    "agility",
    "dragon_breath",
    "dragon_claw",
    "scale_shot"
  ],
  "kit_fungal": [
    "mob_scratch",
    "tackle",
    "absorb",
    "poison_sting",
    "spore",
    "giga_drain",
    "razor_leaf",
    "bullet_seed",
    "leech_seed",
    "mob_guard"
  ],
  "kit_fungal_hi": [
    "mob_scratch",
    "tackle",
    "absorb",
    "poison_sting",
    "spore",
    "giga_drain",
    "razor_leaf",
    "bullet_seed",
    "leech_seed",
    "toxic",
    "worsen",
    "megahorn",
    "venom_drain"
  ],
  "kit_ruins": [
    "mob_scratch",
    "tackle",
    "rock_throw",
    "sand_tomb",
    "night_slash",
    "mob_sand",
    "mob_stare",
    "scary_face",
    "sunder",
    "bug_buzz",
    "earth_power"
  ],
  "kit_ruins_hi": [
    "mob_scratch",
    "tackle",
    "sand_tomb",
    "night_slash",
    "mob_sand",
    "mob_stare",
    "scary_face",
    "sunder",
    "bug_buzz",
    "rock_slide",
    "languor",
    "earth_power",
    "metal_sound"
  ],
  "kit_bleed": [
    "mob_scratch",
    "tackle",
    "slash",
    "fury_swipes",
    "poison_fang",
    "iron_barbs",
    "headbutt",
    "venom_burst"
  ],
  "kit_bleed_hi": [
    "mob_scratch",
    "tackle",
    "slash",
    "fury_swipes",
    "poison_fang",
    "iron_barbs",
    "headbutt",
    "venom_burst",
    "rend",
    "night_slash",
    "bloodletting",
    "megahorn",
    "swords_dance"
  ],
  "kit_weaken": [
    "mob_scratch",
    "tackle",
    "sand_attack",
    "rock_slide",
    "water_pulse",
    "nuzzle",
    "triple_axel",
    "mob_stare",
    "scary_face",
    "intimidate",
    "browbeat"
  ],
  "kit_weaken_hi": [
    "mob_scratch",
    "tackle",
    "sand_attack",
    "rock_slide",
    "water_pulse",
    "nuzzle",
    "triple_axel",
    "mob_stare",
    "scary_face",
    "intimidate",
    "browbeat",
    "exploit_weak",
    "knock_off",
    "bulk_up",
    "swords_dance",
    "total_suppression"
  ],
  "kit_debuff": [
    "mob_scratch",
    "tackle",
    "rock_throw",
    "night_slash",
    "bug_buzz",
    "mob_sand",
    "water_pulse",
    "triple_axel",
    "silver_wind",
    "u_turn_dance",
    "mob_stare",
    "screech",
    "charm"
  ],
  "kit_debuff_hi": [
    "mob_scratch",
    "tackle",
    "screech",
    "charm",
    "metal_sound",
    "scary_face",
    "total_suppression",
    "intimidate",
    "browbeat",
    "exploit_weak",
    "night_slash",
    "bug_buzz",
    "mob_sand",
    "u_turn_dance",
    "frost_breath",
    "drain_punch",
    "leech_life",
    "water_pulse",
    "triple_axel",
    "silver_wind",
    "giga_impact"
  ]
};

export const ENEMIES = [
  {
    "id": "sandshrew",
    "slug": "sandshrew",
    "name": "穿山鼠",
    "en": "Sandshrew",
    "dex": "0027",
    "types": [
  "地面"
],
    "tier": "mob",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_ground,
    "lines": [ "它把自己团成一个球滚过来。", "「沙子进眼睛了！」" ],
  },
  {
    "id": "cacnea",
    "slug": "cacnea",
    "name": "刺球仙人掌",
    "en": "Cacnea",
    "dex": "0331",
    "types": [
  "草"
],
    "tier": "mob",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_grass,
    "lines": [ "它张开手臂要一个拥抱。你决定不给。", "沙地上冒出一排新的刺。" ],
  },
  {
    "id": "gible",
    "slug": "gible",
    "name": "圆陆鲨",
    "en": "Gible",
    "dex": "0443",
    "types": [
  "龙",
  "地面"
],
    "tier": "mob",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_dragon,
    "lines": [ "它一口咬在沙丘上，然后看着你。", "它好像在笑。也可能是牙疼。" ],
  },
  {
    "id": "trapinch",
    "slug": "trapinch",
    "name": "大颚蚁",
    "en": "Trapinch",
    "dex": "0328",
    "types": [
  "地面"
],
    "tier": "mob",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_ground,
    "lines": [ "沙里张开一个漏斗形的坑，坑底有东西在等。", "它把下颚张到最大，然后一动不动 —— 那是它的捕猎方式。" ],
  },
  {
    "id": "sandile",
    "slug": "sandile",
    "name": "黑眼鳄",
    "en": "Sandile",
    "dex": "0551",
    "types": [
  "地面",
  "恶"
],
    "tier": "mob",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_ground,
    "lines": [ "沙面下有两道细细的波纹朝你移动。", "它只把眼睛露在外面，看你的时候顺便眨掉一层沙。" ],
  },
  {
    "id": "hippopotas",
    "slug": "hippopotas",
    "name": "沙河马",
    "en": "Hippopotas",
    "dex": "0449",
    "types": [
  "地面"
],
    "tier": "mob",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_ground,
    "lines": [ "一大团沙子从沙丘后面挪过来，挪到一半停了，打了个哈欠。", "它鼻孔一张，喷出一小股沙暴。" ],
  },
  {
    "id": "sandygast",
    "slug": "sandygast",
    "name": "沙丘娃",
    "en": "Sandygast",
    "dex": "0769",
    "types": [
  "幽灵",
  "地面"
],
    "tier": "mob",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_ghost,
    "lines": [ "一个沙堆长了嘴。它张开得很慢，像在等你主动走进去。", "它身上的沙一直往下掉，但永远掉不完。" ],
  },
  {
    "id": "silicobra",
    "slug": "silicobra",
    "name": "沙包蛇",
    "en": "Silicobra",
    "dex": "0843",
    "types": [
  "地面"
],
    "tier": "mob",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_ghost,
    "lines": [ "它从沙里竖起半截身子，像一根会动的绳子。", "「绕过去吧，它好像挺得意。」" ],
  },
  {
    "id": "sandslash",
    "slug": "sandslash",
    "name": "穿山王",
    "en": "Sandslash",
    "dex": "0028",
    "types": [
  "地面"
],
    "tier": "normal",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_ground,
    "lines": [ "它的背刺在正午的阳光下反着白光。" ],
  },
  {
    "id": "cacturne",
    "slug": "cacturne",
    "name": "梦歌仙人掌",
    "en": "Cacturne",
    "dex": "0332",
    "types": [
  "草",
  "恶"
],
    "tier": "normal",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_grass,
    "lines": [ "它在白天一动不动，现在开始动了。" ],
  },
  {
    "id": "gligar",
    "slug": "gligar",
    "name": "天蝎",
    "en": "Gligar",
    "dex": "0207",
    "types": [
  "地面",
  "飞行"
],
    "tier": "normal",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_bleed,
    "lines": [ "它从沙丘背面滑翔下来，尾巴上的钩子闪着光。" ],
  },
  {
    "id": "sandaconda",
    "slug": "sandaconda",
    "name": "沙螺蟒",
    "en": "Sandaconda",
    "dex": "0844",
    "types": [
  "地面"
],
    "tier": "normal",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_bleed,
    "lines": [ "沙面忽然鼓起一条长长的脊，绕着沙丘转了一整圈。", "「它把自己拧成了一盘。」" ],
  },
  {
    "id": "gabite",
    "slug": "gabite",
    "name": "尖牙陆鲨",
    "en": "Gabite",
    "dex": "0444",
    "types": [
  "龙",
  "地面"
],
    "tier": "normal",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_dragon,
    "lines": [ "它的爪子在星尘里划出三道亮痕。" ],
  },
  {
    "id": "hippowdon",
    "slug": "hippowdon",
    "name": "河马兽",
    "en": "Hippowdon",
    "dex": "0450",
    "types": [
  "地面"
],
    "tier": "elite",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_ground_hi,
    "signature": [ "sig_iron_tail_wall" ],
    "lines": [ "沙丘自己站了起来。原来那不是沙丘。", "它张开嘴，风里全是沙在磨牙的声音。" ],
  },
  {
    "id": "excadrill",
    "slug": "excadrill",
    "name": "龙头地鼠",
    "en": "Excadrill",
    "dex": "0530",
    "types": [
  "地面",
  "钢"
],
    "tier": "elite",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_steel_hi,
    "signature": [ "sig_sand_pit" ],
    "lines": [ "沙里伸出两只钢爪，把整块地面掀了起来。", "「这下面埋的东西，都是我的。」" ],
  },
  {
    "id": "steelix",
    "slug": "steelix",
    "name": "大钢蛇",
    "en": "Steelix",
    "dex": "0208",
    "types": [
  "钢",
  "地面"
],
    "tier": "elite",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_steel_hi,
    "signature": [ "sig_ancient_beam" ],
    "lines": [ "沙面裂开，一条铁铸的身躯从中升起。" ],
  },
  {
    "id": "rhyperior",
    "slug": "rhyperior",
    "name": "超甲狂犀",
    "en": "Rhyperior",
    "dex": "0464",
    "types": [
  "地面",
  "岩石"
],
    "tier": "elite",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_steel_hi,
    "signature": [ "sig_iron_tail_wall" ],
    "lines": [ "沙子被顶开一大片，那面像盾一样的肩膀先露了出来。" ],
  },
  {
    "id": "mudsdale",
    "slug": "mudsdale",
    "name": "重泥挽马",
    "en": "Mudsdale",
    "dex": "0750",
    "types": [
  "地面"
],
    "tier": "elite",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_ground_hi,
    "signature": [ "sig_sand_pit" ],
    "lines": [ "它每一步都在沙上踩出一个坑，坑里还冒着热气。" ],
  },
  {
    "id": "tyranitar",
    "slug": "tyranitar",
    "name": "班基拉斯",
    "en": "Tyranitar",
    "dex": "0248",
    "types": [
  "岩石",
  "恶"
],
    "tier": "boss",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_rock_hi,
    "signature": [ "sig_sand_fang" ],
    "lines": [ "沙暴忽然停了。因为掀沙暴的那个东西来了。" ],
    "bossTitle": "流沙之主",
  },
  {
    "id": "aerodactyl",
    "slug": "aerodactyl",
    "name": "化石翼龙",
    "en": "Aerodactyl",
    "dex": "0142",
    "types": [
  "岩石",
  "飞行"
],
    "tier": "boss",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_rock_hi,
    "signature": [ "sig_sky_dive" ],
    "lines": [ "沙丘顶上那个影子已经跟了你半天。它终于收起了翅膀。", "「跑得挺快。可惜沙丘是我的。」" ],
    "bossTitle": "沙丘上空的影子",
  },
  {
    "id": "machop",
    "slug": "machop",
    "name": "腕力",
    "en": "Machop",
    "dex": "0066",
    "types": [
  "格斗"
],
    "tier": "mob",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_fighting,
    "lines": [ "它正在举一块比你大的石头，看到你之后举了两块。" ],
  },
  {
    "id": "slugma",
    "slug": "slugma",
    "name": "熔岩虫",
    "en": "Slugma",
    "dex": "0218",
    "types": [
  "火"
],
    "tier": "mob",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_fighting,
    "lines": [ "一摊亮橘色的东西贴着岩壁慢慢往下淌。", "「别踩。踩了要疼很久。」" ],
  },
  {
    "id": "numel",
    "slug": "numel",
    "name": "呆火驼",
    "en": "Numel",
    "dex": "0322",
    "types": [
  "火",
  "地面"
],
    "tier": "mob",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_fire,
    "lines": [ "岩壁后面传来呼噜声，走近一看，它背上在冒热气。", "它慢吞吞地转过头，热气把空气扭了一下。" ],
  },
  {
    "id": "roggenrola",
    "slug": "roggenrola",
    "name": "石丸子",
    "en": "Roggenrola",
    "dex": "0524",
    "types": [
  "岩石"
],
    "tier": "mob",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_rock,
    "lines": [ "你踢到一颗石头，石头生气了。", "它没有眼睛，但你确定它在看你。" ],
  },
  {
    "id": "drilbur",
    "slug": "drilbur",
    "name": "螺钉地鼠",
    "en": "Drilbur",
    "dex": "0529",
    "types": [
  "地面"
],
    "tier": "mob",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_ground,
    "lines": [ "岩屑堆里钻出一个脑袋，它把爪子上的灰抖了抖。", "它一头扎进岩缝，再从你脚边冒出来。" ],
  },
  {
    "id": "darumaka",
    "slug": "darumaka",
    "name": "火红不倒翁",
    "en": "Darumaka",
    "dex": "0554",
    "types": [
  "火"
],
    "tier": "mob",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_ground,
    "lines": [ "它原地晃来晃去，就是不肯倒。", "「……你还挺坚持。」" ],
  },
  {
    "id": "rockruff",
    "slug": "rockruff",
    "name": "岩狗狗",
    "en": "Rockruff",
    "dex": "0744",
    "types": [
  "岩石"
],
    "tier": "mob",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_rock,
    "lines": [ "它在岩壁上蹭脖子，蹭出一串火星。", "它摇尾巴的时候扫到了石头，石头碎了。" ],
  },
  {
    "id": "sizzlipede",
    "slug": "sizzlipede",
    "name": "烧火蚣",
    "en": "Sizzlipede",
    "dex": "0850",
    "types": [
  "火",
  "虫"
],
    "tier": "mob",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_fighting,
    "lines": [ "岩缝里的红点连成一条线，正往你这边挪。" ],
  },
  {
    "id": "magcargo",
    "slug": "magcargo",
    "name": "熔岩蜗牛",
    "en": "Magcargo",
    "dex": "0219",
    "types": [
  "火",
  "岩石"
],
    "tier": "mob",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_fire,
    "lines": [ "岩壁上的石头在动，而且很烫。" ],
  },
  {
    "id": "arbok",
    "slug": "arbok",
    "name": "阿柏怪",
    "en": "Arbok",
    "dex": "0024",
    "types": [
  "毒"
],
    "tier": "normal",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_weaken,
    "lines": [ "岩缝里传来鳞片摩擦石头的声音。" ],
  },
  {
    "id": "machoke",
    "slug": "machoke",
    "name": "豪力",
    "en": "Machoke",
    "dex": "0067",
    "types": [
  "格斗"
],
    "tier": "normal",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_weaken,
    "lines": [ "它把一条岩柱当成沙袋，正在打。" ],
  },
  {
    "id": "carnivine",
    "slug": "carnivine",
    "name": "尖牙笼",
    "en": "Carnivine",
    "dex": "0455",
    "types": [
  "草"
],
    "tier": "normal",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_grass,
    "lines": [ "峡谷底部有一朵花，花开的方向一直对着你。" ],
  },
  {
    "id": "centiskorch",
    "slug": "centiskorch",
    "name": "焚焰蚣",
    "en": "Centiskorch",
    "dex": "0851",
    "types": [
  "火",
  "虫"
],
    "tier": "normal",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_grass,
    "lines": [ "它把身子盘在烧红的岩石上，像一条烧着的鞭子。", "「离远点，我这会儿很烫。」" ],
  },
  {
    "id": "arcanine",
    "slug": "arcanine",
    "name": "风速狗",
    "en": "Arcanine",
    "dex": "0059",
    "types": [
  "火"
],
    "tier": "elite",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_fire_hi,
    "signature": [ "sig_magma_erupt" ],
    "lines": [ "一道橙色的影子沿着峡谷壁跑了三个来回，然后停在你面前。" ],
  },
  {
    "id": "camerupt",
    "slug": "camerupt",
    "name": "喷火驼",
    "en": "Camerupt",
    "dex": "0323",
    "types": [
  "火",
  "地面"
],
    "tier": "elite",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_fire_hi,
    "signature": [ "sig_white_smoke" ],
    "lines": [ "岩壁上的红纹裂开了，里面是亮的。", "它每喘一口气，脚边的石头就化一点。" ],
  },
  {
    "id": "torkoal",
    "slug": "torkoal",
    "name": "煤炭龟",
    "en": "Torkoal",
    "dex": "0324",
    "types": [
  "火"
],
    "tier": "elite",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_fire_hi,
    "signature": [ "sig_magma_erupt" ],
    "lines": [ "一团白烟沿着谷底滚过来，烟里有壳。", "它不动，但它周围的空气在抖。" ],
  },
  {
    "id": "talonflame",
    "slug": "talonflame",
    "name": "烈箭鹰",
    "en": "Talonflame",
    "dex": "0663",
    "types": [
  "火",
  "飞行"
],
    "tier": "elite",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_rock_hi,
    "signature": [ "sig_white_smoke" ],
    "lines": [ "一颗火球从崖顶冲下来，在离你两步的地方刹住了。" ],
  },
  {
    "id": "golem",
    "slug": "golem",
    "name": "隆隆岩",
    "en": "Golem",
    "dex": "0076",
    "types": [
  "岩石",
  "地面"
],
    "tier": "elite",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_fire_hi,
    "signature": [ "sig_magma_erupt" ],
    "lines": [ "一整面岩壁开始滚 —— 滚到一半才发现那是活的。" ],
  },
  {
    "id": "garchomp",
    "slug": "garchomp",
    "name": "烈咬陆鲨",
    "en": "Garchomp",
    "dex": "0445",
    "types": [
  "龙",
  "地面"
],
    "tier": "boss",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_dragon_hi,
    "signature": [ "sig_dual_chomp" ],
    "lines": [ "它从峡谷另一头抬起眼睛看你。距离大概是四十米，但它已经在考虑要不要过来了。" ],
    "bossTitle": "峡谷的暴君",
  },
  {
    "id": "gigalith",
    "slug": "gigalith",
    "name": "庞岩怪",
    "en": "Gigalith",
    "dex": "0526",
    "types": [
  "岩石"
],
    "tier": "boss",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_ground_hi,
    "signature": [ "sig_horn_drill" ],
    "lines": [ "峡谷最窄的那段被一块会呼吸的石头堵住了。", "「让开？这里就是我的位置。」" ],
    "bossTitle": "活着的岩壁",
  },
  {
    "id": "weedle",
    "slug": "weedle",
    "name": "独角虫",
    "en": "Weedle",
    "dex": "0013",
    "types": [
  "虫",
  "毒"
],
    "tier": "mob",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_bug,
    "lines": [ "树皮上有一条黄色的东西正在往上爬，爬到你面前停住了。", "它头上的角对着你。" ],
  },
  {
    "id": "oddish",
    "slug": "oddish",
    "name": "走路草",
    "en": "Oddish",
    "dex": "0043",
    "types": [
  "草",
  "毒"
],
    "tier": "mob",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_grass,
    "lines": [ "一丛叶子从土里拔出来，然后开始走。", "它把叶子对着你，像是在闻。" ],
  },
  {
    "id": "bellsprout",
    "slug": "bellsprout",
    "name": "喇叭芽",
    "en": "Bellsprout",
    "dex": "0069",
    "types": [
  "草",
  "毒"
],
    "tier": "mob",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_grass,
    "lines": [ "它把根从土里抽出来，晃了晃，像是在热身。", "它的头一直在点，你分不清是点头还是准备咬。" ],
  },
  {
    "id": "treecko",
    "slug": "treecko",
    "name": "木守宫",
    "en": "Treecko",
    "dex": "0252",
    "types": [
  "草"
],
    "tier": "mob",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_grass,
    "lines": [ "树干上贴着一只木守宫，尾巴上还挂着一片叶子。", "它从树上一路滑下来，落地时几乎没有声音。" ],
  },
  {
    "id": "snivy",
    "slug": "snivy",
    "name": "藤藤蛇",
    "en": "Snivy",
    "dex": "0495",
    "types": [
  "草"
],
    "tier": "mob",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_grass,
    "lines": [ "它昂着头站在路中间，像是嫌你走得慢。", "它用尾巴把你的影子拨开了一点，然后看你。" ],
  },
  {
    "id": "ferroseed",
    "slug": "ferroseed",
    "name": "种子铁球",
    "en": "Ferroseed",
    "dex": "0597",
    "types": [
  "草",
  "钢"
],
    "tier": "mob",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_grass,
    "lines": [ "一颗带刺的铁球从坡上滚下来，撞到你的腿，很有礼貌地停住了。", "它插在土里，刺上挂着别的宝可梦的毛。" ],
  },
  {
    "id": "grubbin",
    "slug": "grubbin",
    "name": "强颚鸡母虫",
    "en": "Grubbin",
    "dex": "0736",
    "types": [
  "虫"
],
    "tier": "mob",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_bug,
    "lines": [ "腐叶下面伸出一对很大的颚。", "它咬着树根往后拖，拖不动的样子很执着。" ],
  },
  {
    "id": "fomantis",
    "slug": "fomantis",
    "name": "伪螳草",
    "en": "Fomantis",
    "dex": "0753",
    "types": [
  "草"
],
    "tier": "mob",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_grass,
    "lines": [ "一株草举起了两把刀。", "它把叶片上的水抖掉，然后摆了个很像招式起手的姿势。" ],
  },
  {
    "id": "vileplume",
    "slug": "vileplume",
    "name": "霸王花",
    "en": "Vileplume",
    "dex": "0045",
    "types": [
  "草",
  "毒"
],
    "tier": "normal",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_bug,
    "lines": [ "它头顶那朵花开得比你的头还大。", "「……好像不太欢迎我。」" ],
  },
  {
    "id": "ledian",
    "slug": "ledian",
    "name": "安瓢虫",
    "en": "Ledian",
    "dex": "0166",
    "types": [
  "虫",
  "飞行"
],
    "tier": "normal",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_grass,
    "lines": [ "几颗星点在藤蔓间闪了一下，然后全都落到你面前。" ],
  },
  {
    "id": "beautifly",
    "slug": "beautifly",
    "name": "狩猎凤蝶",
    "en": "Beautifly",
    "dex": "0267",
    "types": [
  "虫",
  "飞行"
],
    "tier": "normal",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_bug,
    "lines": [ "它的翅膀在树影里晃出一片彩色的光，看不清它下一步要往哪飞。" ],
  },
  {
    "id": "durant",
    "slug": "durant",
    "name": "铁蚁",
    "en": "Durant",
    "dex": "0632",
    "types": [
  "虫",
  "钢"
],
    "tier": "normal",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_bug,
    "lines": [ "一队亮闪闪的钢壳把地上的落果全搬走了。", "「它们搬得比你还快。」" ],
  },
  {
    "id": "pinsir",
    "slug": "pinsir",
    "name": "凯罗斯",
    "en": "Pinsir",
    "dex": "0127",
    "types": [
  "虫"
],
    "tier": "elite",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_bug_hi,
    "signature": [ "sig_bullet_slash" ],
    "lines": [ "两根角夹住了一棵小树，树断了。它转头看你，像是在问你有没有更硬的。" ],
  },
  {
    "id": "scizor",
    "slug": "scizor",
    "name": "巨钳螳螂",
    "en": "Scizor",
    "dex": "0212",
    "types": [
  "虫",
  "钢"
],
    "tier": "elite",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_bug_hi,
    "signature": [ "sig_megahorn_charge" ],
    "lines": [ "一片叶子从中间分成两半，切口是直的。", "它抬起钳子，钳口上还挂着露水。" ],
  },
  {
    "id": "heracross",
    "slug": "heracross",
    "name": "赫拉克罗斯",
    "en": "Heracross",
    "dex": "0214",
    "types": [
  "虫",
  "格斗"
],
    "tier": "elite",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_bug_hi,
    "signature": [ "sig_bullet_slash" ],
    "lines": [ "它从树干里拔出一根角，树汁顺着角往下滴。它很有礼貌地等你准备好。" ],
  },
  {
    "id": "lurantis",
    "slug": "lurantis",
    "name": "兰螳花",
    "en": "Lurantis",
    "dex": "0754",
    "types": [
  "草"
],
    "tier": "elite",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_poison_hi,
    "signature": [ "sig_megahorn_charge" ],
    "lines": [ "它举着两片叶子站得笔直，像在等你先动手。" ],
  },
  {
    "id": "ariados",
    "slug": "ariados",
    "name": "阿利多斯",
    "en": "Ariados",
    "dex": "0168",
    "types": [
  "虫",
  "毒"
],
    "tier": "elite",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_bug_hi,
    "signature": [ "sig_bullet_slash" ],
    "lines": [ "树影里垂下来一根丝，丝上挂着一排眼睛。" ],
  },
  {
    "id": "sceptile",
    "slug": "sceptile",
    "name": "蜥蜴王",
    "en": "Sceptile",
    "dex": "0254",
    "types": [
  "草"
],
    "tier": "boss",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_grass_hi,
    "signature": [ "sig_leaf_blade" ],
    "lines": [ "树叶全部停止摇晃。有东西从树冠上下来，落地的声音很轻。「走出去。这里不欢迎沙子。」" ],
    "bossTitle": "密林的守林人",
  },
  {
    "id": "tangrowth",
    "slug": "tangrowth",
    "name": "巨蔓藤",
    "en": "Tangrowth",
    "dex": "0465",
    "types": [
  "草"
],
    "tier": "boss",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_bug_hi,
    "signature": [ "sig_double_claw" ],
    "lines": [ "整片林子的藤忽然一起收紧了。", "「……原来这片林子是有主人的。」" ],
    "bossTitle": "密林的长者",
  },
  {
    "id": "tentacool",
    "slug": "tentacool",
    "name": "玛瑙水母",
    "en": "Tentacool",
    "dex": "0072",
    "types": [
  "水",
  "毒"
],
    "tier": "mob",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water,
    "lines": [ "浅水里飘着一颗红宝石，下面连着十几条透明的线。", "它在水里一鼓一鼓的，像在呼吸，也像在等你下水。" ],
  },
  {
    "id": "shellder",
    "slug": "shellder",
    "name": "大舌贝",
    "en": "Shellder",
    "dex": "0090",
    "types": [
  "水"
],
    "tier": "mob",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water,
    "lines": [ "一块紫色的贝壳从盐壳底下顶出来，然后合上了。", "贝壳缝里伸出一条舌头，很快又缩回去。" ],
  },
  {
    "id": "remoraid",
    "slug": "remoraid",
    "name": "铁炮鱼",
    "en": "Remoraid",
    "dex": "0223",
    "types": [
  "水"
],
    "tier": "mob",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water,
    "lines": [ "一条铁炮鱼把水吸进嘴里，然后对着你吐了出来。", "它瞄准的时候会歪一下头。" ],
  },
  {
    "id": "corphish",
    "slug": "corphish",
    "name": "龙虾小兵",
    "en": "Corphish",
    "dex": "0341",
    "types": [
  "水"
],
    "tier": "mob",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water,
    "lines": [ "它在浅滩里横着走，钳子举得比头高。", "它把你的一片影子当成了对手，先夹了一下试试。" ],
  },
  {
    "id": "shellos",
    "slug": "shellos",
    "name": "无壳海兔",
    "en": "Shellos",
    "dex": "0422",
    "types": [
  "水"
],
    "tier": "mob",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water,
    "lines": [ "盐壳上的浅水里趴着一团软软的东西，慢慢换了个形状。", "它爬过的地方留下一条亮亮的痕。" ],
  },
  {
    "id": "wishiwashi",
    "slug": "wishiwashi",
    "name": "弱丁鱼",
    "en": "Wishiwashi",
    "dex": "0746",
    "types": [
  "水"
],
    "tier": "mob",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water,
    "lines": [ "一小群弱丁鱼挤在一起，挤成了一个比它们单个大得多的形状。", "它们同时转向你，整齐得有点吓人。" ],
  },
  {
    "id": "mareanie",
    "slug": "mareanie",
    "name": "好坏星",
    "en": "Mareanie",
    "dex": "0747",
    "types": [
  "水",
  "毒"
],
    "tier": "mob",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_poison,
    "lines": [ "礁石上那朵花在动，而且带着毒刺。", "它伸出一条触手试探你，被你躲开之后又伸出两条。" ],
  },
  {
    "id": "pyukumuku",
    "slug": "pyukumuku",
    "name": "拳海参",
    "en": "Pyukumuku",
    "dex": "0771",
    "types": [
  "水"
],
    "tier": "mob",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water,
    "lines": [ "浅滩上一坨黑色的东西，看不出哪边是头。", "它对着你吐出了自己的内脏，然后又收回去 —— 好像在打招呼。" ],
  },
  {
    "id": "tentacruel",
    "slug": "tentacruel",
    "name": "毒刺水母",
    "en": "Tentacruel",
    "dex": "0073",
    "types": [
  "水",
  "毒"
],
    "tier": "normal",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water,
    "lines": [ "整片浅水同时泛起红色。你意识到那不是水色。" ],
  },
  {
    "id": "crawdaunt",
    "slug": "crawdaunt",
    "name": "铁螯龙虾",
    "en": "Crawdaunt",
    "dex": "0342",
    "types": [
  "水",
  "恶"
],
    "tier": "normal",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water,
    "lines": [ "它把一只巨钳蟹的壳拆开，扔在一边，然后看向你。" ],
  },
  {
    "id": "gastrodon",
    "slug": "gastrodon",
    "name": "海兔兽",
    "en": "Gastrodon",
    "dex": "0423",
    "types": [
  "水",
  "地面"
],
    "tier": "normal",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water,
    "lines": [ "滩上那摊软软的东西站起来了一半。", "「……你确定它有正面吗？」" ],
  },
  {
    "id": "bruxish",
    "slug": "bruxish",
    "name": "磨牙彩皮鱼",
    "en": "Bruxish",
    "dex": "0779",
    "types": [
  "水",
  "超能"
],
    "tier": "normal",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water,
    "lines": [ "它把嘴里的牙磨给你看了一下，颜色亮得晃眼。" ],
  },
  {
    "id": "kingler",
    "slug": "kingler",
    "name": "巨钳蟹",
    "en": "Kingler",
    "dex": "0099",
    "types": [
  "水"
],
    "tier": "elite",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water_hi,
    "signature": [ "sig_rage_wave" ],
    "lines": [ "一只钳子砸在盐壳上，盐壳裂了一条缝。它比你高。" ],
  },
  {
    "id": "mantine",
    "slug": "mantine",
    "name": "巨翅飞鱼",
    "en": "Mantine",
    "dex": "0226",
    "types": [
  "水",
  "飞行"
],
    "tier": "elite",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water_hi,
    "signature": [ "sig_dragon_water" ],
    "lines": [ "一只翅膀贴着水面滑过去，没有溅起水花。", "它绕回来的时候，你才看清那对翅膀有多宽。" ],
  },
  {
    "id": "kingdra",
    "slug": "kingdra",
    "name": "刺龙王",
    "en": "Kingdra",
    "dex": "0230",
    "types": [
  "水",
  "龙"
],
    "tier": "elite",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water_hi,
    "signature": [ "sig_tide_ride" ],
    "lines": [ "退潮之后，盐壳底下还有一汪水，水里有一个影子在转。", "它抬起头，整片盐海的水都跟着晃了一下。" ],
  },
  {
    "id": "huntail",
    "slug": "huntail",
    "name": "猎斑鱼",
    "en": "Huntail",
    "dex": "0367",
    "types": [
  "水"
],
    "tier": "elite",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water_hi,
    "signature": [ "sig_rage_wave" ],
    "lines": [ "浅水里那道影子绕着你转了一圈，又钻回沙底。" ],
  },
  {
    "id": "lapras",
    "slug": "lapras",
    "name": "拉普拉斯",
    "en": "Lapras",
    "dex": "0131",
    "types": [
  "水",
  "冰"
],
    "tier": "elite",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water_hi,
    "signature": [ "sig_dragon_water" ],
    "lines": [ "它从水里浮起来，背上驮着一小片湿掉的贝壳滩。" ],
  },
  {
    "id": "kyogre",
    "slug": "kyogre",
    "name": "盖欧卡",
    "en": "Kyogre",
    "dex": "0382",
    "types": [
  "水"
],
    "tier": "boss",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water_hi,
    "signature": [ "sig_origin_pulse" ],
    "lines": [ "潮水全部退了下去，露出底下睡了很久的东西。它睁开一只眼睛，海水就开始往回涨。" ],
    "bossTitle": "盐海的心跳",
  },
  {
    "id": "toxapex",
    "slug": "toxapex",
    "name": "超坏星",
    "en": "Toxapex",
    "dex": "0748",
    "types": [
  "毒",
  "水"
],
    "tier": "boss",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water_hi,
    "signature": [ "sig_tidal_rage" ],
    "lines": [ "浅滩的水忽然全红了 —— 那些圆乎乎的东西是它伸出来的。", "「踩进来的，就别想出去了。」" ],
    "bossTitle": "盐海的刺丛",
  },
  {
    "id": "pidgey",
    "slug": "pidgey",
    "name": "波波",
    "en": "Pidgey",
    "dex": "0016",
    "types": [
  "一般",
  "飞行"
],
    "tier": "mob",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_flying,
    "lines": [ "一只波波在你的头顶绕圈，一圈比一圈低。", "它落在岩架上，用一只眼睛看你。" ],
  },
  {
    "id": "taillow",
    "slug": "taillow",
    "name": "傲骨燕",
    "en": "Taillow",
    "dex": "0276",
    "types": [
  "一般",
  "飞行"
],
    "tier": "mob",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_flying,
    "lines": [ "它从风里冲下来，完全不减速。", "它站在风口上，像是在等什么。" ],
  },
  {
    "id": "aron",
    "slug": "aron",
    "name": "可可多拉",
    "en": "Aron",
    "dex": "0304",
    "types": [
  "钢",
  "岩石"
],
    "tier": "mob",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_steel,
    "lines": [ "一堆铁在动。是它在吃岩壁上的锈。", "它撞过来的时候发出了金属声。" ],
  },
  {
    "id": "woobat",
    "slug": "woobat",
    "name": "滚滚蝙蝠",
    "en": "Woobat",
    "dex": "0527",
    "types": [
  "超能力",
  "飞行"
],
    "tier": "mob",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_ghost,
    "lines": [ "岩缝里传出心跳一样的回声。", "它倒挂着，用耳朵对着你 —— 那是它的眼睛。" ],
  },
  {
    "id": "rufflet",
    "slug": "rufflet",
    "name": "毛头小鹰",
    "en": "Rufflet",
    "dex": "0627",
    "types": [
  "一般",
  "飞行"
],
    "tier": "mob",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_flying,
    "lines": [ "它站在崖边学飞，风一吹就往后退半步。", "「……加油。」" ],
  },
  {
    "id": "fletchling",
    "slug": "fletchling",
    "name": "小箭雀",
    "en": "Fletchling",
    "dex": "0661",
    "types": [
  "一般",
  "飞行"
],
    "tier": "mob",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_flying,
    "lines": [ "一只小箭雀在风口上挂着不动，尾巴上的红羽毛很显眼。", "它冲你叫了两声，声音比它自己大。" ],
  },
  {
    "id": "minior",
    "slug": "minior",
    "name": "小陨星",
    "en": "Minior",
    "dex": "0774",
    "types": [
  "岩石",
  "飞行"
],
    "tier": "mob",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_rock,
    "lines": [ "一颗小星星从上面掉下来，砸在岩架上，壳裂了一条缝。", "硬壳下面有橙色的光在动。" ],
  },
  {
    "id": "rookidee",
    "slug": "rookidee",
    "name": "稚山雀",
    "en": "Rookidee",
    "dex": "0821",
    "types": [
  "飞行"
],
    "tier": "mob",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_normal,
    "lines": [ "一小团黑色的东西在风里站得笔直。", "「风再大也没动。」" ],
  },
  {
    "id": "fearow",
    "slug": "fearow",
    "name": "大嘴雀",
    "en": "Fearow",
    "dex": "0022",
    "types": [
  "一般",
  "飞行"
],
    "tier": "normal",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_weaken,
    "lines": [ "它在高空停住不动，然后收翅，直直地掉下来。" ],
  },
  {
    "id": "graveler",
    "slug": "graveler",
    "name": "隆隆石",
    "en": "Graveler",
    "dex": "0075",
    "types": [
  "岩石",
  "地面"
],
    "tier": "normal",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_rock,
    "lines": [ "一段岩壁站了起来，然后滚了下来——用滚的。" ],
  },
  {
    "id": "lairon",
    "slug": "lairon",
    "name": "可多拉",
    "en": "Lairon",
    "dex": "0305",
    "types": [
  "钢",
  "岩石"
],
    "tier": "normal",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_steel,
    "lines": [ "它用头撞岩壁，岩壁让了。它转过头来找下一个目标。" ],
  },
  {
    "id": "swablu",
    "slug": "swablu",
    "name": "青绵鸟",
    "en": "Swablu",
    "dex": "0333",
    "types": [
  "一般",
  "飞行"
],
    "tier": "normal",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_flying,
    "lines": [ "它顶着风停在半空，身上的绒被吹成一个团。", "它落到岩尖上，把翅膀上的水抖成一小片雾。" ],
  },
  {
    "id": "skarmory",
    "slug": "skarmory",
    "name": "盔甲鸟",
    "en": "Skarmory",
    "dex": "0227",
    "types": [
  "钢",
  "飞行"
],
    "tier": "elite",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_steel_hi,
    "signature": [ "sig_brave_bird" ],
    "lines": [ "风里有刀。你终于看清那把刀长着翅膀。" ],
  },
  {
    "id": "gliscor",
    "slug": "gliscor",
    "name": "天蝎王",
    "en": "Gliscor",
    "dex": "0472",
    "types": [
  "地面",
  "飞行"
],
    "tier": "elite",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_bleed_hi,
    "signature": [ "sig_rock_slide_wing" ],
    "lines": [ "崖壁上倒挂着一只天蝎王，比你见过的大三倍，尾巴上挂着碎石。" ],
  },
  {
    "id": "braviary",
    "slug": "braviary",
    "name": "勇士雄鹰",
    "en": "Braviary",
    "dex": "0628",
    "types": [
  "一般",
  "飞行"
],
    "tier": "elite",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_flying_hi,
    "signature": [ "sig_brave_bird" ],
    "lines": [ "风把它托在崖口，它没有扇翅膀。", "它低头看你，像是在判断你值不值得下来一趟。" ],
  },
  {
    "id": "staraptor",
    "slug": "staraptor",
    "name": "姆克鹰",
    "en": "Staraptor",
    "dex": "0398",
    "types": [
  "一般",
  "飞行"
],
    "tier": "elite",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_rock_hi,
    "signature": [ "sig_rock_slide_wing" ],
    "lines": [ "风停了半秒 —— 因为它正好挡在你和太阳之间。" ],
  },
  {
    "id": "hawlucha",
    "slug": "hawlucha",
    "name": "摔角鹰人",
    "en": "Hawlucha",
    "dex": "0701",
    "types": [
  "格斗",
  "飞行"
],
    "tier": "elite",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_steel_hi,
    "signature": [ "sig_brave_bird" ],
    "lines": [ "它从崖上一跃而下，落地时摆了个姿势。", "「……帅吧。」" ],
  },
  {
    "id": "aggron",
    "slug": "aggron",
    "name": "波士可多拉",
    "en": "Aggron",
    "dex": "0306",
    "types": [
  "钢",
  "岩石"
],
    "tier": "boss",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_steel_hi,
    "signature": [ "sig_heavy_slam" ],
    "lines": [ "整段崖壁开始往下掉，因为有个东西正从里面走出来。它每一步都砸出一个坑。" ],
    "bossTitle": "峭壁的锤子",
  },
  {
    "id": "corviknight",
    "slug": "corviknight",
    "name": "钢铠鸦",
    "en": "Corviknight",
    "dex": "0823",
    "types": [
  "飞行",
  "钢"
],
    "tier": "boss",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_flying_hi,
    "signature": [ "sig_war_banner" ],
    "lines": [ "风里那副铠甲一直悬在同一块岩石上方，看样子已经等了你很久。", "「这片天归我。你要过去，先过我这关。」" ],
    "bossTitle": "风上的铁骑士",
  },
  {
    "id": "gastly",
    "slug": "gastly",
    "name": "鬼斯",
    "en": "Gastly",
    "dex": "0092",
    "types": [
  "幽灵",
  "毒"
],
    "tier": "mob",
    "biome": "night",
    "deck": MOVE_POOLS.kit_rock,
    "lines": [ "沙里冒出一团带笑的紫烟。", "「嘿嘿……」" ],
  },
  {
    "id": "shuppet",
    "slug": "shuppet",
    "name": "怨影娃娃",
    "en": "Shuppet",
    "dex": "0353",
    "types": [
  "幽灵"
],
    "tier": "mob",
    "biome": "night",
    "deck": MOVE_POOLS.kit_ground,
    "lines": [ "它挂在你身后，学你走路的样子。" ],
  },
  {
    "id": "duskull",
    "slug": "duskull",
    "name": "夜巡灵",
    "en": "Duskull",
    "dex": "0355",
    "types": [
  "幽灵"
],
    "tier": "mob",
    "biome": "night",
    "deck": MOVE_POOLS.kit_ghost,
    "lines": [ "一个红点在墓碑之间飘来飘去，好像在数什么。" ],
  },
  {
    "id": "yamask",
    "slug": "yamask",
    "name": "哭哭面具",
    "en": "Yamask",
    "dex": "0562",
    "types": [
  "幽灵"
],
    "tier": "mob",
    "biome": "night",
    "deck": MOVE_POOLS.kit_debuff,
    "lines": [ "沙里露出半张面具，面具在哭。", "它举着面具看你，像是在确认你是不是它等的那个人。" ],
  },
  {
    "id": "litwick",
    "slug": "litwick",
    "name": "烛光灵",
    "en": "Litwick",
    "dex": "0607",
    "types": [
  "幽灵",
  "火"
],
    "tier": "mob",
    "biome": "night",
    "deck": MOVE_POOLS.kit_ghost,
    "lines": [ "沙丘上有一盏灯在慢慢靠近，火光很温柔。", "你注意到自己被照出来的影子，比那盏灯长得多。" ],
  },
  {
    "id": "honedge",
    "slug": "honedge",
    "name": "独剑鞘",
    "en": "Honedge",
    "dex": "0679",
    "types": [
  "钢",
  "幽灵"
],
    "tier": "mob",
    "biome": "night",
    "deck": MOVE_POOLS.kit_steel,
    "lines": [ "一把剑插在沙里，剑柄上的布条在无风的时候动了一下。", "你还没伸手，它自己先动了。" ],
  },
  {
    "id": "pumpkaboo",
    "slug": "pumpkaboo",
    "name": "南瓜精",
    "en": "Pumpkaboo",
    "dex": "0710",
    "types": [
  "幽灵",
  "草"
],
    "tier": "mob",
    "biome": "night",
    "deck": MOVE_POOLS.kit_ground,
    "lines": [ "沙地上放着一盏灯，灯后面有东西在笑。" ],
  },
  {
    "id": "mimikyu",
    "slug": "mimikyu",
    "name": "谜拟丘",
    "en": "Mimikyu",
    "dex": "0778",
    "types": [
  "幽灵",
  "妖精"
],
    "tier": "mob",
    "biome": "night",
    "deck": MOVE_POOLS.kit_ghost,
    "lines": [ "它披着一块画得歪歪扭扭的布，在你面前站得笔直。", "「……看一眼就好。」" ],
  },
  {
    "id": "banette",
    "slug": "banette",
    "name": "诅咒娃娃",
    "en": "Banette",
    "dex": "0354",
    "types": [
  "幽灵"
],
    "tier": "normal",
    "biome": "night",
    "deck": MOVE_POOLS.kit_dragon,
    "lines": [ "被丢下的旧东西，在沙里坐了起来。" ],
  },
  {
    "id": "mismagius",
    "slug": "mismagius",
    "name": "梦妖魔",
    "en": "Mismagius",
    "dex": "0429",
    "types": [
  "幽灵"
],
    "tier": "normal",
    "biome": "night",
    "deck": MOVE_POOLS.kit_ground,
    "lines": [ "它念了一句什么，墓原上的风就停了。" ],
  },
  {
    "id": "spiritomb",
    "slug": "spiritomb",
    "name": "花岩怪",
    "en": "Spiritomb",
    "dex": "0442",
    "types": [
  "幽灵",
  "恶"
],
    "tier": "normal",
    "biome": "night",
    "deck": MOVE_POOLS.kit_rock,
    "lines": [ "一块石头上的裂纹全睁开了眼睛。" ],
  },
  {
    "id": "cofagrigus",
    "slug": "cofagrigus",
    "name": "迭失棺",
    "en": "Cofagrigus",
    "dex": "0563",
    "types": [
  "幽灵"
],
    "tier": "normal",
    "biome": "night",
    "deck": MOVE_POOLS.kit_debuff,
    "lines": [ "柱基上放着一口石棺，棺盖是合着的 —— 但棺缝里在漏沙。", "棺盖自己滑开了一条缝，缝里伸出来的东西不像手。" ],
  },
  {
    "id": "gengar",
    "slug": "gengar",
    "name": "耿鬼",
    "en": "Gengar",
    "dex": "0094",
    "types": [
  "幽灵",
  "毒"
],
    "tier": "elite",
    "biome": "night",
    "deck": MOVE_POOLS.kit_ghost_hi,
    "signature": [ "sig_soul_flame" ],
    "lines": [ "影子先到了，笑声后到。", "「又有人走夜路？」" ],
  },
  {
    "id": "chandelure",
    "slug": "chandelure",
    "name": "水晶灯火灵",
    "en": "Chandelure",
    "dex": "0609",
    "types": [
  "幽灵",
  "火"
],
    "tier": "elite",
    "biome": "night",
    "deck": MOVE_POOLS.kit_ghost_hi,
    "signature": [ "sig_curse_mummy" ],
    "lines": [ "远处有一盏灯，你以为那是营地。", "走近了才看出，那盏灯在飘，而且它在等你走近。" ],
  },
  {
    "id": "runerigus",
    "slug": "runerigus",
    "name": "迭失板",
    "en": "Runerigus",
    "dex": "0867",
    "types": [
  "地面",
  "幽灵"
],
    "tier": "elite",
    "biome": "night",
    "deck": MOVE_POOLS.kit_dragon_hi,
    "signature": [ "sig_soul_flame" ],
    "lines": [ "沙里翻出一块刻满字的石板，那些字正在动。" ],
  },
  {
    "id": "drifblim",
    "slug": "drifblim",
    "name": "随风球",
    "en": "Drifblim",
    "dex": "0426",
    "types": [
  "幽灵",
  "飞行"
],
    "tier": "elite",
    "biome": "night",
    "deck": MOVE_POOLS.kit_weaken_hi,
    "signature": [ "sig_curse_mummy" ],
    "lines": [ "一团影子慢慢升到墓原上空，把你脚下的沙也带起来一点。" ],
  },
  {
    "id": "dhelmise",
    "slug": "dhelmise",
    "name": "破破舵轮",
    "en": "Dhelmise",
    "dex": "0781",
    "types": [
  "幽灵",
  "草"
],
    "tier": "elite",
    "biome": "night",
    "deck": MOVE_POOLS.kit_steel_hi,
    "signature": [ "sig_soul_flame" ],
    "lines": [ "沙里竖着一截旧锚，锚上缠着的那些东西正在看你。" ],
  },
  {
    "id": "darkrai",
    "slug": "darkrai",
    "name": "达克莱伊",
    "en": "Darkrai",
    "dex": "0491",
    "types": [
  "恶"
],
    "tier": "boss",
    "biome": "night",
    "deck": MOVE_POOLS.kit_ghost_hi,
    "signature": [ "sig_meteor_mash" ],
    "lines": [ "沙子开始自己往你身上爬 —— 这里的东西讨厌醒着的人。", "「睡吧。你要的答案在梦里。」" ],
    "bossTitle": "夜砂里的梦",
  },
  {
    "id": "zygarde",
    "slug": "zygarde",
    "name": "基格尔德",
    "en": "Zygarde",
    "dex": "0718",
    "types": [
  "龙",
  "地面"
],
    "tier": "boss",
    "biome": "night",
    "deck": MOVE_POOLS.kit_dragon_hi,
    "signature": [ "sig_land_wrath" ],
    "lines": [ "沙丘背面浮出一张由绿色细胞拼成的脸。「……你走得太远了，沙漠的孩子。」" ],
    "bossTitle": "生态的秩序",
    "final": true,
  },
  {
    "id": "zoroark",
    "slug": "zoroark",
    "name": "索罗亚克",
    "en": "Zoroark",
    "dex": "0571",
    "types": [
  "恶"
],
    "tier": "boss",
    "biome": "night",
    "deck": MOVE_POOLS.kit_steel_hi,
    "signature": [ "sig_soul_lantern" ],
    "lines": [ "沙地上出现了第二个你，它比你更早地摆好了架势。", "「你猜哪个是真的？」" ],
    "bossTitle": "墓原的假面",
  },
  {
    "id": "geodude",
    "slug": "geodude",
    "name": "小拳石",
    "en": "Geodude",
    "dex": "0074",
    "types": [
  "岩石",
  "地面"
],
    "tier": "mob",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_rock,
    "lines": [ "你差点一脚踩上去。它睁眼，很不高兴。", "它把自己从岩壁上掰下来，跳到你面前。" ],
  },
  {
    "id": "cubone",
    "slug": "cubone",
    "name": "卡拉卡拉",
    "en": "Cubone",
    "dex": "0104",
    "types": [
  "地面"
],
    "tier": "mob",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins,
    "lines": [ "它抱着一个旧头骨，看了你一会儿，什么也没说。" ],
  },
  {
    "id": "unown",
    "slug": "unown",
    "name": "未知图腾",
    "en": "Unown",
    "dex": "0201",
    "types": [
  "超能"
],
    "tier": "mob",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins,
    "lines": [ "墙上的刻痕排成一个你不知道的字，然后那个字飘了下来。" ],
  },
  {
    "id": "sableye",
    "slug": "sableye",
    "name": "勾魂眼",
    "en": "Sableye",
    "dex": "0302",
    "types": [
  "恶",
  "幽灵"
],
    "tier": "mob",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_debuff,
    "lines": [ "它原本就蹲在影子里，只是你现在才看清。", "它对着你搓了搓手，指缝里的东西在反光。" ],
  },
  {
    "id": "lunatone",
    "slug": "lunatone",
    "name": "月石",
    "en": "Lunatone",
    "dex": "0337",
    "types": [
  "岩石",
  "超能力"
],
    "tier": "mob",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins,
    "lines": [ "一根柱子的顶上浮着一块石头，它一直在慢慢转。", "它转过来的时候，柱廊里所有的影子都跟着挪了一下。" ],
  },
  {
    "id": "baltoy",
    "slug": "baltoy",
    "name": "天秤偶",
    "en": "Baltoy",
    "dex": "0343",
    "types": [
  "地面",
  "超能"
],
    "tier": "mob",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins,
    "lines": [ "沙里转出来一个泥做的小人，转得很有节奏。" ],
  },
  {
    "id": "bronzor",
    "slug": "bronzor",
    "name": "铜镜怪",
    "en": "Bronzor",
    "dex": "0436",
    "types": [
  "钢",
  "超能"
],
    "tier": "mob",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins,
    "lines": [ "一面长满绿锈的旧镜面慢慢转向你。" ],
  },
  {
    "id": "golett",
    "slug": "golett",
    "name": "泥偶小人",
    "en": "Golett",
    "dex": "0622",
    "types": [
  "地面",
  "幽灵"
],
    "tier": "mob",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins,
    "lines": [ "一个泥做的拳头从沙里举起来，像是在打招呼。" ],
  },
  {
    "id": "solrock",
    "slug": "solrock",
    "name": "太阳岩",
    "en": "Solrock",
    "dex": "0338",
    "types": [
  "岩石",
  "超能力"
],
    "tier": "normal",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_crystal,
    "lines": [ "整座遗迹忽然亮起来，因为柱顶那块石头转到了正对太阳的角度。", "它把光聚成一条线，线落在你脚边，冒了一点烟。" ],
  },
  {
    "id": "claydol",
    "slug": "claydol",
    "name": "念力土偶",
    "en": "Claydol",
    "dex": "0344",
    "types": [
  "地面",
  "超能力"
],
    "tier": "normal",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins,
    "lines": [ "石柱之间浮起一个陶偶，红点对着你逐个亮起。", "它把碎掉的柱子一块块吸到身边，围成了一圈。" ],
  },
  {
    "id": "bastiodon",
    "slug": "bastiodon",
    "name": "护城龙",
    "en": "Bastiodon",
    "dex": "0411",
    "types": [
  "岩石",
  "钢"
],
    "tier": "normal",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins,
    "lines": [ "它把那张大脸往下一放，整条路就堵死了。", "「今天不通行。」" ],
  },
  {
    "id": "bronzong",
    "slug": "bronzong",
    "name": "青铜钟",
    "en": "Bronzong",
    "dex": "0437",
    "types": [
  "钢",
  "超能"
],
    "tier": "normal",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins,
    "lines": [ "钟没被敲就响了，响得沙子都在跳。" ],
  },
  {
    "id": "metagross",
    "slug": "metagross",
    "name": "巨金怪",
    "en": "Metagross",
    "dex": "0376",
    "types": [
  "钢",
  "超能力"
],
    "tier": "elite",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins_hi,
    "signature": [ "sig_ancient_beam" ],
    "lines": [ "四根柱子同时浮了起来，柱子中间夹着一个铁青色的东西。", "它不看你，它在看整座遗迹，像是在清点什么。" ],
  },
  {
    "id": "regirock",
    "slug": "regirock",
    "name": "雷吉洛克",
    "en": "Regirock",
    "dex": "0377",
    "types": [
  "岩石"
],
    "tier": "elite",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_crystal_hi,
    "signature": [ "sig_ancient_beam" ],
    "lines": [ "石堆拼成了一个形状，形状睁开了眼。" ],
  },
  {
    "id": "rampardos",
    "slug": "rampardos",
    "name": "战槌龙",
    "en": "Rampardos",
    "dex": "0409",
    "types": [
  "岩石"
],
    "tier": "elite",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins_hi,
    "signature": [ "sig_ancient_beam" ],
    "lines": [ "它低下头，对着石墙开始加速。", "「……它是不是看不见我们？」" ],
  },
  {
    "id": "aegislash",
    "slug": "aegislash",
    "name": "坚盾剑怪",
    "en": "Aegislash",
    "dex": "0681",
    "types": [
  "钢",
  "幽灵"
],
    "tier": "elite",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins_hi,
    "signature": [ "sig_ancient_beam" ],
    "lines": [ "墙边那把旧剑自己转了个身，剑柄上的花纹睁开了眼。" ],
  },
  {
    "id": "armaldo",
    "slug": "armaldo",
    "name": "太古盔甲",
    "en": "Armaldo",
    "dex": "0348",
    "types": [
  "岩石",
  "虫"
],
    "tier": "elite",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_crystal_hi,
    "signature": [ "sig_ancient_beam" ],
    "lines": [ "它从沙里推开两块石板站起来，又把石板叠好放回原处。", "「……还挺讲究。」" ],
  },
  {
    "id": "regigigas",
    "slug": "regigigas",
    "name": "雷吉奇卡斯",
    "en": "Regigigas",
    "dex": "0486",
    "types": [
  "一般"
],
    "tier": "boss",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins_hi,
    "signature": [ "sig_pharaoh_curse" ],
    "lines": [ "整片遗迹的柱子同时往一个方向倒 —— 因为那个东西站起来了。", "「搬山的，是我。」" ],
    "bossTitle": "遗迹的巨人",
  },
  {
    "id": "tyrantrum",
    "slug": "tyrantrum",
    "name": "怪颚龙",
    "en": "Tyrantrum",
    "dex": "0697",
    "types": [
  "岩石",
  "龙"
],
    "tier": "boss",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_dragon_hi,
    "signature": [ "sig_tomb_curse" ],
    "lines": [ "最亮的那块水晶后面有东西站起来了，它一动，整片洞壁的光就全往它身上收。", "「……亮着的地方，都是我的。」" ],
    "bossTitle": "结晶的暴君",
  },
  {
    "id": "paras",
    "slug": "paras",
    "name": "派拉斯",
    "en": "Paras",
    "dex": "0046",
    "types": [
  "虫",
  "草"
],
    "tier": "mob",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_bug,
    "lines": [ "落叶底下有两只眼睛在看你，背上还长着蘑菇。", "它走过来的时候，蘑菇先动。" ],
  },
  {
    "id": "grimer",
    "slug": "grimer",
    "name": "臭泥",
    "en": "Grimer",
    "dex": "0088",
    "types": [
  "毒"
],
    "tier": "mob",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal,
    "lines": [ "一摊紫色的东西从水里浮起来，很礼貌地让开了半步。", "「……谢谢？」" ],
  },
  {
    "id": "shroomish",
    "slug": "shroomish",
    "name": "蘑蘑菇",
    "en": "Shroomish",
    "dex": "0285",
    "types": [
  "草"
],
    "tier": "mob",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal,
    "lines": [ "它蹲在树下生闷气，脚边的草全蔫了。" ],
  },
  {
    "id": "nincada",
    "slug": "nincada",
    "name": "土居忍士",
    "en": "Nincada",
    "dex": "0290",
    "types": [
  "虫",
  "地面"
],
    "tier": "mob",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal,
    "lines": [ "泥里钻出一层薄薄的壳，壳下面什么都没有。" ],
  },
  {
    "id": "dewpider",
    "slug": "dewpider",
    "name": "滴蛛",
    "en": "Dewpider",
    "dex": "0751",
    "types": [
  "水",
  "虫"
],
    "tier": "mob",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal,
    "lines": [ "它顶着一个水泡在草叶上走，水泡里还有另一双眼睛在看你。" ],
  },
  {
    "id": "foongus",
    "slug": "foongus",
    "name": "哎呀球菇",
    "en": "Foongus",
    "dex": "0590",
    "types": [
  "草",
  "毒"
],
    "tier": "mob",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal,
    "lines": [ "地上长着一排小球，其中一个眨了眨眼睛。", "它喷出一小团孢子，然后很期待地看着你。" ],
  },
  {
    "id": "goomy",
    "slug": "goomy",
    "name": "黏黏宝",
    "en": "Goomy",
    "dex": "0704",
    "types": [
  "龙"
],
    "tier": "mob",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal,
    "lines": [ "一摊会呼吸的黏液慢慢挪过来，身后留下一道亮痕。" ],
  },
  {
    "id": "morelull",
    "slug": "morelull",
    "name": "睡睡菇",
    "en": "Morelull",
    "dex": "0755",
    "types": [
  "草",
  "妖精"
],
    "tier": "mob",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal,
    "lines": [ "菌盖下面亮着几盏很小的灯，一盏一盏转向你。", "它走过的地方，孢子浮起来又慢慢落回去。" ],
  },
  {
    "id": "parasect",
    "slug": "parasect",
    "name": "派拉斯特",
    "en": "Parasect",
    "dex": "0047",
    "types": [
  "虫",
  "草"
],
    "tier": "normal",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_bug,
    "lines": [ "那只蘑菇现在长得比它的身子还大，而且看起来才是真正在走路的那个。" ],
  },
  {
    "id": "marshtomp",
    "slug": "marshtomp",
    "name": "沼跃鱼",
    "en": "Marshtomp",
    "dex": "0259",
    "types": [
  "水",
  "地面"
],
    "tier": "normal",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal,
    "lines": [ "它从泥水里站起来，甩了你一身泥。" ],
  },
  {
    "id": "toxicroak",
    "slug": "toxicroak",
    "name": "毒骷蛙",
    "en": "Toxicroak",
    "dex": "0454",
    "types": [
  "毒",
  "格斗"
],
    "tier": "normal",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_poison,
    "lines": [ "它收着下巴看你，喉咙上那块囊一鼓一鼓。" ],
  },
  {
    "id": "scolipede",
    "slug": "scolipede",
    "name": "蜈蚣王",
    "en": "Scolipede",
    "dex": "0545",
    "types": [
  "虫",
  "毒"
],
    "tier": "normal",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_poison,
    "lines": [ "湿泥像被什么东西从下面一节一节顶起来。", "它从泥里把自己拔出来，每一节都在往下滴东西。" ],
  },
  {
    "id": "beedrill",
    "slug": "beedrill",
    "name": "大针蜂",
    "en": "Beedrill",
    "dex": "0015",
    "types": [
  "虫",
  "毒"
],
    "tier": "elite",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal_hi,
    "lines": [ "嗡声从菌盖下面传出来，三根针先到。", "它把整片菌林的孢子搅成了一个旋，旋的中心是它。" ],
  },
  {
    "id": "quagsire",
    "slug": "quagsire",
    "name": "沼王",
    "en": "Quagsire",
    "dex": "0195",
    "types": [
  "水",
  "地面"
],
    "tier": "elite",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_poison_hi,
    "lines": [ "整片浅水底下都是它，你只看得到两只眼睛。" ],
  },
  {
    "id": "seismitoad",
    "slug": "seismitoad",
    "name": "蟾蜍王",
    "en": "Seismitoad",
    "dex": "0537",
    "types": [
  "水",
  "地面"
],
    "tier": "elite",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_poison_hi,
    "lines": [ "湿地里那些鼓包忽然一起转过来，全都对着你。" ],
  },
  {
    "id": "swalot",
    "slug": "swalot",
    "name": "吞食兽",
    "en": "Swalot",
    "dex": "0317",
    "types": [
  "毒"
],
    "tier": "elite",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal_hi,
    "lines": [ "一摊紫色的东西慢慢张开了嘴，嘴比它自己还大。" ],
  },
  {
    "id": "masquerain",
    "slug": "masquerain",
    "name": "雨翅蛾",
    "en": "Masquerain",
    "dex": "0284",
    "types": [
  "虫",
  "飞行"
],
    "tier": "elite",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal_hi,
    "lines": [ "它头顶那对花纹忽然全睁开了，湿地里一下安静下来。" ],
  },
  {
    "id": "breloom",
    "slug": "breloom",
    "name": "斗笠菇",
    "en": "Breloom",
    "dex": "0286",
    "types": [
  "草",
  "格斗"
],
    "tier": "boss",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal_hi,
    "signature": [ "sig_root_bind" ],
    "lines": [ "菌盖底下那两只手臂一直垂着，直到你踩进它的圈。" ],
    "bossTitle": "菌林的拳王",
  },
  {
    "id": "trevenant",
    "slug": "trevenant",
    "name": "朽木妖",
    "en": "Trevenant",
    "dex": "0709",
    "types": [
  "幽灵",
  "草"
],
    "tier": "boss",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal_hi,
    "signature": [ "sig_spore_fist" ],
    "lines": [ "整片菌林同时静了下来。最粗的那棵树转过身，树皮上全是眼睛一样的菌斑。「踩到我孩子了。」" ],
    "bossTitle": "菌林的看守",
  },
  {
    "id": "magnemite",
    "slug": "magnemite",
    "name": "小磁怪",
    "en": "Magnemite",
    "dex": "0081",
    "types": [
  "电",
  "钢"
],
    "tier": "mob",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_electric,
    "lines": [ "它飘在台地边缘，两边的磁铁一抖，你头发全立起来了。", "头顶亮了一下，它跟着亮了一下 —— 顺序反了。" ],
  },
  {
    "id": "mareep",
    "slug": "mareep",
    "name": "咩利羊",
    "en": "Mareep",
    "dex": "0179",
    "types": [
  "电"
],
    "tier": "mob",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_electric,
    "lines": [ "一团毛球蹲在岩缝里，毛越炸越开。", "它打了个喷嚏，旁边的草全趴下了。" ],
  },
  {
    "id": "elekid",
    "slug": "elekid",
    "name": "电击怪",
    "en": "Elekid",
    "dex": "0239",
    "types": [
  "电"
],
    "tier": "mob",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_electric,
    "lines": [ "它在雷声里晃着两根线，插头一直对着你转。" ],
  },
  {
    "id": "electrike",
    "slug": "electrike",
    "name": "落雷兽",
    "en": "Electrike",
    "dex": "0309",
    "types": [
  "电"
],
    "tier": "mob",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_electric,
    "lines": [ "它身上的毛全竖着，雷每响一次就往前冲一步。" ],
  },
  {
    "id": "emolga",
    "slug": "emolga",
    "name": "电飞鼠",
    "en": "Emolga",
    "dex": "0587",
    "types": [
  "电",
  "飞行"
],
    "tier": "mob",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_electric,
    "lines": [ "它张着翼膜挂在风里，像一张被雷照亮的纸。", "它从你头顶滑过去，你脖子后面的汗毛全竖了。" ],
  },
  {
    "id": "dedenne",
    "slug": "dedenne",
    "name": "咚咚鼠",
    "en": "Dedenne",
    "dex": "0702",
    "types": [
  "电",
  "妖精"
],
    "tier": "mob",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_electric,
    "lines": [ "岩缝里有个小东西，胡须上噼啪响。", "它把尾巴竖起来当引雷的杆，然后对着你。" ],
  },
  {
    "id": "togedemaru",
    "slug": "togedemaru",
    "name": "托戈德玛尔",
    "en": "Togedemaru",
    "dex": "0777",
    "types": [
  "电",
  "钢"
],
    "tier": "mob",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_electric,
    "lines": [ "一颗带刺的圆球滚过来，刺上全是细小的火花。", "它一缩，刺全立起来，火花串成了一圈。" ],
  },
  {
    "id": "pincurchin",
    "slug": "pincurchin",
    "name": "啪嚓海胆",
    "en": "Pincurchin",
    "dex": "0871",
    "types": [
  "电"
],
    "tier": "mob",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_electric,
    "lines": [ "石头上那团黑色的刺亮了一下。" ],
  },
  {
    "id": "raichu",
    "slug": "raichu",
    "name": "雷丘",
    "en": "Raichu",
    "dex": "0026",
    "types": [
  "电"
],
    "tier": "normal",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_flying,
    "lines": [ "它把尾巴往地上一插，脚下的地面就亮了。" ],
  },
  {
    "id": "electrode",
    "slug": "electrode",
    "name": "顽皮雷弹",
    "en": "Electrode",
    "dex": "0101",
    "types": [
  "电"
],
    "tier": "normal",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_weaken,
    "lines": [ "台地上滚过来一个圆球，边滚边笑。", "「……那东西在笑。」" ],
  },
  {
    "id": "manectric",
    "slug": "manectric",
    "name": "雷电兽",
    "en": "Manectric",
    "dex": "0310",
    "types": [
  "电"
],
    "tier": "normal",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_ghost,
    "lines": [ "它站的那块地一直在冒火花。" ],
  },
  {
    "id": "heliolisk",
    "slug": "heliolisk",
    "name": "光电伞蜥",
    "en": "Heliolisk",
    "dex": "0695",
    "types": [
  "电",
  "一般"
],
    "tier": "normal",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_flying,
    "lines": [ "它把脖子上那片东西撑开，雨在它身上分成了两半。" ],
  },
  {
    "id": "gyarados",
    "slug": "gyarados",
    "name": "暴鲤龙",
    "en": "Gyarados",
    "dex": "0130",
    "types": [
  "水",
  "飞行"
],
    "tier": "elite",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_water_hi,
    "signature": [ "sig_rage_wave" ],
    "lines": [ "水面被从下面顶开，一条蓝色的东西升起来，比你在沙丘上见过的任何东西都长。" ],
  },
  {
    "id": "electivire",
    "slug": "electivire",
    "name": "电击魔兽",
    "en": "Electivire",
    "dex": "0466",
    "types": [
  "电"
],
    "tier": "elite",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_electric_hi,
    "lines": [ "它把两条尾巴一碰，整个台地暗了一瞬。" ],
  },
  {
    "id": "vikavolt",
    "slug": "vikavolt",
    "name": "锹农炮虫",
    "en": "Vikavolt",
    "dex": "0738",
    "types": [
  "虫",
  "电"
],
    "tier": "elite",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_flying_hi,
    "lines": [ "它悬在半空，那道炮口一直对着你。" ],
  },
  {
    "id": "luxray",
    "slug": "luxray",
    "name": "伦琴猫",
    "en": "Luxray",
    "dex": "0405",
    "types": [
  "电"
],
    "tier": "elite",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_flying_hi,
    "lines": [ "台地上的雨全是斜的 —— 因为中间那东西一直在放电。" ],
  },
  {
    "id": "magnezone",
    "slug": "magnezone",
    "name": "自爆磁怪",
    "en": "Magnezone",
    "dex": "0462",
    "types": [
  "电",
  "钢"
],
    "tier": "elite",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_electric_hi,
    "lines": [ "它悬在半空慢慢转，把周围的雷都吸了过去。" ],
  },
  {
    "id": "ampharos",
    "slug": "ampharos",
    "name": "电龙",
    "en": "Ampharos",
    "dex": "0181",
    "types": [
  "电"
],
    "tier": "boss",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_electric_hi,
    "signature": [ "sig_lighthouse" ],
    "lines": [ "台地尽头立着一座旧灯塔，塔顶的灯亮了一下 —— 那不是灯，是它抬起了头。", "「站住。上面那道雷，是我点的。」" ],
    "bossTitle": "灯塔的守望者",
  },
  {
    "id": "zeraora",
    "slug": "zeraora",
    "name": "捷拉奥拉",
    "en": "Zeraora",
    "dex": "0807",
    "types": [
  "电"
],
    "tier": "boss",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_electric_hi,
    "signature": [ "sig_spark_ball" ],
    "lines": [ "雷还没落下来，先落在了一双脚上。", "「跑得比我快的人，我还没见过。」" ],
    "bossTitle": "雷暴的脚程",
  },
  {
    "id": "onix",
    "slug": "onix",
    "name": "大岩蛇",
    "en": "Onix",
    "dex": "0095",
    "types": [
  "岩石",
  "地面"
],
    "tier": "mob",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal,
    "lines": [ "洞顶那些石柱，原来不是石柱。" ],
  },
  {
    "id": "beldum",
    "slug": "beldum",
    "name": "铁哑铃",
    "en": "Beldum",
    "dex": "0374",
    "types": [
  "钢",
  "超能"
],
    "tier": "mob",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal,
    "lines": [ "一个铁块飘起来，用一只眼睛盯着你。" ],
  },
  {
    "id": "dwebble",
    "slug": "dwebble",
    "name": "石居蟹",
    "en": "Dwebble",
    "dex": "0557",
    "types": [
  "虫",
  "岩石"
],
    "tier": "mob",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal,
    "lines": [ "一块小石头自己在走，石头底下露出几条细细的腿。" ],
  },
  {
    "id": "druddigon",
    "slug": "druddigon",
    "name": "赤面龙",
    "en": "Druddigon",
    "dex": "0621",
    "types": [
  "龙"
],
    "tier": "mob",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_dragon,
    "lines": [ "洞顶不太平整的那一块掉了下来，落地时站直了。", "它脸上的红纹在晶光底下显得特别亮。" ],
  },
  {
    "id": "carbink",
    "slug": "carbink",
    "name": "小碎钻",
    "en": "Carbink",
    "dex": "0703",
    "types": [
  "岩石",
  "妖精"
],
    "tier": "mob",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal,
    "lines": [ "水晶后面滚出来一枚会眨眼的石头。", "它身上嵌满了碎晶，走一步响一下。" ],
  },
  {
    "id": "bergmite",
    "slug": "bergmite",
    "name": "冰宝",
    "en": "Bergmite",
    "dex": "0712",
    "types": [
  "冰"
],
    "tier": "mob",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal,
    "lines": [ "冰里那团东西翻了个身，把整块冰一起挪了。" ],
  },
  {
    "id": "noibat",
    "slug": "noibat",
    "name": "嗡蝠",
    "en": "Noibat",
    "dex": "0714",
    "types": [
  "飞行",
  "龙"
],
    "tier": "mob",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal,
    "lines": [ "洞顶挂着一小团黑，你走近它就醒了。" ],
  },
  {
    "id": "nacli",
    "slug": "nacli",
    "name": "盐石宝",
    "en": "Nacli",
    "dex": "0932",
    "types": [
  "岩石"
],
    "tier": "mob",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal,
    "lines": [ "晶壁上结着一粒粒发亮的东西，其中一粒在眨眼。" ],
  },
  {
    "id": "mawile",
    "slug": "mawile",
    "name": "大嘴娃",
    "en": "Mawile",
    "dex": "0303",
    "types": [
  "钢",
  "妖精"
],
    "tier": "normal",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_steel,
    "lines": [ "它回头对你笑了一下，然后它身后那张嘴也笑了。" ],
  },
  {
    "id": "metang",
    "slug": "metang",
    "name": "金属怪",
    "en": "Metang",
    "dex": "0375",
    "types": [
  "钢",
  "超能"
],
    "tier": "normal",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal,
    "lines": [ "两个铁块叠在一起，成了更大的一只。" ],
  },
  {
    "id": "avalugg",
    "slug": "avalugg",
    "name": "冰岩怪",
    "en": "Avalugg",
    "dex": "0713",
    "types": [
  "冰"
],
    "tier": "normal",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal,
    "lines": [ "一大块冰趴在洞底，仔细看是活的。" ],
  },
  {
    "id": "naclstack",
    "slug": "naclstack",
    "name": "盐石垒",
    "en": "Naclstack",
    "dex": "0933",
    "types": [
  "岩石"
],
    "tier": "normal",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_steel,
    "lines": [ "刚才那粒东西长大了，还叫来了同伴。" ],
  },
  {
    "id": "glalie",
    "slug": "glalie",
    "name": "冰鬼护",
    "en": "Glalie",
    "dex": "0362",
    "types": [
  "冰"
],
    "tier": "elite",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal_hi,
    "signature": [ "sig_meteor_mash" ],
    "lines": [ "洞里的冰面上浮出一张脸，转过来正对着你。" ],
  },
  {
    "id": "probopass",
    "slug": "probopass",
    "name": "大朝北鼻",
    "en": "Probopass",
    "dex": "0476",
    "types": [
  "岩石",
  "钢"
],
    "tier": "elite",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_bleed_hi,
    "signature": [ "sig_soul_flame" ],
    "lines": [ "那撮铁砂一直在转，最后全部指向你。" ],
  },
  {
    "id": "aurorus",
    "slug": "aurorus",
    "name": "冰雪巨龙",
    "en": "Aurorus",
    "dex": "0699",
    "types": [
  "岩石",
  "冰"
],
    "tier": "elite",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_ghost_hi,
    "signature": [ "sig_meteor_mash" ],
    "lines": [ "整面冰壁亮了 —— 光是从那副骨架里透出来的。" ],
  },
  {
    "id": "abomasnow",
    "slug": "abomasnow",
    "name": "暴雪王",
    "en": "Abomasnow",
    "dex": "0460",
    "types": [
  "草",
  "冰"
],
    "tier": "elite",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_bleed_hi,
    "signature": [ "sig_soul_flame" ],
    "lines": [ "洞里的冰壁上开始飘雪 —— 那棵树是自己走过来的。" ],
  },
  {
    "id": "froslass",
    "slug": "froslass",
    "name": "雪妖女",
    "en": "Froslass",
    "dex": "0478",
    "types": [
  "冰",
  "幽灵"
],
    "tier": "elite",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal_hi,
    "signature": [ "sig_meteor_mash" ],
    "lines": [ "冰面下那张脸一直跟着你移动，你停它也停。" ],
  },
  {
    "id": "kyurem",
    "slug": "kyurem",
    "name": "酋雷姆",
    "en": "Kyurem",
    "dex": "0646",
    "types": [
  "龙",
  "冰"
],
    "tier": "boss",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_dragon_hi,
    "signature": [ "sig_crystal_jaw" ],
    "lines": [ "洞的最深处没有回声，因为那里的冷把声音也冻住了。", "「……冷吗。我也冷。」" ],
    "bossTitle": "洞底的空壳",
  },
  {
    "id": "diancie",
    "slug": "diancie",
    "name": "蒂安希",
    "en": "Diancie",
    "dex": "0719",
    "types": [
  "岩石",
  "妖精"
],
    "tier": "boss",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_dragon_hi,
    "signature": [ "sig_crystal_fang" ],
    "lines": [ "最中间那块晶体自己转动起来，转出一圈光。", "「想要我头上的东西？先问过这面墙。」" ],
    "bossTitle": "结晶的公主",
  }
];

export const ENEMY_BY_ID = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
// #endregion GENERATED-ENEMIES

/**
 * 按章节和档位筛选敌人
 */
export function poolFor(biome, tier) {
  return ENEMIES.filter((e) => e.biome === biome && e.tier === tier);
}

/** 玩家战力评估：用于把敌人强度对齐到玩家实际成长水平 */
export function playerPower(stats) {
  return stats.atk + stats.def + stats.maxHp / 25 + stats.agi / 3;
}

/**
 * 难度缩放系数。
 * 为什么需要它：第二章的敌人数值是按「玩家拿了卡、加了属性」设计的，
 * 但如果这一局玩家没怎么成长（运气差、一直走事件），直接撞上第二章会毫无还手之力。
 * 所以按玩家实际战力与章节期望战力的比值，把敌人调弱一点（最低 0.62）或略强（最高 1.18）。
 */
export function powerFactor(stats, stage) {
  if (!stats) return 1;
  const ref = BALANCE.playerPowerRef[stage] ?? BALANCE.playerPowerRef[0];
  const ratio = playerPower(stats) / ref;
  const scaled = 0.62 + 0.38 * ratio;
  return Math.max(BALANCE.powerScaleMin, Math.min(BALANCE.powerScaleMax, scaled));
}

/**
 * 某一档敌人放在某一章时的**防御**。
 * scaleEnemy 和「卡面伤害估算」（战斗外拿它当参照防御）共用这一份 ——
 * 抄两遍的话，卡面数字会渐渐和实际打出来的对不上。
 */
export function enemyDefFor(tier, stage) {
  const t = TIERS[tier] ?? TIERS.normal;
  return Math.round(t.baseDef + stage * 1.5);
}

/** 计算实际数值：查 balance.js 的战力表 + 章内深度 + 玩家战力对齐 */
export function scaleEnemy(enemy, stage, nodeIndex, playerStats = null) {
  const tier = TIERS[enemy.tier];
  const hpTable = BALANCE.enemyHp[enemy.tier] ?? BALANCE.enemyHp.normal;
  const atkTable = BALANCE.enemyAtk[enemy.tier] ?? BALANCE.enemyAtk.normal;
  // 章节索引夹在表长范围内（扩章节时要同步加长 balance.js 里的表）
  const s = Math.max(0, Math.min(hpTable.length - 1, stage));

  const depthHp = 1 + nodeIndex * BALANCE.depthBonus;
  const depthAtk = 1 + nodeIndex * BALANCE.nodeAtkStep;
  const pf = powerFactor(playerStats, s);

  const hp = Math.max(10, Math.round(hpTable[s] * depthHp * pf));
  const atk = Math.max(2, Math.round(atkTable[s] * depthAtk * (0.85 + 0.15 * pf)));
  const def = enemyDefFor(enemy.tier, stage);
  const agi = Math.round(tier.agi[0] + Math.random() * (tier.agi[1] - tier.agi[0]) + stage * 1.5);

  return {
    hp, maxHp: hp, atk, def, agi,
    strength: 0, weak: 0, poison: 0, burn: 0, bleed: 0,
    shield: 0, defMod: 0, atkMod: 0, agiMod: 0, luckMod: 0,
    powerFactor: pf,
    tier: enemy.tier,
    tierName: tier.name,
    goldKind: tier.gold,
    rewardMult: tier.reward,
  };
}

export function biomeOf(key) {
  return BIOMES[key] ?? BIOMES.desert;
}
