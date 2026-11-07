"""
Bake the first-person "arms + weapon" GLB packs into third-person weapon meshes.

    blender -b --python Scripts/bake_fps_weapons.py

For each pack: poses the rig at its idle/rest frame, drops the arm/glove/sleeve meshes, applies the
skinning, and re-frames the weapon so that UE gets +X = muzzle, +Z = up, origin = right wrist
(the same point as the mannequin's hand_r bone). The weapon is scaled to its real length.
Writes SourceAssets/Weapons/SM_<name>.fbx and SourceAssets/Weapons/weapons.json (muzzle and left-hand points, cm).
"""

import json
import os

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "SourceAssets", "Weapons")

PACKS = [
    {
        "name": "AK74M", "file": "fps_ak-74m_animations.glb", "length_cm": 94.3,
        "action": "AK_Idle", "hand_r": "Hand_R", "hand_l": "Hand_L",
        "keep_materials": ["ak74m"],
    },
    {
        "name": "BenelliM4", "file": "fps_benelli_m4_animations.glb", "length_cm": 101.0,
        "action": "M4_Idle", "hand_r": "hand_R", "hand_l": "hand_L",
        "keep_materials": ["TTI_Benelli_M4", "matchsaverz"],
    },
    {
        "name": "M4", "file": "m4_fps.glb", "length_cm": 84.0,
        "action": None, "hand_r": "RightHand", "hand_l": "LeftHand",
        # Spare magazine and loose rounds are held in the hand during reloads; only the rifle is kept.
        "keep_objects": ["Main_M4_D_0", "Mag1_M4_D_0", "Bolt_M4_D_0", "BoltCatch_M4_D_0", "Trigger_M4_D_0", "Safety_M4_D_0"],
    },
]


def find_bone(arm, prefix):
    for bone in arm.pose.bones:
        if bone.name.startswith(prefix):
            return arm.matrix_world @ bone.head
    raise RuntimeError("bone not found: " + prefix)


def bake(pack):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, pack["file"]))
    scene = bpy.context.scene

    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE" and any(b.name.startswith(pack["hand_r"]) for b in o.data.bones))
    if pack["action"]:
        action = next(a for a in bpy.data.actions if pack["action"] in a.name and a.name.endswith(arm.name))
        arm.animation_data.action = action
        scene.frame_set(int(action.frame_range[0]))
    else:
        scene.frame_set(scene.frame_start)
    bpy.context.view_layer.update()

    keep = []
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        if "keep_objects" in pack:
            if obj.name in pack["keep_objects"]:
                keep.append(obj)
        elif any(m and m.name in pack["keep_materials"] for m in obj.data.materials):
            keep.append(obj)
    if not keep:
        raise RuntimeError("no weapon meshes in " + pack["file"])

    depsgraph = bpy.context.evaluated_depsgraph_get()
    verts, faces, offset = [], [], 0
    baked_meshes = []
    for obj in keep:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
        mesh.transform(obj.matrix_world)
        baked_meshes.append((mesh, [m for m in obj.data.materials]))
        verts.extend(v.co.copy() for v in mesh.vertices)
    points = np.array([[v.x, v.y, v.z] for v in verts])

    hand_r = find_bone(arm, pack["hand_r"])
    hand_l = find_bone(arm, pack["hand_l"])

    # Barrel axis = principal component, pointing from the right hand toward the left (support) hand.
    centered = points - points.mean(axis=0)
    _, _, vt = np.linalg.svd(centered, full_matrices=False)
    forward = Vector(vt[0]).normalized()
    if forward.dot(hand_l - hand_r) < 0:
        forward = -forward
    up = Vector((0.0, 0.0, 1.0))
    up = (up - forward * up.dot(forward)).normalized()
    left = up.cross(forward).normalized()
    # Rows map world -> weapon frame (X forward, Y left, Z up in Blender = X forward, Y right, Z up in UE).
    basis = Matrix((forward, left, up))

    local = np.array([basis @ (Vector(p) - hand_r) for p in points])
    raw_length = local[:, 0].max() - local[:, 0].min()
    scale = (pack["length_cm"] / 100.0) / raw_length
    to_weapon = Matrix.Diagonal((scale, scale, scale, 1.0)) @ basis.to_4x4() @ Matrix.Translation(-hand_r)

    # Build the export object.
    out_mesh = bpy.data.meshes.new("SM_" + pack["name"])
    out_obj = bpy.data.objects.new("SM_" + pack["name"], out_mesh)
    scene.collection.objects.link(out_obj)
    for mesh, mats in baked_meshes:
        tmp = bpy.data.objects.new("tmp", mesh)
        scene.collection.objects.link(tmp)
        for mat in mats:
            if mat and mat.name not in [m.name for m in tmp.data.materials if m]:
                tmp.data.materials.append(mat)
    for obj in list(scene.collection.objects):
        if obj.type == "MESH" and obj.name.startswith("tmp"):
            obj.data.transform(to_weapon)
    bpy.ops.object.select_all(action="DESELECT")
    tmps = [o for o in scene.collection.objects if o.type == "MESH" and o.name.startswith("tmp")]
    for obj in tmps:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = tmps[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = "SM_" + pack["name"]
    bpy.data.objects.remove(out_obj)

    # Remove everything else so only the weapon is exported.
    for obj in list(bpy.data.objects):
        if obj != joined:
            bpy.data.objects.remove(obj, do_unlink=True)

    co = np.array([[v.co.x, v.co.y, v.co.z] for v in joined.data.vertices]) * 100.0  # cm
    max_x = co[:, 0].max()
    tip = co[co[:, 0] > max_x - 2.0]
    muzzle = [float(max_x), float(-tip[:, 1].mean()), float(tip[:, 2].mean())]  # UE: Y flips
    hl = to_weapon @ hand_l
    info = {
        "muzzle_cm": muzzle,
        "left_hand_cm": [hl.x * 100.0, -hl.y * 100.0, hl.z * 100.0],
        "bounds_min_cm": [float(co[:, 0].min()), float(-co[:, 1].max()), float(co[:, 2].min())],
        "bounds_max_cm": [float(max_x), float(-co[:, 1].min()), float(co[:, 2].max())],
        "length_cm": pack["length_cm"],
    }

    out_path = os.path.join(SRC, "SM_" + pack["name"] + ".fbx")
    bpy.ops.export_scene.fbx(filepath=out_path, use_selection=False, object_types={"MESH"},
                             apply_unit_scale=True, mesh_smooth_type="FACE", path_mode="COPY", embed_textures=True)
    print("[bake] wrote", out_path, info)
    return info


def main():
    results = {}
    for pack in PACKS:
        results[pack["name"]] = bake(pack)
    with open(os.path.join(SRC, "weapons.json"), "w") as handle:
        json.dump(results, handle, indent=2)
    print("[bake] done")


main()
