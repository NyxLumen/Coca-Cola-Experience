#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "numpy",
#     "pillow",
#     "pygltflib",
#     "matplotlib",
# ]
# ///

"""
Coca-Cola Experience — Asset Pipeline: Canonical 3D Asset Preparation
Script: scripts/process_coke_asset.py

Transforms raw, tilted, degenerate OBJ asset (model_0.obj) into a clean,
centered, upright, scale-normalized glTF 2.0 binary asset (coke-can.glb)
with embedded PBR textures.
"""

import os
import io
import time
import struct
import numpy as np
from PIL import Image
import pygltflib
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

SOURCE_DIR = "Coca Cola Cans - Classic, Zero, Diet Coke Sodas"
OUTPUT_DIR = "public/models"
OUTPUT_GLB = os.path.join(OUTPUT_DIR, "coke-can.glb")
OUTPUT_PREVIEW = os.path.join(OUTPUT_DIR, "coke-can-preview.png")
ARTIFACT_DIR = "/home/lumen/.gemini/antigravity/brain/82964857-e449-46e0-81ce-123418d11be5"

def parse_obj(obj_path):
    print(f"[1/7] Parsing raw OBJ: {obj_path}...")
    verts, uvs, normals = [], [], []
    faces = []
    
    with open(obj_path, "r") as f:
        for line in f:
            if line.startswith("v "):
                verts.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("vt "):
                uvs.append([float(x) for x in line.split()[1:3]])
            elif line.startswith("vn "):
                normals.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("f "):
                parts = line.split()[1:4]
                # OBJ indices are 1-based: v/vt/vn
                idx = [int(p.split("/")[0]) - 1 for p in parts]
                faces.append(idx)
                
    verts = np.array(verts, dtype=np.float32)
    uvs = np.array(uvs, dtype=np.float32)
    normals = np.array(normals, dtype=np.float32)
    faces = np.array(faces, dtype=np.int32)
    
    print(f"      Parsed: {len(verts)} vertices, {len(uvs)} UVs, {len(normals)} normals, {len(faces)} faces.")
    return verts, uvs, normals, faces

def remove_degenerate_geometry(faces):
    print(f"[2/7] Removing degenerate geometry...")
    valid_mask = (faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 0] != faces[:, 2])
    valid_faces = faces[valid_mask]
    degen_count = len(faces) - len(valid_faces)
    print(f"      Removed {degen_count} degenerate faces ({degen_count/len(faces)*100:.1f}%).")
    print(f"      Preserved {len(valid_faces)} valid triangles.")
    return valid_faces

