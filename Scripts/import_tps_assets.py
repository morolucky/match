"""
TPS Engine - one-click asset import (run inside the Unreal Editor).

    Runs automatically the first time the project opens (Content/Python/init_unreal.py).
    To re-run manually: Tools > Execute Python Script...  ->  Scripts/import_tps_assets.py
    (or in the Output Log, Python mode:  py "Scripts/import_tps_assets.py")

Imports everything in SourceAssets/ to the paths the C++ code auto-loads:
    /Game/TPS/Characters/SK_Mannequin   UE4 mannequin (default body, the skeleton 20 of the 21 clips use)
    /Game/TPS/Characters/SK_Manny       UE5 Manny (alternate body; MF_Pistol_Idle_ADS is a UE5 clip)
    /Game/TPS/Animations/<clip>         every FBX clip, each on the skeleton it was authored for
    /Game/TPS/Audio/<sound>             weapon sounds
    /Game/TPS/Weapons/SM_M4, SM_AK74M, SM_BenelliM4   weapon meshes baked from the FPS packs
No AnimBP is needed: characters use the built-in TPSProceduralAnimInstance and play all clips automatically.
"""

import os
import unreal

PROJECT_DIR = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
SOURCE = os.path.join(PROJECT_DIR, "SourceAssets")

CHAR_DEST = "/Game/TPS/Characters"
ANIM_DEST = "/Game/TPS/Animations"
AUDIO_DEST = "/Game/TPS/Audio"
WEAPON_DEST = "/Game/TPS/Weapons"
UE4_BODY = CHAR_DEST + "/SK_Mannequin"
UE5_BODY = CHAR_DEST + "/SK_Manny"

# Set to True to also import the raw first-person glTF packs (arms + weapon rigs) for reference.
IMPORT_RAW_FPS_PACKS = False

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


def make_task(filename, destination, options=None, name=None):
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", filename)
    task.set_editor_property("destination_path", destination)
    if name:
        task.set_editor_property("destination_name", name)
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


def static_mesh_options():
    ui = unreal.FbxImportUI()
    ui.set_editor_property("import_mesh", True)
    ui.set_editor_property("import_as_skeletal", False)
    ui.set_editor_property("import_animations", False)
    ui.set_editor_property("import_materials", True)
    ui.set_editor_property("import_textures", True)
    ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_STATIC_MESH)
    static_data = ui.get_editor_property("static_mesh_import_data")
    static_data.set_editor_property("combine_meshes", True)
    static_data.set_editor_property("auto_generate_collision", False)
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


def skeleton_of(path):
    mesh = unreal.load_asset(path)
    return mesh.get_editor_property("skeleton") if mesh else None


def is_ue5_clip(fbx_path):
    # UE5 Manny has spine_04/spine_05; the UE4 mannequin stops at spine_03.
    with open(fbx_path, "rb") as handle:
        return b"spine_05" in handle.read()


def main():
    if not os.path.isdir(SOURCE):
        unreal.log_error("[TPS import] SourceAssets folder not found at " + SOURCE)
        return

    # UE 5.5+ routes FBX through Interchange by default; the legacy importer honours FbxImportUI.
    unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX false")

    # 1. Bodies.
    tasks = []
    ue4_fbx = os.path.join(SOURCE, "Characters", "Mannequin.FBX")
    if os.path.isfile(ue4_fbx):
        tasks.append(make_task(ue4_fbx, CHAR_DEST, skeletal_mesh_options(), "SK_Mannequin"))
    ue5_fbx = os.path.join(SOURCE, "Characters", "UE5_Manny_Simple.FBX")
    if os.path.isfile(ue5_fbx):
        tasks.append(make_task(ue5_fbx, CHAR_DEST, skeletal_mesh_options(), "SK_Manny"))
    run(tasks)

    ue4_skeleton = skeleton_of(UE4_BODY)
    ue5_skeleton = skeleton_of(UE5_BODY)
    if ue4_skeleton is None:
        unreal.log_error("[TPS import] " + UE4_BODY + " was not created; the UE4 clips need its skeleton.")
        return

    # 2. Animations, each on the skeleton it was authored for.
    tasks = []
    for folder in ("Locomotion", "Climb", "Ladder", "Weapons"):
        for fbx in files_in(os.path.join("Animations", folder), (".fbx",)):
            skeleton = ue5_skeleton if is_ue5_clip(fbx) else ue4_skeleton
            if skeleton is None:
                unreal.log_warning("[TPS import] skipped " + fbx + " (its skeleton is missing)")
                continue
            tasks.append(make_task(fbx, ANIM_DEST, animation_options(skeleton)))
    run(tasks)

    # 3. Audio.
    run([make_task(wav, AUDIO_DEST) for wav in files_in("Audio", (".wav",))])

    # 4. Third-person weapon meshes (Scripts/bake_fps_weapons.py output).
    run([make_task(fbx, WEAPON_DEST, static_mesh_options()) for fbx in files_in("Weapons", (".fbx",))])

    # 5. Optional: raw first-person packs (glTF via Interchange).
    if IMPORT_RAW_FPS_PACKS:
        for glb in files_in("Weapons", (".glb", ".gltf")):
            try:
                folder = WEAPON_DEST + "/Source/" + os.path.splitext(os.path.basename(glb))[0].replace("-", "_")
                run([make_task(glb, folder)])
            except Exception as exc:  # noqa: BLE001 - keep importing the rest
                unreal.log_warning("[TPS import] skipped " + glb + ": " + str(exc))

    unreal.EditorAssetLibrary.save_directory("/Game/TPS", only_if_is_dirty=True, recursive=True)
    log("done - press Play")


if __name__ == "__main__":
    main()
