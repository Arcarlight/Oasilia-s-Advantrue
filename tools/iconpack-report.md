# Game Icon Pack 侦察报告（t1）

> 目标素材：**Nieobie / game-icon-pack** — CC0 1.0，815 个圆角图标，SVG + PNG。
> 本文所有结论都对应下面「复现命令」里能跑出来的真实输出，或者 `tools/shots/` 里的截图。
> 侦察时**没有**改动 `src/`、`content/`、`assets/`：整包只解到系统临时目录 `%TEMP%\gip\`，仓库里只落了报告、目录 JSON、样图和截图。

---

## 0. 三句话结论

1. **路径模板（已验证 200）**：`https://nieobie.github.io/game-icon-pack/svg/no-padding/<category>/<component_name>.svg`
   —— GitHub Pages 直连就能拿，不需要镜像；镜像版走 `https://ghproxy.net/https://raw.githubusercontent.com/Nieobie/game-icon-pack/main/svg/no-padding/<category>/<name>.svg`，两边**字节完全一致**。
   仓库里**只有 SVG，没有 PNG**（`png/<name>.png` 404 是因为从来就没有这个目录）；PNG 只在 Release 的 7z 里，而且是纯黑/纯白两色，不是彩色。
2. **可以继续当 mask 用，而且比现有 Kenney 图更合适**：1630 个 SVG 全部是 `<svg fill="currentColor">` 单条路径剪影，**零显式颜色、零背景块、零 `<rect>` 底色**；Edge 无头实测 96px 下 alpha 覆盖率 12%–69%，墨迹包围盒全都小于画布，「满幅矩形」判定**全部为否** → 当 mask 不会渲染成纯色方块。
3. **推荐接法**：保持现有 `.ico-*` 的 `mask-image: url(...) + currentColor` 写法，素材换成 **no-padding 版 SVG**，放到 `assets/img/icons/pack/<name>.svg`。
   `tools/bundle.mjs` 已经会处理 `.svg`（第 189 行 `ext === '.svg' ? 'image/svg+xml'`），**不用改打包脚本**；而且因为新 SVG 每个只有 0.1–3 KB（中位 711 B），而现有 `assets/img/icons/*.png` 是 15 KB/张，**换图标会让单文件包变小 ≈213 KB，不是变大**。

---

## 1. 素材真实路径 / 分发方式

### 1.1 仓库里到底有什么（GitHub tree API，经 `gh-proxy.com` 镜像）

```
tree 类型 1672 条：tree 31 / blob 1641
按顶层目录分组 blob：
  svg                         1630
  index.html / server.js / Icon_Catalog.json / README*.md / LICENSE / .editorconfig / .gitignore / .github / dist / scripts
```

- `svg/no-padding/` 815 个 + `svg/padding/` 815 个 = 1630。
- **仓库里 `*.png` 数量 = 0**。PNG 不在仓库，只在 Release。
- 12 个分类目录（每个分类在两版里数量相同）：
  `1-game 74`、`2-items 54`、`3-gear 67`、`4-nature 68`、`5-food 38`、`6-buildings 53`、`7-vehicles 57`、`8-ui 100`、`9-media 89`、`10-editing 59`、`11-symbols 93`、`12-misc 63`。
- 根目录还有 `Icon_Catalog.json`（815 条元数据，已原样抓下来存成 `tools/icon-catalog.json`，169,754 B）和 `LICENSE`（CC0，7,048 B）。

### 1.2 稳定拿到单个图标的 URL 模板

Pages 站的 `index.html` 里，加载逻辑是 `fetch('svg/' + P + '/' + folder + '/' + file)`（`P` = `padding` | `no-padding`，`folder` = 分类，`file` = `<name>.svg`）。据此得到：

| # | 模板 | 实测 | 备注 |
|---|---|---|---|
| **A（推荐）** | `https://nieobie.github.io/game-icon-pack/svg/no-padding/<category>/<name>.svg` | 200，5/5 抽样成功；`shield.svg` 400 B | **直连，不需要镜像**。`github.io` 在这台机器上通 |
| B（镜像） | `https://ghproxy.net/https://raw.githubusercontent.com/Nieobie/game-icon-pack/main/svg/no-padding/<category>/<name>.svg` | 200 | 与 A **字节一致**（`shield.svg` 400 B，内容 `-eq` 为 True） |
| B' | 同上但前缀 `https://gh-proxy.com/` | 200 | 也可用；`ghfast.top` 对 raw 可用、对 `api.github.com` 403 |
| C（整包） | `https://gh-proxy.com/https://codeload.github.com/Nieobie/game-icon-pack/tar.gz/refs/heads/main` | 200，`498.2 KB` | 一次请求拿到全部 1630 个 SVG + catalog + LICENSE，**推荐用这个做批量导入** |
| D（PNG 包） | `https://gh-proxy.com/https://github.com/Nieobie/game-icon-pack/releases/download/v1.4/game-icon-pack-v1.4-png.7z` | 200，`3,506,218 B` | 只有 PNG 才需要它，见 §1.3 |
| E（fork 镜像 Pages） | `https://cyojkoy.github.io/game-icon-pack/...` | `data.json` 200，38,665 B（与官方一致） | 备胎 |

抽样验证输出（节选）：

```
OK 200  len=400   .../svg/no-padding/3-gear/shield.svg
OK 200  len=390   .../svg/padding/3-gear/shield.svg
OK 200  len=680   .../svg/no-padding/6-buildings/gravestone.svg
OK 200  len=738   .../svg/no-padding/2-items/star-coin.svg
OK 200  len=974   .../svg/no-padding/9-media/volume.svg
Pages 与 ghproxy+raw 内容一致: True  (len 400 / 400)
```

> ⚠ 注意：`svg/sword.svg`（不带分类目录）确实是 404 —— 但原因是 `sword` 在 `3-gear` 分类下，正确路径是 `svg/no-padding/3-gear/sword.svg`（200 ✓）。同理 `png/...` 永远 404，因为仓库里没有 PNG。

### 1.3 Release 打包（PNG 的真实形态）

两个 release：`v1.4`（800+Icons）和 `v1.0.3`（570+Icons）。`v1.4` 的资源：

| 资源 | 大小 |
|---|---|
| `game-icon-pack-v1.4-png.7z` | 3,424 KB |
| `game-icon-pack-v1.4-png-zh.7z` | 3,406.9 KB |
| `game-icon-pack-v1.4-svg.7z` | 358.3 KB |
| `game-icon-pack-v1.4-svg-zh.7z` | 346.5 KB |

PNG 包解出来的结构（本机**没有 7z**，但 Windows 自带 `tar.exe` 是 bsdtar，**能列也能抽单个成员**，不用装 7-Zip）：

