// 本文件由 tools/import-gen9.mjs 生成，请勿手改。
//
// 每只宝可梦的回合切换立绘：front = 正面（敌方用），back = 背面（我方用，和正作一样看自己人的后背）。
// front.png / back.png 已经**按可见内容裁到包围盒**，所以界面只要按 w/h 的宽高比缩放到目标框里就行，
// 不需要再算偏移；canvas/box 是裁切前的原始画布与包围盒，留给诊断脚本核对。

/** @type {Record<string, {front: Gen9Sprite, back: Gen9Sprite}>} */
export const GEN9_ART = {
  sandshrew: {
    front: { w: 74, h: 82, canvas: { w: 192, h: 192 }, box: { x: 64, y: 54, w: 70, h: 78 } },
    back: { w: 124, h: 118, canvas: { w: 288, h: 288 }, box: { x: 69, y: 84, w: 120, h: 114 } },
  },
  cacnea: {
    front: { w: 112, h: 78, canvas: { w: 192, h: 192 }, box: { x: 38, y: 60, w: 108, h: 74 } },
    back: { w: 163, h: 115, canvas: { w: 288, h: 288 }, box: { x: 66, y: 90, w: 159, h: 111 } },
  },
  gible: {
    front: { w: 94, h: 106, canvas: { w: 192, h: 192 }, box: { x: 50, y: 40, w: 90, h: 102 } },
    back: { w: 136, h: 148, canvas: { w: 288, h: 288 }, box: { x: 78, y: 72, w: 132, h: 144 } },
  },
  swablu: {
    front: { w: 144, h: 76, canvas: { w: 192, h: 192 }, box: { x: 26, y: 60, w: 140, h: 72 } },
    back: { w: 211, h: 115, canvas: { w: 288, h: 288 }, box: { x: 39, y: 90, w: 207, h: 111 } },
  },
  sandslash: {
    front: { w: 110, h: 102, canvas: { w: 192, h: 192 }, box: { x: 42, y: 44, w: 106, h: 98 } },
    back: { w: 160, h: 148, canvas: { w: 288, h: 288 }, box: { x: 69, y: 72, w: 156, h: 144 } },
  },
  maractus: {
    front: { w: 120, h: 146, canvas: { w: 192, h: 192 }, box: { x: 38, y: 26, w: 116, h: 142 } },
    back: { w: 193, h: 217, canvas: { w: 288, h: 288 }, box: { x: 39, y: 33, w: 189, h: 213 } },
  },
  cacturne: {
    front: { w: 130, h: 144, canvas: { w: 192, h: 192 }, box: { x: 34, y: 26, w: 126, h: 140 } },
    back: { w: 196, h: 214, canvas: { w: 288, h: 288 }, box: { x: 45, y: 39, w: 192, h: 210 } },
  },
  rhyhorn: {
    front: { w: 132, h: 112, canvas: { w: 192, h: 192 }, box: { x: 28, y: 42, w: 128, h: 108 } },
    back: { w: 211, h: 166, canvas: { w: 288, h: 288 }, box: { x: 51, y: 69, w: 207, h: 162 } },
  },
  gligar: {
    front: { w: 122, h: 106, canvas: { w: 192, h: 192 }, box: { x: 36, y: 42, w: 118, h: 102 } },
    back: { w: 175, h: 169, canvas: { w: 288, h: 288 }, box: { x: 66, y: 60, w: 171, h: 165 } },
  },
  steelix: {
    front: { w: 166, h: 152, canvas: { w: 192, h: 192 }, box: { x: 10, y: 24, w: 162, h: 148 } },
    back: { w: 244, h: 241, canvas: { w: 288, h: 288 }, box: { x: 24, y: 27, w: 240, h: 237 } },
  },
  tyranitar: {
    front: { w: 158, h: 156, canvas: { w: 192, h: 192 }, box: { x: 20, y: 20, w: 154, h: 152 } },
    back: { w: 205, h: 235, canvas: { w: 288, h: 288 }, box: { x: 18, y: 30, w: 201, h: 231 } },
  },
  magcargo: {
    front: { w: 104, h: 116, canvas: { w: 192, h: 192 }, box: { x: 46, y: 40, w: 100, h: 112 } },
    back: { w: 139, h: 178, canvas: { w: 288, h: 288 }, box: { x: 72, y: 42, w: 135, h: 174 } },
  },
  machop: {
    front: { w: 104, h: 104, canvas: { w: 192, h: 192 }, box: { x: 44, y: 46, w: 100, h: 100 } },
    back: { w: 157, h: 157, canvas: { w: 288, h: 288 }, box: { x: 66, y: 72, w: 153, h: 153 } },
  },
  carnivine: {
    front: { w: 160, h: 124, canvas: { w: 192, h: 192 }, box: { x: 18, y: 36, w: 156, h: 120 } },
    back: { w: 241, h: 178, canvas: { w: 288, h: 288 }, box: { x: 27, y: 57, w: 237, h: 174 } },
  },
  arbok: {
    front: { w: 126, h: 134, canvas: { w: 192, h: 192 }, box: { x: 20, y: 28, w: 122, h: 130 } },
    back: { w: 193, h: 202, canvas: { w: 288, h: 288 }, box: { x: 48, y: 45, w: 189, h: 198 } },
  },
  machoke: {
    front: { w: 116, h: 142, canvas: { w: 192, h: 192 }, box: { x: 36, y: 26, w: 112, h: 138 } },
    back: { w: 175, h: 208, canvas: { w: 288, h: 288 }, box: { x: 60, y: 42, w: 171, h: 204 } },
  },
  arcanine: {
    front: { w: 144, h: 142, canvas: { w: 192, h: 192 }, box: { x: 26, y: 30, w: 140, h: 138 } },
    back: { w: 205, h: 208, canvas: { w: 288, h: 288 }, box: { x: 51, y: 57, w: 201, h: 204 } },
  },
  aerodactyl: {
    front: { w: 162, h: 122, canvas: { w: 192, h: 192 }, box: { x: 12, y: 34, w: 158, h: 118 } },
    back: { w: 241, h: 205, canvas: { w: 288, h: 288 }, box: { x: 27, y: 45, w: 237, h: 201 } },
  },
  garchomp: {
    front: { w: 150, h: 156, canvas: { w: 192, h: 192 }, box: { x: 18, y: 20, w: 146, h: 152 } },
    back: { w: 232, h: 223, canvas: { w: 288, h: 288 }, box: { x: 30, y: 36, w: 228, h: 219 } },
  },
  larvitar: {
    front: { w: 72, h: 92, canvas: { w: 192, h: 192 }, box: { x: 62, y: 56, w: 68, h: 88 } },
    back: { w: 97, h: 136, canvas: { w: 288, h: 288 }, box: { x: 87, y: 72, w: 93, h: 132 } },
  },
  gabite: {
    front: { w: 134, h: 126, canvas: { w: 192, h: 192 }, box: { x: 30, y: 36, w: 130, h: 122 } },
    back: { w: 199, h: 184, canvas: { w: 288, h: 288 }, box: { x: 45, y: 54, w: 195, h: 180 } },
  },
  rhydon: {
    front: { w: 150, h: 130, canvas: { w: 192, h: 192 }, box: { x: 20, y: 36, w: 146, h: 126 } },
    back: { w: 229, h: 190, canvas: { w: 288, h: 288 }, box: { x: 33, y: 51, w: 225, h: 186 } },
  },
  salamence: {
    front: { w: 160, h: 146, canvas: { w: 192, h: 192 }, box: { x: 18, y: 24, w: 156, h: 142 } },
    back: { w: 253, h: 232, canvas: { w: 288, h: 288 }, box: { x: 21, y: 30, w: 249, h: 228 } },
  },
  machamp: {
    front: { w: 130, h: 140, canvas: { w: 192, h: 192 }, box: { x: 28, y: 30, w: 126, h: 136 } },
    back: { w: 205, h: 211, canvas: { w: 288, h: 288 }, box: { x: 51, y: 51, w: 201, h: 207 } },
  },
  metagross: {
    front: { w: 158, h: 108, canvas: { w: 192, h: 192 }, box: { x: 18, y: 44, w: 154, h: 104 } },
    back: { w: 232, h: 160, canvas: { w: 288, h: 288 }, box: { x: 27, y: 66, w: 228, h: 156 } },
  },
  zygarde: {
    front: { w: 148, h: 180, canvas: { w: 192, h: 192 }, box: { x: 24, y: 8, w: 144, h: 176 } },
    back: { w: 220, h: 268, canvas: { w: 288, h: 288 }, box: { x: 36, y: 12, w: 216, h: 264 } },
  },
  paras: {
    front: { w: 94, h: 78, canvas: { w: 192, h: 192 }, box: { x: 40, y: 54, w: 90, h: 74 } },
    back: { w: 145, h: 100, canvas: { w: 288, h: 288 }, box: { x: 75, y: 96, w: 141, h: 96 } },
  },
  oddish: {
    front: { w: 72, h: 74, canvas: { w: 192, h: 192 }, box: { x: 62, y: 64, w: 68, h: 70 } },
    back: { w: 118, h: 112, canvas: { w: 288, h: 288 }, box: { x: 87, y: 90, w: 114, h: 108 } },
  },
  weedle: {
    front: { w: 60, h: 78, canvas: { w: 192, h: 192 }, box: { x: 68, y: 60, w: 56, h: 74 } },
    back: { w: 112, h: 118, canvas: { w: 288, h: 288 }, box: { x: 81, y: 81, w: 108, h: 114 } },
  },
  bellsprout: {
    front: { w: 78, h: 92, canvas: { w: 192, h: 192 }, box: { x: 58, y: 52, w: 74, h: 88 } },
    back: { w: 130, h: 142, canvas: { w: 288, h: 288 }, box: { x: 75, y: 75, w: 126, h: 138 } },
  },
  parasect: {
    front: { w: 114, h: 118, canvas: { w: 192, h: 192 }, box: { x: 38, y: 40, w: 110, h: 114 } },
    back: { w: 184, h: 160, canvas: { w: 288, h: 288 }, box: { x: 54, y: 66, w: 180, h: 156 } },
  },
  gloom: {
    front: { w: 102, h: 94, canvas: { w: 192, h: 192 }, box: { x: 42, y: 52, w: 98, h: 90 } },
    back: { w: 148, h: 139, canvas: { w: 288, h: 288 }, box: { x: 72, y: 78, w: 144, h: 135 } },
  },
  beedrill: {
    front: { w: 128, h: 122, canvas: { w: 192, h: 192 }, box: { x: 30, y: 38, w: 124, h: 118 } },
    back: { w: 184, h: 181, canvas: { w: 288, h: 288 }, box: { x: 60, y: 57, w: 180, h: 177 } },
  },
  pinsir: {
    front: { w: 136, h: 126, canvas: { w: 192, h: 192 }, box: { x: 12, y: 30, w: 132, h: 122 } },
    back: { w: 211, h: 187, canvas: { w: 288, h: 288 }, box: { x: 42, y: 54, w: 207, h: 183 } },
  },
  heracross: {
    front: { w: 120, h: 130, canvas: { w: 192, h: 192 }, box: { x: 40, y: 24, w: 116, h: 126 } },
    back: { w: 193, h: 199, canvas: { w: 288, h: 288 }, box: { x: 63, y: 33, w: 189, h: 195 } },
  },
  sceptile: {
    front: { w: 132, h: 146, canvas: { w: 192, h: 192 }, box: { x: 32, y: 24, w: 128, h: 142 } },
    back: { w: 199, h: 235, canvas: { w: 288, h: 288 }, box: { x: 45, y: 30, w: 195, h: 231 } },
  },
  tentacool: {
    front: { w: 104, h: 110, canvas: { w: 192, h: 192 }, box: { x: 46, y: 44, w: 100, h: 106 } },
    back: { w: 154, h: 163, canvas: { w: 288, h: 288 }, box: { x: 63, y: 66, w: 150, h: 159 } },
  },
  shellder: {
    front: { w: 76, h: 66, canvas: { w: 192, h: 192 }, box: { x: 60, y: 66, w: 72, h: 62 } },
    back: { w: 115, h: 85, canvas: { w: 288, h: 288 }, box: { x: 84, y: 105, w: 111, h: 81 } },
  },
  corphish: {
    front: { w: 100, h: 92, canvas: { w: 192, h: 192 }, box: { x: 40, y: 52, w: 96, h: 88 } },
    back: { w: 145, h: 136, canvas: { w: 288, h: 288 }, box: { x: 75, y: 78, w: 141, h: 132 } },
  },
  remoraid: {
    front: { w: 76, h: 76, canvas: { w: 192, h: 192 }, box: { x: 60, y: 60, w: 72, h: 72 } },
    back: { w: 133, h: 145, canvas: { w: 288, h: 288 }, box: { x: 69, y: 87, w: 129, h: 141 } },
  },
  tentacruel: {
    front: { w: 146, h: 130, canvas: { w: 192, h: 192 }, box: { x: 4, y: 38, w: 142, h: 126 } },
    back: { w: 223, h: 190, canvas: { w: 288, h: 288 }, box: { x: 36, y: 51, w: 219, h: 186 } },
  },
  cloyster: {
    front: { w: 126, h: 128, canvas: { w: 192, h: 192 }, box: { x: 28, y: 30, w: 122, h: 124 } },
    back: { w: 181, h: 172, canvas: { w: 288, h: 288 }, box: { x: 57, y: 60, w: 177, h: 168 } },
  },
  crawdaunt: {
    front: { w: 134, h: 124, canvas: { w: 192, h: 192 }, box: { x: 30, y: 36, w: 130, h: 120 } },
    back: { w: 208, h: 181, canvas: { w: 288, h: 288 }, box: { x: 45, y: 51, w: 204, h: 177 } },
  },
  kingler: {
    front: { w: 158, h: 122, canvas: { w: 192, h: 192 }, box: { x: 22, y: 38, w: 154, h: 118 } },
    back: { w: 241, h: 190, canvas: { w: 288, h: 288 }, box: { x: 27, y: 48, w: 237, h: 186 } },
  },
  gyarados: {
    front: { w: 166, h: 158, canvas: { w: 192, h: 192 }, box: { x: 10, y: 18, w: 162, h: 154 } },
    back: { w: 277, h: 235, canvas: { w: 288, h: 288 }, box: { x: 9, y: 21, w: 273, h: 231 } },
  },
  kyogre: {
    front: { w: 192, h: 118, canvas: { w: 192, h: 192 }, box: { x: 2, y: 38, w: 188, h: 114 } },
    back: { w: 288, h: 169, canvas: { w: 288, h: 288 }, box: { x: 1, y: 63, w: 287, h: 165 } },
  },
  geodude: {
    front: { w: 116, h: 52, canvas: { w: 192, h: 192 }, box: { x: 42, y: 70, w: 112, h: 48 } },
    back: { w: 175, h: 88, canvas: { w: 288, h: 288 }, box: { x: 69, y: 105, w: 171, h: 84 } },
  },
  pidgey: {
    front: { w: 78, h: 86, canvas: { w: 192, h: 192 }, box: { x: 62, y: 54, w: 74, h: 82 } },
    back: { w: 124, h: 124, canvas: { w: 288, h: 288 }, box: { x: 84, y: 78, w: 120, h: 120 } },
  },
  aron: {
    front: { w: 66, h: 66, canvas: { w: 192, h: 192 }, box: { x: 64, y: 64, w: 62, h: 62 } },
    back: { w: 100, h: 100, canvas: { w: 288, h: 288 }, box: { x: 96, y: 96, w: 96, h: 96 } },
  },
  taillow: {
    front: { w: 84, h: 76, canvas: { w: 192, h: 192 }, box: { x: 56, y: 60, w: 80, h: 72 } },
    back: { w: 139, h: 106, canvas: { w: 288, h: 288 }, box: { x: 75, y: 90, w: 135, h: 102 } },
  },
  graveler: {
    front: { w: 138, h: 92, canvas: { w: 192, h: 192 }, box: { x: 26, y: 52, w: 134, h: 88 } },
    back: { w: 199, h: 130, canvas: { w: 288, h: 288 }, box: { x: 57, y: 78, w: 195, h: 126 } },
  },
  fearow: {
    front: { w: 168, h: 148, canvas: { w: 192, h: 192 }, box: { x: 6, y: 16, w: 164, h: 144 } },
    back: { w: 214, h: 235, canvas: { w: 288, h: 288 }, box: { x: 39, y: 30, w: 210, h: 231 } },
  },
  lairon: {
    front: { w: 120, h: 102, canvas: { w: 192, h: 192 }, box: { x: 38, y: 46, w: 116, h: 98 } },
    back: { w: 181, h: 148, canvas: { w: 288, h: 288 }, box: { x: 57, y: 72, w: 177, h: 144 } },
  },
  skarmory: {
    front: { w: 136, h: 140, canvas: { w: 192, h: 192 }, box: { x: 26, y: 28, w: 132, h: 136 } },
    back: { w: 241, h: 193, canvas: { w: 288, h: 288 }, box: { x: 27, y: 57, w: 237, h: 189 } },
  },
  gliscor: {
    front: { w: 150, h: 118, canvas: { w: 192, h: 192 }, box: { x: 24, y: 40, w: 146, h: 114 } },
    back: { w: 214, h: 190, canvas: { w: 288, h: 288 }, box: { x: 39, y: 51, w: 210, h: 186 } },
  },
  aggron: {
    front: { w: 148, h: 148, canvas: { w: 192, h: 192 }, box: { x: 24, y: 24, w: 144, h: 144 } },
    back: { w: 193, h: 220, canvas: { w: 288, h: 288 }, box: { x: 45, y: 39, w: 189, h: 216 } },
  },
  pupitar: {
    front: { w: 76, h: 90, canvas: { w: 192, h: 192 }, box: { x: 56, y: 54, w: 72, h: 86 } },
    back: { w: 106, h: 139, canvas: { w: 288, h: 288 }, box: { x: 90, y: 72, w: 102, h: 135 } },
  },
  flygon: {
    front: { w: 142, h: 142, canvas: { w: 192, h: 192 }, box: { x: 24, y: 28, w: 138, h: 138 } },
    back: { w: 226, h: 205, canvas: { w: 288, h: 288 }, box: { x: 33, y: 42, w: 222, h: 201 } },
  },
  trapinch: {
    front: { w: 80, h: 88, canvas: { w: 192, h: 192 }, box: { x: 58, y: 54, w: 76, h: 84 } },
    back: { w: 121, h: 139, canvas: { w: 288, h: 288 }, box: { x: 84, y: 78, w: 117, h: 135 } },
  },
  hippopotas: {
    front: { w: 128, h: 84, canvas: { w: 192, h: 192 }, box: { x: 34, y: 56, w: 124, h: 80 } },
    back: { w: 172, h: 133, canvas: { w: 288, h: 288 }, box: { x: 60, y: 81, w: 168, h: 129 } },
  },
  sandile: {
    front: { w: 94, h: 56, canvas: { w: 192, h: 192 }, box: { x: 46, y: 70, w: 90, h: 52 } },
    back: { w: 166, h: 103, canvas: { w: 288, h: 288 }, box: { x: 57, y: 84, w: 162, h: 99 } },
  },
  mudbray: {
    front: { w: 96, h: 116, canvas: { w: 192, h: 192 }, box: { x: 48, y: 40, w: 92, h: 112 } },
    back: { w: 142, h: 172, canvas: { w: 288, h: 288 }, box: { x: 75, y: 60, w: 138, h: 168 } },
  },
  sandygast: {
    front: { w: 112, h: 96, canvas: { w: 192, h: 192 }, box: { x: 42, y: 50, w: 108, h: 92 } },
    back: { w: 166, h: 142, canvas: { w: 288, h: 288 }, box: { x: 63, y: 75, w: 162, h: 138 } },
  },
  numel: {
    front: { w: 90, h: 98, canvas: { w: 192, h: 192 }, box: { x: 54, y: 50, w: 86, h: 94 } },
    back: { w: 130, h: 160, canvas: { w: 288, h: 288 }, box: { x: 81, y: 69, w: 126, h: 156 } },
  },
  roggenrola: {
    front: { w: 44, h: 76, canvas: { w: 192, h: 192 }, box: { x: 76, y: 60, w: 40, h: 72 } },
    back: { w: 64, h: 109, canvas: { w: 288, h: 288 }, box: { x: 114, y: 90, w: 60, h: 105 } },
  },
  rockruff: {
    front: { w: 86, h: 88, canvas: { w: 192, h: 192 }, box: { x: 56, y: 58, w: 82, h: 84 } },
    back: { w: 127, h: 130, canvas: { w: 288, h: 288 }, box: { x: 75, y: 87, w: 123, h: 126 } },
  },
  treecko: {
    front: { w: 86, h: 94, canvas: { w: 192, h: 192 }, box: { x: 54, y: 52, w: 82, h: 90 } },
    back: { w: 136, h: 142, canvas: { w: 288, h: 288 }, box: { x: 78, y: 75, w: 132, h: 138 } },
  },
  snivy: {
    front: { w: 84, h: 78, canvas: { w: 192, h: 192 }, box: { x: 56, y: 60, w: 80, h: 74 } },
    back: { w: 124, h: 118, canvas: { w: 288, h: 288 }, box: { x: 84, y: 87, w: 120, h: 114 } },
  },
  ferroseed: {
    front: { w: 64, h: 76, canvas: { w: 192, h: 192 }, box: { x: 66, y: 60, w: 60, h: 72 } },
    back: { w: 94, h: 112, canvas: { w: 288, h: 288 }, box: { x: 99, y: 90, w: 90, h: 108 } },
  },
  grubbin: {
    front: { w: 88, h: 52, canvas: { w: 192, h: 192 }, box: { x: 56, y: 72, w: 84, h: 48 } },
    back: { w: 112, h: 76, canvas: { w: 288, h: 288 }, box: { x: 93, y: 108, w: 108, h: 72 } },
  },
  fomantis: {
    front: { w: 60, h: 94, canvas: { w: 192, h: 192 }, box: { x: 68, y: 50, w: 56, h: 90 } },
    back: { w: 88, h: 139, canvas: { w: 288, h: 288 }, box: { x: 102, y: 75, w: 84, h: 135 } },
  },
  shellos: {
    front: { w: 66, h: 78, canvas: { w: 192, h: 192 }, box: { x: 64, y: 56, w: 62, h: 74 } },
    back: { w: 100, h: 121, canvas: { w: 288, h: 288 }, box: { x: 96, y: 84, w: 96, h: 117 } },
  },
  wishiwashi: {
    front: { w: 78, h: 50, canvas: { w: 192, h: 192 }, box: { x: 56, y: 82, w: 74, h: 46 } },
    back: { w: 118, h: 73, canvas: { w: 288, h: 288 }, box: { x: 78, y: 114, w: 114, h: 69 } },
  },
  mareanie: {
    front: { w: 114, h: 92, canvas: { w: 192, h: 192 }, box: { x: 36, y: 54, w: 110, h: 88 } },
    back: { w: 160, h: 142, canvas: { w: 288, h: 288 }, box: { x: 54, y: 78, w: 156, h: 138 } },
  },
  pyukumuku: {
    front: { w: 84, h: 58, canvas: { w: 192, h: 192 }, box: { x: 56, y: 68, w: 80, h: 54 } },
    back: { w: 124, h: 85, canvas: { w: 288, h: 288 }, box: { x: 84, y: 102, w: 120, h: 81 } },
  },
  fletchling: {
    front: { w: 68, h: 82, canvas: { w: 192, h: 192 }, box: { x: 64, y: 56, w: 64, h: 78 } },
    back: { w: 103, h: 112, canvas: { w: 288, h: 288 }, box: { x: 93, y: 90, w: 99, h: 108 } },
  },
  woobat: {
    front: { w: 130, h: 76, canvas: { w: 192, h: 192 }, box: { x: 30, y: 58, w: 126, h: 72 } },
    back: { w: 178, h: 100, canvas: { w: 288, h: 288 }, box: { x: 57, y: 102, w: 174, h: 96 } },
  },
  minior: {
    front: { w: 78, h: 78, canvas: { w: 192, h: 192 }, box: { x: 52, y: 58, w: 74, h: 74 } },
    back: { w: 115, h: 115, canvas: { w: 288, h: 288 }, box: { x: 78, y: 87, w: 111, h: 111 } },
  },
  buneary: {
    front: { w: 68, h: 118, canvas: { w: 192, h: 192 }, box: { x: 64, y: 38, w: 64, h: 114 } },
    back: { w: 106, h: 175, canvas: { w: 288, h: 288 }, box: { x: 102, y: 48, w: 102, h: 171 } },
  },
  litwick: {
    front: { w: 58, h: 78, canvas: { w: 192, h: 192 }, box: { x: 70, y: 58, w: 54, h: 74 } },
    back: { w: 88, h: 115, canvas: { w: 288, h: 288 }, box: { x: 102, y: 87, w: 84, h: 111 } },
  },
  yamask: {
    front: { w: 110, h: 80, canvas: { w: 192, h: 192 }, box: { x: 40, y: 56, w: 106, h: 76 } },
    back: { w: 157, h: 118, canvas: { w: 288, h: 288 }, box: { x: 60, y: 84, w: 153, h: 114 } },
  },
  honedge: {
    front: { w: 98, h: 114, canvas: { w: 192, h: 192 }, box: { x: 48, y: 40, w: 94, h: 110 } },
    back: { w: 169, h: 169, canvas: { w: 288, h: 288 }, box: { x: 60, y: 60, w: 165, h: 165 } },
  },
  drilbur: {
    front: { w: 110, h: 104, canvas: { w: 192, h: 192 }, box: { x: 40, y: 46, w: 106, h: 100 } },
    back: { w: 151, h: 133, canvas: { w: 288, h: 288 }, box: { x: 69, y: 81, w: 147, h: 129 } },
  },
  rolycoly: {
    front: { w: 94, h: 82, canvas: { w: 192, h: 192 }, box: { x: 52, y: 58, w: 90, h: 78 } },
    back: { w: 151, h: 118, canvas: { w: 288, h: 288 }, box: { x: 78, y: 90, w: 147, h: 114 } },
  },
};
