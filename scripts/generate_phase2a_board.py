from PIL import Image, ImageDraw, ImageFont
import os

ARTIFACT_DIR = "/home/lumen/.gemini/antigravity/brain/82964857-e449-46e0-81ce-123418d11be5"
OUTPUT_DIR = "public/models/phase2a_renders"

images = [
    ("phase2a_01_reality_a_independent.png", "1. Reality A: Classic Coke (100%)", "Warm Cinematic Red Atmosphere"),
    ("phase2a_02_reality_b_independent.png", "2. Reality B: Diet Coke (100%)", "Cool Metallic Silver Atmosphere"),
    ("phase2a_03_side_by_side_synchronization.png", "3. Side-by-Side Split View", "1:1 Spatial Alignment & Silhouette Lock"),
    ("phase2a_04_composite_100pct_reality_a.png", "4. Fullscreen Quad: 100% Reality A", "Compositor Target A Pass-Through"),
    ("phase2a_05_composite_100pct_reality_b.png", "5. Fullscreen Quad: 100% Reality B", "Compositor Target B Pass-Through"),
    ("phase2a_06_composite_50_50_mask.png", "6. Smooth 50/50 Threshold Blend", "Directional Feathered Linear Blend"),
    ("phase2a_07_organic_test_mask.png", "7. Procedural Organic Test Mask", "Simplex/FBM Fluid Boundary Reveal"),
]

# Create a 2-column or 3-column montage
thumb_w = 720
thumb_h = 450
gap_x = 24
gap_y = 60
cols = 2
rows = 4

board_w = cols * thumb_w + (cols + 1) * gap_x
board_h = rows * thumb_h + (rows + 1) * gap_y + 120

board = Image.new("RGB", (board_w, board_h), (14, 16, 21))
draw = ImageDraw.Draw(board)

# Header banner
draw.rectangle([(0, 0), (board_w, 90)], fill=(22, 25, 33))
draw.rectangle([(0, 88), (board_w, 90)], fill=(244, 0, 9))

try:
    font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
    font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    font_label = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
    font_note = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
except:
    font_title = font_sub = font_label = font_note = None

draw.text((gap_x, 20), "Coca-Cola Experience — Phase 2A: Dual-Reality Foundation", fill=(255, 255, 255), font=font_title)
draw.text((gap_x, 56), "Verified Renders across Dual Render Targets, Shared Geometry, and Dynamic Shader Compositor", fill=(160, 170, 185), font=font_sub)

for idx, (filename, label, note) in enumerate(images):
    c = idx % cols
    r = idx // cols

    x = gap_x + c * (thumb_w + gap_x)
    y = 110 + gap_y + r * (thumb_h + gap_y)

    img_path = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(img_path):
        img = Image.open(img_path)
        img = img.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        board.paste(img, (x, y))

        # Border
        draw.rectangle([(x - 1, y - 1), (x + thumb_w, y + thumb_h)], outline=(60, 68, 85), width=1)

        # Label above image
        draw.text((x, y - 42), label, fill=(245, 248, 252), font=font_label)
        draw.text((x, y - 20), note, fill=(148, 163, 184), font=font_note)

out_board = os.path.join(OUTPUT_DIR, "phase2a_master_deliverables_board.png")
board.save(out_board, quality=95)
if os.path.exists(ARTIFACT_DIR):
    board.save(os.path.join(ARTIFACT_DIR, "phase2a_master_deliverables_board.png"), quality=95)

print(f"Master deliverables board generated -> {out_board}")
