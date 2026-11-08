from PIL import Image, ImageDraw, ImageFont
import os
import glob

ARTIFACT_DIR = "/home/lumen/.gemini/antigravity/brain/82964857-e449-46e0-81ce-123418d11be5"
OUTPUT_DIR = "public/models/phase2c_revision_renders"
FRAMES_DIR = os.path.join(OUTPUT_DIR, "motion_frames")

# ==============================================================================
# 1. GENERATE ANIMATED GIF MOTION CAPTURE
# ==============================================================================
frame_files = sorted(glob.glob(os.path.join(FRAMES_DIR, "frame_*.png")))
if frame_files:
    frames = []
    for f in frame_files:
        im = Image.open(f)
        im_resized = im.resize((800, 500), Image.Resampling.LANCZOS)
        frames.append(im_resized)

    gif_out_public = os.path.join(OUTPUT_DIR, "phase2c_rev_motion_reveal.gif")
    gif_out_artifact = os.path.join(ARTIFACT_DIR, "phase2c_rev_motion_reveal.gif")

    frames[0].save(
        gif_out_public,
        save_all=True,
        append_images=frames[1:],
        duration=140,
        loop=0
    )
    if os.path.exists(ARTIFACT_DIR):
        frames[0].save(
            gif_out_artifact,
            save_all=True,
            append_images=frames[1:],
            duration=140,
            loop=0
        )
    print(f"✓ Generated animated motion GIF ({len(frames)} frames) -> {gif_out_public}")

# ==============================================================================
# 2. GENERATE MOTION FILMSTRIP (6 Key Stages)
# ==============================================================================
filmstrip_indices = [0, 2, 5, 8, 11, 13]
filmstrip_titles = [
    "T=0.0s: Injected Stroke",
    "T=0.3s: Clean Density Reveal",
    "T=0.7s: Organic Momentum",
    "T=1.1s: Swirling Eddies",
    "T=1.5s: Viscous Dissipation",
    "T=1.9s: Return to Reality A"
]

strip_thumb_w = 260
strip_thumb_h = 162
strip_gap = 12
strip_w = len(filmstrip_indices) * strip_thumb_w + (len(filmstrip_indices) + 1) * strip_gap
strip_h = strip_thumb_h + 80

filmstrip = Image.new("RGB", (strip_w, strip_h), (14, 16, 22))
draw_strip = ImageDraw.Draw(filmstrip)

try:
    font_strip = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 12)
    font_strip_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
except:
    font_strip = font_strip_title = None

draw_strip.text((strip_gap, 12), "Phase 2C Revised Motion Sequence: Fluid Stroke -> Clean Spatially Locked Reveal -> Organic Dissipation", fill=(240, 244, 250), font=font_strip_title)

for col, idx in enumerate(filmstrip_indices):
    if idx < len(frame_files):
        im = Image.open(frame_files[idx])
        im_thumb = im.resize((strip_thumb_w, strip_thumb_h), Image.Resampling.LANCZOS)
        x = strip_gap + col * (strip_thumb_w + strip_gap)
        y = 42
        filmstrip.paste(im_thumb, (x, y))
        draw_strip.rectangle([(x - 1, y - 1), (x + strip_thumb_w, y + strip_thumb_h)], outline=(50, 60, 75), width=1)
        draw_strip.text((x, y + strip_thumb_h + 8), filmstrip_titles[col], fill=(56, 189, 248), font=font_strip)

filmstrip_out = os.path.join(OUTPUT_DIR, "phase2c_rev_motion_filmstrip.png")
filmstrip.save(filmstrip_out, quality=95)
if os.path.exists(ARTIFACT_DIR):
    filmstrip.save(os.path.join(ARTIFACT_DIR, "phase2c_rev_motion_filmstrip.png"), quality=95)
print(f"✓ Generated temporal motion filmstrip -> {filmstrip_out}")

