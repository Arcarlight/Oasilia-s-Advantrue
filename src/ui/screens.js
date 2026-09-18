// 各个界面：标题 / 地图 / 事件 / 宝箱 / 商店 / 营地 / 奖励 / 结算
// 弹窗类界面（卡组、背包、帮助、设置）在 overlays.js 里。

import { el, clear, toast, modal, floatAt } from './dom.js';
import { cardEl, CARD_ART } from './cards.js';
import { createAnim, DIR } from '../core/sprites.js';
import { createPortrait, setPortraitEmotion } from '../core/portraits.js';
import { audio } from '../core/audio.js';
import { BIOMES, BALANCE } from '../data/balance.js';
import { CARD_BY_ID, ITEMS } from '../data/cards.js';
import { NODE_TYPES, nodeName } from '../data/mapgen.js';
import { save } from '../core/save.js';
import { showDeck, showItems, showHelp, showSettings } from './overlays.js';
import { renderHud } from './hud.js';

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
};

// ============================================================
// 标题
// ============================================================
async function renderTitle(game) {
  const host = document.getElementById('stage');
  clear(host);
  const meta = save.readMeta();

  const screen = el('div', { class: 'screen title-screen' });
  const inner = el('div', { class: 'title-inner' });
  screen.append(inner);

  const heroBox = el('div', { class: 'title-hero' });
  inner.append(heroBox);
  try {
    // 标题用飞行动画（FlapAround）比原地待机更有「出发去冒险」的感觉
    const hero = await createAnim('flygon', { anim: 'FlapAround', scale: 3.4, fps: 10, dir: DIR.DOWN_RIGHT });
    heroBox.append(hero);
  } catch { /* ignore */ }

  // 头图 + 标题排成一行：头图放在标题左边当「主视觉」
  const heroName = BALANCE.player.name;
  const lockup = el('div', { class: 'title-lockup' });
  const faceBox = el('div', { class: 'title-portrait' });
  const names = el('div', { class: 'title-names' }, [
    el('h1', { class: 'title-h1', text: '沙漠精灵' }),
    el('div', { class: 'title-h2', text: heroName }),
  ]);
  lockup.append(faceBox, names);
  inner.append(lockup);
  // 头图原生只有 40x40，放大到 64px（整数倍）最清晰
  createPortrait('flygon', { emotion: 'happy', size: 64, alt: heroName }).then((img) => {
    if (img) faceBox.append(img);
  });

  inner.append(el('p', {
    class: 'title-quote',
    text: `「凡是听见沙子唱歌的人，最后都留在了沙里。」\n——你是${heroName}，一只雌性沙漠蜻蜓。沙海深处有个声音在叫你，你决定去看看。`,
  }));

  const hasSave = !!save.readRun();
  const menu = el('div', { class: 'title-menu' });
  if (hasSave) {
    menu.append(el('button', {
      class: 'btn btn-primary btn-lg', onClick: () => { audio.ui('confirm'); game.loadFromData(save.readRun()); },
    }, [el('span', { class: 'ico-save' }), el('span', { text: '继续上次的旅程' })]));
  }
  menu.append(
    el('button', {
      class: hasSave ? 'btn btn-lg' : 'btn btn-primary btn-lg',
      onClick: () => { audio.ui('confirm'); game.newRun(); },
    }, [el('span', { class: 'ico-star' }), el('span', { text: '开始新的冒险' })]),
    el('button', { class: 'btn btn-ghost', onClick: () => { audio.ui('open'); showHelp(); } }, [
      el('span', { class: 'ico-help' }), el('span', { text: '玩法说明' }),
    ]),
    el('button', { class: 'btn btn-ghost', onClick: () => { audio.ui('open'); showSettings(); } }, [
      el('span', { class: 'ico-gear' }), el('span', { text: '设置' }),
    ]),
    el('button', {
      class: 'btn btn-ghost btn-sm',
      onClick: async () => {
        const data = await save.importFile();
        if (!data) return toast('读取失败：文件不是本作的存档。', 'bad');
        game.loadFromData(data);
        toast('存档已导入！', 'good');
      },
    }, ['导入存档 JSON']),
  );
  inner.append(menu);

  inner.append(el('div', { class: 'title-meta' }, [
    el('span', {}, ['最远步数 ', el('b', { text: String(meta.bestDistance ?? 0) })]),
    el('span', {}, ['累计击败 ', el('b', { text: String(meta.kills ?? 0) })]),
    el('span', {}, ['通关次数 ', el('b', { text: String(meta.wins ?? 0) })]),
  ]));

  inner.append(el('div', {
    class: 'title-foot',
    html: '素材：宝可梦精灵图来自 <b>PMDCollab/SpriteCollab</b>；界面与音效来自 <b>Kenney</b> 素材包。<br>这是一个非商业的同人练习作品。',
  }));

  host.append(screen);
  return screen;
}

