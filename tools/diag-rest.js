// 诊断：绿洲营地「只能做一件事」到底有没有被强制。
// 由 tools/diag2.mjs 通过 ?dgrest=1 加载。
(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const opts = () => [...document.querySelectorAll('.scene-screen .option')].map((b) => ({
    text: b.querySelector('span')?.textContent ?? '',
    disabled: b.disabled || b.classList.contains('disabled'),
    sub: b.querySelector('small')?.textContent ?? '',
  }));
  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    game.newRun(90210);
    await wait(300);
    // 直接进营地，跳过地图
    game.data.nodeId = 'diag-rest-1';
    game.startRest();
    await wait(400);
    log('进入营地：' + document.querySelector('.scene-text')?.textContent);
    log('  选项: ' + JSON.stringify(opts(), null, 0));

    // 1) 先休息
    const healed = game.restHeal();
    await wait(300);
    log('休息结果：回复 ' + healed + ' HP');
    log('  文案: ' + document.querySelector('.scene-text')?.textContent);
    log('  选项: ' + JSON.stringify(opts(), null, 0));
    const allDisabled = opts().every((o) => o.disabled || /直接出发/.test(o.text));
    log('  休息后「休息/冥想」是否都不可点 = ' + allDisabled);

    // 2) 再试冥想，必须被拒
    const deckBefore = game.data.deck.slice();
    const up = game.restUpgrade(deckBefore[0]);
    await wait(200);
    log('休息后再调 restUpgrade() 返回 = ' + JSON.stringify(up) + '（应为 null）');
    log('  卡组有没有被改 = ' + (JSON.stringify(deckBefore) !== JSON.stringify(game.data.deck) ? '被改了 ✗' : '没变 ✓'));

    // 3) 刷新页面后回到同一个营地（模拟 re-enter）：机会不能又变回来
    game.startRest();
    await wait(300);
    log('重新进入同一节点后: ' + JSON.stringify(opts(), null, 0));
    log('  rest.done = ' + game.rest.done + '（应为 true）');

    // 4) 出发
    game.leaveRest();
    await wait(300);
    log('出发后 phase = ' + game.phase + '（应为 map）');

    // 5) 另一个营地：先冥想，之后休息也必须被拒
    game.data.nodeId = 'diag-rest-2';
    game.startRest();
    await wait(400);
    const target = game.data.deck.find((id) => !game.data.deck.slice(0, game.data.deck.indexOf(id)).includes(id));
    const r2 = game.restUpgrade(target);
    await wait(300);
    log('第二个营地冥想 = ' + JSON.stringify(r2));
    log('  选项: ' + JSON.stringify(opts(), null, 0));
    const healAfter = game.restHeal();
    log('  冥想后再调 restHeal() 返回 = ' + JSON.stringify(healAfter) + '（应为 null）');
    log('  HP 有没有变 = ' + (healAfter == null ? '没变 ✓' : '被加血了 ✗'));
    log('REST_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('REST_DONE');
  }
})();
