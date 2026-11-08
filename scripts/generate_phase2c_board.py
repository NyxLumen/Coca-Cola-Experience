from PIL import Image, ImageDraw, ImageFont
import os
import glob

ARTIFACT_DIR = "/home/lumen/.gemini/antigravity/brain/82964857-e449-46e0-81ce-123418d11be5"
OUTPUT_DIR = "public/models/phase2c_renders"
FRAMES_DIR = os.path.join(OUTPUT_DIR, "motion_frames")

# ==============================================================================
# 1. GENERATE ANIMATED GIF MOTION CAPTURE
# ==============================================================================
frame_files = sorted(glob.glob(os.path.join(FRAMES_DIR, "frame_*.png")))
if frame_files:
    frames = []
    for f in frame_files:
        im = Image.open(f)
        # Resize for smooth GIF playback and efficient file size (~800x500)
        im_resized = im.resize((800, 500), Image.Resampling.LANCZOS)
        frames.append(im_resized)

    gif_out_public = os.path.join(OUTPUT_DIR, "phase2c_motion_fluid_reveal.gif")
    gif_out_artifact = os.path.join(ARTIFACT_DIR, "phase2c_motion_fluid_reveal.gif")

    frames[0].save(
        gif_out_public,
        save_all=True,
        append_images=frames[1:],
        duration=140, # ~7 fps capture playback
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
# 2. GENERATE MOTION FILMSTRIP (6 Key Temporal Stages)
# ==============================================================================
filmstrip_indices = [0, 2, 5, 8, 11, 13]
filmstrip_titles = [
    "T=0.0s: Injected Stroke",
    "T=0.3s: Peak Refraction",
    "T=0.7s: Organic Expansion",
    "T=1.1s: Momentum Swirl",
    "T=1.5s: Viscous Dissipation",
    "T=1.9s: Reality A Recovery"
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

draw_strip.text((strip_gap, 12), "Phase 2C Temporal Motion Sequence (Pointer Stroke -> Optical Refraction -> Fluid Dissipation Return)", fill=(240, 244, 250), font=font_strip_title)

for col, idx in enumerate(filmstrip_indices):
    if idx < len(frame_files):
        im = Image.open(frame_files[idx])
        im_thumb = im.resize((strip_thumb_w, strip_thumb_h), Image.Resampling.LANCZOS)
        x = strip_gap + col * (strip_thumb_w + strip_gap)
        y = 42
        filmstrip.paste(im_thumb, (x, y))
        draw_strip.rectangle([(x - 1, y - 1), (x + strip_thumb_w, y + strip_thumb_h)], outline=(50, 60, 75), width=1)
        draw_strip.text((x, y + strip_thumb_h + 8), filmstrip_titles[col], fill=(56, 189, 248), font=font_strip)

filmstrip_out = os.path.join(OUTPUT_DIR, "phase2c_motion_filmstrip.png")
filmstrip.save(filmstrip_out, quality=95)
if os.path.exists(ARTIFACT_DIR):
    filmstrip.save(os.path.join(ARTIFACT_DIR, "phase2c_motion_filmstrip.png"), quality=95)
print(f"✓ Generated temporal motion filmstrip -> {filmstrip_out}")

# ==============================================================================
# 3. GENERATE MASTER DELIVERABLES BOARD (3x3 Grid)
# ==============================================================================
images = [
    ("phase2c_01_reality_a_rest.png", "1. Reality A at Rest", "Crimson Atmosphere & Baseline PBR"),
    ("phase2c_02_reality_b_full_reveal.png", "2. Reality B Full Reveal", "Cool Brushed Silver Atmosphere"),
    ("phase2c_03_single_fluid_trail.png", "3. Single Fluid Trail", "Refractive Lens Revealing Reality B"),
    ("phase2c_04_multiple_intersecting_trails.png", "4. Multiple Intersecting Trails", "Momentum, Swirls & Organic Overlap"),
    ("phase2c_05_wide_organic_reveal.png", "5. Wide Organic Reveal", "Procedural Boundary Noise Perturbation"),
    ("phase2c_06_active_refraction_field.png", "6. Active Liquid Refraction", "Velocity-Driven Sampling UV Offset"),
    ("phase2c_07_chromatic_aberration_edge.png", "7. Chromatic Aberration Dispersion", "Localized Spectral Fringe on Boundary"),
    ("phase2c_08_post_interaction_dissipation.png", "8. Post-Interaction Dissipation", "Density Decay Naturally Returns to Reality A"),
    ("phase2c_09_final_composite_all_effects.png", "9. Final Fluid Composite", "Full Production Pipeline with Specular Sheen"),
]

thumb_w = 640
thumb_h = 400
gap_x = 24
gap_y = 56
cols = 3
rows = 3

board_w = cols * thumb_w + (cols + 1) * gap_x
board_h = rows * thumb_h + (rows + 1) * gap_y + 120

board = Image.new("RGB", (board_w, board_h), (14, 16, 21))
draw = ImageDraw.Draw(board)

# Header banner
draw.rectangle([(0, 0), (board_w, 90)], fill=(20, 24, 32))
draw.rectangle([(0, 88), (board_w, 90)], fill=(244, 0, 9))

try:
    font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
    font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    font_label = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
    font_note = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
except:
    font_title = font_sub = font_label = font_note = None

draw.text((gap_x, 20), "Coca-Cola Experience — Phase 2C: Fluid-Driven Compositor & Optical Refraction", fill=(255, 255, 255), font=font_title)
draw.text((gap_x, 56), "Verified Renders: Density Reveal, Velocity Refraction, Spectral Chromatic Aberration, and Natural Viscous Return", fill=(148, 163, 184), font=font_sub)

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

        draw.rectangle([(x - 1, y - 1), (x + thumb_w, y + thumb_h)], outline=(55, 65, 81), width=1)
        draw.text((x, y - 40), label, fill=(245, 248, 252), font=font_label)
        draw.text((x, y - 20), note, fill=(56, 189, 248), font=font_note)

out_board = os.path.join(OUTPUT_DIR, "phase2c_master_deliverables_board.png")
board.save(out_board, quality=95)
if os.path.exists(ARTIFACT_DIR):
    board.save(os.path.join(ARTIFACT_DIR, "phase2c_master_deliverables_board.png"), quality=95)

print(f"✓ Generated master deliverables board -> {out_board}")
