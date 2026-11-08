from PIL import Image, ImageDraw, ImageFont
import os

ARTIFACT_DIR = "/home/lumen/.gemini/antigravity/brain/82964857-e449-46e0-81ce-123418d11be5"
OUTPUT_DIR = "public/models/phase2d_audit"

images = [
    ("baseline_01_reality_a.png", "1. Reality A (Original Coke)", "Crimson Studio | ACES Filmic | HalfFloat Target"),
    ("baseline_02_reality_b.png", "2. Reality B (Diet Coke)", "Cool Slate Studio | Anodized Aluminum Material"),
    ("baseline_03_dual_reality_composite.png", "3. Dual-Reality Composite (Static)", "Midpoint Blend | Seamless 1:1 Spatial Registration"),
    ("baseline_04_fluid_active_composite.png", "4. Fluid-Driven Composite (Active)", "Dynamic Navier-Stokes Field | Localized Meniscus"),
    ("baseline_05_side_by_side_split.png", "5. Side-by-Side Split Diagnostic", "Geometric Silhouette & Contact Shadow Audit"),
    ("baseline_06_reveal_mask_diagnostic.png", "6. Density Reveal Mask Field", "Scalar Field Thresholding & Transition Boundary"),
]

cols = 3
rows = 2
thumb_w = 500
thumb_h = 312
margin = 24
header_h = 110
footer_h = 60
card_label_h = 64

board_w = margin * 2 + cols * thumb_w + (cols - 1) * margin
board_h = header_h + rows * (thumb_h + card_label_h + margin) + footer_h

board = Image.new("RGB", (board_w, board_h), (11, 13, 17))
draw = ImageDraw.Draw(board)

try:
    font_main = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
    font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    font_label = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    font_desc = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
    font_foot = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
except:
    font_main = font_sub = font_label = font_desc = font_foot = None

# Header
draw.text((margin, 24), "COCA-COLA EXPERIENCE — PHASE 2D: RENDERING PIPELINE BASELINE AUDIT BOARD", fill=(255, 255, 255), font=font_main)
draw.text((margin, 60), "Comprehensive Visual Baseline: Three.js Dual-Reality & Fluid Compositor Engine (Prior to Phase 2D Optimizations)", fill=(148, 163, 184), font=font_sub)

for idx, (img_name, title, desc) in enumerate(images):
    c = idx % cols
    r = idx // cols
    x = margin + c * (thumb_w + margin)
    y = header_h + r * (thumb_h + card_label_h + margin)

    img_path = os.path.join(OUTPUT_DIR, img_name)
    if not os.path.exists(img_path):
        img_path = os.path.join(ARTIFACT_DIR, img_name)

    if os.path.exists(img_path):
        img = Image.open(img_path)
        img_thumb = img.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        board.paste(img_thumb, (x, y))
        draw.rectangle([(x - 1, y - 1), (x + thumb_w, y + thumb_h)], outline=(51, 65, 85), width=1)
        
        # Labels
        label_y = y + thumb_h + 8
        draw.text((x, label_y), title, fill=(241, 245, 249), font=font_label)
        draw.text((x, label_y + 20), desc, fill=(148, 163, 184), font=font_desc)
    else:
        draw.rectangle([(x, y), (x + thumb_w, y + thumb_h)], fill=(20, 24, 33), outline=(51, 65, 85))
        draw.text((x + 20, y + thumb_h // 2), f"Missing: {img_name}", fill=(239, 68, 68), font=font_label)

# Footer
foot_y = board_h - 40
draw.text((margin, foot_y), "Phase 2D Audit Deliverable: Established rendering state for future MSAA, shadow frustum, anisotropic, and color-space comparisons", fill=(100, 116, 139), font=font_foot)

board_out_public = os.path.join(OUTPUT_DIR, "phase2d_baseline_board.png")
board_out_artifact = os.path.join(ARTIFACT_DIR, "phase2d_baseline_board.png")

board.save(board_out_public, quality=95)
if os.path.exists(ARTIFACT_DIR):
    board.save(board_out_artifact, quality=95)

print(f"✓ Generated Phase 2D Baseline Audit Board -> {board_out_public}")
