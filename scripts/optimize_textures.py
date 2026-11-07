#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "numpy",
#     "pillow",
# ]
# ///

"""
Coca-Cola Experience — Phase 1.3: Texture Optimization Pipeline
Script: scripts/optimize_textures.py

Generates 2048px (desktop) and 1024px (mobile) variants of all diffuse,
normal, and roughness/metallic-roughness textures in both PNG and WebP.
Ensures normal map re-normalization and proper color space preservation.
"""

import os
import time
import numpy as np
from PIL import Image

SOURCE_DIR = "Coca Cola Cans - Classic, Zero, Diet Coke Sodas"
OUTPUT_BASE = "public/textures"

SOURCES = {
    "classic_diffuse": os.path.join(SOURCE_DIR, "Coca_Cola_classic_can_DIFFUSE_4K.png"),
    "diet_diffuse": os.path.join(SOURCE_DIR, "Coca_Cola_Open_diet_can_DIFFUSE_4K.png"),
    "zero_diffuse": os.path.join(SOURCE_DIR, "Coca_Cola_Open_zero_can_DIFFUSE_4K.png"),
    "normal": os.path.join(SOURCE_DIR, "Coca_Cola_can_NORMAL_4K.png"),
    "roughness": os.path.join(SOURCE_DIR, "Coca_Cola_can_ROUGNESS_4K.png"),
}

def renormalize_normal_map(img_np):
    """
    Re-normalizes tangent-space normal vectors to unit sphere length
    after downsampling to prevent specular degradation and flattening.
    """
    # Convert [0, 255] to [-1.0, 1.0]
    r = (img_np[:, :, 0].astype(np.float32) - 128.0) / 127.5
    g = (img_np[:, :, 1].astype(np.float32) - 128.0) / 127.5
    b = (img_np[:, :, 2].astype(np.float32) - 128.0) / 127.5

    length = np.sqrt(r**2 + g**2 + b**2)
    length = np.where(length > 1e-6, length, 1.0)

    r_unit = r / length
    g_unit = g / length
    b_unit = b / length

    out = np.zeros_like(img_np)
    out[:, :, 0] = np.clip(np.round(r_unit * 127.5 + 128.0), 0, 255).astype(np.uint8)
    out[:, :, 1] = np.clip(np.round(g_unit * 127.5 + 128.0), 0, 255).astype(np.uint8)
    out[:, :, 2] = np.clip(np.round(b_unit * 127.5 + 128.0), 0, 255).astype(np.uint8)
    if img_np.shape[2] == 4:
        out[:, :, 3] = 255
    return out

def build_corrected_roughness(raw_r):
    """
    Calibrates and corrects defective source roughness data:
    1. Preserves circumferential brushed ridges in valid body region.
    2. Seamlessly extends neck taper across V < 0.185 (eliminating logo shadows and 0-voids).
    3. Replaces 48% zero-value void on exposed aluminum lid/chime with calibrated satin aluminum.
    4. Eliminates mirror-specular zero patches while retaining stamped tab/rim features.
    """
    H, W = raw_r.shape
    raw_float = raw_r.astype(np.float32)

    # Valid body region in UV space: cols ~368..2703, rows ~758..4055
    body_mask = np.zeros((H, W), dtype=bool)
    body_mask[758:4055, 368:2703] = True

    # Normalize micro-surface variation on body
    variation = (raw_float - 57.28) / 20.0
    variation = np.clip(variation, -1.0, 1.0)

    corrected = np.zeros((H, W), dtype=np.float32)

    # Body: Base roughness 0.282 (72 / 255) modulated by real brushed ridges
    body_base = 72.0
    corrected[body_mask] = np.clip(body_base + variation[body_mask] * 16.0, 48.0, 102.0)

    # Neck taper extension (rows 250..758)
    for r in range(250, 758):
        corrected[r, 368:2703] = 72.0

    # Exposed Aluminum (U > 2703): Base machined roughness 0.298 (76 / 255)
    raw_right = raw_float[:, 2703:]
    right_base = 76.0
    right_variation = (raw_right - 40.0) / 35.0
    corrected[:, 2703:] = np.where(raw_right > 5, np.clip(right_base + right_variation * 18.0, 52.0, 108.0), right_base)

    # Top lid islands (rows 0..250)
    corrected[:250, :] = 76.0

    # Fallback any unassigned pixels
    zero_mask = corrected < 10.0
    corrected[zero_mask] = 74.0

    return np.clip(np.round(corrected), 0, 255).astype(np.uint8)