```
padding | no-padding  ×  64px | 128px | 256px  ×  black | white  ×  <category>  ×  <name>.png
= 2 × 3 × 2 × 815 = 9,780 个 PNG（另有 Preview.png / What is Padding.png / Thanks for Downloading.png）
```

关键：**PNG 只有 black 和 white 两种颜色，没有彩色版**。所以「自带彩色底块」这件事在这个包里从头到尾不存在。

---

## 2. 关键问题：能不能当 mask 用？

### 2.1 SVG 结构审计（815 × 2 = 1630 个文件全扫）

```
根 <svg> fill=  : {"currentColor":1630}      <- 全部 1630 个
显式非 currentColor 颜色: 0                   <- 一个都没有
含 <rect> 的: 6（no-padding/12-misc/capsule.svg, no-padding/12-misc/circle.svg,
              no-padding/9-media/recording.svg + 对应 padding 版）
满画布 rect 明细:
   满画布 rect(6x6 rx=3)     =圆形，安全 <- no-padding/12-misc/circle.svg
   满画布 rect(4.4x4.4 rx=2.2) =圆形，安全 <- no-padding/9-media/recording.svg
<path> 数量分布 : {"0":8,"1":1622}            <- 8 个「0 path」就是上面那 3 组 circle/ellipse/capsule/recording
viewBox 紧贴墨迹: 815     viewBox 其它: {"0 0 10 10":815}
自包含性：<use> 0 / <style> 0 / <image> 0 / xlink: 0 / <script> 0 / <defs> 0 / <mask> 0
```

单文件体积：`min 147 B / median 711 B / max 3,201 B / 平均 802 B`。
一个真实文件长这样（`no-padding/1-game/boss.svg`，1,643 B）：

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor"
     viewBox="1.84 1.84 6.32 6.32"><path d="M7.312 1.839c.12 0 ..."/></svg>
