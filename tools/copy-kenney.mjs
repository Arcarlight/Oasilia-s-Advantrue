// 从工作区的 Kenney 素材包中挑选本作需要的素材，复制到 assets/ 下并统一命名。
// 用法: node tools/copy-kenney.mjs   (在项目根目录执行)
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const ASSETS = path.join(ROOT, 'assets');

const GAME_ICONS = path.join(ROOT, 'kenney_game-icons', 'PNG', 'White', '1x');
const GAME_ICONS2 = path.join(ROOT, 'kenney_game-icons-expansion', 'PNG', 'White', '1x');
const BOARD = path.join(ROOT, 'kenney_board-game-icons', 'PNG', 'Default (64px)');
const BOARD2 = path.join(ROOT, 'kenney_board-game-icons', 'PNG', 'Double (128px)');
const BOARD_ICON2 = path.join(ROOT, 'kenney_board-game-icons', 'PNG', 'Double (128px)');
const IFACE = path.join(ROOT, 'kenney_interface-sounds', 'Audio');
const BOARD_SND = path.join(ROOT, 'kenney_boardgame-pack', 'Bonus');
const PARTICLES = path.join(ROOT, 'kenney_particle-pack', 'PNG (Transparent)');
const RPG_UI = path.join(ROOT, 'kenney_ui-pack-rpg-expansion', 'PNG');
const PIXEL_UI = path.join(ROOT, 'kenney_pixel-ui-pack', 'PNG');
const FANTASY = path.join(ROOT, 'kenney_fantasy-ui-borders', 'PNG', 'Default');
/** 制图包（地图上的装饰物：树 / 岩 / 屋 / 湖…）。按地图主题挑，见下面的 jobs。 */
const CARTO = path.join(ROOT, 'kenney_cartography-pack', 'PNG', 'Default');

