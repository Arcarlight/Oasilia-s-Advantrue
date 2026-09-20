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

    // ---------- ① 标题页上的四个入口 ----------
    log('① 标题页入口');
    const entries = qa('.title-codex .title-codex-btn');
    ok(entries.length === 4, '标题页有 4 个入口（记录 / 卡牌图鉴 / 敌人图鉴 / 曲子库）', `实际 ${entries.length}`);
    const labels = entries.map((b) => q('.title-codex-label', b)?.textContent);
    ok(labels[0]?.includes('通关记录') && labels[1]?.includes('卡牌图鉴') && labels[2]?.includes('敌人图鉴'),
      '前三个入口分别是 通关记录 / 卡牌图鉴 / 敌人图鉴', labels.join(' / '));
    // 曲子库是后加的（第 4 个）：它自己的自检在 tools/diag-music.js，这里只确认入口在
    ok(labels[3] === '曲子库', '第 4 个入口是曲子库', labels.join(' / '));
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
    // 见过的用**小图标**（Generation 9 Pack 的动图），没见过的仍然是剪影
    ok(qa('.dex-card.met .poke-icon, .dex-card.slain .poke-icon', modal).length === 2,
      '见过的敌人卡上用的是小图标（不是 PMD 头像）',
      `${qa('.dex-card .poke-icon', modal).length} 个图标 / 见过 ${qa('.dex-card.met, .dex-card.slain', modal).length} 只`);
    ok(qa('.dex-card.new .poke-icon', modal).length === 0, '没见过的仍然是剪影，不给图标（不然等于提前看到长相）');
    ok(qa('.dex-card .dex-art img', modal).length === 0, '敌人卡上不再用 <img> 头像（统一换成小图标）');
    ok(qa('.dex-card-name', modal).some((n) => n.textContent === ENEMY_BY_ID[seenId].name),
      '见过的显示真实名字', ENEMY_BY_ID[seenId].name);
    // 点开见过的：要有台词与招式（详情页是**新的一层**，断言要查最上面那层）
    const known = qa('.dex-card', modal).find((n) => n.classList.contains('slain'));
    click(known);
    await wait(250);
    const detail = topModal();
    ok(!!q('.dex-detail-info', detail), '点开见过的宝可梦有详情页');
    /**
     * 详情页左边是**一整块图**（用户给的排版）：立绘当主体放大、行走图压右下角、小图标压左下角。
     * 「小图标会动」这件事不能只看有没有元素 —— 要查它真的挂着逐帧动画（CSS animation-name）。
     */
    {
      const box = q('.dex-art-compose', detail);
      ok(!!box, '详情页左边是一整块图（.dex-art-compose）');
      const turn = q('.dex-art-compose .dex-turnart-img', detail);
      const walk = q('.dex-art-compose .dex-walk canvas', detail);
      const icon = q('.dex-art-compose .dex-iconbox .poke-icon', detail);
      ok(!!turn, '图块里有回合立绘（gen9 正面图）');
      ok(!!walk, '图块里有行走图（PMD 精灵的 canvas，压右下角）');
      ok(!!icon, '图块里有小图标（压左下角）');
      if (icon) {
        const cs = getComputedStyle(icon);
        ok(cs.animationName === 'poke-icon-play' && cs.animationIterationCount === 'infinite',
          '小图标**在动**（挂着逐帧动画，不是一张静止的图）',
          `${cs.animationName} / ${cs.animationDuration} / ${cs.animationIterationCount}`);
        ok(parseFloat(cs.backgroundSize) > icon.clientWidth,
          '小图标的底图比它自己宽（说明是「一帧一帧横向排开」的动图条）',
          `底图 ${cs.backgroundSize} vs 显示宽 ${icon.clientWidth}px`);
      }
    }
    ok(qa('.dex-moves .dex-move', detail).length > 0, '详情里列了招式',
      `${qa('.dex-moves .dex-move', detail).length} 个胶囊`);
    ok(qa('.dex-moves .dex-move.sig', detail).length > 0, '招牌招式单独标出来了',
      `${qa('.dex-moves .dex-move.sig', detail).length} 个`);
    ok(!!q('.dex-lines p', detail), '详情里有出场台词');
    ok(qa('.detail-chip', detail).length >= 4, '详情头部有编号 / 档位 / 地图 / 属性',
      qa('.detail-chip', detail).map((n) => n.textContent).join(' · '));

    /**
     * ④ 用户要求的三件事（详情页改造）：
     *   · 左边是**一整块图**：立绘当主体放大，行走图压右下角、小图标压左下角；
     *   · 右上 = 名字/编号/称号/属性 + 三条简短介绍（撑到和图一样高）；
     *   · 分割线（上半场的下边线）以下是一条横跨整个图鉴的横栏：
     *     计数条（最右端奖牌）+「它会用的卡牌 / 它可能会这么说 / 出场台词」；
     *   · 行走图**跟着鼠标转向** —— 朝向 = 精灵图的某一**行**，所以断言「换位置之后 dirRow 变了」。
     */
    log('⑤ 详情页：图块 / 排版 / 奖牌');
    {
      const walk = q('.dex-art-compose .dex-walk canvas', detail);
      ok(!!walk, '图块里有行走图（canvas）');
      if (walk) {
        const r = walk.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        /**
         * 鼠标位置 = 精灵图中心 + 偏移（偏移方向就是「鼠标在哪个方向」）。
         */
        const VEC = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
        {
          const { dirFromPoint } = await import('/src/ui/codex.js');
          // 与下面循环用的是同一套输入（鼠标位置 = 中心 + 偏移）
          const rows = VEC.map(([fx, fy]) => dirFromPoint(0, 0, fx * 100, fy * 100));
          log(`    · 朝向映射表（鼠标在 下/右下/右/右上/上/左上/左/左下 → 行）：${rows.join(',')}`);
        }
        /**
         * 八个方向逐个试：鼠标放到某个方向，行走图应该切到那个方向的**朝向行**。
         *
         * 两个例外都要算合法：① 这个物种没画满 8 个朝向（素材库里 6/214 只没画满），
         * 此时 frameList() 会退回第一行有内容的；② 该行恰好是空的。
         * 所以期望值 = 「这个物种支持的朝向里，离目标最近的那一个」。
         */
        const dirs = walk.contentDirs?.() ?? [];
        const nearest = (want) => {
          if (dirs.includes(want)) return want;
          let best = want;
          let bestD = 99;
          for (const d of dirs) {
            const diff = Math.min((d - want + 8) % 8, (want - d + 8) % 8);
            if (diff < bestD) { bestD = diff; best = d; }
          }
          return best;
        };
        const NAMES = ['下', '右下', '右', '右上', '上', '左上', '左', '左下'];
        let hit = 0;
        /**
         * 顺便把**每个朝向下这张图有多大**记下来。
         *
         * 为什么会有人觉得它「一会儿大一会儿小」：这张图是**按高度**定尺寸的
         * （autoScale = 104，内容外接框高度撑到 104px），而各朝向的外接框宽高比不一样 ——
         * 正面最窄、侧身最宽。所以转身时**高度不变、宽度会变**（用户看到的「变大」）。
         * 这里把八个方向都量一遍，写成数字，免得以后再靠肉眼猜。
         */
        const sizes = [];
        for (let want = 0; want < 8; want++) {
          const [fx, fy] = VEC[want];
          document.dispatchEvent(new MouseEvent('mousemove', {
            clientX: cx + fx * 300, clientY: cy + fy * 300, bubbles: true,
          }));
          await wait(30);
          const want2 = nearest(want);
          if (walk.dirRow === want2) hit++;
          else {
            const rr = walk.getBoundingClientRect();
            const point = window.__dexPointer ?? {};
            const { dirFromPoint } = await import('/src/ui/codex.js');
            log(`    · 鼠标在${NAMES[want]} → dirRow=${walk.dirRow}，期望 ${want2}`
              + `（canvas 中心 ${Math.round(rr.left + rr.width / 2)},${Math.round(rr.top + rr.height / 2)}`
              + ` 指针 ${point.x},${point.y} 纯函数给 ${dirFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2, point.x, point.y)}）`);
          }
          const r2 = walk.getBoundingClientRect();
          sizes.push({ dir: NAMES[want], row: walk.dirRow, w: Math.round(r2.width), h: Math.round(r2.height) });
        }
        log(`    · 八个朝向下的大小：${sizes.map((s) => `${s.dir} ${s.w}×${s.h}`).join(' ｜ ')}`);
        const hs = new Set(sizes.map((s) => s.h));
        const ws = sizes.map((s) => s.w);
        ok(hs.size === 1, '八个朝向下高度完全一致（按高度定尺寸，所以转身不会变高）', `高度 ${[...hs].join('/')}px`);
        ok(Math.max(...ws) / Math.min(...ws) < 2,
          '八个朝向下宽度差别不到一倍（正面最窄、侧身最宽）',
          `宽 ${Math.min(...ws)}~${Math.max(...ws)}px，高 ${[...hs][0]}px`);
        ok(hit === 8, '八个方向逐个数：鼠标指向哪边，行走图就转哪边',
          `命中 ${hit}/8（这个物种支持 ${dirs.join('/') || '?'} 行朝向）`);
        ok((walk.frameCount ?? 0) > 0, '行走图有帧（没画满朝向时会退回第一行有内容的）', `${walk.frameCount} 帧`);
        ok(dirs.length >= 4, '这个物种至少有 4 个朝向（不然转不出「看全身」的效果）', `${dirs.length} 个朝向`);
      }
      ok(!!q('.dex-detail-top', detail) && qa('.dex-detail-top > *', detail).length === 2,
        '排版是「左边一整块图 + 右侧信息」两列');
      ok(qa('.dex-art-compose > *', detail).length === 3, '图块里叠着三张图（立绘 / 行走图 / 小图标）');
      // 「简短介绍」三条 + 分割线 + 计数条
      ok(qa('.dex-intro-row', detail).length === 3, '右列有三条简短介绍',
        qa('.dex-intro-cap', detail).map((n) => n.textContent).join(' · '));
      ok(!!q('.dex-record-row', detail), '分割线下面是计数条（挑战 / 击败 / 失败 / 胜率 / 招式 + 奖牌）');
      ok(qa('.dex-stats .dex-stat', detail).length >= 5, '下方有战绩方块（挑战 / 击败 / 失败 / 胜率 / 招式）',
        qa('.dex-stat span', detail).map((n) => n.textContent).join(' · '));
      /**
       * 版式（用户要求，第三版）：**分割线以下必须横跨整个图鉴**。
       *
       * 第一版把卡牌 / 台词全塞在右列里，右列比图高得多，于是行走图下面一大片空白。
       * 现在量四个数：① 图的下沿贴不贴分割线；② 三条介绍的下沿对不对齐图；
       * ③ 下方那一栏是不是从最左边开始、和上半场一样宽；④ 字号确实调大了。
       */
      {
        const topBox = q('.dex-detail-top', detail);
        const artBox = q('.dex-art-compose', detail);
        const introBox = q('.dex-intro', detail);
        const band = q('.dex-detail-bottom', detail);
        ok(!!topBox && !!band && !!artBox && !!introBox, '上下两场都在（.dex-detail-top / .dex-detail-bottom）');
        if (topBox && band && artBox && introBox) {
          const rt = topBox.getBoundingClientRect();
          const ra = artBox.getBoundingClientRect();
          const ri = introBox.getBoundingClientRect();
          const rb = band.getBoundingClientRect();
          // 分割线画在 .dex-detail-top 的下边线上，padding-bottom 是图与线之间留的那点空隙
          const line = rt.bottom;
          const pad = parseFloat(getComputedStyle(topBox).paddingBottom) || 0;
          const artGap = line - pad - ra.bottom;
          ok(artGap >= -2 && artGap <= 24, '图的下沿就贴在分割线上（行走图下面不再空着一大块）',
            `图高 ${Math.round(ra.height)}px，图底到分割线 ${Math.round(artGap)}px`);
          ok(Math.abs(line - pad - ri.bottom) <= 8, '三条简短介绍撑到和图一样高（下沿落在分割线上）',
            `介绍下沿 ${Math.round(ri.bottom)}，图下沿 ${Math.round(ra.bottom)}，分割线 ${Math.round(line - pad)}`);
          ok(Math.abs(rb.left - rt.left) <= 2 && Math.abs(rb.width - rt.width) <= 2,
            '分割线以下的文本横跨整个图鉴（不再吊在右列里）',
            `横栏 ${Math.round(rb.left)}→${Math.round(rb.left + rb.width)}（${Math.round(rb.width)}px）`
            + ` vs 上半场 ${Math.round(rt.left)}→${Math.round(rt.left + rt.width)}（${Math.round(rt.width)}px）`);
          ok(rb.left < ra.right, '……所以行走图正下方也铺着内容（横栏从上半场最左边开始）',
            `横栏左沿 ${Math.round(rb.left)} < 图右沿 ${Math.round(ra.right)}`);
          ok(rb.top >= line - 1, '横栏在分割线下面，不会压到图和介绍',
            `横栏顶 ${Math.round(rb.top)} vs 分割线 ${Math.round(line)}`);
          ok(!!q('.dex-detail-bottom .dex-moves', detail) && !!q('.dex-detail-bottom .dex-stats', detail)
            && !!q('.dex-detail-bottom .dex-lines', detail),
            '战绩 / 卡牌 / 出场台词都搬到了横栏里');
          const fs = parseFloat(getComputedStyle(q('.dex-intro-text', detail)).fontSize) || 0;
          ok(fs >= 14, '「简短介绍」的字号调大了一档（第一版 13px）', `${fs}px`);
        }
      }
      /**
       * 口吻台词：**头像 + 对话框**（用户给的版式），而且是**打赢过才看得到**（这一只是 slain）。
       *
       * 最要紧的那条断言是「**不许和出场台词重复**」—— 用户截图发现的就是这个：
       * 那一栏原来直接拿出场台词充数，两栏印的是同一句话。所以这里两边都读出来逐句比。
       */
      const bubble = q('.dex-voice .dex-say-bubble', detail);
      const bubbleText = q('.dex-voice .dex-voice-line', detail)?.textContent ?? '';
      ok(!!bubble, '打赢过的宝可梦会「说一句话」，而且是在**对话框**里', bubbleText);
      const sayFace = q('.dex-voice .dex-say-face', detail);
      const faceImg = q('.dex-voice .dex-say-face img.portrait', detail);
      ok(!!sayFace && !!faceImg, '「它可能会这么说」旁边放着它的**头像**（portraits，不是小图标）',
        faceImg ? `${faceImg.getAttribute('src')} · ${Math.round(faceImg.getBoundingClientRect().width)}px` : '（没有头像）');
      {
        /** 对话框和头像的相对位置：框在头像右边、三角在框的左侧 */
        const fr = sayFace?.getBoundingClientRect();
        const br = bubble?.getBoundingClientRect();
        if (fr && br) {
          ok(br.left >= fr.right - 2, '对话框在头像**右边**（左边那个小三角指着它）',
            `头像右沿 ${Math.round(fr.right)} ≤ 框左沿 ${Math.round(br.left)}`);
          const tail = getComputedStyle(bubble, '::before');
          ok(tail.content !== 'none' && parseFloat(tail.borderRightWidth) > 0, '对话框左边有一个指向头像的小三角',
            `border-right ${tail.borderRightWidth}`);
        }
        const voiced = new Set((ENEMY_BY_ID[slainId].voice ?? []));
        ok(voiced.size >= 3, '这只的口吻台词有 3 句（按击败次数轮换）', `${voiced.size} 句`);
        const shown = bubbleText.replace(/^「|」$/g, '');
        ok(voiced.has(shown), '框里印的**确实是口吻台词**（不是出场台词顶包）', shown);
        const spoken = new Set(ENEMY_BY_ID[slainId].lines ?? []);
        ok(!spoken.has(shown), '它和这只的**出场台词**不是同一句（用户点过的那个问题）',
          `出场台词：${[...spoken].join(' ｜ ')}`);
        ok(!qa('.dex-voice .dex-voice-line', detail).some((n) => spoken.has(n.textContent.replace(/^「|」$/g, ''))),
          '对话框里没有混进任何一句出场台词');
      }
      // 全 193 只：每只都得有口吻台词，且都不和出场台词重复（新增宝可梦漏了就红）
      {
        const noVoice = ENEMIES.filter((e) => !(e.voice ?? []).length);
        ok(noVoice.length === 0, `全部 ${ENEMIES.length} 只都有口吻台词`,
          noVoice.length ? `缺 ${noVoice.length} 只：${noVoice.slice(0, 4).map((e) => e.id).join(', ')}` : `${ENEMIES[0].voice.length} 句/只`);
        const dup = ENEMIES.filter((e) => (e.voice ?? []).some((v) => (e.lines ?? []).includes(v)));
        ok(dup.length === 0, '没有任何一只的口吻台词和它的出场台词撞车',
          dup.length ? dup.slice(0, 3).map((e) => e.id).join(', ') : '已逐只比对');
      }
      ok(qa('.dex-medal-step', detail).length === 4, '奖牌进度条有 4 段（5 / 15 / 25 / 50）');
      // 打赢 1 次：还没有奖牌，四段都没点亮
      ok(qa('.dex-medal', detail).length === 0, '只赢过 1 次还没有奖牌');
      ok(qa('.dex-medal-step.done', detail).length === 0, '进度条一段都没点亮');
      // 手动把击败次数堆到 15：应该出现银牌
      const metaNow = save.readMeta();
      save.writeMeta({ ...metaNow, slainCount: { ...(metaNow.slainCount ?? {}), [slainId]: 15 } });
      closeTop();
      await wait(150);
      ui.forceRerender();
      await wait(200);
      click(qa('.title-codex .title-codex-btn')[2]);
      await wait(300);
      modal = topModal();
      const known2 = qa('.dex-card', modal).find((n) => n.classList.contains('slain'));
      ok(!!known2, '（重开图鉴后）能再找到那只打赢过的');
      click(known2);
      await wait(350);
      const d2 = topModal();
      ok(qa('.dex-medal.medal-silver', d2).length === 1, '打赢 15 次 → 计数条最右端出现银牌',
        `${qa('.dex-medal', d2).map((n) => n.className).join(' ') || '（没有奖牌）'}`
        + ` ｜ 战绩 ${qa('.dex-stat b', d2).map((n) => n.textContent).join('/')}（挑战/击败/失败/胜率/招式）`);
      ok(qa('.dex-medal-step.done', d2).length === 2, '进度条点亮 2 段（5 / 15）',
        `${qa('.dex-medal-step.done', d2).length} 段`);
      closeTop();
      await wait(150);
      ui.forceRerender();
      await wait(200);
      click(qa('.title-codex .title-codex-btn')[2]);
      await wait(300);
      modal = topModal();
    }
    /**
     * 见过但**还没打赢**的那只：对话框要在（头像 + 框），但框里只印「打赢它一次就能听到。」——
     * 口吻台词一句都不许提前漏出来，不然图鉴就等于剧透。
     * （图鉴还开着：上面刚 `modal = topModal()` 重开过一次，别再关掉它）
     */
    {
      const codex = topModal();
      const met = qa('.dex-card', codex).find((n) => n.classList.contains('met'));
      ok(!!met, '（图鉴里）能找到一只「见过但没打赢」的');
      click(met);
      await wait(300);
      const d = topModal();
      const txt = q('.dex-voice .dex-voice-line', d)?.textContent ?? '';
      const ids = qa('.dex-card.met', codex).map((n) => n.dataset.enemyId);
      const leak = ids.flatMap((id) => ENEMY_BY_ID[id]?.voice ?? []).filter((v) => txt.includes(v));
      ok(!!q('.dex-voice .dex-say-bubble', d) && !!q('.dex-voice .dex-say-face', d),
        '没打赢也看得到那个对话框（只是里面还没话）', txt);
      ok(txt.includes('打赢它一次') && !leak.length, '没打赢时框里只有一句「打赢它一次就能听到。」，不提前漏台词',
        `漏了 ${leak.length} 句`);
      closeTop();
      await wait(150);
    }
    // 没见过的点开：只能看到「还没遇见」那句，不能泄露台词与招式
    // （图鉴还是开着的：上面刚 `modal = topModal()` 重开过一次，别再关掉它）
    {
      const codex = topModal();
      const unknown = qa('.dex-card', codex).find((n) => n.classList.contains('new'));
      ok(!!unknown, '（图鉴里）能找到一只没见过的剪影格');
      // 点之前先把报错抓下来：如果 showEnemyDetail 抛了异常，弹窗根本不会出现，
      // 而界面上看起来只是「点了没反应」—— 这里必须看到原因。
      const errs = [];
      const onErr = (e) => errs.push(e.message ?? String(e));
      window.addEventListener('error', onErr);
      click(unknown);
      await wait(300);
      const locked = topModal();
      if (locked === codex) log(`    · 点了没反应，期间捕获到 ${errs.length} 条报错：${errs.slice(0, 2).join(' ｜ ') || '（没有 error 事件）'}`);
      window.removeEventListener('error', onErr);
      ok(!!q('.dex-locked', locked) && !q('.dex-lines', locked) && !q('.dex-moves', locked),
        '剪影点开只有「还没遇见」，不泄露台词和招式',
        `标题「${q('.modal-head h3', locked)?.textContent ?? '-'}」`
        + ` locked=${!!q('.dex-locked', locked)} lines=${!!q('.dex-lines', locked)}`
        + ` moves=${!!q('.dex-moves', locked)} voice=${!!q('.dex-voice', locked)} intro=${qa('.dex-intro-row', locked).length}`);
      ok(!q('.dex-detail-bottom', locked), '剪影详情没有下半栏（没战绩没卡牌，不留一个空横栏）');
    }
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
        // 截图时给那只刷 25 次击败，好把金牌和满格进度条一起拍进去
        const m = save.readMeta();
        const id = qa('.dex-card.slain')[0]?.dataset?.enemyId
          ?? (m.slainEnemies ?? [])[0];
        if (id) save.writeMeta({ ...m, slainCount: { ...(m.slainCount ?? {}), [id]: 25 } });
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