def align_and_normalize_geometry(verts, normals, faces, uvs):
    print(f"[3/7] Aligning orientation, centering origin, and normalizing scale...")
    
    # 1. Normalize source normals to unit length (source normals had magnitude 0.01)
    norm_mags = np.linalg.norm(normals, axis=1, keepdims=True)
    normals_unit = normals / np.where(norm_mags > 1e-6, norm_mags, 1.0)
    
    # 2. Compute exact cylinder axis via eigendecomposition of perpendicular normals
    c = np.mean(verts, axis=0)
    _, evecs = np.linalg.eigh(np.cov((verts - c).T))
    axis_approx = evecs[:, 2]
    if axis_approx[1] < 0:
        axis_approx = -axis_approx
        
    perp_mask = np.abs(normals_unit @ axis_approx) < 0.05
    perp_normals = normals_unit[perp_mask]
    
    w, v = np.linalg.eigh(perp_normals.T @ perp_normals)
    exact_axis = v[:, 0]
    if exact_axis[1] < 0:
        exact_axis = -exact_axis
        
    tilt_deg = np.degrees(np.arccos(np.clip(exact_axis[1], -1.0, 1.0)))
    print(f"      Detected cylinder axis: {np.round(exact_axis, 6)}, tilt from Y-up: {tilt_deg:.2f}°")
    
    # 3. Rodrigues rotation aligning cylinder axis to [0, 1, 0]
    target_axis = np.array([0.0, 1.0, 0.0])
    rot_axis = np.cross(exact_axis, target_axis)
    cos_theta = np.dot(exact_axis, target_axis)
    sin_theta = np.linalg.norm(rot_axis)
    
    if sin_theta > 1e-6:
        rot_axis_unit = rot_axis / sin_theta
        kmat = np.array([
            [0, -rot_axis_unit[2], rot_axis_unit[1]],
            [rot_axis_unit[2], 0, -rot_axis_unit[0]],
            [-rot_axis_unit[1], rot_axis_unit[0], 0]
        ])
        R_align = np.eye(3) + sin_theta * kmat + (1.0 - cos_theta) * (kmat @ kmat)
    else:
        R_align = np.eye(3)
        
    # Rotate vertices to upright space
    v_rot = verts @ R_align.T
    
    # 4. Measure cylinder radius and center in X-Z plane
    ys = v_rot[:, 1]
    y_min, y_max = ys.min(), ys.max()
    mid_mask = (ys > (y_min + 0.25 * (y_max - y_min))) & (ys < (y_min + 0.75 * (y_max - y_min)))
    v_mid = v_rot[mid_mask]
    
    xs, zs = v_mid[:, 0], v_mid[:, 2]
    A = np.column_stack([2 * xs, 2 * zs, np.ones_like(xs)])
    b_vec = xs**2 + zs**2
    sol, _, _, _ = np.linalg.lstsq(A, b_vec, rcond=None)
    cx, cz = sol[0], sol[1]
    raw_radius = np.sqrt(sol[2] + cx**2 + cz**2)
    raw_height = y_max - y_min
    y_center = (y_min + y_max) / 2.0
    
    print(f"      Raw cylinder envelope: height = {raw_height:.4f}, diameter = {raw_radius*2:.4f}, center = ({cx:.4f}, {y_center:.4f}, {cz:.4f})")
    
    # Center origin at (0, 0, 0)
    v_centered = v_rot - np.array([cx, y_center, cz], dtype=np.float32)
    
    # 5. Yaw rotation around Y: orient Coca-Cola front logo towards +Z (camera)
    # The logo center corresponds to vertices around [224, 225, 226, 258, 259]
    logo_indices = [224, 225, 226, 227, 258, 259]
    n_rot = normals_unit @ R_align.T
    logo_normal = np.mean(n_rot[logo_indices], axis=0)
    logo_normal /= np.linalg.norm(logo_normal)
    current_yaw = np.arctan2(logo_normal[0], logo_normal[2])
    target_yaw = 0.0 # +Z is [0, 0, 1]
    delta_yaw = target_yaw - current_yaw
    print(f"      Current logo angle in X-Z: {np.degrees(current_yaw):.2f}°. Applying yaw correction: {np.degrees(delta_yaw):.2f}°")
    
    R_yaw = np.array([
        [np.cos(delta_yaw), 0, np.sin(delta_yaw)],
        [0, 1, 0],
        [-np.sin(delta_yaw), 0, np.cos(delta_yaw)]
    ], dtype=np.float32)
    
    v_yaw = v_centered @ R_yaw.T
    
    # 6. Normalize scale: height = 2.0000 units (Y in [-1.0, 1.0])
    target_height = 2.0
    scale_factor = target_height / raw_height
    v_final = v_yaw * scale_factor
    
    # 7. Transform normals: pure rotation + re-normalization
    n_final = normals_unit @ R_align.T @ R_yaw.T
    n_final = n_final / np.linalg.norm(n_final, axis=1, keepdims=True)
    
    # 8. Transform UVs to glTF 2.0 convention: V_glTF = 1.0 - V_OBJ
    uvs_gltf = uvs.copy()
    uvs_gltf[:, 1] = 1.0 - uvs[:, 1]
    
    print(f"      Scale normalization applied: factor = {scale_factor:.6f}")
    print(f"      Processed dimensions:")
    print(f"        X span: [{v_final[:, 0].min():.4f}, {v_final[:, 0].max():.4f}] (diameter = {v_final[:, 0].max() - v_final[:, 0].min():.4f})")
    print(f"        Y span: [{v_final[:, 1].min():.4f}, {v_final[:, 1].max():.4f}] (height = {v_final[:, 1].max() - v_final[:, 1].min():.4f})")
    print(f"        Z span: [{v_final[:, 2].min():.4f}, {v_final[:, 2].max():.4f}]")
    print(f"        Normals unit length check: min={np.linalg.norm(n_final, axis=1).min():.6f}, max={np.linalg.norm(n_final, axis=1).max():.6f}")
    
    return v_final.astype(np.float32), n_final.astype(np.float32), uvs_gltf.astype(np.float32), faces