```

→ **结论**：纯单色剪影、自包含、没有背景、没有外链依赖，是 CSS `mask-image` 的理想素材（mask 只取 alpha 通道，`fill="currentColor"` 的颜色值根本不参与）。

### 2.2 浏览器实测：mask vs `<img>`，96px，像素统计

`tools/shots/iconpack-masktest.png` / `iconpack-masktest-zoom.png`（Edge headless，`tools/iconpack-masktest.html` 自包含测试页）。
同一图标左= 游戏现有接法 `mask + currentColor`，右= 原图 `<img>`，棋盘格背景暴露透明区。

统计口径：**mask 吃的是 alpha 通道，所以「alpha 覆盖率」就等于「mask 覆盖率」**；「满幅矩形」= 墨迹铺满整框且 alpha 覆盖 > 90%。

```
图标            版本        alpha覆盖%  墨迹bbox   满幅矩形?
boss          no-padding      61.84   92x96       否
sword         no-padding      33.08   50x96       否
coin          no-padding      59.90   96x96       否
earthquake    no-padding      59.17   96x94       否
wind          no-padding      36.20   94x96       否
arrow-right   no-padding      48.12   96x79       否
settings      no-padding      52.13   96x96       否
action-points no-padding      34.65   96x62       否
potion        no-padding      43.86   66x96       否
chest         no-padding      69.13   96x86       否
tent          no-padding      54.20   94x96       否
tick          no-padding      29.54   96x70       否
png-boss      no-padding      62.76   92x96       否
png-boss      padding         26.15   60x62       否
--- 现有 Kenney 图标基线（同 96px）---
kenney-warning                 25.63   66x62       否
kenney-coin                    31.25   64x64       否
kenney-sword                   39.21   82x82       否
```

截图肉眼可见的事实：
- **mask 列渲染出来全是单色剪影**（颜色取自父元素 `color`），和 `<img>` 列的形状**一模一样**；
- `<img>` 列渲染成**纯黑**剪影（因为 `fill="currentColor"` 在独立 SVG 文档里解析成黑色），**不是彩色、也不是实心方块**；
- 左右两列都没有出现任何底块 / 圆角矩形底色。

补充的 PNG 端证据（`tools/iconpack-probe.mjs` 自带无依赖 PNG 解码，直接读像素）：

```
boss.png      256x256  2088 B  不透明像素 60.11%  墨迹bbox 244x256  满幅矩形? false  no-padding/white
boss.png      256x256  1511 B  不透明像素 24.24%  墨迹bbox 154x162  满幅矩形? false  padding/white
star-coin.png 256x256  1702 B  不透明像素 56.63%  墨迹bbox 256x256  满幅矩形? false
shield.png    256x256  1251 B  不透明像素 67.30%  墨迹bbox 240x256  满幅矩形? false
```

→ **不是满幅矩形，没有底色块。** PNG 和 SVG 都是透明底的单色剪影。

---

## 3. 尺寸 / 体积 / padding 与 no-padding 的实际差别

### 3.1 单图体积

| 形态 | 单图体积 |
|---|---|
| SVG（任意一版） | min 147 B / 中位 711 B / 平均 802 B / max 3,201 B |
| PNG 64px | ≈ 0.6 KB（boss 641 B） |
| PNG 128px | ≈ 1.1 KB（boss 1,129 B） |
| PNG 256px | 0.8 – 2.1 KB（boss 2,088 B、shield 1,251 B、action-points 1,826 B） |
| 现有 `assets/img/icons/*.png`（Kenney，50×50） | **15 KB 左右/张** |
| 现有 `assets/img/cards/*.png`（64×64） | ≈ 0.5 KB/张 |

### 3.2 padding vs no-padding 的实际差别（有图有数）

两者是**同一份路径数据**，唯一区别是 `viewBox`：

- `padding/.../boss.svg` → `viewBox="0 0 10 10"`（保留原始 10×10 网格，四周留白，图标显得小）
- `no-padding/.../boss.svg` → `viewBox="1.84 1.84 6.32 6.32"`（**紧贴墨迹的正方形裁剪框并居中**）

```
same path data? True          （把两个文件的 <path> 之后的内容比较，完全相同）
padding len=1633   nopad len=1643
no-padding 裁剪框宽高比分布: 1×815    <- 815/815 全是正方形裁剪框
```

也就是说 no-padding **不是**简单去掉留白，而是「按墨迹包围盒的最大边裁成正方形并居中」，所以同一显示尺寸下所有图标的视觉重量大致一致。别被名字骗了：**它并不是让细长图标变宽**，细长图标（如 sword）在自己那个正方形里仍然是窄的。

用官方发布包里的 `What is Padding.png` 说明（已存 `tools/iconpack-samples/docs/What-is-Padding.png`）：padding = 图标四周留白；no-padding = 图标尽量填满画布。

**视觉重量对比（96px 实测 alpha 覆盖率）**：

| 图标 | no-padding | padding |
|---|---|---|
| boss | 61.84% | 25.28% |
| sword | 33.08% | 15.71% |
| coin | 59.90% | 22.15% |
| earthquake | 59.17% | 24.16% |
| wind | 36.20% | 15.03% |
| arrow-right | 48.12% | 19.29% |
| settings | 52.13% | 19.49% |
| action-points | 34.65% | 18.67% |
| potion | 43.86% | 15.81% |
| chest | 69.13% | 25.53% |
| tent | 54.20% | 21.48% |
| tick | 29.54% | 12.12% |
| **现有 Kenney 基线** | warning 25.63% / coin 31.25% / sword 39.21% | — |

→ no-padding（30–70%）比现有 Kenney（25–39%）更「满」；padding（12–26%）反而更接近现有观感。
尺寸越小越需要「满」：**16–20px 行内图标用 no-padding**（padding 版在 16px 下只剩 ~9px 的墨迹，看不清）；**卡面 46px 这种大尺寸装饰位可以混用 padding**（留白让画面不顶到边）。

### 3.3 样图（`tools/iconpack-samples/`）

```
svg/no-padding/   boss, sword, star-coin, earthquake, tent, gravestone, shield, fire, chest, action-points (.svg)
svg/padding/      同上 10 个 (.svg)
png/no-padding-256-white/   boss, sword, star-coin, fire, tent, action-points
png/no-padding-256-black/   boss, fire
png/padding-256-white/      boss, sword, star-coin, fire
png/no-padding-128-white-boss.png / png/no-padding-64-white-boss.png
docs/What-is-Padding.png        (官方 padding 说明图)
docs/LICENSE-CC0.txt            (CC0 1.0 原文)
```

---

## 4. 推荐接法（含对单文件打包的影响）

### 4.1 结论：**继续用 mask，素材换 no-padding SVG；不要改用彩色 `<img>`**

理由（都是实测）：

1. **没有彩色素材可选**。PNG 只有 black/white 两色，SVG 只有 `currentColor`。改 `<img>` 只会得到一张**黑色**剪影，反而丢掉了 `.ico-*` 跟随 `currentColor` 随主题/状态变色的能力（现有 25 处 mask 全靠这个）。
2. **mask 写法不用动**。`.ico-*` 那套 `[class^="ico-"], [class*=" ico-"] { background-color: currentColor; mask-* }` 完全复用，只需把 25 条 `mask-image` 的 URL 换成新素材、再新增若干条规则。`@supports not (mask-image)` 那条保险分支也照旧生效。
3. **`<img>` 会破坏单文件打包**（这是硬约束，不是偏好）：
   `tools/bundle.mjs` 只内联 **CSS 里的 `url(assets/...)`**（第 172–197 行）以及硬编码的 `assets/pokemon`、`assets/portraits` 两个目录；`<img src="assets/...">` 在 `file://` 下会被浏览器当跨源请求拦掉（bundle.mjs 第 203 行注释就是这么写的）。所以走 `<img>` 就必须改 bundle.mjs，而走 CSS mask **一行都不用改**。
4. **CSS 内联链路已实测**：用一段 CSS 复刻 bundle.mjs 第 150–197 行的处理链，`url(../../assets/img/icons/pack/fire.svg)` → 被识别 → `.svg` 映射成 `image/svg+xml` → base64 成 `url(data:image/svg+xml;base64,PHN2Zy...)`，**剩余未内联的 assets 引用 = 0**（PNG 走同一条路径，行为一致）。

### 4.2 落地细节（给第二步的硬性约定）

- **文件位置**：`assets/img/icons/pack/<name>.svg`（必须在 `assets/` 下面，bundle.mjs 的正则只认 `assets/...`）。
- **CSS 写法**：保持相对路径 `url(../../assets/img/icons/pack/<name>.svg)`（不带引号最省事；带引号 bundle.mjs 也处理）。保持 `../../` 前缀别写成 `assets/...`，否则 `tools/check-icons.mjs` 的素材存在性检查（它的正则是 `url\(\.\.\/\.\.\/([^)]+)\)`）会漏掉这些文件。
- **类名只能用 `[a-z0-9_]`，不能用连字符、不能用大写**。这条是实测出来的，不是猜的：
  ```
  .ico-dragon-breath  -> CSS 侧解析不到；JS 侧解析成 "dragon" -> check-icons.mjs 误报「ico-dragon 未定义」
  .ico-dragon_breath  -> CSS/JS 两侧都正确解析
  .ico-dragonbreath   -> 正确
  .ico-AP             -> CSS 侧被丢弃（大写不在 [a-z0-9_] 里）
  ```
  所以多词类名请写成 `ico-dragon_breath` 或 `ico-dragonbreath`。
- **版本锁定**：Pages / raw 都是从 `main` 的 CI 产物，会随上游漂移。第二步应该把选中的 SVG **复制进仓库**（本来也要复制，因为单文件打包只认本地文件），而不是运行时远程引用。

### 4.3 对单文件打包体积的影响（实测数字）

```
现有 CSS 里 url() 引用的 25 个素材：
  其中 assets/fonts/LXGWNeoXiHeiPlus.ttf     8,969,084 B   （字体，与本任务无关）
  其余 24 个图标素材合计                        204,454 B   -> base64 后约 266.2 KB
  （13 张 assets/img/icons/*.png 就占 198,277 B，因为它们是 50x50 却 15 KB/张）

新素材单图：中位 711 B，平均 802 B，base64 ≈ ×1.37

选型草表首选 46 个（去重后）              =  40,926 B SVG  -> base64 ≈  53.3 KB
选型草表全部 171 个候选                   = 135.2 KB SVG   -> base64 ≈ 180.3 KB
现有单文件产物 oasis-game.html            = 20,201,684 B（20.2 MB，主要是 11 MB 字体 + 精灵图）
```

→ **换图标不会让包变大**：
- 只上 46 个首选 → 图标内联量 266.2 KB → 53.3 KB，**净减 ≈ 213 KB**（约 -0.9% 的 20.2 MB）；
- 就算把 171 个候选全上 → 180.3 KB，**仍然净减 ≈ 86 KB**。

原因很简单：现在的 Kenney PNG 每张 15 KB，而新 SVG 每张 0.7 KB。这是本次替换最划算的部分。

### 4.4 混用建议

| 场景 | 接法 |
|---|---|
| `.ico-*` 行内图标（16–20px，跟随文字颜色） | **mask + currentColor + no-padding SVG**（默认方案） |
| 卡面 `.card-art .art-ico`（46px，固定深色） | mask + no-padding SVG（也能换 padding 版调视觉重量） |
| 地图节点 / 奖励卡这类「有底色的小圆角徽章」 | 也走 mask；**底块由我们自己的 CSS 画**（`background` + `border-radius` + 内层 mask），不要指望素材自带——素材根本没有底色 |

---

## 5. 选型草表（57 个概念 / 171 个候选，全部在快照里校验通过）

生成方式：`tools/iconpack-select.mjs` 读 `tools/icon-catalog.json` + 仓库快照，**逐条校验候选名是否真的存在文件**（本次 171/171 全部命中，0 个 NOT-FOUND），并带上 catalog 里的 `core_semantic` 原文。
机读版：`tools/icon-semantics-draft.json`（含 `path_nopadding` / `path_padding` / 字节数 / 语义，可直接给第二步消费）。
一览图：`tools/shots/iconpack-candidates.png`。

> 候选顺序 = 推荐顺序，**加粗的是首选**。

### 5.1 卡牌语义

| 游戏概念 | 候选（首选加粗） | 语义（catalog 原文） | 分类 |
|---|---|---|---|
| 物理攻击 | **sword** / broadsword / axe | 剑 / 大剑（基础款） / 斧头 | 3-gear, 2-items |
| 连击 | **double** / triple / hit-effect | 双倍（2倍） / 三倍（3倍） / 命中/攻击特效 | 1-game |
| 远程/投掷 | **bow** / missile / spear | 弓 / 导弹 / 矛 | 3-gear |
| 龙息 | **volcanic-eruption** / fire / thunderstorm | 火山喷发 / 火 / 雷暴 | 4-nature |
| 火焰 | **fire** / volcanic-eruption / temperature-up | 火 / 火山喷发 / 升温 | 4-nature |
| 地震 | **earthquake** / stone / mountain | 地震（石头中间裂开） / 岩石 / 山 | 4-nature |
| 落石 | **meteor** / stone / mountain | 流星/陨石 / 岩石 / 山 | 4-nature |
| 沙暴/风 | **wind** / drought / fog | 风（气流） / 干旱（枯裂土地） / 雾 | 4-nature |
| 虫鸣/音波 | **bug** / audio-waves / bullhorn | Bug（外形是甲虫） / 音频声波 / 扩音喇叭 | 9-media, 2-items |
| 毒 | **potion** / radiation / pill | 药水 / 辐射危险标志 / 药丸 | 5-food, 12-misc, 2-items |
| 治疗 | **medical-kit** / heart / potion | 医疗箱（红十字） / 爱心 / 药水 | 2-items, 1-game, 5-food |
| 护盾 | **shield** / shield-02 / shield-03 | 盾牌（基础款） / 盾牌（圆角） / 盾牌（更圆） | 3-gear |
| 格挡 | **shield-02** / bulletproof-vest / protect | 盾牌（圆角） / 防弹衣 / 保护安全 | 3-gear, 9-media |
| 反击 | **rotate-left** / refresh / change | 向左旋转 / 刷新重载 / 交换切换 | 8-ui |
| 抽牌 | **card** / cards / spade-card | 卡牌（双张） / 多张牌组 / 黑桃牌 | 1-game |
| 洗牌/换牌 | **random-dice** / refresh / rotate-right | 随机骰子（带问号） / 刷新 / 向右旋转 | 1-game, 8-ui |
| 增益（攻击） | **temperature-up** / arrow-up / battery-positive | 升温 / 向上箭头 / 电量满 | 4-nature, 8-ui, 9-media |
| 增益（敏捷） | **shoe** / warrior-boots-lv3 / arrow-up-right | 鞋子 / 战士靴 Lv3 / 右上箭头 | 3-gear, 8-ui |
| 削弱（降防） | **temperature-down** / arrow-down / heart-break | 降温 / 向下箭头 / 心碎（将断未断） | 4-nature, 8-ui, 1-game |
| 削弱（降攻） | **battery-negative** / arrow-down / heart-break-02 | 电量不足 / 向下箭头 / 心碎（彻底分开） | 9-media, 8-ui, 1-game |
| 命中下降 | **target** / prohibited / fog | 靶心 / 禁止符号 / 雾 | 6-buildings, 8-ui, 4-nature |
| 终结技/大招 | **trophy** / five-pointed-star / crown | 奖杯 / 五角星 / 王冠 | 1-game, 12-misc, 3-gear |
| 道具类 | **backpack** / tool-kit / plastic-bag | 背包 / 工具箱 / 购物袋 | 2-items |

### 5.2 属性与状态

| 游戏概念 | 候选（首选加粗） | 语义 | 分类 |
|---|---|---|---|
| 攻击属性 | **sword** / hit-effect / mace | 剑 / 命中特效 / 钉头锤 | 3-gear, 1-game |
| 防御属性 | **shield** / bulletproof-vest / protect | 盾牌 / 防弹衣 / 保护 | 3-gear, 9-media |
| 敏捷属性 | **shoe** / wind / warrior-boots-lv3 | 鞋子 / 风 / 战士靴 | 3-gear, 4-nature |
| 幸运属性 | **clover** / four-pointed-star / dice | 三叶草（幸运） / 四角星 / 骰子 | 4-nature, 12-misc, 1-game |
| 中毒 | **potion** / radiation / bug | 药水 / 辐射 / 甲虫 | 5-food, 12-misc, 9-media |
| 灼伤 | **fire** / temperature-up / volcanic-eruption | 火 / 升温 / 火山喷发 | 4-nature |
| 虚弱 | **temperature-down** / battery-negative / heart-break | 降温 / 电量不足 / 心碎 | 4-nature, 9-media, 1-game |
| 流血 | **heart-break-02** / medical-kit / dagger | 心碎（彻底分开） / 医疗箱 / 匕首 | 1-game, 2-items, 3-gear |
| 护盾值 | **shield-02** / shield-03 / protect | 圆角盾 / 更圆的盾 / 保护 | 3-gear, 9-media |
| AP | **action-points** / stamina / lightning | 纯文本「AP」 / 体力（闪电） / 闪电 | 1-game, 4-nature |
| 回合 | **clock** / time / rotate-right | 时钟 / 时间 / 向右旋转 | 9-media, 8-ui |

### 5.3 界面与地图

| 游戏概念 | 候选（首选加粗） | 语义 | 分类 |
|---|---|---|---|
| 战斗节点 | **hit-effect** / sword / target | 命中特效 / 剑 / 靶心 | 1-game, 3-gear, 6-buildings |
| 强敌节点 | **demon** / skull / wolf | 小恶魔 / 骷髅 / 狼 | 1-game, 4-nature |
| 精英节点 | **viking-helmet** / crown / demon-02 | 维京头盔 / 王冠 / 凶恶恶魔 | 3-gear, 1-game |
| 事件节点 | **question-mark** / random-dice / sign | 问号 / 随机骰子 / 标志牌 | 8-ui, 1-game, 6-buildings |
| 宝箱/奖励 | **chest** / key / ingot | 宝箱 / 钥匙 / 金条 | 2-items |
| 商店 | **shop** / star-coin / sycee | 商店 / 星星硬币 / 元宝 | 6-buildings, 2-items |
| 营地 | **tent** / bed / lantern | 帐篷 / 床 / 灯笼 | 6-buildings |
| 首领 | **boss** / demon-02 / skull | 三牙两角凶恶脸 / 凶恶恶魔 / 骷髅 | 1-game |
| 地图·流沙之海 | **drought** / sea / cloud | 枯裂土地 / 海洋 / 云 | 4-nature |
| 地图·赤岩峡谷 | **mountain** / stone / acute-triangle | 山 / 岩石 / 锐角三角形 | 4-nature, 12-misc |
| 地图·藤蔓密林 | **forest** / bamboo / leaves | 森林 / 竹笋 / 叶子 | 4-nature |
| 地图·潮汐盐海 | **sea** / water / anchor | 海洋 / 水 / 锚 | 4-nature, 7-vehicles |
| 地图·风蚀峭壁 | **wind** / mountain / acute-triangle | 风 / 山 / 锐角三角形 | 4-nature, 12-misc |
| 地图·夜砂墓原 | **gravestone** / night / drought | 墓碑 / 夜晚 / 枯裂土地 | 6-buildings, 4-nature |
| 金币 | **star-coin** / sycee / ingot | 四角星硬币 / 元宝 / 金条 | 2-items |
| 卡组 | **cards** / card / spade-card | 多张牌组 / 双张牌 / 黑桃牌 | 1-game |
| 背包 | **backpack** / tool-kit / chest | 背包 / 工具箱 / 宝箱 | 2-items |
| 存档 | **save** / memory-card / document | 软盘 / 存储卡 / 文档 | 8-ui, 9-media |
| 设置 | **settings** / settings-02 / slider | 齿轮（尖锐） / 齿轮（圆润） / 滑块 | 8-ui |
| 音量 | **volume** / mute / audio-waves | 音量 / 静音 / 声波 | 9-media |
| 帮助 | **question-mark** / info-02 / info | 问号 / 圆形 i / 字母 i | 8-ui |
| 胜利 | **trophy** / crown / five-pointed-star | 奖杯 / 王冠 / 五角星 | 1-game, 3-gear, 12-misc |
| 失败 | **death** / skull / heart-break | 骷髅头 / 骷髅 / 心碎 | 1-game |

体积估算（脚本实测）：首选 46 个去重 = 40,926 B SVG → base64 ≈ **53.3 KB**；全部 171 个候选 = 135.2 KB → base64 ≈ **180.3 KB**。

---

## 6. 风险与不确定项

1. **包里没有某些概念的专用图标，只能取「最近语义」**。这一条要诚实地说清楚，属于语义降级：
   - **龙息** → 没有龙 / 喷火生物 / 口部造型。首选 `volcanic-eruption`（冒烟火山），是「大口喷出」最接近的形态。
   - **毒** → 没有毒液瓶 / 骷髅瓶。用 `potion` + `radiation`（☢ 危险标志）表达。
   - **流血** → 没有血滴 / 绷带。用 `heart-break-02`（心彻底裂开）表达持续掉血。
   - **虫鸣 / 音波** → `audio-waves` 是通用声波；`bug` 的 catalog 语义写的是「Bug/程序错误」，**只有外形是甲虫**。用它表示虫鸣是借用外形，建议在代码注释里写清，避免以后有人按语义索引重新挑图。
   - **反击 / 反弹** → 没有反弹图标，用 `rotate-left`（回转箭头）近似。
   - **沙暴 / 流沙** → 没有沙尘图标，`drought`（枯裂土地）比 `wind` 更像「沙」。
2. **`coin` 是个坑，不要用来表示金币**。它的实际造型是字母「C」的硬币图标（catalog 写「硬币/货币（C字母）」），渲染出来就是一个圆圈里的 C —— 已用截图确认，并且专门在 `tools/shots/iconpack-candidates.png` 底部留了「反面教材」格子。金币请用 `star-coin` / `sycee` / `ingot`。
3. **类名约束是硬性的**：只能用 `[a-z0-9_]`（见 §4.2，实测 `ico-dragon-breath` 和 `ico-AP` 都会被 `tools/check-icons.mjs` 误判）。第二步如果按中文概念直译出带连字符的类名，会踩这个坑。
4. **`check-icons.mjs` 只能查「定义/缺失」，查不了「内容对不对」**。它能发现类名缺失和素材文件缺失，但图标选得是否合适、`mask` 在真机上是否糊，还得靠截图人工看。建议第二步之后加一次 `tools/shot.mjs` 的界面截图复核。
5. **上游会漂移**：Pages / raw 都来自 `main` 的 CI 产物，`v1.4` release 与 `main` 未必一致（如 `Icon_Catalog.json` 是 main 上 815 条）。所以**不要运行时远程取图**，要把 SVG 复制进仓库；本报告的字节数/结论对应本次抓取的 main 快照。
6. **网络前提**：本机 `github.com` / `raw.githubusercontent.com` 直连不通，必须走镜像。`ghproxy.net` 与 `gh-proxy.com` 对 raw/codeload/release 资源可用，但 `ghproxy.net` 对 `api.github.com` 返回 **403**（要用 `gh-proxy.com` 访问 API）。`nieobie.github.io`（Pages）**直连可用**，是最省事的一条路。
7. **PNG 只有黑/白两色**。如果第三步某处真的想要「彩色图标」，这个包满足不了，得自己上色（用 mask + 彩色背景，或对 SVG 做 `fill` 替换）——但这属于新增设计，不在本次替换范围内。
8. **mask 的兼容性保险已存在**：`style.css` 第 166 行有 `@supports not ((mask-image: url(#a)) ...)` 兜底分支，它会把 `background-color` 置为透明。换成 SVG mask 后这条分支行为不变；但如果真落到这个分支，图标会直接看不见（原本也看不见），这不是本次引入的新风险。

---

## 7. 复现命令

在仓库根目录（`D:\ToolsSoftware\DSH_GameTsukuru`）执行。`$svg` / `$png` 指向系统临时目录，**不要**把整包解到仓库里。

```powershell
# 0) 准备临时目录
$dst = "$env:TEMP\gip"; New-Item -ItemType Directory -Force -Path $dst | Out-Null

# 1) 抓目录元数据（815 条）—— 这一步就是 tools/icon-catalog.json 的来源
Invoke-WebRequest -UseBasicParsing -TimeoutSec 60 `
  -Uri 'https://ghproxy.net/https://raw.githubusercontent.com/Nieobie/game-icon-pack/main/Icon_Catalog.json' `
  -OutFile 'tools\icon-catalog.json'
(Get-Item tools\icon-catalog.json).Length            # 期望 169754

# 2) 一次性拿到全部 SVG（498 KB 的 tar.gz：1630 个 svg + catalog + LICENSE）
Invoke-WebRequest -UseBasicParsing -TimeoutSec 300 -OutFile "$dst\repo-main.tar.gz" `
  -Uri 'https://gh-proxy.com/https://codeload.github.com/Nieobie/game-icon-pack/tar.gz/refs/heads/main'
New-Item -ItemType Directory -Force -Path "$dst\repo" | Out-Null
tar -xzf "$dst\repo-main.tar.gz" -C "$dst\repo"
$svg = "$dst\repo\game-icon-pack-main\svg"

# 3) 【必须用证据】单图 URL 模板验证（Pages 直连 + 镜像，两边应字节一致）
Invoke-WebRequest -UseBasicParsing -TimeoutSec 30 `
  -Uri 'https://nieobie.github.io/game-icon-pack/svg/no-padding/3-gear/shield.svg' | Select-Object StatusCode,RawContentLength
$a = (Invoke-WebRequest -UseBasicParsing -Uri 'https://nieobie.github.io/game-icon-pack/svg/no-padding/3-gear/shield.svg').Content
$b = (Invoke-WebRequest -UseBasicParsing -Uri 'https://ghproxy.net/https://raw.githubusercontent.com/Nieobie/game-icon-pack/main/svg/no-padding/3-gear/shield.svg').Content
$a -eq $b                                            # 期望 True

# 4) 【必须用证据】PNG 包（可只抽单个成员，系统没有 7z 也能用 Windows 自带 bsdtar）
Invoke-WebRequest -UseBasicParsing -TimeoutSec 300 -OutFile "$dst\gip-png.7z" `
  -Uri 'https://gh-proxy.com/https://github.com/Nieobie/game-icon-pack/releases/download/v1.4/game-icon-pack-v1.4-png.7z'
tar -tf "$dst\gip-png.7z" | Select-Object -First 25        # 列结构
$png = "$dst\pngsel"; New-Item -ItemType Directory -Force -Path $png | Out-Null
tar -xf "$dst\gip-png.7z" -C $png `
  'no-padding/256px/white/1-game/boss.png','padding/256px/white/1-game/boss.png','What is Padding.png'

# 5) 【必须用证据】素材形态审计 + PNG 像素统计（无外部依赖）
node tools\iconpack-probe.mjs --svg "$svg" --png "$png"

#   语义检索（按 component_name / core_semantic / visual_features / synonyms 全文匹配）
node tools\iconpack-probe.mjs --find "shield,护盾,治疗,poison"

# 6) 【必须用证据】生成并渲染 mask vs <img> 对照页 + 像素统计
node tools\iconpack-masktest.mjs --svg "$svg" --png "$png"
#   -> tools\iconpack-masktest.html / tools\shots\iconpack-masktest.png / tools\shots\iconpack-maskstats.txt
#   额外的放大版截图（1.7x，看得清单个图标）：
$edge='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
& $edge --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1.7 `
  --window-size=1000,660 --virtual-time-budget=8000 --no-first-run --no-default-browser-check `
  --allow-file-access-from-files --user-data-dir='tools\.edge-profile-verify' `
  "--screenshot=tools\shots\iconpack-masktest-zoom.png" `
  'file:///D:/ToolsSoftware/DSH_GameTsukuru/tools/iconpack-masktest.html'

# 7) 选型草表（每条候选都对着快照校验 + 打印体积估算）并出候选一览图
node tools\iconpack-select.mjs --svg "$svg" --shot
#   -> tools\icon-semantics-draft.json / tools\shots\iconpack-candidates.png

# 8) 事后自查（替换完成后第二步/第三步该跑的门）
node tools\check-icons.mjs          # 类名定义 / 素材文件存在性
node tools\bundle.mjs               # 单文件打包（会打印「CSS 内联素材: N/M 个」）
node tools\verify-bundle.mjs        # 单文件产物校验
```

### 产物清单

| 文件 | 说明 |
|---|---|
| `tools/iconpack-report.md` | 本报告 |
| `tools/icon-catalog.json` | 抓下来的 815 条 `Icon_Catalog.json` 原文件（169,754 B） |
| `tools/icon-semantics-draft.json` | 机读版选型草表（57 概念 / 171 候选 / 含路径与字节数） |
| `tools/iconpack-samples/` | 样图：10 个 SVG × 两版、若干 PNG、`What-is-Padding.png`、CC0 LICENSE |
| `tools/shots/iconpack-masktest.png` | mask vs `<img>` 对照截图（1300×2750 全页） |
| `tools/shots/iconpack-masktest-zoom.png` | 同上放大版（1.7x，看得清单个图标） |
| `tools/shots/iconpack-maskstats.txt` | 像素统计文本（alpha 覆盖率 / 墨迹 bbox / 满幅矩形判定） |
| `tools/shots/iconpack-candidates.png` | 选型候选一览图（含 `coin` 反面教材） |
| `tools/iconpack-probe.mjs` | 侦察脚本：SVG 形态审计 / 自包含性断言 / PNG 像素统计 / 语义检索 |
| `tools/iconpack-masktest.mjs` | 生成对照测试页 + Edge 无头截图 + 导出统计 |
| `tools/iconpack-select.mjs` | 生成并校验选型草表 + 候选一览图 |
| `tools/iconpack-masktest.html` | 自包含对照测试页（所有图内联成 data URI） |

> 候选一览页 `tools/iconpack-candidates.html`（407 KB，内嵌 171 个 SVG 的 data URI）跑完就删了，避免把整包素材复制进仓库；需要时用 `node tools/iconpack-select.mjs --svg "$svg" --shot` 重新生成即可（PNG 截图已留在 `tools/shots/`）。
>
> `tools/` 之外零改动：`src/ui/style.css` 仍是 2026-09-17 23:24、`content/cards.json` 仍是 2026-09-18 12:47、`assets/img/icons/gear.png` 仍是 2014-11-03，都未被本次侦察触碰。

---

## 8. 落地方案（t2：图标素材管线 + 图标注册表）

t1 的四条结论全部按原样落地，**没有改接法**：仍然是 `mask-image` + `currentColor`，素材换成 no-padding SVG，
`tools/bundle.mjs` 一行都没动。这一节是「以后怎么加图标」和「当时实测到的数字」。

### 8.1 管线长什么样（加一个图标 = 改一行 JSON + 跑两条命令）

```
content/icons.json                 ← 唯一数据源（75 条：46 个 pack + 29 个本地 Kenney）
        │  & tools/fetch-iconpack.ps1        （只有 pack: 条目需要，去上游按需下载）
        ▼
assets/img/icons/pack/<name>.svg   ← 46 个 no-padding SVG，40,926 B
        │  node tools/build-content.mjs      （校验 + 生成）
        ▼
src/ui/style.css 的 /* #region GENERATED-ICONS */ 区块   ← 75 条 .ico-* 规则
        │  node tools/check-icons.mjs / node tools/bundle.mjs
        ▼
