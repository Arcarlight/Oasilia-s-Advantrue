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
    "id": "swablu",
    "slug": "swablu",
    "name": "青绵鸟",
    "en": "Swablu",
    "dex": "0333",
    "types": [
  "一般",
  "飞行"
],
    "tier": "mob",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_flying,
    "lines": [ "它把你的头巾当成了云，落在上面。", "它哼着歌，节奏很像沙漠蜻蜓的振翅声。" ],
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
    "id": "rhyhorn",
    "slug": "rhyhorn",
    "name": "独角犀牛",
    "en": "Rhyhorn",
    "dex": "0111",
    "types": [
  "地面",
  "岩石"
],
    "tier": "normal",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_ground,
    "lines": [ "地面开始有规律地抖动。" ],
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
    "signature": [ "sig_iron_tail_wall" ],
    "lines": [ "沙面裂开，一条铁铸的身躯从中升起。" ],
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
    "lines": [ "一道橙色的影子沿着峡谷壁跑了三个来回，然后停在你面前。" ],
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
    "tier": "elite",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_rock_hi,
    "lines": [ "天空一暗。有什么东西挡住了太阳。" ],
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
    "id": "larvitar",
    "slug": "larvitar",
    "name": "幼基拉斯",
    "en": "Larvitar",
    "dex": "0246",
    "types": [
  "岩石",
  "地面"
],
    "tier": "mob",
    "biome": "night",
    "deck": MOVE_POOLS.kit_rock,
    "lines": [ "沙里冒出一个脑袋，正在啃一块石头。" ],
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
    "biome": "night",
    "deck": MOVE_POOLS.kit_dragon,
    "lines": [ "它的爪子在星尘里划出三道亮痕。" ],
  },
  {
    "id": "rhydon",
    "slug": "rhydon",
    "name": "钻角犀兽",
    "en": "Rhydon",
    "dex": "0112",
    "types": [
  "地面",
  "岩石"
],
    "tier": "normal",
    "biome": "night",
    "deck": MOVE_POOLS.kit_ground,
    "lines": [ "大地像鼓一样响了一下。" ],
  },
  {
    "id": "salamence",
    "slug": "salamence",
    "name": "暴飞龙",
    "en": "Salamence",
    "dex": "0373",
    "types": [
  "龙",
  "飞行"
],
    "tier": "elite",
    "biome": "night",
    "deck": MOVE_POOLS.kit_dragon_hi,
    "lines": [ "它想飞，但这里没有天空。它决定先解决掉你。" ],
  },
  {
    "id": "machamp",
    "slug": "machamp",
    "name": "怪力",
    "en": "Machamp",
    "dex": "0068",
    "types": [
  "格斗"
],
    "tier": "elite",
    "biome": "night",
    "deck": MOVE_POOLS.kit_weaken_hi,
    "lines": [ "四条手臂同时向你比划「过来」。" ],
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
    "tier": "boss",
    "biome": "night",
    "deck": MOVE_POOLS.kit_steel_hi,
    "signature": [ "sig_meteor_mash" ],
    "lines": [ "一颗星星从天上掉下来，没有砸出坑，而是站了起来。" ],
    "bossTitle": "坠落的星",
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
    "biome": "forest",
    "deck": MOVE_POOLS.kit_bug,
    "lines": [ "落叶底下有两只眼睛在看你，背上还长着蘑菇。", "它走过来的时候，蘑菇先动。" ],
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
    "biome": "forest",
    "deck": MOVE_POOLS.kit_bug,
    "lines": [ "那只蘑菇现在长得比它的身子还大，而且看起来才是真正在走路的那个。" ],
  },
  {
    "id": "gloom",
    "slug": "gloom",
    "name": "臭臭花",
    "en": "Gloom",
    "dex": "0044",
    "types": [
  "草",
  "毒"
],
    "tier": "normal",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_grass,
    "lines": [ "空气里忽然有股说不上来的味道。你顺着味道找到了它。" ],
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
    "tier": "normal",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_bug,
    "lines": [ "嗡声是从上面来的。你抬头，看到三根针正对着你。" ],
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
    "lines": [ "两根角夹住了一棵小树，树断了。它转头看你，像是在问你有没有更硬的。" ],
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
    "lines": [ "它从树干里拔出一根角，树汁顺着角往下滴。它很有礼貌地等你准备好。" ],
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
    "id": "cloyster",
    "slug": "cloyster",
    "name": "刺甲贝",
    "en": "Cloyster",
    "dex": "0091",
    "types": [
  "水",
  "冰"
],
    "tier": "normal",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water,
    "lines": [ "礁石上那朵「花」张开了，里面全是尖的。" ],
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
    "lines": [ "一只钳子砸在盐壳上，盐壳裂了一条缝。它比你高。" ],
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
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water_hi,
    "signature": [ "sig_rage_wave" ],
    "lines": [ "水面被从下面顶开，一条蓝色的东西升起来，比你在沙丘上见过的任何东西都长。" ],
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
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_rock,
    "lines": [ "你差点一脚踩上去。它睁眼，很不高兴。", "它把自己从岩壁上掰下来，跳到你面前。" ],
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
    "lines": [ "崖壁上倒挂着一只天蝎王，比你见过的大三倍，尾巴上挂着碎石。" ],
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
    "id": "sandslash_night",
    "slug": "sandslash",
    "name": "穿山王",
    "en": "Sandslash",
    "dex": "0028",
    "types": [
  "地面"
],
    "tier": "mob",
    "biome": "night",
    "deck": MOVE_POOLS.kit_ground,
    "lines": [ "夜里的背刺反着星光，像一排小小的路灯。", "它从沙里只露出背，正在慢慢接近。" ],
  },
  {
    "id": "pupitar_night",
    "slug": "pupitar",
    "name": "沙基拉斯",
    "en": "Pupitar",
    "dex": "0247",
    "types": [
  "岩石",
  "地面"
],
    "tier": "normal",
    "biome": "night",
    "deck": MOVE_POOLS.kit_rock,
    "lines": [ "沙里有个硬壳在震，里面的东西还没出来，但已经很生气了。" ],
  },
  {
    "id": "steelix_night",
    "slug": "steelix",
    "name": "大钢蛇",
    "en": "Steelix",
    "dex": "0208",
    "types": [
  "钢",
  "地面"
],
    "tier": "elite",
    "biome": "night",
    "deck": MOVE_POOLS.kit_steel_hi,
    "lines": [ "地底传来很长的一串响。等它出来的时候，你已经在它的影子里了。" ],
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
    "id": "mudbray",
    "slug": "mudbray",
    "name": "泥驴仔",
    "en": "Mudbray",
    "dex": "0749",
    "types": [
  "地面"
],
    "tier": "mob",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_ground,
    "lines": [ "它拖着一身干泥走过来，看起来不太高兴被打扰。", "它喷了口气，脚下就多了一个小坑。" ],
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
    "deck": MOVE_POOLS.kit_poison_hi,
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
    "id": "buneary",
    "slug": "buneary",
    "name": "卷卷耳",
    "en": "Buneary",
    "dex": "0427",
    "types": [
  "一般"
],
    "tier": "mob",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_normal,
    "lines": [ "一只毛球在碎石堆里滚，滚到你面前停住了。", "它把一只耳朵卷起来又放开，像在量你有多高。" ],
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
    "signature": [ "sig_sand_pit" ],
    "lines": [ "沙丘自己站了起来。原来那不是沙丘。", "它张开嘴，风里全是沙在磨牙的声音。" ],
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
    "tier": "elite",
    "biome": "desert",
    "deck": MOVE_POOLS.kit_ground_hi,
    "signature": [ "sig_ancient_beam" ],
    "lines": [ "半埋在沙里的陶偶睁开了身上的红点。", "它悬在半空，像是很久以前有人把它留在这里看着什么。" ],
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
    "signature": [ "sig_magma_erupt" ],
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
    "signature": [ "sig_white_smoke" ],
    "lines": [ "一团白烟沿着谷底滚过来，烟里有壳。", "它不动，但它周围的空气在抖。" ],
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
    "signature": [ "sig_bullet_slash" ],
    "lines": [ "一片叶子从中间分成两半，切口是直的。", "它抬起钳子，钳口上还挂着露水。" ],
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
    "tier": "elite",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_poison_hi,
    "signature": [ "sig_megahorn_charge" ],
    "lines": [ "地面的落叶像被什么东西从下面顶起来。", "一节一节地，它从腐叶里把自己拔出来。" ],
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
    "signature": [ "sig_dragon_water" ],
    "lines": [ "退潮之后，盐壳底下还有一汪水，水里有一个影子在转。", "它抬起头，整片盐海的水都跟着晃了一下。" ],
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
    "signature": [ "sig_tide_ride" ],
    "lines": [ "一只翅膀贴着水面滑过去，没有溅起水花。", "它绕回来的时候，你才看清那对翅膀有多宽。" ],
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
    "id": "archeops",
    "slug": "archeops",
    "name": "始祖大鸟",
    "en": "Archeops",
    "dex": "0567",
    "types": [
  "岩石",
  "飞行"
],
    "tier": "elite",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_rock_hi,
    "signature": [ "sig_rock_slide_wing" ],
    "lines": [ "岩缝里卡着一副骨架，骨架动了一下。", "它飞得歪歪扭扭，但每一下都很快。" ],
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
    "signature": [ "sig_soul_flame" ],
    "lines": [ "远处有一盏灯，你以为那是营地。", "走近了才看出，那盏灯在飘，而且它在等你走近。" ],
  },
  {
    "id": "cofagrigus",
    "slug": "cofagrigus",
    "name": "死神棺",
    "en": "Cofagrigus",
    "dex": "0563",
    "types": [
  "幽灵"
],
    "tier": "elite",
    "biome": "night",
    "deck": MOVE_POOLS.kit_debuff_hi,
    "signature": [ "sig_curse_mummy" ],
    "lines": [ "一具石棺立在沙里，棺盖是开着的。", "棺里伸出来的不是手，是别的什么。" ],
  },
  {
    "id": "geodude_ruins",
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
    "deck": MOVE_POOLS.kit_ruins,
    "lines": [ "它半埋在一根断柱底下，你差点把它当成柱子的底座。", "它把身上的沙抖下来，抖出一小片灰。" ],
  },
  {
    "id": "yamask_ruins",
    "slug": "yamask",
    "name": "哭哭面具",
    "en": "Yamask",
    "dex": "0562",
    "types": [
  "幽灵"
],
    "tier": "mob",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins,
    "lines": [ "墙上的图忽然少了一块，那块图正举在它手里。", "它把面具转过来对着你，面具上的眼睛是干的。" ],
  },
  {
    "id": "sandslash_ruins",
    "slug": "sandslash",
    "name": "穿山王",
    "en": "Sandslash",
    "dex": "0028",
    "types": [
  "地面"
],
    "tier": "mob",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins,
    "lines": [ "它从柱廊的影子里走出来，背刺上挂着一层细沙。", "它的爪子在人写字的地方停了一下，然后继续往前走。" ],
  },
  {
    "id": "lunatone_ruins",
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
    "id": "sableye_ruins",
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
    "id": "sandygast_ruins",
    "slug": "sandygast",
    "name": "沙丘娃",
    "en": "Sandygast",
    "dex": "0769",
    "types": [
  "幽灵",
  "地面"
],
    "tier": "mob",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins,
    "lines": [ "柱基旁边有一小堆沙，堆顶张开了半个口。", "风把沙吹散了一层，沙堆底下还是沙堆。" ],
  },
  {
    "id": "claydol_ruins",
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
    "deck": MOVE_POOLS.kit_ruins_hi,
    "lines": [ "石柱之间浮起一个陶偶，红点对着你逐个亮起。", "它把碎掉的柱子一块块吸到身边，围成了一圈。" ],
  },
  {
    "id": "cofagrigus_ruins",
    "slug": "cofagrigus",
    "name": "死神棺",
    "en": "Cofagrigus",
    "dex": "0563",
    "types": [
  "幽灵"
],
    "tier": "normal",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_debuff_hi,
    "lines": [ "柱基上放着一口石棺，棺盖是合着的 —— 但棺缝里在漏沙。", "棺盖自己滑开了一条缝，缝里伸出来的东西不像手。" ],
  },
  {
    "id": "graveler_ruins",
    "slug": "graveler",
    "name": "隆隆石",
    "en": "Graveler",
    "dex": "0075",
    "types": [
  "岩石",
  "地面"
],
    "tier": "normal",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins,
    "lines": [ "一整段断柱站了起来，抖掉沙，露出四只手臂。", "它滚过来的时候，把地上那行刻字碾平了。" ],
  },
  {
    "id": "steelix_ruins",
    "slug": "steelix",
    "name": "大钢蛇",
    "en": "Steelix",
    "dex": "0208",
    "types": [
  "钢",
  "地面"
],
    "tier": "elite",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_ruins_hi,
    "signature": [ "sig_ancient_beam" ],
    "lines": [ "你脚下的沙开始往下漏，漏出来的是一条铁铸的身躯。", "它从遗迹底下穿过去，把一排柱子抬高了半寸。" ],
  },
  {
    "id": "solrock_ruins",
    "slug": "solrock",
    "name": "太阳岩",
    "en": "Solrock",
    "dex": "0338",
    "types": [
  "岩石",
  "超能力"
],
    "tier": "elite",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_crystal_hi,
    "lines": [ "整座遗迹忽然亮起来，因为柱顶那块石头转到了正对太阳的角度。", "它把光聚成一条线，线落在你脚边，冒了一点烟。" ],
  },
  {
    "id": "metagross_ruins",
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
    "deck": MOVE_POOLS.kit_crystal_hi,
    "lines": [ "四根柱子同时浮了起来，柱子中间夹着一个铁青色的东西。", "它不看你，它在看整座遗迹，像是在清点什么。" ],
  },
  {
    "id": "tyranitar_ruins",
    "slug": "tyranitar",
    "name": "班基拉斯",
    "en": "Tyranitar",
    "dex": "0248",
    "types": [
  "岩石",
  "恶"
],
    "tier": "boss",
    "biome": "ruins",
    "deck": MOVE_POOLS.kit_crystal_hi,
    "signature": [ "sig_pharaoh_curse" ],
    "lines": [ "风停了。柱廊尽头有个东西站起来，把整片沙都带了起来。", "「这里的东西，一件都不准带走。」" ],
    "bossTitle": "遗迹的守门人",
  },
  {
    "id": "foongus_fungal",
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
    "id": "morelull_fungal",
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
    "id": "paras_fungal",
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
    "deck": MOVE_POOLS.kit_fungal,
    "lines": [ "落叶下面的那两只眼睛，背上顶着一朵比别人都大的菌盖。", "它走一步，菌盖就往下滴一点发光的汁。" ],
  },
  {
    "id": "fomantis_fungal",
    "slug": "fomantis",
    "name": "伪螳草",
    "en": "Fomantis",
    "dex": "0753",
    "types": [
  "草"
],
    "tier": "mob",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal,
    "lines": [ "一株草举着两把刀，刀口上沾着孢子。", "它先在菌盖上擦了擦刀，再对着你。" ],
  },
  {
    "id": "grubbin_fungal",
    "slug": "grubbin",
    "name": "强颚鸡母虫",
    "en": "Grubbin",
    "dex": "0736",
    "types": [
  "虫"
],
    "tier": "mob",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal,
    "lines": [ "湿泥里伸出一对大颚，颚上还挂着菌丝。", "它在啃一根倒下的树干，树干里全是菌。" ],
  },
  {
    "id": "beedrill_fungal",
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
    "id": "weedle_fungal",
    "slug": "weedle",
    "name": "独角虫",
    "en": "Weedle",
    "dex": "0013",
    "types": [
  "虫",
  "毒"
],
    "tier": "mob",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal,
    "lines": [ "树干上有一条黄色的东西在往上爬，爬到菌盖底下停住了。", "它头上的角对着你，角尖上挂着一滴发光的汁。" ],
  },
  {
    "id": "parasect_fungal",
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
    "deck": MOVE_POOLS.kit_fungal_hi,
    "lines": [ "那朵菌盖现在比它整个身体都大，而且明显是菌盖在决定往哪走。", "它停下来的时候，周围的孢子全部朝它飘过去。" ],
  },
  {
    "id": "gloom_fungal",
    "slug": "gloom",
    "name": "臭臭花",
    "en": "Gloom",
    "dex": "0044",
    "types": [
  "草",
  "毒"
],
    "tier": "normal",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal,
    "lines": [ "湿地的味道忽然浓了三倍，你顺着味道找到了它。", "它嘴角挂着一点黏黏的东西，正在往下滴。" ],
  },
  {
    "id": "scolipede_fungal",
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
    "deck": MOVE_POOLS.kit_poison_hi,
    "lines": [ "湿泥像被什么东西从下面一节一节顶起来。", "它从泥里把自己拔出来，每一节都在往下滴东西。" ],
  },
  {
    "id": "breloom_fungal",
    "slug": "breloom",
    "name": "斗笠菇",
    "en": "Breloom",
    "dex": "0286",
    "types": [
  "草",
  "格斗"
],
    "tier": "elite",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_fungal_hi,
    "lines": [ "菌盖下面的身体比看起来结实得多，它一路走过来，泥都被踩实了。", "它甩了甩尾巴上的孢子，摆了一个很像起手的架势。" ],
  },
  {
    "id": "mareanie_fungal",
    "slug": "mareanie",
    "name": "好坏星",
    "en": "Mareanie",
    "dex": "0747",
    "types": [
  "水",
  "毒"
],
    "tier": "elite",
    "biome": "fungal",
    "deck": MOVE_POOLS.kit_poison_hi,
    "lines": [ "水洼里那团东西长满了菌丝，触手一动，菌丝就跟着飘。", "它把触手伸进泥里，泥面立刻冒了一层泡。" ],
  },
  {
    "id": "trevenant_fungal",
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
    "signature": [ "sig_root_bind" ],
    "lines": [ "整片菌林同时静了下来。最粗的那棵树转过身，树皮上全是眼睛一样的菌斑。「踩到我孩子了。」" ],
    "bossTitle": "菌林的看守",
  },
  {
    "id": "magnemite_storm",
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
    "id": "mareep_storm",
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
    "id": "emolga_storm",
    "slug": "emolga",
    "name": "导电飞鼠",
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
    "id": "togedemaru_storm",
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
    "id": "dedenne_storm",
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
    "id": "swablu_storm",
    "slug": "swablu",
    "name": "青绵鸟",
    "en": "Swablu",
    "dex": "0333",
    "types": [
  "一般",
  "飞行"
],
    "tier": "normal",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_flying,
    "lines": [ "它顶着风停在半空，身上的绒被吹成一个团。", "它落到岩尖上，把翅膀上的水抖成一小片雾。" ],
  },
  {
    "id": "fearow_storm",
    "slug": "fearow",
    "name": "大嘴雀",
    "en": "Fearow",
    "dex": "0022",
    "types": [
  "一般",
  "飞行"
],
    "tier": "normal",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_weaken,
    "lines": [ "它借着风一路直冲上来，落地的声音比雷还早。", "它把长喙对着你，像是已经量过你有多高。" ],
  },
  {
    "id": "woobat_storm",
    "slug": "woobat",
    "name": "滚滚蝙蝠",
    "en": "Woobat",
    "dex": "0527",
    "types": [
  "超能力",
  "飞行"
],
    "tier": "normal",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_ghost,
    "lines": [ "岩洞口的回声一次比一次近，你终于看清是它在听。", "它倒挂着，耳朵对着雷声，也对着你。" ],
  },
  {
    "id": "remoraid_storm",
    "slug": "remoraid",
    "name": "铁炮鱼",
    "en": "Remoraid",
    "dex": "0223",
    "types": [
  "水"
],
    "tier": "elite",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_electric_hi,
    "lines": [ "台地上的水洼里有一条铁炮鱼，它把水吸满了，一直在等雷。", "雷落下来的那一瞬间，它开火了。" ],
  },
  {
    "id": "gyarados_storm",
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
    "lines": [ "云底下的水里升起一条蓝色的身影，它比云还高一点。", "它抬起头，台地上所有水洼一起震了一下。" ],
  },
  {
    "id": "kingdra_storm",
    "slug": "kingdra",
    "name": "刺龙王",
    "en": "Kingdra",
    "dex": "0230",
    "types": [
  "水",
  "龙"
],
    "tier": "elite",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_water_hi,
    "lines": [ "积水的中央有个漩涡在转，转得比风雨还稳。", "它抬起头，台地上空的云跟着转了一下。" ],
  },
  {
    "id": "braviary_storm",
    "slug": "braviary",
    "name": "勇士雄鹰",
    "en": "Braviary",
    "dex": "0628",
    "types": [
  "一般",
  "飞行"
],
    "tier": "elite",
    "biome": "storm",
    "deck": MOVE_POOLS.kit_flying_hi,
    "lines": [ "风把它托在台地最高处，它没有扇翅膀。", "雷在它背后炸开，它连头都没回。" ],
  },
  {
    "id": "ampharos_storm",
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
    "id": "carbink_crystal",
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
    "id": "geodude_crystal",
    "slug": "geodude",
    "name": "小拳石",
    "en": "Geodude",
    "dex": "0074",
    "types": [
  "岩石",
  "地面"
],
    "tier": "mob",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal,
    "lines": [ "洞壁上一块「水晶」动了一下，原来是个睡着的家伙。", "它把自己从晶簇里掰出来，掉了一地碎晶。" ],
  },
  {
    "id": "lunatone_crystal",
    "slug": "lunatone",
    "name": "月石",
    "en": "Lunatone",
    "dex": "0337",
    "types": [
  "岩石",
  "超能力"
],
    "tier": "mob",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal,
    "lines": [ "洞顶垂下来一块石头，它是倒着长的。", "洞壁的亮跟着它转了半圈。" ],
  },
  {
    "id": "solrock_crystal",
    "slug": "solrock",
    "name": "太阳岩",
    "en": "Solrock",
    "dex": "0338",
    "types": [
  "岩石",
  "超能力"
],
    "tier": "mob",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal,
    "lines": [ "洞窟深处那块最亮的水晶忽然移开了。", "它把光聚成一条线，扫过整面洞壁，最后停在你身上。" ],
  },
  {
    "id": "druddigon_crystal",
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
    "id": "honedge_crystal",
    "slug": "honedge",
    "name": "独剑鞘",
    "en": "Honedge",
    "dex": "0679",
    "types": [
  "钢",
  "幽灵"
],
    "tier": "normal",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_steel,
    "lines": [ "水晶簇里插着一把剑，剑柄上的布条在无风的时候飘了一下。", "你还没靠近，剑自己从晶簇里拔了出来。" ],
  },
  {
    "id": "steelix_crystal",
    "slug": "steelix",
    "name": "大钢蛇",
    "en": "Steelix",
    "dex": "0208",
    "types": [
  "钢",
  "地面"
],
    "tier": "normal",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal_hi,
    "signature": [ "sig_iron_tail_wall" ],
    "lines": [ "整面洞壁在动，你这才发现那面墙其实是一段身子。", "它从晶层里抽出来，晶簇像碎冰一样往下掉。" ],
  },
  {
    "id": "claydol_crystal",
    "slug": "claydol",
    "name": "念力土偶",
    "en": "Claydol",
    "dex": "0344",
    "types": [
  "地面",
  "超能力"
],
    "tier": "normal",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal_hi,
    "lines": [ "水晶中间封着一个陶偶，封它的那块晶正在裂。", "它悬在半空，红点一颗颗亮起来，洞壁跟着亮了一整圈。" ],
  },
  {
    "id": "gliscor_crystal",
    "slug": "gliscor",
    "name": "天蝎王",
    "en": "Gliscor",
    "dex": "0472",
    "types": [
  "地面",
  "飞行"
],
    "tier": "elite",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_bleed_hi,
    "lines": [ "一块倒挂的水晶动了，它挂在那里，尾巴上勾着一片碎晶。", "它从洞顶滑下来，一路上刮掉了三根晶柱。" ],
  },
  {
    "id": "metagross_crystal",
    "slug": "metagross",
    "name": "巨金怪",
    "en": "Metagross",
    "dex": "0376",
    "types": [
  "钢",
  "超能力"
],
    "tier": "elite",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_crystal_hi,
    "signature": [ "sig_meteor_mash" ],
    "lines": [ "洞窟最宽的地方，四只脚压出四个坑，它一直站在那里。", "它转过来看你的时候，整片水晶都跟着俯了一下。" ],
  },
  {
    "id": "chandelure_crystal",
    "slug": "chandelure",
    "name": "水晶灯火灵",
    "en": "Chandelure",
    "dex": "0609",
    "types": [
  "幽灵",
  "火"
],
    "tier": "elite",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_ghost_hi,
    "signature": [ "sig_soul_flame" ],
    "lines": [ "洞顶垂着的「水晶」中有一盏在飘，而且它的光是暖的。", "它从晶簇之间穿过去，水晶一点都没碰到。" ],
  },
  {
    "id": "tyrantrum_crystal",
    "slug": "tyrantrum",
    "name": "怪颚龙",
    "en": "Tyrantrum",
    "dex": "0697",
    "types": [
  "岩石",
  "龙"
],
    "tier": "boss",
    "biome": "crystal",
    "deck": MOVE_POOLS.kit_dragon_hi,
    "signature": [ "sig_crystal_jaw" ],
    "lines": [ "最亮的那块水晶后面有东西站起来了，它一动，整片洞壁的光就全往它身上收。", "「……亮着的地方，都是我的。」" ],
    "bossTitle": "结晶的暴君",
  },
  {
    "id": "aerodactyl_alpha",
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
    "id": "rhydon_warden",
    "slug": "rhydon",
    "name": "钻角犀兽",
    "en": "Rhydon",
    "dex": "0112",
    "types": [
  "地面",
  "岩石"
],
    "tier": "boss",
    "biome": "canyon",
    "deck": MOVE_POOLS.kit_ground_hi,
    "signature": [ "sig_horn_drill" ],
    "lines": [ "整条峡谷响了一下。它站在谷口，角上还挂着刚凿下来的岩片。", "它把岩壁又凿深了一寸，然后转向你。" ],
    "bossTitle": "赤岩的凿子",
  },
  {
    "id": "scizor_warden",
    "slug": "scizor",
    "name": "巨钳螳螂",
    "en": "Scizor",
    "dex": "0212",
    "types": [
  "虫",
  "钢"
],
    "tier": "boss",
    "biome": "forest",
    "deck": MOVE_POOLS.kit_bug_hi,
    "signature": [ "sig_double_claw" ],
    "lines": [ "两排树同时倒向两边，切口是直的。它停在路中间等你。", "它把钳子举起来，钳口上的光比露水冷。" ],
    "bossTitle": "林中的剪刀",
  },
  {
    "id": "gyarados_warden",
    "slug": "gyarados",
    "name": "暴鲤龙",
    "en": "Gyarados",
    "dex": "0130",
    "types": [
  "水",
  "飞行"
],
    "tier": "boss",
    "biome": "tide",
    "deck": MOVE_POOLS.kit_water_hi,
    "signature": [ "sig_tidal_rage" ],
    "lines": [ "退潮退到一半停住了 —— 不是潮停了，是水被什么东西抬住了。", "它立起来，盐壳从它身上一片片往下掉。" ],
    "bossTitle": "盐海的怒潮",
  },
  {
    "id": "braviary_warden",
    "slug": "braviary",
    "name": "勇士雄鹰",
    "en": "Braviary",
    "dex": "0628",
    "types": [
  "一般",
  "飞行"
],
    "tier": "boss",
    "biome": "cliff",
    "deck": MOVE_POOLS.kit_flying_hi,
    "signature": [ "sig_war_banner" ],
    "lines": [ "崖口上插着一面「旗」。风吹了很久，它一动没动。", "你走近了才看清，那面旗一直在看你。" ],
    "bossTitle": "峭壁的战旗",
  },
  {
    "id": "chandelure_warden",
    "slug": "chandelure",
    "name": "水晶灯火灵",
    "en": "Chandelure",
    "dex": "0609",
    "types": [
  "幽灵",
  "火"
],
    "tier": "boss",
    "biome": "night",
    "deck": MOVE_POOLS.kit_ghost_hi,
    "signature": [ "sig_soul_lantern" ],
    "lines": [ "远处那盏灯一路把你引到这儿，然后停住了 —— 它一直没打算让你走出去。", "「跟了这么久，不差最后一段。」" ],
    "bossTitle": "引路的灯",
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
