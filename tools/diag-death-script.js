// 复现「玩家被打死」的情况：逐事件记录 HP、血条 DOM、事件数量、日志重复。
// 由 tools/diagnose-page.mjs 配合 ?dgdeath=1 加载。
(async () => {
  const log = (...a) => console.log('[dd]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const errors = [];
  window.addEventListener('error', (e) => errors.push('window: ' + e.message));
  window.addEventListener('unhandledrejection', (e) => errors.push('reject: ' + (e.reason && e.reason.message)));

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    // 故意把玩家弄弱，让它必死
    game.newRun(31337);
    game.data.maxHp = 60;
    game.data.hp = 60;
    game.data.def = 0;
    await wait(400);

    const node = game.availableNodes().find((n) => n.type === 'battle') || game.availableNodes()[0];
    game.goToNode(node.id);
    await wait(1500);

    const b = game.battle;
    const bs = ui.battleScreen;
    log('开战: p=' + b.player.hp + '/' + b.player.maxHp + ' e=' + b.enemy.hp + '/' + b.enemy.maxHp);
    log('battleScreen=' + !!bs);

    const readAll = () => {
      const q = (sel) => document.querySelector(sel);
      return {
        hud: (document.getElementById('hud-hp-text') || {}).textContent,
        hudW: (document.getElementById('hud-hp-fill') || {}).style ? document.getElementById('hud-hp-fill').style.width : '?',
        pText: (q('.fighter-player .bar-hp b') || {}).textContent,
        pW: q('.fighter-player .bar-hp i') ? q('.fighter-player .bar-hp i').style.width : '?',
        eText: (q('.fighter-enemy .bar-hp b') || {}).textContent,
        logLines: document.querySelectorAll('.battle-log p').length,
        toast: (document.getElementById('toast') || {}).textContent,
      };
    };
    log('开局 DOM: ' + JSON.stringify(readAll()));

    // 让 AI 一直出牌直到战斗结束（玩家必死）
    let turns = 0;
    while (!b.over && turns < 12) {
      turns++;
      if (bs) {
        const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
        if (hand.length) { const pr = bs.playCard(hand[0].uid); if (pr && pr.then) await pr; }
        const st = readAll();
        log('  回合' + b.turn + ' 出牌后: 引擎p=' + b.player.hp + ' e=' + b.enemy.hp +
            ' | 战斗卡p="' + st.pText + '" HUD="' + st.hud + '" 日志行=' + st.logLines);
        if (!b.over) { const er = bs.onEndTurn(); if (er && er.then) await er; }
      } else {
        b.playCard(b.hand('player')[0]?.uid);
        b.endTurn();
        await wait(300);
      }
      const st2 = readAll();
      log('  回合' + b.turn + ' 末: 引擎p=' + b.player.hp + ' e=' + b.enemy.hp +
          ' over=' + b.over + ' winner=' + b.winner +
          ' | 战斗卡p="' + st2.pText + '" HUD="' + st2.hud + '" 日志行=' + st2.logLines + ' toast="' + st2.toast + '"');
    }

    // 统计「倒下了」重复次数
    const logTexts = [...document.querySelectorAll('.battle-log p')].map((p) => p.textContent);
    const dupes = logTexts.filter((t) => t.includes('倒下了')).length;
    log('日志总数=' + logTexts.length + '，其中「倒下了」出现 ' + dupes + ' 次');
    log('日志尾部: ' + JSON.stringify(logTexts.slice(-8)));

    // 再点几次「结束回合」按钮，看会不会重复触发结算
    for (let i = 0; i < 3; i++) {
      const btn = document.querySelector('.battle-bar .btn-primary');
      if (btn) btn.click();
      await wait(300);
    }
    const after = [...document.querySelectorAll('.battle-log p')].map((p) => p.textContent);
    log('连点结束回合后，「倒下了」出现 ' + after.filter((t) => t.includes('倒下了')).length + ' 次，phase=' + game.phase);

    // 检查战斗态时序：事件有没有重复消费
    log('battle.over=' + b.over + ' winner=' + b.winner + ' 剩余事件=' + b.events.length);
    log('ERRORS=' + JSON.stringify(errors));
    log('DD_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('DD_DONE');
  }
})();