单文件 oasis-game.html（CSS 里的 url() 被内联成 data URI）
```

一条注册表条目：

```json
{ "name": "flame", "source": "pack:fire", "file": "icons/pack/flame.svg",
  "desc": "火焰：火属性伤害 / 灼伤状态", "component": "fire", "category": "4-nature", "group": "卡牌语义" }
```

- `name` → 生成 `.ico-flame`；`source` → `pack:<上游 component_name>` 或 `local:<assets/img 下的路径>`；
  `file` → 磁盘位置；`desc` → 用途（给人看）；`component`/`category` → 可追溯；`group` → 生成区块里的注释分节。
- **换算规则**：上游 `component_name` 里有连字符（`shield-02`）时，`name` 必须写成下划线（`shield_02`）。

### 8.2 最终 URL 模板（t1 的 A/B/B2 三条链，脚本里按顺序试；全部为实测）

| # | 模板 | 用途 |
|---|---|---|
| A | `https://nieobie.github.io/game-icon-pack/svg/no-padding/<category>/<name>.svg` | **首选**，直连 Pages |
| B | `https://ghproxy.net/https://raw.githubusercontent.com/Nieobie/game-icon-pack/main/svg/no-padding/<category>/<name>.svg` | 镜像备胎 |
| B2 | `https://gh-proxy.com/https://raw.githubusercontent.com/Nieobie/game-icon-pack/main/svg/no-padding/<category>/<name>.svg` | 镜像备胎 |
| C | `& tools/fetch-iconpack.ps1 -LocalSvg <解包出来的 .../game-icon-pack-main/svg>` | 离线/整包兜底（498 KB tar.gz） |

