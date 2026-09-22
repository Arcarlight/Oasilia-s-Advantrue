#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""量「背景花纹在那一侧行动时亮了到底多少」（3.0.5 起）。

用户的要求是「微微变亮，但又不会太过明显」—— 这种话没法靠眼睛判断，
所以拿两张截图（同一场景、一张是该侧行动中、一张是停手之后）逐区域比亮度。

⚠ 3.0.6 起高亮中心是**跟着两只精灵的实际位置算的**（见 battle-view 的 layoutDecorGlow），
所以这里不再假设「敌人一定在右上、玩家一定在左下」，而是**自己在格子里找变亮最多的地方**：
  · 「最亮的那一格」= 这次点亮到底把哪儿照亮了、亮了多少；
  · 「中位数格子」= 其它地方基本没动（说明是局部变亮，不是整屏一起亮）。

用法：python tools/measure-decor-glow.py <行动中.png> <静置.png>
"""
import sys
import statistics
from PIL import Image

hot, cold = sys.argv[1], sys.argv[2]
A = Image.open(hot).convert('L')
B = Image.open(cold).convert('L')
if A.size != B.size:
    print('两张图尺寸不一样，没法逐像素比')
    sys.exit(1)
W, H = A.size

# 战场大致范围（HUD 之下、手牌之上）；格子只在这块里取
FIELD = (0.0, 0.145, 1.0, 0.735)
fx0, fy0, fx1, fy1 = (int(FIELD[0] * W), int(FIELD[1] * H), int(FIELD[2] * W), int(FIELD[3] * H))
COLS, ROWS = 24, 14


def block_mean(img, cx, cy):
    bw = (fx1 - fx0) / COLS
    bh = (fy1 - fy0) / ROWS
    box = (int(fx0 + cx * bw), int(fy0 + cy * bh), int(fx0 + (cx + 1) * bw), int(fy0 + (cy + 1) * bh))
    data = list(img.crop(box).getdata())
    return sum(data) / len(data) if data else 0.0


rows = []
for cy in range(ROWS):
    for cx in range(COLS):
        a, b = block_mean(A, cx, cy), block_mean(B, cx, cy)
        pct = (a / b - 1) * 100 if b else 0.0
        rows.append((pct, cx, cy, a, b))

rows.sort(reverse=True)
whole_a = sum(r[3] for r in rows) / len(rows)
whole_b = sum(r[4] for r in rows) / len(rows)
median = statistics.median(r[0] for r in rows)

print(f'{hot}  vs  {cold}')
print(f'  整块战场平均亮度  {whole_a:.2f} → {whole_b:.2f}（{(whole_a / whole_b - 1) * 100:+.1f}%）')
print('  变亮最多的三格：')
for pct, cx, cy, a, b in rows[:3]:
    x_pct = ((cx + 0.5) / COLS) * 100
    y_pct = ((cy + 0.5) / ROWS) * 100
    print(f'    {pct:+6.1f}%   位置 战场横向 {x_pct:4.0f}% / 纵向 {y_pct:4.0f}%   {b:.1f} → {a:.1f}')
print(f'  全部 {len(rows)} 格的变化中位数 {median:+.2f}%（其它地方基本没动 = 只亮了那一侧）')