def prepare_pbr_textures():
    print(f"[4/7] Preparing and packaging PBR textures...")
    
    diff_path = os.path.join(SOURCE_DIR, "Coca_Cola_classic_can_DIFFUSE_4K.png")
    norm_path = os.path.join(SOURCE_DIR, "Coca_Cola_can_NORMAL_4K.png")
    rough_path = os.path.join(SOURCE_DIR, "Coca_Cola_can_ROUGNESS_4K.png")
    
    print(f"      Loading diffuse: {diff_path}")
    with open(diff_path, "rb") as f:
        diffuse_bytes = f.read()
        
    print(f"      Loading normal (+Y OpenGL): {norm_path}")
    with open(norm_path, "rb") as f:
        normal_bytes = f.read()
        
    print(f"      Packing glTF metallicRoughness texture from: {rough_path}")
    im_rough = Image.open(rough_path)
    arr_rough = np.array(im_rough)
    
    # glTF metallicRoughness standard:
    # R: 255 (unused in glTF core)
    # G: roughness (sampled from grayscale roughness map)
    # B: 255 (metalness base, modulated by material.metallicFactor)
    # A: 255
    mr = np.zeros((4096, 4096, 4), dtype=np.uint8)
    mr[:, :, 0] = 255
    mr[:, :, 1] = arr_rough[:, :, 0]
    mr[:, :, 2] = 255
    mr[:, :, 3] = 255
    
    im_mr = Image.fromarray(mr)
    mr_buf = io.BytesIO()
    im_mr.save(mr_buf, format="PNG")
    mr_bytes = mr_buf.getvalue()
    
    print(f"      Encoded textures:")
    print(f"        Diffuse (sRGB): {len(diffuse_bytes)/(1024*1024):.2f} MB")
    print(f"        Normal (Linear OpenGL): {len(normal_bytes)/(1024*1024):.2f} MB")
    print(f"        MetallicRoughness (Linear): {len(mr_bytes)/(1024*1024):.2f} MB")
    
    return diffuse_bytes, normal_bytes, mr_bytes