本地落盘路径固定为 `assets/img/icons/pack/<name>.svg`，CSS 里写 `url(../../assets/img/icons/pack/<name>.svg)`。

### 8.3 为什么要用 .ps1（而不是 .mjs）

项目习惯是「批量素材下载走 PowerShell + 镜像链」（`fetch-content.ps1` / `fetch-bgm.ps1` / `fetch-portraits.ps1`），
所以新增的 `tools/fetch-iconpack.ps1` 沿用同一套写法：`Invoke-WebRequest` + 镜像数组 + 已存在就跳过 + 结尾打总账。
脚本**正文只写 ASCII**（这台机器的 pwsh 是 Windows PowerShell 5.1，会把无 BOM 的 UTF-8 .ps1 按 GBK 解析；
`tools/check-content.mjs` 第 172–189 行就有一条专门查这个的体检项）。

实测行为：

```
$ & tools/fetch-iconpack.ps1 -LocalSvg %TEMP%\gip\repo\game-icon-pack-main\svg
iconpack: new=46 skip=0 fail=0 total=40 KB     ← 与选型草表的 40,926 B 逐个对上
$ & tools/fetch-iconpack.ps1
iconpack: new=0 skip=46 fail=0                ← 幂等（已存在且是合法 SVG 就跳过）
$ (删掉 shield_02.svg) & tools/fetch-iconpack.ps1
  ok    shield_02              <- shield-02   ← 走网络（模板 A），下载结果与本地快照**字节一致**
$ (注册表里故意写 pack:no-such-icon-xyz) & tools/fetch-iconpack.ps1
  FAIL  shield_02  component=no-such-icon-xyz category=3-gear
  FAILED 1 icon(s) - every mirror was tried:  ← 逐条打印试过的 URL，exit=1
```

