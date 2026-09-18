// 诊断：回合切换立绘（?dgturnart=1）与「敏捷预算」胶囊。
//
// 要证的四件事：
//   ① 立绘确实是我方背面 / 敌方正面，而且图真的加载出来了（不是破图）；
//   ② 它落在回合数的左边（我方）/ 右边（敌方），并且完全在战斗场地之内（没被 overflow 切掉）；
//   ③ 「由大变小」真的发生了 —— 起始那一帧明显大于落定之后，而且起始帧是盖住回合数的；
//   ④ 立绘演出的全过程**不动任何布局**（回合徽章、两个角色站位的位置一格都不许变）；
//   ⑤ 战斗演出速度设成「快」时，立绘动画时长跟着缩短。
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
  const inside = (a, box) => a && box && a.x >= box.x - 1 && a.right <= box.right + 1 && a.y >= box.y - 1 && a.bottom <= box.bottom + 1;

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const bal = await import('../src/data/balance.js');

    // 固定用「快」以外的标准速度起手，后面第 ⑤ 项再单独切
    game.newRun(20240909);
    await wait(300);
    const node = game.availableNodes().find((n) => n.type === 'battle') || game.availableNodes()[0];
    game.goToNode(node.id);
    // 等开场演出跑完（第一个回合的立绘也会在这段时间里演一遍）
    await wait(4200);

    const bs = ui.battleScreen;
    if (!bs) throw new Error('没有战斗界面（battleScreen 为空）');

    /**
     * 截图模式：`?dgturnart=big`（定格在起始的「大」那一帧）/
     * `?dgturnart=docked`（定格在收拢之后）。
     * 为什么需要定格：动画只有 560ms，靠 --virtual-time-budget 卡时间点截图很不稳，
     * 定格之后截出来的才是确定的那一帧。用 &artside=enemy 换另一侧。
     */
    const q = new URLSearchParams(location.search);
    const mode = q.get('dgturnart');
    if (mode === 'big' || mode === 'docked') {
      const artP = await import('../src/core/gen9.js');
      const side = q.get('artside') === 'enemy' ? 'enemy' : 'player';
      const slot = side === 'enemy' ? bs.turnArtEnemy : bs.turnArtPlayer;
      const slug = side === 'enemy' ? bs.battle.enemy.slug : game.data.slug;
      const art = artP.turnArt(slug, side === 'enemy' ? 'front' : 'back');
      if (art) {
        slot.replaceChildren();
        const slotH = parseFloat(getComputedStyle(slot).height) || 80;
        const { w, h } = artP.fitArt(art, slotH);
        const img = document.createElement('img');
        img.className = 'turn-art-img';
        img.src = art.url;
        img.style.width = `${w}px`;
        img.style.height = `${h}px`;
        if (mode === 'docked') img.style.animation = 'none';
        // big：不能靠「暂停动画」定格 —— shot.mjs 默认带 --force-prefers-reduced-motion，
        // 而 CSS 里 reduced-motion 会把这条动画整个关掉，截出来和 docked 一模一样（踩过）。
        // 直接把起始帧的 transform 写死，和 CSS 的 0% 关键帧等价，且不受动效偏好影响。
        else {
          img.style.animation = 'none';
          img.style.transform = `scale(${artP.ART_FROM_SCALE})`;
        }
        slot.append(img);
        log(`定格：side=${side} mode=${mode} 尺寸=${w}×${h} 实际 rect=${JSON.stringify(r(img))}`);
      } else {
        log(`定格失败：${slug} 没有可用立绘`);
      }
      log('TURNART_DONE');
      return;
    }

    const field = r('.battle-field');
    const wrap = r('.turn-badge-wrap');
    const badge = r('.turn-badge');
    const intent = r('.intent');
    log(`场地 rect=${JSON.stringify(field)}`);
    log(`回合徽章容器 rect=${JSON.stringify(wrap)}`);
    log(`回合徽章 rect=${JSON.stringify(badge)}  意图胶囊 rect=${JSON.stringify(intent)}`);

    // ---- ① 素材来源与可用性 ----
    const eslug = bs.battle.enemy.slug;
    const pslug = game.data.slug;
    const artP = await import('../src/core/gen9.js');
    const ap = artP.turnArt(pslug, 'back');
    const ae = artP.turnArt(eslug, 'front');
    ok(!!ap, `我方立绘取到 ${pslug}/back`, ap ? `${ap.w}×${ap.h} 系数 ${ap.scale.toFixed(2)}` : '（没取到）');
    ok(!!ae, `敌方立绘取到 ${eslug}/front`, ae ? `${ae.w}×${ae.h} 系数 ${ae.scale.toFixed(2)}` : '（没取到）');
    for (const img of document.querySelectorAll('.turn-art-img')) {
      log(`  · 场上残留立绘 ${img.src.slice(0, 46)}… natural=${img.naturalWidth}×${img.naturalHeight}`);
    }

    // ---- ④ 基线：先把「立绘出现之前」的布局量下来 ----
    const before = {
      badge: r('.turn-badge'),
      wrap: r('.turn-badge-wrap'),
      player: r('.fighter-player .fighter-card'),
      enemy: r('.fighter-enemy .fighter-card'),
    };

    // ---- ③ 我方立绘：抓起始帧 + 落定帧 ----
    const slotP = bs.turnArtPlayer;
    slotP.replaceChildren();
    const pPromise = bs.turnArt('player', 99);
    // turnArt 的同步前缀里就已经把 <img> 挂上了，这里能立刻量到动画的 0% 帧
    const imgP = slotP.querySelector('.turn-art-img');
    const bigP = r(imgP);
    const inMsP = parseFloat(slotP.style.getPropertyValue('--tart-in'));
    await wait(inMsP + 60);
    const dockedP = r(slotP.querySelector('.turn-art-img'));
    log(`我方：起始帧=${JSON.stringify(bigP)}  落定帧=${JSON.stringify(dockedP)}`);
    ok(!!imgP && imgP.naturalWidth > 0, '我方立绘图真的加载出来了', imgP ? `natural=${imgP.naturalWidth}×${imgP.naturalHeight}` : '（没有 img）');
    ok(imgP?.src.includes('/gen9/') || imgP?.src.startsWith('data:image/png;base64'), '图片地址来自 gen9 立绘目录（或内联 data URI）');
    ok(bigP && dockedP && bigP.h > dockedP.h * 1.8, '由大变小：起始帧高度远大于落定帧',
      bigP && dockedP ? `${bigP.h}px → ${dockedP.h}px（${(bigP.h / dockedP.h).toFixed(2)}×）` : '');
    ok(dockedP && badge && dockedP.right <= badge.x + 1, '我方立绘在回合数**左边**',
      dockedP && badge ? `立绘右边 ${dockedP.right} ≤ 徽章左边 ${badge.x}` : '');
    ok(inside(dockedP, field), '落定帧完全在战斗场地之内（没被 overflow 裁掉）');
    // 「从中间收拢过来」的判据：起始帧和回合数**有重叠**，落定帧不重叠。
    // 注意别写成「起始帧必须盖满整个徽章」：窗口一窄，立绘跟着 clamp 变小，
    // 1024 宽下 2.6 倍也盖不满 160px 的徽章（诊断里真的这么误报过一次）。
    ok(bigP && badge && bigP.x < badge.right && badge.x < bigP.right,
      '起始帧和回合数有重叠（视觉上是从中间收拢过来的，不是从旁边长出来）',
      bigP && badge ? `起始帧 ${bigP.x}~${bigP.right} vs 徽章 ${badge.x}~${badge.right}` : '');
    ok(dockedP && badge && !(dockedP.x < badge.right && badge.x < dockedP.right),
      '落定帧不压住回合数（收拢之后让开）');

    await pPromise;   // 等它自己淡出收场

    // ---- 敌方立绘 ----
    const slotE = bs.turnArtEnemy;
    slotE.replaceChildren();
    const ePromise = bs.turnArt('enemy', 99);
    const imgE = slotE.querySelector('.turn-art-img');
    const bigE = r(imgE);
    const inMsE = parseFloat(slotE.style.getPropertyValue('--tart-in'));
    await wait(inMsE + 60);
    const dockedE = r(slotE.querySelector('.turn-art-img'));
    log(`敌方：起始帧=${JSON.stringify(bigE)}  落定帧=${JSON.stringify(dockedE)}`);
    ok(!!imgE && imgE.naturalWidth > 0, '敌方立绘图真的加载出来了', imgE ? `natural=${imgE.naturalWidth}×${imgE.naturalHeight}` : '（没有 img）');
    ok(dockedE && badge && dockedE.x >= badge.right - 1, '敌方立绘在回合数**右边**',
      dockedE && badge ? `立绘左边 ${dockedE.x} ≥ 徽章右边 ${badge.right}` : '');
    ok(inside(dockedE, field), '敌方落定帧完全在战斗场地之内');
    ok(bigE && dockedE && bigE.h > dockedE.h * 1.8, '由大变小（敌方）', bigE && dockedE ? `${bigE.h}px → ${dockedE.h}px` : '');
    ok(bigE && badge && bigE.x < badge.right && badge.x < bigE.right, '敌方起始帧也和回合数有重叠');
    ok(dockedE && badge && !(dockedE.x < badge.right && badge.x < dockedE.right), '敌方落定帧不压住回合数');
    await ePromise;

    // ---- ④ 布局没被挤动 ----
    const after = {
      badge: r('.turn-badge'),
      wrap: r('.turn-badge-wrap'),
      player: r('.fighter-player .fighter-card'),
      enemy: r('.fighter-enemy .fighter-card'),
    };
    const same = (a, b) => a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
    ok(same(before.badge, after.badge), '整段立绘演出期间回合徽章一格没动', `${JSON.stringify(before.badge)} vs ${JSON.stringify(after.badge)}`);
    ok(same(before.player, after.player), '我方角色卡没被挤动');
    ok(same(before.enemy, after.enemy), '敌方角色卡没被挤动');

    // ---- ⑤ 演出速度联动 ----
    const saved = bs.speedMul;
    bs.speedMul = 1;
    await bs.turnArt('player', 99);
    const normalMs = parseFloat(slotP.style.getPropertyValue('--tart-in'));
    bs.speedMul = 0.55;   // 设置面板里的「快」
    await bs.turnArt('player', 99);
    const fastMs = parseFloat(slotP.style.getPropertyValue('--tart-in'));
    bs.speedMul = saved;
    ok(fastMs > 0 && normalMs > 0 && fastMs < normalMs * 0.7, '演出速度设成「快」时立绘动画跟着变短',
      `标准 ${normalMs}ms → 快 ${fastMs}ms`);

    /**
     * ⑥ 回合切换整体只慢了一点点。
     * 立绘是**叠在光带后半段**上场的（PACE.turnArtLead = 0.55），
     * 所以每个回合多等的是「立绘收尾」而不是整段演出。
     * 不量一下的话，「加了动画」很容易变成「每回合都多等一秒多」还看不出来。
     */
    bs.speedMul = 1;
    const SWEEP = 1250;   // = balance/ battle-view 里的 PACE.turnSweep
    const t0 = performance.now();
    await bs.wait(SWEEP * 0.55).then(() => bs.turnArt('player', 99));
    const artTotal = performance.now() - t0;
    bs.speedMul = saved;
    ok(artTotal < SWEEP * 1.6, '回合切换整体只变长一点点（立绘叠在光带后半段）',
      `${Math.round(artTotal)}ms（光带本身 ${SWEEP}ms，多等 ${Math.round(artTotal - SWEEP)}ms）`);

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
    // 顶部 HUD 的「敏」胶囊：以前用的是原生 title，等于没有（用户反馈「UI 没显示」就是它）
    const hudAgi = [...document.querySelectorAll('#hud-stats .stat-chip')].find((c) => c.textContent.includes('敏'));
    const hudTip = hudAgi?.dataset.tip ?? '';
    ok(!!hudTip, 'HUD 的「敏」胶囊有悬停说明（data-tip，不是原生 title）');
    ok(!!hudTip && !hudAgi.hasAttribute('title'), '而且没用会被全站浮层忽略的原生 title');
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
    const shown = layer?.classList.contains('show');
    ok(!!shown, '悬停「敏」真的弹出说明浮层',
      shown ? `浮层里出现 ${layer.querySelectorAll('b').length} 处加粗重点` : '浮层没弹出来');
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
    ok(deckOk, '卡组页有「每回合的预算」卡片，三个数都对得上',
      deckOk ? '' : deckText.slice(0, 120));
    document.querySelector('.modal-backdrop')?.remove();
    await wait(200);

    if (fails.length) {
      log(`TURNART_ERRORS=[${fails.join(' | ')}]`);
    } else {
      log('回合立绘自检：通过 ✓');
    }
    log('TURNART_DONE');
  } catch (e) {
    log('TURNART_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e));
    log('TURNART_DONE');
  }
})();
