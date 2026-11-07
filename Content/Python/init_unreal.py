"""
Runs automatically when the Unreal Editor opens this project (Python Editor Script Plugin).
On the first open, imports SourceAssets/ (mannequin, animations, weapons, sounds) by running
Scripts/import_tps_assets.py once the editor has finished loading. Later opens do nothing.
"""

import os
import runpy

import unreal

_MARKER_ASSET = "/Game/TPS/Characters/SK_Mannequin"
_handle = None
_ticks = 0


def _try_import(delta_seconds):
    global _handle, _ticks
    _ticks += 1
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    # Wait until the editor UI is up and the asset registry finished its initial scan.
    if _ticks < 30 or registry.is_loading_assets():
        return
    unreal.unregister_slate_post_tick_callback(_handle)
    _handle = None

    if unreal.EditorAssetLibrary.does_asset_exist(_MARKER_ASSET):
        return
    script = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()), "Scripts", "import_tps_assets.py")
    if not os.path.isfile(script):
        unreal.log_warning("[TPS] import script not found: " + script)
        return
    unreal.log("[TPS] First open: importing mannequin, animations, weapons and sounds (about a minute)...")
    with unreal.ScopedSlowTask(1, "TPS Engine: importing assets (first open only)") as task:
        task.make_dialog(False)
        task.enter_progress_frame(1)
        runpy.run_path(script, run_name="__main__")


_handle = unreal.register_slate_post_tick_callback(_try_import)
