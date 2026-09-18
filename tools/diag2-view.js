// 诊断：出牌展示区的位置是否压住了怪兽/角色卡/日志，顺便截图。
// 由 tools/diag2.mjs 通过 ?dg2=1&dgview=1 加载（dgview 只是给 mjs 认的标志）。
(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rect = (sel) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const overlap = (a, b) => {
    if (!a || !b) return false;
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  };
  /** 等某个元素的位置稳定下来（入场动画有位移+缩放，量到中间帧会误报重叠） */
  const settled = async (sel, tries = 30) => {
    let last = null;
    for (let i = 0; i < tries; i++) {
      const node = document.querySelector(sel);
      const r = rect(sel);
      // 必须已经「落定」：transform 里不带位移（入场动画是 translateY + scale）
      const tf = node ? getComputedStyle(node).transform : 'none';
      const moving = tf && tf !== 'none' && !/^matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)$/.test(tf);
      if (r && !moving && last && r.x === last.x && r.y === last.y && r.w === last.w && r.h === last.h) return r;
      last = r;
      await new Promise((r2) => setTimeout(r2, 80));
    }
    return rect(sel);
  };

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    game.newRun(90210);
    game.data.deck = ['dragon_dance', 'bite', 'bite', 'harden', 'bite', 'bite', 'harden', 'bite', 'bite', 'bite'];
    game.data.battleDeck = null;
    await wait(400);
    const node = game.availableNodes().find((n) => n.type === 'battle') || game.availableNodes()[0];
    game.goToNode(node.id);
    await wait(1800);

    const b = game.battle;
    const bs = ui.battleScreen;
    let reveals = 0;
    let plays = 0;
    const origReveal = bs.revealCard.bind(bs);
    bs.revealCard = function (side, id, cost) { reveals += 1; return origReveal(side, id, cost); };
    const origPlayEvent = bs.playEvent.bind(bs);
    bs.playEvent = function (ev) { if (ev.type === 'playCard') plays += 1; return origPlayEvent(ev); };
    // 注意：开战时敌方手牌是空的（要到它自己的回合才抽），所以从牌堆里找一张伤害牌
    const pool = b.decks.enemy.hand.length ? b.decks.enemy.hand : b.decks.enemy.draw;
    const proto = pool.find((c) => c.card.effects.some((e) => e.kind === 'damage')) || pool[0];
    log('  用来逼牌的样例 = ' + (proto ? proto.card.name : '(没找到)'));
    if (proto) b.decks.enemy.hand = [{ ...proto, uid: 'v1' }, { ...proto, uid: 'v2' }];
    b.enemy.apMax = 9; b.enemy.ap = 9; b.enemy.playMax = 9; b.enemy.playsLeft = 9;

    const turnPr = bs.onEndTurn();
    // 等第一张牌摊出来
    for (let i = 0; i < 120; i++) {
      if (document.querySelector('.enemy-play .played-card')) break;
      await wait(50);
    }
    // 卡片入场有 0.26s 的位移/缩放动画，等它落定再量，否则量到的是起始帧（会误报压到顶栏）
    const pc = await settled('.enemy-play .played-card');
    log('敌方出牌卡面 rect = ' + JSON.stringify(pc));
    // 顺手把一张牌钉在我方出牌区，量一下会不会压到别的东西
    const srcCard = document.querySelector('.hand .card');
    if (srcCard && bs.playerPlay) {
      // 先用真实的摆放逻辑摆一次（而不是拿挂载时的旧位置量）
      if (typeof bs.layoutPlayZone === 'function') bs.layoutPlayZone('player');
      const clone = srcCard.cloneNode(true);
      // 注意：不要再加 card-sm —— 那会在卡牌元素上写死 --card-w/--card-h，
      // 盖掉 layoutPlayZone() 从 zone 继承下来的尺寸，量出来的就不是真实摆法了。
      const wrap = document.createElement('div');
      wrap.className = 'played-card played-player in';
      wrap.append(clone);
      bs.playerPlay.append(wrap);
    }
    const pp = rect('.player-play .played-card');
    log('我方出牌卡面 rect = ' + JSON.stringify(pp));
    for (const [name, sel] of [
      ['我方精灵', '.fighter-player .fighter-body canvas'],
      ['我方角色卡', '.fighter-player .fighter-card'],
      ['敌方精灵', '.fighter-enemy .fighter-body canvas'],
      ['战斗日志', '.battle-log'],
      ['回合/意图', '.battle-middle'],
      ['结束回合按钮', '.battle-bar .btn'],
      ['底部手牌', '.hand'],
    ]) {
      log('  我方出牌区 vs ' + name + ' 重叠 = ' + overlap(pp, rect(sel)));
    }
    log('  revealCard 调用 ' + reveals + ' 次，playCard 事件 ' + plays + ' 个，busy=' + bs.busy + ' turn=' + b.turn + ' over=' + b.over);
    log('  .enemy-play 个数 = ' + document.querySelectorAll('.enemy-play').length +
        '，.battle-screen 个数 = ' + document.querySelectorAll('.battle-screen').length +
        '，当前 battleScreen 的 zone 在文档里? ' + (bs.enemyPlay ? document.body.contains(bs.enemyPlay) : '?'));
    if (turnPr && turnPr.then) await turnPr;
    log('  与敌方角色卡重叠 = ' + overlap(pc, rect('.fighter-enemy .fighter-card')));
    log('  与敌方精灵重叠 = ' + overlap(pc, rect('.fighter-enemy .fighter-body canvas')));
    log('  与玩家角色卡重叠 = ' + overlap(pc, rect('.fighter-player .fighter-card')));
    log('  与玩家精灵重叠 = ' + overlap(pc, rect('.fighter-player .fighter-body canvas')));
    log('  与战斗日志重叠 = ' + overlap(pc, rect('.battle-log')));
    log('  与手牌区重叠 = ' + overlap(pc, rect('.hand')));
    log('  与回合/意图区重叠 = ' + overlap(pc, rect('.battle-middle')));
    log('  与顶栏重叠 = ' + overlap(pc, rect('.hud')));
    // 自适应布局的关键验收：精灵不能被压出行外、也不能被顶栏盖住
    const hudR = rect('.hud');
    const fieldR = rect('.battle-field');
    const eSprite = rect('.fighter-enemy .fighter-body canvas');
    const pSprite = rect('.fighter-player .fighter-body canvas');
    const eRow = rect('.fighter-enemy');
    const pRow = rect('.fighter-player');
    log('  敌方精灵 与顶栏重叠 = ' + overlap(eSprite, hudR) + '（必须 false）');
    log('  我方精灵 与顶栏重叠 = ' + overlap(pSprite, hudR) + '（必须 false）');
    // 宽高比检查：CSS 显示尺寸必须和 canvas 内部分辨率同比例，否则行走图会被压扁
    for (const [name, sel] of [['敌方', '.fighter-enemy .fighter-body canvas'], ['我方', '.fighter-player .fighter-body canvas']]) {
      const node = document.querySelector(sel);
      if (!node) { log(`  ${name}精灵 宽高比 = 找不到 canvas`); continue; }
      const r = node.getBoundingClientRect();
      const inner = node.width / node.height;
      const outer = r.width / r.height;
      const ok = Math.abs(inner - outer) < 0.02;
      log(`  ${name}精灵 宽高比 = 内部 ${inner.toFixed(3)} vs 显示 ${outer.toFixed(3)} → ${ok ? '正常 ✓' : '被压扁了 ✗'}` +
          `（动画 ${node.animName ?? '?'}，帧 ${node.frameInfo ? node.frameInfo.fw + 'x' + node.frameInfo.fh : '?'}）`);
    }
    log('  敌方精灵 顶部越界（精灵顶 < 行顶-1）= ' + (eSprite && eRow ? eSprite.y < eRow.y - 1 : '?'));
    log('  我方精灵 顶部越界（精灵顶 < 行顶-1）= ' + (pSprite && pRow ? pSprite.y < pRow.y - 1 : '?'));
    log('  敌方精灵 底部越界 = ' + (eSprite && eRow ? eSprite.y + eSprite.h > eRow.y + eRow.h + 1 : '?'));
    log('  我方精灵 底部越界 = ' + (pSprite && pRow ? pSprite.y + pSprite.h > pRow.y + pRow.h + 1 : '?'));
    log('  顶栏 rect = ' + JSON.stringify(hudR) + ' 场地 rect = ' + JSON.stringify(fieldR));
    log('  敌方行 rect = ' + JSON.stringify(eRow) + ' 我方行 rect = ' + JSON.stringify(pRow));
    log('  出牌区样式 = ' + JSON.stringify({
      enemy: { pos: getComputedStyle(document.querySelector('.enemy-play')).position, top: document.querySelector('.enemy-play').style.top, left: document.querySelector('.enemy-play').style.left, w: document.querySelector('.enemy-play').style.getPropertyValue('--card-w') },
      player: { pos: getComputedStyle(document.querySelector('.player-play')).position, top: document.querySelector('.player-play').style.top, right: document.querySelector('.player-play').style.right, w: document.querySelector('.player-play').style.getPropertyValue('--card-w') },
    }));
    log('  与出牌区父容器 = ' + JSON.stringify(eRow) + ' / ' + JSON.stringify(pRow));
    log('  我方出牌卡面/角色卡 rect = ' + JSON.stringify(pp) + ' / ' + JSON.stringify(rect('.fighter-player .fighter-card')) +
        '（行 x' + pRow.x + '~' + (pRow.x + pRow.w) + '）');
    log('  敌方出牌卡面/角色卡 rect = ' + JSON.stringify(pc) + ' / ' + JSON.stringify(rect('.fighter-enemy .fighter-card')) +
        '（行 x' + eRow.x + '~' + (eRow.x + eRow.w) + '）');
    log('  视口 = ' + window.innerWidth + 'x' + window.innerHeight);
    log('  敌方角色卡 rect = ' + JSON.stringify(rect('.fighter-enemy .fighter-card')));
    log('  敌方精灵 rect = ' + JSON.stringify(rect('.fighter-enemy .fighter-body canvas')));
    log('  玩家精灵 rect = ' + JSON.stringify(rect('.fighter-player .fighter-body canvas')));
    log('  日志 rect = ' + JSON.stringify(rect('.battle-log')));
    log('VIEW_READY');
  } catch (e) {
    log('FATAL ' + e.message);
    log('VIEW_READY');
  }
})();
