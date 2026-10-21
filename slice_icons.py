from PIL import Image
import os

img = Image.open('icons_grid.png').convert('RGBA')
w, h = img.size

COLS = 9
ROWS = 5
cell_w = w // COLS
cell_h = h // ROWS

print(f"Картинка: {w}x{h}, ячейка: {cell_w}x{cell_h}")

names = [
    'groceries', 'cafe', 'food', 'taxi', 'fuel', 'transport', 'home', 'rent', 'mortgage',
    'utilities', 'internet', 'entertainment', 'subscriptions', 'shopping', 'clothes', 'tech', 'pharmacy', 'health',
    'sport', 'beauty', 'education', 'kids', 'pets', 'travel', 'credit', 'insurance', 'taxes',
    'repair', 'garage', 'garden', 'gifts', 'charity', 'salary', 'advance', 'bonus', 'freelance',
    'business', 'investments', 'dividends', 'deposit', 'cashback', 'refund',
    'transfer-in', 'transfer-user', 'transfer-internal',
]

out_dir = 'frontend/public/img/icons/categories'
os.makedirs(out_dir, exist_ok=True)

PADDING = 30  # запас в пикселях вокруг ячейки

idx = 0
for row in range(ROWS):
    for col in range(COLS):
        if idx >= len(names):
            break

        # Границы с запасом
        left = max(0, col * cell_w - PADDING)
        top = max(0, row * cell_h - PADDING)
        right = min(w, (col + 1) * cell_w + PADDING)
        bottom = min(h, (row + 1) * cell_h + PADDING)

        cell = img.crop((left, top, right, bottom))

        # ✅ Авто-обрезка прозрачных краёв
        bbox = cell.getbbox()
        if bbox:
            cell = cell.crop(bbox)

        # ✅ Добавляем небольшой padding обратно (чтобы иконка не прилипала к краю)
        pad = 20
        new_w = cell.width + pad * 2
        new_h = cell.height + pad * 2
        canvas = Image.new('RGBA', (new_w, new_h), (0, 0, 0, 0))
        canvas.paste(cell, (pad, pad), cell)
        cell = canvas

        # ✅ Приводим к квадрату (общий размер)
        max_side = max(cell.width, cell.height)
        square = Image.new('RGBA', (max_side, max_side), (0, 0, 0, 0))
        square.paste(cell, ((max_side - cell.width) // 2, (max_side - cell.height) // 2), cell)

        # ✅ Ресайз до 256×256 (стандарт для иконок)
        square = square.resize((256, 256), Image.LANCZOS)

        square.save(f'{out_dir}/{names[idx]}.png')
        print(f'OK: {names[idx]}.png ({square.width}x{square.height})')
        idx += 1

print(f'\nГотово! {idx} файлов сохранено в {out_dir}/')