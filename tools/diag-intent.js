// 诊断：中间那个「意图胶囊」现在到底算了什么、会不会随局面变化。
// 由 tools/diag2.mjs 通过 ?dgintent=1 加载。
(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const chip = () => {
    const n = document.querySelector('.battle-middle .intent');
    return n ? `[${n.className}] ${n.textContent}` : '(没有意图胶囊)';
  };
  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    game.newRun(90210);
    game.data.deck = ['bite', 'harden', 'bite', 'harden', 'bite', 'bite', 'harden', 'bite', 'bite', 'bite'];
    game.data.battleDeck = null;
    await wait(400);
    const node = game.availableNodes().find((n) => n.type === 'battle') || game.availableNodes()[0];
    game.goToNode(node.id);
    await wait(2400);

    const b = game.battle;
    const bs = ui.battleScreen;

    log('开战：' + chip());
    let t = b.predictEnemyThreat();
    log('  predictEnemyThreat = ' + JSON.stringify(t) + '（玩家血量 ' + b.player.hp + '）');

    // 1) 玩家防御翻倍，威胁应该下降
    b.player.defMod += 20;
    b.recalcDerived();
    bs.refreshAll();
    const t2 = b.predictEnemyThreat();
    log('玩家防御 +20 后：' + chip());
    log('  predictEnemyThreat = ' + JSON.stringify(t2) + ' → 比之前' + (t2.damage < t.damage ? '下降 ✓' : '没有下降 ✗'));

    // 2) 玩家血量很低时，应该出现「危险」样式
    b.player.hp = 12;
    bs.resyncDisp();
    bs.refreshAll();
    log('玩家只剩 12 血：' + chip());

    // 3) 敌方回合里应该显示「对手正在行动……」，并核对预估值是不是真的上界
    b.player.hp = b.player.maxHp;
    bs.resyncDisp();
    bs.refreshAll();
    const predict = b.predictEnemyThreat();
    const hpBefore = b.player.maxHp;
    const turn = bs.onEndTurn();
    for (let i = 0; i < 60; i++) {
      if (/对手正在行动/.test(chip())) break;
      await wait(60);
    }
    log('敌方回合中：' + chip());
    if (turn && turn.then) await turn;
    await wait(600);
    const actual = hpBefore - b.player.hp;
    log('敌方回合结束后：' + chip());
    log('  预估上界 ' + predict.damage + ' vs 实际受到 ' + actual + ' → ' +
        (predict.damage >= actual ? '上界成立 ✓' : '估低了 ✗'));

    // 4) 连续几回合看文案有没有真的跟着局面变
    const seen = new Set();
    for (let round = 0; round < 3 && !b.over; round++) {
      await wait(200);
      seen.add(chip());
      const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
      if (hand.length) await bs.playCard(hand[0].uid);
      await wait(200);
      if (!b.over) await bs.onEndTurn();
      await wait(400);
    }
    await wait(500);
    seen.add(chip());
    log('几回合里出现过的胶囊文案 ' + seen.size + ' 种: ' + JSON.stringify([...seen]));
    log('INTENT_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('INTENT_DONE');
  }
})();
