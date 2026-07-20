from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

BG = "#0a151b"
TEAL = "#55c2aa"
GOLD = "#e3b45e"
CREAM = "#fff1d2"
RED = "#d5533f"


def font(size: int):
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def make_icon(size: int, maskable: bool = False):
    image = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(image)
    margin = int(size * (0.16 if maskable else 0.09))
    stroke = max(4, size // 48)

    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=size // 10,
        fill="#10252b",
        outline=GOLD,
        width=stroke,
    )

    center = size // 2
    diamond_radius = int(size * 0.25)
    diamond = [
        (center, center - diamond_radius),
        (center + diamond_radius, center),
        (center, center + diamond_radius),
        (center - diamond_radius, center),
    ]
    draw.line(diamond + [diamond[0]], fill=TEAL, width=stroke)

    ball_r = int(size * 0.17)
    ball_center = (center, int(size * 0.38))
    draw.ellipse(
        (ball_center[0] - ball_r, ball_center[1] - ball_r, ball_center[0] + ball_r, ball_center[1] + ball_r),
        fill=CREAM,
        outline=GOLD,
        width=max(2, stroke // 2),
    )
    seam = max(2, size // 96)
    draw.arc(
        (ball_center[0] - ball_r // 2, ball_center[1] - ball_r, ball_center[0] + ball_r // 2, ball_center[1] + ball_r),
        70,
        290,
        fill=RED,
        width=seam,
    )

    label_font = font(int(size * 0.29))
    label = "45"
    box = draw.textbbox((0, 0), label, font=label_font)
    text_x = center - (box[2] - box[0]) // 2
    text_y = int(size * 0.54)
    draw.text((text_x + stroke, text_y + stroke), label, font=label_font, fill="#02080a")
    draw.text((text_x, text_y), label, font=label_font, fill=GOLD)

    return image


make_icon(192).save(OUT / "icon-192.png", optimize=True)
make_icon(512).save(OUT / "icon-512.png", optimize=True)
make_icon(512, maskable=True).save(OUT / "icon-maskable-512.png", optimize=True)
make_icon(180).save(OUT / "apple-touch-icon.png", optimize=True)
