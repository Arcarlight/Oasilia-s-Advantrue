// 通关记录 / 图鉴诊断（?dgcodex=1）。
//
//   node tools/diag2.mjs "http://127.0.0.1:5123/?dgcodex=1" rt
//   node tools/diag2.mjs "http://127.0.0.1:5123/?dgcodex=shot&what=enemy" rt   # 留屏截图
//
// 为什么需要它：这三块界面**全都能正常打开、也不报错**，但错法都很隐蔽 ——
// 记录里存了名字（切语言就定格）、图鉴漏了几只（按 biome 分节时静默丢掉）、
// 进度数字不动、标题页按钮点了没反应。所以这里量的是「数量对不对、状态对不对、
// 点了有没有反应」，而不是「有没有崩」。
(async () => {
  const log = (...a) => console.log('[d2] [codex]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { save } = await import('../src/core/save.js');
    const { CARDS } = await import('../src/data/cards.js');
    const { ENEMIES, ENEMY_BY_ID } = await import('../src/data/enemies.js');
    const { BIOMES } = await import('../src/data/balance.js');
    const params = new URLSearchParams(location.search);

    const q = (sel, root) => (root ?? document)?.querySelector?.(sel) ?? null;
    const qa = (sel, root) => {
      const r = root ?? document;
      return r?.querySelectorAll ? [...r.querySelectorAll(sel)] : [];
    };
    const click = (node) => { node?.dispatchEvent(new MouseEvent('click', { bubbles: true })); };
    const btnByText = (text, root = document) => qa('button', root).find((b) => b.textContent.includes(text));
    /** 最上面那一层弹窗（界面允许叠着开） */
    const topModal = () => qa('.modal-backdrop').pop() ?? null;
    /** 只关最上面一层（Esc 的行为）—— 关错层会让后面的断言在 null 上炸 */
    const closeTop = () => click(q('.modal-head button', topModal()));
    const closeModals = () => { for (const b of qa('.modal-head button')) click(b); };

    // 从干净的一台机器开始：这三块界面全靠跨局记录，残留数据会让断言变成「碰运气」
    localStorage.removeItem('oasis_desert_spirit_meta_v1');
    localStorage.removeItem('oasis_desert_spirit_save_v1');
    game.phase = 'title';
    ui.forceRerender();
    await wait(400);

    /**
     * 截图模式：摆好画面就收工，**不跑下面那套自检**。
     *
     * 为什么必须分开：截图脚本（tools/shot.mjs）用的是 `--virtual-time-budget`，
     * 虚拟时间会把所有 setTimeout 一口气跑完 —— 自检里几十个 await 加起来有好几秒，
     * 截图就会拍在自检半路上（第一次拍出来的三张全是同一个图鉴页）。
     */
    if (params.get('what')) {
      await shotMode();
      log(`（截图模式：${params.get('what')}${params.get('lang') ? ` / ${params.get('lang')}` : ''}）`);
      log('CODEX_DONE');
      return;
    }

    // ---------- ① 标题页上的三个入口 ----------
    log('① 标题页入口');
    const entries = qa('.title-codex .title-codex-btn');
    ok(entries.length === 3, '标题页有 3 个入口（记录 / 卡牌图鉴 / 敌人图鉴）', `实际 ${entries.length}`);
    const labels = entries.map((b) => q('.title-codex-label', b)?.textContent);
    ok(labels[0]?.includes('通关记录') && labels[1]?.includes('卡牌图鉴') && labels[2]?.includes('敌人图鉴'),
      '三个入口分别是 通关记录 / 卡牌图鉴 / 敌人图鉴', labels.join(' / '));
    ok(q('.title-codex-sub', entries[1])?.textContent === `0/${CARDS.length}`,
      '卡牌图鉴入口上带着进度（新档是 0）', q('.title-codex-sub', entries[1])?.textContent);
    ok(q('.title-codex-sub', entries[2])?.textContent === `0/${ENEMIES.length}`,
      '敌人图鉴入口上带着进度（新档是 0）', q('.title-codex-sub', entries[2])?.textContent);

    // ---------- ② 卡牌图鉴 ----------
    log('② 卡牌图鉴（标题页）');
    click(entries[1]);
    await wait(250);
    let modal = topModal();
    ok(!!modal, '点「卡牌图鉴」会打开一页');
    ok(q('.modal-head h3', modal)?.textContent.includes('卡牌图鉴'), '标题是卡牌图鉴');
    const grid = q('.modal-body .card-grid', modal);
    const cards = qa('.card', grid);
    ok(cards.length === CARDS.length, `一页列出全部 ${CARDS.length} 张卡`, `实际 ${cards.length}`);
    ok(qa('.card-unowned', grid).length === CARDS.length, '新档里每张卡都是「未获得」（压暗）');
    ok(qa('.sort-tab', modal).length === 5, '排序按钮齐（默认/威力/特殊效果/费用/稀有度）', `${qa('.sort-tab', modal).length} 个`);

    // 点开一张卡的详情
    click(cards[0]);
    await wait(200);
    ok(!!q('.card-detail'), '点卡牌会打开详情页');
    ok(qa('.modal-backdrop').length === 2, '详情页是叠在图鉴上面的第二层', `${qa('.modal-backdrop').length} 层`);
    closeModals();
    await wait(150);

    // ---------- ③ 敌人图鉴（新档：全是剪影） ----------
    log('③ 敌人图鉴（新档）');
    click(entries[2]);
    await wait(250);
    modal = topModal();
    ok(!!modal, '点「敌人图鉴」会打开一页');
    const dexCards = qa('.dex-card', modal);
    ok(dexCards.length === ENEMIES.length, `一页列出全部 ${ENEMIES.length} 只`, `实际 ${dexCards.length}`);
    ok(qa('.dex-card.new', modal).length === ENEMIES.length, '新档里每只都是剪影（.new）');
    ok(qa('.dex-card .dex-unknown', modal).length === ENEMIES.length, '剪影格子上是一个「?」');
    ok(qa('.dex-card-name', modal).every((n) => n.textContent.includes('？')), '没见过的名字是「？？？」');
    ok(!qa('.dex-card-name', modal).some((n) => n.textContent.includes('穿山鼠')), '剪影不泄露物种名');
    ok(qa('.dex-section', modal).length === Object.keys(BIOMES).length,
      `按 ${Object.keys(BIOMES).length} 张地图分节`, `${qa('.dex-section', modal).length} 节`);
    ok(qa('.dex-card .dex-no', modal).every((n) => /^#\d{4}$/.test(n.textContent)), '每只都带图鉴编号（#0027 这种）');
    ok(q('.codex-progress b', modal)?.textContent === `0 / ${ENEMIES.length}`, '进度写着 0 / 全部',
      q('.codex-progress b', modal)?.textContent);

    // 筛选
    log('④ 敌人图鉴的筛选');
    const tabs = qa('.sort-tab', modal);
    ok(tabs.length === 4, '有 4 个筛选（全部 / 已收录 / 未收录 / 已击败）', tabs.map((b) => b.textContent).join('/'));
    click(tabs[1]);   // 已收录
    await wait(120);
    ok(qa('.dex-card', modal).length === 0 && !!q('.dex-empty', modal), '新档点「已收录」是空的，并给出提示');
    click(tabs[0]);
    await wait(120);
    ok(qa('.dex-card', modal).length === ENEMIES.length, '切回「全部」又全都在');
    closeModals();
    await wait(150);

    // ---------- ⑤ 记录进度之后再打开：状态要跟着变 ----------
    log('⑤ 有进度之后（见过 / 击败过）');
    const seenId = ENEMIES[0].id;
    const slainId = ENEMIES.find((e) => e.tier === 'boss').id;
    save.noteEnemies([seenId]);
    save.noteEnemies([slainId], { slain: true });
    save.noteCards([CARDS[0].id]);
    ui.forceRerender();     // 标题页上的进度数字要跟着刷
    await wait(300);
    const entries2 = qa('.title-codex .title-codex-btn');
    ok(q('.title-codex-sub', entries2[1])?.textContent === `1/${CARDS.length}`, '标题页卡牌进度变成 1',
      q('.title-codex-sub', entries2[1])?.textContent);
    ok(q('.title-codex-sub', entries2[2])?.textContent === `2/${ENEMIES.length}`, '标题页敌人进度变成 2',
      q('.title-codex-sub', entries2[2])?.textContent);

    click(entries2[2]);
    await wait(250);
    modal = topModal();
    ok(qa('.dex-card.met', modal).length === 1, '「见过但没打赢」的那只是 .met', `${qa('.dex-card.met', modal).length}`);
    ok(qa('.dex-card.slain', modal).length === 1, '「打赢过」的那只是 .slain', `${qa('.dex-card.slain', modal).length}`);
    ok(qa('.dex-card .dex-slain', modal).length === 1, '打赢过的那只角上有一个 ✓');
    ok(qa('.dex-card-name', modal).some((n) => n.textContent === ENEMY_BY_ID[seenId].name),
      '见过的显示真实名字', ENEMY_BY_ID[seenId].name);
    // 点开见过的：要有台词与招式（详情页是**新的一层**，断言要查最上面那层）
    const known = qa('.dex-card', modal).find((n) => n.classList.contains('slain'));
    click(known);
    await wait(250);
    const detail = topModal();
    ok(!!q('.dex-detail-info', detail), '点开见过的宝可梦有详情页');
    ok(qa('.dex-moves .dex-move', detail).length > 0, '详情里列了招式',
      `${qa('.dex-moves .dex-move', detail).length} 个胶囊`);
    ok(qa('.dex-moves .dex-move.sig', detail).length > 0, '招牌招式单独标出来了',
      `${qa('.dex-moves .dex-move.sig', detail).length} 个`);
    ok(!!q('.dex-lines p', detail), '详情里有出场台词');
    ok(qa('.detail-chip', detail).length >= 4, '详情头部有编号 / 档位 / 地图 / 属性',
      qa('.detail-chip', detail).map((n) => n.textContent).join(' · '));
    // 没见过的点开：只能看到「还没遇见」那句，不能泄露台词与招式
    closeTop();
    await wait(150);
    const unknown = qa('.dex-card', modal).find((n) => n.classList.contains('new'));
    click(unknown);
    await wait(250);
    const locked = topModal();
    ok(!!q('.dex-locked', locked) && !q('.dex-lines', locked) && !q('.dex-moves', locked),
      '剪影点开只有「还没遇见」，不泄露台词和招式');
    closeModals();
    await wait(150);
    click(entries2[1]);
    await wait(250);
    modal = topModal();
    ok(qa('.card-unowned', modal).length === CARDS.length - 1, '拿到过的那张卡不再压暗',
      `未获得 ${qa('.card-unowned', modal).length} / ${CARDS.length}`);
    closeModals();
    await wait(150);

    // ---------- ⑥ 游戏内：地图页与战斗里都能开 ----------
    log('⑥ 游戏内入口');
    game.newRun(20260214);
    game.phase = 'map';
    ui.forceRerender();
    await wait(500);
    const mapBtn = btnByText('敌人图鉴', q('.map-actions') ?? document);
    ok(!!mapBtn, '地图底部有「敌人图鉴」按钮');
    click(mapBtn);
    await wait(250);
    ok(!!topModal() && !!q('.dex-card', topModal()), '地图上点得开敌人图鉴');
    closeModals();
    await wait(150);

    // 打一场精英，看 HUD 上的图标 + 快捷键
    game.startBattle('elite', 0, 'direct');
    await wait(600);
    const hudBtn = q('#btn-codex');
    ok(!!hudBtn && !q('#hud').classList.contains('hidden'), '战斗里 HUD 上有图鉴图标');
    const foeId = game.battle?.enemy?.id;
    ok((save.readMeta().seenEnemies ?? []).includes(foeId), '开打那一刻就记进了图鉴', String(foeId));
    click(hudBtn);
    await wait(250);
    modal = topModal();
    ok(!!modal && !!q('.dex-card', modal), 'HUD 图标能打开图鉴');
    ok(qa('.dex-card.met', modal).length >= 2, '刚才遇到的那只也是 .met', `${qa('.dex-card.met', modal).length} 只`);
    ok(qa('.dex-card.slain', modal).length === 1, '这一只还没打赢，不是 .slain');
    closeModals();
    await wait(150);
    // 快捷键 E：战斗里也要能开（打之前查对面会什么是这个界面最有用的时候）
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    await wait(250);
    ok(!!topModal(), '战斗中按 E 也能打开敌人图鉴');
    closeModals();

    // ---------- ⑦ 打完一局：真的写进记录 ----------
    log('⑦ 打完一局（输掉）写进通关记录');
    const b = game.battle;
    let guard = 0;
    while (b && !b.over && guard++ < 300) { b.endTurn(); b.takeEvents(); await wait(6); }
    ok(b?.over && b.winner !== 'player', '这局真的输了', `winner=${b?.winner} 回合=${b?.turn}`);
    game.finishBattle();
    await wait(300);
    const metaAfter = save.readMeta();
    const rec = metaAfter.history[0];
    ok(metaAfter.history.length === 1, '记录里多了一条', `${metaAfter.history.length} 条`);
    ok(rec?.win === false && rec.foe === foeId, '记的是这只怪、且标记为「止步」', `foe=${rec?.foe}`);
    ok(rec.deck.every((id) => CARDS.some((c) => c.id === id)), '记录里的卡组是卡牌 id，都能查到');

    game.phase = 'title';
    ui.forceRerender();
    await wait(350);
    const entries3 = qa('.title-codex .title-codex-btn');
    click(entries3[0]);
    await wait(250);
    modal = topModal();
    ok(!!modal && q('.modal-head h3', modal).textContent.includes('通关记录'), '标题页能打开通关记录');
    const rows = qa('.rec-row', modal);
    ok(rows.length === 1, '列表里有一条战绩', `${rows.length} 条`);
    ok(qa('.rec-row.down', modal).length === 1, '输掉的那条是 .down（止步）');
    ok(q('.rec-badge', modal)?.textContent.includes('止步'), '徽章写着「止步」', q('.rec-badge', modal)?.textContent);
    ok(qa('.rec-biomes .rec-biome', modal).length === 6, '列出了这一局走过的 6 张地图',
      `${qa('.rec-biomes .rec-biome', modal).length} 张`);
    ok(qa('.rec-biome', modal).some((n) => n.textContent.includes(BIOMES.desert.name)), '地图名按当前语言现查（跟着语言走）');
    const statVals = qa('.rec-stats .run-stat b', modal).map((n) => n.textContent);
    ok(statVals.length === 5, '顶部 5 个汇总数字', statVals.join(' / '));
    ok(statVals[0] === '1', '总场次 = 1', statVals[0]);

    // 看卡组
    const deckBtn = btnByText('看卡组', modal);
    ok(!!deckBtn, '每条记录都有「看卡组」按钮');
    click(deckBtn);
    await wait(250);
    ok(qa('.modal-backdrop').length === 2 && qa('.card', topModal()).length > 0,
      '点「看卡组」能翻出那一局的卡组', `${qa('.card', topModal()).length} 张`);
    closeTop();          // 只关这一层，记录页还留在屏幕上
    await wait(200);

    // 两步确认清空
    modal = topModal();
    const clearBtn = q('.rec-foot .btn-danger', modal);
    ok(!!clearBtn, '有「清空记录」按钮');
    click(clearBtn);
    await wait(120);
    ok(q('.rec-foot .btn-danger', modal)?.textContent.includes('再点一次'), '第一次点只是要求确认（不是直接清掉）');
    ok(qa('.rec-row', modal).length === 1, '第一次点还没有清掉');
    click(clearBtn);
    await wait(200);
    ok(qa('.rec-row', topModal()).length === 0 && !!q('.rec-empty', topModal()), '第二次点才真的清空，并显示空状态');
    closeModals();

    // ---------- ⑧ 换语言之后：记录与图鉴不能留下旧语言 ----------
    log('⑧ 切语言（记录与图鉴里的名字都是现查的）');
    const { changeLanguage } = await import('../src/ui/langswitch.js');
    const { currentLang } = await import('../src/core/i18n.js');
    // 先记下**中文**的名字（内容是原地改写的，切完语言这两个变量就只剩旧的写法了）
    const zhFoe = ENEMY_BY_ID[slainId].name;
    // 地图名要挑一张**中日写法不同**的来验（水晶洞窟在日语里也写「水晶洞窟」，
    // 拿它当判据会误报 —— 第一次跑就是这么红的）
    const pickedBiome = 'cliff';
    const zhBiome = BIOMES[pickedBiome].name;
    save.recordRun({
      at: Date.now() - 3600_000, win: true, seed: 4242, stage: 6, steps: 51, kills: 40, turns: 21,
      gold: 210, hp: 300, maxHp: 300, atk: 60, def: 40, agi: 20, luck: 12,
      deck: [CARDS[0].id, CARDS[1].id], biomes: ['desert', 'crystal', 'ruins', pickedBiome, 'fungal', 'night'], foe: slainId,
    });
    changeLanguage('ja');
    await wait(500);
    game.phase = 'title';
    ui.forceRerender();
    await wait(350);
    const entriesJa = qa('.title-codex .title-codex-btn');
    ok(q('.title-codex-label', entriesJa[1])?.textContent === 'カード図鑑', '标题页入口跟着切成日语',
      q('.title-codex-label', entriesJa[1])?.textContent);
    click(entriesJa[0]);
    await wait(250);
    modal = topModal();
    const jaFoe = ENEMY_BY_ID[slainId].name;      // 内容字段此刻已经是日语
    const jaBiome = BIOMES[pickedBiome].name;
    const rowText = qa('.rec-row', modal).map((n) => n.textContent).join(' ');
    ok(jaBiome !== zhBiome, '这一条断言用的地图名中日写法确实不同（否则它证明不了什么）', `${zhBiome} → ${jaBiome}`);
    ok(rowText.includes(jaFoe), '最后那只怪的名字是**按当前语言现查**的日语名', jaFoe);
    ok(!rowText.includes(zhFoe), '记录行里没有「冻结」下来的中文原名（存的是 id）', `不该出现「${zhFoe}」`);
    ok(rowText.includes(jaBiome) && !rowText.includes(zhBiome), '地图名同样是现查的（日语名在、中文名不在）',
      `${jaBiome} / 不该出现「${zhBiome}」`);
    closeModals();
    await wait(150);
    click(qa('.title-codex .title-codex-btn')[2]);
    await wait(300);
    modal = topModal();
    ok(qa('.dex-card-name', modal).some((n) => n.textContent === jaFoe),
      '敌人图鉴里的名字也跟着语言走', jaFoe);
    closeModals();

    // 切回中文，别把语言选择留给下一份诊断
    changeLanguage('zh');
    await wait(300);
    ok(currentLang() === 'zh', '语言切回中文');

    /**
     * 截图模式（函数声明会被提升，所以上面可以提前调用它）。
     * 造一份「玩过一阵」的档案：图鉴里有见过 / 击败 / 没见过三档，记录里有通关也有止步，
     * 然后按 `what` 打开对应的那一页留屏。
     */
    async function shotMode() {
      const what = params.get('what');
      // `&lang=ja|en`：截图前先切成那个语言（顺便验一下日 / 英排版）
      const wantLang = params.get('lang');
      if (wantLang) {
        const { changeLanguage: setLang } = await import('../src/ui/langswitch.js');
        setLang(wantLang);
        await wait(300);
      }
      const meta = save.readMeta();
      save.writeMeta({
        ...meta,
        // 终身计数器也要给上：标题页/记录页顶上那几个数是读它们的（不是从明细里数的），
        // 不给的话截图里会是一排 0，看着像坏了
        runs: 3, wins: 1, kills: 63, bestStage: 6, bestDistance: 9,
        seenCards: CARDS.slice(0, 40).map((c) => c.id),
        seenEnemies: ENEMIES.filter((e) => e.biome === 'desert' || e.biome === 'crystal').map((e) => e.id),
        slainEnemies: ENEMIES
          .filter((e) => ['gible', 'sandshrew', 'cacnea', 'druddigon_alpha', 'carbink_crystal'].includes(e.id))
          .map((e) => e.id),
      });
      save.recordRun({
        at: Date.now() - 86400_000 * 2, win: true, seed: 913, stage: 6, steps: 58, kills: 44, turns: 26,
        gold: 320, hp: 210, maxHp: 340, atk: 64, def: 44, agi: 22, luck: 14,
        deck: CARDS.slice(0, 22).map((c) => c.id), biomes: ['desert', 'crystal', 'ruins', 'fungal', 'cliff', 'night'], foe: 'zygarde',
      });
      save.recordRun({
        at: Date.now() - 3600_000 * 5, win: false, seed: 77, stage: 4, steps: 31, kills: 19, turns: 14,
        gold: 96, hp: 0, maxHp: 300, atk: 41, def: 30, agi: 18, luck: 10,
        deck: CARDS.slice(3, 17).map((c) => c.id), biomes: ['desert', 'ruins', 'fungal', 'storm', 'cliff', 'night'], foe: 'tyranitar_ruins',
      });
      game.phase = 'title';
      ui.forceRerender();
      await wait(300);
      const entries = qa('.title-codex .title-codex-btn');
      if (what === 'enemy') click(entries[2]);
      else if (what === 'card') click(entries[1]);
      else if (what === 'records') click(entries[0]);
      else if (what === 'changelog') {
        const btn = qa('.title-menu .btn').find((b) => b.textContent.includes('更新日志'));
        click(btn);
      } else if (what === 'map') { game.newRun(20260214); game.phase = 'map'; ui.forceRerender(); }
      else if (what === 'battle') { game.newRun(20260214); game.startBattle('elite', 0, 'direct'); }
      else if (what === 'enemy-detail') {
        click(entries[2]);
        await wait(200);
        click(qa('.dex-card.slain')[0]);
      }
      await wait(300);
    }

    if (fails.length) log(`CODEX_ERRORS=[${fails.join(' | ')}]`);
    else log('通关记录 / 图鉴自检：通过 ✓');
    log('CODEX_DONE');
  } catch (e) {
    log('CODEX_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 8).join(' | ') : e));
    log('CODEX_DONE');
  }
})();
