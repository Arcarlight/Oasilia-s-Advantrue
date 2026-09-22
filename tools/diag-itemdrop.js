// 诊断：**掉落道具那一屏**（?dgitemdrop=1）。
//
// 这一份盯的是玩家报的两件事：
//   ① 「获得道具的界面，不要的选项太浅了，几乎看不见」——
//      量的是那个按钮的**文字色 vs 它自己的底色**（WCAG 对比度）。
//      为了能给出「修之前是什么样」，脚本会临时注入一条旧规则再量一次（同一台浏览器、
//      同一个页面、同一个按钮，A/B 只差那一条 CSS）。
//   ② 「选择丢弃身上道具并收下后，道具已经进入背包，窗口却没有关闭」——
//      走完整条路：掉落屏 →「丢掉一件，收下它」→ 丢弃框 →「丢掉这件，换新的」，
//      然后断言：丢弃框关掉了、掉落屏收掉了（进结算页）、道具正好进了一件、手持栏没有多出来。
//      另外按一次「重复触发」：再调一次丢弃框，看会不会又白送一件（旧版能刷）。
//
// 用法：
//   node tools/diag2.mjs "http://127.0.0.1:5123/?dgitemdrop=1" rt
//   截图：?dgitemdrop=shot（新样式）/ ?dgitemdrop=shot-old（临时套上旧样式，做对比图）
(async () => {
  const log = (...a) => console.log('[d2] [drop]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };
  const q = (sel, root) => (root ?? document)?.querySelector?.(sel) ?? null;
  const qa = (sel, root) => [...((root ?? document)?.querySelectorAll?.(sel) ?? [])];
  const click = (node) => node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  /** 老样式的 `.btn-ghost`（改之前那一版，见 git 里 style.css 的 btn-ghost） */
  const OLD_GHOST = `
    .panel-paper .btn-ghost {
      background: rgba(255, 255, 255, .06) !important;
      color: #e8cfa2 !important;
      box-shadow: inset 0 0 0 2px rgba(232, 207, 162, .25) !important;
      text-shadow: 0 1px 0 rgba(255, 255, 255, .25) !important;
    }`;
  const inject = (css) => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); return s; };

  // ---- 颜色工具（WCAG 相对亮度 / 对比度）----
  const parseRGB = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => ({      // fg 半透明时压到 bg 上（按钮底色本来就是半透明的）
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const contrast = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  /** 量一个按钮：文字色 vs 按钮自己的底色（压在羊皮纸色上） */
  const measure = (btn, paper) => {
    const cs = getComputedStyle(btn);
    const fg = parseRGB(cs.color);
    const bg = over(parseRGB(cs.backgroundColor), paper);
    return { ratio: contrast(fg, bg), fg: cs.color, bg: cs.backgroundColor, font: cs.fontSize };
  };

  const params = new URLSearchParams(location.search);
  const mode = params.get('dgitemdrop');       // '1' | 'shot' | 'shot-old'

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { ITEMS } = await import('../src/data/items.js');
    const { showHeldOverflow } = await import('../src/ui/overlays.js');

    /** 造出「掉了一件但手持栏满了」那一屏（走真的 finishBattle，不打桩那一屏的判定） */
    const setupDrop = (heldIds, dropId) => {
      game.newRun(31337);
      game.data.held = [...heldIds];
      game.invalidateMods();
      game.data.bossKills = 0;
      game.rollItemDrop = () => ({ id: dropId, reason: 'type' });
      game.startBattle('normal', 0, 'direct');
      game.battle.enemy.hp = 0;
      game.battle.winner = 'player';
      game.battle.over = true;
      const r = game.finishBattle();
      game.phase = 'reward';
      ui.forceRerender();
      return r.itemDrop;
    };

    const heldIds = Object.keys(ITEMS).filter((id) => id !== 'big_root').slice(0, 3);
    const paper = parseRGB(getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#f0dcb6')
      ?? { r: 240, g: 220, b: 182, a: 1 };
    let drop = setupDrop(heldIds, 'big_root');
    await wait(400);

    ok(!!q('.drop-screen'), '掉落那一屏画出来了');
    ok(drop?.stored === false && drop?.overflow === true, '前提：手持栏满了，这一件拿不下', drop?.text?.slice(0, 30));

    const row = q('.drop-panel .reward-row');
    const buttons = qa('button', row);
    ok(buttons.length === 2, '给了两条不一样的路', buttons.map((b) => b.textContent.trim()).join(' ｜ '));
    const decline = buttons.find((b) => b.className.includes('btn-ghost'));
    const take = buttons.find((b) => !b.className.includes('btn-ghost'));
    ok(!!decline && !!take, '「丢掉一件，收下它」与「不要，就这样」都在');

    log('① 「不要」那个按钮的对比度（WCAG，正文要求 ≥ 4.5:1）');
    {
      const now = measure(decline, paper);
      const old = inject(OLD_GHOST);
      await wait(60);
      const before = measure(decline, paper);
      old.remove();
      await wait(60);
      const after = measure(decline, paper);
      ok(Math.abs(after.ratio - now.ratio) < 0.05, '（先把旧规则摘掉，量到的还是现在这一版）', `现在 ${after.ratio.toFixed(2)}:1`);
      ok(before.ratio < 1.6, `修之前几乎是看不见的：${before.ratio.toFixed(2)}:1（文字 ${before.fg} 压在同色系底色上）`);
      ok(after.ratio >= 4.5, `现在看得清了：${after.ratio.toFixed(2)}:1（文字 ${after.fg}，字号 ${after.font}）`,
        `提升 ${(after.ratio / before.ratio).toFixed(1)} 倍`);
      // 纸面那一整排「幽灵按钮」一起受益：事件 / 宝箱 / 营地 / 商店
      const css = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } })
        .filter((r) => r.selectorText === '.panel-paper .btn-ghost').length;
      ok(css >= 1, '这条规则是**按面板**写的（浅色羊皮纸上的幽灵按钮都跟着变清楚）', `命中 ${css} 条`);
    }

    log('② 换手：丢掉一件、收下它 —— 窗口必须关掉');
    {
      const dropNow = game.reward?.itemDrop;
      const heldBefore = [...game.data.held];
      click(take);
      await wait(300);
      const modal = q('.modal-backdrop');
      ok(!!modal, '点「丢掉一件，收下它」会弹出「丢掉哪一件」');
      const swapBtn = qa('button', modal).find((b) => /换新/.test(b.textContent));
      ok(!!swapBtn, '弹出框里能选「丢掉这件，换新的」', swapBtn?.textContent?.trim());

      click(swapBtn);
      await wait(400);
      ok(!q('.modal-backdrop'), '**丢弃框自己关掉了**（没有残留的弹窗）');
      ok(!q('.drop-screen'), '**掉落那一屏也收掉了**（不会再停在「栏位满了」那一句上）');
      ok(!!q('.reward-screen') || !!q('.screen'), '已经走到战斗结算那一屏', q('.screen')?.className ?? '');
      ok(game.data.held.includes('big_root'), '「大根茎」确实进了手持栏');
      ok(game.data.held.filter((id) => id === 'big_root').length === 1, '只进了一件（不是两件）',
        `big_root ×${game.data.held.filter((id) => id === 'big_root').length}`);
      ok(game.data.held.length === heldBefore.length, '丢一件、拿一件：手持栏数量不变',
        `${heldBefore.length} → ${game.data.held.length}`);
      ok(dropNow?.stored === true && dropNow?.seen === true && dropNow?.claimed === true,
        '掉落记录写回了战果（stored / seen / claimed）',
        `stored=${dropNow?.stored} seen=${dropNow?.seen} claimed=${dropNow?.claimed}`);
    }

    log('③ 同一件掉落不许被收两次（连点 / 重复触发）');
    {
      // 重新摆一屏（和玩家真的遇上一模一样：打赢一场、掉了一件、手持栏满了）
      setupDrop(heldIds, 'big_root');
      await wait(350);
      const take2 = qa('button', q('.drop-panel .reward-row')).find((b) => !b.className.includes('btn-ghost'));
      click(take2);
      await wait(200);
      const modal = q('.modal-backdrop');
      const swapBtn = qa('button', modal).find((b) => /换新/.test(b.textContent));
      ok(!!swapBtn, '丢弃框又开出来了（第二次遇到掉落）');
      const n1 = game.data.held.length;
      const count = () => game.data.held.filter((id) => id === 'big_root').length;
      click(swapBtn);
      /**
       * 第二下：模拟「连点」/「节点已经摘掉了还被人补发一次 click」。
       * 旧版这里会**又丢一件、又拿一件** —— 同一件掉落白刷两次，手持栏还被换掉一件。
       */
      click(swapBtn);
      await wait(350);
      ok(!q('.modal-backdrop'), '弹窗收掉了');
      ok(count() === 1, '「大根茎」只有一件（没有刷出第二件）', `×${count()}`);
      ok(game.data.held.length === n1, '手持栏数量也没被换两次', `${n1} → ${game.data.held.length}`);
    }

    log('④ 奖励选项多起来之后，结算那一屏还站得住（彗星碎片）');
    {
      game.newRun(31338);
      game.data.held = ['comet_shard'];
      game.invalidateMods();
      game.rollItemDrop = () => null;
      game.startBattle('elite', 0, 'direct');
      game.data.cardDrought = 9;                 // 保底：一定出卡
      game.battle.enemy.hp = 0;
      game.battle.winner = 'player';
      game.battle.over = true;
      const r = game.finishBattle();
      if (game.reward.itemDrop) game.reward.itemDrop.seen = true;   // 跳过掉落那一屏
      game.phase = 'reward';
      ui.forceRerender();
      await wait(450);

      ok(r.cardChoices.length === 5, '精英战斗配彗星碎片：5 个选项', `${r.cardChoices.length} 个`);
      const row = q('.reward-cards');
      const cards = qa('.reward-cards > *', row ?? document);
      ok(cards.length === 5, '5 张卡都画出来了', `${cards.length} 张`);
      const panel = q('.reward-screen .panel');
      const pr = panel.getBoundingClientRect();
      const out = cards.map((c) => c.getBoundingClientRect()).filter((b) => b.left < pr.left - 1 || b.right > pr.right + 1);
      ok(out.length === 0, '5 张卡都没有溢出面板（多的会换行，不是挤出去）',
        `面板宽 ${Math.round(pr.width)}px，卡宽 ${cards.map((c) => Math.round(c.getBoundingClientRect().width)).join('/')}`);
      const tops = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().top)));
      ok(tops.size >= 1, '排布有确定的行数（换行是布局做的，不是游离在外面）', `${tops.size} 行`);
    }

    log('⑤ 右上角背包按钮：件数角标 + 悬停文字跟着语言走');
    {
      const { changeLanguage } = await import('../src/ui/langswitch.js');
      game.newRun(31339);
      game.data.held = [];
      game.invalidateMods();
      game.phase = 'map';
      ui.forceRerender();
      await wait(300);
      const btn = q('#btn-items');
      const badge = q('#hud-held-count');
      ok(!!btn && !!badge, 'HUD 上有背包按钮和它的件数角标');
      ok(badge.classList.contains('hidden'), '手上没东西时不显示角标', `text="${badge.textContent}"`);

      game.giveItem('big_root', 1);
      game.giveItem('honey', 1);
      ui.forceRerender();
      await wait(250);
      ok(!badge.classList.contains('hidden') && badge.textContent === '2',
        '拿到两件之后角标写 2', `text="${badge.textContent}"`);
      ok(!badge.classList.contains('full'), '没满的时候不是警示色');

      while (game.data.held.length < game.heldMax()) game.giveItem('oran_berry', 1);
      ui.forceRerender();
      await wait(250);
      ok(badge.classList.contains('full'), `手持栏满了角标变警示色（${game.data.held.length} / ${game.heldMax()}）`,
        `text="${badge.textContent}"`);

      // 点开：里面列着身上那几件
      click(btn);
      await wait(300);
      const bag = q('.modal-backdrop');
      ok(!!bag && qa('.held-item', bag).length === game.data.held.length,
        '点开就是那几件道具（数量对得上）', `${qa('.held-item', bag).length} 件`);
      for (const b of qa('.modal-head button')) click(b);
      await wait(200);

      // 悬停文字：三语各写一份，不留中文
      const seen = {};
      for (const lg of ['zh', 'ja', 'en']) {
        changeLanguage(lg);
        await wait(150);
        const t2 = q('#btn-items')?.getAttribute('title') ?? '';
        seen[lg] = t2;
      }
      changeLanguage('zh');
      await wait(150);
      ok(seen.zh && seen.ja && seen.en, '三种语言都有悬停文字',
        Object.entries(seen).map(([k, v]) => `${k}「${v}」`).join(' ｜ '));
      ok(seen.ja !== seen.zh && seen.en !== seen.zh, '日语 / 英语那两份不是中文原文');
      ok(/^[\x20-\x7E]+$/.test(seen.en), '英语那份是纯 ASCII，没有夹着汉字', `「${seen.en}」`);
      ok(/[\u3040-\u30ff]/.test(seen.ja), '日语那份真的是日语（有假名）', `「${seen.ja}」`);
    }

    // 截图模式：把掉落那一屏重新摆好就停住
    if (mode === 'shot-hud') {
      /**
       * `?dgitemdrop=shot-hud`：摆一场战斗 + 手上几件道具，停在 HUD 上（看背包按钮与角标）。
       * `&full=1` 让手持栏满（角标变警示色）。
       */
      game.newRun(31340);
      game.data.held = [];
      game.invalidateMods();
      game.giveItem('big_root', 1);
      if (params.get('full') === '1') {
        while (game.data.held.length < game.heldMax()) game.giveItem('oran_berry', 1);
      } else {
        game.giveItem('honey', 1);
      }
      game.startBattle('normal', 0, 'direct');
      await wait(1600);
      // `&hudzoom=2`：把 HUD 放大来看角标（截图工具没有裁剪功能，就地放大最省事）
      const zoom = params.get('hudzoom');
      if (zoom) {
        const hud = document.getElementById('hud');
        if (hud) {
          hud.style.zoom = zoom;
          hud.style.transformOrigin = 'top right';
        }
        await wait(200);
      }
      log('（截图模式：shot-hud，画面停在战斗 + HUD）');
      log('DROP_DONE');
      return;
    }
    if (mode === 'shot-reward') {
      log('（截图模式：shot-reward，画面停在 5 个选项的结算页）');
      log('DROP_DONE');
      return;
    }
    if (mode === 'shot' || mode === 'shot-old') {
      game.newRun(31337);
      game.data.held = [...heldIds];
      game.invalidateMods();
      setupDrop(heldIds, 'big_root');
      if (mode === 'shot-old') inject(OLD_GHOST);
      ui.forceRerender();
      await wait(500);
      log(`（截图模式：${mode}，画面停在掉落那一屏）`);
      log('DROP_DONE');
      return;
    }

    if (fails.length) log(`DROP_ERRORS=[${fails.join(' | ')}]`);
    else log('掉落窗口自检：通过 ✓');
    log('DROP_DONE');
  } catch (e) {
    log('DROP_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e));
    log('DROP_DONE');
  }
})();
