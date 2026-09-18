// 诊断：牌堆 / 卡组页的「重复牌」核查（?dgdeck=1）
//
// 起因：玩家报告「只有一张羽栖，战斗中却抽出了两张」。
// 引擎层的守恒已经由 tools/test-deck-integrity.mjs 证过了（86 种卡 × 数千步无重复），
// 所以这里查**界面**这一侧还剩下的两种可能：
//   ① 手牌 DOM 里的卡比引擎手牌多（重画/入场动画把节点留下了）——
//      玩家就会「看到两张」；
//   ② 卡组页里同名卡只画一张，而 ×N 角标没显示出来 / 被卡面裁掉 ——
//      玩家会以为「我只有一张」，实际卡组里有两张。
//
// 用法：node tools/diag2.mjs "http://127.0.0.1:5123/?dgdeck=1" rt

(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;

    // ---------- ① 手牌 DOM 与引擎手牌必须一一对应 ----------
    const DECK = ['roost', 'tackle', 'tackle', 'harden', 'bite', 'bite', 'double_kick'];
    game.newRun(31337);
    game.data.deck = DECK.slice();
    await wait(300);
    const node = game.availableNodes().find((n) => n.type === 'battle') || game.availableNodes()[0];
    game.goToNode(node.id);

    const bs = ui.battleScreen;
    const bandDeadline = Date.now() + 30000;
    while (!document.querySelector('.turn-sweep') && Date.now() < bandDeadline) await wait(50);
    while (document.querySelector('.turn-sweep') && Date.now() < bandDeadline) await wait(50);
    while (ui.battleScreen?.busy && Date.now() < bandDeadline) await wait(100);
    await wait(300);

    const nameOfHandNode = (n) => n.querySelector('.card-name')?.textContent?.trim() ?? '';
    const probe = (where) => {
      const hand = bs.battle.hand('player');
      const nodes = [...document.querySelectorAll('.hand .card')];
      const domNames = nodes.map(nameOfHandNode);
      const engNames = hand.map((e) => e.card.name);
      const domRoost = domNames.filter((n) => n === '羽栖').length;
      const engRoost = engNames.filter((n) => n === '羽栖').length;
      return { where, domCount: nodes.length, engCount: hand.length, domRoost, engRoost, domNames, engNames };
    };

    let mismatch = null;
    let roostPeakDom = 0;
    let roostPeakEng = 0;
    let steps = 0;

    const sweep = async () => {
      for (let turn = 0; turn < 8 && !bs.battle.over; turn++) {
        for (let g = 0; g < 12; g++) {
          const p = probe(`第${turn + 1}回合-出牌前`);
          if (!mismatch && (p.domCount !== p.engCount || p.domRoost !== p.engRoost)) mismatch = p;
          roostPeakDom = Math.max(roostPeakDom, p.domRoost);
          roostPeakEng = Math.max(roostPeakEng, p.engRoost);
          const playable = bs.battle.hand('player').filter((c) => bs.battle.canPlay(c.uid));
          if (!playable.length) break;
          await bs.playCard(playable[0].uid);
          steps += 1;
          const q = probe(`第${turn + 1}回合-出牌后`);
          if (!mismatch && (q.domCount !== q.engCount || q.domRoost !== q.engRoost)) mismatch = q;
          roostPeakDom = Math.max(roostPeakDom, q.domRoost);
          roostPeakEng = Math.max(roostPeakEng, q.engRoost);
        }
        if (bs.battle.over) break;
        await bs.onEndTurn();
        const t = Date.now() + 20000;
        while (bs.busy && Date.now() < t) await wait(80);
        const w = probe(`第${turn + 1}回合-结束后`);
        if (!mismatch && (w.domCount !== w.engCount || w.domRoost !== w.engRoost)) mismatch = w;
        roostPeakDom = Math.max(roostPeakDom, w.domRoost);
        roostPeakEng = Math.max(roostPeakEng, w.engRoost);
        if (bs.battle.over) break;
      }
    };
    await sweep();

    log(`手牌检查：走了 ${steps} 步；「羽栖」在 DOM 里最多 ${roostPeakDom} 张 / 引擎里最多 ${roostPeakEng} 张`);
    if (mismatch) log(`  不符的那一步：${JSON.stringify(mismatch)}`);
    ok(!mismatch, '手牌 DOM 的张数与名字和引擎手牌完全一致（没有多画一张）',
      mismatch ? `${mismatch.where}: DOM ${mismatch.domCount} 张 [${mismatch.domNames}] vs 引擎 ${mismatch.engCount} 张 [${mismatch.engNames}]` : `${steps} 步全对`);
    ok(roostPeakDom <= 1 && roostPeakEng <= 1, '卡组里只有 1 张「羽栖」时，手牌里最多同时 1 张',
      `DOM ${roostPeakDom} / 引擎 ${roostPeakEng}`);

    // ---------- ② 卡组页：同名卡要有 ×N 角标，而且必须真的看得见 ----------
    const { showDeck } = await import('../src/ui/overlays.js');
    document.querySelector('.modal-backdrop')?.remove();
    game.data.deck = ['roost', 'roost', 'tackle', 'harden'];
    game.phase = 'map';
    showDeck(game);
    await wait(300);

    const grid = document.querySelector('.modal.panel .card-grid');
    ok(!!grid, '卡组页的卡牌网格打开了');
    const cards = [...(grid?.querySelectorAll('.card') ?? [])];
    const names = cards.map((c) => c.querySelector('.card-name')?.textContent?.trim() ?? '');
    const roostCards = cards.filter((c) => c.querySelector('.card-name')?.textContent?.trim() === '羽栖');
    // 角标是 cardEl 塞进 `.card-foot` 的普通 <span>（没有专门的 class），
    // 所以按「卡脚里除类型标签外的那些 span」来找。
    // 第一版按 .card-badge 找，当然一个也找不到 —— 差点把「其实画了」误报成 bug。
    const footOf = (c) => [...c.querySelectorAll('.card-foot > span')].map((s) => s.textContent.trim());
    const badgesOf = (c) => footOf(c).slice(1);
    const badgeTexts = roostCards.flatMap(badgesOf);
    log(`卡组页卡片 = [${names.join(', ')}]；羽栖的卡脚 = [${roostCards[0] ? footOf(roostCards[0]).join(' | ') : '—'}]`);
    ok(roostCards.length === 1, '同名卡在网格里只画一张（靠 ×N 表示份数）', `羽栖 出现 ${roostCards.length} 次`);
    ok(badgeTexts.some((t) => /×\s*2/.test(t)), '2 张「羽栖」会显示 ×2 角标', badgeTexts.join(' | ') || '（一个角标都没有）');

    // 角标必须真的画在卡面里、有面积（被裁掉 / 0 尺寸 = 玩家看不见）
    const badge = roostCards[0]
      ? [...roostCards[0].querySelectorAll('.card-foot > span')].find((s) => /×\s*2/.test(s.textContent))
      : null;
    if (badge && roostCards[0]) {
      const br = badge.getBoundingClientRect();
      const cr = roostCards[0].getBoundingClientRect();
      const inside = br.width > 4 && br.height > 4
        && br.left >= cr.left - 1 && br.right <= cr.right + 1
        && br.top >= cr.top - 1 && br.bottom <= cr.bottom + 1;
      log(`  ×2 角标 rect=${JSON.stringify({ x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) })}，卡面 rect=${JSON.stringify({ x: Math.round(cr.x), y: Math.round(cr.y), w: Math.round(cr.width), h: Math.round(cr.height) })}`);
      ok(inside, '×2 角标有面积、而且完全落在卡面之内（不会被卡面裁掉）');
    } else {
      ok(false, '×2 角标有面积、而且完全落在卡面之内（不会被卡面裁掉）', '没找到角标元素');
    }

    // 只有 1 张时**不该**有角标（免得玩家以为份数算错）
    document.querySelector('.modal-backdrop')?.remove();
    game.data.deck = ['roost', 'tackle', 'harden'];
    showDeck(game);
    await wait(250);
    const g2 = document.querySelector('.modal.panel .card-grid');
    const b2 = [...(g2?.querySelectorAll('.card') ?? [])].flatMap((c) => [...c.querySelectorAll('.card-foot > span')].slice(1).map((s) => s.textContent.trim()));
    ok(!b2.some((t) => /×\s*1\b/.test(t)), '只有 1 张时不会画 ×1 角标', b2.join(' | ') || '（没有角标，正确）');
    document.querySelector('.modal-backdrop')?.remove();

    if (fails.length) log(`DGDECK_ERRORS=[${fails.join(' | ')}]`);
    else log('牌堆 / 卡组页重复牌核查：通过 ✓');
    log('DGDECK_DONE');
  } catch (e) {
    log('DGDECK_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' | ') : e));
    log('DGDECK_DONE');
  }
})();
