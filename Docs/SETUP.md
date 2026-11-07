# Setup guide

## 1. Build and play (no content needed)

1. Generate project files (right-click `TPSEngine.uproject`) and build **Development Editor**.
2. Open the project. The editor starts in the empty `/Engine/Maps/Entry` map.
3. Press **Play**. `ATPSGameMode` detects an empty level and spawns `ATPSArenaBuilder`, which creates
   the floor, boundary walls, sun, sky light, atmosphere, PlayerStart, ladder tower, 15 cover pieces with AI cover points,
   5 enemy spawn points, and the aim-trainer range. Characters and weapons use placeholder bodies built from engine shapes.
4. Save your own map (**File → Save Current Level As…**) and set it as the default in
   *Project Settings → Maps & Modes* if you like. The game mode is already the global default.

> In PIE, **Esc** stops play. Use **P** to pause.

### Navigation

Without a navmesh, the AI uses its built-in steering, so it still works. For proper pathfinding around cover:
drop a **NavMeshBoundsVolume** that covers the arena (about X −1400…5200, Y −2700…2700, Z −100…600) into your saved map.
`Config/DefaultEngine.ini` already sets `RuntimeGeneration=Dynamic`, so cover that toggles per mode is respected.

## 2. Import the original assets (one click)

`SourceAssets/` contains everything from the web build: `UE5_Manny_Simple.FBX`, the UE4 mannequin, 21 animation clips,
3 GLB weapon packs, and the 7 sounds (converted to WAV, because Unreal does not import MP3).

1. Enable **Python Editor Script Plugin** if it is not enabled (the `.uproject` already lists it).
2. **Tools → Execute Python Script…** → `Scripts/import_tps_assets.py`.

The script imports assets to the exact paths the C++ code loads automatically:

| Asset | Path | Used by |
|---|---|---|
| Manny mesh + skeleton + physics asset | `/Game/TPS/Characters/UE5_Manny_Simple` | All characters (once `ABP_TPS` exists) |
| Climb clips `A_Climb_Low_01`, `A_Climb_Up_02`, `A_Climb_Up_03` | `/Game/TPS/Animations` | Mantle low / mid / high |
| `A_JumpRoll` | `/Game/TPS/Animations` | Dodge roll and dive roll |
| `A_Ladder_Up_*`, `A_Ladder_Dawn_*` | `/Game/TPS/Animations` | Ladder start / loop / end, up and down |
| `A_TP_CH_*` reloads | `/Game/TPS/Animations` | Pistol, M4/AK (SMG clips), shotgun, Kar98k insert + bolt, RPG |
| `A_AR_Aim_Fwd`, `A_AR_AimWalkPose_Fwd`, `MF_Pistol_Idle_ADS`, `A_TP_CH_Sniper_02_Crouch_Aim_Pose` | `/Game/TPS/Animations` | Aim poses for your AnimBP |
| `pistol_shot`, `rifle_shot`, `rifle_tail`, `kar_shot`, `mag_in`, `slide_rack`, `bolt` | `/Game/TPS/Audio` | Weapon audio (same routing as the web build) |
| GLB weapon packs | `/Game/TPS/Weapons/Source/...` | Reference meshes for your weapon Blueprints |

Climb and ladder clips are set to **Force Root Lock** because the C++ moves the capsule along the ledge or ladder path.
If a clip reports a skeleton mismatch, retarget it to `UE5_Manny_Simple` (**right-click → Retarget Animations**).

## 3. Create the AnimBP (`ABP_TPS`)

The script creates `/Game/TPS/Animations/ABP_TPS_Starter` (parent class `TPSAnimInstance`, Manny skeleton).
Characters keep the placeholder body until an AnimBP named **`ABP_TPS`** exists, so they never T-pose.

The web build generated walk/run procedurally, so the source pack has **no locomotion cycles**. Add them from Epic's free content:
**Content Browser → Add → Add Feature or Content Pack → Third Person**. It provides `MM_Idle`, `MF_Unarmed_Walk_Fwd`,
`MM_Run_Fwd`, and related clips on the same UE5 mannequin skeleton. If the skeleton asset differs, open
`UE5_Manny_Simple_Skeleton` → **Compatible Skeletons**, add `SK_Mannequin`, or retarget.

AnimGraph recipe. Every variable below is already provided by `TPSAnimInstance`, so use **Get** nodes and do not add Event Graph logic:

1. **Anim Slot Manager** → add the slot `UpperBody` to `DefaultGroup` (`DefaultSlot` already exists).
2. **Locomotion:** Blend Space 1D (idle → walk 140 → run 400) driven by `Speed`. For strafing, use a 2D blend space with `Direction`.
   Add a Crouch state on `bIsCrouching` and an In Air state on `bIsInAir` if you have clips for them.
3. **Aim:** *Blend Poses by bool* on `bIsAiming` → blend in `A_AR_Aim_Fwd` (rifle) or `MF_Pistol_Idle_ADS`, selected by `WeaponPose`.
   Use *Layered blend per bone* from `spine_01` so the legs keep walking. Optionally add an Aim Offset with `AimPitch` and `AimYaw`.
4. **Lean:** *Transform (Modify) Bone* `spine_03`, Rotation = (Roll `LeanAngle`), Add to Existing, Component Space.
5. **Montage slots:** `Layered blend per bone` (base: locomotion; blend pose 0: **Slot `UpperBody`**; bone `spine_01`)
   → **Slot `DefaultSlot`** → Output Pose.
6. Compile, save, and rename the asset to **`ABP_TPS`**. Press Play: the player and AI now use Manny, and every clip in the table above plays automatically.

To use a different character, create a Blueprint child of `TPSPlayerCharacter` / `TPSEnemyCharacter`, set *Mesh* and *Anim Class*,
and untick `Auto Load Default Content` if you want full manual control.

### Weapon placement on the skeleton

Weapons attach to the `hand_r` socket (`WeaponSocket` on the character) using each weapon's `GripOffset`.
The quickest way is to add a socket named `hand_r_weapon` to the skeleton, preview a weapon mesh on it, and set `WeaponSocket` to that name.

## 4. Customising

- **Weapon stats:** `ATPSWeapon::MakePresetStats` holds the ported numbers. In a Blueprint child, set `Preset = Custom` to edit everything in the details panel.
- **Your own weapon mesh:** set `Mesh` (static) or `SkeletalMesh` on the Blueprint, and move the `Muzzle` and `ShellEject` components to the barrel and port.
  The placeholder visual is skipped automatically.
- **Niagara:** assign `MuzzleFlashFX`, `ImpactFX`, and `ExplosionFX` on a weapon to replace the procedural effects.
- **AI tuning:** sight range, FOV, memory, and suppression radius are on `ATPSAIController`. Wave pacing, pickups, and the enemy class are on `ATPSAIDirector`
  (set `DirectorClass` on a game mode Blueprint).
- **Input:** all bindings are created in `ATPSPlayerController::BuildInputAssets()`. Edit them there, or call `InjectAction` from UI or Blueprint.
- **Settings:** stored in the `TPSSettings` save slot (`UTPSSettingsSubsystem`).

## 5. Packaging

`Config/DefaultGame.ini` always cooks `/Game/TPS`. Set your saved map as *Game Default Map*, then
**Platforms → Windows → Package Project**. On Android/iOS, the HUD adds touch buttons, and movement and look use the engine's virtual joysticks
(`DefaultTouchInterface` in `Config/DefaultInput.ini`).