/** @type {{from:string[], to:string, dir:string}[]} */
const jobs = [
  // ---- 界面音效 ----
  { dir: 'audio/sfx', to: 'ui_click.ogg', from: [path.join(IFACE, 'click_001.ogg')] },
  { dir: 'audio/sfx', to: 'ui_click2.ogg', from: [path.join(IFACE, 'click_003.ogg')] },
  { dir: 'audio/sfx', to: 'ui_hover.ogg', from: [path.join(IFACE, 'select_001.ogg')] },
  { dir: 'audio/sfx', to: 'ui_confirm.ogg', from: [path.join(IFACE, 'confirmation_001.ogg')] },
  { dir: 'audio/sfx', to: 'ui_error.ogg', from: [path.join(IFACE, 'error_004.ogg')] },
  { dir: 'audio/sfx', to: 'ui_open.ogg', from: [path.join(IFACE, 'open_001.ogg')] },
  { dir: 'audio/sfx', to: 'ui_close.ogg', from: [path.join(IFACE, 'close_001.ogg')] },
  { dir: 'audio/sfx', to: 'ui_switch.ogg', from: [path.join(IFACE, 'switch_002.ogg')] },
  { dir: 'audio/sfx', to: 'ui_toggle.ogg', from: [path.join(IFACE, 'toggle_001.ogg')] },
  { dir: 'audio/sfx', to: 'ui_pluck.ogg', from: [path.join(IFACE, 'pluck_001.ogg')] },
  { dir: 'audio/sfx', to: 'ui_question.ogg', from: [path.join(IFACE, 'question_001.ogg')] },
  { dir: 'audio/sfx', to: 'ui_bong.ogg', from: [path.join(IFACE, 'bong_001.ogg')] },
  { dir: 'audio/sfx', to: 'ui_glitch.ogg', from: [path.join(IFACE, 'glitch_001.ogg')] },
  { dir: 'audio/sfx', to: 'ui_maximize.ogg', from: [path.join(IFACE, 'maximize_002.ogg')] },
  { dir: 'audio/sfx', to: 'card_place.ogg', from: [path.join(BOARD_SND, 'cardPlace1.ogg')] },
  { dir: 'audio/sfx', to: 'card_slide.ogg', from: [path.join(BOARD_SND, 'cardSlide1.ogg')] },
  { dir: 'audio/sfx', to: 'card_slide2.ogg', from: [path.join(BOARD_SND, 'cardSlide3.ogg')] },
  { dir: 'audio/sfx', to: 'chips.ogg', from: [path.join(BOARD_SND, 'chipsCollide1.ogg')] },
  { dir: 'audio/sfx', to: 'dice.ogg', from: [path.join(BOARD_SND, 'dieThrow1.ogg')] },
  { dir: 'audio/sfx', to: 'shuffle.ogg', from: [path.join(BOARD_SND, 'dieShuffle1.ogg')] },
  { dir: 'audio/sfx', to: 'scratch.ogg', from: [path.join(IFACE, 'scratch_002.ogg')] },
  { dir: 'audio/sfx', to: 'glass.ogg', from: [path.join(IFACE, 'glass_002.ogg')] },
  { dir: 'audio/sfx', to: 'drop.ogg', from: [path.join(IFACE, 'drop_002.ogg')] },

  // ---- 界面小图标（白色 1x，可用 CSS filter 染色） ----
  { dir: 'img/icons', to: 'gear.png', from: [path.join(GAME_ICONS, 'gear.png')] },
  { dir: 'img/icons', to: 'audio_on.png', from: [path.join(GAME_ICONS, 'audioOn.png')] },
  { dir: 'img/icons', to: 'audio_off.png', from: [path.join(GAME_ICONS, 'audioOff.png')] },
  { dir: 'img/icons', to: 'save.png', from: [path.join(GAME_ICONS, 'save.png')] },
  { dir: 'img/icons', to: 'trash.png', from: [path.join(GAME_ICONS, 'trashcanOpen.png')] },
  { dir: 'img/icons', to: 'home.png', from: [path.join(GAME_ICONS, 'home.png')] },
  { dir: 'img/icons', to: 'pause.png', from: [path.join(GAME_ICONS, 'pause.png')] },
  { dir: 'img/icons', to: 'question.png', from: [path.join(GAME_ICONS, 'question.png')] },
  { dir: 'img/icons', to: 'star.png', from: [path.join(GAME_ICONS, 'star.png')] },
  { dir: 'img/icons', to: 'trophy.png', from: [path.join(GAME_ICONS, 'trophy.png')] },
  { dir: 'img/icons', to: 'warning.png', from: [path.join(GAME_ICONS, 'warning.png')] },
  { dir: 'img/icons', to: 'arrow_up.png', from: [path.join(GAME_ICONS, 'arrowUp.png')] },
  { dir: 'img/icons', to: 'arrow_right.png', from: [path.join(GAME_ICONS, 'arrowRight.png')] },
  { dir: 'img/icons', to: 'check.png', from: [path.join(GAME_ICONS, 'checkmark.png')] },
  { dir: 'img/icons', to: 'cross.png', from: [path.join(GAME_ICONS, 'cross.png')] },
  { dir: 'img/icons', to: 'fist.png', from: [path.join(GAME_ICONS2, 'fightFist_circle.png')] },
  { dir: 'img/icons', to: 'coin.png', from: [path.join(GAME_ICONS2, 'coin.png')] },
  { dir: 'img/icons', to: 'diamond.png', from: [path.join(GAME_ICONS2, 'diamond.png')] },
  { dir: 'img/icons', to: 'key.png', from: [path.join(GAME_ICONS2, 'key.png')] },

  // ---- 桌游图标（卡牌 / 骰子 / 剑盾） ----
  { dir: 'img/cards', to: 'card_back.png', from: [path.join(BOARD, 'card_outline.png')] },
  { dir: 'img/cards', to: 'card_plain.png', from: [path.join(BOARD, 'card.png')] },
  { dir: 'img/cards', to: 'cards_fan.png', from: [path.join(BOARD, 'cards_fan.png')] },
  { dir: 'img/cards', to: 'cards_shuffle.png', from: [path.join(BOARD, 'cards_shuffle.png')] },
  { dir: 'img/cards', to: 'cards_stack.png', from: [path.join(BOARD, 'cards_stack.png')] },
  { dir: 'img/cards', to: 'cards_seek.png', from: [path.join(BOARD, 'cards_seek.png')] },
  { dir: 'img/cards', to: 'cards_return.png', from: [path.join(BOARD, 'cards_return.png')] },
  { dir: 'img/cards', to: 'cards_take.png', from: [path.join(BOARD, 'cards_take.png')] },
  { dir: 'img/cards', to: 'cards_skull.png', from: [path.join(BOARD, 'cards_skull.png')] },
  { dir: 'img/cards', to: 'sword.png', from: [path.join(BOARD, 'sword.png')] },
  { dir: 'img/cards', to: 'shield.png', from: [path.join(BOARD, 'shield.png')] },
  { dir: 'img/cards', to: 'pouch.png', from: [path.join(BOARD, 'pouch.png')] },
  { dir: 'img/cards', to: 'flask_full.png', from: [path.join(BOARD, 'flask_full.png')] },
  { dir: 'img/cards', to: 'flask_half.png', from: [path.join(BOARD, 'flask_half.png')] },
  { dir: 'img/cards', to: 'crown.png', from: [path.join(BOARD, 'crown_a.png')] },
  { dir: 'img/cards', to: 'skull.png', from: [path.join(BOARD, 'skull.png')] },
  { dir: 'img/cards', to: 'dice.png', from: [path.join(BOARD, 'dice.png')] },
  { dir: 'img/cards', to: 'dice_skull.png', from: [path.join(BOARD, 'dice_skull.png')] },
  { dir: 'img/cards', to: 'dice_sword.png', from: [path.join(BOARD, 'dice_sword.png')] },
  { dir: 'img/cards', to: 'dice_shield.png', from: [path.join(BOARD, 'dice_shield.png')] },
  { dir: 'img/cards', to: 'campfire.png', from: [path.join(BOARD, 'campfire.png')] },
  { dir: 'img/cards', to: 'gate.png', from: [path.join(BOARD, 'structure_gate.png')] },
  { dir: 'img/cards', to: 'tower.png', from: [path.join(BOARD, 'structure_tower.png')] },
  { dir: 'img/cards', to: 'house.png', from: [path.join(BOARD, 'structure_house.png')] },
  { dir: 'img/cards', to: 'exploding.png', from: [path.join(BOARD, 'exploding.png')] },
  { dir: 'img/cards', to: 'direction_n.png', from: [path.join(BOARD, 'direction_n.png')] },
  { dir: 'img/cards', to: 'direction_s.png', from: [path.join(BOARD, 'direction_s.png')] },
  { dir: 'img/cards', to: 'direction_e.png', from: [path.join(BOARD, 'direction_e.png')] },
  { dir: 'img/cards', to: 'direction_w.png', from: [path.join(BOARD, 'direction_w.png')] },
  { dir: 'img/cards', to: 'hexagon.png', from: [path.join(BOARD, 'hexagon.png')] },

  // ---- 地图装饰（制图包 cartography：树 / 岩 / 屋 / 湖 / 遗迹…）----
  // 名字保持包里的原名，界面按 `.map-deco-<name>` 类用（src/ui/screens.js 的 BIOME_DECOR）。
  ...[
    'bush', 'cactus', 'cactusLarge', 'campfire', 'castleWideLow', 'chest', 'church', 'dock',
    'elementDiamond', 'elementShield', 'fence', 'flag', 'gate', 'graveyard', 'lake', 'lakeRound',
    'lighthouse', 'mill', 'mine', 'palm', 'palmLarge', 'pyramid', 'rocks', 'rocksA', 'rocksB',
    'rocksMountain', 'rocksTall', 'runis', 'ship', 'skull', 'tent', 'tipi', 'towerLow', 'towerWatch',
    'treePine', 'treePineLarge', 'treePines', 'treePinesSmall', 'treePineTall', 'treePineTallLow',
    'treeTall', 'vulcano', 'watchtower', 'waterWheel', 'well',
  ].map((name) => ({ dir: 'img/map', to: `${name}.png`, from: [path.join(CARTO, `${name}.png`)] })),

  // ---- 粒子 / 特效 ----
  { dir: 'img/fx', to: 'dirt_1.png', from: [path.join(PARTICLES, 'dirt_01.png')] },
  { dir: 'img/fx', to: 'dirt_2.png', from: [path.join(PARTICLES, 'dirt_02.png')] },
  { dir: 'img/fx', to: 'light_1.png', from: [path.join(PARTICLES, 'light_01.png')] },
  { dir: 'img/fx', to: 'magic_1.png', from: [path.join(PARTICLES, 'magic_01.png')] },
  { dir: 'img/fx', to: 'magic_2.png', from: [path.join(PARTICLES, 'magic_03.png')] },
  { dir: 'img/fx', to: 'star_1.png', from: [path.join(PARTICLES, 'star_01.png')] },
  { dir: 'img/fx', to: 'smoke_1.png', from: [path.join(PARTICLES, 'smoke_01.png')] },
  { dir: 'img/fx', to: 'slash_1.png', from: [path.join(PARTICLES, 'slash_01.png')] },
  { dir: 'img/fx', to: 'twirl_1.png', from: [path.join(PARTICLES, 'twirl_01.png')] },
  { dir: 'img/fx', to: 'flare_1.png', from: [path.join(PARTICLES, 'flare_01.png')] },
  { dir: 'img/fx', to: 'trace_1.png', from: [path.join(PARTICLES, 'trace_01.png')] },
  { dir: 'img/fx', to: 'spark_1.png', from: [path.join(PARTICLES, 'spark_01.png')] },

  // ---- 面板 / 边框（9-slice 用） ----
  { dir: 'img/ui', to: 'panel_brown.png', from: [path.join(RPG_UI, 'panel_brown.png')] },
  { dir: 'img/ui', to: 'panel_beige.png', from: [path.join(RPG_UI, 'panel_beige.png')] },
  { dir: 'img/ui', to: 'panel_blue.png', from: [path.join(RPG_UI, 'panel_blue.png')] },
  { dir: 'img/ui', to: 'inset_brown.png', from: [path.join(RPG_UI, 'panelInset_brown.png')] },
  { dir: 'img/ui', to: 'inset_beige.png', from: [path.join(RPG_UI, 'panelInset_beige.png')] },
  { dir: 'img/ui', to: 'bar_red_left.png', from: [path.join(RPG_UI, 'barRed_horizontalLeft.png')] },
  { dir: 'img/ui', to: 'bar_red_mid.png', from: [path.join(RPG_UI, 'barRed_horizontalMid.png')] },
  { dir: 'img/ui', to: 'bar_red_right.png', from: [path.join(RPG_UI, 'barRed_horizontalRight.png')] },
  { dir: 'img/ui', to: 'bar_green_left.png', from: [path.join(RPG_UI, 'barGreen_horizontalLeft.png')] },
  { dir: 'img/ui', to: 'bar_green_mid.png', from: [path.join(RPG_UI, 'barGreen_horizontalMid.png')] },
  { dir: 'img/ui', to: 'bar_green_right.png', from: [path.join(RPG_UI, 'barGreen_horizontalRight.png')] },
  { dir: 'img/ui', to: 'bar_blue_left.png', from: [path.join(RPG_UI, 'barBlue_horizontalLeft.png')] },
  { dir: 'img/ui', to: 'bar_blue_mid.png', from: [path.join(RPG_UI, 'barBlue_horizontalMid.png')] },
  { dir: 'img/ui', to: 'bar_blue_right.png', from: [path.join(RPG_UI, 'barBlue_horizontalRight.png')] },
  { dir: 'img/ui', to: 'icon_check.png', from: [path.join(RPG_UI, 'iconCheck_beige.png')] },
  { dir: 'img/ui', to: 'icon_cross.png', from: [path.join(RPG_UI, 'iconCross_beige.png')] },
  { dir: 'img/ui', to: 'arrow_left.png', from: [path.join(RPG_UI, 'arrowBeige_left.png')] },
  { dir: 'img/ui', to: 'arrow_right.png', from: [path.join(RPG_UI, 'arrowBeige_right.png')] },
];

