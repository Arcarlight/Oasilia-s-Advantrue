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
    log('DMG_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('DMG_DONE');
  }
})();
