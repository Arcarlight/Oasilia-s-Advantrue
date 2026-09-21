// 各个界面：标题 / 地图 / 事件 / 宝箱 / 商店 / 营地 / 奖励 / 结算
// 弹窗类界面（卡组、背包、帮助、设置）在 overlays.js 里。

import { el, clear, toast, modal, floatAt, richText } from './dom.js';
import { cardEl, CARD_ART, expertChipsNode } from './cards.js';
import { resolveCardText } from './cardtext.js';
import { createAnim, DIR } from '../core/sprites.js';
import { createPortrait, setPortraitEmotion } from '../core/portraits.js';
import { audio } from '../core/audio.js';
import { BIOMES, BALANCE } from '../data/balance.js';
import { CARD_BY_ID } from '../data/cards.js';
import { ITEMS, itemArtUrl } from '../data/items.js';
// 属性叫什么名字、道具怎么分类，都从引擎那一份问，别在界面里自己判断
import { STAT_NAMES } from '../core/game.js';
import { heldEntries, itemSellPrice } from '../core/item-rules.js';
// 效果说成一句人话的那一份表：手持栏 / 图鉴 / 掉落窗口都从这里取，避免各写一套说法
import { holdLines, useLine } from '../core/itemtext.js';
import { NODE_TYPES, nodeName, stageCount } from '../data/mapgen.js';
import { save } from '../core/save.js';
import { t, LANGS, currentLang } from '../core/i18n.js';
// 两位主角（3.0）：标题页的头图 / 台词 / 结局 / 解锁条件全从这里读
import { HEROES, DEFAULT_HERO_ID, heroById, isHeroUnlocked, isHeroEndlessUnlocked } from '../data/heroes.js';
import { changeLanguage } from './langswitch.js';
import { showDeck, showItems, showHelp, showSettings, showHeldOverflow } from './overlays.js';
// 标题页的三块收藏 / 战绩页：卡牌图鉴、敌人图鉴、通关记录（游戏内也能开敌人图鉴）
import { showCardCodex, showEnemyCodex, showItemCodex, cardCodexProgress, enemyCodexProgress, itemCodexProgress } from './codex.js';
import { showRecords, runCount } from './records.js';
import { showMusicRoom, musicRoomProgress } from './music-room.js';
import { showChangelog, CHANGELOG } from './changelog.js';
import { renderHud } from './hud.js';
// 地图上的装饰物按「本局种子 + 章节」撒，用的是引擎那把可复现的随机数
import { makeRng } from '../core/rng.js';

/**
 * 地图节点图标。两层：
 *   1. 按节点类型给语义正确的图标（战斗=打击特效、精英=维京头盔、事件=问号、首领=凶恶脸…）；
 *   2. 首领 / 营地 / 商店 / 宝箱 **六章各不相同** —— 同一张图上老远就能认出「这是哪一章的什么节点」。
 * 值一律写成带 ico- 前缀的字面量：tools/check-icons.mjs 就是扫 src 里的 `ico-*` 来兜底的。
 * （src/data/mapgen.js 的 NODE_TYPES[].icon 是这批图标接上之前的历史默认值，实际渲染以这张表为准。）
 */
const NODE_ICO = {
  battle: 'ico-hit_effect',
  elite: 'ico-viking_helmet',
  event: 'ico-question_mark',
  chest: {
    desert: 'ico-chest', canyon: 'ico-ingot', forest: 'ico-key',
    tide: 'ico-sycee', cliff: 'ico-tool_kit', night: 'ico-pouch',
  },
  shop: {
    desert: 'ico-shop', canyon: 'ico-money', forest: 'ico-backpack',
    tide: 'ico-star_coin', cliff: 'ico-sign', night: 'ico-diamond',
  },
  rest: {
    desert: 'ico-tent', canyon: 'ico-campfire', forest: 'ico-lantern',
    tide: 'ico-bed', cliff: 'ico-house', night: 'ico-night',
  },
  boss: {
    desert: 'ico-boss', canyon: 'ico-demon', forest: 'ico-wolf',
    tide: 'ico-anchor', cliff: 'ico-demon_02', night: 'ico-death',
  },
};

/** 取某个节点在某一章用的图标类名（章节没登记就回落到该类型的第一款） */
function nodeIco(type, biome) {
  const v = NODE_ICO[type];
  if (typeof v === 'string') return v;
  if (!v) return 'ico-sword';
  return v[biome] ?? Object.values(v)[0];
}

/** 六章的章节图标：地图头部的「第 N 章」旁边用 */
const BIOME_ICO = {
  desert: 'ico-drought', canyon: 'ico-mountain', forest: 'ico-forest',
  tide: 'ico-sea', cliff: 'ico-wind', night: 'ico-gravestone',
  // 替补场景（随机替换中间 4 章）
  ruins: 'ico-key', fungal: 'ico-leaves', storm: 'ico-lightning', crystal: 'ico-diamond',
};

/**
 * 地图上的**装饰物**（Kenney 制图包，`assets/img/map/`）。
 *
 * 每张地图按主题挑一池子，渲染时用「本局种子 + 章节」做种子撒在路两旁 ——
 * 同一局同一章每次都摆在同一处（切界面、重画都不会重排），换个种子就是另一张图。
 * 类名在 style.css 的 GENERATED-MAP-DECOR 区块里（由 tools/build-map-decor.mjs 生成）。
 */
const BIOME_DECOR = {
  desert: ['cactus', 'cactusLarge', 'palm', 'palmLarge', 'rocksA', 'rocksB', 'pyramid', 'skull', 'tent'],
  canyon: ['rocksMountain', 'rocksTall', 'rocksA', 'mine', 'vulcano', 'campfire', 'tipi', 'fence'],
  forest: ['treePine', 'treePineLarge', 'treePines', 'treePineTall', 'treeTall', 'bush', 'mill', 'well', 'campfire'],
  tide: ['lake', 'lakeRound', 'dock', 'ship', 'waterWheel', 'lighthouse', 'bush', 'rocks'],
  cliff: ['rocksMountain', 'rocksTall', 'treePineTallLow', 'watchtower', 'flag', 'gate', 'lighthouse', 'tent'],
  night: ['graveyard', 'skull', 'runis', 'church', 'fence', 'rocksTall', 'towerLow', 'campfire'],
  ruins: ['runis', 'castleWideLow', 'towerLow', 'gate', 'well', 'pyramid', 'elementDiamond', 'elementShield', 'chest'],
  fungal: ['bush', 'lake', 'rocks', 'treePineTallLow', 'mill', 'well', 'fence', 'campfire', 'tent'],
  storm: ['rocksTall', 'rocksMountain', 'flag', 'towerWatch', 'watchtower', 'mine', 'tent', 'gate'],
  crystal: ['elementDiamond', 'rocks', 'rocksA', 'mine', 'chest', 'towerLow', 'rocksTall', 'gate'],
};