def process_all():
    print("================================================================================")
    print(" Coca-Cola Experience — Phase 1.3: Texture Optimization Pipeline")
    print("================================================================================")
    t0 = time.time()

    tier_configs = [
        {"name": "4k", "size": 4096, "webp_q": 95, "desc": "Source Master Tier (4096px)"},
        {"name": "2k", "size": 2048, "webp_q": 95, "desc": "Desktop Target (2048px)"},
        {"name": "1k", "size": 1024, "webp_q": 90, "desc": "Mobile Target (1024px)"},
    ]

    # Pre-load source images
    print("[1/4] Loading 4K source textures...")
    loaded = {}
    for key, path in SOURCES.items():
        assert os.path.exists(path), f"Missing: {path}"
        im = Image.open(path)
        loaded[key] = im
        print(f"      Loaded {key}: {im.size}, mode={im.mode}, file_size={os.path.getsize(path)/(1024*1024):.2f} MB")

    # Generate corrected roughness data
    print("[2/4] Engineering calibrated glTF metallicRoughness texture...")
    raw_roughness = np.array(loaded["roughness"])[:, :, 0]
    corrected_roughness = build_corrected_roughness(raw_roughness)

    # Pack into standard glTF 2.0 PBR texture: R=255 (AO), G=Roughness, B=255 (Metalness), A=255
    mr_4k = np.zeros((4096, 4096, 4), dtype=np.uint8)
    mr_4k[:, :, 0] = 255
    mr_4k[:, :, 1] = corrected_roughness # G = calibrated roughness
    mr_4k[:, :, 2] = 255                 # B = metalness base
    mr_4k[:, :, 3] = 255
    im_mr_4k = Image.fromarray(mr_4k)

    # Save visual comparison images for audit
    comp_original = Image.fromarray(raw_roughness)
    comp_corrected = Image.fromarray(corrected_roughness)
    os.makedirs("public/models/phase1_3_renders", exist_ok=True)
    comp_original.resize((1024, 1024)).save("public/models/phase1_3_renders/roughness_data_original.png")
    comp_corrected.resize((1024, 1024)).save("public/models/phase1_3_renders/roughness_data_corrected.png")

    results_table = []

    print("[3/4] Generating optimized 4K, 2K, and 1K texture tiers...")
    for tier in tier_configs:
        dim = tier["size"]
        tier_dir = os.path.join(OUTPUT_BASE, tier["name"])
        os.makedirs(tier_dir, exist_ok=True)
        print(f"\n--- Generating {tier['desc']} in {tier_dir}/ ---")

        # 1. Diffuse maps (Lanczos filter, sRGB)
        for prod in ["classic", "diet", "zero"]:
            src_key = f"{prod}_diffuse"
            im_resized = loaded[src_key].resize((dim, dim), Image.Resampling.LANCZOS)

            png_path = os.path.join(tier_dir, f"coke_{prod}_diffuse_{tier['name']}.png")
            webp_path = os.path.join(tier_dir, f"coke_{prod}_diffuse_{tier['name']}.webp")

            im_resized.save(png_path, format="PNG", optimize=True)
            im_resized.save(webp_path, format="WEBP", quality=tier["webp_q"])

            # Also create alias for 'original' if 'classic' to prevent 404s
            if prod == "classic":
                im_resized.save(os.path.join(tier_dir, f"coke_original_diffuse_{tier['name']}.png"), format="PNG", optimize=True)
                im_resized.save(os.path.join(tier_dir, f"coke_original_diffuse_{tier['name']}.webp"), format="WEBP", quality=tier["webp_q"])

            results_table.append({
                "tier": tier["name"],
                "type": f"{prod} diffuse",
                "dim": f"{dim}×{dim}",
                "png_size": os.path.getsize(png_path),
                "webp_size": os.path.getsize(webp_path),
                "vram_mb": (dim * dim * 4) / (1024 * 1024)
            })
            print(f"      Generated {prod} diffuse: PNG={os.path.getsize(png_path)/(1024*1024):.2f}MB, WebP={os.path.getsize(webp_path)/(1024*1024):.2f}MB")

        # 2. Normal map (Lanczos + re-normalization)
        norm_resized = loaded["normal"].resize((dim, dim), Image.Resampling.LANCZOS)
        norm_np = np.array(norm_resized)
        norm_renorm = renormalize_normal_map(norm_np)
        im_norm_clean = Image.fromarray(norm_renorm)

        png_norm = os.path.join(tier_dir, f"coke_normal_{tier['name']}.png")
        webp_norm = os.path.join(tier_dir, f"coke_normal_{tier['name']}.webp")
        im_norm_clean.save(png_norm, format="PNG", optimize=True)
        im_norm_clean.save(webp_norm, format="WEBP", quality=tier["webp_q"])

        results_table.append({
            "tier": tier["name"],
            "type": "normal (+Y)",
            "dim": f"{dim}×{dim}",
            "png_size": os.path.getsize(png_norm),
            "webp_size": os.path.getsize(webp_norm),
            "vram_mb": (dim * dim * 4) / (1024 * 1024)
        })
        print(f"      Generated normal: PNG={os.path.getsize(png_norm)/(1024*1024):.2f}MB, WebP={os.path.getsize(webp_norm)/(1024*1024):.2f}MB")

        # 3. Roughness & MetallicRoughness
        mr_resized = im_mr_4k.resize((dim, dim), Image.Resampling.BILINEAR)

        # Generate shared and product-specific variants for robust loading
        mr_variants = [
            f"coke_metallic_roughness_{tier['name']}",
            f"coke_classic_metallic_roughness_{tier['name']}",
            f"coke_original_metallic_roughness_{tier['name']}",
            f"coke_diet_metallic_roughness_{tier['name']}",
            f"coke_zero_metallic_roughness_{tier['name']}",
        ]

        for var_name in mr_variants:
            png_path = os.path.join(tier_dir, f"{var_name}.png")
            webp_path = os.path.join(tier_dir, f"{var_name}.webp")
            mr_resized.save(png_path, format="PNG", optimize=True)
            mr_resized.save(webp_path, format="WEBP", quality=tier["webp_q"])

        # Also provide coke_roughness_4k.png alias pointing to packed texture
        if tier["name"] == "4k":
            mr_resized.save(os.path.join(tier_dir, "coke_roughness_4k.png"), format="PNG", optimize=True)

        png_mr = os.path.join(tier_dir, f"coke_metallic_roughness_{tier['name']}.png")
        webp_mr = os.path.join(tier_dir, f"coke_metallic_roughness_{tier['name']}.webp")
        results_table.append({
            "tier": tier["name"],
            "type": "metallic-roughness",
            "dim": f"{dim}×{dim}",
            "png_size": os.path.getsize(png_mr),
            "webp_size": os.path.getsize(webp_mr),
            "vram_mb": (dim * dim * 4) / (1024 * 1024)
        })
        print(f"      Generated metallic-roughness (all products): PNG={os.path.getsize(png_mr)/(1024*1024):.2f}MB, WebP={os.path.getsize(webp_mr)/(1024*1024):.2f}MB")

    # 4. Also create a dedicated 2K/1K metallic mask texture for dual-material setups
    print("\n[4/4] Generating dedicated physical metallic mask textures...")
    # Label is U in [0.0, 0.66], V in [0.18, 0.99]
    # In glTF UV space: V = 0 is top, V = 1 is bottom
    # We can create a precise texture mask where body paint = 0.0, and metal rim/chime/lid = 1.0
    for tier in tier_configs:
        dim = tier["size"]
        mask_arr = np.zeros((dim, dim), dtype=np.uint8)
        # Using the exact UV partition:
        # Columns from 0 to int(0.66 * dim) are the body paint
        # Rows from int(0.01 * dim) to int(0.81 * dim) are the body
        # Everything else is bare aluminum (255)
        mask_arr.fill(255) # default bare aluminum
        # Paint body area
        mask_arr[int(0.01 * dim):int(0.815 * dim), int(0.088 * dim):int(0.662 * dim)] = 0
        im_mask = Image.fromarray(mask_arr, mode="L")
        mask_png = os.path.join(OUTPUT_BASE, tier["name"], f"coke_metallic_mask_{tier['name']}.png")
        mask_webp = os.path.join(OUTPUT_BASE, tier["name"], f"coke_metallic_mask_{tier['name']}.webp")
        im_mask.save(mask_png, format="PNG", optimize=True)
        im_mask.save(mask_webp, format="WEBP", quality=95)
        print(f"      Generated metallic mask ({tier['name']}): PNG={os.path.getsize(mask_png)/1024:.1f}KB, WebP={os.path.getsize(mask_webp)/1024:.1f}KB")

    # 5. Extract and visualize individual channels (Deliverables 1, 2, 3)
    generate_channel_audit_boards()

    elapsed = time.time() - t0
    print(f"\n✨ Texture optimization pipeline completed in {elapsed:.2f}s!")
    return results_table

