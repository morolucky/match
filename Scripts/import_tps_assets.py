"""
TPS Engine - one-click asset import (run inside the Unreal Editor).

    Tools > Execute Python Script...  ->  Scripts/import_tps_assets.py
    (or in the Output Log, Python mode:  py "Scripts/import_tps_assets.py")

Imports everything in SourceAssets/ to the paths the C++ code auto-loads:
    /Game/TPS/Characters/UE5_Manny_Simple   (skeletal mesh + skeleton + physics asset)
    /Game/TPS/Characters/UE4/Mannequin      (optional UE4 mannequin)
    /Game/TPS/Animations/<clip name>        (all FBX clips, on the Manny skeleton)
    /Game/TPS/Audio/<sound name>            (weapon sounds)
    /Game/TPS/Weapons/Source/...            (glTF weapon packs, for reference meshes)
and creates /Game/TPS/Animations/ABP_TPS_Starter (AnimBP parented to TPSAnimInstance).
Build its graph (Docs/SETUP.md) and rename it to ABP_TPS: the characters then switch from the
placeholder body to the real mannequin automatically.
"""

import os
import unreal

PROJECT_DIR = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
SOURCE = os.path.join(PROJECT_DIR, "SourceAssets")

CHAR_DEST = "/Game/TPS/Characters"
ANIM_DEST = "/Game/TPS/Animations"
AUDIO_DEST = "/Game/TPS/Audio"
WEAPON_DEST = "/Game/TPS/Weapons/Source"
MANNY = CHAR_DEST + "/UE5_Manny_Simple"

# Clips the code moves procedurally (capsule-driven), so their root translation must stay locked.
ROOT_LOCKED_FOLDERS = ("Climb", "Ladder")

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()


def log(msg):
    unreal.log("[TPS import] " + msg)


def files_in(folder, extensions):
    path = os.path.join(SOURCE, folder)
    if not os.path.isdir(path):
        return []
    return sorted(
        os.path.join(path, f) for f in os.listdir(path) if os.path.splitext(f)[1].lower() in extensions
    )


def make_task(filename, destination, options=None):
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", filename)
    task.set_editor_property("destination_path", destination)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("save", True)
    if options is not None:
        task.set_editor_property("options", options)
    return task


def run(tasks):
    if tasks:
        asset_tools.import_asset_tasks(tasks)
        for task in tasks:
            for path in task.get_editor_property("imported_object_paths"):
                log("imported " + path)


def skeletal_mesh_options():
    ui = unreal.FbxImportUI()
    ui.set_editor_property("import_mesh", True)
    ui.set_editor_property("import_as_skeletal", True)
    ui.set_editor_property("import_animations", False)
    ui.set_editor_property("import_materials", True)
    ui.set_editor_property("import_textures", False)
    ui.set_editor_property("create_physics_asset", True)
    ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_SKELETAL_MESH)
    return ui


def animation_options(skeleton):
    ui = unreal.FbxImportUI()
    ui.set_editor_property("import_mesh", False)
    ui.set_editor_property("import_as_skeletal", True)
    ui.set_editor_property("import_animations", True)
    ui.set_editor_property("import_materials", False)
    ui.set_editor_property("import_textures", False)
    ui.set_editor_property("skeleton", skeleton)
    ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_ANIMATION)
    anim_data = ui.get_editor_property("anim_sequence_import_data")
    anim_data.set_editor_property("animation_length", unreal.FBXAnimationLengthImportType.FBXALIT_EXPORTED_TIME)
    return ui


def main():
    if not os.path.isdir(SOURCE):
        unreal.log_error("[TPS import] SourceAssets folder not found at " + SOURCE)
        return

    # UE 5.5+ routes FBX through Interchange by default; the legacy importer honours FbxImportUI.
    unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX false")

    # 1. Characters.
    manny_fbx = os.path.join(SOURCE, "Characters", "UE5_Manny_Simple.FBX")
    tasks = []
    if os.path.isfile(manny_fbx):
        tasks.append(make_task(manny_fbx, CHAR_DEST, skeletal_mesh_options()))
    ue4_fbx = os.path.join(SOURCE, "Characters", "Mannequin.FBX")
    if os.path.isfile(ue4_fbx):
        tasks.append(make_task(ue4_fbx, CHAR_DEST + "/UE4", skeletal_mesh_options()))
    run(tasks)

    mesh = unreal.load_asset(MANNY)
    if mesh is None:
        unreal.log_error("[TPS import] " + MANNY + " was not created; animations need its skeleton.")
        return
    skeleton = mesh.get_editor_property("skeleton")

    # 2. Animations (all on the Manny skeleton).
    root_locked = []
    tasks = []
    for folder in ("Locomotion", "Climb", "Ladder", "Weapons"):
        for fbx in files_in(os.path.join("Animations", folder), (".fbx",)):
            tasks.append(make_task(fbx, ANIM_DEST, animation_options(skeleton)))
            if folder in ROOT_LOCKED_FOLDERS:
                root_locked.append(ANIM_DEST + "/" + os.path.splitext(os.path.basename(fbx))[0])
    run(tasks)

    for path in root_locked:
        seq = unreal.load_asset(path)
        if isinstance(seq, unreal.AnimSequence):
            seq.set_editor_property("enable_root_motion", False)
            seq.set_editor_property("force_root_lock", True)
            unreal.EditorAssetLibrary.save_loaded_asset(seq)
            log("root locked " + path)
        else:
            unreal.log_warning("[TPS import] missing clip " + path + " (wrong skeleton? retarget it to UE5_Manny_Simple)")

    # 3. Audio.
    run([make_task(wav, AUDIO_DEST) for wav in files_in("Audio", (".wav",))])

    # 4. Weapon packs (glTF via Interchange). Optional reference content.
    for glb in files_in("Weapons", (".glb", ".gltf")):
        try:
            run([make_task(glb, WEAPON_DEST + "/" + os.path.splitext(os.path.basename(glb))[0].replace("-", "_"))])
        except Exception as exc:  # noqa: BLE001 - keep importing the rest
            unreal.log_warning("[TPS import] skipped " + glb + ": " + str(exc))

    # 5. Starter AnimBP parented to TPSAnimInstance.
    starter = ANIM_DEST + "/ABP_TPS_Starter"
    if not unreal.EditorAssetLibrary.does_asset_exist(starter) and not unreal.EditorAssetLibrary.does_asset_exist(ANIM_DEST + "/ABP_TPS"):
        parent = unreal.load_class(None, "/Script/TPSEngine.TPSAnimInstance")
        factory = unreal.AnimBlueprintFactory()
        factory.set_editor_property("target_skeleton", skeleton)
        factory.set_editor_property("parent_class", parent)
        abp = asset_tools.create_asset("ABP_TPS_Starter", ANIM_DEST, unreal.AnimBlueprint, factory)
        if abp is not None:
            unreal.EditorAssetLibrary.save_loaded_asset(abp)
            log("created " + starter + " - build its AnimGraph (Docs/SETUP.md) then rename it to ABP_TPS")

    log("done")


main()
