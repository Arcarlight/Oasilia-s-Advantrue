// 诊断：商店「卡牌移除服务」到底能不能**用鼠标点出来**（?dgremove=1）
//
// 为什么单独写这一份：原来的 ?dgmerchant= 自检用的是 `element.click()`，
// 而 `element.click()` **绕过命中测试** —— 它不看你点的那一坐标上到底是谁。
// 所以「脚本里点得动、玩家点不动」这类问题它永远查不出来（README 里专门记过这条坑）。
//
// 这里把整条链路按真实指针走一遍：
//   找到按钮 → 量它的中心坐标 → `document.elementFromPoint()` 看那儿到底是谁
//   → 派发完整的 pointerdown / mousedown / pointerup / mouseup / click 序列。
// 任何一层被别的东西盖住、或者坐标算错，都会在这里暴露。
//
// 用法：node tools/diag2.mjs "http://127.0.0.1:5123/?dgremove=1" rt

(async () => {
  const log = (...a) => console.log('[d2] [rm]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };

  /** 这个坐标上最上面的元素是谁（真实命中测试） */
  const hitAt = (x, y) => {
    const n = document.elementFromPoint(x, y);
    if (!n) return null;
    return `${n.tagName.toLowerCase()}${n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : ''}`;
  };

  /** 完整指针序列（和真实鼠标事件顺序一致）。会先把目标滚进可视区。 */
  const realClick = (node, { scroll = true } = {}) => {
    if (scroll) {
      // 商店的货架是可滚动列表，服务那一行可能在可视区之外：
      // 这时 getBoundingClientRect 给的坐标在页面上是「空的」，elementFromPoint 会命中外层容器，
      // 派发过去的事件自然没人接 —— 第一版诊断就踩了这个，看着像「按钮点不动」。
      node.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
    const r = node.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    const opts = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: 1 };
    const top = document.elementFromPoint(x, y);
    // 命中的必须是按钮自己或它的后代 —— 光判「在祖先里」会把「被外层容器吞掉」误判成通过
    const hitSelf = !!top && (top === node || node.contains(top));
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const ev = type.startsWith('pointer')
        ? new PointerEvent(type, { ...opts, pointerId: 1, pointerType: 'mouse', isPrimary: true })
        : new MouseEvent(type, opts);
      (top ?? node).dispatchEvent(ev);
    }
    return { x, y, top, hitSelf, rect: { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) } };
  };

  /**
   * 等 #stage 稳定成「只剩一个、而且不是标题页」。
   *
   * 为什么必须等：`renderTitle()` 是 **async** 的（里面 await 了飞行的精灵图动画），
   * 而且它 `clear(host)` 之后要先 await、再 `host.append(screen)`。
   * 诊断脚本是在 boot 之后**立刻**跑的，于是：我这边已经把商店画好了，
   * 标题页那个还没跑完的 await 才 resolve，反手把 .title-screen 补在商店**上面** ——
   * `elementFromPoint` 于是命中的是标题页，看起来就像「按钮被盖住、点不动」。
   * 第一版诊断就是这么误报的（真凶是脚本跑得太早，不是商店）。
   */
  const settleScreens = async (ms = 6000) => {
    const t0 = Date.now();
    for (;;) {
      const screens = [...document.querySelectorAll('#stage > .screen')];
      const okNow = screens.length === 1 && !screens[0].classList.contains('title-screen');
      if (okNow) return true;
      if (Date.now() - t0 > ms) return false;
      await wait(80);
    }
  };

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { MERCHANTS } = await import('../src/data/merchants.js');
    const { generateMap } = await import('../src/data/mapgen.js');
    const { STAGE_BIOME } = await import('../src/data/balance.js');
    const { Game } = await import('../src/core/game.js');

    // 找一位确实卖「卡牌移除服务」的商人（字段是 `service: 'remove'`，
    // 第一版写成 m.services 数组，于是一个都没找到 —— 顺手记一笔）
    const withSvc = MERCHANTS.filter((m) => m.service === 'remove');
    log(`卖删卡服务的商人：${withSvc.length} / ${MERCHANTS.length} 位`);
    const one = withSvc[0] ?? MERCHANTS[0];
    const biome = one.biomes[0];
    const stage = Math.max(0, STAGE_BIOME.indexOf(biome));
    // 等 boot 的标题页渲染彻底收场，再动
    game.newRun(4242);
    await wait(300);
    const settled = await settleScreens();
    log(`  #stage 稳定：${settled ? '✓' : '✗（还有别的 screen 没走，下面的命中测试会失真）'}`);

    game.data.stage = stage;
    game.data.map = generateMap(stage, game.rng);
    game.data.nodeId = 'n99';
    game.startShop(one.id);
    game.data.gold = 800;
    ui.forceRerender();
    await wait(500);
    await settleScreens();

    const stock = game.shop.stock;
    const svcIdx = stock.findIndex((s) => s.kind === 'service');
    // 报价要**当场抄下来**：doRemove() 会把这个 stock 条目的 price 原地改掉，
    // 而 stock 是同一个数组引用 —— 拿它跟改过之后的自己比，永远相等。
    // （第一版诊断就是这么写的，于是「第二张更贵」被误报成了 bug。）
    const priceBefore = stock[svcIdx]?.price ?? 0;
    ok(svcIdx >= 0, `这家店（${game.shop.merchant?.name}）有删卡服务`, `报价 ${priceBefore} 金`);
    if (svcIdx < 0) {
      log(`RM_ERRORS=[没有删卡服务]`);
      log('RM_DONE');
      return;
    }

    const rows = [...document.querySelectorAll('.shop-item')];
    const svcRow = rows.find((row) => row.textContent.includes('卡牌移除服务'));
    ok(!!svcRow, '界面上找得到那张服务卡片');
    if (!svcRow) { log('RM_ERRORS=[界面没有服务卡片]'); log('RM_DONE'); return; }

    const buyBtn = [...svcRow.querySelectorAll('button')].find((b) => !b.disabled);
    ok(!!buyBtn, '服务卡片的购买按钮是可点的（没被 disable）');
    if (!buyBtn) { log('RM_ERRORS=[购买按钮不可点]'); log('RM_DONE'); return; }

    const deckBefore = game.data.deck.length;
    const goldBefore = game.data.gold;

    // ---- ① 用真实指针买服务 ----
    const click1 = realClick(buyBtn);
    log(`  购买按钮中心 (${click1.x}, ${click1.y}) 上的元素 = ${hitAt(click1.x, click1.y)}`);
    ok(click1.hitSelf, '购买按钮中心没有被别的东西盖住（真实命中测试）', `命中 = ${hitAt(click1.x, click1.y)}`);
    await wait(400);

    ok(game.data.gold === goldBefore - priceBefore, '买了服务之后金币真的扣了',
      `${goldBefore} → ${game.data.gold}（-${priceBefore}）`);
    ok(!!game.pendingRemove, '引擎里记下了「待删卡」状态');

    // ---- ② 选牌窗必须真的弹出来、而且卡片能点 ----
    const backdrop = document.querySelector('.modal-backdrop');
    ok(!!backdrop, '选牌窗弹出来了');
    if (!backdrop) { log('RM_ERRORS=[选牌窗没弹出来]'); log('RM_DONE'); return; }

    const pickCards = [...backdrop.querySelectorAll('.card-grid .card')];
    ok(pickCards.length > 0, '选牌窗里有卡片', `${pickCards.length} 张`);
    ok(!document.querySelector('#stage .modal-backdrop'), '选牌窗挂在 #modal-root 里（不在被重画的 #stage 里）');
    if (!pickCards.length) { log('RM_ERRORS=[选牌窗没有卡片]'); log('RM_DONE'); return; }

    // 选牌窗的层级：命中的元素必须落在弹窗内部
    const target = pickCards[0];
    const cardName = target.querySelector('.card-name')?.textContent?.trim() ?? '?';
    const r0 = target.getBoundingClientRect();
    const cx = Math.round(r0.left + r0.width / 2);
    const cy = Math.round(r0.top + r0.height / 2);
    const topEl = document.elementFromPoint(cx, cy);
    const insideModal = !!topEl && !!topEl.closest?.('.modal-backdrop');
    ok(insideModal, '卡片中心点命中的是**弹窗内部**的元素（弹窗没有被商店界面盖住）',
      `(${cx}, ${cy}) 命中 = ${hitAt(cx, cy)}`);
    const targetUid = target.dataset?.cardId ?? null;
    log(`  准备删掉「${cardName}」；卡组 ${deckBefore} 张，金币 ${goldBefore}`);

    // ---- ③ 真实指针点卡片 ----
    const click2 = realClick(target);
    ok(click2.hitSelf, '卡片中心没有被别的东西盖住', `命中 = ${hitAt(click2.x, click2.y)}`);
    await wait(600);

    const deckAfter = game.data.deck.length;
    ok(deckAfter === deckBefore - 1, `点一下真的把卡删掉了（卡组 ${deckBefore} → ${deckAfter}）`,
      `删掉的是「${cardName}」`);
    ok(!document.querySelector('.modal-backdrop'), '选牌窗自己关掉了');
    const toastEl = document.getElementById('toast');
    const toastText = toastEl?.textContent ?? '';
    ok(/移除/.test(toastText) && !toastEl.classList.contains('hidden'), '屏幕上有「移除了…」的提示',
      `toast = 「${toastText}」`);
    const ledger = document.querySelector('.shop-ledger')?.textContent?.replace(/\s+/g, ' ') ?? '';
    ok(ledger.includes(`${deckAfter} 张`), '商店顶部那行账目跟着更新了', `「${ledger}」`);

    // ---- ④ 连删：同一家店第二张更贵，而且还能删 ----
    const price2 = game.shop.stock[svcIdx]?.price ?? 0;
    ok(price2 > priceBefore, '同一家店删第二张的报价变贵了', `${priceBefore} → ${price2}`);
    const rows2 = [...document.querySelectorAll('.shop-item')];
    const svcRow2 = rows2.find((row) => row.textContent.includes('卡牌移除服务'));
    const buyBtn2 = [...(svcRow2?.querySelectorAll('button') ?? [])].find((b) => !b.disabled);
    if (buyBtn2) {
      realClick(buyBtn2);
      await wait(400);
      const pick2 = [...document.querySelectorAll('.modal-backdrop .card-grid .card')];
      ok(pick2.length > 0, '第二次买服务同样弹出了选牌窗');
      if (pick2.length) {
        const before2 = game.data.deck.length;
        realClick(pick2[0]);
        await wait(500);
        ok(game.data.deck.length === before2 - 1, '第二次也真的删掉了', `${before2} → ${game.data.deck.length}`);
      }
    } else {
      ok(false, '第二次买服务同样弹出了选牌窗', '第二次的购买按钮不可点');
    }

    // ---- ⑤ 取消要退钱 ----
    game.data.gold = 800;
    ui.forceRerender();
    await wait(300);
    const rows3 = [...document.querySelectorAll('.shop-item')];
    const svcRow3 = rows3.find((row) => row.textContent.includes('卡牌移除服务'));
    const buyBtn3 = [...(svcRow3?.querySelectorAll('button') ?? [])].find((b) => !b.disabled);
    if (buyBtn3) {
      const gold3 = game.data.gold;
      const price3 = game.shop.stock[svcIdx].price;
      realClick(buyBtn3);
      await wait(350);
      const closeBtn = [...document.querySelectorAll('.modal-head .btn, .modal-foot .btn')].find((b) => /关闭/.test(b.textContent));
      ok(!!closeBtn, '选牌窗有关闭按钮');
      if (closeBtn) {
        realClick(closeBtn);
        await wait(400);
        ok(game.data.gold === gold3, '关掉选牌窗会把钱退回来（不再白扣一笔）', `${gold3 - price3} → ${game.data.gold}`);
      }
    }

    // ---- ⑥ 把 12 位商人 + 卡组大小边界全扫一遍（引擎层，快） ----
    // 玩家报的是「根本删不掉」，而单独一位商人走通并不代表所有情况都行 ——
    // 卡组太小会被拒、有的商人不卖这项服务、价格高到买不起，都可能表现成「删不掉」。
    const { MERCHANTS: ALL } = await import('../src/data/merchants.js');
    const noService = [];
    const refused = [];
    const broken = [];
    for (const m of ALL) {
      const g = new Game({ seed: 31337 });
      g.newRun();
      g.data.stage = 0;
      g.data.map = generateMap(0, g.rng);
      g.data.nodeId = 'n77';
      g.data.deck = ['tackle', 'bite', 'harden', 'roost', 'double_kick', 'iron_defense'];
      g.startShop(m.id);
      g.data.gold = 999;
      const idx = g.shop.stock.findIndex((s) => s.kind === 'service');
      if (idx < 0) { noService.push(m.name); continue; }
      const price = g.shop.stock[idx].price;
      const before = g.data.deck.length;
      const r1 = g.buy(idx);
      if (!r1.needRemove) { broken.push(`${m.name}：买服务没进选牌流程`); continue; }
      const target = g.data.deck[0];
      const r2 = g.doRemove(target);
      if (!r2?.ok) { refused.push(`${m.name}：${r2?.text}`); continue; }
      if (g.data.deck.length !== before - 1) broken.push(`${m.name}：卡组 ${before} → ${g.data.deck.length}，没少`);
      if (g.data.gold !== 999 - price) broken.push(`${m.name}：金币 ${g.data.gold} ≠ ${999 - price}`);
      if (g.shop.stock[idx].price <= price) broken.push(`${m.name}：第二张没涨价`);
    }
    log(`  12 位商人：不卖删卡的 ${noService.length} 位（${noService.join('、') || '无'}）、`
      + `拒绝的 ${refused.length} 位、出错的 ${broken.length} 位`);
    ok(broken.length === 0, '每一位卖删卡服务的商人都能正常删掉一张', broken.slice(0, 3).join(' ｜ '));
    ok(refused.length === 0, '正常情况下没有商人会拒绝删卡', refused.slice(0, 3).join(' ｜ '));

    // 卡组大小的边界：4 张能删到 3 张；3 张 / 2 张时**收钱之前**就该被拦住
    const edge = [];
    for (const n of [4, 3, 2]) {
      const g = new Game({ seed: 808 });
      g.newRun();
      g.data.stage = 0;
      g.data.map = generateMap(0, g.rng);
      g.data.nodeId = 'n66';
      const pool = ['tackle', 'bite', 'harden', 'roost', 'double_kick'];
      g.data.deck = pool.slice(0, n);
      g.startShop('hippo_general');
      g.data.gold = 999;
      const idx = g.shop.stock.findIndex((s) => s.kind === 'service');
      const r1 = g.buy(idx);
      if (n < 4) {
        // 卡组太小：买的时候就该被拦住，钱一动不动、也不进选牌流程
        edge.push(`${n} 张 → 买服务被拦（${r1.text}），金币 ${g.data.gold}，needRemove=${!!r1.needRemove}`);
        if (r1.ok || r1.needRemove) edge.push(`  ✗ ${n} 张本该在收钱前就被拦住`);
        if (g.data.gold !== 999) edge.push(`  ✗ ${n} 张被拦了却还是扣了钱（${g.data.gold} ≠ 999）`);
        continue;
      }
      const goldAfterBuy = g.data.gold;
      const res = g.doRemove(g.data.deck[0]);
      edge.push(`${n} 张 → ${res?.ok ? '删成功' : '被拒（' + res?.text + '）'}，金币 ${goldAfterBuy} → ${g.data.gold}`);
      if (!res?.ok) edge.push(`  ✗ ${n} 张本该能删`);
      if (g.data.gold !== goldAfterBuy) edge.push(`  ✗ ${n} 张删成功却又动了钱（${goldAfterBuy} → ${g.data.gold}）`);
    }
    log('  卡组大小边界：');
    for (const e of edge) log('    ' + e);
    ok(!edge.some((e) => e.includes('✗')), '卡组剩 3 张时会在**收钱之前**就拦住（不再「付了钱又退回来」）');

    // 真的删不掉时不能谎报成功：把卡组里的 id 换成一个不在卡组里的，必须回 ok:false
    {
      const g = new Game({ seed: 606 });
      g.newRun();
      g.data.stage = 0;
      g.data.map = generateMap(0, g.rng);
      g.data.nodeId = 'n44';
      g.data.deck = ['tackle', 'bite', 'harden', 'roost', 'double_kick'];
      g.startShop('hippo_general');
      g.data.gold = 999;
      const idx = g.shop.stock.findIndex((s) => s.kind === 'service');
      g.buy(idx);
      const res = g.doRemove('dragon_claw');   // 真实存在、但不在卡组里的牌
      ok(res?.ok === false, '删不掉的牌必须回 ok:false（不能谎报「移除了」）',
        `对一张不在卡组里的牌调用 = ${JSON.stringify(res)}`);
    }
    // 删卡被拒（这次是「那张牌不在卡组里」）之后，关掉选牌窗必须把钱退回来，而且只退一次
    {
      const g = new Game({ seed: 909 });
      g.newRun();
      g.data.stage = 0;
      g.data.map = generateMap(0, g.rng);
      g.data.nodeId = 'n55';
      g.data.deck = ['tackle', 'bite', 'harden', 'roost'];
      g.startShop('hippo_general');
      g.data.gold = 999;
      const idx = g.shop.stock.findIndex((s) => s.kind === 'service');
      const price = g.shop.stock[idx].price;
      g.buy(idx);
      g.doRemove('dragon_claw');            // 被拒，pendingRemove 还在
      const r = g.refundRemove();           // 关窗时退钱
      ok(r.ok && g.data.gold === 999, '被拒之后关掉选牌窗只退一次钱（不会退两遍）',
        `${999 - price} → ${g.data.gold}（应回到 999）`);
      const second = g.refundRemove();
      ok(!second.ok, '重复退钱会被挡住（pendingRemove 已经清掉）');
    }

    if (fails.length) log(`RM_ERRORS=[${fails.join(' | ')}]`);
    else log('商店删卡（真实指针）自检：通过 ✓');
    log('RM_DONE');
  } catch (e) {
    log('RM_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' | ') : e));
    log('RM_DONE');
  }
})();
