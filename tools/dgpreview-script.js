// 内容预览：用 ?dgpreview=<slug> 直接和指定物种打一场，方便截图核对新加的敌人。
// 做法是把 rng.pick 临时改成「只要池子里有它就选它」。
(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const slug = new URLSearchParams(location.search).get('dgpreview');
    const game = window.__oasis;
    const ui = window.__oasisUI;
    if (!slug) { log('缺少 ?dgpreview=<slug>'); return; }
    game.newRun(20240918);
    await wait(400);

    const origPick = game.rng.pick.bind(game.rng);
    game.rng.pick = (arr) => (Array.isArray(arr) ? arr.find((x) => x && x.slug === slug) : null) ?? origPick(arr);

    // 找到这个物种在哪个 biome，先把地图切过去（不然 poolFor 里没它）
    const { ENEMIES } = await import('/src/data/enemies.js');
    const def = ENEMIES.find((e) => e.slug === slug);
    if (!def) { log('没有这个敌人: ' + slug); return; }
    const { generateMap, STAGE_BIOME } = await import('/src/data/mapgen.js').catch(() => ({}));
    const stageOrder = ['desert', 'canyon', 'forest', 'tide', 'cliff', 'night'];
    const stage = stageOrder.indexOf(def.biome);
    if (stage > 0) {
      game.data.stage = stage;
      game.data.map = (await import('/src/data/mapgen.js')).generateMap(stage, game.rng);
      game.data.nodeId = null;
    }
    game.data.hp = game.data.maxHp;
    game.data.battleDeck = null;
    game.startBattle('normal', 0);
    log(`预览 ${def.name}（${def.slug}，${def.tier} / ${def.biome}）→ 实际敌人 = ${game.battle?.enemy?.name}`);
    log('PREVIEW_READY');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('PREVIEW_READY');
  }
})();