### 8.4 生成区块的位置与校验

- 区块在 `src/ui/style.css`，就在原先那 25 条手写 `.ico-*` 的位置（**手写规则已全部搬进区块**，一条没丢：
  逐条比对过 25 个类名的 `url()` 与原值一致，其中 `.ico-sword` / `.ico-shield` 按本次目标有意改指到 pack 的 `sword` / `shield`）。
- 区块第一行就是「这一段由 content/icons.json 生成」的注释，规则一条一行（压行是为了少占单文件体积）。
- `tools/build-content.mjs` 的 icons 校验（**报错即终止、不写文件**）：
  - 名字重复 / 缺 `desc` / `source` 不是 `pack:` 或 `local:` / `file` 不存在 / 扩展名不是 `.png|.svg` / 路径里带 `..`；
  - `name` 出现非 `[a-z0-9_]` 字符（连字符、大写）→ **硬报错**（t1 实测：`.ico-dragon-breath` 会被 check-icons 误报、`.ico-AP` 会被 CSS 丢弃）；
  - `pack:<component_name>` 不在 `tools/icon-catalog.json` 里 → 报错（拼不出下载地址）；
  - pack 素材不是 `.svg`，或根节点不是 `fill="currentColor"` → 报错（t1 要求原样使用 no-padding SVG，别自己改色）；
  - 卡牌 `ico` 字段不在注册表里 → 报错（写错只会显示空白方块，构建期就拦住）；
  - `file` 参与拼 URL，一律生成 `../../assets/...` 形式（bundle.mjs 只认这个前缀）。
