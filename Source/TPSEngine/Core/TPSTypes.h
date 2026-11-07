#pragma once

#include "CoreMinimal.h"
#include "TPSTypes.generated.h"

class USoundBase;
class UAnimSequenceBase;

UENUM(BlueprintType)
enum class ETPSGameModeType : uint8
{
	AimTrainer UMETA(DisplayName = "Aim Trainer"),
	VersusAI UMETA(DisplayName = "VS AI")
};

UENUM(BlueprintType)
enum class ETPSMatchPhase : uint8
{
	MainMenu,
	Playing,
	Paused,
	GameOver
};

UENUM(BlueprintType)
enum class ETPSFireMode : uint8
{
	Semi,
	Auto,
	Pump,
	Bolt,
	Rocket
};

UENUM(BlueprintType)
enum class ETPSReloadStyle : uint8
{
	Magazine,
	ShellByShell
};

UENUM(BlueprintType)
enum class ETPSWeaponPreset : uint8
{
	Pistol,
	M4,
	Shotgun,
	Kar98k,
	RPG7,
	AK74M,
	BenelliM4,
	Custom
};

/** Pose family the AnimBP can switch on (idle/aim poses per weapon type). */
UENUM(BlueprintType)
enum class ETPSWeaponPoseType : uint8
{
	Pistol,
	Rifle,
	Shotgun,
	Sniper,
	Launcher
};

UENUM(BlueprintType)
enum class ETPSHitZone : uint8
{
	Head,
	Torso,
	Limb
};

UENUM(BlueprintType)
enum class ETPSTraversalType : uint8
{
	None,
	MantleLow,
	MantleMid,
	MantleHigh,
	DodgeRoll,
	DiveRoll,
	Ladder
};

UENUM(BlueprintType)
enum class ETPSLadderPhase : uint8
{
	None,
	StartUp,
	Climbing,
	EndUp,
	StartDown,
	EndDown
};

UENUM(BlueprintType)
enum class ETPSAIState : uint8
{
	Idle,
	Patrol,
	Hesitate,
	Plan,
	Move,
	Cover,
	Peek,
	Reload,
	Search,
	Dead
};

UENUM(BlueprintType)
enum class ETPSPickupType : uint8
{
	Health,
	Ammo
};

/** Recoil numbers ported 1:1 from the web build (weapons.js). Angles in degrees, distances in cm. */
USTRUCT(BlueprintType)
struct FTPSRecoilProfile
{
	GENERATED_BODY()

