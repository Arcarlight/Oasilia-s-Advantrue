// 截图辅助：让敌方真的打出一张牌，并把整个演出放慢到可以截图的程度。
// ?dgplay=1             —— 逼敌方打出一张伤害牌并放慢演出
// ?dgplay=1&pin=1       —— 另外把一张卡面钉在敌方出牌区（量排版用）
// 由 tools/shot.mjs 加载。
(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const params = new URLSearchParams(location.search);
  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    game.newRun(90210);
    game.data.deck = ['bite', 'bite', 'bite', 'bite', 'harden', 'bite', 'bite', 'bite', 'bite', 'bite'];
    game.data.battleDeck = null;
    await wait(400);
    const node = game.availableNodes().find((n) => n.type === 'battle') || game.availableNodes()[0];
    game.goToNode(node.id);
    await wait(2500);

    const b = game.battle;
    const bs = ui.battleScreen;

    if (params.get('pin') === '1') {
      const src = document.querySelector('.hand .card');
      if (src && bs?.enemyPlay) {
        const clone = src.cloneNode(true);
        clone.classList.add('card-sm');
        clone.style.pointerEvents = 'none';
        const wrap = document.createElement('div');
        wrap.className = 'played-card played-enemy in';
        wrap.append(clone);
        bs.enemyPlay.append(wrap);
        log('PINNED ' + (src.querySelector('.card-name')?.textContent ?? '?'));
      }
    }

    if (params.get('settings') === '1') {
      // 打开设置弹窗，检查「战斗演出速度」选项有没有出来
      const { showSettings } = await import('../src/ui/overlays.js');
      showSettings();
      log('SETTINGS_OPENED 选项=' + document.querySelectorAll('.modal select option').length);
      return;
    }

    // 放慢演出，让截图能落在那张牌摊开的窗口里
    bs.speedMul = Number(params.get('mul') ?? 6);

    // 逼敌方手里有一张伤害牌，并且 AP 足够。
    // `&card=<id>` 指定打哪一张 —— 看「接触 vs 远隔」两套演出（撞上去 / 打过去）时要用它：
    // 默认随手挑一张伤害牌，「咬住」多半是接触类的，看不到飞行的那道光。
    const want = params.get('card');
    const pool = b.decks.enemy.hand.length ? b.decks.enemy.hand : b.decks.enemy.draw;
    let proto = (want ? pool.find((c) => c.card.id === want) : null)
      || pool.find((c) => c.card.effects.some((e) => e.kind === 'damage'));
    /**
     * `&card=<id>` 指的牌不在敌方牌组里时**现造一张**给对面打 ——
     * 截图要看的是「这一套特效长什么样」，不该受这一场敌人带了什么牌的摆布
     * （沙漠的怪多半不会放电，但「电系打过来会劈一道闪电」这件事得能拍出来）。
     */
    if (want && !proto) {
      const { CARD_BY_ID } = await import('../src/data/cards.js');
      if (CARD_BY_ID[want]) proto = { card: CARD_BY_ID[want], uid: 'v9' };
    }
    if (!proto) proto = pool[0];
    if (proto) b.decks.enemy.hand = [{ ...proto, uid: 'v1' }, { ...proto, uid: 'v2' }];
    b.enemy.apMax = 9; b.enemy.ap = 9; b.enemy.playMax = 9; b.enemy.playsLeft = 9;
    log('敌方将打出: ' + (proto ? proto.card.name : '?') + '，speedMul=' + bs.speedMul);

    // 插桩：看 syncHud / refreshAll 有没有真的跑到
    let syncCount = 0;
    const origSync = bs.syncHud.bind(bs);
    bs.syncHud = function () { syncCount += 1; return origSync(); };
    const origRefreshAll = bs.refreshAll.bind(bs);
    bs.refreshAll = function () {
      try { return origRefreshAll(); } catch (e) { log('REFRESH_ALL_THREW ' + e.message + ' | ' + e.stack); throw e; }
    };
    window.addEventListener('unhandledrejection', (e) => log('UNHANDLED ' + (e.reason?.message ?? e.reason)));

    // 记录事件演出进度，看它到底卡在哪一条
    const trace = [];
    const origPlayEvent = bs.playEvent.bind(bs);
    bs.playEvent = function (ev) {
      trace.push(ev.type + (ev.side ? ':' + ev.side : ''));
      return origPlayEvent(ev).then(
        () => trace.push('ok:' + ev.type),
        (e) => trace.push('ERR:' + ev.type + ' ' + e.message),
      );
    };
    const origPlayEvents = bs.playEvents.bind(bs);
    bs.playEvents = function (list) {
      const p = origPlayEvents(list);
      if (p && p.then) p.then(() => trace.push('PLAYEVENTS_DONE'), (e) => trace.push('PLAYEVENTS_ERR ' + e.message));
      return p;
    };

    bs.onEndTurn();
    log('TURN_STARTED speedMul=' + bs.speedMul + ' (' + typeof bs.speedMul + ')');
    // 自己测一下 wait 会不会卡住
    const tw = performance.now();
    bs.wait(300).then(() => log('WAIT_OK ' + Math.round(performance.now() - tw) + 'ms'));

    // 演出跑完后核对「引擎数值」和「界面显示」是否一致
    setTimeout(() => {
      const domP = document.querySelector('.fighter-player .bar-hp b')?.textContent ?? '?';
      const domE = document.querySelector('.fighter-enemy .bar-hp b')?.textContent ?? '?';
      const hud = document.getElementById('hud-hp-text')?.textContent ?? '?';
      const hudNode = document.getElementById('hud-hp-text');
      const logs = [...document.querySelectorAll('.battle-log p')].map((p) => p.textContent);
      log('结算核对: 引擎 p=' + b.player.hp + '/' + b.player.maxHp + ' e=' + b.enemy.hp +
          ' | 战斗卡 玩家"' + domP + '" 敌人"' + domE + '" | HUD "' + hud + '"');
      log('  syncHud 被调用 ' + syncCount + ' 次；HUD 节点在文档里? ' + document.body.contains(hudNode) +
          '；game.data.hp=' + game.data.hp + '；phase=' + game.phase + '；dispHp=' + JSON.stringify(bs.dispHp));
      log('  事件轨迹(' + trace.length + '): ' + JSON.stringify(trace));
      log('日志 ' + logs.length + ' 行: ' + JSON.stringify(logs));
    }, 9000);

    // 再等久一点，确认敌方回合演完之后 HUD 和角色卡完全对齐
    setTimeout(() => {
      const domP = document.querySelector('.fighter-player .bar-hp b')?.textContent ?? '?';
      const hud = document.getElementById('hud-hp-text')?.textContent ?? '?';
      log('最终核对(20s): 引擎 p=' + b.player.hp + ' | 战斗卡 "' + domP + '" | HUD "' + hud +
          '" | 一致性=' + (String(b.player.hp) === hud.split('/')[0].trim()));
    }, 20000);
  } catch (e) {
    log('FATAL ' + e.message);
  }
})();
