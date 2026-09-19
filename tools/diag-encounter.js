// 诊断：遭遇演出（地图 → 战斗的过场）到底演成什么样了（?dgenc=1）
//
// 用户的要求原话：
//   「我方背影的贴图从右方非线性划到左边，同时敌人的正面图非线性从左滑到右，
//     同时一条黑色的带主题色的横线跟随正面图将屏幕遮盖，双双停留一小会，
//     随后滑出屏幕进入战斗。」
//   「敌人出现的时候可以在其立绘旁边写名字（大号）和野生、强敌等标注。」
//   「停留的时候可以进行资源预加载。这样是否能防止战斗中因为音效加载较慢而出现的
//     音效播放较慢的情况？」
//
// 这份诊断就是逐条把这些变成能失败的断言 —— 尤其是两个光看截图看不出来的点：
//   ① 「跟随正面图」：横线的右端必须和敌人立绘的中线贴着（差几像素就看得出来没跟着）
//   ② 「非线性」：前半段走完的路程必须明显超过一半（线性的话正好是一半）
//   ③ 预载：停留结束时这批音效必须**已经解码好**（而不是「排上了队」）
//
// 采样是在外面看着 DOM 记时间线，而不是往被测量的代码里插桩 —— 那样测的是插桩后的东西。
//
// 由 tools/diag2.mjs 通过 ?dgenc=1 加载（真实时间：rt）。
// ?dgenc=shot&at=hold|in-mid 则把演出钉在某一帧不动，给 tools/shot.mjs 截图用。
(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };
  const until = async (fn, ms = 12000) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) { if (fn()) return true; await wait(60); }
    return false;
  };

  const params = new URLSearchParams(location.search);

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { audio, BATTLE_SFX, ENCOUNTER_SFX } = await import('../src/core/audio.js');
    const { DIR, liveAnimCount, createAnim, frameCoverage } = await import('../src/core/sprites.js');
    const { TIERS } = await import('../src/data/enemies.js');
    const enc = await import('../src/ui/encounter.js');
    const { encounterDebug } = enc;

    game.newRun(20240607);
    await wait(400);
    audio.unlock();
    await wait(300);

    // ---- 冷启动量一次：这 26 个音效「什么都不预热」时要等多久 ----
    // 这就是「音效慢半拍」的原始成本：play() 是 fetch → decodeAudioData → start，
    // 所以每个音效第一次响都要先付这笔钱。遭遇演出在停留阶段把它付掉了。
    // 本地服务器没有网络延迟，量到的是**解码**那部分的底噪；
    // 想量真实的网络成本就对线上站点跑：?dgenc=cold（加代理）
    if (params.get('dgenc') === 'cold') {
      const names = [...BATTLE_SFX, ...ENCOUNTER_SFX];
      const t0 = performance.now();
      await audio.warm(names);
      const ms = performance.now() - t0;
      const done = await audio.warmed();
      log(`冷启动预载 ${names.length} 个音效：耗时 ${ms.toFixed(0)}ms（其中 ${done.length} 个解码成功）`);
      log(`  平均每个 ${(ms / names.length).toFixed(1)}ms —— 这就是「第一击的音效慢半拍」的量级`);
      log(`  本地服务器没有网络往返，所以这个数只是下限；真实网络还要加上 RTT 与下载时间`);
      log('ENC_DONE');
      return;
    }

    // ---- 截图模式：把演出钉在某一帧，别的什么都不做 ----
    const at = params.get('at');
    if (params.get('dgenc') === 'shot') {
      encounterDebug.freeze = at || 'hold';
      log(`截图模式：把演出钉在 ${encounterDebug.freeze} 这一帧`);
      // 顺手守一下「舞台上只能有一屏」：标题是异步取精灵的，
      // 曾经因为「先 clear 再 await 再 append」把后渲染的地图压在底下过（同屏出现两屏）
      const stage = [...document.getElementById('stage').children].map((c) => c.className);
      ok(stage.length === 1, '舞台上只有一屏（没有把标题和地图叠在一起）', stage.join(' | ') || '（空）');
      game.startBattle('elite', 0, 'map');
      await until(() => !!document.querySelector('.encounter'));
      await wait(500);
      log('ENC_DONE');
      return;
    }

    log('=== 一、演出本体 ===');
    ok(enc.encounterMode() === 'always', '?dgenc 会把演出调成 always（诊断是直接 startBattle，没有 battleEntry=map）', enc.encounterMode());
    // 开关的语义单独测一遍（截图的那些脚本都靠它不被过场打乱）
    enc.setEncounterMode('map');
    ok(enc.wantsEncounter('map') === true && enc.wantsEncounter('direct') === false,
      '默认只有 battleEntry=map 的战斗才演（?scene=/冒烟/其余诊断都是 direct，不会被过场打乱）');
    enc.setEncounterMode('never');
    ok(enc.wantsEncounter('map') === false, '?enc=0 关得掉（连地图上撞见的也不演）');
    enc.setEncounterMode('always');

    // 真实玩法走的是 game.goToNode → enterNode → startBattle(kind, retry, 'map')，
    // 这条路必须把 entry 传成 'map'，否则过场在真实玩法里永远不会放。
    // 这里只截参数、不真的开打（把 startBattle 临时换掉）。
    {
      const real = game.startBattle;
      let entry = null;
      game.startBattle = (kind, retry, e) => { entry = e; return null; };
      game.enterNode({ type: 'battle' });
      game.enterNode({ type: 'elite' });
      game.startBattle = real;
      ok(entry === 'map', 'enterNode 把「从地图走进来的」标成 map（真实玩法走的就是这条路）', `entry=${entry}`);
    }

    // 动画定时器的计数先自证一下（下面的泄漏断言全靠它）
    const n0u = liveAnimCount();
    const tmpCanvas = await createAnim(game.data.slug, { anim: 'Idle', dir: DIR.DOWN });
    const n1u = liveAnimCount();
    tmpCanvas.destroy();
    tmpCanvas.destroy();   // 再调一次不能把计数减穿（战斗界面会重复调）
    const n2u = liveAnimCount();
    ok(n1u === n0u + 1 && n2u === n0u,
      'createAnim / destroy 的动画计数是准的，且 destroy 幂等', `${n0u} → ${n1u} → ${n2u}`);

    // 来回切屏不该积累游离动画（动画是 setInterval 推的，摘出 DOM 不会自己停）
    const nChurn0 = liveAnimCount();
    for (const ph of ['title', 'map', 'title', 'map']) {
      game.phase = ph;
      ui.forceRerender();
      await wait(260);
    }
    const nChurn1 = liveAnimCount();
    ok(nChurn1 <= nChurn0 + 1,
      '标题 ↔ 地图来回切两轮，不会积累游离的动画定时器',
      `${nChurn0} → ${nChurn1}`);

    // 起点：这一刻还没人预载过任何音效（下面用来证明「预载是这场演出做的」）
    const warmBefore = (await audio.warmed()).length;
    ok(warmBefore === 0, '演出前没有任何音效被预载过（后面全靠这场演出）', `已解码 ${warmBefore} 个`);

    // ---- 采样：把「谁在哪 / 幕布多大 / 预载好了几个」按时间记下来 ----
    const liveBefore = liveAnimCount();
    const domBefore = document.querySelectorAll('canvas.anim').length;
    const samples = [];
    let sampling = true;
    const t0 = performance.now();
    const sampler = (async () => {
      while (sampling) {
        const root = document.querySelector('.encounter');
        if (!root) { if (samples.length) break; }
        else {
          const band = root.querySelector('.enc-band');
          const player = root.querySelector('.enc-player');
          const enemyC = root.querySelector('.enc-enemy canvas');
          if (band && player) {
            const br = band.getBoundingClientRect();
            const pr = player.getBoundingClientRect();
            const er = enemyC ? enemyC.getBoundingClientRect() : null;
            samples.push({
              t: Math.round(performance.now() - t0),
              bandLeft: br.left, bandW: br.width, bandH: br.height,
              playerX: pr.left,
              enemyCx: er ? er.left + er.width / 2 : null,
              warm: (await audio.warmed()).length,
            });
          }
        }
        await wait(20);
      }
    })();

    // 从这里开始就走**真实玩法的开关**（mode = 'map'），
    // 而不是靠 ?dgenc 强制打开 —— 测的必须是线上真正走的那条路。
    enc.setEncounterMode('map');
    game.startBattle('elite', 0, 'map');
    const enemyName = game.battle?.enemy?.name;
    const enemyTier = game.battle?.enemy?.tier;
    await wait(60);
    const liveDuring = liveAnimCount();
    ok(game.battleEntry === 'map', '这一场的 battleEntry = map', String(game.battleEntry));

    // 立绘 + 名字标注（趁演出还在场的时候查）
    const root = document.querySelector('.encounter');
    ok(!!root, '遭遇演出的容器挂上了');
    if (root) {
      const nameEl = root.querySelector('.enc-name');
      const tierEl = root.querySelector('.enc-tier');
      const pCanvas = root.querySelector('.enc-player canvas');
      const eCanvas = root.querySelector('.enc-enemy canvas');
      ok(nameEl?.textContent === enemyName, '敌人立绘旁边写着大号名字', `「${nameEl?.textContent}」 vs 敌人 ${enemyName}`);
      ok(tierEl?.textContent === (TIERS[enemyTier]?.name ?? ''),
        '档位标注（野生 / 较强 / 精英 / 首领）和敌人数据一致', `「${tierEl?.textContent}」 vs TIERS.${enemyTier}.name`);
      ok(!!pCanvas && pCanvas.dirRow === DIR.UP,
        '我方用的是 UP 那一行 = 背对镜头的**背影**', `dirRow=${pCanvas?.dirRow}（UP=${DIR.UP}）`);
      ok(!!eCanvas && eCanvas.dirRow === DIR.DOWN,
        '敌人用的是 DOWN 那一行 = 正对镜头的**正面图**', `dirRow=${eCanvas?.dirRow}（DOWN=${DIR.DOWN}）`);

      // 立绘尺寸：必须**趁演出还在场上**量 —— 元素一旦从 DOM 上摘掉，
      // getBoundingClientRect 一律返回 0×0（第一版就是这个原因误报成「0×0 迷你图」）。
      // 尺寸得是按视口算出来的，不是兜底值：写死缩放会让某些物种巨大、某些迷你（帧高各物种不同）。
      const sz = (sel) => {
        const c = root.querySelector(sel);
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      };
      const pSize = sz('.enc-player canvas');
      const eSize = sz('.enc-enemy canvas');
      // 帧里的透明留白：缩放是按「有画面的那块」算的（见 sprites.js 的 frameCoverage），
      // 所以这里同时报出「画布多大」和「留白比例」，一眼能看出补偿有没有生效
      const cov = await frameCoverage(game.data.slug, 'Idle', DIR.UP).catch(() => null);
      log(`  立绘渲染尺寸：我方背影 ${pSize?.w}×${pSize?.h}px · 敌人正面图 ${eSize?.w}×${eSize?.h}px（视口高 ${window.innerHeight}）`);
      log(`  帧内留白：我方背影的画布有画面的部分只占 ${((cov?.sw ?? 1) * 100).toFixed(0)}% × ${((cov?.sh ?? 1) * 100).toFixed(0)}% —— 缩放已经把这部分补回来`);
      ok(pSize && pSize.h >= window.innerHeight * 0.18, '我方背影有存在感（不是兜底的迷你图）', `高 ${pSize?.h}px`);
      ok(eSize && eSize.h >= window.innerHeight * 0.15, '敌人正面图有存在感', `高 ${eSize?.h}px`);
    }

    // 等演出走完、战斗界面挂上
    const mounted = await until(() => ui.battleScreen?.mounted === true, 20000);
    // 挂载是在「幕布盖满」那一刻发生的 —— 后面还有停留和退场，所以还要等幕布真的被摘掉
    const gone = await until(() => !document.querySelector('.encounter'), 10000);
    await wait(200);
    sampling = false;
    await sampler;
    const liveAfter = liveAnimCount();
    ok(mounted, '演出结束后战斗界面挂载完成（幕布掀开时战斗画面已经就位）');
    ok(gone, '演出收场了（幕布层从 DOM 上摘掉了）');
    ok(samples.length > 8, '采样到了足够的时间线', `${samples.length} 个采样点，覆盖 ${samples.at(-1)?.t ?? 0}ms`);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const docW = document.documentElement.clientWidth;
    const docH = document.documentElement.clientHeight;
    log(`  视口：inner ${vw}×${vh} · documentElement ${docW}×${docH} · 截图用的是窗口尺寸（无头下这两者会差一圈）`);

    // ---- 阶段切分（按幕布的宽高来分，不靠时间猜） ----
    // ① 划入：幕布还是一条线（高度 ≈ 8px）但已经在长（宽度 > 5）
    const slide = samples.filter((s) => s.bandH < 14 && s.bandW > 5 && s.enemyCx != null);
    // ② 停留：幕布满屏、而且还没开始平移
    const hold = samples.filter((s) => s.bandW >= vw - 3 && s.bandH >= vh - 3 && s.bandLeft < 1);
    // ③ 退场：幕布开始往右平移
    const exit = samples.filter((s) => s.bandLeft > 2 && s.bandW >= vw - 3);

    log(`  阶段采样：划入 ${slide.length} 点 · 停留 ${hold.length} 点 · 退场 ${exit.length} 点（视口 ${vw}×${vh}）`);
    ok(slide.length >= 4, '① 划入阶段被采到了');
    ok(hold.length >= 4, '② 满屏停留阶段被采到了');
    ok(exit.length >= 2, '③ 滑出屏幕阶段被采到了');

    // ---- 「横线跟随正面图」：横线右端 == 敌人立绘中线 ----
    const gaps = slide.map((s) => Math.abs(s.bandW - s.enemyCx));
    const worst = gaps.length ? Math.max(...gaps) : 999;
    ok(gaps.length > 0 && worst <= 3,
      '横线的右端始终贴着敌人立绘的中线（「跟随正面图」）',
      `最大偏差 ${worst.toFixed(1)}px（取整误差，>3px 就是没跟着）`);

    // ---- 「非线性」：前半段时间里走完的路程要明显超过一半 ----
    if (slide.length >= 4) {
      const a = slide[0];
      const z = slide.at(-1);
      const dist = a.playerX - z.playerX;                    // 往左走，正数
      const tMid = (a.t + z.t) / 2;
      const mid = slide.reduce((best, s) => (Math.abs(s.t - tMid) < Math.abs(best.t - tMid) ? s : best), a);
      const frac = dist > 1 ? (a.playerX - mid.playerX) / dist : -1;
      ok(frac >= 0.6,
        '我方背影是**非线性**划入（前半段时间走完 >60% 路程；匀速的话正好 50%）',
        `前半段走了 ${(frac * 100).toFixed(0)}%，用时 ${mid.t - a.t}ms / 全程 ${z.t - a.t}ms`);
      ok(dist > 40, '我方背影确实横穿了屏幕（不是原地不动）', `位移 ${dist.toFixed(0)}px`);
    }

    // ---- 「一条黑色的带主题色的横线…将屏幕遮盖」 ----
    const lineSample = slide[0];
    ok(lineSample && lineSample.bandH <= 12,
      '起步时它是一条**横线**（还没张开）', `高 ${lineSample?.bandH.toFixed(1)}px`);
    ok(hold.length > 0, '它最后张满整个屏幕（把屏幕遮盖）', `最大 ${Math.max(...samples.map((s) => s.bandW)).toFixed(0)}×${Math.max(...samples.map((s) => s.bandH)).toFixed(0)}px`);
    // 幕布必须盖住的是「可视区」，不是别的什么东西：和 documentElement 的客户区比一遍
    ok(Math.abs(Math.max(...samples.map((s) => s.bandW)) - docW) <= 2
      && Math.abs(Math.max(...samples.map((s) => s.bandH)) - docH) <= 2,
      '幕布的尺寸 == 可视区尺寸（不留缝，也不多盖）', `${Math.max(...samples.map((s) => s.bandW)).toFixed(0)}×${Math.max(...samples.map((s) => s.bandH)).toFixed(0)} vs ${docW}×${docH}`);

    // 立绘尺寸在上面（演出还在场时）已经量过了

    // ---- 「双双停留一小会」：停留期间两只都不许动 ----
    if (hold.length >= 3) {
      const drift = (key) => {
        const v = hold.map((s) => s[key]).filter((x) => x != null);
        return Math.max(...v) - Math.min(...v);
      };
      ok(drift('playerX') <= 1 && drift('enemyCx') <= 1,
        '停留期间两只立绘一动不动（真的在「停」）',
        `我方漂移 ${drift('playerX').toFixed(1)}px，敌方 ${drift('enemyCx').toFixed(1)}px，停留 ${hold.at(-1).t - hold[0].t}ms`);
    }

    // ---- 预载：这是「音效慢半拍」那条反馈的正题 ----
    const warmAtSlide = samples[0]?.warm ?? -1;
    const warmAtHoldEnd = hold.at(-1)?.warm ?? -1;
    const need = BATTLE_SFX.length;
    ok(warmAtHoldEnd >= need,
      `停留结束时 ${need} 个战斗音效**已经解码好**了（不是「排上了队」）`,
      `已解码 ${warmAtHoldEnd} 个（演出刚开始时 ${warmAtSlide} 个 —— 是从 0 起的）`);
    // 预载是并行发的，不能把入场动画拖慢
    const slideMs = slide.length >= 2 ? slide.at(-1).t - slide[0].t : -1;
    ok(slideMs > 0 && slideMs <= 900,
      '划入没有被并行的预载拖慢（2.9 MB 的音效在后台下载）', `划入实测 ${slideMs}ms`);
    const warmedNow = await audio.warmed();
    const missing = BATTLE_SFX.filter((n) => !warmedNow.includes(n));
    ok(missing.length === 0, 'BATTLE_SFX 一个不漏', missing.length ? `缺 ${missing.join(', ')}` : `${warmedNow.length} 个就位`);

    // ---- 收场 ----
    ok(document.querySelectorAll('.encounter').length === 0, '演出结束后幕布层被摘掉了（不会挡着战斗界面）');
    ok(!!document.querySelector('.battle-screen'), '战斗界面在场上');
    // 泄漏：演出前后各数一次「活着但不在 DOM 里的动画」——它们就是没人管的孤儿。
    // （元素摘出 DOM 不会停掉 setInterval，所以这种漏一定要显式 destroy。）
    const domAfter = document.querySelectorAll('canvas.anim').length;
    const orphansBefore = liveBefore - domBefore;
    const orphansAfter = liveAfter - domAfter;
    ok(orphansAfter <= orphansBefore,
      '演出没有新增游离的动画定时器（活着但不在 DOM 里的数量没有变多）',
      `孤儿 ${orphansBefore} → ${orphansAfter}；活 ${liveBefore} → ${liveAfter} 个 / DOM 里 ${domBefore} → ${domAfter} 个`);

    // ---- 二、反向测试：战斗里实际响过的音效，必须都在预载表里 ----
    log('=== 二、战斗音效覆盖（反向测试）===');
    const bs = ui.battleScreen;
    const b = game.battle;
    let guard = 0;
    while (!b.over && guard++ < 2) {
      let plays = 0;
      while (!b.over && plays++ < 6) {
        const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
        if (!hand.length) break;
        await bs.playCard(hand[0].uid);
      }
      if (b.over) break;
      await bs.onEndTurn();
    }
    const playedNames = audio.playedNames();
    const allowed = new Set([...BATTLE_SFX, ...ENCOUNTER_SFX]);
    const leaks = playedNames.filter((n) => !allowed.has(n));
    log(`  这一场实际响过 ${playedNames.length} 种音效：${playedNames.join(', ')}`);
    ok(playedNames.length >= 5, '确实打出了足够多的音效事件', `${playedNames.length} 种`);
    ok(leaks.length === 0,
      '战斗里响过的音效全部在预载表 BATTLE_SFX 里（谁加了新音效却忘了登记，这里会红）',
      leaks.length ? `漏登记：${leaks.join(', ')}` : '全覆盖');

    // ---- 三、再来一场：确认第二场也干净 ----
    log('=== 三、再打一场（动画定时器泄漏）===');
    const live1 = liveAnimCount();
    game.startBattle('elite', 0, 'map');
    await until(() => ui.battleScreen?.mounted === true, 20000);
    await until(() => !document.querySelector('.encounter'), 10000);
    await wait(400);
    const live2 = liveAnimCount();
    ok(live2 <= live1,
      '第二场遭遇演出没有留下游离的动画定时器（createAnim 起的 setInterval 必须 destroy）',
      `第一场后 ${live1} 个，第二场后 ${live2} 个`);

    if (fails.length) log(`ENC_ERRORS=[${fails.join(' | ')}]`);
    else log('遭遇演出自检：通过 ✓');
    log('ENC_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('ENC_DONE');
  }
})();
