# TPS Engine — Unreal Engine 5 (C++)

A third-person shooter framework ported from the `tps-engine-v11` web build (three.js) to **Unreal Engine 5.4 C++**.
It includes the player controller, animation hooks, weapons, a tactical squad AI with a wave director, two game modes, and a full UI.
Everything is written in C++ with Blueprint extension points. No `.uasset` files are required to play.

> Open `TPSEngine.uproject`, build it, and press **Play**. In an empty level, the game mode builds the ported arena
> (floor, cover, ladder tower, trainer range, lights) and opens the main menu.

## Features

| System | What you get | Main classes |
|---|---|---|
| **Controller** | WASD walk 140 / run 400 cm/s, crouch (−34 cm camera), Q/E wall-aware lean, X shoulder swap, turn-in-place (60°/6°), aim slows to ×0.86 | `ATPSCharacter`, `ATPSPlayerCharacter`, `ATPSPlayerController` |
| **Traversal** | Space: mantle low/mid/high (55–300 cm) → dive-roll off cover → dodge roll (backward rolls rejected); F: ladder with start/loop/end, auto-climb, W/S, Shift ×1.35 | `UTPSTraversalComponent`, `ATPSLadder` |
| **Camera** | Shoulder camera (170 cm hip / 100 cm aim), FOV zoom per weapon, scope stage (12.4°), trauma shake (decays 1.35/s), FOV kick | `ATPSPlayerCameraManager` |
| **Weapons** | Pistol, M4, Shotgun 12G, Kar98k, RPG-7, AK-74M, Benelli M4 with the web build's numbers: damage, fire rate, pellets, spread/bloom, recoil, pump/bolt cycling, tactical +1, empty/tactical reloads, shell-by-shell, rocket blast 480 cm | `ATPSWeapon`, `UTPSCombatComponent` |
| **Damage** | Head ×4 / torso ×1 / limb ×0.65 on enemies; AI hits the player for 30/11/7; regen 22 HP/s after 3.5 s | `UTPSHealthComponent` |
| **AI** | Patrol → hesitate → plan → move to cover → cover ⇄ peek bursts → reload → search. Uses suppression, reaction time, wave-scaled accuracy, opening misses, shooter-slot limits, hearing (gunfire and footsteps through cover), and flank detection. Uses the navmesh when available and falls back to obstacle-avoiding steering | `ATPSAIController`, `ATPSEnemyCharacter`, `ATPSCoverPoint` |
| **Director** | Wave *w*: 3+2w kills, max alive min(2+w, 5), 2→3 simultaneous shooters, 3.5 s breaks, pickups (health +35 / ammo) | `ATPSAIDirector`, `ATPSPickup` |
| **Modes** | Aim Trainer (60 s, 5 swinging steel plates + 5 poppers, distance scoring) and VS AI (waves, combos ×0.5 up to ×5, flawless bonus) | `ATPSGameMode`, `ATPSTrainingTarget` |
| **Juice** | Kill hit-stop (0.08 time scale, 0.05/0.075 s), trauma, FOV kick, weapon kick, tracers, muzzle flash, impacts, bullet holes, shells, explosions (optional Niagara overrides) | `UTPSFX` |
| **UI** | HUD (time, score, accuracy, wave, kills left, ammo, reload bar, weapon slots, health, dynamic crosshair, scope, hit markers, damage arrows and vignette, wave banner, combo, medals, kill feed, score popups, toasts, prompts), main menu, pause, game-over stats, settings (saved), controls, Animation Studio, touch buttons on mobile | `ATPSHUD`, `UTPSHUDWidget`, `UTPSMenuWidget`, `UTPSAnimStudioWidget` |
| **Animation** | `UTPSAnimInstance` exposes speed, direction, aim pitch/yaw, lean, crouch, run, reload, recoil, ladder phase/rate, and traversal type. Clips play as dynamic montages on `DefaultSlot` (full body) and `UpperBody` | `UTPSAnimInstance` |

## Quick start

