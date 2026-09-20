// 章节地图诊断（?dgmap=1）：随机场景系统上线后，这里盯着几件容易悄悄坏掉的事。
//
//   node tools/diag2.mjs "http://127.0.0.1:5123/?dgmap=1" rt
//   node tools/diag2.mjs "http://127.0.0.1:5123/?dgmap=1&biome=crystal" rt
//
// 为什么需要它：中间 4 章现在会**随机换成别的地图**（content/biomes.json 的 slots），
// 于是两件事必须有人盯 —— ① 章数标签不能再写死在数据里（否则水晶洞窟当第 3 章时会写「第 1 章」）；
// ② 每张地图都要真的有敌人可用（新地图漏配一个档位，进那一章就崩）。
(async () => {
  const log = (...a) => console.log('[d2] [map]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { BIOMES, BIOME_SLOTS, BIOME_BGM } = await import('../src/data/balance.js');
    const { ENEMIES } = await import('../src/data/enemies.js');
    const params = new URLSearchParams(location.search);
    const wantBiome = params.get('biome');
    const wantStage = Number(params.get('stage') ?? 0);

    // 这条诊断经常不带 scene 参数直接用（`?dgmap=1`）：那就自己把一局和地图屏准备好
    if (!game.data) {
      game.newRun(30303);
      if (!params.get('scene')) { game.phase = 'map'; ui.forceRerender(); }
      await wait(200);
    }
    if (wantBiome || wantStage) {
      const { generateMap } = await import('../src/data/mapgen.js');
      game.data.stage = wantStage;
      game.data.map = generateMap(wantStage, game.rng, wantBiome || game.data.biomes?.[wantStage]);
      if (!params.get('scene')) { game.phase = 'map'; ui.forceRerender(); }
      await wait(200);
    }

    // 等界面落定
    const t0 = Date.now();
    for (;;) {
      const scr = document.querySelector('#stage > .map-screen');
      if (scr) break;
      if (Date.now() - t0 > 8000) break;
      await wait(80);
    }

    const biomeKey = game?.data?.map?.biome;
    const biome = BIOMES[biomeKey];
    ok(!!biome, `当前地图是已知地图`, `${biomeKey}（${biome?.name ?? '?'}）`);
    if (wantBiome) ok(biomeKey === wantBiome, `?biome=${wantBiome} 生效了`, biomeKey);

    log('① 章数标签');
    // 这个诊断常常挂在 `?scene=battle&dgmap=1` 上用（顺便验一下战斗里读到的是哪张图），
    // 那种情况下屏幕上根本没有地图 —— 跳过 DOM 那几条，别报「假失败」。
    const onMap = !!document.querySelector('.map-screen');
    if (!onMap) {
      log('  · 当前不在地图屏（没有 .map-screen），跳过 DOM 断言');
    } else {
      const chapterEl = document.querySelector('.map-screen .map-chapter');
      const chapterText = chapterEl?.textContent ?? '';
      ok(chapterEl != null, '地图头部有章数那一行');
      ok(chapterText === `第 ${wantStage + 1} 章`, '章数按**当前章节序号**算（不是写在地图数据里的）',
        `显示「${chapterText}」，当前第 ${wantStage + 1} 章`);
      ok(!/第[一二三四五六]章/.test(chapterText), '没有退回地图自带的「第 N 章」标签');
    }

    log('② 地图名字与简介跟着地图走');
    if (onMap) {
      const nameText = document.querySelector('.map-screen .map-name')?.textContent ?? '';
      const descText = document.querySelector('.map-screen .map-desc')?.textContent ?? '';
      ok(nameText.includes(biome.name), '地图名渲染出来了', nameText.trim());
      ok(descText.trim().length > 6, '简介渲染出来了', descText.trim().slice(0, 24));
    } else {
      ok(biome.name?.length > 0 && biome.desc?.length > 6, '地图数据里有名字与简介', `${biome.name}`);
    }

    log('③ 每张地图的敌人档位都齐（缺一个档位，进那一章就会崩）');
    const tiers = ['mob', 'normal', 'elite', 'boss'];
    const gaps = [];
    for (const key of Object.keys(BIOMES)) {
      for (const tier of tiers) {
        const n = ENEMIES.filter((e) => e.biome === key && e.tier === tier).length;
        if (n === 0) gaps.push(`${key}/${tier}`);
      }
    }
    ok(gaps.length === 0, `${Object.keys(BIOMES).length} 张地图 × 4 个档位都有敌人`, gaps.join('、') || '无缺口');
    const noSlot = Object.keys(BIOMES).filter((k) => !(BIOME_SLOTS[k] ?? []).length);
    ok(noSlot.length === 0, '每张地图都声明了 slots（能出现在第几章）', noSlot.join('、') || '全部有');

    log('④ 章节候选池');
    const lines = [];
    for (let s = 0; s < 6; s += 1) {
      const pool = Object.keys(BIOMES).filter((k) => (BIOME_SLOTS[k] ?? []).includes(s));
      lines.push(`第${s + 1}章:${pool.length}`);
      ok(pool.length >= 1, `第 ${s + 1} 章有地图可用`, pool.join('/'));
    }
    log(`  ${lines.join('  ')}`);
    const mid = [1, 2, 3, 4].map((s) => Object.keys(BIOMES).filter((k) => (BIOME_SLOTS[k] ?? []).includes(s)).length);
    ok(mid.every((n) => n >= 2), '中间 4 章**每章都有 2 张以上**可抽（不然「随机」就是摆设）', `候选数 ${mid.join('/')}`);

    log('⑤ 借曲子的新地图');
    for (const [k, src] of Object.entries(BIOME_BGM)) {
      ok(!!BIOMES[src], `${k} 借的是已知地图 ${src} 的曲子`);
    }

    log('⑥ 本局抽到的场景序列');
    const seq = game?.data?.biomes ?? [];
    ok(seq.length === 6, '一局有 6 章的场景序列', seq.join(' → '));
    ok(seq[0] === 'desert' && seq[5] === 'night', '首章固定沙漠、终章固定夜砂墓原', `${seq[0]} / ${seq[5]}`);
    ok(new Set(seq).size === seq.length, '一局里不重复用同一张地图', `${new Set(seq).size} 张不同`);

    log('⑦ 地图装饰物（Kenney 制图包）');
    if (!onMap) {
      log('  · 当前不在地图屏，跳过装饰物断言');
    } else {
      const decos = [...document.querySelectorAll('.map-scroll-inner .map-deco')];
      ok(decos.length >= 5, '地图上撒了装饰物', `${decos.length} 个`);
      ok(decos.length <= 20, '数量不过量（不至于糊成一片）', `${decos.length} 个`);
      // 每个装饰物都得有底图（类名对了、CSS 区块生成了、文件也在）
      const noBg = decos.filter((d) => {
        const bg = getComputedStyle(d).backgroundImage;
        return !bg || bg === 'none';
      });
      ok(noBg.length === 0, '每个装饰物都取到了图片（类名 ↔ GENERATED-MAP-DECOR ↔ assets/img/map）',
        noBg.map((n) => n.className).join('、') || '全部有底图');
      // 不能压住节点：装饰物与节点圆心保持距离（用圆心距离比，别用矩形相交 —— 大树的透明边很多）
      const nodeEls = [...document.querySelectorAll('.map-scroll-inner .map-node')].map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
      });
      const clash = [];
      for (const d of decos) {
        const r = d.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        for (const n of nodeEls) {
          if (Math.hypot(cx - n.x, cy - n.y) < 66) clash.push(`${d.className} ↔ 节点`);
        }
      }
      ok(clash.length === 0, '装饰物都避开了节点（圆心距离 ≥66px）', clash.slice(0, 4).join('、') || '无重叠');
      // 不能撑出横向滚动条
      const body = document.querySelector('.map-body');
      ok(body && body.scrollWidth <= body.clientWidth + 1,
        '装饰物没有把地图撑出横向滚动条',
        body ? `scrollWidth ${body.scrollWidth} vs clientWidth ${body.clientWidth}` : '找不到 .map-body');
      // 确定性：同一章重画一遍，装饰物位置必须一模一样
      const before = decos.map((d) => `${d.className}@${d.style.left || d.style.right},${d.style.top}`).join('|');
      ui.forceRerender();
      await wait(300);
      const after = [...document.querySelectorAll('.map-scroll-inner .map-deco')]
        .map((d) => `${d.className}@${d.style.left || d.style.right},${d.style.top}`).join('|');
      ok(before === after && before.length > 0, '同一章重画之后装饰物位置不变（种子取自本局 + 章节）',
        before === after ? '逐项一致' : '重画后变了');
      // 装饰物不该吃掉点击
      ok(getComputedStyle(document.querySelector('.map-decor')).pointerEvents === 'none',
        '装饰层不吃点击（能点的只有节点）');
    }

    if (fails.length) log(`MAP_ERRORS=[${fails.join(' | ')}]`);
    else log('章节地图自检：通过 ✓');
    log('MAP_DONE');
  } catch (e) {
    log('MAP_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e));
    log('MAP_DONE');
  }
})();
