// 战斗浮字诊断（?dgfloat=1）
//
// 起因（用户反馈）：伤害数字 / AP 减少的数字背后出现了一块「蓝底」。
// 浮字本身（.float-text）在 CSS 里没有任何背景，所以那块蓝一定是**别的元素压在它上面**
// （浮字层 z-index 60，能盖住它的东西并不多）。
//
// 这个脚本不去猜：一边打一边把每个浮字抓下来，用 document.elementsFromPoint()
// 打印浮字中心点**从上到下的完整元素栈**（标签 / class / 背景色 / 背景图 / 透明度 / z-index），
// 同时全屏扫一遍「蓝底 + 面积够大」的元素。谁画的蓝底，一眼就能看到。
(async () => {
  const log = (...a) => console.log('[d2] [float]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const qa = (s, root = document) => [...root.querySelectorAll(s)];
  const q = (s, root = document) => root.querySelector(s);
  const fails = [];
  const check = (name, ok, extra = '') => {
    log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    if (!ok) fails.push(name);
  };

  /** 把 'rgb(r, g, b)' / 'rgba(...)' 拆成 [r,g,b,a] */
  const parseColor = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(',').map((v) => parseFloat(v));
    return { r, g, b, a };
  };
  const rectOf = (n) => {
    const r = n.getBoundingClientRect();
    return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`;
  };
  const desc = (n) => {
    const cs = getComputedStyle(n);
    const cls = typeof n.className === 'string' ? n.className : '';
    const bg = cs.backgroundColor;
    const bgImg = cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage.slice(0, 48) : '-';
    return `<${n.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ''}> bg=${bg} bgimg=${bgImg} opacity=${cs.opacity} z=${cs.zIndex} ${rectOf(n)}`;
  };

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { CARD_BY_ID } = await import('/src/data/cards.js');

    game.newRun(4242);
    // 给玩家一副会挨打的牌：让敌人有机会降属性 / 造成伤害，浮字才出得来
    game.data.deck = ['tackle', 'tackle', 'tackle', 'harden', 'harden', 'bite', 'bite', 'bite', 'sand_attack', 'sand_attack'];
    game.data.battleDeck = null;
    game.startBattle('normal', 0);
    ui.current = null;
    ui.forceRerender();
    await wait(1000);
    const bs = ui.battleScreen;
    if (!bs) { log('没有 battleScreen'); log('FLOAT_DONE'); return; }
    const b = bs.battle;
    log(`开打：${b.enemy.name}，速度倍率 ${bs.speedMul}`);

    const seen = new Set();
    const seenPlayed = new Set();
    let found = 0;
    /** 抓浮字：新出现的浮字就把「它上面压着什么」打出来 */
    const inspect = () => {
      // 顺便盯住真正摊出来的那张牌：文案有没有被 -webkit-line-clamp 截掉
      for (const t of qa('.played-card .card-text')) {
        const key = `${Math.round(t.clientHeight)}:${t.textContent}`;
        if (seenPlayed.has(key)) continue;
        seenPlayed.add(key);
        const cut = t.scrollHeight - t.clientHeight > 1;
        const card = t.closest('.card');
        const wrap = t.closest('.played-card');
        const zone = wrap?.parentElement;
        check(`摊出来的牌「${t.textContent.slice(0, 12)}…」文案完整`,
          !cut, `${wrap?.className ?? '?'} 卡面 ${card?.offsetWidth}×${card?.offsetHeight}，字号 ${parseFloat(getComputedStyle(t).fontSize).toFixed(1)}px，可视 ${t.clientHeight} / 需要 ${t.scrollHeight}（zone --u=${zone?.style.getPropertyValue('--u') ?? '-'}）`);
      }
      for (const ft of qa('.float-text')) {
        const r = ft.getBoundingClientRect();
        const key = `${ft.textContent}@${Math.round(r.left)}x${Math.round(r.top / 20)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const stack = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        log(`浮字「${ft.textContent}」 ${desc(ft)}`);
        stack.slice(0, 6).forEach((n, i) => {
          const cs = getComputedStyle(n);
          const isBlue = (() => {
            const c = parseColor(cs.backgroundColor);
            return c && c.a > 0.2 && c.b > c.r + 15;
          })();
          log(`   ${i}. ${desc(n)}${isBlue ? '   ← 蓝色背景' : ''}`);
        });
        found += 1;
      }
    };
    const timer = setInterval(inspect, 40);

    // 打三回合：出牌 → 结束回合 → 挨打
    for (let round = 0; round < 3 && !b.over; round++) {
      for (let i = 0; i < 2; i++) {
        const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
        if (!hand.length) break;
        await bs.playCard(hand[0].uid);
        await wait(120);
      }
      if (!b.over) { await bs.onEndTurn(); await wait(400); }
    }
    await wait(600);
    clearInterval(timer);
    log(`一共抓到 ${found} 个浮字`);

    // 全屏扫「蓝色 + 够大」的元素：把嫌疑犯列出来（按面积从大到小）
    const blues = [];
    for (const n of qa('body *')) {
      const cs = getComputedStyle(n);
      const c = parseColor(cs.backgroundColor);
      const r = n.getBoundingClientRect();
      const area = r.width * r.height;
      if (!c || c.a < 0.2 || area < 200) continue;
      if (c.b > c.r + 15 && c.b > 60) {
        blues.push({ n, area, bg: cs.backgroundColor, op: cs.opacity, z: cs.zIndex });
      }
    }
    blues.sort((a, b2) => b2.area - a.area);
    log(`全屏「蓝色背景」元素 ${blues.length} 个：`);
    for (const x of blues.slice(0, 12)) log(`   ${desc(x.n)}`);

    // ---------- 出牌卡面的文案不能被截断（用户报的第二个 bug） ----------
    // 出牌展示区的卡面尺寸是 JS 按可用空白算的，可能比手牌小很多。
    // 这里直接把「最长的那张卡」放进 .played-card 里，扫一遍所有可能出现的卡宽量一遍 ——
    // 不依赖窗口尺寸，任何尺子坏了都躲不过。
    {
      const { CARDS } = await import('/src/data/cards.js');
      const { cardEl } = await import('/src/ui/cards.js');
      const longest = CARDS.slice().sort((a, b) => (b.text?.length ?? 0) - (a.text?.length ?? 0))[0];
      const NAT_W = 186, ASPECT = 186 / 190;
      const rows = [];
      for (const w of [56, 80, 96, 120, 150, 186, 240]) {
        const host = document.createElement('div');
        host.className = 'play-zone';
        host.style.cssText = 'position:fixed;left:-9999px;top:0;';
        const wrap = document.createElement('div');
        wrap.className = 'played-card in';
        // 和 layoutPlayZone() 写进 zone 的三个变量保持一致
        host.style.setProperty('--card-w', `${w}px`);
        host.style.setProperty('--card-h', `${Math.round(w / ASPECT)}px`);
        host.style.setProperty('--u', (w / NAT_W).toFixed(4));
        wrap.append(cardEl(longest, { size: 'md', disabled: true }));
        host.append(wrap);
        document.body.append(host);
        const t = host.querySelector('.card-text');
        rows.push({
          w,
          cut: t.scrollHeight - t.clientHeight > 1,
          fs: parseFloat(getComputedStyle(t).fontSize).toFixed(1),
          box: t.clientHeight,
          need: t.scrollHeight,
        });
        host.remove();
      }
      const cut = rows.filter((r) => r.cut);
      check('出牌卡面在 56~240px 各种尺寸下文案都不被截断', cut.length === 0,
        `最长的一张「${longest.name}」(${longest.text.length} 字)：` +
        rows.map((r) => `${r.w}px/${r.fs}px${r.cut ? `✗(${r.box}<${r.need})` : '✓'}`).join(' '));
    }

    // 浮字层本身与它的祖先，确认它自己没有背景
    const layer = q('.float-layer');
    log(`浮字层：${layer ? desc(layer) : '(没有)'}`);

    // ---------- 「蓝底」的真身：浏览器默认的文本选中高亮 ----------
    // 用户最后的结论是「不小心选中了游戏内的文本」。所以这里量两件事：
    //   ① 整页 / 战斗界面 / 卡面文字都不能被选中；
    //   ② 表单控件（设置里的滑杆）仍然能交互。
    const sel = (n) => (n ? getComputedStyle(n).userSelect : '-');
    const probe = document.createElement('input');
    probe.type = 'range';
    probe.style.cssText = 'position:fixed;left:-9999px;';
    document.body.append(probe);
    const probeSel = sel(probe);
    probe.remove();
    const bodySel = sel(document.body);
    const battleSel = sel(q('.battle-screen'));
    const cardSel = sel(q('.battle-screen .card-text') ?? q('.battle-screen .card'));
    check('整页禁止选中文本（蓝底不会再出现）', bodySel === 'none' && battleSel === 'none' && cardSel === 'none',
      `body=${bodySel} 战斗页=${battleSel} 卡面文字=${cardSel}`);
    check('表单控件仍然可以交互（设置里的滑杆）', probeSel !== 'none', `input[type=range] user-select=${probeSel}`);
    // 选区里有内容的话，截图上就会糊一块蓝：这里顺手确认切进战斗时被清掉了
    window.getSelection?.()?.removeAllRanges?.();
    check('切屏残留的选区会被清掉', (window.getSelection?.()?.rangeCount ?? 0) === 0,
      `选区数量=${window.getSelection?.()?.rangeCount ?? '-'}`);

    log(`CARD_BY_ID 里有 ${Object.keys(CARD_BY_ID).length} 张卡（确认模块加载正常）`);
    log(fails.length ? `ERRORS=[${fails.join(' / ')}]` : 'ERRORS=[]');
    log('FLOAT_DONE');
  } catch (err) {
    log('崩了：', err?.message ?? err, String(err?.stack ?? '').split('\n')[1] ?? '');
    log('FLOAT_DONE');
  }
})();
