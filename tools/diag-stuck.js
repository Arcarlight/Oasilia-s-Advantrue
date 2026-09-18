// 「随机打不出卡」诊断（?dgstuck=1）
//
// 玩家反馈：偶尔会「打不出卡」——手牌全灰、点上去一点反应都没有，而且非常随机。
// 这种问题没法靠复现去找（可能几百场才遇上一次），所以改成**主动制造**每一种可能的卡死：
//   ① 演出链断了（某个 await 永远不 resolve）→ 看门狗必须在 6 秒内强制恢复
//   ② 收尾时抛异常（resyncDisp / refreshAll 挂掉）→ 手牌不能停在「整批禁用」
//   ③ 出牌次数用完 → 点卡片必须弹一句「次数用完了」，而不是默默吞掉点击
//   ④ AP 不够 → 点卡片必须弹一句「AP 不够：要 N 点，你有 M 点」
//   ⑤ 对手行动中 → 点卡片必须弹「对手正在行动」
// 每条都断言「能不能自己爬出来」+「有没有给玩家一句话」。
(async () => {
  const log = (...a) => console.log('[d2] [stuck]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const qa = (s, root = document) => [...root.querySelectorAll(s)];
  const q = (s, root = document) => root.querySelector(s);
  const fails = [];
  const check = (name, ok, extra = '') => {
    log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    if (!ok) fails.push(name);
  };
  const toastText = () => q('#toast')?.textContent ?? '';
  const toastShown = () => !q('#toast')?.classList.contains('hidden');
  const clickCard = (i = 0) => qa('.hand .card')[i]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    game.newRun(20260607);
    game.startBattle('normal', 0);
    ui.current = null;
    ui.forceRerender();
    await wait(900);
    const bs = ui.battleScreen;
    if (!bs) { log('没有 battleScreen'); log('STUCK_DONE'); return; }
    const b = bs.battle;

    // ---------- ③ 出牌次数用完：点卡片要给一句话 ----------
    b.player.playsLeft = 0;
    bs.renderHand();
    await wait(60);
    const before3 = toastText();
    clickCard(0);
    await wait(120);
    check('出牌次数用完时点卡片会说明原因（不再默默吞掉点击）',
      toastShown() && /出牌次数用完/.test(toastText()) && toastText() !== before3,
      `提示＝「${toastText()}」`);

    // ---------- ④ AP 不够 ----------
    b.player.playsLeft = b.player.playMax;
    // 找一张要花 AP 的牌，把 AP 清空
    const costed = b.hand('player').find((c) => b.cardCost(c) > 0);
    if (costed) {
      b.player.ap = 0;
      bs.renderHand();
      await wait(60);
      const idx = qa('.hand .card').findIndex((n) => n.querySelector('.card-name')?.textContent === costed.card.name);
      clickCard(idx >= 0 ? idx : 0);
      await wait(120);
      check('AP 不够时点卡片会说明原因', /AP 不够/.test(toastText()), `提示＝「${toastText()}」`);
      b.player.ap = b.player.apMax;
    } else {
      check('AP 不够时点卡片会说明原因', false, '手里没有要花 AP 的牌，跳过');
    }

    // ---------- ⑤ 对手行动中 ----------
    b.active = 'enemy';
    bs.renderHand();
    await wait(60);
    clickCard(0);
    await wait(120);
    check('对手行动中（手牌禁用）点卡片会说明原因', /对手正在行动/.test(toastText()), `提示＝「${toastText()}」`);
    b.active = 'player';

    // ---------- ① 演出链断了：看门狗必须自己爬出来 ----------
    b.player.playsLeft = b.player.playMax;
    b.player.ap = b.player.apMax;
    bs.renderHand();
    await wait(60);
    const disabledBefore = qa('.hand .card.disabled').length;
    bs.busy = true;                                  // 模拟「演出永远不结束」
    bs._eventAt = Date.now() - 20000;                // 而且 20 秒没有任何事件推进
    bs.renderHand();                                 // 手牌这时会整批变灰（就是玩家看到的样子）
    const disabledDuring = qa('.hand .card.disabled').length;
    const stuckBefore = window.__oasisStuckCount ?? 0;
    log(`制造卡死：busy=true 且 20 秒没事件；手牌被禁用 ${disabledDuring} 张（正常时应为 ${disabledBefore} 张）`);
    await wait(2000);                                // 看门狗每 500ms 看一次
    const recovered = !bs.busy;
    const playable = b.hand('player').filter((c) => b.canPlay(c.uid)).length;
    check('演出卡死时看门狗会强制恢复（busy 放掉、手牌重新可点）',
      recovered && playable > 0, `busy=${bs.busy}，可出的牌 ${playable} 张，恢复次数 ${(window.__oasisStuckCount ?? 0) - stuckBefore}`);
    check('恢复时给玩家一句话（不是静悄悄地变回来）', /自动恢复/.test(toastText()), `提示＝「${toastText()}」`);

    // ---------- ② 收尾时抛异常：手牌不能停在整批禁用 ----------
    const origResync = bs.resyncDisp.bind(bs);
    bs.resyncDisp = () => { throw new Error('故意炸的：模拟收尾异常'); };
    await bs.playCard(b.hand('player').find((c) => b.canPlay(c.uid))?.uid ?? '');
    await wait(300);
    bs.resyncDisp = origResync;
    const afterErr = b.hand('player').filter((c) => b.canPlay(c.uid)).length;
    check('收尾抛异常后手牌也会被重新渲染（不会停在整批灰）',
      !bs.busy && (afterErr > 0 || qa('.hand .card.disabled').length === 0),
      `busy=${bs.busy}，可出 ${afterErr} 张，被禁用 ${qa('.hand .card.disabled').length} 张`);

    log(`战斗仍然可玩：第 ${b.turn} 回合，active=${b.active}，手牌 ${b.hand('player').length} 张可出 ${b.hand('player').filter((c) => b.canPlay(c.uid)).length} 张`);
    log(fails.length ? `ERRORS=[${fails.join(' / ')}]` : 'ERRORS=[]');
    log('STUCK_DONE');
  } catch (err) {
    log('崩了：', err?.message ?? err, String(err?.stack ?? '').split('\n')[1] ?? '');
    log('STUCK_DONE');
  }
})();
