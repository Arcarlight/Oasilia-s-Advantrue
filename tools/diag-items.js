// 诊断：手持道具的**界面**（?dgitems=1）。
//
// 上一版这里查的是「背包里的药水能不能点」，现在整条链路都换了（背包制 → 手持制），
// 所以整份重写。这里量的是**玩家真的能看见、能点到**的东西：
//   ① 手持面板：格子数 = heldMax()、格子上有道具的图、生效效果汇总列得出来；
//   ② 战斗外：使用型的「使用」按钮可点，点完血回、手上少一件；
//   ③ **战斗中：按钮禁用 + 写明「战斗中不能使用」**（用户点名：太 imba）；
//      引擎那一层也要拒绝（界面禁用只是第一道闸）
//   ④ 道具图鉴：标题页第 5 个入口能开、列出全部道具、没拿过的是 ？？？+ 压暗剪影、
//      拿到过的点开能看到效果与来路；
//   ⑤ 商人：有「卖掉手上的道具」那一栏，点了金币进账、手上少一件。
//
// 用法：node tools/diag2.mjs "http://127.0.0.1:5123/?dgitems=1" rt
(async () => {
  const log = (...a) => console.log('[d2] [it]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };
  const q = (sel, root) => (root ?? document)?.querySelector?.(sel) ?? null;
  const qa = (sel, root) => [...((root ?? document)?.querySelectorAll?.(sel) ?? [])];
  const click = (node) => node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const topModal = () => qa('.modal-backdrop').pop() ?? null;
  const closeModals = () => { for (const b of qa('.modal-head button')) click(b); };
  /** 打开手持面板（走界面上的入口；找不到按钮就退回直接调用，别让诊断因为入口改名而假红） */
  const openHeldPanel = async (game) => {
    const { showItems } = await import('../src/ui/overlays.js');
    showItems(game);
    await wait(250);
    return topModal();
  };

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { ITEMS } = await import('../src/data/items.js');
    const { itemSellPrice } = await import('../src/core/game.js');
    const { save } = await import('../src/core/save.js');

    // 干净的一台机器：seenItems 会直接影响图鉴那几条断言
    localStorage.removeItem('oasis_desert_spirit_meta_v1');
    localStorage.removeItem('oasis_desert_spirit_save_v1');

    log('① 手持面板（战斗外）');
    game.phase = 'title';
    ui.forceRerender();
    await wait(300);
    game.newRun(20260101);
    await wait(300);
    let useItem = null;
    {
      const items = Object.values(ITEMS);
      useItem = items.find((i) => i.kind === 'use' && i.use?.healPct);
      const holdItem = items.find((i) => i.kind === 'hold');
      game.data.held = [useItem.id, holdItem.id];
      game.invalidateMods();
      game.data.hp = Math.round(game.data.maxHp * 0.4);
      game.phase = 'map';
      ui.forceRerender();
      await wait(300);

      const m = await openHeldPanel(game);
      ok(!!m && !!q('.held-slots', m), '手持面板能打开，里面有一排格子');
      const slots = qa('.held-slot', m);
      ok(slots.length === game.heldMax(), '格子数 = 手持栏上限', `${slots.length} 个（上限 ${game.heldMax()}）`);
      ok(qa('.held-slot-art', m).length === 2, '手上的两件都有图（不是空白方块）', `${qa('.held-slot-art', m).length} 张图`);
      ok(!!q('.held-active', m), '「现在生效的持有效果」汇总列出来了',
        qa('.held-chip', m).map((n) => n.textContent).join(' / ') || '（这件东西没有持有效果）');

      // ② 战斗外使用
      const hp0 = game.data.hp;
      const row = qa('.held-item', m).find((r) => r.textContent.includes(useItem.name));
      const useBtn = row ? qa('button', row).find((b) => b.textContent.includes('使用')) : null;
      ok(!!useBtn && !useBtn.disabled, '战斗外：「使用」按钮可点', useItem.name);
      click(useBtn);
      await wait(250);
      ok(game.data.hp > hp0, '点下去血真的回了', `${hp0} → ${game.data.hp}`);
      ok(!game.data.held.includes(useItem.id), '用掉之后从手上消失');
      closeModals();
      await wait(200);
    }

    log('② 战斗中：不能使用');
    {
      game.newRun(20260102);
      await wait(200);
      game.data.held = [];
      game.invalidateMods();
      game.giveItem(useItem.id, 1);
      game.startBattle('mob', 0, 'direct');
      await wait(1400);
      const m = await openHeldPanel(game);
      const row = qa('.held-item', m).find((r) => r.textContent.includes(useItem.name));
      const btn = row ? qa('button', row).find((b) => b.textContent.includes('使用')) : null;
      ok(!!btn, '战斗中也能打开手持面板看到那件东西');
      ok(!!btn?.disabled, '但「使用」按钮是禁用的');
      const tip = btn?.dataset?.tip ?? '';
      ok(/战斗中不能使用/.test(tip), '悬停说明写明「战斗中不能使用」', tip);
      const res = game.useItem(useItem.id);
      ok(res?.ok === false, '引擎层同样拒绝（换任何入口都绕不过去）', res?.text);
      closeModals();
      await wait(200);
    }

    log('③ 道具图鉴');
    {
      game.phase = 'title';
      ui.forceRerender();
      await wait(400);
      const entries = qa('.title-codex .title-codex-btn');
      ok(entries.length === 5, '标题页有 5 个入口', String(entries.length));
      const labels = entries.map((b) => q('.title-codex-label', b)?.textContent);
      const idx = labels.indexOf('道具图鉴');
      ok(idx >= 0, '其中一个是道具图鉴', labels.join(' / '));
      click(entries[idx]);
      await wait(400);
      const m = topModal();
      const cards = qa('.item-card', m);
      ok(cards.length === Object.keys(ITEMS).length, '一页列出全部道具', `${cards.length} 件`);
      const unknown = qa('.item-codex-art.silhouette', m);
      ok(unknown.length > 0, '还没拿过的是**压暗剪影**', `${unknown.length} 件没拿过`);
      const got = qa('.item-card.got', m);
      ok(got.length >= 1, '拿到过的显示成已获得', `${got.length} 件已获得`);
      ok(qa('.item-card.new .dex-card-name', m).every((n) => n.textContent.includes('？')),
        '没拿过的名字是「？？？」');
      ok(!qa('.item-card.new .dex-card-name', m).some((n) => n.textContent.includes(useItem.name)),
        '没拿过的不泄露名字');
      if (got.length) {
        click(got[0]);
        await wait(350);
        const d = topModal();
        ok(!!q('.item-detail-art', d), '详情页有道具的大图');
        ok(qa('.detail-row', d).length >= 1, '列出了持有效果 / 使用效果',
          qa('.detail-row', d).map((n) => n.textContent).join(' ｜ ').slice(0, 70));
        ok(!!q('.item-src', d), '写明了来路与价钱');
        closeModals();
        await wait(200);
      }
      closeModals();
      await wait(200);
    }

    log('④ 商人：卖掉手上的道具');
    {
      game.newRun(20260103);
      await wait(250);
      const it = Object.values(ITEMS).find((i) => i.price >= 60);
      game.data.held = [it.id];
      game.invalidateMods();
      game.startShop();
      await wait(500);
      const sellBox = q('.shop-sell');
      ok(!!sellBox, '商店里有「卖掉手上的道具」那一栏');
      const row = qa('.shop-sell-item', sellBox).find((n) => n.textContent.includes(it.name));
      ok(!!row, '手上有那件东西就会出现在可卖列表里', it.name);
      const gold0 = game.data.gold;
      const sellBtn = row ? qa('button', row)[0] : null;
      ok(!!sellBtn, '有卖出按钮（上面写着卖价）', sellBtn?.textContent?.trim());
      click(sellBtn);
      await wait(300);
      ok(game.data.gold === gold0 + itemSellPrice(it), '金币按售价 40% 进账',
        `${gold0} → ${game.data.gold}（该 +${itemSellPrice(it)}）`);
      ok(!game.data.held.includes(it.id), '卖掉之后手上少一件');
    }

    if (fails.length) log(`IT_ERRORS=[${fails.join(' | ')}]`);
    else log('手持道具自检：通过 ✓');
    log('IT_DONE');
  } catch (e) {
    log('IT_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e));
    log('IT_DONE');
  }
})();
