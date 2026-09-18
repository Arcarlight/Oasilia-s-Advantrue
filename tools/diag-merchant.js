// 商人诊断（由 tools/shot.mjs / diag2.mjs 通过 ?dgmerchant=... 加载）
//   ?dgmerchant=1            列出所有商人 + 每个地图会出摊的人 + 实测货架与价格
//   ?dgmerchant=<商人id>      直接把商店摆在这一位商人面前（截图用）
//   ?dgmerchant=<地图key>     随便挑该地图的一位商人（截图用）
// 检查点：① 每张地图都有商人；② 同一个节点挑到的是同一位（稳定）；③ 价格/货架符合这位商人的设定。
(async () => {
  const log = (...a) => console.log('[d2] [dmg]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { MERCHANTS, merchantsFor, pickMerchant } = await import('/src/data/merchants.js');
    const { generateMap } = await import('/src/data/mapgen.js');
    const { STAGE_BIOME } = await import('/src/data/balance.js');
    const want = new URLSearchParams(location.search).get('dgmerchant') || '1';

    log(`注册商人 ${MERCHANTS.length} 位`);
    for (const b of STAGE_BIOME) {
      const list = merchantsFor(b);
      log(`  ${b.padEnd(7)} ${list.length} 位：${list.map((m) => m.name).join('、')}`);
    }
    // ① 每张地图都要有人
    const empty = STAGE_BIOME.filter((b) => merchantsFor(b).length === 0);
    log(empty.length ? `  ✗ 没有商人的地图：${empty.join(',')}` : '  ✓ 每张地图都有商人');
    // ② 稳定性：同一节点两次挑到同一位，不同节点有变化
    const a1 = pickMerchant('tide', '3:n12'), a2 = pickMerchant('tide', '3:n12');
    const picks = new Set(['n1', 'n2', 'n3', 'n4', 'n5', 'n6'].map((n) => pickMerchant('night', `5:${n}`)?.id));
    log(`  稳定性：同节点两次 = ${a1?.id === a2?.id ? '一致 ✓' : '不一致 ✗'}；6 个不同节点挑到 ${picks.size} 种商人`);

    // ③ 逐个商人实测货架（临时把商店摆到他面前）
    let target = null;
    if (want !== '1') {
      target = MERCHANTS.find((m) => m.id === want) ?? merchantsFor(want)[0] ?? null;
      if (!target) log(`  ✗ 没找到商人 ${want}`);
    }
    const one = target ?? MERCHANTS[0];
    const biome = one.biomes[0];
    const stage = Math.max(0, STAGE_BIOME.indexOf(biome));
    game.newRun(1234);
    game.data.stage = stage;
    game.data.map = generateMap(stage, game.rng);
    game.data.nodeId = 'n99';
    game.startShop();
    log(`  生成器自动挑到：${game.shop.merchant?.name ?? '(无)'}（${biome}）`);
    if (target) {
      // 注意要在生成货架**之前**换人，否则货架还是上一位的（这个坑截图时踩过）
      game.leaveShop();
      game.startShop(target.id);
      ui.forceRerender();
      await wait(600);
    }
    const m = game.shop.merchant;
    const cards = game.shop.stock.filter((s) => s.kind === 'card');
    const items = game.shop.stock.filter((s) => s.kind === 'item');
    const svc = game.shop.stock.find((s) => s.kind === 'service');
    log(`  当前摊位：${m.name} · ${m.role} · ${biome}`);
    log(`    卡牌 ${cards.length} 张（${cards.map((c) => c.name + c.price).join(' / ')}）`);
    log(`    道具 ${items.length} 件（${items.map((i) => i.name + i.price).join(' / ')}）`);
    log(`    服务：${svc ? svc.name + ' ' + svc.price + ' 金' : '无'}`);
    log(`    脸图：assets/portraits/${m.slug}/${m.emotion}.png（找不到会回退 Normal）`);
    const img = document.querySelector('.merchant-illo img.portrait');
    log(`    界面上头像：${img ? '已渲染 ' + img.naturalWidth + 'x' + img.naturalHeight : '（还没有，可能在等图片加载）'}`);

    // ---- 删卡服务：这是这一版唯一的「精简卡组」手段，界面上必须真的能走完流程 ----
    // 实测四件事：买到 → 弹选牌窗 → 选一张真的删掉且报价上涨；再买一次取消 → 退钱。
    if (svc) {
      // 玩家开局只有 60 金，而删卡服务要 45~100 金 —— 先给够钱再测（不然按钮是禁用的）
      game.data.gold = Math.max(game.data.gold, 600);
      ui.forceRerender();
      await wait(400);
      const idx = game.shop.stock.findIndex((s) => s.kind === 'service');
      const deck0 = game.data.deck.length;
      const gold0 = game.data.gold;
      const price1 = game.shop.stock[idx].price;
      const buyBtn = [...document.querySelectorAll('.shop-item')]
        .find((row) => row.textContent.includes('卡牌移除服务'))?.querySelector('button');
      if (!buyBtn) { log('  ✗ 货架上找不到删卡服务的购买按钮'); log('DMG_DONE'); return; }
      buyBtn.click();
      await wait(300);
      const picker = [...document.querySelectorAll('.modal-head h3')].find((h) => h.textContent.includes('移除'));
      log(`  买到删卡服务：金币 ${gold0} → ${game.data.gold}（-${price1}）；选牌窗＝${picker ? '已弹出' : '没弹出 ✗'}`);
      const firstCard = document.querySelector('.modal-backdrop .card-grid .card');
      if (firstCard) {
        firstCard.click();
        await wait(300);
        log(`  选了一张：卡组 ${deck0} → ${game.data.deck.length} 张；这家店下一张报价 ${game.shop.stock[idx].price} 金`);
      } else {
        log('  ✗ 选牌窗里没有卡面');
      }
      // 再买一次然后关掉弹窗：钱要退回来
      const goldBefore = game.data.gold;
      buyBtn.click();
      await wait(250);
      const closeBtn = [...document.querySelectorAll('.modal-foot .btn, .modal-head .btn')].find((b) => /关闭/.test(b.textContent));
      closeBtn?.click();
      await wait(250);
      log(`  取消删卡：金币 ${goldBefore} → ${game.data.gold}（${game.data.gold === goldBefore ? '退回成功 ✓' : '没退 ✗'}）`);
    }
    log('DMG_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('DMG_DONE');
  }
})();
