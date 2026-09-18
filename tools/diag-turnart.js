// 诊断：回合切换立绘（?dgturnart=1）与「敏捷预算」胶囊。
//
// 立绘放在**回合光带上**（「第 N 回合 / 你的行动」那条横扫屏幕的横条），
// 我方在回合数左边、敌方在右边。要证的事：
//   ① 立绘确实是我方背面 / 敌方正面，图真的加载出来了（不是破图），而且**就在光带里**；
//   ② 落点正确：我方在回合数左边、敌方在右边，且都在视口内（没被挤出屏幕）；
//   ③ 「由大变小」真的发生了 —— 起始那一帧明显大于落定帧，且起始帧盖住回合数、落定帧让开；
//   ④ 立绘**不会把回合数字幕顶偏**（两侧立绘位等宽，有图没图字幕都在正中）；
//   ⑤ 战斗演出速度设成「快」时，光带时长与立绘动画都跟着缩短；
//   ⑥ **光带不挡操作**：真实回合里，光带还挂在屏幕上时 `busy` 已经是 false（玩家能出牌了）。
//
// 另外顺带核对敏捷预算胶囊：数值必须等于 balance.js 里那三个公式算出来的。
//
// 用法：node tools/diag2.mjs "http://127.0.0.1:5123/?dgturnart=1" rt