// ============================================================
// 地图
// ============================================================
function renderMap(game) {
  const host = document.getElementById('stage');
  clear(host);
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
    el('div', { class: 'map-chapter', text: biome.sub }),
    el('h2', { class: 'map-name' }, [
      el('span', { class: `map-name-ico ${biomeIco}` }),
      el('span', { text: biome.name }),
    ]),
    el('div', { class: 'map-desc', text: biome.desc }),
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
    const name = nodeName(n.type, map.biome);   // 商队/营地按地图换叫法
    const p = posOf(n);
    const isAvail = available.includes(n.id);
    const isCurrent = game.data.nodeId === n.id;
    const node = el('button', {
      class: ['map-node', isAvail ? 'available' : '', n.visited ? 'done' : '', isCurrent ? 'current' : '', n.type === 'boss' ? 'boss' : '', n.visited && !isAvail ? 'locked' : ''].filter(Boolean).join(' '),
      style: { left: `${(p.x / 1000) * 100}%`, top: `${(p.y / H) * 100}%`, color: type.color },
      title: `${name}：${type.desc}`,
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
  const legend = el('div', { class: 'map-legend' }, Object.entries(NODE_TYPES).map(([type, t]) => el('span', { class: 'legend-item' }, [
    el('span', { class: `node-ico legend-ico ${nodeIco(type, map.biome)}`, style: { color: t.color } }),
    el('span', { text: nodeName(type, map.biome) }),
  ])));
  body.append(legend);

  // 底部操作
  screen.append(el('div', { class: 'map-actions' }, [
    el('button', { class: 'btn', onClick: () => { audio.ui('open'); showDeck(game); } }, [
      el('span', { class: 'ico-deck' }), el('span', { text: `卡组 (${game.data.deck.length})` }),
    ]),
    el('button', { class: 'btn btn-ghost', onClick: () => { audio.ui('open'); showItems(game); } }, [
      el('span', { class: 'ico-backpack' }), el('span', { text: '背包' }),
    ]),
    el('button', { class: 'btn btn-ghost', onClick: () => { audio.ui('open'); showHelp(); } }, [
      el('span', { class: 'ico-question_mark' }), el('span', { text: '说明' }),
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
      }, [el('span', { class: 'ico-check' }), el('span', { text: '继续前进' })]),
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
  panel.append(el('h2', { class: 'panel-title', text: isMimic ? '宝箱……动了' : '宝箱' }));
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
      if (chest.gold) pills.append(el('span', { class: 'reward-pill' }, [el('span', { class: 'ico-money' }), `金币 +${chest.gold}`]));
      pills.append(el('span', { class: 'reward-pill' }, [el('span', { class: 'ico-pouch' }), '已收入囊中']));
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
      el('span', { text: isMimic ? '迎战！' : '继续前进' }),
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
  panel.append(el('h2', { class: 'panel-title', text: '绿洲营地' }));
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
      ? '这里该做的事已经做完了——直接出发吧。'
      : '篝火很旺，水是凉的。你可以做一件事——只有一件。';

    body.append(el('button', {
      class: `option ${spent ? 'disabled' : ''}`,
      disabled: spent,
      onClick: () => {
        audio.heal();
        const healed = game.restHeal();
        if (healed == null) return;          // 机会已经用掉了
        toast(`回复了 ${healed} 点 HP`, 'good');
        paint();
      },
    }, [
      el('span', { class: 'option-label' }, [
        el('span', { class: 'ico-heal' }),
        el('span', { text: `休息一下（回复 ${rest.healAmount} HP，约最大生命的 ${Math.round(BALANCE.restHealPct * 100)}%）` }),
      ]),
      el('small', {
        text: rest.used
          ? (rest.healResult > 0 ? `已经休息过了（回了 ${rest.healResult} 点）。` : '已经休息过了（当时是满血）。')
          : spent
            ? '这次机会已经用在冥想上了。'
            : game.data.hp >= game.data.maxHp
              // 满血还休息就白扔一次机会，事先说清楚
              ? `当前 HP ${game.data.hp} / ${game.data.maxHp}（满血，休息会浪费这次机会）`
              : `当前 HP ${game.data.hp} / ${game.data.maxHp}`,
      }),
    ]));

    body.append(el('button', {
      class: `option ${spent ? 'disabled' : ''}`,
      disabled: spent,
      onClick: () => {
        if (spent) return;
        audio.ui('open');
        showUpgradePicker(game, rest, (res) => {
          if (res) toast(`「${res.removed}」→「${res.gained}」`, 'good');
          paint();
        });
      },
    }, [
      el('span', { class: 'option-label' }, [
        el('span', { class: 'ico-arrow_up' }),
        el('span', { text: '在此地冥想（把一张卡换成更强的卡）' }),
      ]),
      el('small', {
        text: rest.upgraded
          ? `已经把「${rest.upgradeResult?.removed ?? '一张卡'}」换掉了。`
          : spent
            ? '这次机会已经用在休息上了。'
            : '随机替换为一张更高稀有度的卡',
      }),
    ]));

    body.append(el('button', {
      class: 'option',
      onClick: () => { audio.ui('click'); game.leaveRest(); },
    }, [el('span', { class: 'option-label' }, [
      el('span', { class: 'ico-arrow_right' }),
      el('span', { text: '直接出发' }),
    ]), el('small', { text: spent ? '出发去下一个节点。' : '不消费这次机会。' })]));
  }

  paint();
  host.append(screen);
  return screen;
}

function showUpgradePicker(game, rest, done) {
  const m = modal({
    title: '选择要替换的卡牌',
    wide: true,
    body: el('div', {}, [
      el('p', { text: '这张卡会从卡组里移除，并换成一张随机的高稀有度卡牌。', style: { marginTop: 0, opacity: .8 } }),
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
        const res = game.restUpgrade(id);
        m.close();
        done(res);
      },
    });
    grid.append(node);
  }
  m.box.querySelector('.modal-body').append(grid);
}

// ============================================================
// 商店
// ============================================================
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
  panel.append(el('h2', { class: 'panel-title', text: merchant?.name ?? '商队' }));
  if (merchant) {
    panel.append(el('div', { class: 'panel-sub', text: `${merchant.role} · ${biome.name}` }));
  }
  panel.append(el('div', { class: 'scene-text', text: merchant?.greet ?? '「钱货两清，概不赊账。」' }));

  const list = el('div', { class: 'shop-list' });
  panel.append(list);

  const msg = el('div', { class: 'result-box hidden' });
  panel.append(msg);

  function paint() {
    clear(list);
    game.shop.stock.forEach((s, i) => {
      const sold = game.shop.soldOut.includes(i);
      const card = s.kind === 'card' ? CARD_BY_ID[s.id] : null;
      // 货架行也要有图标：卡牌用它的卡面图标，道具用注册表里给道具挑的那个，服务用垃圾桶
      const ico = s.kind === 'card'
        ? (CARD_ART[s.id]?.ico ?? 'ico-card')
        : s.kind === 'service'
          ? 'ico-trash'
          : (ITEMS[s.id]?.ico ?? 'ico-backpack');
      const node = el('div', { class: `shop-item ${sold ? 'sold' : ''}` }, [
        el('h4', {}, [
          el('span', { class: `shop-ico ${ico}` }),
          el('span', { text: s.name }),
          // 卡牌要标出行动点费用：以前商店里只写名字和说明，买回去才发现 2 费打不动
          card
            ? el('span', {
                class: 'shop-ap',
                dataset: { tip: `行动点费用：打出这张牌要花 ${card.ap} 点行动点。` },
              }, [el('span', { class: 'ico-action_points', style: { width: '11px', height: '11px' } }), String(card.ap)])
            : null,
        ]),
        el('p', { text: card ? card.text : (s.desc ?? '') }),
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
          }, [sold ? '已售出' : '购买']),
        ]),
      ]);
      list.append(node);
    });
  }

  function pickRemove() {
    // 关掉弹窗 = 放弃这次删卡：**把钱退回去**（以前是钱照扣、卡没删，玩家只会觉得亏了）
    const m = modal({
      title: '选择要移除的卡牌',
      wide: true,
      onClose: () => {
        if (!game.pendingRemove) return;
        const res = game.refundRemove();
        if (res?.ok) {
          msg.className = 'result-box bad';
          msg.textContent = res.text;
          msg.classList.remove('hidden');
          paint();
        }
      },
    });
    const grid = el('div', { class: 'card-grid' });
    const counts = new Map();
    for (const id of game.data.deck) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, n] of counts) {
      grid.append(cardEl(CARD_BY_ID[id], {
        size: 'sm',
        badges: n > 1 ? [`×${n}`] : [],
        onClick: () => {
          const res = game.doRemove(id);
          m.close();
          msg.className = `result-box ${res?.ok ? 'good' : 'bad'}`;
          msg.textContent = res?.text ?? '移除失败。';
          msg.classList.remove('hidden');
          paint();
        },
      }));
    }
    m.box.querySelector('.modal-body').append(grid);
  }

  paint();
  panel.append(el('div', { class: 'reward-row', style: { justifyContent: 'flex-start' } }, [
    el('button', { class: 'btn btn-primary', onClick: () => { audio.ui('click'); game.leaveShop(); } }, [
      el('span', { class: 'ico-check' }), el('span', { text: merchant?.leave ?? '离开商队' }),
    ]),
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

  panel.append(el('h2', { class: 'panel-title', text: `${r.enemyName} 被击败了！` }));
  const pills = el('div', { class: 'reward-row' });
  pills.append(el('span', { class: 'reward-pill' }, [el('span', { class: 'ico-money' }), `金币 +${r.gold}`]));
  if (r.healed > 0) pills.append(el('span', { class: 'reward-pill' }, [el('span', { class: 'ico-heal' }), `战后恢复 +${r.healed} HP`]));
  if (r.growthText) pills.append(el('span', { class: 'reward-pill' }, [el('span', { class: 'ico-arrow_up' }), `成长：${r.growthText}`]));
  // 道具 / 遗物各自用注册表里给它挑的图标（以前两个都是 ico-star，压根看不出拿的是什么）
  if (r.potion) pills.append(el('span', { class: 'reward-pill' }, [el('span', { class: ITEMS[r.potion]?.ico ?? 'ico-flask' }), `获得 ${ITEMS[r.potion].name}`]));
  if (r.relic) pills.append(el('span', { class: 'reward-pill' }, [el('span', { class: ITEMS[r.relic]?.ico ?? 'ico-clover' }), `获得 ${ITEMS[r.relic].name}`]));
  panel.append(pills);

  if (r.cardChoices?.length) {
    panel.append(el('div', { class: 'panel-sub', text: '选择一张加入卡组（也可以跳过）：' }));
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
        el('span', { class: 'ico-cross' }), el('span', { text: '跳过，不要卡牌' }),
      ]),
    ]));
  } else {
    panel.append(el('div', { class: 'panel-sub', text: '这次没有掉落卡牌。' }));
    panel.append(el('div', { class: 'reward-row' }, [
      el('button', { class: 'btn btn-primary', onClick: () => { audio.ui('confirm'); game.takeRewardCard(null); } }, [
        el('span', { class: 'ico-check' }), el('span', { text: '继续前进' }),
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
  inner.append(el('h1', { text: '灰溜溜地回家了' }));
  inner.append(el('div', {
    class: 'title-quote',
    // 失败不再写成「她倒下了 / 沙子盖住了一切」：这一局只是没打完，人好好的
    text: `${d.name} 在${biome.name}撑到第 ${d.floor + 1} 步，还是决定先回家。\n抖干净沙子、泡了个澡、把卡组重新洗了一遍——下次再来。`,
  }));
  inner.append(el('p', {
    class: 'title-quote',
    text: `${d.name} 停在了${biome.name}的第 ${d.floor + 1} 步。\n风很快就把她的痕迹吹平了——但沙漠记住了她走过。`,
  }));

  inner.append(el('div', { class: 'run-stats' }, [
    statBox('抵达步数', d.floor + 1),
    statBox('推进章节', `${d.stage + 1} / 3`),
    statBox('击败对手', d.kills),
    statBox('战斗回合', d.turnsThisRun),
    statBox('卡组张数', d.deck.length),
    statBox('金币结余', d.gold),
  ]));

  inner.append(el('div', { class: 'title-menu' }, [
    el('button', { class: 'btn btn-primary btn-lg', onClick: () => { audio.ui('confirm'); game.newRun(); } }, [
      el('span', { class: 'ico-refresh' }), el('span', { text: '再来一次' }),
    ]),
    el('button', { class: 'btn btn-ghost', onClick: () => { audio.ui('click'); renderTitle(game); } }, [
      el('span', { class: 'ico-home' }), el('span', { text: '回到标题' }),
    ]),
  ]));

  inner.append(el('div', { class: 'title-foot', text: `历史最远：${meta.bestDistance ?? 0} 步 ｜ 累计击败：${meta.kills ?? 0}` }));

  host.append(screen);
  audio.lose();
  return screen;
}

function renderVictory(game) {
  const host = document.getElementById('stage');
  clear(host);
  const d = game.data;
  const screen = el('div', { class: 'screen victory-screen' });
  const inner = el('div', { class: 'title-inner' });
  screen.append(inner);

  const heroBox = el('div', { class: 'title-hero' });
  inner.append(heroBox);
  createAnim(d.slug, { anim: 'FlapAround', scale: 3, fps: 10, dir: DIR.DOWN_RIGHT })
    .then((a) => heroBox.append(a))
    .catch(() => {});

  inner.append(el('div', { class: 'title-illo' }, [
    el('span', { class: 'ico-award', style: { width: '54px', height: '54px', color: '#f0b95c' } }),
  ]));
  inner.append(el('h1', { text: '你走到了沙的尽头' }));
  inner.append(el('p', {
    class: 'title-quote',
    text: `夜砂墓原的尽头不是墙，是一片什么都没有的平地。\n绿色细胞拼成的脸慢慢散开，落回沙里。\n「……好吧。你走得够远了，沙漠的孩子。」\n\n${d.name} 展开翅膀，第一次觉得风是干净的。`,
  }));

  inner.append(el('div', { class: 'run-stats' }, [
    statBox('推进章节', '3 / 3 通关'),
    statBox('总步数', d.floor + 1),
    statBox('击败对手', d.kills),
    statBox('战斗回合', d.turnsThisRun),
    statBox('最终攻击', d.atk),
    statBox('最终防御', d.def),
    statBox('最终敏捷', d.agi),
    statBox('最终幸运', d.luck),
    statBox('卡组张数', d.deck.length),
    statBox('剩余金币', d.gold),
  ]));

  inner.append(el('div', { class: 'title-menu' }, [
    el('button', { class: 'btn btn-primary btn-lg', onClick: () => { audio.ui('confirm'); game.newRun(); } }, [
      el('span', { class: 'ico-refresh' }), el('span', { text: '再来一次（更难的手感）' }),
    ]),
    el('button', { class: 'btn btn-ghost', onClick: () => { audio.ui('click'); renderTitle(game); } }, [
      el('span', { class: 'ico-home' }), el('span', { text: '回到标题' }),
    ]),
  ]));

  host.append(screen);
  audio.win();
  return screen;
}

function statBox(label, value) {
  return el('div', { class: 'run-stat' }, [el('b', { text: String(value) }), el('span', { text: label })]);
}

/* 导出：src/ui/ui.js 与 src/ui/battle-view.js 要用（写法对齐 src/ui/hud.js）*/
export { renderTitle, renderMap, renderEvent, renderChest, renderRest, renderShop, renderReward, renderGameOver, renderVictory };
