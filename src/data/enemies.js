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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.strong,
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
    "deck": MOVE_POOLS.strong,
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
    "deck": MOVE_POOLS.strong,
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
    "deck": MOVE_POOLS.strong,
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
    "deck": MOVE_POOLS.elite,
    "lines": [ "沙面裂开，一条由铁组成的蛇从中升起。" ],
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
    "deck": MOVE_POOLS.boss,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.strong,
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
    "deck": MOVE_POOLS.strong,
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
    "deck": MOVE_POOLS.strong,
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
    "deck": MOVE_POOLS.elite,
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
    "deck": MOVE_POOLS.elite,
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
    "deck": MOVE_POOLS.boss,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.strong,
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
    "deck": MOVE_POOLS.strong,
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
    "deck": MOVE_POOLS.elite,
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
    "deck": MOVE_POOLS.elite,
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
    "deck": MOVE_POOLS.boss,
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
    "deck": MOVE_POOLS.boss,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.forest_mid,
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
    "deck": MOVE_POOLS.forest_mid,
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
    "deck": MOVE_POOLS.forest_mid,
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
    "deck": MOVE_POOLS.elite,
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
    "deck": MOVE_POOLS.elite,
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
    "deck": MOVE_POOLS.boss,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.weak,
    "lines": [ "一条鱼把水吸进嘴里，然后对着你吐了出来。", "它瞄准的时候会歪一下头。" ],
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
    "deck": MOVE_POOLS.tide_mid,
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
    "deck": MOVE_POOLS.tide_mid,
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
    "deck": MOVE_POOLS.tide_mid,
    "lines": [ "它把一只螃蟹的壳拆开，扔在一边，然后看向你。" ],
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
    "deck": MOVE_POOLS.elite,
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
    "deck": MOVE_POOLS.elite,
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
    "deck": MOVE_POOLS.boss,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.weak,
    "lines": [ "一只鸟在你的头顶绕圈，一圈比一圈低。", "它落在岩架上，用一只眼睛看你。" ],
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.cliff_mid,
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
    "deck": MOVE_POOLS.cliff_mid,
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
    "deck": MOVE_POOLS.cliff_mid,
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
    "deck": MOVE_POOLS.elite,
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
    "deck": MOVE_POOLS.elite,
    "lines": [ "崖壁上倒挂着一只天蝎，比你见过的大三倍，尾巴上挂着碎石。" ],
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
    "deck": MOVE_POOLS.boss,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.strong,
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
    "deck": MOVE_POOLS.elite,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.basic,
    "lines": [ "树干上贴着一只小蜥蜴，尾巴上还挂着一片叶子。", "它从树上一路滑下来，落地时几乎没有声音。" ],
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.basic,
    "lines": [ "一小群鱼挤在一起，挤成了一个比它们单个大得多的形状。", "它们同时转向你，整齐得有点吓人。" ],
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.weak,
    "lines": [ "一只小鸟在风口上挂着不动，尾巴上的红羽毛很显眼。", "它冲你叫了两声，声音比它自己大。" ],
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.weak,
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
    "deck": MOVE_POOLS.basic,
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
    "deck": MOVE_POOLS.basic,
    "lines": [ "岩屑堆里钻出一个脑袋，它把爪子上的灰抖了抖。", "它一头扎进岩缝，再从你脚边冒出来。" ],
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
  const def = Math.round(tier.baseDef + stage * 1.5);
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