(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };
  const r = (sel) => {
    const n = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!n) return null;
    const b = n.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right), bottom: Math.round(b.bottom) };
  };
  const same = (a, b) => a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

  /**
   * 等图片真的解码出来。
   *
   * 为什么不能直接读 naturalWidth：`turnArt()` 是同步把 <img> 挂上去的，
   * 刚挂上那一刻浏览器还没去取图，naturalWidth 就是 0。
   * 本地开发服务器上图是热的所以碰巧过，**线上第一次跑就误报了一次**。
   * 尺寸/位置那几条不受影响：宽高是 JS 写死在 style 上的，不用等图。
   */
  const imgReady = async (img, ms = 4000) => {
    if (!img) return false;
    const t0 = performance.now();
    for (;;) {
      if (img.naturalWidth > 0) return true;
      if (performance.now() - t0 > ms) return false;
      await wait(40);
    }
  };

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const bal = await import('../src/data/balance.js');
    const artP = await import('../src/core/gen9.js');

    game.newRun(20240909);
    await wait(300);
    const node = game.availableNodes().find((n) => n.type === 'battle') || game.availableNodes()[0];
    game.goToNode(node.id);

    /**
     * 先等**游戏自己**的开场过场演完，再开始量。
     *
     * 两个坑叠在一起：
     *  1. `mount()` 是异步的（先加载精灵图、再 sleep、再 playEvents），而开场演出期间
     *     `busy` 一直是 false —— 只看 busy 会以为已经空闲，其实开场过场还没开始播；
     *  2. 开场过场一播就会 `clearTurnIntro()` 把我刚挂的光带顶掉，
     *     于是「我方的立绘位永远是空的、band.isConnected=false」，而外面看起来
     *     像「立绘没画出来」。本地快所以碰巧抢在它前面，线上必翻。
     *
     * 所以这里改成盯 DOM：等光带**出现过**、再等它**消失**，才算开场结束。
     */
    const bandDeadline = Date.now() + 30000;
    while (!document.querySelector('.turn-sweep') && Date.now() < bandDeadline) await wait(50);
    while (document.querySelector('.turn-sweep') && Date.now() < bandDeadline) await wait(50);
    while (ui.battleScreen?.busy && Date.now() < bandDeadline) await wait(100);
    await wait(300);

    const bs = ui.battleScreen;
    if (!bs) throw new Error('没有战斗界面（battleScreen 为空）');
    bs.clearTurnIntro();
    // 后面所有测量都在标准速度下做（倍率会影响定时，固定住才可复现）
    bs.speedMul = 1;

    // 包一层：turnArt 是 async 的，抛异常会变成「静默没有图」，
    // 这里直接把它打出来（诊断里真的被这个坑过：一侧有图另一侧没有，却没有任何报错）
    const origTurnArt = bs.turnArt.bind(bs);
    bs.turnArt = async (side, turn) => {
      try {
        return await origTurnArt(side, turn);
      } catch (e) {
        log(`  · turnArt(${side}, ${turn}) 抛异常：${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
        throw e;
      }
    };

    const q = new URLSearchParams(location.search);
    const mode = q.get('dgturnart');

    /**
     * 让光带停在屏幕正中、把立绘定格，供 shot.mjs 截图。
     *
     * 三个都必须做，缺一个就截不到东西：
     *  ① 掐掉光带自己的收场定时器 —— 它 2.6 秒后自己 remove，而截图是在虚拟时间
     *     预算跑完之后才拍的，不掐掉的话拍到的是一块空屏；
     *  ② 关掉光带自己的扫过动画 —— shot.mjs 默认带 --force-prefers-reduced-motion，
     *     CSS 会把 `--sweep-ms` 压成 .01s，光带瞬间扫完消失（和「起始帧定格失效」同一类坑）；
     *  ③ 立绘**自己摆**，不再走 turnArt —— 它演完会 `slot.replaceChildren()` 把图收走。
     */
    const freeze = async (side, m) => {
      bs.turnIntro(side, 99);
      const band = document.querySelector('.turn-sweep');
      if (!band) return log('定格失败：光带没挂上');
      for (const t of bs._sweep?.timers ?? []) clearTimeout(t);
      bs._sweep = null;
      band.style.animation = 'none';
      band.style.transform = 'skewX(-12deg)';
      band.style.opacity = '1';
      for (const t of band.querySelectorAll('.turn-sweep-text, .turn-sweep-sub')) t.style.animation = 'none';

      const slug = side === 'enemy' ? bs.battle.enemy.slug : game.data.slug;
      const art = artP.turnArt(slug, side === 'enemy' ? 'front' : 'back');
      if (!art) return log(`定格失败：${slug} 没有可用立绘`);
      const slot = band.querySelector(`.turn-art-${side}`);
      const slotH = parseFloat(getComputedStyle(slot).height) || 121;
      const { w, h } = artP.fitArt(art, slotH);
      const img = document.createElement('img');
      img.className = 'turn-art-img';
      img.src = art.url;
      img.style.width = `${w}px`;
      img.style.height = `${h}px`;
      img.style.animation = 'none';
      img.style.marginTop = `${-h / 2}px`;
      if (m === 'big') img.style.transform = `scale(${artP.ART_FROM_SCALE})`;
      const glow = document.createElement('div');
      glow.className = 'turn-art-glow';
      glow.style.width = `${w}px`;
      glow.style.height = `${Math.round(h * 0.6)}px`;
      glow.style.animation = 'none';
      glow.style.opacity = '.55';
      slot.append(glow, img);
      log(`定格：side=${side} mode=${m} 尺寸=${w}×${h} 实际 rect=${JSON.stringify(r(img))}`);
      log('TURNART_DONE');
    };
    if (mode === 'big' || mode === 'docked') {
      await freeze(q.get('artside') === 'enemy' ? 'enemy' : 'player', mode);
      return;
    }

    const field = r('.battle-field');
    log(`场地 rect=${JSON.stringify(field)}`);

    // ---- ① 素材来源 ----
    const eslug = bs.battle.enemy.slug;
    const pslug = game.data.slug;
    const ap = artP.turnArt(pslug, 'back');
    const ae = artP.turnArt(eslug, 'front');
    ok(!!ap, `我方立绘取到 ${pslug}/back`, ap ? `${ap.w}×${ap.h} 系数 ${ap.scale.toFixed(2)}` : '（没取到）');
    ok(!!ae, `敌方立绘取到 ${eslug}/front`, ae ? `${ae.w}×${ae.h} 系数 ${ae.scale.toFixed(2)}` : '（没取到）');

    // ---- ④ 基线：立绘出现之前的布局 ----
    const before = {
      player: r('.fighter-player .fighter-card'),
      enemy: r('.fighter-enemy .fighter-card'),
      badge: r('.turn-badge'),
    };

    /**
     * 演一遍某一侧的回合过场，量下起始帧与落定帧。
     * turnIntro 是「挂上就返回」的（它不挡操作），所以这里自己按时间轴取样。
     */
    const runSide = async (side) => {
      bs.clearTurnIntro();
      bs.turnIntro(side, 99);
      const band = document.querySelector('.turn-sweep');
      const sweepMs = parseFloat(band?.style.getPropertyValue('--sweep-ms')) || 2600;
      await wait(Math.round(sweepMs * 0.22) + 20);   // 光带停稳(16%)之后、立绘入场(22%)之后
      const slot = band.querySelector(`.turn-art-${side}`);
      const img = slot.querySelector('.turn-art-img');
      if (!img) log(`  · ${side} 侧立绘位是空的：childNodes=${slot.childNodes.length} _sweep=${!!bs._sweep} bandConnected=${band.isConnected}`);
      const big = r(img);
      const inMs = parseFloat(slot.style.getPropertyValue('--tart-in')) || 620;
      const loaded = await imgReady(img);
      await wait(inMs + 80);
      const docked = r(slot.querySelector('.turn-art-img'));
      return { band, slot, img, big, docked, sweepMs, inMs, loaded, sweepSide: side };
    };

    // ---- ③ 我方 ----
    const P = await runSide('player');
    const badge = r('.turn-badge');
    const sweepText = r('.turn-sweep-text');
    log(`光带 rect=${JSON.stringify(r('.turn-sweep'))}  字幕 rect=${JSON.stringify(sweepText)}`);
    log(`我方：起始帧=${JSON.stringify(P.big)}  落定帧=${JSON.stringify(P.docked)}`);
    ok(!!P.band, '回合过场是一根光带（.turn-sweep）', P.band ? `时长 ${P.sweepMs}ms` : '（没挂上）');
    ok(!!P.img && P.band.contains(P.img), '立绘就在**光带里面**（不是场地角落、也不是别的地方）');
    ok(P.loaded, '我方立绘图真的加载出来了', P.img ? `natural=${P.img.naturalWidth}×${P.img.naturalHeight}` : '（没有 img）');
    ok(P.img?.src.includes('/gen9/') || P.img?.src.startsWith('data:image/png;base64'), '图片地址来自 gen9 立绘目录（或内联 data URI）');
    ok(P.big && P.docked && P.big.h > P.docked.h * 1.8, '由大变小：起始帧高度远大于落定帧',
      P.big && P.docked ? `${P.big.h}px → ${P.docked.h}px（${(P.big.h / P.docked.h).toFixed(2)}×）` : '');
    ok(P.docked && sweepText && P.docked.right <= sweepText.x + 1, '我方立绘在回合数**左边**',
      P.docked && sweepText ? `立绘右边 ${P.docked.right} ≤ 字幕左边 ${sweepText.x}` : '');
    ok(P.docked && P.docked.x >= 0 && P.docked.right <= innerWidth, '落定帧完整在屏幕内（没被挤出视口）',
      P.docked ? `x ${P.docked.x} ~ ${P.docked.right} / 视口 ${innerWidth}` : '');
    ok(P.big && sweepText && P.big.x < sweepText.right && sweepText.x < P.big.right,
      '起始帧和回合数有重叠（是从字幕中央收拢过来的，不是从旁边长出来）',
      P.big && sweepText ? `起始帧 ${P.big.x}~${P.big.right} vs 字幕 ${sweepText.x}~${sweepText.right}` : '');
    ok(P.docked && sweepText && !(P.docked.x < sweepText.right && sweepText.x < P.docked.right), '落定帧不压住回合数');
    /**
     * 「立绘不会把回合数字幕顶偏」。
     * 不去比较「有图 / 没图」两个时刻（那要卡在光带停稳到立绘入场之间的 150ms 窗口里，很脆），
     * 改成直接量不变量：字幕必须在光带正中，而且两侧立绘位必须等宽 ——
     * 等宽这件事才是「加一张图不会把字幕挤歪」的**原因**。
     */
    const bandRect = r(P.band);
    const mid = P.band.querySelector('.turn-sweep-mid');
    const midRect = r(mid);
    const off = midRect ? Math.abs((midRect.x + midRect.w / 2) - (bandRect.x + bandRect.w / 2)) : 999;
    ok(off <= 2, '回合数字幕在光带正中（立绘出现也不会被顶偏）', `偏离 ${off.toFixed(1)}px`);
    const slotP = r(P.band.querySelector('.turn-art-player'));
    const slotE = r(P.band.querySelector('.turn-art-enemy'));
    ok(slotP && slotE && slotP.w === slotE.w, '两侧立绘位等宽 —— 这就是字幕不会被顶偏的原因',
      `${slotP?.w}px vs ${slotE?.w}px`);
    // 立绘位做了反向 skew，宝可梦才不是歪的（光带整体 -12deg）。
    // skewX(θ) 的矩阵是 matrix(1, 0, tanθ, 1, 0, 0) —— 斜切值在**第三个**位置，
    // tan(12°) ≈ 0.2126（第一版断言写成了第二个位置，量出来恒为 0，误报）。
    const artTf = getComputedStyle(P.slot).transform;
    const skewC = parseFloat((artTf.match(/matrix\(([^)]+)\)/)?.[1] ?? '').split(',')[2] ?? 'NaN');
    ok(skewC > 0.15 && skewC < 0.3, '立绘位做了反向 skew（抵消光带的斜切，宝可梦站得正）',
      `${artTf}（tan = ${Number.isFinite(skewC) ? skewC.toFixed(3) : 'n/a'}，期望 ≈ 0.213）`);

    bs.clearTurnIntro();
    await wait(120);

    // ---- 敌方 ----
    const E = await runSide('enemy');
    log(`敌方：起始帧=${JSON.stringify(E.big)}  落定帧=${JSON.stringify(E.docked)}`);
    ok(E.loaded, '敌方立绘图真的加载出来了', E.img ? `natural=${E.img.naturalWidth}×${E.img.naturalHeight}` : '（没有 img）');
    ok(E.docked && sweepText && E.docked.x >= sweepText.right - 1, '敌方立绘在回合数**右边**',
      E.docked && sweepText ? `立绘左边 ${E.docked.x} ≥ 字幕右边 ${sweepText.right}` : '');
    ok(E.docked && E.docked.x >= 0 && E.docked.right <= innerWidth, '敌方落定帧完整在屏幕内');
    ok(E.big && E.docked && E.big.h > E.docked.h * 1.8, '由大变小（敌方）', E.big && E.docked ? `${E.big.h}px → ${E.docked.h}px` : '');
    ok(E.big && sweepText && E.big.x < sweepText.right && sweepText.x < E.big.right, '敌方起始帧也和回合数有重叠');
    ok(E.docked && sweepText && !(E.docked.x < sweepText.right && sweepText.x < E.docked.right), '敌方落定帧不压住回合数');
    bs.clearTurnIntro();
    await wait(120);

    // ---- 布局没被挤动（光带是 fixed 浮层，理论上碰不到战斗场地） ----
    const after = {
      player: r('.fighter-player .fighter-card'),
      enemy: r('.fighter-enemy .fighter-card'),
      badge: r('.turn-badge'),
    };
    ok(same(before.player, after.player), '整段过场期间我方角色卡没被挤动');
    ok(same(before.enemy, after.enemy), '敌方角色卡没被挤动');
    ok(same(before.badge, after.badge), '场上的回合徽章没被挤动');

    // ---- ⑤ 演出速度联动 ----
    const saved = bs.speedMul;
    bs.speedMul = 1;
    bs.clearTurnIntro();
    bs.turnIntro('player', 99);
    const normalSweep = parseFloat(document.querySelector('.turn-sweep').style.getPropertyValue('--sweep-ms'));
    bs.speedMul = 0.55;   // 设置面板里的「快」
    bs.clearTurnIntro();
    bs.turnIntro('player', 99);
    const fastSweep = parseFloat(document.querySelector('.turn-sweep').style.getPropertyValue('--sweep-ms'));
    await wait(Math.round(fastSweep * 0.22) + 20);
    const fastIn = parseFloat(document.querySelector('.turn-art-player').style.getPropertyValue('--tart-in'));
    bs.clearTurnIntro();
    bs.speedMul = saved;
    ok(fastSweep > 0 && fastSweep < normalSweep * 0.75, '演出速度设成「快」时回合光带也变短',
      `标准 ${normalSweep}ms → 快 ${fastSweep}ms`);
    ok(fastIn > 0 && fastIn < 620 * 0.75, '演出速度设成「快」时立绘动画跟着变短', `快档 ${fastIn}ms`);
    ok(normalSweep >= 2000, '光带停留时间拉长了（不挡操作，所以可以停久一点看清回合数与立绘）', `${normalSweep}ms`);

    // ---- ⑥ 光带不挡操作：光带还在屏幕上时，玩家已经能出牌 ----
    await wait(200);
    let sawBandWhileFree = false;
    let bandSeen = false;
    const t0 = performance.now();
    bs.onEndTurn();   // 不 await：要在演出过程中观察
    while (performance.now() - t0 < 25000) {
      const hasBand = !!document.querySelector('.turn-sweep');
      if (hasBand) bandSeen = true;
      if (hasBand && !bs.busy) { sawBandWhileFree = true; break; }
      await wait(50);
    }
    ok(bandSeen, '真实回合里确实挂了光带');
    ok(sawBandWhileFree, '光带还在屏幕上的时候就能出牌了（busy 已放开，过场不挡操作）',
      `第 ${Math.round((performance.now() - t0) / 100) / 10}s 观察到的`);
    // 收尾：让这一回合的演出跑完，免得影响后面的检查
    const t1 = Date.now() + 15000;
    while (bs.busy && Date.now() < t1) await wait(100);
    bs.clearTurnIntro();

    // ---- 敏捷预算胶囊 ----
    const agi = bs.battle.player.agi;
    const want = `出牌 ${bs.battle.player.playsLeft} / ${bal.playsFromAgi(agi)}`;
    const wantDraw = `抽牌 ${bal.drawFromAgi(agi)}`;
    const txt = bs.budgetEl.textContent.replace(/\s+/g, ' ').trim();
    log(`预算胶囊文本 = 「${txt}」`);
    ok(txt.includes(want), `出牌上限跟着敏捷（敏捷 ${agi} → ${bal.playsFromAgi(agi)} 张）`, `期望包含「${want}」`);
    ok(txt.includes(wantDraw), `抽牌数跟着敏捷（敏捷 ${agi} → ${bal.drawFromAgi(agi)} 张）`, `期望包含「${wantDraw}」`);
    ok(bs.budgetEl.querySelector('.budget-chip')?.dataset.tip?.includes(`敏捷 ${agi}`), '胶囊的悬停说明里写了当前敏捷值');

    // 出一张牌之后，「还能出几张」要当场减一（这是玩家最容易困惑的地方）
    bs.disp.player.playsLeft = Math.max(0, bs.disp.player.playsLeft - 1);
    bs.refreshTurn();
    const txt2 = bs.budgetEl.textContent.replace(/\s+/g, ' ').trim();
    ok(txt2.includes(`出牌 ${bs.disp.player.playsLeft} /`), '打出一张牌后预算当场递减', `「${txt2}」`);
    ok(bs.budgetEl.querySelector('.budget-chip')?.dataset.tip?.includes(`本回合还能打出`), '悬停说明跟着刷新');

    // AP 也在（原来就有），三项预算都齐了。
    // 注意：AP 两个字是图标（.ap-ico 的 mask），不在 .ap-text 里，别去文本里找。
    const apText = document.querySelector('.ap-text')?.textContent ?? '';
    ok(/^\d+ \/ \d+$/.test(apText.trim()) && !!document.querySelector('.ap-ico'), 'AP 仍然显示（三项预算齐全）', apText);

    // ---- 敏捷的影响在「战斗之外」也要看得见 ----
    const hudAgi = [...document.querySelectorAll('#hud-stats .stat-chip')].find((c) => c.textContent.includes('敏'));
    const hudTip = hudAgi?.dataset.tip ?? '';
    ok(!!hudTip && !hudAgi.hasAttribute('title'), 'HUD 的「敏」胶囊用 data-tip（不是会被浮层忽略的原生 title）');
    ok(
      hudTip.includes(`敏捷 ${agi}`) && hudTip.includes(`${bal.apFromAgi(agi)} 点`)
      && hudTip.includes(`${bal.drawFromAgi(agi)} 张`) && hudTip.includes(`${bal.playsFromAgi(agi)} 张`),
      'HUD 说明里写清了 AP / 抽牌 / 出牌上限三个数',
      hudTip.split('\n').slice(1).join(' '),
    );
    // 悬停真的会弹出浮层（无头浏览器没有指针，只能用事件模拟；这也是 tips.js 的委托路径）
    hudAgi.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await wait(60);
    const layer = document.querySelector('.tip-layer');
    ok(!!layer?.classList.contains('show'), '悬停「敏」真的弹出说明浮层',
      layer?.classList.contains('show') ? `浮层里出现 ${layer.querySelectorAll('b').length} 处加粗重点` : '浮层没弹出来');
    hudAgi.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));

    // 卡组页（UI 界面）也要有一张「每回合的预算」卡，不用悬停就能看到
    const { showDeck } = await import('../src/ui/overlays.js');
    showDeck(game);
    await wait(200);
    const deckText = document.querySelector('.modal.panel')?.textContent?.replace(/\s+/g, ' ') ?? '';
    const deckOk = deckText.includes(`每回合的预算（敏捷 ${agi}）`)
      && deckText.includes(`行动点 AP ${bal.apFromAgi(agi)} 点`)
      && deckText.includes(`抽牌 ${bal.drawFromAgi(agi)} 张`)
      && deckText.includes(`出牌上限 ${bal.playsFromAgi(agi)} 张`);
    ok(deckOk, '卡组页有「每回合的预算」卡片，三个数都对得上', deckOk ? '' : deckText.slice(0, 120));
    document.querySelector('.modal-backdrop')?.remove();

    if (fails.length) {
      log(`TURNART_ERRORS=[${fails.join(' | ')}]`);
    } else {
      log('回合立绘自检：通过 ✓');
    }
    log('TURNART_DONE');
  } catch (e) {
    log('TURNART_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' | ') : e));
    log('TURNART_DONE');
  }
})();
