// 内容预览：用 ?dgpreview=<slug> 直接和指定物种打一场，方便截图核对新加的敌人（也用来验精灵图）。
// 做法是把 rng.pick 临时改成「只要池子里有它就选它」。
//
// ?dgpreview=<slug>[&tier=boss|elite|normal|mob][&stage=N]
//
// 注意（曾经坏过）：地图必须切到**这个物种所在的那张图**，否则池子里根本没有它、
// 预览会静默退化成「随便打一只」（`?dgpreview=druddigon` 实际打的是青绵鸟）。
// 以前这里用的是写死的 6 张老地图顺序，4 张新地图（遗迹 / 菌林 / 雷暴 / 水晶）
// 一律 indexOf = -1 → 不切图。现在按 content/biomes.json 的 slots 现查。
(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const params = new URLSearchParams(location.search);
    const slug = params.get('dgpreview');
    const wantTier = params.get('tier');
    const game = window.__oasis;
    const ui = window.__oasisUI;
    if (!slug) { log('缺少 ?dgpreview=<slug>'); return; }
    game.newRun(20240918);
    await wait(400);

    const { ENEMIES } = await import('/src/data/enemies.js');
    const { BIOME_SLOTS, BIOMES } = await import('/src/data/balance.js');
    const { generateMap } = await import('/src/data/mapgen.js');
    const candidates = ENEMIES.filter((e) => e.slug === slug && (!wantTier || e.tier === wantTier));
    if (!candidates.length) { log(`没有这个敌人: ${slug}${wantTier ? ' / ' + wantTier : ''}`); return; }
    const def = candidates[0];

    const origPick = game.rng.pick.bind(game.rng);
    game.rng.pick = (arr) => (Array.isArray(arr) ? arr.find((x) => x && x.slug === slug) : null) ?? origPick(arr);

    // 这张图能在第几章出现（没登记就退回第 1 章）
    const stage = Number(params.get('stage') ?? (BIOME_SLOTS[def.biome] ?? [0])[0]);
    game.data.stage = stage;
    game.data.map = generateMap(stage, game.rng, def.biome);
    game.data.nodeId = null;
    game.data.hp = game.data.maxHp;
    game.data.battleDeck = null;
    game.data.floor = 2;   // 往章内深处走一点：深度会影响数值，也顺便换个 BGM 段
    const kind = def.tier === 'boss' ? 'boss' : def.tier === 'elite' ? 'elite' : 'normal';
    game.startBattle(kind, 0);
    await wait(300);
    const got = game.battle?.enemy;
    log(`预览 ${def.name}（${def.slug}，${def.tier} / ${BIOMES[def.biome]?.name ?? def.biome} 第 ${stage + 1} 章，kind=${kind}）`);
    log(`实际敌人 = ${got?.name}（${got?.slug}）${got?.slug === slug ? '' : '  ⚠ 不是请求的那一只！'}`);
    log('PREVIEW_READY');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('PREVIEW_READY');
  }
})();
