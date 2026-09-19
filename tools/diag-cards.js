// 卡面 / 卡组页诊断（?dgcards=1）
//
// 用户需求：卡太小、长文案放不下、要能看详情、要能排序、数字和状态要标出来。
// 这里逐条量出来，别靠「看起来没问题」：
//   ① 三档卡面尺寸下，86 张卡的描述有没有被截断（scrollHeight > clientHeight 就是截了）
//   ② 数字 / 状态 / 关键词有没有真的被标出来（数 .kw 节点）
//   ③ 五种排序是不是真的按那个规则排（读排序后的伤害值核对）
//   ④ 卡牌详情页有没有打开、效果明细 / 关键词齐不齐
//   ⑤ 关键词悬停有没有出浮层
//   ⑥ 战斗手牌放大后会不会横向溢出
//   ⑦ Esc 叠层（详情页开着时按 Esc 不能把底下的卡组页一起关掉）
//
// 参数：
//   ?dgcards=1          跑全部检查
//   ?dgcards=deck        打开卡组页就停（截图用）
//   ?dgcards=detail      打开某张带状态的牌的详情页（截图用）
//   ?dgcards=hand        进战斗、手牌摊开（截图用）
(async () => {
  const log = (...a) => console.log('[d2] [cards]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mode = new URLSearchParams(location.search).get('dgcards') || '1';
  const fails = [];
  const check = (name, ok, extra = '') => {
    log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    if (!ok) fails.push(name);
  };
  const clipped = (node) => (node ? node.scrollHeight - node.clientHeight > 1 : false);
  const q = (s, root = document) => root.querySelector(s);
  const qa = (s, root = document) => [...root.querySelectorAll(s)];
  /** 颜色亮度（0=黑 1=白）：用来判断高亮色是「深墨」还是「亮色」 */
  const lum = (rgb) => {
    const [r, g, b] = (rgb.match(/\d+/g) ?? [0, 0, 0]).map(Number).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  /** 高亮检查：数字必须落在 .kw / .card-num 里面 —— 散在正文里的数字算漏标 */
  const looseDigits = (root) => {
    const bad = [];
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { if (/[0-9]/.test(c.nodeValue)) bad.push(c.nodeValue.trim().slice(0, 12)); }
        else if (c.nodeType === 1 && !c.classList.contains('kw')) walk(c);
      }
    };
    walk(root);
    return bad;
  };

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { CARDS } = await import('../src/data/cards.js');
    const { cardEl } = await import('../src/ui/cards.js');
    const { showDeck } = await import('../src/ui/overlays.js');
    const { cardPowerTotal } = await import('../src/ui/cardtext.js');
    const { t } = await import('../src/core/i18n.js');

    // 这份诊断要能在中文 / 日文 / 英文下都跑（卡面和界面文案都跟着语言走），
    // 所以下面凡是「按文案找元素 / 按文案断言」的地方一律过 t()，
    // 别再拿中文字面量去匹配 —— 否则一换语言就先崩在「找不到元素」上，
    // 后面的高亮 / 关键词检查根本轮不到跑。
    const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    /** 带 {占位符} 的界面文案 → 正则（占位符位置当数字） */
    const tplRe = (zh, names) => new RegExp(
      t(zh).split(new RegExp(names.map((n) => `\\{${n}\\}`).join('|'))).map(reEsc).join('\\d+'),
    );
    /** 卡面里带状态词的牌：状态词按当前语言取（どく / Poison / …） */
    const STATUS_TEXT_RE = new RegExp(['中毒', '剧毒', '灼伤', '虚弱', '出血', '流血'].map((w) => t(w)).join('|'));
    /** 第一张「会给对手挂状态」的牌：配色检查和详情页都要一张能出状态关键词的牌 */
    const firstStatusCard = () => CARDS.find((c) => (c.effects ?? []).some((e) => e.kind === 'status')) ?? CARDS[0];
    /** 「威力 {n}%」角标的前缀（中文「威力 」/ 英文「power 」），数字取占位符之后那一段 */
    const POWER_PREFIX = t('威力 {n}%').split('{n}')[0];

    game.newRun(20240607);
    game.phase = 'map';
    ui.current = null;
    ui.forceRerender();
    await wait(320);

    // 截图模式：把卡组页打开、图鉴展开、按稀有度排序，
    // 让四种稀有度 + 保护/代价标记同屏出现，方便人眼核对配色
    if (new URLSearchParams(location.search).get('dgcards') === 'shot') {
      const { showDeck } = await import('../src/ui/overlays.js');
      const q2 = new URLSearchParams(location.search);
      // &grid=rarity → 四种稀有度各一张并排（最直观的配色对照图）
      if (q2.get('grid') === 'rarity') {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(24,14,10,.94);'
          + 'display:flex;align-items:center;justify-content:center;gap:22px;padding:24px;';
        for (const r of ['common', 'uncommon', 'rare', 'epic']) {
          const card = CARDS.find((c) => c.rarity === r && !c.enemyOnly);
          const box = document.createElement('div');
          box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;';
          box.append(cardEl(card, { size: 'lg' }));
          const label = document.createElement('div');
          label.textContent = `${r} · ${card.name}`;
          label.style.cssText = 'color:#f0e0c0;font:700 14px/1.3 system-ui;';
          box.append(label);
          host.append(box);
        }
        document.body.append(host);
        await wait(400);
        const z0 = Number(q2.get('zoom') ?? 0);
        if (z0 > 0) { document.documentElement.style.zoom = String(z0); await wait(300); }
        log('四种稀有度已并排（截图模式）');
        log('CARD_DONE');
        return;
      }
      game.data.deck = CARDS.slice(0, 40).map((c) => c.id);   // 让网格里有各种稀有度
      showDeck(game);
      await wait(400);
      const wantSort = new URLSearchParams(location.search).get('sort') ?? t('稀有度');
      const tab = [...document.querySelectorAll('.modal-backdrop .sort-tab')].find((n) => n.textContent.trim() === wantSort);
      tab?.click();
      await wait(200);
      const details = document.querySelector('.modal-body details');
      if (details) { details.open = true; details.dispatchEvent(new Event('toggle')); }
      await wait(500);
      // &zoom=2 → 把整页放大两倍再截，方便人眼核对面板上的小字（截图工具本身不下采样）
      const z = Number(new URLSearchParams(location.search).get('zoom') ?? 0);
      if (z > 0) { document.documentElement.style.zoom = String(z); await wait(300); }
      const sc = Number(new URLSearchParams(location.search).get('scroll') ?? 0);
      if (sc > 0) { document.querySelector('.modal-body')?.scrollTo?.(0, sc); await wait(300); }
      log('卡面已就位（截图模式）');
      log('CARD_DONE');
      return;
    }

    // ---------- ① 三档尺寸下的截断检查 ----------
    // 离屏摆一列卡片来量：真实的卡组页一次只显示十来张，量不全 86 张
    function measureAll(opts, label) {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-9999px;top:0;width:240px;display:flex;flex-direction:column;';
      document.body.append(host);
      const rows = [];
      for (const card of CARDS) {
        const node = cardEl(card, opts);
        host.append(node);
        const t = q('.card-text', node);
        const nm = q('.card-name', node);
        rows.push({
          id: card.id, name: card.name, box: `${node.offsetWidth}×${node.offsetHeight}`,
          cut: clipped(t), textH: t.scrollHeight, boxH: t.clientHeight,
          kw: qa('.kw', node).length, nums: qa('.card-num', node).length, tips: qa('[data-tip]').length,
          loose: looseDigits(t),
          // 卡名被 text-overflow: ellipsis 吃掉了吗（名字变大了，得盯住别再被截）
          nameCut: nm.scrollWidth - nm.clientWidth > 1,
          nameFs: parseFloat(getComputedStyle(nm).fontSize),
          textFs: parseFloat(getComputedStyle(t).fontSize),
          nameFw: Number(getComputedStyle(nm).fontWeight),
        });
        node.remove();
      }
      // 检具自检：故意把描述撑到 200 个字，clipped() 必须报 true，
      // 否则「没有截断」这个结论只说明检具坏了。
      const probe = cardEl(CARDS[0], opts);
      host.append(probe);
      const pt = q('.card-text', probe);
      pt.textContent = '截断检具自检'.repeat(40);
      const probeWorks = clipped(pt);
      const probeNums = `可视 ${pt.clientHeight} / 内容 ${pt.scrollHeight}`;
      probe.remove();
      host.remove();
      check(`${label}：截断检具自检`, probeWorks, probeNums);
      return rows;
    }
    for (const [label, opts] of [
      ['sm（卡组列表）', { size: 'sm' }],
      ['md（战斗手牌）', {}],
      ['lg（详情 / 奖励）', { size: 'lg' }],
      // 卡组页的卡左边还要让开「已入选」勾选圈，名字能用的宽度最窄 —— 单独量一遍
      ['sm + 勾选圈（卡组页实况）', { size: 'sm', check: true, checked: true }],
    ]) {
      const rows = measureAll(opts, label);
      const cut = rows.filter((r) => r.cut);
      check(`${label}：86 张卡的描述全部放得下`, cut.length === 0,
        cut.length ? `${cut.length} 张被截：${cut.map((c) => `${c.name}(${c.boxH}<${c.textH})`).join('、')}` : `卡面 ${rows[0].box}`);
      const noHl = rows.filter((r) => r.loose.length);
      check(`${label}：数字都落在高亮片段里`, noHl.length === 0,
        noHl.length ? noHl.map((r) => `${r.name}「${r.loose.join('')}」`).join('、') : `${rows.reduce((s, r) => s + r.nums, 0)} 个数字标记`);
      // 卡名：必须比描述明显大一档、更粗，而且不许被省略号截掉（用户要求「名字大一点、加粗、不要和介绍一个字号」）
      const nameCut = rows.filter((r) => r.nameCut);
      const r0 = rows[0];
      check(`${label}：卡名比描述大且更粗`, r0.nameFs - r0.textFs >= 3 && r0.nameFw >= 800,
        `卡名 ${r0.nameFs}px / ${r0.nameFw}，描述 ${r0.textFs}px（差 ${(r0.nameFs - r0.textFs).toFixed(1)}px）`);
      check(`${label}：86 张卡的卡名都没被省略号截掉`, nameCut.length === 0,
        nameCut.length ? nameCut.map((r) => r.name).join('、') : `最长的名字 ${Math.max(...rows.map((r) => [...r.name].length))} 个字都放得下`);
    }
    // 配色分档：卡面是米黄纸底，高亮必须用**深墨**（亮度低）；
    // 详情页是深色底，同一套语义必须换成亮色 —— 搞反了就是「字看不见」。
    {
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.append(box);
      const sample = cardEl(firstStatusCard(), { size: 'sm' });
      box.append(sample);
      const num = lum(getComputedStyle(q('.card-num', sample)).color);
      const stat = lum(getComputedStyle(q('.kw-status', sample)).color);
      const bodyInk = lum(getComputedStyle(q('.card-text', sample)).color);
      box.remove();
      check('卡面上的高亮是深墨（浅底上看得清）', num < 0.35 && stat < 0.35 && num !== bodyInk,
        `数字亮度 ${num.toFixed(2)} / 状态亮度 ${stat.toFixed(2)} / 正文 ${bodyInk.toFixed(2)}`);
    }
    const statusCards = measureAll({ size: 'sm' }, 'sm（状态词复查）');
    const withStatus = CARDS.filter((c) => STATUS_TEXT_RE.test(c.text));
    const badTip = withStatus.filter((c) => {
      const row = statusCards.find((r) => r.id === c.id);
      return !row || row.tips === 0;
    });
    check('状态词带悬停说明', badTip.length === 0, `共 ${withStatus.length} 张带状态词${badTip.length ? '，缺：' + badTip.map((c) => c.name).join('、') : ''}`);

    // ---------- 打开卡组页（只读） ----------
    const deckModal = showDeck(game);
    await wait(120);
    const grid = q('.modal-body .card-grid');
    const uniqInDeck = new Set(game.data.deck).size;
    log(`卡组页已打开：卡组 ${game.data.deck.length} 张 / ${uniqInDeck} 种，网格里画了 ${qa('.card', grid).length} 张`);
    check('卡组页把同一张牌合成一张画（角标写 ×N），不是有几张画几张',
      qa('.card', grid).length === uniqInDeck, `卡组 ${game.data.deck.length} 张 → 网格 ${qa('.card', grid).length} 张`);
    check('卡组页是只读的：没有勾选圈、没有「保存出战卡组」',
      qa('.card-check', q('.modal-body')).length === 0 && !qa('.modal-foot .btn').some((b) => b.textContent.includes('保存')),
      `勾选圈 ${qa('.card-check', q('.modal-body')).length} 个`);
    check('卡组页说明了「怎么改卡组」（商店删卡 / 营地换卡）',
      q('.modal-body').textContent.includes(t('想精简：去商店买「卡牌移除服务」删掉不要的牌，同一家店里越删越贵。'))
      && q('.modal-body').textContent.includes(t('想换牌：营地的「冥想」可以把一张牌换成随机的高稀有度牌。')),
      (q('.help-card:nth-of-type(2)')?.textContent ?? '').slice(0, 60).replace(/\s+/g, ' '));

    // ---------- ③ 排序 ----------
    // 注意：卡组里同一张牌可能有多份，所以「非递增」而不是「严格递减」
    const clickSort = async (label) => {
      const tab = qa('.sort-tab').find((t) => t.textContent === label);
      if (!tab) throw new Error(`没有「${label}」这个排序按钮`);
      tab.click();
      await wait(60);
      return tab;
    };
    await clickSort(t('威力'));
    // 角标现在是「威力 N%」（攻击力百分比，与玩家当前属性无关），
    // 所以排序后的比较基准也换成 cardPowerTotal —— 用实际伤害比会在不同攻击力下误报
    const dmgOrder = qa('.card', grid).map((n) => {
      const badge = qa('.card-foot .card-badge', n).find((s) => s.textContent.startsWith(POWER_PREFIX));
      return { name: q('.card-name', n).textContent, dmg: badge ? Number(badge.textContent.slice(POWER_PREFIX.length).replace('%', '')) : 0 };
    });
    const sortedOk = dmgOrder.every((v, i, a) => i === 0 || a[i - 1].dmg >= v.dmg);
    check('按威力排序 = 威力降序', sortedOk, dmgOrder.slice(0, 8).map((d) => `${d.name}${d.dmg}`).join(' > '));
    check('排序后威力值来自 cardtext 的计算', dmgOrder.every((d) => {
      const card = CARDS.find((c) => c.name === d.name);
      return !card || cardPowerTotal(card) === d.dmg;
    }));

    await clickSort(t('特殊效果'));
    // 卡组里只有十来张牌，跨不到所有分组 —— 展开图鉴（150 种）再数分组标题才准
    const codex = q('.modal-body details');
    if (codex) {
      codex.open = true;
      codex.dispatchEvent(new Event('toggle'));
      await wait(80);
    }
    const codexGrid = qa('.modal-body .card-grid').pop();
    const groups = qa('.grid-group', codexGrid).map((n) => n.textContent);
    check('特殊效果排序会分组，且 7 个分组都在', groups.length >= 7, groups.join(' / '));

    // ---------- 图鉴的「拿过 / 没拿过」 ----------
    // 用户反馈：图鉴里连没拿过的卡也全是亮的，看着像都已经收集了。
    {
      const { save } = await import('../src/core/save.js');
      const cards = qa('.card', codexGrid);
      const unowned = cards.filter((n) => n.classList.contains('card-unowned'));
      const deckNames = new Set(game.data.deck.map((id) => CARDS.find((c) => c.id === id)?.name));
      const ownedLit = cards.filter((n) => !n.classList.contains('card-unowned') && deckNames.has(q('.card-name', n).textContent));
      check('图鉴里「没拿过」的卡被压暗并标出「未获得」',
        unowned.length > 0 && unowned.every((n) => n.textContent.includes(t('未获得'))),
        `${cards.length} 张里 ${unowned.length} 张未获得，第一张＝「${q('.card-name', unowned[0] ?? cards[0])?.textContent}」`);
      check('图鉴里这一局正带着的卡一张都没被压暗', ownedLit.length === deckNames.size,
        `卡组 ${deckNames.size} 种，其中亮的 ${ownedLit.length} 种`);
      const summary = q('.modal-body details summary')?.textContent ?? '';
      check('图鉴标题写着「已收集 X / N 种」',
        tplRe('（已收集 {got} / {total} 种，点开可以逐个看详情）', ['got', 'total']).test(summary), summary);

      // 「以前拿过但这一局没带」的卡：应该是亮的 + 标「曾拿过」
      const seenId = CARDS.find((c) => !game.data.deck.includes(c.id))?.id;
      save.patchMeta({ seenCards: [...new Set([...(save.readMeta().seenCards ?? []), seenId])] });
      codex.open = false;
      codex.open = true;
      codex.dispatchEvent(new Event('toggle'));
      await wait(100);
      const seenNode = qa('.card', codexGrid).find((n) => q('.card-name', n).textContent === CARDS.find((c) => c.id === seenId).name);
      check('以前拿过的卡是亮的，并标着「曾拿过」',
        !!seenNode && !seenNode.classList.contains('card-unowned') && seenNode.textContent.includes(t('曾拿过')),
        `「${CARDS.find((c) => c.id === seenId).name}」→ ${seenNode?.classList.contains('card-unowned') ? '被压暗了' : '亮的'}｜${qa('.card-foot span', seenNode ?? cards[0]).map((s) => s.textContent).join(',')}`);

      // 拿到新卡时要写进跨局记录（图鉴靠它认「以前拿过」）
      const before = (save.readMeta().seenCards ?? []).length;
      game.save();
      const after = (save.readMeta().seenCards ?? []).length;
      check('本局卡组会被记进跨局图鉴记录', after >= new Set(game.data.deck).size,
        `记录 ${before} → ${after} 种（卡组 ${new Set(game.data.deck).size} 种）`);
    }
    const effOrder = qa('.card', grid).map((n) => q('.card-name', n).textContent);
    log(`特殊效果排序前 10：${effOrder.slice(0, 10).join('、')}`);
    if (codex) { codex.open = false; }

    await clickSort(t('费用'));
    const apOrder = qa('.card', grid).map((n) => Number(q('.card-ap', n).textContent));
    check('按费用排序 = 费用升序', apOrder.every((v, i, a) => i === 0 || a[i - 1] <= v), apOrder.join(','));

    await clickSort(t('稀有度'));
    const rarOrder = qa('.card', grid).map((n) => {
      const cls = [...n.classList].find((c) => c.startsWith('card-') && !['card-sm', 'card-common'].includes(c) && ['card-common', 'card-uncommon', 'card-rare', 'card-epic'].includes(c));
      return cls ?? 'card-common';
    });
    const RANK = { 'card-common': 0, 'card-uncommon': 1, 'card-rare': 2, 'card-epic': 3 };
    check('按稀有度排序 = 稀有度降序', rarOrder.every((v, i, a) => i === 0 || RANK[a[i - 1]] >= RANK[v]), rarOrder.join(','));
    await clickSort(t('默认'));

    // ---------- ④b 稀有度：四件套必须真的不一样 ----------
    // 用户反馈「稀有卡略微看不出来」。以前只有顶上那条 4px 色带 + 一圈很淡的内描边。
    {
      const probe = (rarity) => {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.append(host);
        host.append(cardEl(CARDS.find((c) => c.rarity === rarity), { size: 'sm' }));
        const n = q('.card', host);
        const cs = getComputedStyle(n);
        const out = {
          bg: cs.backgroundImage,
          frame: cs.boxShadow,
          ink: getComputedStyle(q('.card-name', n)).color,
          bodyInk: getComputedStyle(q('.card-text', n)).color,
          art: getComputedStyle(q('.card-art', n)).backgroundImage,
          gem: getComputedStyle(q('.rarity-gem', n)).backgroundColor,
          // 卡面纸色本身（这才是「底色」）—— 第一版只叠了一层会淡出的色调，
          // 玩家反馈「卡的底色并没有更改」，所以这里直接盯住这三个变量
          paper1: cs.getPropertyValue('--card-paper-1').trim(),
          paper2: cs.getPropertyValue('--card-paper-2').trim(),
          paper3: cs.getPropertyValue('--card-paper-3').trim(),
          artColor: cs.getPropertyValue('--card-art-2').trim(),
        };
        host.remove();
        return out;
      };
      const r = { common: probe('common'), uncommon: probe('uncommon'), rare: probe('rare'), epic: probe('epic') };
      const uniq = (key) => new Set([r.common[key], r.uncommon[key], r.rare[key], r.epic[key]]).size;
      // 卡面**底色本身**必须四档各不相同（不是只有描边和色带）
      check('卡面底色（纸色）按稀有度不同', uniq('paper1') === 4 && uniq('paper2') === 4 && uniq('paper3') === 4,
        `普通 ${r.common.paper1} / 精良 ${r.uncommon.paper1} / 稀有 ${r.rare.paper1} / 史诗 ${r.epic.paper1}`);
      check('美术横幅底色也跟着稀有度走', uniq('artColor') === 4,
        `普通 ${r.common.artColor} / 稀有 ${r.rare.artColor} / 史诗 ${r.epic.artColor}`);
      check('正文颜色跟着底色走（蓝底用蓝黑，不是一律褐墨）', uniq('bodyInk') === 4,
        `普通 ${r.common.bodyInk} / 稀有 ${r.rare.bodyInk} / 史诗 ${r.epic.bodyInk}`);
      check('卡面底纹按稀有度不同',
        new Set([r.common.bg, r.uncommon.bg, r.rare.bg, r.epic.bg]).size === 4,
        `普通/精良/稀有/史诗 四种底纹互不相同`);
      check('美术横幅底纹按稀有度不同',
        new Set([r.common.art, r.rare.art, r.epic.art]).size === 3, '三种横幅底纹互不相同');
      check('描边颜色按稀有度不同',
        new Set([r.common.frame, r.rare.frame, r.epic.frame]).size === 3,
        `普通 ${r.common.frame.slice(0, 24)}… / 稀有 ${r.rare.frame.slice(0, 24)}…`);
      check('卡名颜色按稀有度不同（普通最深、史诗偏紫）', uniq('ink') === 4,
        `普通 ${r.common.ink} / 精良 ${r.uncommon.ink} / 稀有 ${r.rare.ink} / 史诗 ${r.epic.ink}`);
      check('底栏有稀有度宝石，且颜色跟着稀有度走',
        r.rare.gem !== r.common.gem && r.epic.gem !== r.rare.gem,
        `${r.common.gem} → ${r.rare.gem} → ${r.epic.gem}`);
      const gemTip = (() => {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.append(host);
        host.append(cardEl(CARDS.find((c) => c.rarity === 'epic'), { size: 'sm' }));
        const t = q('.rarity-gem', host)?.dataset.tip ?? '';
        host.remove();
        return t;
      })();
      check('宝石的悬停说明写明了稀有度',
        gemTip.includes(t('稀有度：{rarity}\n卡面配色、描边、卡名颜色都跟着稀有度走。', { rarity: t('史诗') })),
        gemTip.split('\n')[0]);
    }

    // ---------- ④c 角色标记：保护 / 代价 ----------
    // 用户需求：「给予保护的、负面特性的卡牌都可以添加额外的标识」。
    // 这里**从 effects 反推期望值**，再和界面上挂出来的标记对账 ——
    // 光看有没有标记没用，标错了更糟（玩家会按错的印象出牌）。
    {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.append(host);
      const rows = CARDS.filter((c) => !c.enemyOnly).map((c) => {
        host.append(cardEl(c, { size: 'sm' }));
        const n = host.lastElementChild;
        const got = [...n.querySelectorAll('.card-role')].map((x) => x.textContent.trim());
        host.removeChild(n);
        const fx = c.effects ?? [];
        const isSelf = (e) => e.target !== 'enemy';
        const wantProtect = fx.some((e) => e.kind === 'shield' || e.kind === 'heal' || e.kind === 'cleanse'
          || (e.kind === 'damage' && (e.drainPct ?? 0) > 0)
          || (e.kind === 'buff' && isSelf(e) && e.stat === 'def' && ((e.amount ?? 0) > 0 || (e.pct ?? 0) > 0)));
        const wantCost = fx.some((e) => e.kind === 'selfDmg'
          || (e.kind === 'damage' && (e.recoilPct ?? 0) > 0)
          || (e.kind === 'buff' && isSelf(e) && ((e.amount ?? 0) < 0 || (e.pct ?? 0) < 0)));
        return { id: c.id, name: c.name, got, wantProtect, wantCost };
      });
      host.remove();
      const roleProtect = t('保护');
      const roleCost = t('代价');
      const missProtect = rows.filter((r) => r.wantProtect && !r.got.includes(roleProtect));
      const falseProtect = rows.filter((r) => !r.wantProtect && r.got.includes(roleProtect));
      const missCost = rows.filter((r) => r.wantCost && !r.got.includes(roleCost));
      const falseCost = rows.filter((r) => !r.wantCost && r.got.includes(roleCost));
      check('给护盾 / 回血 / 加防 / 解负面的牌都挂了「保护」', missProtect.length === 0,
        missProtect.length ? missProtect.map((r) => r.name).join('、') : `${rows.filter((r) => r.wantProtect).length} 张`);
      check('没有保护效果的牌不会误挂「保护」', falseProtect.length === 0,
        falseProtect.length ? falseProtect.map((r) => r.name).join('、') : '无误标');
      check('自伤 / 反伤 / 削弱自己的牌都挂了「代价」', missCost.length === 0,
        missCost.length ? missCost.map((r) => r.name).join('、') : `${rows.filter((r) => r.wantCost).length} 张`);
      check('没有代价的牌不会误挂「代价」', falseCost.length === 0,
        falseCost.length ? falseCost.map((r) => r.name).join('、') : '无误标');
      const roleTip = rows.find((r) => r.got.includes(roleProtect))?.name ?? '';
      check('「保护 / 代价」标记都在真实卡池里出现过', roleTip !== '' && rows.some((r) => r.got.includes(roleCost)),
        `例：${roleTip} 有「保护」`);
    }

    // ---------- ④d 底栏不许溢出（多挂了两个标记之后要重新量） ----------
    {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.append(host);
      const overflow = [];
      for (const size of ['sm', undefined, 'lg']) {
        for (const c of CARDS) {
          host.append(cardEl(c, { size, badges: ['×3', '未获得'] }));
          const footL = q('.foot-left', host.lastElementChild);
          if (footL && footL.scrollWidth > footL.clientWidth + 1) {
            overflow.push(`${size ?? 'md'}/${c.name}(${footL.scrollWidth}>${footL.clientWidth})`);
          }
          host.removeChild(host.lastElementChild);
        }
      }
      host.remove();
      check('底栏（宝石 + 类型 + 保护/代价 + 角标）三档尺寸都不溢出', overflow.length === 0,
        overflow.length ? `${overflow.length} 张：${overflow.slice(0, 5).join('、')}` : `150 张 × 3 档都放得下`);
    }

    // ---------- ⑤ 悬停说明（在卡面上） ----------
    const kwSpan = q('.card-text .kw-status[data-tip], .card-text .kw[data-tip]', grid);
    if (kwSpan) {
      kwSpan.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await wait(60);
      const layer = q('.tip-layer');
      check('卡面关键词悬停会弹说明', layer?.classList.contains('show') && layer.textContent.length > 6,
        `「${kwSpan.textContent}」→ ${(layer?.textContent ?? '').replace(/\n/g, ' / ').slice(0, 60)}…`);
      kwSpan.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    } else {
      check('卡面关键词悬停会弹说明', false, '网格里没找到带 data-tip 的关键词');
    }

    // ---------- ④ 详情页 ----------
    // 挑一张带状态词的牌，保证效果明细和关键词两栏都有东西
    const targetName = firstStatusCard().name;
    const targetNode = qa('.card', grid).find((n) => q('.card-name', n).textContent === targetName) ?? q('.card', grid);
    targetNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(120);
    const detail = q('.card-detail');
    check('点卡牌会打开详情页', !!detail, detail ? `标题＝${q('.modal-head h3')?.textContent}` : '没找到 .card-detail');
    if (detail) {
      const big = q('.card-static', detail);
      const desc = q('.detail-desc', detail);
      const rows = qa('.detail-row', detail);
      const kws = qa('.detail-kw span', detail);
      check('详情页有大卡面', !!big, big ? `${big.offsetWidth}×${big.offsetHeight}` : '没有');
      check('详情页有完整说明', !!desc && desc.textContent.length > 4, `「${desc?.textContent ?? ''}」`);
      check('详情页有剩余文案没被截断', !clipped(desc), desc ? `内容 ${desc.scrollHeight} / 可视 ${desc.clientHeight}` : '');
      check('详情页有效果明细', rows.length > 0, rows.map((r) => `${q('.dr-label', r).textContent}=${q('.dr-value', r).textContent}`).join(' | '));
      check('详情页有可悬停的关键词', kws.length > 0, kws.map((k) => k.textContent).join('、'));
      {
        const descKw = q('.detail-desc .kw', detail) ?? kws[0];
        const l1 = lum(getComputedStyle(descKw).color);
        const l2 = kws[0] ? lum(getComputedStyle(kws[0]).color) : l1;
        const chipInk = lum(getComputedStyle(q('.detail-desc', detail)).color);
        check('详情页（深底）上的高亮是亮色', l1 > 0.35 && l2 > 0.35,
          `说明里的关键词亮度 ${l1.toFixed(2)} / 词条 ${l2.toFixed(2)} / 正文 ${chipInk.toFixed(2)}`);
      }
      if (kws[0]) {
        kws[0].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await wait(60);
        check('详情页关键词悬停有说明', q('.tip-layer')?.classList.contains('show'), (q('.tip-layer')?.textContent ?? '').slice(0, 50));
        kws[0].dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      }

      // 详情页现在是只读的：只报「这张牌带了几份」，没有加入 / 拿掉按钮
      {
        const actions = qa('.detail-actions .btn');
        const st = q('.detail-deckstate')?.textContent ?? '';
        check('只读的详情页没有加入 / 拿掉按钮，只说明这张牌带了几份',
          actions.length === 0 && tplRe('你的卡组里有这张：{owned} 张', ['owned']).test(st), `按钮 ${actions.length} 个｜说明「${st}」`);
      }

      if (mode === 'detail') {
        // 截图用：换一张效果最多的牌（盐腌：2 种状态 + 降防 + 销毁），
        // 这样「效果明细」一栏能看出它到底能列多少东西
        const rich = CARDS.find((c) => c.id === 'salt_cure') ?? CARDS[0];
        const { showCardDetail } = await import('../src/ui/overlays.js');
        showCardDetail(rich, { state: () => ({ picked: 2, owned: 3, readOnly: true }) });
        await wait(150);
        log(`（截图模式：停在「${rich.name}」的详情页）`);
        log('CARD_DONE');
        return;
      }

      // ---------- ⑦ Esc 只关最上面一层 ----------
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(80);
      check('Esc 关掉详情页', !q('.card-detail'));
      check('Esc 之后底下的卡组页还在', !!q('.sort-bar'), q('.modal-head h3')?.textContent ?? '(没了)');
    }

    if (mode === 'codex') {
      // 截图用：展开图鉴并滚到它，看「拿过 / 没拿过」的区分
      showDeck(game);
      await wait(180);
      const codexEl = q('.modal-body details');
      if (codexEl) {
        codexEl.open = true;
        codexEl.dispatchEvent(new Event('toggle'));
        await wait(160);
        codexEl.scrollIntoView({ block: 'start' });
        await wait(120);
      }
      const un = qa('.card-grid .card-unowned').length;
      log(`（截图模式：图鉴，${qa('.card-grid .card').length} 张里 ${un} 张未获得｜${q('.modal-body details summary')?.textContent}）`);
      log('CARD_DONE');
      return;
    }

    if (mode === 'tip') {
      // 截图用：把鼠标停在卡面的状态词上，让悬停说明留在屏幕上
      showDeck(game);
      await wait(150);
      const span = qa('.card-text .kw-status[data-tip]')[0] ?? qa('.card-text .kw[data-tip]')[0];
      span?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await wait(120);
      const layer = q('.tip-layer');
      // 截图专用：把过渡掐掉、透明度钉死。
      // 虚拟时间下截图是在「加类的那一帧」拍的，0.12s 的淡入还没画上去，
      // 拍出来就是「明明触发了却看不到浮层」。
      if (layer) { layer.style.transition = 'none'; layer.style.opacity = '1'; layer.style.transform = 'none'; }
      const lr = layer?.getBoundingClientRect();
      log(`（截图模式：悬停「${span?.textContent}」→ ${(layer?.textContent ?? '').replace(/\n/g, ' / ')}）`);
      log(`浮层：class=${layer?.className} opacity=${layer ? getComputedStyle(layer).opacity : '-'} rect=${lr ? `${Math.round(lr.left)},${Math.round(lr.top)} ${Math.round(lr.width)}×${Math.round(lr.height)}` : '-'} 视口=${innerWidth}×${innerHeight}`);
      log('CARD_DONE');
      return;
    }

    if (mode === 'deck') {
      // 上面那串检查已经把弹出关了，重新开一份干净的卡组页用来截图
      showDeck(game);
      await wait(150);
      qa('.sort-tab').find((t2) => t2.textContent === t('特殊效果'))?.click();
      await wait(80);
      log('（截图模式：停在卡组页）');
      log('CARD_DONE');
      return;
    }

    // ---------- ⑥ 战斗手牌 ----------
    if (q('.modal-backdrop')) deckModal.close();
    game.startBattle('normal', 0);
    ui.current = null;
    ui.forceRerender();
    await wait(1200);
    const bs = ui.battleScreen;
    const handEl = q('.hand');
    const hand = qa('.card', handEl);
    const over = handEl ? handEl.getBoundingClientRect() : null;
    check('战斗手牌比原来大', hand.length > 0 && hand[0].offsetWidth >= 180, hand.length ? `${hand.length} 张，卡面 ${hand[0].offsetWidth}×${hand[0].offsetHeight}` : '手牌是空的');
    if (hand.length) {
      const cut = hand.map((n) => ({ n: q('.card-name', n).textContent, cut: clipped(q('.card-text', n)), h: q('.card-text', n).scrollHeight, box: q('.card-text', n).clientHeight }));
      check('手牌里的描述没有截断', cut.every((c) => !c.cut), cut.map((c) => `${c.n}${c.cut ? `(截:${c.box}<${c.h})` : ''}`).join('、'));
      check('手牌横向不溢出屏幕', over.right <= innerWidth + 1 && over.left >= -1,
        `手牌区间 ${Math.round(over.left)}~${Math.round(over.right)} / 视口 ${innerWidth}，重叠 ${getComputedStyle(handEl).getPropertyValue('--hand-overlap').trim()}`);
      check('手牌里的数字 / 状态也标出来了', qa('.kw', handEl).length > 0, `${qa('.kw', handEl).length} 个标记`);
    }
    // 出牌展示区的卡面尺寸是 JS 按可用空间算的，比例必须跟卡面一致（不然摊开的牌会被拉变形）
    const zone = q('.play-zone');
    if (zone) {
      const cs = getComputedStyle(zone);
      const zw = parseFloat(cs.getPropertyValue('--card-w'));
      const zh = parseFloat(cs.getPropertyValue('--card-h'));
      check('出牌展示区的宽高比跟卡面一致', zw > 0 && zh > 0 && Math.abs(zw / zh - 186 / 190) < 0.08,
        `${zw}×${zh}（比例 ${(zw / zh).toFixed(3)}，卡面 0.979）`);
    }
    log('CARD_DONE');
    if (fails.length) log(`ERRORS=[${fails.join(' / ')}]`);
  } catch (err) {
    log('崩了：', err?.message ?? err);
    log(String(err?.stack ?? '').split('\n').slice(0, 4).join(' | '));
    log('CARD_DONE');
  }
})();
