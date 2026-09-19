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
    const { MERCHANTS, merchantsFor, pickMerchant } = await import('../src/data/merchants.js');
    const { generateMap } = await import('../src/data/mapgen.js');
    const { STAGE_BIOME } = await import('../src/data/balance.js');
    const want = new URLSearchParams(location.search).get('dgmerchant') || '1';
    /**
     * 截图模式（`?dgmerchant=<id>&shot=1`）：只把商店摆到屏幕上，不跑「删卡服务」那段流程。
     * 那段流程会点开选牌窗、再关掉，最后停在「取消删卡」的提示上 ——
     * 拍出来是一块空屏（踩过一次），所以截图时跳过它。
     */
    const SHOT = new URLSearchParams(location.search).has('shot');

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
    if (svc && !SHOT) {
      // 玩家开局只有 60 金，而删卡服务要 45~100 金 —— 先给够钱再测（不然按钮是禁用的）
      game.data.gold = Math.max(game.data.gold, 600);
      ui.forceRerender();
      await wait(400);
      const idx = game.shop.stock.findIndex((s) => s.kind === 'service');
      const deck0 = game.data.deck.length;
      const gold0 = game.data.gold;
      const price1 = game.shop.stock[idx].price;
      const ledger0 = document.querySelector('.shop-ledger')?.textContent ?? '(没有顶部那行 ✗)';
      const buyBtn = [...document.querySelectorAll('.shop-item')]
        .find((row) => row.textContent.includes('卡牌移除服务'))?.querySelector('button');
      if (!buyBtn) { log('  ✗ 货架上找不到删卡服务的购买按钮'); log('DMG_DONE'); return; }
      buyBtn.click();
      await wait(300);
      const picker = [...document.querySelectorAll('.modal-head h3')].find((h) => h.textContent.includes('移除'));
      log(`  买到删卡服务：金币 ${gold0} → ${game.data.gold}（-${price1}）；选牌窗＝${picker ? '已弹出' : '没弹出 ✗'}`);
      log(`  顶部账目（买之前）：${ledger0}`);
      let flowOk = false;
      const firstCard = document.querySelector('.modal-backdrop .card-grid .card');
      if (firstCard) {
        firstCard.click();
        await wait(400);
        const toastEl = document.getElementById('toast');
        const visible = !!toastEl && !toastEl.classList.contains('hidden') && toastEl.textContent.length > 0;
        log(`  选了一张：卡组 ${deck0} → ${game.data.deck.length} 张；这家店下一张报价 ${game.shop.stock[idx].price} 金`);
        // 关键：玩家必须**看得见**结果（以前提示写在被重画掉的旧节点上，等于什么都没发生）
        log(`  结果提示：${visible ? `「${toastEl.textContent}」` : '（没弹 ✗）'}`);
        log(`  顶部账目（删之后）：${document.querySelector('.shop-ledger')?.textContent ?? '(没有 ✗)'}`);
        flowOk = game.data.deck.length === deck0 - 1 && visible;
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
      log(`  删卡流程自检：${flowOk ? '通过 ✓（卡组真的变短 + 有可见提示）' : '失败 ✗'}`);
    }
    // ---- 货架行的**底色**（用户反馈：「商店里的卡牌没有底色」）----
    /**
     * 判据分三层，从弱到强：
     *   ① 每一行都带 rarity-* 类（道具 / 服务按普通档）—— 没有类的行会走另一套默认样式；
     *   ② 行上的纸色变量必须**等于卡面**的纸色（临时造一张 `.card.card-x` 读同一批变量：
     *      这样验的是「同一份色号」，而不是把十六进制抄进断言里）；
     *   ③ 计算出来的 background-image 里要有**不透明**的色标（rgb(...) 而不是 rgba(...,.5)）——
     *      老写法就是一层半透明的白→褐渐变压在米黄面板上，等于没上色。
     * 真实像素另有截图核对（用 System.Drawing 采样行内与面板底色对比，见 README 那条排查记录）。
     */
    {
      const rows = [...document.querySelectorAll('.shop-item')];
      const noClass = rows.filter((r) => !/rarity-(common|uncommon|rare|epic)/.test(r.className));
      log(`  货架行 ${rows.length} 行；${noClass.length ? `✗ ${noClass.length} 行没有 rarity-* 类` : '✓ 每行都有 rarity-* 类'}`);
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:-9999px;width:10px;height:10px';
      document.body.append(probe);
      const mismatch = [];
      const translucent = [];
      const seen = new Set();
      for (const row of rows) {
        const rarity = (row.className.match(/rarity-(\w+)/) ?? [])[1] ?? 'common';
        seen.add(rarity);
        probe.className = `card card-${rarity}`;
        const want = getComputedStyle(probe).getPropertyValue('--card-paper-1').trim();
        const cs = getComputedStyle(row);
        const got = cs.getPropertyValue('--card-paper-1').trim();
        if (!want || want !== got) mismatch.push(`${rarity}: 行 ${got || '(空)'} vs 卡面 ${want || '(空)'}`);
        // 底色是 background-image 里的最后一条渐变：它的色标必须是不透明的 rgb(...)
        const layers = cs.backgroundImage.split(/,(?![^(]*\))/);
        const base = layers[layers.length - 1] ?? '';
        if (!base.includes('rgb(')) translucent.push(`${rarity}: ${base.slice(0, 70)}`);
      }
      probe.remove();
      log(`  ${mismatch.length ? `✗ 行与卡面的纸色不一致：${mismatch.join('；')}` : '✓ 行的纸色 = 卡面的纸色（同一份变量）'}`);
      log(`  ${translucent.length ? `✗ 底色是半透明的（等于没上色）：${translucent.join('；')}` : '✓ 底色是不透明的纸色（不是半透明叠加）'}`);
      log(`  这一摊出现的稀有度：${[...seen].join('、')}`);
      // 行内取样点（截图核对像素用）：行的右上角一小块永远是空白（卡名靠左、AP 标在名字后面），
      // 拿它和面板背景比一下就知道底色到底上没上去。
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        const rarity = (row.className.match(/rarity-(\w+)/) ?? [])[1] ?? 'common';
        const name = row.querySelector('h4 span:nth-child(2)')?.textContent ?? '?';
        log(`    取样 ${rarity.padEnd(8)} ${name.padEnd(7)} @ ${Math.round(r.right - 40)},${Math.round(r.top + 14)}`);
      }
    }

    log('DMG_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('DMG_DONE');
  }
})();