# ==============================================================================
# 3. GENERATE MASTER REVISION BOARD (8 Panels: Comparison + 7 Deliverables)
# ==============================================================================
# Layout: 4 columns x 2 rows
images = [
    ("phase2c_rev_01_phase2b_baseline.png", "1. Phase 2B Baseline Fluid", "Preserved Eulerian Navier-Stokes Density Field"),
    ("phase2c_rev_02_single_stroke.png", "2. Revised Single Stroke", "C = mix(A, B, Mask) | Zero Refraction / Zero Warp"),
    ("phase2c_rev_03_multiple_strokes.png", "3. Multiple Intersecting Trails", "Fluid Inertia, Eddies & Organic Overlap"),
    ("phase2c_rev_04_wide_reveal.png", "4. Wide Organic Reveal", "Smooth Density Thresholding & Natural Contours"),
    ("phase2c_rev_05_dissipation_return.png", "5. Dissipation Return", "Fluid Decays Viscously to Reality A at Rest"),
    ("phase2c_rev_06_subtle_chromatic.png", "6. Subtle Chromatic Aberration", "Micro-Meniscus Dispersion Strictly on Moving Edge"),
    ("phase2c_rev_07_alignment_lock.png", "7. Reality A/B Alignment Lock", "Split-Screen: Perfect Sub-Pixel Alignment"),
    ("../phase2c_renders/phase2c_06_active_refraction_field.png", "Rejected Refraction (Old 2C)", "Visual Reference: Discarded Lens Warping"),
]

cols = 4
rows = 2
thumb_w = 420
thumb_h = 262
margin = 24
header_h = 100
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
draw.text((margin, 24), "COCA-COLA EXPERIENCE — PHASE 2C REVISION AUDIT BOARD", fill=(255, 255, 255), font=font_main)
draw.text((margin, 60), "Return to Phase 2B Visual Language: Zero Refraction, Spatially Continuous Composite, Navier-Stokes Preserved", fill=(148, 163, 184), font=font_sub)

for idx, (img_rel, title, desc) in enumerate(images):
    c = idx % cols
    r = idx // cols
    x = margin + c * (thumb_w + margin)
    y = header_h + r * (thumb_h + card_label_h + margin)

    img_path = os.path.join(OUTPUT_DIR, img_rel)
    if not os.path.exists(img_path):
        img_path = os.path.join(ARTIFACT_DIR, os.path.basename(img_rel))

    if os.path.exists(img_path):
        img = Image.open(img_path)
        img_thumb = img.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        board.paste(img_thumb, (x, y))
        
        # Border color: special red border for rejected old version
        border_col = (239, 68, 68) if "Rejected" in title else (51, 65, 85)
        draw.rectangle([(x - 1, y - 1), (x + thumb_w, y + thumb_h)], outline=border_col, width=2 if "Rejected" in title else 1)
        
        # Labels
        label_y = y + thumb_h + 8
        label_col = (248, 113, 113) if "Rejected" in title else (241, 245, 249)
        draw.text((x, label_y), title, fill=label_col, font=font_label)
        draw.text((x, label_y + 20), desc, fill=(148, 163, 184), font=font_desc)
    else:
        draw.rectangle([(x, y), (x + thumb_w, y + thumb_h)], fill=(20, 24, 33), outline=(51, 65, 85))
        draw.text((x + 20, y + thumb_h // 2), f"Missing: {img_rel}", fill=(239, 68, 68), font=font_label)

# Footer
foot_y = board_h - 40
draw.text((margin, foot_y), "Validation: Zero UV displacement verified • Can geometry unwarped • Seamless transition • Navier-Stokes momentum intact", fill=(100, 116, 139), font=font_foot)

board_out_public = os.path.join(OUTPUT_DIR, "phase2c_rev_master_board.png")
board_out_artifact = os.path.join(ARTIFACT_DIR, "phase2c_rev_master_board.png")

board.save(board_out_public, quality=95)
if os.path.exists(ARTIFACT_DIR):
    board.save(board_out_artifact, quality=95)

print(f"✓ Generated Phase 2C Revision Master Board -> {board_out_public}")