- 另外新增了 `tools/iconpack-render.mjs`（验证脚本，见 8.5）和 `tools/icons-pipeline.json`（这一节的机读版）。

### 8.5 渲染验证（t1 报告第 4 节那条「必须在 Edge 里证明」）

```
$ node tools/iconpack-render.mjs
测试页: tools\iconpack-render.html（75 个图标 · 真实 style.css 的 .ico-* 规则）
截图   -> tools/shots/iconpack-render.png (362 KB)
统计   -> tools/shots/iconpack-render-stats.txt
汇总: 共 75 个 · 空白 0 · 纯色方块 0 · 覆盖率 17.35% (help) ~ 84.69% (shield_02) · 平均 44.9%
渲染验证通过。
```

- 页面**真的加载 `../../src/ui/style.css`**（不是把 SVG 内联成 data URI 的副本），所以它验证的是游戏实际渲染路径；
  每个图标都用真实的 `.ico-*` 类（mask + `currentColor`）画在棋盘格上 —— 截图里 75 个图形全部可见，没有空白格、没有实心方块。
- 像素统计口径与 t1 一致：`alpha 覆盖率 <1% → 空白`、`>90% 且墨迹铺满整框 → 纯色方块`。本次 75/75 都是 OK。
- 统计脚本的**检测能力本身也验过**：把 `flame.svg` 换成空 `<svg>` 重跑 → `flame  0  0x0  !! 空白` 且退出码 1；换回即恢复。
- 现有 Kenney PNG 的读数（29 个本地图标 17%–60%）与 pack SVG（22%–85%）都落在「不是空白也不是方块」的区间。

### 8.6 落地后的实测数字（t4 核对用）