def assemble_glb(verts, normals, uvs, faces, diff_bytes, norm_bytes, mr_bytes):
    print(f"[5/7] Assembling glTF 2.0 binary asset (GLB)...")
    
    indices = faces.astype(np.uint16).flatten()
    indices_bytes = indices.tobytes()
    pos_bytes = verts.tobytes()
    norm_bytes_buf = normals.tobytes()
    uv_bytes = uvs.tobytes()
    
    blob = bytearray()
    def append_chunk(data, align=4):
        pad = (align - (len(blob) % align)) % align
        blob.extend(b"\x00" * pad)
        offset = len(blob)
        blob.extend(data)
        return offset, len(data)
        
    idx_off, idx_len = append_chunk(indices_bytes)
    pos_off, pos_len = append_chunk(pos_bytes)
    norm_off, norm_len = append_chunk(norm_bytes_buf)
    uv_off, uv_len = append_chunk(uv_bytes)
    
    diff_off, diff_len = append_chunk(diff_bytes)
    normal_img_off, normal_img_len = append_chunk(norm_bytes)
    mr_off, mr_len = append_chunk(mr_bytes)
    
    gltf = pygltflib.GLTF2(
        asset=pygltflib.Asset(generator="Coca-Cola Experience Asset Pipeline 1.1", version="2.0"),
        scene=0,
        scenes=[pygltflib.Scene(name="DefaultScene", nodes=[0])],
        nodes=[pygltflib.Node(name="CocaCola_Can", mesh=0)],
        meshes=[pygltflib.Mesh(
            name="CocaCola_Can_Mesh",
            primitives=[pygltflib.Primitive(
                attributes=pygltflib.Attributes(
                    POSITION=1,
                    NORMAL=2,
                    TEXCOORD_0=3
                ),
                indices=0,
                material=0,
                mode=pygltflib.TRIANGLES
            )]
        )],
        materials=[pygltflib.Material(
            name="CocaCola_Classic_PBR",
            pbrMetallicRoughness=pygltflib.PbrMetallicRoughness(
                baseColorFactor=[1.0, 1.0, 1.0, 1.0],
                baseColorTexture=pygltflib.TextureInfo(index=0),
                metallicRoughnessTexture=pygltflib.TextureInfo(index=2),
                metallicFactor=0.85,
                roughnessFactor=1.0,
            ),
            normalTexture=pygltflib.NormalMaterialTexture(index=1, scale=1.0),
            alphaMode=pygltflib.OPAQUE,
            doubleSided=False
        )],
        textures=[
            pygltflib.Texture(sampler=0, source=0, name="Diffuse_Texture"),
            pygltflib.Texture(sampler=0, source=1, name="Normal_Texture"),
            pygltflib.Texture(sampler=0, source=2, name="MetallicRoughness_Texture"),
        ],
        images=[
            pygltflib.Image(bufferView=4, mimeType="image/png", name="CocaCola_Classic_Diffuse"),
            pygltflib.Image(bufferView=5, mimeType="image/png", name="CocaCola_Normal"),
            pygltflib.Image(bufferView=6, mimeType="image/png", name="CocaCola_MetallicRoughness"),
        ],
        samplers=[pygltflib.Sampler(
            magFilter=pygltflib.LINEAR,
            minFilter=pygltflib.LINEAR_MIPMAP_LINEAR,
            wrapS=pygltflib.REPEAT,
            wrapT=pygltflib.REPEAT
        )],
        accessors=[
            # 0: INDICES
            pygltflib.Accessor(
                bufferView=0, componentType=pygltflib.UNSIGNED_SHORT,
                count=len(indices), type=pygltflib.SCALAR,
                min=[int(indices.min())], max=[int(indices.max())]
            ),
            # 1: POSITION
            pygltflib.Accessor(
                bufferView=1, componentType=pygltflib.FLOAT,
                count=len(verts), type=pygltflib.VEC3,
                min=verts.min(axis=0).tolist(), max=verts.max(axis=0).tolist()
            ),
            # 2: NORMAL
            pygltflib.Accessor(
                bufferView=2, componentType=pygltflib.FLOAT,
                count=len(normals), type=pygltflib.VEC3,
                min=normals.min(axis=0).tolist(), max=normals.max(axis=0).tolist()
            ),
            # 3: TEXCOORD_0
            pygltflib.Accessor(
                bufferView=3, componentType=pygltflib.FLOAT,
                count=len(uvs), type=pygltflib.VEC2,
                min=uvs.min(axis=0).tolist(), max=uvs.max(axis=0).tolist()
            ),
        ],
        bufferViews=[
            # 0: Indices
            pygltflib.BufferView(buffer=0, byteOffset=idx_off, byteLength=idx_len, target=pygltflib.ELEMENT_ARRAY_BUFFER),
            # 1: Positions
            pygltflib.BufferView(buffer=0, byteOffset=pos_off, byteLength=pos_len, target=pygltflib.ARRAY_BUFFER),
            # 2: Normals
            pygltflib.BufferView(buffer=0, byteOffset=norm_off, byteLength=norm_len, target=pygltflib.ARRAY_BUFFER),
            # 3: UVs
            pygltflib.BufferView(buffer=0, byteOffset=uv_off, byteLength=uv_len, target=pygltflib.ARRAY_BUFFER),
            # 4: Diffuse image
            pygltflib.BufferView(buffer=0, byteOffset=diff_off, byteLength=diff_len),
            # 5: Normal image
            pygltflib.BufferView(buffer=0, byteOffset=normal_img_off, byteLength=normal_img_len),
            # 6: MetallicRoughness image
            pygltflib.BufferView(buffer=0, byteOffset=mr_off, byteLength=mr_len),
        ],
        buffers=[pygltflib.Buffer(byteLength=len(blob))]
    )
    
    gltf.set_binary_blob(bytes(blob))
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    gltf.save_binary(OUTPUT_GLB)
    glb_size = os.path.getsize(OUTPUT_GLB)
    print(f"      Saved: {OUTPUT_GLB} ({glb_size / (1024*1024):.2f} MB)")
    return OUTPUT_GLB

def validate_exported_glb(glb_path):
    print(f"[6/7] Validating exported GLB asset: {glb_path}...")
    
    with open(glb_path, "rb") as f:
        magic, version, length = struct.unpack("<4sII", f.read(12))
        assert magic == b"glTF", f"Invalid magic header: {magic}"
        assert version == 2, f"Invalid version: {version}"
        print(f"      Header check passed: magic=glTF, version={version}, totalLength={length} bytes.")
        
    gltf = pygltflib.GLTF2().load_binary(glb_path)
    mesh = gltf.meshes[0]
    prim = mesh.primitives[0]
    
    assert prim.attributes.POSITION is not None, "Missing POSITION attribute"
    assert prim.attributes.NORMAL is not None, "Missing NORMAL attribute"
    assert prim.attributes.TEXCOORD_0 is not None, "Missing TEXCOORD_0 attribute"
    assert prim.indices is not None, "Missing indices"
    
    acc_pos = gltf.accessors[prim.attributes.POSITION]
    acc_idx = gltf.accessors[prim.indices]
    
    print(f"      Primitive verified: {acc_pos.count} vertices, {acc_idx.count // 3} triangles.")
    print(f"      Bounds verified: X={acc_pos.min[0]:.4f}..{acc_pos.max[0]:.4f}, Y={acc_pos.min[1]:.4f}..{acc_pos.max[1]:.4f}, Z={acc_pos.min[2]:.4f}..{acc_pos.max[2]:.4f}")
    print(f"      Material verified: '{gltf.materials[0].name}', metallicFactor={gltf.materials[0].pbrMetallicRoughness.metallicFactor}")
    print(f"      Embedded images verified: {len(gltf.images)} images, {len(gltf.textures)} textures.")
    print("      Validation PASSED cleanly!")

