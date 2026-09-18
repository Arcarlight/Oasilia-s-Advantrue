// 动画诊断（截图用）：
//   ?dganim=draw     让手牌播「从下滑上来」的入场动画，并定格在 40% 进度
//   ?dganim=shatter  让场上那张牌播「碎裂」动画，并定格在 45% 进度
//   ?dganim=1        两种都跑一遍（手牌 + 碎裂），打印节点数
// 定格是为了截图可复现：动画本身只有半秒，靠时间去撞很容易拍空。
(async () => {
  const log = (...a) => console.log('[d2] [dganim]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { CARD_BY_ID } = await import('../src/data/cards.js');
    const mode = new URLSearchParams(location.search).get('dganim') || '1';

    game.newRun(1234);
    game.startBattle('normal', 0);
    // 走一次正常切屏：不然标题页会盖在战斗界面上面（第一次截图就是这么拍空的）
    ui.current = null;
    ui.forceRerender();
    await wait(700);
    const bs = ui.battleScreen;
    if (!bs) { log('没有 battleScreen'); log('DGA_DONE'); return; }

    // 手里塞一张带「销毁」的牌，方便演碎裂
    const exhaustCard = ['earthquake', 'dragon_claw', 'heat_wave', 'boomburst'].find((id) => CARD_BY_ID[id]?.exhaust);
    log(`用于碎裂的牌：${exhaustCard}（${CARD_BY_ID[exhaustCard]?.name}）`);

    if (mode === 'ap' || mode === 'apf') {
      // ① 先用「界面副本」直接触发一次消耗，并把动画定格下来（截图用）
      bs.disp.player.ap = bs.battle.player.apMax;
      bs._shownAp = bs.battle.player.apMax;
      bs.refreshTurn();
      bs.disp.player.ap = Math.max(0, bs.battle.player.apMax - 3);
      bs.refreshTurn();
      const spending = [...bs.apOrbs.querySelectorAll('.ap-orb-spending')];
      log(`触发了 ${spending.length} 颗「正在消耗」的 AP 球（满 ${bs.battle.player.apMax} → ${bs.disp.player.ap}）`);
      for (const [i, o] of spending.entries()) {
        o.style.animationDelay = `${-110 - i * 40}ms`;
        o.style.animationPlayState = 'paused';
      }
      const probe = spending[0] ? getComputedStyle(spending[0]) : null;
      if (probe) log(`定格后球 transform=${probe.transform} opacity=${probe.opacity}`);
      log(`AP 文本 = ${bs.apText.textContent}`);
      log(`飘字 = ${[...document.querySelectorAll('.float-text')].map((n) => n.textContent).join(' / ') || '(没有)'}`);
      if (mode === 'apf') { log('DGA_DONE'); return; }   // apf = 只定格，给截图用
      // ② 再真打一张牌，确认走完整流程后 AP 显示是对的
      const hand = bs.battle.hand('player');
      const card = hand.find((c) => (c.card.ap ?? 1) >= 2) ?? hand[0];
      if (card) {
        log(`真打一张：${card.card.name}（${card.card.ap} 费）`);
        await bs.playCard(card.uid);
        const orbs = [...bs.apOrbs.children];
        log(`打完后 AP 文本=${bs.apText.textContent}，亮 ${orbs.filter((o) => !o.classList.contains('spent')).length} / 灭 ${orbs.filter((o) => o.classList.contains('spent')).length}`);
      }
      log('DGA_DONE');
      return;
    }

    if (mode === 'cursor') {
      // 光标主题色：三种地图各切一次，看注入的 CSS 是不是跟着换色
      const { BIOMES } = await import('../src/data/balance.js');
      const { cursorStatus } = await import('../src/ui/cursor.js');
      const { generateMap } = await import('../src/data/mapgen.js');
      const { STAGE_BIOME } = await import('../src/data/balance.js');
      for (const b of ['desert', 'tide', 'night']) {
        const stage = STAGE_BIOME.indexOf(b);
        game.data.stage = stage;
        game.data.map = generateMap(stage, game.rng);
        game.phase = 'map';
        ui.render();
        await wait(700);
        const st = cursorStatus();
        const tag = document.getElementById('cursor-theme');
        const usesData = (tag?.textContent.match(/url\(data:image\/png/g) || []).length;
        log(`${b}（主题色 ${BIOMES[b].accent}）→ 主题色 ${st.color} / 描边深色 ${st.outline}，data URL ${usesData} 个，CSS ${st.bytes} 字节`);
        // 像素级核对：把生成的光标画到 canvas 上数一数 —— 「白边在外、深色本体在内」应该是
        // 大量接近 bodyColor 的像素 + 一圈接近白色的像素，两者都要有
        const m = /url\(data:image\/png;base64,([^)]+)\)/.exec(tag?.textContent ?? '');
        if (m) {
          const im = new Image();
          await new Promise((res) => { im.onload = res; im.onerror = res; im.src = 'data:image/png;base64,' + m[1]; });
          const cv = document.createElement('canvas');
          cv.width = im.width; cv.height = im.height;
          const cx = cv.getContext('2d');
          cx.drawImage(im, 0, 0);
          const d = cx.getImageData(0, 0, cv.width, cv.height).data;
          let white = 0, body = 0, other = 0;
          const want = st.outline.replace('#', '');
          const wr = parseInt(want.slice(0, 2), 16), wg = parseInt(want.slice(2, 4), 16), wb = parseInt(want.slice(4, 6), 16);
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 40) continue;
            const r = d[i], g = d[i + 1], bl = d[i + 2];
            if (r > 235 && g > 235 && bl > 235) white++;
            else if (Math.abs(r - wr) < 26 && Math.abs(g - wg) < 26 && Math.abs(bl - wb) < 26) body++;
            else other++;
          }
          log(`  像素：白边 ${white} / 深色本体 ${body} / 其它 ${other}（本体应明显多于白边）`);
        }
      }
      log('DGA_DONE');
      return;
    }

    if (mode === 'tip') {
      // 悬停说明：给副本塞两个状态 → 把鼠标「移」到一个带 data-tip 的元素上 → 看浮层
      bs.disp.player.weak = 2;
      bs.disp.player.burn = 1;
      bs.refreshSide('player');
      const targets = [...document.querySelectorAll('[data-tip]')];
      log(`带悬停说明的元素 ${targets.length} 个`);
      const chip = document.querySelector('.status-chip[data-tip]') ?? targets[0];
      log(`取第一个：${chip?.className ?? '(没有)'} → 「${(chip?.dataset.tip ?? '').split('\n')[0]}」`);
      chip?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      const layer = document.querySelector('.tip-layer');
      log(`浮层显示了吗：${layer?.classList.contains('show')}，文本=${layer?.textContent?.split('\n').join(' / ')}`);
      log(`浮层 HTML（看 ** 有没有变成 <b>）：${(layer?.innerHTML ?? '').replace(/\n/g, ' / ').slice(0, 130)}`);
      // 再检查中间那个威胁胶囊的说明（它原来带着 ** 星号）
      const intent = document.querySelector('.intent[data-tip]');
      intent?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      log(`威胁胶囊说明 HTML：${(document.querySelector('.tip-layer')?.innerHTML ?? '').replace(/\n/g, ' / ').slice(0, 130)}`);
      log(`朝向：玩家 dirRow=${document.querySelector('.player-body canvas')?.dirRow} 敌人 dirRow=${document.querySelector('.enemy-body canvas')?.dirRow}（右上=3 / 左下=7）`);
      log('DGA_DONE');
      return;
    }

    if (mode === 'status') {
      // 决定性检查：引擎里塞上状态、演出副本保持 0 → 胶囊必须**不显示**。
      // 以前胶囊读的是引擎实时值，所以整个敌方回合一算完它就先冒出来了
      // （表现就是「招还没打到我身上，虚弱已经挂上了」）。
      bs.battle.player.weak = 3;
      bs.battle.player.poison = 2;
      bs.disp.player.weak = 0;
      bs.disp.player.poison = 0;
      bs.refreshSide('player');
      const pills = () => [...document.querySelectorAll('.status-chip')].map((n) => n.textContent.trim());
      log(`引擎 weak=3/poison=2，副本 0 → 胶囊应 0 个，实际 ${pills().length} 个 ${pills().join(',') || '(空)'}`);
      bs.disp.player.weak = 3;
      bs.disp.player.poison = 2;
      bs.refreshSide('player');
      log(`副本推进到 weak=3/poison=2 → 胶囊应 2 个，实际 ${pills().length} 个 ${pills().join(',') || '(空)'}`);
      // 再确认事件推进：一条 status 事件只加对应那一项
      bs.disp.player.weak = 0;
      bs.disp.player.poison = 0;
      bs.applyEventToDisp({ type: 'status', side: 'player', status: 'weak', value: 1 });
      bs.refreshSide('player');
      log(`只推进一条 weak 事件 → 胶囊 ${pills().length} 个 ${pills().join(',') || '(空)'}`);
      log('DGA_DONE');
      return;
    }

    if (mode === 'draw' || mode === '1') {
      // 清掉「已见」记录，让现有手牌当成新抽到的牌，从而触发入场动画
      bs._handSeen = new Set();
      bs.renderHand();
      const cards = [...bs.handEl.querySelectorAll('.card.card-draw-in')];
      log(`入场动画的卡数 = ${cards.length}`);
      for (const [i, c] of cards.entries()) {
        // 重新起一次动画再定格：动画只有半秒，直接暂停很可能它已经播完了
        c.style.animation = 'none';
        void c.offsetWidth;
        c.style.animation = '';
        c.style.animationDelay = `${-200 - i * 20}ms`;
        c.style.animationPlayState = 'paused';
      }
      const probe = cards[0] ? getComputedStyle(cards[0]) : null;
      if (probe) log(`定格后 transform=${probe.transform} opacity=${probe.opacity}`);
      if (mode === 'draw') { log('DGA_DONE'); return; }
    }

    if (mode === 'shatter' || mode === '1') {
      // 直接走一次「摊牌 → 销毁」的流程
      await bs.revealCard('player', exhaustCard, CARD_BY_ID[exhaustCard].ap ?? 1);
      const held = bs._heldExhaust;
      log(`摊在场上等销毁的牌：${held ? held.id : '(没有，说明这张牌不是销毁牌)'}`);
      if (held) {
        const r = held.node.getBoundingClientRect();
        log(`被销毁的卡位置：left=${r.left.toFixed(0)} top=${r.top.toFixed(0)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}（视口 ${innerWidth}x${innerHeight}）`);
        bs.shatter(held.node);
        const shards = [...document.querySelectorAll('.card-shard')];
        log(`碎片数 = ${shards.length}`);
        const sr = shards[0]?.getBoundingClientRect();
        if (sr) log(`第一片碎片位置：left=${sr.left.toFixed(0)} top=${sr.top.toFixed(0)} ${sr.width.toFixed(0)}x${sr.height.toFixed(0)}`);
        for (const s of shards) {
          const d = parseFloat(s.style.animationDelay) || 0;
          s.style.animation = 'none';
          void s.offsetWidth;
          s.style.animation = '';
          s.style.animationDelay = `${d - 260}ms`;
          s.style.animationPlayState = 'paused';
        }
        // 虚时间会立刻跑完「1.2 秒后移除碎片」，所以克隆一份冻结的画面留到截图
        const host = shards[0]?.parentElement ?? null;
        log(`碎片父节点 = ${host?.className ?? '(没有)'}，host 数 = ${document.querySelectorAll('.shatter-host').length}`);
        if (host) {
          const frozen = host.cloneNode(true);
          document.body.append(frozen);
          log(`克隆后 host 数 = ${document.querySelectorAll('.shatter-host').length}，克隆体可见性=${getComputedStyle(frozen).visibility} z=${getComputedStyle(frozen).zIndex}`);
        }
        const probe = shards[0] ? getComputedStyle(shards[0]) : null;
        if (probe) log(`定格后碎片 transform=${probe.transform} opacity=${probe.opacity}`);
      }
    }
    log('DGA_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('DGA_DONE');
  }
})();
