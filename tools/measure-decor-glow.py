#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""量「背景花纹在那一侧行动时亮了到底多少」（3.0.5）。

用户的要求是「微微变亮，但又不会太过明显」—— 这种话没法靠眼睛判断，
所以拿两张截图（同一场景、一张是该侧行动中、一张是停手之后）逐区域比亮度：
  · 自己那一侧（下半 · 玩家）：应该变亮，但幅度是个位数百分比；
  · 对面那一侧（上半 · 敌人）：应该**基本不动**（不然就是整屏一起亮，不是「那一侧」）。

用法：python tools/measure-decor-glow.py <行动中.png> <静置.png>
"""
import sys
from PIL import Image

hot, cold = sys.argv[1], sys.argv[2]
a = Image.open(hot).convert('L')
b = Image.open(cold).convert('L')
if a.size != b.size:
    print('两张图尺寸不一样，没法逐像素比')
    sys.exit(1)
W, H = a.size


def mean(img, box):
    return sum(img.crop(box).getdata()) / ((box[2] - box[0]) * (box[3] - box[1]))


# 战场大致范围（战斗界面上方那条 HUD 之下、手牌之上）
FIELD = (0.0, 0.145, 1.0, 0.735)


def field_box(w, h):
    return (int(FIELD[0] * w), int(FIELD[1] * h), int(FIELD[2] * w), int(FIELD[3] * h))


def sub(box, cx, cy, rw, rh):
    """在 box 里按**相对比例**取一小块（和 CSS 里 mask 的中心对齐）"""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    return (int(x0 + (cx - rw / 2) * w), int(y0 + (cy - rh / 2) * h),
            int(x0 + (cx + rw / 2) * w), int(y0 + (cy + rh / 2) * h))


F = field_box(W, H)
# 这两组比例就是 style.css 里那两个 mask 的中心（敌人 74%/20%、玩家 26%/80%）
regions = {
    '敌人那一侧（mask 中心）': sub(F, 0.74, 0.20, 0.26, 0.22),
    '玩家那一侧（mask 中心）': sub(F, 0.26, 0.80, 0.26, 0.22),
    '敌人半场（整块）': sub(F, 0.5, 0.22, 0.9, 0.42),
    '玩家半场（整块）': sub(F, 0.5, 0.80, 0.9, 0.42),
    '整屏（对照）': (0, 0, W, int(H * 0.80)),
}
print(f'{hot}  vs  {cold}')
print(f'{"区域":<24}{"行动中":>9}{"静置":>9}{"变化":>10}')
for name, box in regions.items():
    m1, m2 = mean(a, box), mean(b, box)
    pct = (m1 / m2 - 1) * 100 if m2 else 0
    print(f'{name:<24}{m1:>9.2f}{m2:>9.2f}{pct:>+9.1f}%')
print('\n（期望：行动那一侧的 mask 中心变亮几个百分点；对面那一侧与整屏只是轻微变化）')