| 项目 | 数字 |
|---|---|
| 图标总数 | **75**（Game-Icon-Pack 46 + 本地 Kenney 29；`.ico-*` 类各一条） |
| pack 素材体积 | **40,926 B**（46 个 SVG，正好等于 t1 报告 §4.3 的预估） |
| 参与内联的图标素材合计 | **335,384 B**（磁盘原始字节）＝pack 40,926 + 本地 294,458（老的 24 个 204,454 + 本次新注册的 6 个 90,576；两张卡面 PNG 在磁盘上仍在，但本次已不再被 `.ico-*` 引用） |
| 其中 pack 部分 base64 后 | ≈ **55.9 KB**（单份；实际在单文件里被内联两遍，见下） |
| 单文件包增量 | **+356,931 B（+1.77%）**：`<style>` 块 12,595,023 → 12,951,954 B |
| 其中 URL/图标数据 | **+351,856 B** |
| 其中 CSS 文本 | **+5,175 B**（生成区块 13,649 B 替换掉原来手写的 3,214 B，另加 232 B 说明注释） |
| 打包日志 | `CSS 内联素材: 74/74 个（原始 327.5 KB）`；`verify-bundle.mjs` 全绿 |

增量 +351,856 B（URL 数据）+ 5,175 B（CSS 文本）的来源（按单文件里的实际 data URI 逐条归账，已闭合）：

```
本次新注册的 6 个本地 Kenney PNG（arrow_right/arrow_up/diamond/key/pause/trash）
     原始 90,576 B，单文件里被内联 2 遍 → 120,768 B（数据）+ 120,768 B（第二遍） = +241,536 B
46 个 pack SVG（原始 40,926 B）被内联成 92 条 data URI            = +111,664 B
46 条 pack 规则额外指向的 2 张卡面 PNG（sword/shield，各 1 处）    = +965 B（原始）
生成区块 CSS 文本（13,649 B，替换掉原来手写的 3,214 B）            = +10,435 B
------------------------------------------------------------------------
合计                                                              ≈ +364 KB
实测：<style> 12,595,023 → 12,951,954 B = +356,931 B（差 2%，来自 base64 取整与文本口径）
```

关键点：`bundle.mjs` 是按 `url()` **逐处**替换成 data URI 的，而每条 `.ico-*` 规则都要写两条声明
（`-webkit-mask-image` + `mask-image`，这是 t1 报告 §4.2 认可的既有写法），
所以**同一份素材在单文件里天然是两遍**（实测：58 条 PNG data URI = 29 个本地图标 × 2，92 条 SVG = 46 × 2）。
手写 25 条规则时「两遍」只发生在 25 处，生成 75 条后发生在 75 处，于是 pack SVG 的 41 KB 原始体积
在包里体现成 ≈ 112 KB。这是现有接法 + 打包器的既有行为，本次没有改动
（要改就得动 `bundle.mjs` 或让规则用 CSS 变量承载 data URI，那属于改 t1 已验证的接法，超出本步骤范围）。

**为什么是「变大」而不是 t1 预估的「净减 213 KB」**（这个偏差值得记下来，别再按 213 KB 对外说）：

1. t1 的 213 KB 是「把 24 个老图标**全部替换**成 46 个新图标」的账（266.2 KB → 53.3 KB）。
   而本步骤按验收要求**保留全部现有 Kenney 素材**（`.ico-*` 一个都不能少，t3 还要在它们之上接线），
   所以是「204 KB 老素材 + 41 KB 新素材」的**加法**，并且额外把 6 个原本只定义在 CSS、没人用的
   本地 Kenney PNG（15 KB/张）也纳入了注册表。
2. 单文件包现在为此多背 ≈ 350 KB（+1.77%），摊到 20.2 MB 的产物上约等于零。
3. 真正的收益要等 t3 把调用点切到 pack 图标之后再兑现：等 `assets/img/cards/*.png` 这批 15 KB/张的
   老素材不再被 `.ico-*` 引用，图标内联量会从 335 KB 回落到 ≈ 90 KB（含 2 份内联），
   也就是回到 t1 预估的「净减 200 KB 级」；本次只是先把货架搭好。

### 8.7 给 t3（接线）的三条注意事项

1. **类名只用 `[a-z0-9_]`**：pack 里带连字符的图标在注册表里已经改名成下划线形式
   （`shield-02 → shield_02`、`action-points → action_points`、`fire → flame`、`potion → poison`、
   `medical-kit → heal`、`rotate-left → counter`、`trophy → award`、`death → death`、`cards → deck` …）；
   要用哪个先看 `content/icons.json` 的 `desc`，不要自己拼上游文件名。
2. **语义雷区照抄 t1**：`coin` 的造型是字母「C」，金币用 `star_coin`；`shield`（纯盾）与 `shield_02`（圆角盾）
   是两个不同概念，`temperature_down` 给「虚弱/降防」、`battery_negative` 给「降攻」，别混。
3. **接线只改调用点，不要改注册表结构**：改完 `ico-xxx` 之后跑
   `node tools/check-icons.mjs`（会不会有空白方块）和 `node tools/check-content.mjs --strict`（卡牌 ico 是否都注册过）。

### 8.8 最终门禁结果（本步骤收尾时实跑）

| 命令 | 结果 | 说明 |
|---|---|---|
| `node tools/build-content.mjs` | exit 0 | `生成区块：无变化`（幂等：连跑两次不产生 diff） |
| `node tools/check-icons.mjs` | exit 0 | 75 个类都有定义；代码用到的 23 个全部命中；151 个 url() 素材全部存在 |
| `node tools/check-content.mjs` | exit 0 | 内容体检通过（新增了一段「注册表 ↔ 生成区块」对齐检查：`图标注册表 75 条…生成区块 75 条 .ico-*`） |
| `node tools/check-content.mjs --strict` | **exit 1（与本步骤无关）** | 仅因为 2 条**既有**提醒：`道具 charm_luck 的图 assets/img/cards/star_1.png 不存在`、`道具 charm_agi 的图 …/spark_1.png 不存在`（这两个文件名来自 `content/cards.json`，磁盘上从来没有这两个文件；t1/t2 都没删过素材，`content/cards.json` 也不在 t2 的改动范围里 → 只能由 t3 把这两个道具的 `art` 改指到已注册图标（如 `star_coin` / `arrow_up`）来解决） |
| `node tools/bundle.mjs` | exit 0 | `CSS 内联素材: 74/74 个（原始 327.5 KB）` |
| `node tools/verify-bundle.mjs` | exit 0 | `VERIFY_OK`，`ERRORS=[]`（一场战斗 + 9 个界面全部渲染） |
| `node tools/iconpack-render.mjs` | exit 0 | 75/75 无空白、无纯色方块 |

另外补了一条**针对单文件产物本身**的验证（一次性脚本，未入库）：
从 `oasis-game.html` 的 `<style>` 里抽出 `.ico-*` 规则引用到的 data URI → 74 条（46 个 SVG + 28 个 PNG），
在 Edge 里逐条当图片加载：**74/74 成功**（SVG 46/46），证明打包后图标不会变成空白。