	/** Weapon muzzle flip (deg) applied to the weapon mesh. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Recoil") float Flip = 2.f;
	/** Weapon kick back (cm). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Recoil") float Back = 2.f;
	/** Weapon kick up (cm). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Recoil") float Up = 0.5f;
	/** Random horizontal camera kick range (deg). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Recoil") float Yaw = 1.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Recoil") float RollBase = -0.3f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Recoil") float RollRange = 0.6f;
	/** Camera pitch kick (deg). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Recoil") float CameraKick = 0.4f;
	/** How much the upper body reacts (AnimBP RecoilAlpha scale). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Recoil") float BodyK = 0.35f;
	/** Shake scale. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Recoil") float ShakeK = 0.4f;
};

USTRUCT(BlueprintType)
struct FTPSWeaponStats
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon") FText DisplayName = FText::FromString(TEXT("Weapon"));
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon") ETPSWeaponPoseType PoseType = ETPSWeaponPoseType::Rifle;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon") ETPSFireMode FireMode = ETPSFireMode::Auto;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon") ETPSReloadStyle ReloadStyle = ETPSReloadStyle::Magazine;

	/** Damage per pellet before hit-zone multipliers. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Damage") float Damage = 30.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Damage", meta = (ClampMin = "1")) int32 Pellets = 1;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Damage") float Range = 9000.f;
	/** > 0 makes impacts explode (RPG). Damage falls off linearly to 0 at this radius. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Damage") float BlastRadius = 0.f;

	/** Seconds between shots (also the semi-auto click limit). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Firing") float FireInterval = 0.1f;
	/** Per-axis random direction offset (radians) when hip firing and still. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Firing") float Spread = 0.003f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Firing") float BloomPerShot = 0.35f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Firing") float BloomDecay = 2.5f;
	/** Pump / bolt: delay after the shot before cycling starts, and cycle duration. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Firing") float CycleDelay = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Firing") float CycleTime = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ammo", meta = (ClampMin = "1")) int32 MagazineSize = 30;
	/** Tactical (non-empty) reloads leave one round chambered: capacity + 1. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ammo") bool bChamberRound = false;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ammo") bool bInfiniteReserve = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ammo") int32 MaxReserveAmmo = 180;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ammo") float ReloadTime = 2.3f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ammo") float ReloadEmptyTime = 2.9f;
	/** ShellByShell reloads: seconds per inserted shell. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ammo") float ShellInsertTime = 0.5f;

	/** 1 = plain aim, 2 = first RMB aims, second RMB opens the scope. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Aim", meta = (ClampMin = "1", ClampMax = "2")) int32 AimStages = 1;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Aim") float AimFOV = 62.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Aim") float ScopeFOV = 12.4f;

	/** Camera trauma added per shot. 0 = derived from recoil: min(0.3, 0.03 + 0.04 * CameraKick). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Feel") float ShotTrauma = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Feel") FTPSRecoilProfile Recoil;
};

USTRUCT(BlueprintType)
struct FTPSWeaponAudio
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio") TObjectPtr<USoundBase> Fire = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio") TObjectPtr<USoundBase> FireTail = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio") TObjectPtr<USoundBase> MagOut = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio") TObjectPtr<USoundBase> MagIn = nullptr;
	/** Bolt / slide / pump. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio") TObjectPtr<USoundBase> Cycle = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio") TObjectPtr<USoundBase> DryFire = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio") float FirePitch = 1.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio") float FireVolume = 1.f;
};

/** Character animations for a weapon. Plain sequences are fine: they are played as dynamic montages on "DefaultSlot". */
USTRUCT(BlueprintType)
struct FTPSWeaponAnims
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation") TObjectPtr<UAnimSequenceBase> Reload = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation") TObjectPtr<UAnimSequenceBase> ReloadEmpty = nullptr;
	/** Played per shell for ShellByShell reloads. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation") TObjectPtr<UAnimSequenceBase> ReloadInsert = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation") TObjectPtr<UAnimSequenceBase> Cycle = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation") TObjectPtr<UAnimSequenceBase> Fire = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation") TObjectPtr<UAnimSequenceBase> Equip = nullptr;
};

/** Full-body action clips. Leave empty and the system still works (procedural timing, no clip). */
USTRUCT(BlueprintType)
struct FTPSCharacterAnimSet
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Traversal") TObjectPtr<UAnimSequenceBase> MantleLow = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Traversal") TObjectPtr<UAnimSequenceBase> MantleMid = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Traversal") TObjectPtr<UAnimSequenceBase> MantleHigh = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Traversal") TObjectPtr<UAnimSequenceBase> DodgeRoll = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Traversal") TObjectPtr<UAnimSequenceBase> DiveRoll = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ladder") TObjectPtr<UAnimSequenceBase> LadderUpStart = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ladder") TObjectPtr<UAnimSequenceBase> LadderUpLoop = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ladder") TObjectPtr<UAnimSequenceBase> LadderUpEnd = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ladder") TObjectPtr<UAnimSequenceBase> LadderDownStart = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ladder") TObjectPtr<UAnimSequenceBase> LadderDownLoop = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ladder") TObjectPtr<UAnimSequenceBase> LadderDownEnd = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat") TObjectPtr<UAnimSequenceBase> HitReact = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat") TObjectPtr<UAnimSequenceBase> Death = nullptr;
};

USTRUCT(BlueprintType)
struct FTPSRoundStats
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Stats") float Time = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Stats") int32 Score = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Stats") int32 Shots = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Stats") int32 Hits = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Stats") int32 Headshots = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Stats") int32 Kills = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Stats") int32 Wave = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Stats") int32 Streak = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Stats") int32 BestStreak = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Stats") float Multiplier = 1.f;
	UPROPERTY(BlueprintReadOnly, Category = "Stats") float MaxMultiplier = 1.f;
	UPROPERTY(BlueprintReadOnly, Category = "Stats") int32 ComboBonus = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Stats") int32 WaveBonus = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Stats") float DamageTaken = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Stats") int32 Pickups = 0;

	float GetAccuracy() const { return Shots > 0 ? float(Hits) / float(Shots) : 0.f; }
};