def generate_channel_audit_boards():
    """
    Extracts and visualizes:
    - Red channel (AO / Unused)
    - Green channel (Roughness)
    - Blue channel (Metalness)
    - Green channel as standalone grayscale
    - Final packed texture
    Repeats across Classic, Diet, and Zero at 2K.
    """
    print("\n[5/5] Generating channel decomposition boards for Classic, Diet, and Zero (2K)...")
    out_dir = "public/models/phase1_3_renders"
    os.makedirs(out_dir, exist_ok=True)

    products = ["classic", "diet", "zero"]
    for prod in products:
        mr_path = f"public/textures/2k/coke_{prod}_metallic_roughness_2k.png"
        assert os.path.exists(mr_path), f"Missing: {mr_path}"
        im = Image.open(mr_path)
        arr = np.array(im)

        r = arr[:, :, 0]
        g = arr[:, :, 1]
        b = arr[:, :, 2]

        im_r = Image.fromarray(r)
        im_g = Image.fromarray(g)
        im_b = Image.fromarray(b)

        # Standalone green channel image
        g_out_path = os.path.join(out_dir, f"actual_roughness_channel_{prod}_2k.png")
        im_g.save(g_out_path)

        # Build 4-panel decomposition board: [Red (AO), Green (Roughness), Blue (Metalness), Packed (RGB)]
        panel_w = 512
        panel_h = 512
        board = Image.new("RGB", (panel_w * 4, panel_h))
        board.paste(im_r.resize((panel_w, panel_h)), (0, 0))
        board.paste(im_g.resize((panel_w, panel_h)), (panel_w, 0))
        board.paste(im_b.resize((panel_w, panel_h)), (panel_w * 2, 0))
        board.paste(im.resize((panel_w, panel_h)), (panel_w * 3, 0))

        board_path = os.path.join(out_dir, f"channel_decomposition_{prod}_2k.png")
        board.save(board_path)
        print(f"      Saved decomposition board for {prod}: {board_path}")

if __name__ == "__main__":
    process_all()
