# Porting map: web build → Unreal

Coordinates: the web build is Y-up and right-handed, with yaw 0 facing +Z. Unreal is Z-up with X forward and Y right.
`UTPSStatics::FromWeb(x, y, z) = FVector(z, −x, y)`; web yaw → `−yaw`. Units are centimetres in both.
three.js FOV is vertical: 50° vertical ≈ 80° horizontal (16:9), and the 7° scope ≈ 12.4° horizontal.

| Web module | Unreal |
|---|---|
| `main.js`, `state.js` (off → ready → play ⇄ paused → over) | `ATPSGameMode` (`MainMenu → Playing ⇄ Paused → GameOver`) |
| `game.js` (camera rig, aim trainer, round flow, hit scoring) | `ATPSPlayerCharacter` camera, `ATPSTrainingTarget`, `ATPSArenaBuilder`, `ATPSGameMode` |
| `locomotion.js` (procedural gait, run/aim speeds, lean, ladder) | `ATPSCharacter` movement/lean/turn-in-place, `UTPSTraversalComponent` ladder, `UTPSAnimInstance` |
| `anim/traverse.js` (mantle, dive, dodge roll) | `UTPSTraversalComponent` |
| `anim/xfade.js`, `secondary.js`, `curves.js`, `fingers.js`, `ik.js`, `rig.js`, `skeleton.js`, `fpspack.js` | Replaced by UE skeletal animation: AnimBP + montage slots, retargeting, Control Rig/IK nodes |
| `weapons.js`, `reload-timeline.js` | `ATPSWeapon` (presets, fire modes, reload timeline, kick), `UTPSCombatComponent` |
| `fx.js` | `UTPSFX` / `ATPSTransientFX` (+ Niagara overrides) |
| `audio.js` | `FTPSWeaponAudio` + `UTPSStatics::PlaySoundAt` (master volume) |
| `gameplay/juice.js` | `ATPSPlayerCameraManager` (trauma, FOV kick), `ATPSPlayerController::TriggerHitStop` |
| `gameplay/director.js` | `ATPSAIDirector` |
| `ai.js`, `ai/nav.js` | `ATPSAIController` (+ navmesh or steering fallback), `ATPSEnemyCharacter`, `ATPSCoverPoint` |
| `ui.js`, `index.html`, `style.css`, `mobile.html` | `ATPSHUD`, `UTPSHUDWidget`, `UTPSMenuWidget`, touch buttons |
| `motion-studio.js` | `UTPSAnimStudioWidget` (K) |
| `scene.js`, `math.js`, `vendor/*`, `serve.*`, `start-*` | Not needed (engine rendering, math, and asset loading) |

## Numbers carried over

**Movement:** walk 140, run 400 cm/s, aim ×0.86, crouch −34 cm (no speed change; disables run), gravity 981,
turn-in-place 60° → 6°, lean offset 22 cm. **Ladder:** 206 cm/s (×1.35 run), start rise 86.49, end rise 215.86, top 453.06 cm.
**Mantle:** 55–300 cm. **Look:** 0.0022 rad per mouse count = 0.126° at sensitivity 1.

**Weapons**

| Weapon | Mode | Damage | Interval | Mag | Spread | Reload (tac / empty) | Recoil flip/back/up/yaw/cam |
|---|---|---|---|---|---|---|---|
| Pistol | Semi | 34 | — | 15 (+1) | 0.002 | 2.3 / 2.9 | 7.5 / 1.7 / 0.9 / 1.6 / 0.6 |
| M4 | Auto 750 rpm | 26 | 0.08 | 30 (+1) | 0.003 | 3.55 / 3.75 | 2.2 / 2.6 / 0.4 / 1.0 / 0.35 |
| Shotgun 12G | Pump (0.46 s) | 24 × 8 | — | 8 | 0.045 | 2.6 | 9 / 4.8 / 1.8 / 2.2 / 1.6 |
| Kar98k | Bolt (0.3 + 1.05 s), scope | 120 | — | 5 | 0.0006 | 3.4 | 6.5 / 3.2 / 1.2 / 1.4 / 1.7 |
| RPG-7 | Rocket, blast 480 | 250 | — | 1 | 0.001 | 3.2 | 12 / 6 / 2.5 / 1.8 / 2.4 |
| AK-74M | Auto 650 rpm | 30 | 0.0923 | 30 (+1) | 0.0035 | 3.0 / 3.6 | 2.6 / 2.9 / 0.5 / 1.2 / 0.42 |
| Benelli M4 | Semi | 24 × 8 | 0.22 | 7 | 0.04 | shell by shell 0.5 s | 8 / 4.4 / 1.6 / 2 / 1.4 |

Spread multiplier = (1 + bloom·1.6 + move·0.9) · (1 − 0.45·ADS). Shot trauma = min(0.3, 0.03 + 0.04·cameraKick), or 0.55 for the RPG.
Reserve ammo is infinite (as in the web build). Set `bInfiniteReserve = false` for limited ammo.

**Damage:** enemies take head ×4, torso ×1, limbs ×0.65. AI shots deal 30/11/7 to the player.
Player HP is 100, with regen of 22/s after 3.5 s. Health pickups give +35.

**AI:** σ = max(0.015, 0.034 − 0.0028(w−1)), reaction = max(0.3, 0.75 − 0.06(w−1)), opening misses 3/2/1 (waves <3, <6, else).
Spread = σ·(1 + 1.8e^(−aimT/0.9))·(1 + v/320)·(1 + 0.15·burst)·crouch 1.35·head-only 1.35·(HP<40 → 1.6).
Half FOV is 70° on patrol and 93° when alert. Memory is 2.8 s. Plan takes 0.55–0.95 s. Overwatch lasts 0.25–0.55 s. Post-peek cover lasts 0.75–1.65 s + suppression.
Each peek fires 3–5 shots per burst and 1–3 bursts (1 if the player is below 40 HP). Shot spacing is 0.095–0.13 s, with 0.45–0.85 s between bursts.
Suppression decays 0.6/s, adds +0.8 for a near miss (250 cm) and +1.2 for a hit, allows a peek below 0.65, and aborts a peek above 1.8. Reload takes 2.3 s. Corpses are removed after 5.6 s.
Footsteps are audible through cover at speeds above 260 cm/s while not crouched, within 900 cm.

**Director:** wave *w* needs 3+2w kills, max alive min(2+w, 5), 2 shooters before wave 3 then 3. The first spawn comes after 1 s, then every 0.8–2.0 s.
Breaks last 3.5 s and restore HP. Up to 8 pickups can exist.

**Scoring:** kill 100, headshot kill 150. The combo window is 4 s, adding +0.5 multiplier per kill up to ×5; taking damage halves the window.
Wave clear gives 250·w, plus 500 if flawless. Trainer plates score 100 + distance/20; poppers score 100, or 150 for the head, and reset after 2.6 s. The trainer round lasts 60 s.

**Juice:** trauma decays 1.35/s, intensity = trauma². Shake amplitude is 1.26° yaw/pitch and 1.76° roll, at 22/18 Hz, ×0.12 when scoped.
Kill hit-stop uses time scale 0.08 for 0.075 s (head) or 0.05 s. Kill trauma is 0.32/0.2 and FOV kick is 1.0/0.6, decaying 5/s.
