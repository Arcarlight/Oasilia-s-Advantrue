// 存档：localStorage 为主（游戏数据很小），另外支持导出 / 导入 JSON 文件。

const KEY = 'oasis_desert_spirit_save_v1';
const META_KEY = 'oasis_desert_spirit_meta_v1';

/**
 * 跨局记录里最多留几局战绩。
 *
 * localStorage 只有几 MB，而一条战绩带着整副卡组的 id（约 40 个字符串）——
 * 不封顶的话，玩上几百局就会把配额撑满，那时**连存档都写不进去**了
 * （`setItem` 抛异常 → save() 静默失败，玩家丢进度）。30 局够回顾了。
 */
export const HISTORY_MAX = 30;

export const save = {
  writeRun(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, at: Date.now(), data }));
      return true;
    } catch {
      return false;
    }
  },
  readRun() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.v === 1 ? parsed.data : null;
    } catch {
      return null;
    }
  },
  clearRun() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  },

  // ---- 跨局记录 ----
  readMeta() {
    const fallback = {
      bestDistance: 0, bestStage: 0, runs: 0, wins: 0, kills: 0, unlocked: false,
      seenCards: [], seenEnemies: [], slainEnemies: [], history: [], heardBgm: [], seenItems: [],
      slainCount: {}, facedCount: {}, clearedHeroes: [], heroCleared: {}, hero: 'oasilia',
    };
    try {
      const raw = localStorage.getItem(META_KEY);
      const meta = raw ? JSON.parse(raw) : fallback;
      /**
       * 老存档里没有这些字段（卡牌图鉴 / 敌人图鉴 / 通关记录都是**后加的**）。
       * 一律在这里补成空数组，别让调用方到处判空 ——
       * 少补一个，「图鉴一打开就白屏」这种事就会在某台老存档的机器上发生。
       */
      if (!Array.isArray(meta.seenCards)) meta.seenCards = [];
      if (!Array.isArray(meta.seenEnemies)) meta.seenEnemies = [];
      if (!Array.isArray(meta.slainEnemies)) meta.slainEnemies = [];
      if (!Array.isArray(meta.history)) meta.history = [];
      if (!Array.isArray(meta.heardBgm)) meta.heardBgm = [];
      /**
       * 见过 / 拿到过的**道具**（手持道具图鉴用）。
       *
       * 和卡牌图鉴同一套规则：没拿过的画成剪影 + ？？？，拿到手（买到 / 开箱 / 掉落）
       * 就永久记下来。老存档补成空数组（图鉴会显示成「全都还没见过」，不会白屏）。
       */
      if (!Array.isArray(meta.seenItems)) meta.seenItems = [];
      /**
       * **无尽模式**（用户要的：通关第一次之后解锁的另一个入口）：
       *   endlessUnlocked  通关过一次没有（解锁条件）
       *   endlessBest      无尽模式走到过的最远章节（1-based；标题页与结算页显示它）
       */
      if (meta.endlessUnlocked !== true) meta.endlessUnlocked = !!meta.endlessUnlocked;
      if (!Number.isFinite(meta.endlessBest)) meta.endlessBest = 0;
      /**
       * **主角（3.0 起有两位）**：
       *   hero            标题页点头图选的那位（下一次开局的默认主角）
       *   clearedHeroes   谁通过关（数组）—— 另一位主角的解锁条件就是它
       *   heroCleared     谁通过关（id → true）—— 无尽模式按主角分开解锁
       *
       * 老存档的补法：**已经通关过**（`unlocked === true`，那是 3.0 之前的通关标记，
       * 当时只有欧亚西莉亚）就补成「欧亚西莉亚通关过」。不补的话，老玩家升级到 3.0
       * 会发现新主角锁着，得再通一次关 —— 那不是他要的结果。
       */
      if (!Array.isArray(meta.clearedHeroes)) meta.clearedHeroes = meta.unlocked === true ? ['oasilia'] : [];
      if (!meta.heroCleared || typeof meta.heroCleared !== 'object') {
        meta.heroCleared = meta.clearedHeroes.includes('oasilia') ? { oasilia: true } : {};
      }
      if (typeof meta.hero !== 'string' || !meta.hero) meta.hero = meta.clearedHeroes.includes('atlas') ? 'atlas' : 'oasilia';
      // 击败**次数**（id -> 次数）：图鉴的奖牌（5 / 15 / 25 / 50 次）靠它。
      // 老存档没有这份计数，此时图鉴按「slainEnemies 里有 = 打赢过 1 次」算（见 codex.js）。
      if (!meta.slainCount || typeof meta.slainCount !== 'object') meta.slainCount = {};
      if (!meta.facedCount || typeof meta.facedCount !== 'object') meta.facedCount = {};
      return meta;
    } catch {
      return fallback;
    }
  },
  writeMeta(meta) {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* ignore */ }
  },
  patchMeta(patch) {
    const m = { ...this.readMeta(), ...patch };
    this.writeMeta(m);
    return m;
  },

  /**
   * 记下「拿到过哪些卡」（跨局累加）。
   *
   * 卡牌图鉴靠它把「没见过 / 以前拿过 / 这一局正带着」区分开 ——
   * 以前图鉴把 86 张按同一个亮度全画出来，玩家以为「没拿过的也算已收集」（用户反馈）。
   * 只在真的新增了卡时才写盘，避免每次 save() 都动 localStorage。
   */
  noteCards(ids = []) {
    const meta = this.readMeta();
    const seen = new Set(meta.seenCards ?? []);
    let added = 0;
    for (const id of ids) {
      if (id && !seen.has(id)) { seen.add(id); added += 1; }
    }
    if (!added) return meta;
    const next = { ...meta, seenCards: [...seen] };
    this.writeMeta(next);
    return next;
  },

  /**
   * 记下「见过 / 拿到过哪些**道具**」（跨局累加），道具图鉴靠它分两档：
   *   没拿过（压暗 + ？？？）/ 拿到过（图标 + 效果 + 出处）。
   *
   * 触发点只有一个：`Game.giveItem()` —— 买到、开箱、掉落全都经过它，
   * 所以不用在商人 / 宝箱 / 掉落三处各记一次（那种散着记的写法一定会漏一处）。
   */
  noteItems(ids = []) {
    const meta = this.readMeta();
    const seen = new Set(meta.seenItems ?? []);
    let added = 0;
    for (const id of ids) {
      if (id && !seen.has(id)) { seen.add(id); added += 1; }
    }
    if (!added) return meta;
    const next = { ...meta, seenItems: [...seen] };
    this.writeMeta(next);
    return next;
  },

  /**
   * 无尽模式的成绩：`chapter` 是 1-based 的「走到了第几章」。
   * 只在打破纪录时写盘；返回更新后的 meta（界面拿 `endlessBest` 显示）。
   */
  noteEndlessBest(chapter) {
    const meta = this.readMeta();
    const best = Math.max(meta.endlessBest ?? 0, Math.max(1, Math.round(chapter)));
    if (best === (meta.endlessBest ?? 0)) return meta;
    const next = { ...meta, endlessBest: best };
    this.writeMeta(next);
    return next;
  },

  /** 图鉴调试用：把「见过哪些道具」清空（诊断脚本用得上） */
  clearSeenItems() {
    return this.patchMeta({ seenItems: [] });
  },

  /**
   * 记下「遇见过 / 击败过哪些宝可梦」（跨局累加），敌人图鉴靠它分三档：
   *   没见过（压暗 + ???）/ 见过但没打过 / 击败过（✓ + 次数）。
   *
   * 为什么分成两个集合而不是一个「见过」：玩家想知道「这一只我到底打过没有」——
   * 一只怪「遇见了但被它打回家」和「打赢了」是两件事，混在一起图鉴就没有目标感了。
   * `slain` 时顺手也记进 seen（击败必然见过），免得调用方两个都传。
   *
   * 另外维护两份**计数**（图鉴的奖牌按次数发，布尔值发不出牌）：
   *   facedCount  id -> 对上过几次（开打就 +1，不管输赢）
   *   slainCount  id -> 赢过几次
   * 只在真的新增了才写盘。
   */
  noteEnemies(ids = [], { slain = false, faced = false } = {}) {
    const meta = this.readMeta();
    const seen = new Set(meta.seenEnemies ?? []);
    const beaten = new Set(meta.slainEnemies ?? []);
    const slainCount = { ...(meta.slainCount ?? {}) };
    const facedCount = { ...(meta.facedCount ?? {}) };
    let added = 0;
    for (const id of [].concat(ids)) {
      if (!id) continue;
      if (!seen.has(id)) { seen.add(id); added += 1; }
      if (faced) { facedCount[id] = (facedCount[id] ?? 0) + 1; added += 1; }
      if (slain) {
        slainCount[id] = (slainCount[id] ?? 0) + 1;
        added += 1;
        if (!beaten.has(id)) beaten.add(id);
      }
    }
    if (!added) return meta;
    const next = { ...meta, seenEnemies: [...seen], slainEnemies: [...beaten], slainCount, facedCount };
    this.writeMeta(next);
    return next;
  },

  /**
   * 记一局战绩（**打完一局才写**：通关和灰溜溜回家都记一条）。
   *
   * 只存 **id 与数字**，绝不存名字：卡组存的是卡牌 id，地图存的是 biome key。
   * 存名字的话，玩家中途切成日语之后，老记录里那一串还是当时的语言
   * （卡名 / 地图名都是原地改写的，记下来就冻结了）。
   * 最新的排在最前面，只留 HISTORY_MAX 条。
   */
  recordRun(entry) {
    const meta = this.readMeta();
    const history = [entry, ...(meta.history ?? [])].slice(0, HISTORY_MAX);
    const next = { ...meta, history };
    this.writeMeta(next);
    return next;
  },

  /** 清空通关记录（图鉴进度不动：那是「收集」，不是「战绩」） */
  clearHistory() {
    const meta = this.readMeta();
    const next = { ...meta, history: [] };
    this.writeMeta(next);
    return next;
  },

  /**
   * 记下「听过哪几首 BGM」，曲子库（音乐室）靠它把没听过的藏起来。
   *
   * 存的是 **BGM 的 key**（`map_forest` 这种），不是曲名 —— 曲名会跟着语言改写。
   * 只在真的新增时写盘：一首曲子第一次响的那一刻才写一次，之后每次切歌都不动 localStorage。
   */
  noteBgm(key) {
    if (!key) return null;
    const meta = this.readMeta();
    const heard = new Set(meta.heardBgm ?? []);
    if (heard.has(key)) return null;
    heard.add(key);
    const next = { ...meta, heardBgm: [...heard] };
    this.writeMeta(next);
    return next;
  },

  /** 清空曲子库（只影响「听过」的记录，图鉴与战绩不动） */
  clearHeardBgm() {
    const meta = this.readMeta();
    const next = { ...meta, heardBgm: [] };
    this.writeMeta(next);
    return next;
  },

  exportFile(data, filename = 'oasis-save.json') {
    const blob = new Blob([JSON.stringify({ v: 1, at: Date.now(), data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  async importFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        try {
          const parsed = JSON.parse(await file.text());
          resolve(parsed?.v === 1 ? parsed.data : null);
        } catch {
          resolve(null);
        }
      };
      input.click();
    });
  },

  // 兼容旧浏览器：把存档写到项目目录下的 saves/ 里（需要 File System Access API）
  async pickSaveFolder() {
    if (!window.showDirectoryPicker) return false;
    try {
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
      this._dir = dir;
      return true;
    } catch {
      return false;
    }
  },
  async writeToFolder(data) {
    if (!this._dir) return false;
    try {
      const fh = await this._dir.getFileHandle('oasis-save.json', { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify({ v: 1, at: Date.now(), data }, null, 2));
      await w.close();
      return true;
    } catch {
      return false;
    }
  },
};

export { KEY as SAVE_KEY, META_KEY };