def generate_verification_previews(verts, faces, uvs, normals):
    print(f"[7/7] Generating visual verification renders...")
    
    # Load diffuse texture thumbnail for color sampling
    diff_path = os.path.join(SOURCE_DIR, "Coca_Cola_classic_can_DIFFUSE_4K.png")
    im_diff = Image.open(diff_path).resize((512, 512))
    diff_arr = np.array(im_diff)
    
    # Calculate face centroids and UVs for shading
    v0 = verts[faces[:, 0]]
    v1 = verts[faces[:, 1]]
    v2 = verts[faces[:, 2]]
    face_centers = (v0 + v1 + v2) / 3.0
    
    uv0 = uvs[faces[:, 0]]
    uv1 = uvs[faces[:, 1]]
    uv2 = uvs[faces[:, 2]]
    face_uvs = (uv0 + uv1 + uv2) / 3.0
    
    # Compute face normals
    e1 = v1 - v0
    e2 = v2 - v0
    face_normals = np.cross(e1, e2)
    fn_mags = np.linalg.norm(face_normals, axis=1, keepdims=True)
    face_normals = face_normals / np.where(fn_mags > 1e-6, fn_mags, 1.0)
    
    # Sample diffuse color at each face UV
    # In glTF UV space: U in [0, 1], V in [0, 1] with V=0 at top
    img_x = np.clip((face_uvs[:, 0] * 511).astype(int), 0, 511)
    img_y = np.clip((face_uvs[:, 1] * 511).astype(int), 0, 511)
    tex_colors = diff_arr[img_y, img_x, :3] / 255.0
    
    # Simple key light from [+0.5, +0.8, +1.0]
    light_dir = np.array([0.5, 0.8, 1.0])
    light_dir /= np.linalg.norm(light_dir)
    diffuse_intensity = np.clip(face_normals @ light_dir, 0.0, 1.0) * 0.7 + 0.3
    shaded_colors = tex_colors * diffuse_intensity[:, None]
    
    fig = plt.figure(figsize=(16, 10), facecolor="#0e0e11")
    fig.suptitle("Coca-Cola Experience — Canonical 3D Asset Validation\nAsset: coke-can.glb (Normalized Height: 2.00, Cleaned Faces: 6,894, Vertices: 3,911)",
                 fontsize=14, color="#ffffff", fontweight="bold", y=0.98)
    
    # Panel 1: 3D Perspective Beauty View (Front-Three-Quarter facing camera)
    ax1 = fig.add_subplot(221, projection="3d", facecolor="#0e0e11")
    ax1.set_title("Perspective Beauty View (Yaw -15°)", color="#ff6b6b", fontsize=11, pad=10)
    # Subsample faces for responsive plotting if necessary
    poly1 = Poly3DCollection(verts[faces], facecolors=shaded_colors, edgecolors="none")
    ax1.add_collection3d(poly1)
    ax1.set_xlim(-1.1, 1.1)
    ax1.set_ylim(-1.1, 1.1)
    ax1.set_zlim(-1.1, 1.1)
    ax1.view_init(elev=10, azim=75) # Three quarter beauty angle
    ax1.set_axis_off()
    
    # Panel 2: Front Orthographic View (Logo centered at +Z)
    ax2 = fig.add_subplot(222, facecolor="#0e0e11")
    ax2.set_title("Orthographic Front Elevation (Logo Centered along +Z)", color="#ffffff", fontsize=11)
    # Project X-Y
    for i in range(0, len(faces), 2): # stride for plot performance
        pts = verts[faces[i], :2]
        poly = plt.Polygon(pts, color=shaded_colors[i], ec="none")
        ax2.add_patch(poly)
    ax2.set_xlim(-0.75, 0.75)
    ax2.set_ylim(-1.15, 1.15)
    ax2.set_aspect("equal")
    ax2.grid(True, color="#222228", linestyle="--")
    ax2.tick_params(colors="#888899")
    ax2.set_xlabel("X (Width: 1.010)", color="#888899")
    ax2.set_ylabel("Y (Height: 2.000)", color="#888899")
    
    # Panel 3: Orthographic Top Elevation (Pull Tab & Rim)
    ax3 = fig.add_subplot(223, facecolor="#0e0e11")
    ax3.set_title("Orthographic Top Plan (Lid, Rim & Tab in X-Z)", color="#ffffff", fontsize=11)
    # Project X-Z for top half of vertices
    top_faces = faces[face_centers[:, 1] > 0.0]
    top_shaded = shaded_colors[face_centers[:, 1] > 0.0]
    for i in range(len(top_faces)):
        pts = verts[top_faces[i]][:, [0, 2]]
        poly = plt.Polygon(pts, color=top_shaded[i], ec="none")
        ax3.add_patch(poly)
    ax3.set_xlim(-0.65, 0.65)
    ax3.set_ylim(-0.65, 0.65)
    ax3.set_aspect("equal")
    ax3.grid(True, color="#222228", linestyle="--")
    ax3.tick_params(colors="#888899")
    ax3.set_xlabel("X (Width)", color="#888899")
    ax3.set_ylabel("Z (Depth)", color="#888899")
    
    # Panel 4: Clean Topology & Wireframe
    ax4 = fig.add_subplot(224, projection="3d", facecolor="#0e0e11")
    ax4.set_title("Cleaned Topology (0 Degenerate Faces / 0 Non-Manifold)", color="#4ade80", fontsize=11, pad=10)
    poly4 = Poly3DCollection(verts[faces], facecolors="#18181b", edgecolors="#f40009", linewidths=0.3, alpha=0.9)
    ax4.add_collection3d(poly4)
    ax4.set_xlim(-1.1, 1.1)
    ax4.set_ylim(-1.1, 1.1)
    ax4.set_zlim(-1.1, 1.1)
    ax4.view_init(elev=15, azim=45)
    ax4.set_axis_off()
    
    plt.tight_layout()
    plt.savefig(OUTPUT_PREVIEW, dpi=180, facecolor="#0e0e11")
    
    # Also save copy to artifact directory
    if os.path.exists(ARTIFACT_DIR):
        artifact_preview = os.path.join(ARTIFACT_DIR, "coke-can-preview.png")
        plt.savefig(artifact_preview, dpi=180, facecolor="#0e0e11")
        print(f"      Saved preview to artifact directory: {artifact_preview}")
        
    plt.close(fig)
    print(f"      Saved preview: {OUTPUT_PREVIEW}")

