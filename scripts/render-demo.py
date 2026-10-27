"""Optional maintainer helper: render real, synthetic CLI output as a GIF.
Run `npm run demo`, then `python scripts/render-demo.py` (requires Pillow).
"""
from pathlib import Path
import textwrap
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
try:
    font = ImageFont.truetype(font_path, 18)
    small = ImageFont.truetype(font_path, 15)
except OSError:
    font = ImageFont.load_default(size=18)
    small = ImageFont.load_default(size=15)
lines = (root / 'docs/example-weekly.en.md').read_text().splitlines()
wrapped = []
for line in lines:
    wrapped.extend(textwrap.wrap(line, width=84, replace_whitespace=False) or [''])
frames = []
for page, start in enumerate(range(0, len(wrapped), 20)):
    im = Image.new('RGB', (1040, 720), '#101724')
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((12, 12, 1028, 708), radius=14, fill='#111c2b', outline='#263b52', width=2)
    draw.rounded_rectangle((12, 12, 1028, 58), radius=14, fill='#1c2d40')
    for i, color in enumerate(['#f16d67', '#e9bd60', '#63c58b']):
        x = 32 + i * 24
        draw.ellipse((x, 29, x + 12, 41), fill=color)
    draw.text((408, 25), 'devlog / offline report', font=small, fill='#c3d0df')
    draw.text((34, 82), '$ devlog range --since 2026-10-26 --until 2026-10-27', font=font, fill='#6fe0be')
    draw.text((34, 112), '    --template weekly --lang en --redact', font=font, fill='#6fe0be')
    for index, line in enumerate(wrapped[start:start + 20]):
        color = '#82b9ff' if line.startswith('#') else '#dce5ef'
        draw.text((34, 165 + index * 24), line, font=font, fill=color)
    draw.text((34, 674), f'Synthetic test data | real CLI output | page {page + 1}', font=small, fill='#7f95ab')
    frames.append(im)
frames[0].save(root / 'docs/demo.gif', save_all=True, append_images=frames[1:], duration=4200, loop=0, optimize=True)
print('Rendered docs/demo.gif')