// ============================================================
// 标题
// ============================================================
async function renderTitle(game) {
  const host = document.getElementById('stage');
  const meta = save.readMeta();

  const screen = el('div', { class: 'screen title-screen' });
  const inner = el('div', { class: 'title-inner' });
  screen.append(inner);
  /**
   * 两栏：**左边主视觉（飞行的沙漠蜻蜓 + 标题），右边选项**。
   *
   * 用户的要求（原话）：「左边是标题和头像。沙漠蜻蜓欧亚西莉亚的行走图朝右做出飞行的样子。
   * 标题选项放在右边。这样就不会挤到外面去了。」
   * 之前是单列居中、一路往下堆（标题 / 旁白 / 7 个按钮 / 5 个收藏入口 / 语言 / 统计 / 版权），
   * 高过一屏之后内容被推到屏幕外，背景那层沙丘（`.title-screen::before`）也跟着错位，
   * 屏幕上出现一条**直边的断面**（用户截图里那个「迷之断面」）。
   */
  const left = el('div', { class: 'title-left' });
  const right = el('div', { class: 'title-right' });
  inner.append(left, right);

  /**
   * **头条头图 = 切换主角的按钮**（用户要的：点主界面的头图换主角）。
   *
   * 3.0 有两位主角：欧亚西莉亚（沙漠蜻蜓）一开始就能用；阿特拉斯（暴飞龙）
   * **要用欧亚西莉亚通关一次**才解锁（条件写在 content/heroes.json 的 unlock 里）。
   * 没解锁时头图旁边也写清楚条件 —— 藏起来的话，玩家永远不知道还有第二位主角。
   */
  const hero = heroById(game.titleHeroId);
  const others = HEROES.filter((h) => h.id !== hero?.id);
  const nextHero = others.find((h) => isHeroUnlocked(h, meta)) ?? others[0] ?? null;
  const othersUnlocked = !!nextHero && isHeroUnlocked(nextHero, meta);
  const swapHint = nextHero
    ? (othersUnlocked
      ? t('点头图，主角换成 {name}', { name: nextHero.name })
      : t('还有一位主角，走完{name}的路便会现身', { name: hero?.name ?? '' }))
    : '';

  const heroBox = el('div', { class: 'title-hero' });
  const heroBtn = el('button', {
    class: 'title-hero-btn',
    /** 头图本身就是一个按钮（键盘 / 屏幕阅读器也能切主角），悬停提示走全站那套 data-tip */
    dataset: { tip: swapHint },
    onClick: () => {
      if (!nextHero) return;
      if (!othersUnlocked) {
        audio.ui('bad');
        toast(t('还没解锁 —— 用{name}通关一次，就能换成{other}。', { name: hero?.name ?? '', other: nextHero.name }), 'bad');
        return;
      }
      audio.ui('confirm');
      game.titleHeroId = nextHero.id;
      game.changed();
    },
  }, [heroBox]);
  left.append(heroBtn);
  try {
    /**
     * 标题用的行走图：**朝右的动画**，像在往前飞一样。
     * 底下配一层椭圆阴影（CSS 的 .title-hero::after），不然「飞」看着像悬在半空。
     * 动画名写在 content/heroes.json 的 `titleAnim` 里：沙漠蜻蜓是 FlapAround，
     * 暴飞龙是 Float（它那套素材里没有 FlapAround）—— 写死在代码里的话，
     * 第二位主角一上场就会因为「没有这个动画」而一片空白。
     */
    const art = await createAnim(hero?.species ?? 'flygon', {
      anim: hero?.titleAnim ?? 'Idle', scale: hero?.titleScale ?? 4.2, fps: 10, dir: DIR.RIGHT,
    });
    heroBox.append(art);
  } catch { /* ignore */ }

  // 头图 + 标题排成一行：头图放在标题左边当「主视觉」
  const heroName = hero?.name ?? '';
  const lockup = el('div', { class: 'title-lockup' });
  const faceBox = el('div', { class: 'title-portrait' });
  const names = el('div', { class: 'title-names' }, [
    el('h1', { class: 'title-h1', text: t('沙漠精灵') }),
    el('div', { class: 'title-h2', text: heroName }),
  ]);
  lockup.append(faceBox, names);
  left.append(lockup);
  // 头图原生只有 40x40，放大到 64px（整数倍）最清晰
  createPortrait(hero?.species ?? 'flygon', { emotion: 'happy', size: 64, alt: heroName }).then((img) => {
    if (img) faceBox.append(img);
  });

  /**
   * 标题页这一句**跟着主角走**：文案写在 content/heroes.json 的 `quote` 里
   * （{name} 现填），加第三位主角时不用回来改这个文件。
   */
  left.append(el('p', { class: 'title-quote', text: t(hero?.quote ?? '', { name: heroName }) }));

  const hasSave = !!save.readRun();
  const menu = el('div', { class: 'title-menu' });
  if (hasSave) {
    menu.append(el('button', {
      class: 'btn btn-primary btn-lg', onClick: () => { audio.ui('confirm'); game.loadFromData(save.readRun()); },
    }, [el('span', { class: 'ico-save' }), el('span', { text: t('继续上次的旅程') })]));
  }
  menu.append(
    el('button', {
      class: hasSave ? 'btn btn-lg' : 'btn btn-primary btn-lg',
      onClick: () => { audio.ui('confirm'); game.newRun(); },
    }, [
      el('span', { class: 'ico-star' }),
      el('span', { text: t('开始新的冒险') }),
      // 用哪一位主角写在按钮上：点了才发现「怎么是暴飞龙」是最糟的体验
      el('span', { class: 'btn-sub', text: t('（{name}）', { name: heroName }) }),
    ]),
    /**
     * **无尽模式：单独一个入口**（用户明确要求「不要和普通模式合并，而是有另一个入口」）。
     *
     * 解锁条件分两句（3.0）：欧亚西莉亚通关解锁无尽（老规则）；
     * 而「阿特拉斯通关后，可以选择阿特拉斯进行普通难度的挑战和无尽模式的挑战」——
     * 也就是**用现在这位主角通过一次关**才解锁。未解锁时按钮就在那儿但点不动，
     * 并直接写明解锁条件 —— 藏起来的话，玩家永远不知道还有这个模式。
     * 无尽局在引擎里是 `newRun(seed, { endless: true })`：地图分叉 +1、敌人略微加压、
     * 过了第 6 章复利变强，永远不会出现结局页，目标只有「走到第几章」。
     */
    (() => {
      const m = save.readMeta();
      const unlocked = isHeroEndlessUnlocked(hero, m);
      const best = m.endlessBest ?? 0;
      return el('button', {
        class: `btn btn-lg endless-btn${unlocked ? '' : ' locked'}`,
        disabled: !unlocked,
        dataset: unlocked
          ? { tip: t('无尽模式：地图岔路更多、敌人更强，一路走下去 —— 看你能走到第几章。') }
          : { tip: t('用{name}通关一次正片之后解锁。', { name: heroName }) },
        onClick: () => { audio.ui('confirm'); game.newRun(undefined, { endless: true }); },
      }, [
        el('span', { class: unlocked ? 'ico-infinity' : 'ico-lock' }),
        el('span', { text: t('无尽模式') }),
        el('span', {
          class: 'btn-sub',
          text: !unlocked ? t('通关后解锁') : (best > 0 ? t('最远 第 {n} 章', { n: best }) : t('还没走过')),
        }),
      ]);
    })(),
    el('button', { class: 'btn btn-ghost', onClick: () => { audio.ui('open'); showHelp(); } }, [
      el('span', { class: 'ico-help' }), el('span', { text: t('玩法说明') }),
    ]),
    el('button', { class: 'btn btn-ghost', onClick: () => { audio.ui('open'); showSettings(); } }, [
      el('span', { class: 'ico-gear' }), el('span', { text: t('设置') }),
    ]),
    // 更新日志：和「玩法说明 / 设置」同一类（都是「关于这个游戏」的信息），所以排在它们旁边
    el('button', { class: 'btn btn-ghost', onClick: () => showChangelog() }, [
      el('span', { class: 'ico-clock' }), el('span', { text: t('更新日志') }),
      el('span', { class: 'btn-sub', text: `v${CHANGELOG[0]?.version ?? ''}` }),
    ]),
    el('button', {
      class: 'btn btn-ghost btn-sm',
      onClick: async () => {
        const data = await save.importFile();
        if (!data) return toast(t('读取失败：文件不是本作的存档。'), 'bad');
        game.loadFromData(data);
        toast(t('存档已导入！'), 'good');
      },
    }, [t('导入存档 JSON')]),
  );
  right.append(menu);

  /**
   * 头图旁边那一行小字：**明说「这里可以点」**。
   * 悬停提示（data-tip）玩家不一定会去悬停，而「点主角换人」是 3.0 的主功能，
   * 界面上没有一处文字提到它就等于没做。
   */
  if (swapHint) {
    right.append(el('div', { class: `hero-swap-hint${othersUnlocked ? '' : ' locked'}` }, [
      el('span', { class: othersUnlocked ? 'ico-change' : 'ico-lock', style: { width: '16px', height: '16px' } }),
      el('span', { text: swapHint }),
    ]));
  }

  /**
   * 标题页第二排：通关记录 / 卡牌图鉴 / 敌人图鉴。
   *
   * 为什么放在标题页：这三样以前要么根本不存在（通关记录、敌人图鉴），
   * 要么被锁在「先开一局」后面（卡牌图鉴是卡组一览里一个折叠块）——
   * 刚进游戏的人想看「这游戏里有什么牌、有什么怪、别人打到了哪」，一件都做不到。
   * 每个按钮上直接带进度：看一眼就知道还有多少没收。
   */
  const cardProgress = cardCodexProgress([]);   // 标题页没有 run，「这一局带着的」自然算空
  const enemyProgress = enemyCodexProgress();
  const itemProgress = itemCodexProgress();
  const musicProgress = musicRoomProgress();
  right.append(el('div', { class: 'title-codex' }, [
    titleCodexBtn('ico-trophy', t('通关记录'), runCount() ? t('{n} 局', { n: runCount() }) : t('还没有'), () => showRecords()),
    titleCodexBtn('ico-cards', t('卡牌图鉴'), `${cardProgress.got}/${cardProgress.total}`, () => showCardCodex(game)),
    titleCodexBtn('ico-book', t('敌人图鉴'), `${enemyProgress.seen}/${enemyProgress.total}`, () => showEnemyCodex()),
    // 道具图鉴：手持道具那一版加的（拿过的登记，没拿过的是剪影）
    titleCodexBtn('ico-backpack', t('道具图鉴'), `${itemProgress.seen}/${itemProgress.total}`, () => showItemCodex()),
    // 曲子库：和三个图鉴同一类（都是「收集进度」），只是收的是 BGM
    titleCodexBtn('ico-music', t('曲子库'), `${musicProgress.heard}/${musicProgress.total}`, () => showMusicRoom()),
  ]));

  /**
   * 标题页上的语言切换。
   *
   * 放在这里而不是只藏在「设置」里：换语言是**第一次进游戏就可能想做的事**
   * （看不懂中文的人根本进不去设置页找它）。三个按钮直接摆出来。
   */
  right.append(el('div', { class: 'lang-switch' }, LANGS.map((l) => el('button', {
    class: `lang-btn${l.id === currentLang() ? ' on' : ''}`,
    onClick: () => { audio.ui('click'); changeLanguage(l.id); },
  }, [l.name]))));

  right.append(el('div', { class: 'title-meta' }, [
    el('span', {}, [t('最远步数 '), el('b', { text: String(meta.bestDistance ?? 0) })]),
    el('span', {}, [t('累计击败 '), el('b', { text: String(meta.kills ?? 0) })]),
    el('span', {}, [t('通关次数 '), el('b', { text: String(meta.wins ?? 0) })]),
  ]));

  left.append(el('div', {
    class: 'title-foot',
    html: t('素材：宝可梦精灵图与表情头像来自 <b>PMDCollab/SpriteCollab</b>；回合立绘来自 <b>Generation 9 Pack</b>；界面图标与音效来自 <b>Kenney</b> 素材包与 <b>Game-Icon-Pack</b>；BGM 来自「<b>音楽の卵</b>」与「<b>龍的交響楽</b>」。<br>字体：<b>小杉圆体</b>（Apache-2.0）、<b>はなぞめフォント</b>、<b>YOzFont</b>（OFL）等。<br>这是一个非商业的同人练习作品。'),
  }));

  /**
   * 标题里的沙漠蜻蜓是**异步**取回来的，而这一屏的挂载点在这里。
   *
   * 以前是「进来就 clear(stage) → await 精灵 → append」，于是等图的这段时间里
   * 界面已经被别人换掉了（例如脚本调用 game.newRun() 直接进地图），
   * 紧接着这次 append 又把标题**压在**新界面上面 —— 屏幕上同时出现地图和标题
   * （截图里真的拍到了，`#stage` 里是 [map-screen, title-screen]）。
   *
   * 现在改成：只有在「这一屏还该显示」的时候才清屏 + 挂上去。
   * 判据用 game.phase —— 它才是「现在该显示哪一屏」的唯一真相；
   * 界面自己的换屏入口也都走 phase + onChange（见 renderGameOver / renderVictory 的按钮）。
   */
  if (game.phase !== 'title') {
    // 这一屏已经不该显示了。刚建好的那张行走图得**主动停掉** ——
    // 它没挂到 DOM 上，但动画是 setInterval 推进的，不会因为没人看得见就自己停。
    heroBox.querySelector('canvas.anim')?.destroy?.();
    return screen;
  }
  clear(host);
  host.append(screen);
  return screen;
}

