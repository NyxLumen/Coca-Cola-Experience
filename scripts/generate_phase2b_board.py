from PIL import Image, ImageDraw, ImageFont
import os

ARTIFACT_DIR = "/home/lumen/.gemini/antigravity/brain/82964857-e449-46e0-81ce-123418d11be5"
OUTPUT_DIR = "public/models/phase2b_renders"

images = [
    ("phase2b_01_idle_simulation.png", "1. Idle Fluid Simulation", "Subtle Harmonic Vortices Without User Input"),
    ("phase2b_02_single_pointer_movement.png", "2. Single Pointer Movement", "Directional Velocity Injection with Inertia"),
    ("phase2b_03_multiple_pointer_movements.png", "3. Multiple Intersecting Strokes", "Complex Swirls, Momentum & Vortex Shedding"),
    ("phase2b_04_dissipation_after_interaction.png", "4. Post-Interaction Dissipation", "Smooth Viscous Decay & Fluid Persistence"),
    ("phase2b_05_velocity_vectors.png", "5. Velocity Vector Field", "RGB-Mapped Directional Flow Field"),
    ("phase2b_06_density_visualization.png", "6. Fluid Density Field", "High-Resolution Scalar Advection Grid"),
    ("phase2b_07_divergence_debug.png", "7. Divergence Field (Expansion/Comp)", "Central Difference Incompressibility Metric"),
    ("phase2b_08_pressure_debug.png", "8. Pressure Poisson Field", "20 GPU Jacobi Iterations Projection Field"),
    ("phase2b_09_fluid_reveal_preview.png", "9. Fluid Reveal Preview", "Dynamic GPU Fluid Driving Reality B Reveal"),
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
draw.rectangle([(0, 88), (board_w, 90)], fill=(2, 132, 199))

try:
    font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
    font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    font_label = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
    font_note = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
except:
    font_title = font_sub = font_label = font_note = None

draw.text((gap_x, 20), "Coca-Cola Experience — Phase 2B: GPU Fluid Simulation & Diagnostics", fill=(255, 255, 255), font=font_title)
draw.text((gap_x, 56), "Verified Eulerian Navier-Stokes GPU Passes: Advection, Splatting, Divergence, Jacobi Pressure & Projection", fill=(148, 163, 184), font=font_sub)

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
        draw.rectangle([(x - 1, y - 1), (x + thumb_w, y + thumb_h)], outline=(55, 65, 81), width=1)

        # Label above image
        draw.text((x, y - 40), label, fill=(245, 248, 252), font=font_label)
        draw.text((x, y - 20), note, fill=(56, 189, 248), font=font_note)

out_board = os.path.join(OUTPUT_DIR, "phase2b_master_deliverables_board.png")
board.save(out_board, quality=95)
if os.path.exists(ARTIFACT_DIR):
    board.save(os.path.join(ARTIFACT_DIR, "phase2b_master_deliverables_board.png"), quality=95)

print(f"Master deliverables board generated -> {out_board}")
