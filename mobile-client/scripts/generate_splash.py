from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def _pick_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    icon_path = root / "assets" / "icon.png"
    out_path = root / "assets" / "splash.png"

    # iPhone 14 Pro/15/16 baseline (keeps aspect for modern devices)
    W, H = 1290, 2796
    bg = (42, 10, 158, 255)  # #2a0a9e

    text = "BudgetIn Check"
    icon_size = 520
    font = _pick_font(92)

    base = Image.new("RGBA", (W, H), bg)
    icon = Image.open(icon_path).convert("RGBA").resize((icon_size, icon_size), Image.LANCZOS)

    measure = ImageDraw.Draw(base)
    bbox = measure.textbbox((0, 0), text, font=font)
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]

    spacing = 48
    block_h = icon_size + spacing + text_h
    start_y = int((H - block_h) * 0.45)  # slightly above vertical center

    icon_x = (W - icon_size) // 2
    icon_y = start_y
    text_x = (W - text_w) // 2
    text_y = icon_y + icon_size + spacing

    base.alpha_composite(icon, (icon_x, icon_y))

    draw = ImageDraw.Draw(base)
    shadow = (0, 0, 0, 140)
    for dx, dy in ((0, 2), (1, 2), (-1, 2)):
        draw.text((text_x + dx, text_y + dy), text, font=font, fill=shadow)
    draw.text((text_x, text_y), text, font=font, fill=(255, 255, 255, 235))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    base.save(out_path)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