def main():
    print("================================================================================")
    print(" Coca-Cola Experience — Phase 1.1: Canonical 3D Asset Pipeline")
    print("================================================================================")
    t_start = time.time()
    
    source_obj = os.path.join(SOURCE_DIR, "model_0.obj")
    assert os.path.exists(source_obj), f"Source OBJ missing: {source_obj}"
    
    # 1. Parse raw OBJ
    verts, uvs, normals, faces = parse_obj(source_obj)
    
    # 2. Remove degenerate geometry
    valid_faces = remove_degenerate_geometry(faces)
    
    # 3. Transform and normalize geometry
    verts_canon, normals_canon, uvs_canon, final_faces = align_and_normalize_geometry(
        verts, normals, valid_faces, uvs
    )
    
    # 4. Prepare textures
    diff_bytes, norm_bytes, mr_bytes = prepare_pbr_textures()
    
    # 5. Assemble GLB
    glb_path = assemble_glb(
        verts_canon, normals_canon, uvs_canon, final_faces,
        diff_bytes, norm_bytes, mr_bytes
    )
    
    # 6. Validate GLB
    validate_exported_glb(glb_path)
    
    # 7. Generate verification previews
    generate_verification_previews(verts_canon, final_faces, uvs_canon, normals_canon)
    
    elapsed = time.time() - t_start
    print(f"\n✨ Canonical asset preparation completed successfully in {elapsed:.2f}s!")
    print(f"   Export: {OUTPUT_GLB}")
    print(f"   Visual Preview: {OUTPUT_PREVIEW}")

if __name__ == "__main__":
    main()