// ============================================================
// 地图
// ============================================================
// ============================================================
function renderMap(game) {
  const host = document.getElementById('stage');
  clear(host);
  /**
   * 回到地图时看一眼「有没有拿不下的道具」（手持栏满了）。
   *
   * 为什么放在地图页：奖励结算 / 开宝箱之后玩家一定回到地图，
   * 这里弹一次就够了，不必在奖励页、宝箱页、事件页各挂一遍
   * （那样一定会有一处漏掉，丢掉的东西就静默消失了）。
   */
  if (game.awaitingOverflow) showHeldOverflow(game);
  const map = game.data.map;
  const biome = BIOMES[map.biome] ?? BIOMES.desert;
  const available = game.availableNodes().map((n) => n.id);

  const screen = el('div', {
    class: 'screen map-screen',
    style: {
      background: `linear-gradient(180deg, ${biome.sky[1]} 0%, ${biome.sky[2]} 55%, ${biome.ground} 100%)`,
    },
  });

  const biomeIco = BIOME_ICO[biome.key] ?? 'ico-drought';
  screen.append(el('div', { class: 'map-header' }, [
    // 章数由**当前章节序号**算，不读地图自己的标签 —— 中间 4 章现在是随机地图
    // （水晶洞窟可能出现在第 2 章也可能在第 5 章），写死在数据里就会显示成错的章数。
    el('div', { class: 'map-chapter', text: t('第 {n} 章', { n: (game.data?.stage ?? 0) + 1 }) }),
    el('h2', { class: 'map-name' }, [
      el('span', { class: `map-name-ico ${biomeIco}` }),
      el('span', { text: biome.name }),
    ]),
    el('div', { class: 'map-desc', text: t(biome.desc) }),
  ]));

  const body = el('div', { class: 'map-body' });
  const inner = el('div', { class: 'map-scroll-inner' });
  body.append(inner);
  screen.append(body);

  const H = Math.max(560, (map.rows - 1) * 130 + 120);
  inner.style.height = `${H}px`;
  inner.style.width = 'min(880px, 96vw)';

  // 连线
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'map-lines');
  svg.setAttribute('viewBox', `0 0 1000 ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  inner.append(svg);

  const posOf = (n) => ({
    x: 100 + n.x * 800,
    y: H - 70 - n.y * (H - 140),
  });

  /**
   * 装饰层：撒在路两旁的树 / 岩 / 屋…
   *
   * 三条规矩（都在诊断里量过）：
   *   ① **确定性**：种子取「本局种子 + 章节」，所以同一局同一章每次都一样
   *      （UI 会因为状态变化重画，装饰一重排就像整张图换了）；
   *   ② **不挡节点**：节点永远落在 x∈[10%, 90%]，装饰尽量摆进两侧的空白带，
   *      中间那点也要求离任何节点足够远；
   *   ③ **不撑出横向滚动条**：右侧那些用 `right` 定位，宽度算在框内。
   */
  const decor = el('div', { class: 'map-decor', 'aria-hidden': 'true' });
  {
    const pool = BIOME_DECOR[biome.key] ?? BIOME_DECOR.desert;
    const rand = makeRng(((game.data?.seed ?? 1) * 31 + ((game.data?.stage ?? 0) + 1) * 7919) >>> 0);
    const nodes = map.nodes.map((n) => posOf(n));
    /**
     * 「离节点够不够远」按**像素**算，不按百分比：节点和装饰物都是固定像素大小
     * （节点 76px、装饰 26~72px），用百分比在两块尺寸不同的屏上会一个太松一个太紧。
     * 内层宽度就是 CSS 里那条 `min(880px, 96vw)`。
     */
    const innerW = Math.min(880, (typeof window !== 'undefined' ? window.innerWidth : 900) * 0.96);
    const perX = innerW / 100;
    const perY = H / 100;
    const want = 8 + rand.int(0, 4);
    const placed = [];
    /**
     * 抽位置而不是「抽一次不行就作废」：节点有十来个、又集中在中间那条带上，
     * 一次就中的概率很低 —— 第一版就是这么写的，结果整张图一个装饰都没留下（截图里空空的）。
     */
    for (let guard = 0; placed.length < want && guard < want * 40; guard += 1) {
      const name = rand.pick(pool);
      // 尺寸分两档（小 / 大），免得整页一样大
      const w = rand.chance(0.35) ? rand.int(46, 72) : rand.int(26, 42);
      const px = rand();
      const py = rand();
      const useRight = px > 0.5;
      /**
       * 横向落点：两侧各留一条 0.6%~5.4% 的空白带（节点最靠边也在 10% 左右，
       * 所以这里天然不压节点），中间那一段只放少数几个「撒在路中间」的 ——
       * 它们还要跟节点比一次真实距离。右侧那些用 `right` 定位：宽度算在框内，
       * 不会把 inner 撑宽、也就不会出横向滚动条。
       */
      const band = px < 0.42 ? rand() * 4.8 + 0.6
        : px > 0.58 ? rand() * 4.8 + 0.6
          : rand() * 64 + 16;
      const left = useRight ? null : band;
      const right = useRight ? band : null;
      const top = 3 + py * 90;
      // 装饰物的**中心**（右侧那一批用 right 定位，中心在 100 − band − 半个宽度）
      const cx = useRight ? 100 - band - (w / 2) / perX : band + (w / 2) / perX;
      const clash = nodes.some((n) => Math.hypot(
        ((n.x / 1000) * 100 - cx) * perX,
        ((n.y / H) * 100 - top) * perY,
      ) < 78);
      if (clash) continue;
      placed.push({ name, w, left, right, top, flip: rand.chance(0.5), alpha: 0.72 + rand() * 0.26 });
    }
    for (const d of placed) {
      decor.append(el('span', {
        class: `map-deco map-deco-${d.name}${d.flip ? ' flip' : ''}`,
        style: {
          width: `${d.w}px`,
          height: `${d.w}px`,
          top: `${d.top}%`,
          ...(d.left != null ? { left: `${d.left}%` } : { right: `${d.right}%` }),
          opacity: d.alpha.toFixed(2),
        },
      }));
    }
  }
  inner.append(decor);

  for (const n of map.nodes) {
    for (const nid of n.next) {
      const t = map.nodes.find((x) => x.id === nid);
      if (!t) continue;
      const a = posOf(n);
      const b = posOf(t);
      const mid = (a.y + b.y) / 2;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', `M ${a.x} ${a.y} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`);
      const open = available.includes(n.id) && available.includes(t.id);
      if (open) p.setAttribute('class', 'open');
      svg.append(p);
    }
  }

  // 节点
  for (const n of map.nodes) {
    const type = NODE_TYPES[n.type] ?? NODE_TYPES.battle;
    const name = t(nodeName(n.type, map.biome));   // 商队/营地按地图换叫法
    const p = posOf(n);
    const isAvail = available.includes(n.id);
    const isCurrent = game.data.nodeId === n.id;
    const node = el('button', {
      class: ['map-node', isAvail ? 'available' : '', n.visited ? 'done' : '', isCurrent ? 'current' : '', n.type === 'boss' ? 'boss' : '', n.visited && !isAvail ? 'locked' : ''].filter(Boolean).join(' '),
      style: { left: `${(p.x / 1000) * 100}%`, top: `${(p.y / H) * 100}%`, color: type.color },
      title: `${name}：${t(type.desc)}`,
      'aria-label': `${name}`,
      disabled: !isAvail,
      onClick: () => {
        audio.ui('confirm');
        floatAt(node, name, 'float-shield');
        game.goToNode(n.id);
      },
    }, [
      el('span', { class: `node-ico ${nodeIco(n.type, map.biome)}` }),
      el('div', { class: 'node-label', text: name }),
      n.visited ? el('small', { style: { position: 'absolute', top: '2px', right: '4px', fontSize: '11px' }, text: '✓' }) : null,
    ]);
    inner.append(node);
  }

  // 图例
  // 图例也和地图上的节点用同一套图标 + 同一套叫法（以前是一个纯色圆点，看不出节点长什么样）
  // 这里**不要**再给它加背景渐变：内联样式会盖掉 CSS，之前就是它在图例底下垫了一条黑带。
  const legend = el('div', { class: 'map-legend' }, Object.entries(NODE_TYPES).map(([type, def]) => el('span', { class: 'legend-item' }, [
    el('span', { class: `node-ico legend-ico ${nodeIco(type, map.biome)}`, style: { color: def.color } }),
    el('span', { text: t(nodeName(type, map.biome)) }),
  ])));
  body.append(legend);

  // 底部操作
  screen.append(el('div', { class: 'map-actions' }, [
    el('button', { class: 'btn', onClick: () => { audio.ui('open'); showDeck(game); } }, [
      el('span', { class: 'ico-deck' }), el('span', { text: t('卡组 ({n})', { n: game.data.deck.length }) }),
    ]),
    el('button', { class: 'btn btn-ghost', onClick: () => { audio.ui('open'); showItems(game); } }, [
      el('span', { class: 'ico-backpack' }), el('span', { text: t('背包') }),
    ]),
    // 敌人图鉴在地图上也要能开：接下来打哪一格之前，先查查那张图上有什么怪
    el('button', { class: 'btn btn-ghost', onClick: () => { audio.ui('open'); showEnemyCodex(); } }, [
      el('span', { class: 'ico-book' }), el('span', { text: t('敌人图鉴') }),
    ]),
    el('button', { class: 'btn btn-ghost', onClick: () => { audio.ui('open'); showHelp(); } }, [
      el('span', { class: 'ico-question_mark' }), el('span', { text: t('说明') }),
    ]),
  ]));

  host.append(screen);
  setTimeout(() => {
    const cur = inner.querySelector('.map-node.available');
    cur?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 60);
  return screen;
}

// ============================================================
// 事件
// ============================================================
function renderEvent(game) {
  const host = document.getElementById('stage');
  clear(host);
  const ev = game.event;
  const biome = BIOMES[game.data.map.biome] ?? BIOMES.desert;

  const screen = el('div', { class: `screen scene-screen scene-bg-${biome.key}` });
  const panel = el('div', { class: 'panel panel-paper scene-panel' });
  screen.append(panel);

  panel.append(el('div', { class: 'scene-illo' }, [
    el('span', { class: 'ico-question_mark', style: { width: '52px', height: '52px', color: '#8a5a2b' } }),
  ]));
  panel.append(el('h2', { class: 'panel-title', text: ev.name }));
  panel.append(el('div', { class: 'scene-text', text: ev.text }));

  // 结果只从 game.eventResult 读，不在这里手动拼 DOM。
  // 这样「选完选项 → 显示结果 → 继续前进」全程都由状态驱动，
  // 不会再出现「重新渲染把按钮的监听丢掉、页面卡死」的问题。
  const result = game.eventResult;
  const opts = el('div', { class: 'options' });
  panel.append(opts);

  if (!result) {
    ev.options.forEach((o, i) => {
      opts.append(el('button', {
        class: 'option',
        onClick: () => {
          audio.ui('confirm');
          game.chooseEventOption(i);
          renderHud(game);
          // 让 UI 层重新渲染这一屏（保持单一渲染入口）
          game.onChange?.(game);
        },
      }, [
        el('span', { text: o.label }),
        o.hint ? el('small', { text: o.hint }) : null,
      ]));
    });
  } else {
    panel.append(el('div', { class: `result-box ${result.tone ?? ''}`, text: result.text }));
    panel.append(el('div', { class: 'reward-row', style: { justifyContent: 'flex-start' } }, [
      el('button', {
        class: 'btn btn-primary',
        onClick: () => {
          audio.ui('click');
          game.leaveEvent();
          game.onChange?.(game);
        },
      }, [el('span', { class: 'ico-check' }), el('span', { text: t('继续前进') })]),
    ]));
  }

  host.append(screen);
  return screen;
}

// ============================================================
// 宝箱
// ============================================================
function renderChest(game) {
  const host = document.getElementById('stage');
  clear(host);
  const chest = game.chest;
  const biome = BIOMES[game.data.map.biome] ?? BIOMES.desert;

  const screen = el('div', { class: `screen scene-screen scene-bg-${biome.key}` });
  const panel = el('div', { class: 'panel panel-paper scene-panel' });
  screen.append(panel);

  const isMimic = chest.kind === 'mimic';
  panel.append(el('div', { class: 'scene-illo' }, [
    el('span', { class: isMimic ? 'ico-death' : 'ico-chest', style: { width: '56px', height: '56px', color: isMimic ? '#8f2c22' : '#8a5a2b' } }),
  ]));
  panel.append(el('h2', { class: 'panel-title', text: isMimic ? t('宝箱……动了') : t('宝箱') }));
  panel.append(el('div', { class: 'scene-text', text: chest.text }));

  if (!isMimic) {
    audio.chest();
    if (chest.cardId) {
      const grid = el('div', { class: 'reward-cards' }, [
        cardEl(CARD_BY_ID[chest.cardId], { size: 'lg' }),
      ]);
      panel.append(grid);
    } else {
      const pills = el('div', { class: 'reward-row' });
      if (chest.gold) pills.append(el('span', { class: 'reward-pill' }, [el('span', { class: 'ico-money' }), t('金币 +{n}', { n: chest.gold })]));
      pills.append(el('span', { class: 'reward-pill' }, [el('span', { class: 'ico-pouch' }), t('已收入囊中')]));
      panel.append(pills);
    }
  } else {
    audio.bad();
    audio.trap();
  }

  panel.append(el('div', { class: 'reward-row', style: { justifyContent: 'flex-start' } }, [
    el('button', {
      class: `btn ${isMimic ? 'btn-danger' : 'btn-primary'}`,
      onClick: () => {
        audio.ui('click');
        game.leaveChest();
      },
    }, [
      el('span', { class: isMimic ? 'ico-sword' : 'ico-check' }),
      el('span', { text: isMimic ? t('迎战！') : t('继续前进') }),
    ]),
  ]));

  host.append(screen);
  return screen;
}

// ============================================================
// 营地
// ============================================================
function renderRest(game) {
  const host = document.getElementById('stage');
  clear(host);
  const rest = game.rest;
  const biome = BIOMES[game.data.map.biome] ?? BIOMES.desert;

  const screen = el('div', { class: `screen scene-screen scene-bg-${biome.key}` });
  const panel = el('div', { class: 'panel panel-paper scene-panel' });
  screen.append(panel);

  panel.append(el('div', { class: 'scene-illo' }, [
    el('span', { class: 'ico-tent', style: { width: '56px', height: '56px', color: '#7ee08a' } }),
  ]));
  panel.append(el('h2', { class: 'panel-title', text: t('绿洲营地') }));
  // 这句话要跟着状态变：机会用掉之后就别再说「你可以做一件事」了
  const sceneText = el('div', { class: 'scene-text' });
  panel.append(sceneText);

  const body = el('div', { class: 'options' });
  panel.append(body);

  function paint() {
    clear(body);
    // 休息和冥想共用一个「机会」：做过任何一件，两件都不能再点
    const spent = !!rest.done;
    sceneText.textContent = spent
      ? t('这里该做的事已经做完了——直接出发吧。')
      : t('篝火很旺，水是凉的。你可以做一件事——只有一件。');

    body.append(el('button', {
      class: `option ${spent ? 'disabled' : ''}`,
      disabled: spent,
      onClick: () => {
        audio.heal();
        const healed = game.restHeal();
        if (healed == null) return;          // 机会已经用掉了
        toast(t('回复了 {n} 点 HP', { n: healed }), 'good');
        paint();
      },
    }, [
      el('span', { class: 'option-label' }, [
        el('span', { class: 'ico-heal' }),
        el('span', { text: t('休息一下（回复 {hp} HP，约最大生命的 {pct}%）', { hp: rest.healAmount, pct: Math.round(BALANCE.restHealPct * 100) }) }),
      ]),
      el('small', {
        text: rest.used
          ? (rest.healResult > 0 ? t('已经休息过了（回了 {n} 点）。', { n: rest.healResult }) : t('已经休息过了（当时是满血）。'))
          : spent
            ? t('这次机会已经用在冥想上了。')
            : game.data.hp >= game.data.maxHp
              // 满血还休息就白扔一次机会，事先说清楚
              ? t('当前 HP {hp} / {maxHp}（满血，休息会浪费这次机会）', { hp: game.data.hp, maxHp: game.data.maxHp })
              : t('当前 HP {hp} / {maxHp}', { hp: game.data.hp, maxHp: game.data.maxHp }),
      }),
    ]));

    body.append(el('button', {
      class: `option ${spent ? 'disabled' : ''}`,
      disabled: spent,
      onClick: () => {
        if (spent) return;
        audio.ui('open');
        showUpgradePicker(game, rest, (res) => {
          /**
           * res 有三种：
           *   · `{removed, gained, from, to}` —— 换成功（把稀有度变化一起报给玩家，让他**看得见**变强了）
           *   · `{ok:false, text}` —— 换不出更强的牌（那张已经是最高一档），这次机会没被用掉
           *   · `null` —— 玩家取消了
           */
          if (res && res.ok === false) toast(res.text, 'bad');
          else if (res) toast(t('「{a}」→「{b}」（{from} → {to}）', { a: res.removed, b: res.gained, from: res.from, to: res.to }), 'good');
          paint();
        });
      },
    }, [
      el('span', { class: 'option-label' }, [
        el('span', { class: 'ico-arrow_up' }),
        el('span', { text: t('在此地冥想（把一张卡换成更强的卡）') }),
      ]),
      el('small', {
        text: rest.upgraded
          ? t('已经把「{card}」换掉了（{from} → {to}）。', {
              card: rest.upgradeResult?.removed ?? t('一张卡'),
              from: rest.upgradeResult?.from ?? '',
              to: rest.upgradeResult?.to ?? '',
            })
          : spent
            ? t('这次机会已经用在休息上了。')
            // 说清规则：不是随机塞一张，而是**你挑**一张更强的
            : t('从三张更强的牌里挑一张（稀有度更高、用途相同优先）'),
      }),
    ]));

    body.append(el('button', {
      class: 'option',
      onClick: () => { audio.ui('click'); game.leaveRest(); },
    }, [el('span', { class: 'option-label' }, [
      el('span', { class: 'ico-arrow_right' }),
      el('span', { text: t('直接出发') }),
    ]), el('small', { text: spent ? t('出发去下一个节点。') : t('不消费这次机会。') })]));
  }

  paint();
  host.append(screen);
  return screen;
}

/**
 * 冥想：两步选牌。
 *
 * 第一步选「要换掉的卡」，第二步**从 3 张确实更强的候选里挑一张**（用户要的：换更厉害的卡）。
 *
 * 为什么要给候选而不是直接换：旧实现随机塞一张，玩家看不出「冥想」做了什么
 * （用户实测报的就是这个：「给的卡却是随机的，根本不会增加品质」）。
 * 候选由 `game.upgradeCandidates()` 出，**稀有度严格更高**；换不出更强的牌时
 * 第二步会说清楚并且**不消耗这次机会**。
 */
function showUpgradePicker(game, rest, done) {
  const m = modal({
    title: t('冥想：选一张要换掉的卡'),
    wide: true,
    body: el('div', {}, [
      el('p', {
        text: t('这张卡会从卡组里移除，然后你从三张**更强**的牌里挑一张（稀有度更高、用途相同优先）。'),
        style: { marginTop: 0, opacity: .8 },
      }),
    ]),
  });
  const grid = el('div', { class: 'card-grid' });
  // 用出现次数统计，避免重复 id 无法区分
  const counts = new Map();
  for (const id of game.data.deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of counts) {
    const card = CARD_BY_ID[id];
    const node = cardEl(card, {
      size: 'sm',
      badges: n > 1 ? [`×${n}`] : [],
      onClick: () => {
        m.close();
        showUpgradeChoice(game, id, done);
      },
    });
    grid.append(node);
  }
  m.box.querySelector('.modal-body').append(grid);
}

/**
 * 第二步：从候选里挑一张。
 *
 * 候选为空（那张牌已经是最高一档）→ 直接走 restUpgrade 的拒绝分支，
 * 把理由原样透给玩家（并且这次营地机会**不会被用掉**）。
 */
function showUpgradeChoice(game, cardId, done) {
  const card = CARD_BY_ID[cardId];
  const cands = game.upgradeCandidates(cardId);
  if (!cands.length) {
    done(game.restUpgrade(cardId));   // 会返回 {ok:false, text} —— 界面负责把话说清楚
    return;
  }
  const m = modal({
    title: t('冥想：给「{name}」换一张', { name: card?.name ?? cardId }),
    wide: true,
    body: el('div', {}, [
      el('p', {
        text: t('下面这几张都比它更强（稀有度更高）。挑一张带走 —— 选不了就取消，机会还留着。'),
        style: { marginTop: 0, opacity: .8 },
      }),
    ]),
    foot: [el('button', { class: 'btn btn-ghost', onClick: () => m.close() }, [t('算了，先不换')])],
  });
  const grid = el('div', { class: 'card-grid' });
  for (const c of cands) {
    grid.append(cardEl(c, {
      size: 'sm',
      badges: [t(RARITY_LABEL[c.rarity] ?? c.rarity)],
      onClick: () => {
        const res = game.restUpgrade(cardId, c.id);
        m.close();
        done(res);
      },
    }));
  }
  m.box.querySelector('.modal-body').append(grid);
}

/** 稀有度中文名（和卡面 / 图鉴同一套说法） */
const RARITY_LABEL = { common: '普通', uncommon: '精良', rare: '稀有', epic: '史诗' };

// ============================================================
// 商店
// ============================================================
/**
 * 货架上一件道具的**作用**（一句话一行）。
 *
 * 说法的唯一来源是 core/itemtext.js —— 手持栏、图鉴、掉落窗口、这里全都问它，
 * 所以同一件东西在四个地方不会出现四种解释。
 */
function shopItemEffect(id) {
  const item = ITEMS[id];
  if (!item) return null;
  const lines = item.kind === 'hold' ? holdLines(item) : [useLine(item)].filter(Boolean);
  if (!lines.length) return null;
  const box = el('div', { class: 'shop-eff' }, [
    el('span', { class: `held-kind ${item.kind}`, text: item.kind === 'hold' ? t('持有') : t('可用') }),
  ]);
  for (const line of lines) box.append(el('span', { class: 'shop-eff-line', text: line }));
  return box;
}

function renderShop(game) {
  const host = document.getElementById('stage');
  clear(host);
  const biome = BIOMES[game.data.map.biome] ?? BIOMES.desert;

  const screen = el('div', { class: `screen scene-screen scene-bg-${biome.key}` });
  const panel = el('div', { class: 'panel panel-paper scene-panel' });
  screen.append(panel);

  // 摊主的脸 + 名字 + 招呼语（商人由 content/merchants.json 决定，按地图出摊）
  const merchant = game.shop.merchant ?? null;
  const face = el('div', { class: 'scene-illo merchant-illo' }, [
    el('span', { class: `node-ico ${nodeIco('shop', biome.key)}`, style: { width: '56px', height: '56px', color: '#8ce0c0' } }),
  ]);
  if (merchant?.slug) {
    createPortrait(merchant.slug, { emotion: merchant.emotion ?? 'normal', size: 104, alt: merchant.name }).then((img) => {
      if (!img) return;
      clear(face);
      face.append(img);
    });
  }
  panel.append(face);
  panel.append(el('h2', { class: 'panel-title', text: merchant?.name ?? t('商队') }));
  if (merchant) {
    panel.append(el('div', { class: 'panel-sub', text: `${merchant.role} · ${biome.name}` }));
  }
  panel.append(el('div', { class: 'scene-text', text: merchant?.greet ?? t('「钱货两清，概不赊账。」') }));

  /**
   * 头顶挂一行「卡组 N 张 / 金币 M」。
   * 删卡服务买完之后，玩家需要**当场看见卡组变短**才算完成了一次交易 ——
   * 以前删成功了界面上什么都没变（结果提示还写在被重画掉的旧节点上），
   * 玩家只会以为「付了钱没删掉」（用户反馈）。
   */
  const ledger = el('div', { class: 'shop-ledger' });
  panel.append(ledger);
  const refreshLedger = () => {
    clear(ledger);
    ledger.append(
      el('span', { class: 'reward-pill' }, [el('span', { class: 'ico-deck' }), t('卡组 {n} 张', { n: game.data.deck.length })]),
      el('span', { class: 'reward-pill' }, [el('span', { class: 'ico-money' }), t('金币 {n}', { n: game.data.gold })]),
    );
  };
  refreshLedger();

  const list = el('div', { class: 'shop-list' });
  panel.append(list);

  const msg = el('div', { class: 'result-box hidden' });
  panel.append(msg);

  function paint() {
    clear(list);
    // 买卡 / 买道具 / 删卡之后金币与卡组都会变，顶部那行要跟着刷新
    refreshLedger();
    game.shop.stock.forEach((s, i) => {
      const sold = game.shop.soldOut.includes(i);
      const card = s.kind === 'card' ? CARD_BY_ID[s.id] : null;
      // 货架行也要有图标：卡牌用它的卡面图标，道具用注册表里给道具挑的那个，服务用垃圾桶
      const ico = s.kind === 'card'
        ? (CARD_ART[s.id]?.ico ?? 'ico-card')
        : s.kind === 'service'
          ? 'ico-trash'
          : null;
      /** 道具行用**道具自己的图**（48×48 的 png），不是图标类名 —— 一眼认得出是哪件 */
      const icoNode = ico
        ? el('span', { class: `shop-ico ${ico}` })
        : el('img', { class: 'shop-item-art', src: itemArtUrl(s.id), alt: s.name, draggable: false });
      const node = el('div', {
        /**
         * 货架行的底色跟着**稀有度**走，用的是和卡面完全同一套变量
         * （`.card-common, .shop-item.rarity-common` 那一组，见 style.css）。
         * 道具 / 服务没有稀有度，按普通档上纸色 —— 所以这里统一给一个 rarity-* 类，
         * 不留下「没有类的行」去走另一套默认样式（那正是「没有底色」的来源）。
         */
        class: `shop-item rarity-${card?.rarity ?? 'common'} ${sold ? 'sold' : ''}`,
      }, [
        el('h4', {}, [
          icoNode,
          el('span', { text: s.name }),
          // 卡牌要标出行动点费用：以前商店里只写名字和说明，买回去才发现 2 费打不动
          card
            ? el('span', {
                class: 'shop-ap',
                dataset: { tip: t('行动点费用：打出这张牌要花 {ap} 点行动点。', { ap: card.ap }) },
              }, [el('span', { class: 'ico-action_points', style: { width: '11px', height: '11px' } }), String(card.ap)])
            : null,
        ]),
        /**
         * 卡牌那一行的描述也要走 resolveCardText（伤害 / 护盾都是按当前攻防实时算的）。
         * ⚠ 这里以前是 `el('p', { text: … })` —— 纯文本节点，卡面文案里若写了 `**重点**`
         * 就会原样印出两个星号。商店 / 事件里发的牌也会走到这条路上，所以统一过一遍富文本。
         */
        el('p', { html: card ? richText(resolveCardText(card)) : richText(s.desc ?? '') }),
        /**
         * 道具那一行：把**作用**写出来（持有型列持有效果、使用型列那一句使用效果）。
         * 以前货架上只有一句风味描述 —— 玩家站在摊子前看不出这件东西干什么，
         * 得先买回去再翻手持栏（用户报的：「物品也看不到具体作用」）。
         */
        s.kind === 'item' ? shopItemEffect(s.id) : null,
        /**
         * 专家模式：商店里卖的卡也挂上同一行数字（卡面那份是 expertChipsNode 拼的）。
         * 货架画的不是整张卡面，所以以前这里看不到任何专家数据（用户报的）。
         */
        card ? expertChipsNode(card) : null,
        el('div', { class: 'row' }, [
          el('span', { class: 'price' }, [el('span', { class: 'ico-money' }), String(s.price)]),
          el('button', {
            class: 'btn btn-sm',
            disabled: sold || game.data.gold < s.price,
            onClick: () => {
              const res = game.buy(i);
              audio[res.ok ? 'coin' : 'bad']();
              msg.className = `result-box ${res.ok ? 'good' : 'bad'}`;
              msg.textContent = res.text;
              msg.classList.remove('hidden');
              if (res.needRemove) {
                pickRemove();
              }
              paint();
            },
          }, [sold ? t('已售出') : t('购买')]),
        ]),
      ]);
      list.append(node);
    });
  }

  function pickRemove() {
    // 关掉弹窗 = 放弃这次删卡：**把钱退回去**（以前是钱照扣、卡没删）。
    // 结果统一走 toast：doRemove() 会让商店界面整体重画，挂在旧界面上的那行文字
    // （msg 盒子）那时已经脱离文档了 —— 玩家什么都看不到，只会以为「付了钱没删掉」。
    const m = modal({
      title: t('选择要移除的卡牌'),
      wide: true,
      onClose: () => {
        if (!game.pendingRemove) return;
        const res = game.refundRemove();
        if (res?.ok) toast(res.text, 'good');
        paint();
      },
    });
    const grid = el('div', { class: 'card-grid' });
    const counts = new Map();
    for (const id of game.data.deck) counts.set(id, (counts.get(id) ?? 0) + 1);
    let shown = 0;
    for (const [id, n] of counts) {
      const card = CARD_BY_ID[id];
      // 卡组里万一有未知 id（旧存档 / 内容改过）：跳过它，别把整个选牌窗搞崩
      if (!card) {
        console.warn(`[oasis] 卡组里有未知卡牌 id「${id}」，选牌窗跳过它`);
        continue;
      }
      shown += 1;
      grid.append(cardEl(card, {
        size: 'sm',
        badges: n > 1 ? [`×${n}`] : [],
        onClick: () => {
          let res = null;
          try {
            res = game.doRemove(id);
          } catch (err) {
            console.error('[oasis] 删卡时抛异常：', err);
          }
          m.close();
          if (res?.ok) {
            audio.removeCard();
            toast(res.text, 'good');
            refreshLedger();
          } else {
            audio.bad();
            toast(res?.text ?? t('删卡失败（钱已经退回）。'), 'bad');
          }
          paint();
        },
      }));
    }
    if (!shown) {
      m.close();
      toast(t('卡组里没有可以删除的卡。'), 'bad');
      return;
    }
    m.box.querySelector('.modal-body').append(grid);
  }

  paint();
  /**
   * 「卖掉手上的道具」（用户要的规则：商人处可以把不需要的道具卖掉）。
   *
   * 卖价由引擎算（`itemSellPrice` = 售价的 40%），界面只管显示与点击 ——
   * 这一栏和上面的货架分开：货架是「他要卖给你的」，这一栏是「你手上的」。
   */
  {
    const sellBox = el('div', { class: 'shop-sell' });
    const paintSell = () => {
      clear(sellBox);
      const entries = heldEntries(game.data.held ?? []);
      sellBox.append(el('h4', { text: t('卖掉手上的道具') }));
      if (!entries.length) {
        sellBox.append(el('p', { class: 'dex-empty', text: t('手上没有可以卖的东西。') }));
        return;
      }
      const grid = el('div', { class: 'shop-sell-grid' });
      for (const { id, item, n } of entries) {
        grid.append(el('div', { class: 'shop-sell-item' }, [
          el('img', { class: 'shop-item-art', src: itemArtUrl(id), alt: item.name, draggable: false }),
          el('span', { class: 'shop-sell-name', text: n > 1 ? `${item.name} ×${n}` : item.name }),
          el('button', {
            class: 'btn btn-sm btn-ghost',
            dataset: { tip: t('卖给商人，换回 {g} 金币。', { g: itemSellPrice(item) }) },
            onClick: () => {
              const res = game.sellItem(id);
              if (!res) { toast(t('这件已经不在手上了。'), 'bad'); return; }
              audio.coin();
              msg.className = 'result-box good';
              msg.textContent = t('卖掉「{name}」，金币 +{g}。', { name: t(res.name), g: res.gold });
              refreshLedger();
              paintSell();
            },
          }, [el('span', { class: 'ico-money' }), String(itemSellPrice(item))]),
        ]));
      }
      sellBox.append(grid);
    };
    paintSell();
    panel.append(sellBox);
  }
  panel.append(el('div', { class: 'reward-row', style: { justifyContent: 'flex-start' } }, [
    el('button', { class: 'btn btn-primary', onClick: () => { audio.ui('click'); game.leaveShop(); } }, [
      el('span', { class: 'ico-check' }), el('span', { text: merchant?.leave ?? t('离开商队') }),
    ]),
  ]));

  host.append(screen);
  return screen;
}

// ============================================================
// 捡到道具（掉落单独一屏）
// ============================================================
/**
 * 「捡到道具」。
 *
 * 用户的原话：「打完怪后掉落物品的提示过小，可以单独为其做一个窗口，
 * 而不是和结算画面堆在同一个窗口内」。
 *
 * 所以这一屏只干一件事：把这件东西**看清楚** —— 大图、名字、是「拿着就生效」还是
 * 「战斗外使用」、它到底干什么（效果一句一行，来自 core/itemtext.js，和手持栏 / 图鉴同一份说法）、
 * 以及它是怎么掉出来的（属性对上的掉落 / 运气掉落）。
 *
 * 顺序：掉落 → 「收下」 → 战斗结算（拿卡那屏）。奖励页里那枚小胶囊已经删掉了。
 */
function renderItemDrop(game) {
  const host = document.getElementById('stage');
  clear(host);
  const drop = game.reward?.itemDrop;
  if (!drop) return null;                       // 没有掉落就不该走到这一屏
  const item = ITEMS[drop.id];
  if (!item) return null;                       // 内容改过 / 旧存档：宁可跳过也不要画一屏空的

  const screen = el('div', { class: 'screen drop-screen scene-bg-desert' });
  const panel = el('div', { class: 'panel panel-paper scene-panel drop-panel' });
  screen.append(panel);

  panel.append(el('h2', { class: 'panel-title', text: t('捡到了道具') }));

  // 大图：道具自己的 png，摆在正中间，下面一行名字 + 类别
  const artBox = el('div', { class: 'drop-art' });
  artBox.append(el('img', { class: 'drop-art-img', src: itemArtUrl(drop.id), alt: item.name, draggable: false }));
  panel.append(artBox);
  panel.append(el('div', { class: 'drop-name-row' }, [
    el('span', { class: 'drop-name', text: item.name }),
    el('span', {
      class: `held-kind ${item.kind}`,
      text: item.kind === 'hold' ? t('持有') : t('可用'),
      dataset: { tip: item.kind === 'hold'
        ? t('拿在手上就一直生效。')
        : t('放着不生效，只能在战斗外使用。') },
    }),
    el('span', { class: `drop-rarity rarity-${item.rarity}` }, [t(RARITY_LABEL[item.rarity] ?? item.rarity)]),
  ]));

  /**
   * 效果：一句一行。持有型列持有效果（可能多条），使用型列那一句使用效果。
   * 这里是玩家第一次见到这件东西，**必须说清它干什么** —— 以前只在奖励页写了个名字，
   * 玩家得自己去翻手持栏 / 图鉴才知道。
   */
  const effLines = item.kind === 'hold' ? holdLines(item) : [useLine(item)].filter(Boolean);
  const effBox = el('div', { class: 'drop-eff' });
  if (effLines.length) {
    effBox.append(el('div', { class: 'drop-eff-title', text: item.kind === 'hold' ? t('拿在手上生效：') : t('战斗外使用：') }));
    for (const line of effLines) effBox.append(el('div', { class: 'drop-eff-line' }, [el('span', { class: 'drop-eff-dot' }), el('span', { text: line })]));
  } else {
    effBox.append(el('div', { class: 'drop-eff-title', text: t('这件东西的效果还没写清楚（内容缺效果）。') }));
  }
  panel.append(effBox);

  panel.append(el('div', { class: 'drop-desc', text: t(item.desc) }));

  // 它是怎么掉出来的：属性对上的掉落特别标一下（打毒系更容易掉毒系东西）
  panel.append(el('div', { class: 'drop-source' }, [
    el('span', { class: drop.reason === 'type' ? 'ico-star' : 'ico-arrow_up' }),
    el('span', {
      text: drop.reason === 'type'
        ? t('这只对手的属性正好对得上 —— 属性掉落。')
        : t('这一件纯粹是运气。'),
    }),
  ]));

  /** 手持栏那一行：收下了就报数，没放下就给一条出路（丢掉一件再收） */
  const heldRow = el('div', { class: 'drop-held' });
  if (drop.stored) {
    heldRow.append(el('span', { class: 'reward-pill' }, [
      el('span', { class: 'ico-check' }),
      t('已收进手持栏（{n} / {max}）', { n: game.data.held.length, max: game.heldMax() }),
    ]));
  } else {
    heldRow.append(el('span', { class: 'reward-pill' }, [
      el('span', { class: 'ico-cross' }),
      t('手持栏满了（{n} / {max}）—— 得先丢掉一件才拿得下。', { n: game.data.held.length, max: game.heldMax() }),
    ]));
    heldRow.append(el('button', {
      class: 'btn btn-sm',
      onClick: () => {
        audio.ui('open');
        /**
         * 直接把这件事交给「丢掉哪一件」那个弹窗（手持栏那套规则只有那一处实现）。
         * 先把它标记成已处理，免得玩家点掉奖励页的时候**再问一遍**。
         */
        drop.overflow = false;
        game.awaitingOverflow = { id: drop.id, text: drop.text };
        showHeldOverflow(game);
      },
    }, [el('span', { class: 'ico-trash' }), el('span', { text: t('丢掉一件，收下它') })]));
  }
  panel.append(heldRow);

  panel.append(el('div', { class: 'reward-row' }, [
    el('button', {
      class: 'btn btn-primary',
      onClick: () => {
        audio.ui('confirm');
        drop.seen = true;            // 这一屏看过一次就够，接着走战斗结算
        game.changed();
      },
    }, [el('span', { class: 'ico-check' }), el('span', { text: t('收下，去结算') })]),
  ]));

  host.append(screen);
  return screen;
}

// ============================================================
// 战斗奖励
// ============================================================
function renderReward(game) {
  const host = document.getElementById('stage');
  clear(host);
  const r = game.reward;
  if (!r) return;

  const screen = el('div', { class: 'screen reward-screen scene-bg-desert' });
  const panel = el('div', { class: 'panel scene-panel' });
  screen.append(panel);

  panel.append(el('h2', { class: 'panel-title', text: t('{name} 被击败了！', { name: r.enemyName }) }));
  const pills = el('div', { class: 'reward-row' });
  pills.append(el('span', { class: 'reward-pill' }, [el('span', { class: 'ico-money' }), t('金币 +{n}', { n: r.gold })]));
  if (r.healed > 0) pills.append(el('span', { class: 'reward-pill' }, [el('span', { class: 'ico-heal' }), t('战后恢复 +{n} HP', { n: r.healed })]));
  if (r.growthText) pills.append(el('span', { class: 'reward-pill' }, [el('span', { class: 'ico-arrow_up' }), t('成长：{text}', { text: r.growthText })]));
  /**
   * 掉落 / 开出来的道具**不在这里显示**了。
   *
   * 以前它是一枚小胶囊挤在这块结算里（名字 + 一句类别），用户反馈「提示过小」，
   * 现在掉落有自己的一屏（renderItemDrop）在前面 —— 大图、效果、出处都说得清。
   * 这一屏只留金币 / 回复 / 成长和选卡。
   */
  panel.append(pills);

  if (r.cardChoices?.length) {
    panel.append(el('div', { class: 'panel-sub', text: t('选择一张加入卡组（也可以跳过）：') }));
    const row = el('div', { class: 'reward-cards' });
    for (const card of r.cardChoices) {
      row.append(cardEl(card, {
        size: 'lg',
        onClick: () => { audio.ui('confirm'); game.takeRewardCard(card.id); },
      }));
    }
    panel.append(row);
    panel.append(el('div', { class: 'reward-row' }, [
      el('button', { class: 'btn btn-ghost', onClick: () => { audio.ui('click2'); game.takeRewardCard(null); } }, [
        el('span', { class: 'ico-cross' }), el('span', { text: t('跳过，不要卡牌') }),
      ]),
    ]));
  } else {
    panel.append(el('div', { class: 'panel-sub', text: t('这次没有掉落卡牌。') }));
    panel.append(el('div', { class: 'reward-row' }, [
      el('button', { class: 'btn btn-primary', onClick: () => { audio.ui('confirm'); game.takeRewardCard(null); } }, [
        el('span', { class: 'ico-check' }), el('span', { text: t('继续前进') }),
      ]),
    ]));
  }

  host.append(screen);
  return screen;
}

// ============================================================
// 结算
// ============================================================
function renderGameOver(game) {
  const host = document.getElementById('stage');
  clear(host);
  const d = game.data;
  const meta = save.readMeta();
  const biome = BIOMES[d?.map?.biome ?? 'desert'];

  const screen = el('div', { class: 'screen gameover-screen' });
  const inner = el('div', { class: 'title-inner' });
  screen.append(inner);

  const heroBox = el('div', { class: 'title-hero' });
  inner.append(heroBox);
  createAnim(d.slug, { anim: 'Hurt', scale: 3.4, fps: 6, dir: DIR.DOWN })
    .then((a) => { heroBox.append(a); a.playOnce(6); })
    .catch(() => {});

  inner.append(el('div', { class: 'title-illo' }, [
    el('span', { class: 'ico-death', style: { width: '54px', height: '54px', color: '#e8cfa2' } }),
  ]));
  inner.append(el('h1', { text: game.isEndless() ? t('无尽之旅到此为止') : t('灰溜溜地回家了') }));
  inner.append(el('div', {
    class: 'title-quote',
    // 失败**不写成**「她倒下了 / 沙子盖住了一切」：这一局只是没打完，人好好的。
    // （这里以前还跟着第二段「风很快就把她的痕迹吹平了——但沙漠记住了她走过」，
    //   那是旧版「她死了」的挽歌，和上一段「回家洗澡、下次再来」自相矛盾，已删。）
    text: game.isEndless()
      // 无尽模式：这一局的成绩就是「走到第几章」，所以那句话换了说法
      ? t('{name} 在{biome}走到了第 {stage} 章，第 {floor} 步 —— 无尽模式就是看能走多远。\n最好的一次是第 {best} 章。', {
          name: d.name, biome: biome.name, stage: d.stage + 1, floor: d.floor + 1,
          best: Math.max(meta.endlessBest ?? 0, d.stage + 1),
        })
      : t('{name} 在{biome}撑到第 {floor} 步，还是决定先回家。\n抖干净沙子、泡了个澡、把卡组重新洗了一遍——下次再来。', { name: d.name, biome: biome.name, floor: d.floor + 1 }),
  }));

  inner.append(el('div', { class: 'run-stats' }, [
    statBox(t('抵达步数'), d.floor + 1),
    statBox(t('推进章节'), game.isEndless() ? t('第 {n} 章', { n: d.stage + 1 }) : `${d.stage + 1} / ${stageCount()}`),
    statBox(t('击败对手'), d.kills),
    statBox(t('战斗回合'), d.turnsThisRun),
    statBox(t('卡组张数'), d.deck.length),
    statBox(t('金币结余'), d.gold),
  ]));

  inner.append(el('div', { class: 'title-menu' }, [
    el('button', { class: 'btn btn-primary btn-lg', onClick: () => { audio.ui('confirm'); game.newRun(); } }, [
      el('span', { class: 'ico-refresh' }), el('span', { text: t('再来一次') }),
    ]),
    // 刚打完这一局是最想看记录的时候（「刚才那局打到第几章来着」）
    el('button', { class: 'btn btn-ghost', onClick: () => { audio.ui('open'); showRecords(); } }, [
      el('span', { class: 'ico-trophy' }), el('span', { text: t('通关记录') }),
    ]),
    // 走「改 phase + 交给 UI 渲染」这条路，而不是直接 renderTitle()：
    // renderTitle 要等精灵图，直接调用的话它会绕过 UI 的换屏记账（见那里的说明）
    el('button', {
      class: 'btn btn-ghost',
      onClick: () => { audio.ui('click'); game.phase = 'title'; game.onChange?.(game); },
    }, [
      el('span', { class: 'ico-home' }), el('span', { text: t('回到标题') }),
    ]),
  ]));

  inner.append(el('div', { class: 'title-foot', text: t('历史最远：{best} 步 ｜ 累计击败：{kills}', { best: meta.bestDistance ?? 0, kills: meta.kills ?? 0 }) }));

  host.append(screen);
  audio.lose();
  return screen;
}

function renderVictory(game) {
  const host = document.getElementById('stage');
  clear(host);
  const d = game.data;
  const meta = save.readMeta();
  const hero = heroById(d?.hero);
  const others = HEROES.filter((h) => h.id !== hero?.id);
  const locked = others.filter((h) => !isHeroUnlocked(h, meta));
  const screen = el('div', { class: 'screen victory-screen' });
  const inner = el('div', { class: 'title-inner' });
  screen.append(inner);

  const heroBox = el('div', { class: 'title-hero' });
  inner.append(heroBox);
  createAnim(d.slug, { anim: hero?.titleAnim ?? 'FlapAround', scale: 3, fps: 10, dir: DIR.DOWN_RIGHT })
    .then((a) => heroBox.append(a))
    .catch(() => {});

  inner.append(el('div', { class: 'title-illo' }, [
    el('span', { class: 'ico-award', style: { width: '54px', height: '54px', color: '#f0b95c' } }),
  ]));
  /**
   * 结局文案**跟着主角走**（content/heroes.json 的 ending）。
   * 欧亚西莉亚那一版是「你走到了沙的尽头」；阿特拉斯那一版是他追出去、
   * 在沙的尽头遇见她、两条龙一起回家 —— 用户口述的剧情。
   */
  inner.append(el('h1', { text: t(hero?.ending?.title ?? '你走到了沙的尽头') }));
  inner.append(el('p', {
    class: 'title-quote',
    text: t(hero?.ending?.text ?? '', { name: d.name }),
  }));
  /** 这一位主角通关时那句专属台词（通关页也是「他/她」说最后一句的地方） */
  if (hero?.clearHint) inner.append(el('p', { class: 'title-quote title-quote-soft', text: t(hero.clearHint) }));

  /**
   * 通关页顺带报一下解锁 —— 玩家刚通关，正是告诉他「还有得玩」的时候：
   *   · 第一位主角通关：解锁**另一位主角**（点头图切换）与**无尽模式**；
   *   · 另一位主角通关：无尽模式里也能用他。
   */
  const banner = el('div', { class: 'unlock-banner' });
  banner.append(el('span', { class: 'ico-infinity', style: { width: '22px', height: '22px' } }));
  banner.append(el('span', {
    // 这条文案沿用 2.x 那一句（译文已经在了，不为了排版再换一次 key）
    text: t('通关达成 —— 标题页多了一个「无尽模式」入口：岔路更多、敌人更强，看你能走到第几章。'),
  }));
  inner.append(banner);
  for (const h of locked) {
    const row = el('div', { class: 'unlock-banner unlock-banner-hero' });
    row.append(el('span', { class: 'ico-change', style: { width: '22px', height: '22px' } }));
    row.append(el('span', { text: t('{name}，那只{species}，如今也动身了。\n回标题页点一下头图，就能换人来走——这条路更长，一章有两个首领在等。', { name: h.name, species: h.speciesName }) }));
    inner.append(row);
  }

  inner.append(el('div', { class: 'run-stats' }, [
    statBox(t('推进章节'), t('{n} / {total} 通关', { n: stageCount(), total: stageCount() })),
    statBox(t('总步数'), d.floor + 1),
    statBox(t('击败对手'), d.kills),
    statBox(t('战斗回合'), d.turnsThisRun),
    statBox(t('最终攻击'), d.atk),
    statBox(t('最终防御'), d.def),
    statBox(t('最终敏捷'), d.agi),
    statBox(t('最终幸运'), d.luck),
    statBox(t('卡组张数'), d.deck.length),
    statBox(t('剩余金币'), d.gold),
  ]));

  inner.append(el('div', { class: 'title-menu' }, [
    el('button', { class: 'btn btn-primary btn-lg', onClick: () => { audio.ui('confirm'); game.newRun(); } }, [
      el('span', { class: 'ico-refresh' }), el('span', { text: t('再来一次（更难的手感）') }),
    ]),
    el('button', { class: 'btn btn-ghost', onClick: () => { audio.ui('open'); showRecords(); } }, [
      el('span', { class: 'ico-trophy' }), el('span', { text: t('通关记录') }),
    ]),
    el('button', {
      class: 'btn btn-ghost',
      onClick: () => { audio.ui('click'); game.phase = 'title'; game.onChange?.(game); },
    }, [
      el('span', { class: 'ico-home' }), el('span', { text: t('回到标题') }),
    ]),
  ]));

  host.append(screen);
  audio.win();
  return screen;
}

function statBox(label, value) {
  return el('div', { class: 'run-stat' }, [el('b', { text: String(value) }), el('span', { text: label })]);
}

/**
 * 标题页那一排「记录 / 图鉴」按钮：图标 + 名字 + 进度。
 * 进度单独一个 span，**不拼进要翻译的句子**里 —— 数字不属于译文。
 */
function titleCodexBtn(ico, label, sub, onClick) {
  return el('button', {
    class: 'btn btn-ghost title-codex-btn',
    onClick: () => { audio.ui('open'); onClick(); },
  }, [
    el('span', { class: `title-codex-ico ${ico}` }),
    el('span', { class: 'title-codex-label', text: label }),
    el('span', { class: 'title-codex-sub', text: sub }),
  ]);
}

/* 导出：src/ui/ui.js 与 src/ui/battle-view.js 要用（写法对齐 src/ui/hud.js）*/
export { renderTitle, renderMap, renderEvent, renderChest, renderRest, renderShop, renderReward, renderItemDrop, renderGameOver, renderVictory };
