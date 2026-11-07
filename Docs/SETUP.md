# Setup guide

## 1. Build and play

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

## 2. Import the original assets (one click), then press Play

`SourceAssets/` contains everything from the web build: the UE4 mannequin and UE5 Manny, all 21 animation clips,
the 7 sounds (converted to WAV, because Unreal does not import MP3), the 3 first-person GLB packs, and the
third-person weapon meshes baked from those packs.

1. Open the project. **On the first open, the import runs by itself** (`Content/Python/init_unreal.py`, about a minute, with a progress dialog).
   To run it again by hand, use **Tools → Execute Python Script…** and pick `Scripts/import_tps_assets.py` inside the project folder.
   Or type this in the Output Log (switch the input from *Cmd* to *Python*): `py "Scripts/import_tps_assets.py"`.
2. Wait for `[TPS import] done - press Play` in the **Output Log**.
3. Press **Play**. No AnimBP and no manual setup are needed. The player and the AI switch to the mannequin, and every clip below plays automatically.

| Asset | Path | Used for |
|---|---|---|
| UE4 mannequin | `/Game/TPS/Characters/SK_Mannequin` | Default body for the player and AI (20 of the 21 clips are authored for this skeleton) |
| UE5 Manny | `/Game/TPS/Characters/SK_Manny` | Alternate body (`Body = UE5 Manny` on a character); plays `MF_Pistol_Idle_ADS` |
| `A_AR_Aim_Fwd` | `/Game/TPS/Animations` | Rifle idle/aim stance (M4, AK-74M) |
| `A_AR_AimWalkPose_Fwd` | | Rifle upper body while moving |
| `MF_Pistol_Idle_ADS` | | Pistol stance on the UE5 body |
| `A_TP_CH_Handgun_Reload_Empty` | | Pistol reloads, plus pistol stance on the UE4 body (frame 0) |
| `A_TP_CH_SMG_02_Reload`, `A_TP_CH_SMG_02_Reload_Empty` | | M4 / AK-74M tactical and empty reloads |
| `A_TP_CH_Shotgun_01_Reload_Bolt` | | Shotgun reload and pump, Benelli shell insert, shotgun stance (frame 0) |
| `A_TP_CH_Sniper_01_Reload_Insert`, `A_TP_CH_Sniper_01_Reload_Bolt` | | Kar98k reload, Kar98k bolt cycle after each shot, sniper stance (frame 0) |
| `A_TP_CH_Sniper_02_Crouch_Aim_Pose` | | Kar98k crouched stance |
| `A_TP_CH_RL_01_Reload` | | RPG-7 reload and RPG-7 stance (frame 0) |
| `A_Climb_Low_01`, `A_Climb_Up_02`, `A_Climb_Up_03` | | Mantle low (≤135 cm), mid (≤220 cm), and high (≤300 cm) |
| `A_JumpRoll` | | Dodge roll and dive roll |
| `A_Ladder_Up_Start/Loop/End`, `A_Ladder_Dawn_Start/Loop/End` | | Ladder climbing up and down (loop speed follows climb speed) |
| `SM_M4`, `SM_AK74M`, `SM_BenelliM4` | `/Game/TPS/Weapons` | Weapon meshes for M4, AK-74M, and Benelli (the other weapons keep their procedural models) |
| 7 sounds | `/Game/TPS/Audio` | Shots, tails, magazine, bolt, and slide (same routing as the web build) |

### How the animation works (`UTPSProceduralAnimInstance`)

- **Stance:** each weapon type uses its own pose clip. Reload clips start from the weapon's ready pose, so their first frame is used as the stance.
- **Locomotion:** the pack has no walk/run cycles (the web build generated them in code), so the legs are animated procedurally.
  This covers walk/run/strafe/backpedal stride and cadence, knee bend, foot roll, pelvis bob and twist, a run lean, crouch (feet stay planted while the hips drop 34 cm), in-air tuck, and turn-in-place steps.
- **Upper body:** spine aim pitch and yaw, a closed-loop correction that lines the barrel up with the crosshair, lean (Q/E), recoil kick, a hit flinch, and weapon lowering on switch.
- **Hands:** long guns sit between the two wrists of the current pose; pistols point at the aim. During reloads, bolt cycles, and traversal, the weapon stays in the right hand.
- **Action clips:** reloads and bolt/pump cycles play on the upper body, timed to the gameplay reload duration.
  Mantle, roll, and ladder clips play full-body. Their root travel is re-targeted to the capsule's actual path, so a climb clip fits any ledge from 55 to 300 cm.
- **Death:** the body becomes a ragdoll (the import creates a physics asset). Bullets hit physics-asset bones, so head and limb zones are exact.

To use your own AnimBP instead, create `/Game/TPS/Animations/ABP_TPS` (parent class `TPSAnimInstance`). Characters pick it up automatically.
It receives the same variables (`Speed`, `Direction`, `AimPitch`, `AimYaw`, `LeanAngle`, `bIsCrouching`, `WeaponPose`, `LadderPhase`, and more). Action clips then play as montages on the `DefaultSlot` and `UpperBody` slots.

### Rebuilding the weapon meshes

`SourceAssets/Weapons/SM_*.fbx` are generated from the GLB packs. To regenerate them (for example, after changing a pack), run:

```
blender -b --python Scripts/bake_fps_weapons.py
```

This drops the first-person arms, applies the skin at the idle frame, scales each weapon to its real length,
and sets the origin at the right wrist, with +X toward the muzzle and +Z up. It also writes `weapons.json` with the muzzle and support-hand points that the C++ presets use.
The first-person arm animations in the packs (`AK_Reload`, `M4_Fire`, …) target FPS arms, not a third-person body, so they are not used.

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