let copied = 0, missing = 0;
for (const job of jobs) {
  const src = job.from[0];
  const dstDir = path.join(ASSETS, job.dir);
  await fs.mkdir(dstDir, { recursive: true });
  try {
    await fs.copyFile(src, path.join(dstDir, job.to));
    copied++;
  } catch (err) {
    missing++;
    console.warn('缺文件:', path.relative(ROOT, src), '->', job.to);
  }
}

// 目录级别的批量复制
async function copyDirFiltered(fromDir, toDir, filter) {
  await fs.mkdir(toDir, { recursive: true });
  let n = 0;
  let entries = [];
  try { entries = await fs.readdir(fromDir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!filter(e.name)) continue;
    await fs.copyFile(path.join(fromDir, e.name), path.join(toDir, e.name));
    n++;
  }
  return n;
}

const fxMore = await copyDirFiltered(PARTICLES, path.join(ASSETS, 'img/fx'), (n) => /^(star|spark|trace|twirl)_\d+\.png$/.test(n));
copied += fxMore;

// UI 边框（奇幻风格，用于面板 9-slice）
const fantasy = await copyDirFiltered(path.join(FANTASY, 'Panel'), path.join(ASSETS, 'img/frame'), () => true);
copied += fantasy;

console.log(`完成：复制 ${copied} 个文件，缺失 ${missing} 个。 -> ${path.relative(ROOT, ASSETS)}`);
