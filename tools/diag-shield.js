// 诊断：护盾胶囊（.fighter-shield）到底挂在哪儿。
// 由 tools/diag2.mjs 通过 ?dgshield=1 加载。
(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const info = (sel) => {
    const n = document.querySelector(sel);
    if (!n) return sel + ' → 不存在';
    const r = n.getBoundingClientRect();
    const cs = getComputedStyle(n);
    const op = n.offsetParent;
    return `${sel} → rect(${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)})` +
      ` position=${cs.position} top=${cs.top} right=${cs.right} left=${cs.left}` +
      ` offsetParent=${op ? (op.className || op.tagName) : 'null'}`;
  };
  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    game.newRun(90210);
    await wait(400);
    const node = game.availableNodes().find((n) => n.type === 'battle') || game.availableNodes()[0];
    game.goToNode(node.id);
    await wait(2400);

    const b = game.battle;
    const bs = ui.battleScreen;
    b.player.shield = 17;
    b.enemy.shield = 9;
    bs.resyncDisp();
    bs.refreshAll();
    await wait(200);

    log(info('.fighter-shield'));
    log('  所有 .fighter-shield 个数 = ' + document.querySelectorAll('.fighter-shield').length);
    const all = [...document.querySelectorAll('.fighter-shield')];
    all.forEach((n, i) => {
      const r = n.getBoundingClientRect();
      const op = n.offsetParent;
      log(`  #${i} class="${n.className}" 文本="${n.textContent}" rect(${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)}) offsetParent=${op ? (op.className || op.tagName) : 'null'}`);
    });
    log('  ' + info('.fighter-player'));
    log('  ' + info('.fighter-player .fighter-card'));
    log('  ' + info('.fighter-enemy .fighter-card'));
    log('  ' + info('.screen'));
    log('  .fighter-player .fighter-card 的 position = ' + getComputedStyle(document.querySelector('.fighter-player .fighter-card')).position);
    log('  <html> 里 .fighter 规则的 position = ' + getComputedStyle(document.querySelector('.fighter-player')).position);
    log('SHIELD_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('SHIELD_DONE');
  }
})();