1. Install **Unreal Engine 5.4** (5.3 and 5.5 should also work) and **Visual Studio 2022** with the *Game development with C++* workload.
2. Right-click `TPSEngine.uproject` → **Generate Visual Studio project files**, then open `TPSEngine.sln` and build **Development Editor | Win64**
   (or double-click the `.uproject` and let the editor build the module).
3. Press **Play**. The startup map is the engine's empty `Entry` map, and the arena is built automatically.
4. Optional: import the real mannequin, animations, and sounds by running `Scripts/import_tps_assets.py` in the editor,
   then follow [Docs/SETUP.md](Docs/SETUP.md) to create the AnimBP (about 10 minutes).

## Controls

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move / look | WASD or arrows / mouse | Left / right stick |
| Run | Shift | L3 |
| Crouch (let go on ladder) | C | B |
| Lean | Q / E | LB / RB |
| Swap shoulder | X | R3 |
| Aim (sniper: second press scopes) | RMB | LT |
| Fire | LMB, or Space while aiming | RT |
| Mantle / dive / dodge roll | Space | A |
| Ladder / toggle auto-climb | F | D-pad up |
| Reload | R | X |
| Weapons | 1–7, mouse wheel | Y |
| Pause | Esc or P (Esc ends PIE in the editor, so use **P**) | Start |
| Animation Studio | K | — |

## Project layout

```
TPSEngine.uproject
Config/                     DefaultEngine/Game/Input.ini (game mode, Enhanced Input, "Weapon" trace channel, dynamic navmesh)
Source/TPSEngine/
  Core/        GameMode, PlayerController, CameraManager, Settings (SaveGame), Statics, shared types
  Characters/  TPSCharacter (shared base), PlayerCharacter, EnemyCharacter
  Components/  Health, Combat (inventory/aim/fire), Traversal (mantle/roll/ladder)
  Weapons/     TPSWeapon (presets, hitscan, reload timeline, recoil)
  AI/          AIController (tactical state machine), AIDirector (waves)
  World/       ArenaBuilder, Ladder, TrainingTarget, Pickup, CoverPoint / EnemySpawnPoint
  Animation/   TPSAnimInstance
  FX/          TPSFX (procedural tracers/impacts/explosions, Niagara hooks)
  UI/          TPSHUD + HUD / Menu / AnimStudio widgets (built in C++), UI style
SourceAssets/               Original FBX/GLB from the web build, plus sounds converted to WAV for UE import
Scripts/import_tps_assets.py  One-click editor import to /Game/TPS/...
Docs/SETUP.md               Editor setup, AnimBP recipe, customising, packaging
Docs/PORTING.md             Web module → UE class map and all ported numbers
```

## Customising (Blueprint-friendly)

- **Weapons:** create a Blueprint child of `TPSWeapon`, set `Preset = Custom`, then edit `Stats`, `Audio`, `Anims`, the mesh, and the `Muzzle` location.
  Add it to `Combat → Weapon Classes` on your character Blueprint.
- **Characters:** create Blueprint children of `TPSPlayerCharacter` / `TPSEnemyCharacter`. Set the skeletal mesh, the AnimBP class (parented to `TPSAnimInstance`),
  `Anim Set` clips, speeds, and camera values. Set the game mode `Default Pawn Class` and the director's `Enemy Class`.
- **Levels:** place `TPSArenaBuilder` and untick parts you do not want, or build your own level with
  `TPSCoverPoint`, `TPSEnemySpawnPoint`, `TPSLadder`, `TPSTrainingTarget`, and a `NavMeshBoundsVolume`.
- **UI:** create Blueprint children of the widget classes and assign them on a `TPSHUD` Blueprint.
  If a child has its own designer layout, the code layout is skipped.

## Status

The C++ was written against the UE 5.4 API and reviewed, but **it has not been compiled in this repository's CI**
because no Unreal toolchain is available there. Build it once locally. If anything fails, the error will point to a single line.
The source pack has no walk/run cycles (the web build generated locomotion procedurally). See [Docs/SETUP.md](Docs/SETUP.md) for the
recommended locomotion source.
