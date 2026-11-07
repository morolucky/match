#include "Weapons/TPSWeapon.h"
#include "TPSEngine.h"
#include "Core/TPSStatics.h"
#include "Core/TPSGameMode.h"
#include "Core/TPSSettings.h"
#include "Characters/TPSCharacter.h"
#include "Components/TPSCombatComponent.h"
#include "World/TPSTrainingTarget.h"
#include "FX/TPSFX.h"
#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Animation/AnimSequenceBase.h"
#include "Engine/World.h"
#include "Engine/OverlapResult.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/StaticMesh.h"
#include "GameFramework/DamageType.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundBase.h"
#include "CollisionQueryParams.h"

ATPSWeapon::ATPSWeapon()
{
	PrimaryActorTick.bCanEverTick = true;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	KickRoot = CreateDefaultSubobject<USceneComponent>(TEXT("KickRoot"));
	KickRoot->SetupAttachment(Root);

	Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	Mesh->SetupAttachment(KickRoot);
	Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Mesh->SetCanEverAffectNavigation(false);

	SkeletalMesh = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("SkeletalMesh"));
	SkeletalMesh->SetupAttachment(KickRoot);
	SkeletalMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	SkeletalMesh->SetCanEverAffectNavigation(false);

	Muzzle = CreateDefaultSubobject<USceneComponent>(TEXT("Muzzle"));
	Muzzle->SetupAttachment(KickRoot);
	Muzzle->SetRelativeLocation(FVector(60.f, 0.f, 3.f));

	ShellEject = CreateDefaultSubobject<USceneComponent>(TEXT("ShellEject"));
	ShellEject->SetupAttachment(KickRoot);
	ShellEject->SetRelativeLocation(FVector(8.f, 3.f, 4.f));

	MuzzleLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("MuzzleLight"));
	MuzzleLight->SetupAttachment(Muzzle);
	MuzzleLight->SetIntensityUnits(ELightUnits::Candelas);
	MuzzleLight->SetIntensity(250.f);
	MuzzleLight->SetAttenuationRadius(600.f);
	MuzzleLight->SetLightColor(FLinearColor(1.f, 0.72f, 0.38f));
	MuzzleLight->SetCastShadows(false);
	MuzzleLight->SetVisibility(false);
}

FTPSWeaponStats ATPSWeapon::MakePresetStats(ETPSWeaponPreset InPreset)
{
	FTPSWeaponStats S;
	auto SetRecoil = [&S](float Flip, float Back, float Up, float Yaw, float RollBase, float RollRange, float Cam, float BodyK, float ShakeK)
	{
		S.Recoil.Flip = Flip; S.Recoil.Back = Back; S.Recoil.Up = Up; S.Recoil.Yaw = Yaw;
		S.Recoil.RollBase = RollBase; S.Recoil.RollRange = RollRange; S.Recoil.CameraKick = Cam;
		S.Recoil.BodyK = BodyK; S.Recoil.ShakeK = ShakeK;
	};

	switch (InPreset)
	{
	case ETPSWeaponPreset::Pistol:
		S.DisplayName = FText::FromString(TEXT("Pistol"));
		S.PoseType = ETPSWeaponPoseType::Pistol;
		S.FireMode = ETPSFireMode::Semi;
		S.Damage = 34.f; S.FireInterval = 0.11f; S.Spread = 0.002f;
		S.MagazineSize = 15; S.bChamberRound = true; S.ReloadTime = 2.3f; S.ReloadEmptyTime = 2.9f;
		S.AimFOV = 68.f;
		SetRecoil(7.5f, 1.7f, 0.9f, 1.6f, -0.8f, -1.2f, 0.6f, 0.35f, 0.4f);
		break;
	case ETPSWeaponPreset::M4:
		S.DisplayName = FText::FromString(TEXT("M4"));
		S.FireMode = ETPSFireMode::Auto;
		S.Damage = 26.f; S.FireInterval = 0.08f; S.Spread = 0.003f;
		S.MagazineSize = 30; S.bChamberRound = true; S.ReloadTime = 3.55f; S.ReloadEmptyTime = 3.75f;
		SetRecoil(2.2f, 2.6f, 0.4f, 1.0f, -0.3f, 0.6f, 0.35f, 0.45f, 0.4f);
		break;
	case ETPSWeaponPreset::Shotgun:
		S.DisplayName = FText::FromString(TEXT("Shotgun 12G"));
		S.PoseType = ETPSWeaponPoseType::Shotgun;
		S.FireMode = ETPSFireMode::Pump;
		S.Damage = 24.f; S.Pellets = 8; S.FireInterval = 0.1f; S.Spread = 0.045f;
		S.CycleDelay = 0.12f; S.CycleTime = 0.46f;
		S.MagazineSize = 8; S.ReloadTime = 2.6f; S.ReloadEmptyTime = 2.6f;
		S.AimFOV = 66.f;
		SetRecoil(9.f, 4.8f, 1.8f, 2.2f, -1.f, 1.8f, 1.6f, 1.15f, 1.45f);
		break;
	case ETPSWeaponPreset::Kar98k:
		S.DisplayName = FText::FromString(TEXT("Kar98k"));
		S.PoseType = ETPSWeaponPoseType::Sniper;
		S.FireMode = ETPSFireMode::Bolt;
		S.Damage = 120.f; S.FireInterval = 0.1f; S.Spread = 0.0006f;
		S.CycleDelay = 0.3f; S.CycleTime = 1.05f;
		S.MagazineSize = 5; S.ReloadTime = 3.4f; S.ReloadEmptyTime = 3.4f;
		S.AimStages = 2; S.AimFOV = 60.f; S.ScopeFOV = 12.4f;
		SetRecoil(6.5f, 3.2f, 1.2f, 1.4f, -0.6f, 1.2f, 1.7f, 1.15f, 1.4f);
		break;
	case ETPSWeaponPreset::RPG7:
		S.DisplayName = FText::FromString(TEXT("RPG-7"));
		S.PoseType = ETPSWeaponPoseType::Launcher;
		S.FireMode = ETPSFireMode::Rocket;
		S.Damage = 250.f; S.BlastRadius = 480.f; S.FireInterval = 0.5f; S.Spread = 0.001f;
		S.MagazineSize = 1; S.ReloadTime = 3.2f; S.ReloadEmptyTime = 3.2f;
		S.AimFOV = 60.f; S.ShotTrauma = 0.55f;
		SetRecoil(12.f, 6.f, 2.5f, 1.8f, -1.2f, 2.f, 2.4f, 1.25f, 1.5f);
		break;
	case ETPSWeaponPreset::AK74M:
		S.DisplayName = FText::FromString(TEXT("AK-74M"));
		S.FireMode = ETPSFireMode::Auto;
		S.Damage = 30.f; S.FireInterval = 0.0923f; S.Spread = 0.0035f;
		S.MagazineSize = 30; S.bChamberRound = true; S.ReloadTime = 3.0f; S.ReloadEmptyTime = 3.6f;
		SetRecoil(2.6f, 2.9f, 0.5f, 1.2f, -0.4f, 0.7f, 0.42f, 0.5f, 0.4f);
		break;
	case ETPSWeaponPreset::BenelliM4:
		S.DisplayName = FText::FromString(TEXT("Benelli M4"));
		S.PoseType = ETPSWeaponPoseType::Shotgun;
		S.FireMode = ETPSFireMode::Semi;
		S.ReloadStyle = ETPSReloadStyle::ShellByShell;
		S.Damage = 24.f; S.Pellets = 8; S.FireInterval = 0.22f; S.Spread = 0.04f;
		S.MagazineSize = 7; S.ShellInsertTime = 0.5f; S.ReloadTime = 0.3f; S.ReloadEmptyTime = 0.6f;
		S.AimFOV = 66.f;
		SetRecoil(8.f, 4.4f, 1.6f, 2.f, -0.9f, 1.6f, 1.4f, 1.1f, 1.4f);
		break;
	default:
		break;
	}
	return S;
}

void ATPSWeapon::BeginPlay()
{
	if (bUsePresetStats && Preset != ETPSWeaponPreset::Custom)
	{
		Stats = MakePresetStats(Preset);
	}
	if (Preset != ETPSWeaponPreset::Custom)
	{
		bTwoHanded = Stats.PoseType != ETPSWeaponPoseType::Pistol;
	}
	AutoLoadContent();
	if (!Mesh->GetStaticMesh() && !SkeletalMesh->GetSkeletalMeshAsset())
	{
		BuildPlaceholderVisual();
	}

	Super::BeginPlay();

	AmmoInMag = Stats.MagazineSize;
	ReserveAmmo = Stats.MaxReserveAmmo;
}

void ATPSWeapon::AutoLoadContent()
{
	if (!bAutoLoadDefaultContent || Preset == ETPSWeaponPreset::Custom)
	{
		return;
	}
	auto Sound = [](TObjectPtr<USoundBase>& Slot, const TCHAR* Name)
	{
		if (!Slot && Name)
		{
			Slot = UTPSStatics::TryLoad<USoundBase>(FString::Printf(TEXT("/Game/TPS/Audio/%s.%s"), Name, Name));
		}
	};
	auto Anim = [](TObjectPtr<UAnimSequenceBase>& Slot, const TCHAR* Name)
	{
		if (!Slot && Name)
		{
			Slot = UTPSStatics::TryLoad<UAnimSequenceBase>(FString::Printf(TEXT("/Game/TPS/Animations/%s.%s"), Name, Name));
		}
	};

	// Weapon meshes baked from the FPS packs by Scripts/bake_fps_weapons.py: origin = right wrist, +X = muzzle.
	auto BakedMesh = [this](const TCHAR* Name, const FVector& MuzzlePoint, const FVector& LeftHand, const FVector& RightHand)
	{
		if (Mesh->GetStaticMesh() || SkeletalMesh->GetSkeletalMeshAsset())
		{
			return;
		}
		if (UStaticMesh* Baked = UTPSStatics::TryLoad<UStaticMesh>(FString::Printf(TEXT("/Game/TPS/Weapons/%s.%s"), Name, Name)))
		{
			Mesh->SetStaticMesh(Baked);
			Muzzle->SetRelativeLocation(MuzzlePoint);
			ShellEject->SetRelativeLocation(FVector(6.f, 3.f, 3.f));
			RightHandGrip = RightHand;
			LeftHandGrip = LeftHand;
		}
	};
	switch (Preset)
	{
	case ETPSWeaponPreset::M4: BakedMesh(TEXT("SM_M4"), FVector(68.68f, -2.80f, 6.92f), FVector(32.20f, -9.21f, 2.84f), FVector::ZeroVector); break;
	case ETPSWeaponPreset::AK74M: BakedMesh(TEXT("SM_AK74M"), FVector(75.64f, -6.04f, -3.60f), FVector(31.23f, -9.26f, -1.06f), FVector::ZeroVector); break;
	// The Benelli pack's hand bones sit on the receiver; grip points measured from the mesh instead.
	case ETPSWeaponPreset::BenelliM4: BakedMesh(TEXT("SM_BenelliM4"), FVector(51.22f, -0.16f, 1.07f), FVector(22.f, 0.f, -3.f), FVector(-20.f, 0.f, -6.f)); break;
	default: break;
	}

	// Same sample routing as the web build's audio.js.
	switch (Preset)
	{
	case ETPSWeaponPreset::Pistol:
		Sound(Audio.Fire, TEXT("pistol_shot")); Sound(Audio.Cycle, TEXT("slide_rack")); Sound(Audio.MagIn, TEXT("mag_in"));
		Anim(Anims.Reload, TEXT("A_TP_CH_Handgun_Reload_Empty")); Anim(Anims.ReloadEmpty, TEXT("A_TP_CH_Handgun_Reload_Empty"));
		break;
	case ETPSWeaponPreset::M4:
	case ETPSWeaponPreset::AK74M:
		Sound(Audio.Fire, TEXT("rifle_shot")); Sound(Audio.FireTail, TEXT("rifle_tail")); Sound(Audio.MagIn, TEXT("mag_in")); Sound(Audio.Cycle, TEXT("bolt"));
		Anim(Anims.Reload, TEXT("A_TP_CH_SMG_02_Reload")); Anim(Anims.ReloadEmpty, TEXT("A_TP_CH_SMG_02_Reload_Empty"));
		break;
	case ETPSWeaponPreset::Shotgun:
		Sound(Audio.Fire, TEXT("rifle_shot")); Sound(Audio.FireTail, TEXT("rifle_tail")); Sound(Audio.Cycle, TEXT("slide_rack")); Sound(Audio.MagIn, TEXT("mag_in"));
		Audio.FirePitch = 0.65f;
		Anim(Anims.Reload, TEXT("A_TP_CH_Shotgun_01_Reload_Bolt")); Anim(Anims.ReloadEmpty, TEXT("A_TP_CH_Shotgun_01_Reload_Bolt"));
		Anim(Anims.Cycle, TEXT("A_TP_CH_Shotgun_01_Reload_Bolt"));
		break;
	case ETPSWeaponPreset::BenelliM4:
		Sound(Audio.Fire, TEXT("rifle_shot")); Sound(Audio.FireTail, TEXT("rifle_tail")); Sound(Audio.Cycle, TEXT("slide_rack")); Sound(Audio.MagIn, TEXT("mag_in"));
		Audio.FirePitch = 0.7f;
		Anim(Anims.ReloadInsert, TEXT("A_TP_CH_Shotgun_01_Reload_Bolt"));
		break;
	case ETPSWeaponPreset::Kar98k:
		Sound(Audio.Fire, TEXT("kar_shot")); Sound(Audio.Cycle, TEXT("bolt")); Sound(Audio.MagIn, TEXT("mag_in"));
		Anim(Anims.Reload, TEXT("A_TP_CH_Sniper_01_Reload_Insert")); Anim(Anims.ReloadEmpty, TEXT("A_TP_CH_Sniper_01_Reload_Insert"));
		Anim(Anims.Cycle, TEXT("A_TP_CH_Sniper_01_Reload_Bolt"));
		break;
	case ETPSWeaponPreset::RPG7:
		Sound(Audio.Fire, TEXT("rifle_tail")); Sound(Audio.MagIn, TEXT("mag_in"));
		Audio.FirePitch = 0.6f; Audio.FireVolume = 1.2f;
		Anim(Anims.Reload, TEXT("A_TP_CH_RL_01_Reload")); Anim(Anims.ReloadEmpty, TEXT("A_TP_CH_RL_01_Reload"));
		break;
	default:
		break;
	}
}

void ATPSWeapon::BuildPlaceholderVisual()
{
	const FLinearColor Metal(0.07f, 0.07f, 0.08f);
	const FLinearColor Wood(0.32f, 0.18f, 0.08f);
	const FLinearColor Olive(0.22f, 0.27f, 0.14f);
	const FRotator AlongX(90.f, 0.f, 0.f);

	switch (Stats.PoseType)
	{
	case ETPSWeaponPoseType::Pistol:
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cube, FVector(4.f, 0.f, 3.f), FVector(0.2f, 0.035f, 0.045f), FRotator::ZeroRotator, Metal, false);
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cube, FVector(-3.f, 0.f, -3.f), FVector(0.045f, 0.03f, 0.1f), FRotator(-15.f, 0.f, 0.f), Metal, false);
		Muzzle->SetRelativeLocation(FVector(15.f, 0.f, 3.5f));
		RightHandGrip = FVector(-5.f, 0.f, -7.f); LeftHandGrip = FVector(-3.f, -4.f, -8.f);
		break;
	case ETPSWeaponPoseType::Shotgun:
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cube, FVector(14.f, 0.f, 2.f), FVector(0.45f, 0.05f, 0.08f), FRotator::ZeroRotator, Metal, false);
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cylinder, FVector(52.f, 0.f, 3.f), FVector(0.03f, 0.03f, 0.36f), AlongX, Metal, false);
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cube, FVector(40.f, 0.f, -1.f), FVector(0.22f, 0.045f, 0.045f), FRotator::ZeroRotator, Wood, false);
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cube, FVector(-18.f, 0.f, -1.f), FVector(0.26f, 0.04f, 0.1f), FRotator(-8.f, 0.f, 0.f), Wood, false);
		Muzzle->SetRelativeLocation(FVector(70.f, 0.f, 3.f));
		RightHandGrip = FVector(-8.f, 0.f, -5.f); LeftHandGrip = FVector(40.f, 0.f, -3.f);
		break;
	case ETPSWeaponPoseType::Sniper:
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cube, FVector(10.f, 0.f, 0.f), FVector(0.7f, 0.045f, 0.07f), FRotator::ZeroRotator, Wood, false);
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cylinder, FVector(60.f, 0.f, 3.f), FVector(0.022f, 0.022f, 0.4f), AlongX, Metal, false);
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cylinder, FVector(8.f, 0.f, 9.f), FVector(0.04f, 0.04f, 0.3f), AlongX, Metal, false);
		Muzzle->SetRelativeLocation(FVector(80.f, 0.f, 3.f));
		RightHandGrip = FVector(-4.f, 0.f, -4.f); LeftHandGrip = FVector(32.f, 0.f, -2.f);
		break;
	case ETPSWeaponPoseType::Launcher:
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cylinder, FVector(10.f, 0.f, 6.f), FVector(0.09f, 0.09f, 1.f), AlongX, Olive, false);
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cone, FVector(68.f, 0.f, 6.f), FVector(0.14f, 0.14f, 0.2f), FRotator(-90.f, 0.f, 0.f), Olive * 1.4f, false);
		Muzzle->SetRelativeLocation(FVector(78.f, 0.f, 6.f));
		RightHandGrip = FVector(4.f, 0.f, -6.f); LeftHandGrip = FVector(32.f, 0.f, -5.f);
		break;
	default:
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cube, FVector(12.f, 0.f, 2.f), FVector(0.5f, 0.05f, 0.09f), FRotator::ZeroRotator, Metal, false);
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cylinder, FVector(48.f, 0.f, 3.f), FVector(0.025f, 0.025f, 0.26f), AlongX, Metal, false);
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cube, FVector(16.f, 0.f, -7.f), FVector(0.05f, 0.035f, 0.14f), FRotator(15.f, 0.f, 0.f), Metal, false);
		UTPSStatics::AddShape(this, KickRoot, ETPSShape::Cube, FVector(-20.f, 0.f, -1.f), FVector(0.22f, 0.04f, 0.09f), FRotator::ZeroRotator, Metal, false);
		Muzzle->SetRelativeLocation(FVector(62.f, 0.f, 3.f));
		RightHandGrip = FVector(12.f, 0.f, -6.f); LeftHandGrip = FVector(40.f, 0.f, -1.f);
		break;
	}
}

float ATPSWeapon::GetNow() const
{
	const UWorld* World = GetWorld();
	return World ? World->GetTimeSeconds() : 0.f;
}

ATPSCharacter* ATPSWeapon::GetOwningCharacter() const
{
	return Cast<ATPSCharacter>(GetOwner());
}

FVector ATPSWeapon::GetMuzzleLocation() const
{
	return Muzzle->GetComponentLocation();
}

void ATPSWeapon::SetEquipped(bool bEquipped, float ReadyDelay)
{
	bEquippedState = bEquipped;
	SetActorHiddenInGame(!bEquipped);
	if (bEquipped)
	{
		ReadyTime = GetNow() + ReadyDelay;
		EquipDuration = ReadyDelay;
	}
	else
	{
		CancelReload();
		ReleaseTrigger();
		MuzzleLight->SetVisibility(false);
	}
}

float ATPSWeapon::GetReadyAlpha() const
{
	if (EquipDuration <= 0.f)
	{
		return 1.f;
	}
	return FMath::Clamp(1.f - (ReadyTime - GetNow()) / EquipDuration, 0.f, 1.f);
}

bool ATPSWeapon::CanFireNow() const
{
	const float Now = GetNow();
	return bEquippedState && Now >= ReadyTime && !bReloading && !bCycling && AmmoInMag > 0 && Now >= NextFireTime;
}

void ATPSWeapon::PullTrigger()
{
	bTriggerHeld = true;
	bFiredThisPull = false;
	if (bReloading)
	{
		// Shell-by-shell reloads can be interrupted to fire once a shell is loaded.
		if (Stats.ReloadStyle == ETPSReloadStyle::ShellByShell && AmmoInMag > 0)
		{
			bCancelAfterShell = true;
		}
		return;
	}
	TryFire();
}

void ATPSWeapon::ReleaseTrigger()
{
	bTriggerHeld = false;
	bFiredThisPull = false;
}

void ATPSWeapon::TryFire()
{
	const float Now = GetNow();
	if (!bEquippedState || Now < ReadyTime || Now < NextFireTime)
	{
		return;
	}
	if (AmmoInMag <= 0)
	{
		if (!bReloading)
		{
			UTPSStatics::PlaySoundAt(this, Audio.DryFire, GetMuzzleLocation(), 0.6f, 1.f);
			NextFireTime = Now + 0.3f;
			StartReload();
		}
		return;
	}
	if (CanFireNow())
	{
		FireShot();
		bFiredThisPull = true;
	}
}

float ATPSWeapon::GetSpreadMultiplier() const
{
	const ATPSCharacter* Shooter = GetOwningCharacter();
	const float Move = Shooter ? FMath::Clamp(Shooter->GetMoveSpeedAlpha(), 0.f, 1.f) : 0.f;
	const float Aim = (Shooter && Shooter->Combat) ? Shooter->Combat->GetAimAlpha() : 0.f;
	return (1.f + Bloom * 1.6f + Move * 0.9f) * (1.f - 0.45f * Aim);
}

void ATPSWeapon::FireShot()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}
	ATPSCharacter* Shooter = GetOwningCharacter();
	ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this);
	const float Now = GetNow();

	--AmmoInMag;
	NextFireTime = Now + Stats.FireInterval;

	const FVector MuzzleLoc = GetMuzzleLocation();
	FVector AimStart = MuzzleLoc;
	FVector AimDir = Muzzle->GetForwardVector();
	if (Shooter)
	{
		Shooter->GetAimRay(AimStart, AimDir);
	}
	AimDir = AimDir.GetSafeNormal();

	FCollisionQueryParams Params(SCENE_QUERY_STAT(TPSWeaponFire), false, this);
	if (Shooter)
	{
		Params.AddIgnoredActor(Shooter);
	}

	// Converge the barrel on what the aim ray (camera) sees, starting the ray level with the muzzle.
	const float Along = FVector::DotProduct(MuzzleLoc - AimStart, AimDir);
	const FVector RayStart = AimStart + AimDir * FMath::Max(0.f, Along);
	FVector TargetPoint = RayStart + AimDir * Stats.Range;
	FHitResult AimHit;
	if (World->LineTraceSingleByChannel(AimHit, RayStart, TargetPoint, TPS_TRACE_WEAPON, Params))
	{
		TargetPoint = AimHit.ImpactPoint;
	}
	FVector BaseDir = (TargetPoint - MuzzleLoc).GetSafeNormal();
	if (BaseDir.IsNearlyZero() || FVector::DotProduct(BaseDir, AimDir) < 0.5f)
	{
		BaseDir = AimDir;
	}

	const float SpreadRad = Stats.Spread * GetSpreadMultiplier() * (Shooter ? Shooter->GetSpreadScale() : 1.f);
	const bool bRocket = Stats.FireMode == ETPSFireMode::Rocket || Stats.BlastRadius > 0.f;

	bool bAnyHit = false;
	bool bAnyHead = false;
	bool bAnyKill = false;
	for (int32 Pellet = 0; Pellet < FMath::Max(1, Stats.Pellets); ++Pellet)
	{
		const FVector Dir = (BaseDir + FVector(FMath::FRandRange(-1.f, 1.f), FMath::FRandRange(-1.f, 1.f), FMath::FRandRange(-1.f, 1.f)) * SpreadRad).GetSafeNormal();
		const FVector End = MuzzleLoc + Dir * Stats.Range;
		FHitResult Hit;
		const bool bHit = World->LineTraceSingleByChannel(Hit, MuzzleLoc, End, TPS_TRACE_WEAPON, Params);
		const FVector HitPoint = bHit ? FVector(Hit.ImpactPoint) : End;

		UTPSFX::Tracer(this, MuzzleLoc + Dir * 25.f, HitPoint, bRocket ? FLinearColor(1.f, 0.5f, 0.15f) : TracerColor, bRocket ? 4.f : 1.f);
		if (GM)
		{
			GM->ReportBulletPath(MuzzleLoc, HitPoint, Shooter);
		}
		if (!bHit)
		{
			continue;
		}
		if (bRocket)
		{
			Explode(Hit.ImpactPoint, Hit.GetActor(), Shooter);
			if (const ATPSCharacter* Direct = Cast<ATPSCharacter>(Hit.GetActor()))
			{
				bAnyHit = true;
				bAnyKill |= Direct->IsDead();
			}
		}
		else
		{
			ProcessHit(Hit, Dir, Shooter, bAnyHit, bAnyHead, bAnyKill);
		}
	}

	if (GM)
	{
		GM->NotifyShot(Shooter, bAnyHit);
		if (bAnyHit)
		{
			GM->NotifyHitConfirmed(Shooter, bAnyHead, bAnyKill);
		}
		GM->ReportNoise(MuzzleLoc, 4500.f, Shooter);
	}

	// Feedback
	Bloom = FMath::Min(1.f, Bloom + Stats.BloomPerShot);
	RecoilAlpha = 1.f;
	ApplyKick();
	MuzzleLight->SetVisibility(true);
	MuzzleLightOffTime = Now + 0.05f;
	if (MuzzleFlashFX)
	{
		UTPSFX::SpawnNiagara(this, MuzzleFlashFX, MuzzleLoc, Muzzle->GetComponentRotation());
	}
	else
	{
		UTPSFX::MuzzleFlash(this, MuzzleLoc, BaseDir, bRocket ? 2.5f : 1.f);
	}
	const float Pitch = Audio.FirePitch * FMath::FRandRange(0.97f, 1.03f);
	UTPSStatics::PlaySoundAt(this, Audio.Fire, MuzzleLoc, Audio.FireVolume, Pitch);
	UTPSStatics::PlaySoundAt(this, Audio.FireTail, MuzzleLoc, 0.6f * Audio.FireVolume, Pitch);

	const bool bManualCycle = Stats.FireMode == ETPSFireMode::Pump || Stats.FireMode == ETPSFireMode::Bolt;
	if (bManualCycle && AmmoInMag > 0)
	{
		bCycling = true;
		bCycleSoundPlayed = false;
		CycleStart = Now + Stats.CycleDelay;
		CycleEnd = CycleStart + Stats.CycleTime;
	}
	else if (bEjectShells && !bRocket && !bManualCycle)
	{
		UTPSFX::Shell(this, ShellEject->GetComponentLocation(), ShellEject->GetRightVector() * 160.f + FVector(0.f, 0.f, 120.f));
	}

	if (Shooter)
	{
		if (Anims.Fire)
		{
			Shooter->PlayActionAnim(Anims.Fire, 1.f, 1, true, 0.02f, 0.1f);
		}
		Shooter->OnWeaponFired(this);
	}
	OnFired.Broadcast(this);
}

void ATPSWeapon::ProcessHit(const FHitResult& Hit, const FVector& Dir, ATPSCharacter* Shooter, bool& bOutHitTarget, bool& bOutHeadshot, bool& bOutKill)
{
	AActor* HitActor = Hit.GetActor();
	ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this);

	if (ATPSCharacter* Victim = Cast<ATPSCharacter>(HitActor))
	{
		UTPSFX::Impact(this, Hit.ImpactPoint, Hit.ImpactNormal, true, nullptr);
		if (Victim->IsDead())
		{
			return;
		}
		bool bKilled = false;
		ETPSHitZone Zone = ETPSHitZone::Torso;
		const float Applied = Victim->ReceiveWeaponHit(Stats.Damage, Hit, Shooter, bKilled, Zone);
		if (Applied > 0.f)
		{
			bOutHitTarget = true;
			bOutHeadshot |= Zone == ETPSHitZone::Head;
			if (bKilled)
			{
				bOutKill = true;
				if (GM)
				{
					GM->NotifyKill(Shooter, Victim, Zone == ETPSHitZone::Head);
				}
			}
		}
		return;
	}

	if (ATPSTrainingTarget* Target = Cast<ATPSTrainingTarget>(HitActor))
	{
		bool bHead = false;
		if (Target->ReceiveShot(Hit, Shooter, bHead))
		{
			bOutHitTarget = true;
			bOutHeadshot |= bHead;
		}
		UTPSFX::Impact(this, Hit.ImpactPoint, Hit.ImpactNormal, false, ImpactFX);
		return;
	}

	UTPSFX::Impact(this, Hit.ImpactPoint, Hit.ImpactNormal, false, ImpactFX);
	if (HitActor)
	{
		UGameplayStatics::ApplyPointDamage(HitActor, Stats.Damage, Dir, Hit, Shooter ? Shooter->GetController() : nullptr, this, UDamageType::StaticClass());
	}
	UPrimitiveComponent* Comp = Hit.GetComponent();
	if (Comp && Comp->IsSimulatingPhysics())
	{
		Comp->AddImpulseAtLocation(Dir * Stats.Damage * 60.f, Hit.ImpactPoint);
	}
}

void ATPSWeapon::Explode(const FVector& Location, AActor* DirectVictim, ATPSCharacter* Shooter)
{
	UWorld* World = GetWorld();
	ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this);
	const float Radius = FMath::Max(1.f, Stats.BlastRadius);

	if (ExplosionFX)
	{
		UTPSFX::SpawnNiagara(this, ExplosionFX, Location, FRotator::ZeroRotator);
	}
	else
	{
		UTPSFX::Explosion(this, Location, Radius);
	}
	if (GM)
	{
		GM->ReportNoise(Location, 6000.f, Shooter);
	}

	auto DamageVictim = [GM, Shooter, &Location](ATPSCharacter* Victim, float Damage, ETPSHitZone Zone)
	{
		if (!Victim || Victim->IsDead() || Victim == Shooter || Damage <= 0.f)
		{
			return;
		}
		bool bKilled = false;
		Victim->ReceiveDirectDamage(Victim->ModifyIncomingDamage(Damage, Zone, Shooter), Location, Zone, Shooter, bKilled);
		if (bKilled && GM)
		{
			GM->NotifyKill(Shooter, Victim, false);
		}
	};

	ATPSCharacter* Direct = Cast<ATPSCharacter>(DirectVictim);
	DamageVictim(Direct, Stats.Damage, ETPSHitZone::Torso);

	TArray<FOverlapResult> Overlaps;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(TPSExplosion), false, this);
	World->OverlapMultiByObjectType(Overlaps, Location, FQuat::Identity, FCollisionObjectQueryParams(ECC_Pawn), FCollisionShape::MakeSphere(Radius), Params);

	TSet<ATPSCharacter*> Done;
	if (Direct)
	{
		Done.Add(Direct);
	}
	for (const FOverlapResult& Overlap : Overlaps)
	{
		ATPSCharacter* Victim = Cast<ATPSCharacter>(Overlap.GetActor());
		if (!Victim || Done.Contains(Victim))
		{
			continue;
		}
		Done.Add(Victim);
		const float Dist = FVector::Dist(Victim->GetActorLocation(), Location);
		DamageVictim(Victim, FMath::RoundToFloat(Stats.Damage * (1.f - Dist / Radius)), ETPSHitZone::Torso);
	}
}

void ATPSWeapon::ApplyKick()
{
	const FTPSRecoilProfile& R = Stats.Recoil;
	const float S = FMath::FRandRange(0.85f, 1.15f);
	KickOffset += FVector(-R.Back, 0.f, R.Up) * S;
	KickRotation += FRotator(R.Flip * S, 0.f, (R.RollBase + FMath::FRand() * R.RollRange) * S);
	KickOffset = KickOffset.BoundToCube(12.f);
	KickRotation.Pitch = FMath::Clamp(KickRotation.Pitch, -25.f, 25.f);
}

bool ATPSWeapon::StartReload()
{
	if (bReloading || !bEquippedState)
	{
		return false;
	}
	const int32 Cap = Stats.MagazineSize + ((Stats.bChamberRound && AmmoInMag > 0) ? 1 : 0);
	if (AmmoInMag >= Cap || (!Stats.bInfiniteReserve && ReserveAmmo <= 0))
	{
		return false;
	}

	const float Now = GetNow();
	bReloading = true;
	bReloadFromEmpty = AmmoInMag == 0;
	bCancelAfterShell = false;
	bMagOutPlayed = bMagInPlayed = bCyclePlayedInReload = false;
	bCycling = false;
	ReloadStart = Now;

	ATPSCharacter* Shooter = GetOwningCharacter();
	if (Stats.ReloadStyle == ETPSReloadStyle::ShellByShell)
	{
		const float LeadIn = bReloadFromEmpty ? Stats.ReloadEmptyTime : Stats.ReloadTime;
		NextShellTime = Now + LeadIn + Stats.ShellInsertTime;
		ReloadDuration = LeadIn + Stats.ShellInsertTime * (Stats.MagazineSize - AmmoInMag);
	}
	else
	{
		ReloadDuration = FMath::Max(0.1f, bReloadFromEmpty ? Stats.ReloadEmptyTime : Stats.ReloadTime);
		UAnimSequenceBase* Anim = (bReloadFromEmpty && Anims.ReloadEmpty) ? Anims.ReloadEmpty.Get() : Anims.Reload.Get();
		if (Shooter && Anim)
		{
			// Stretch the clip to the gameplay reload time so events and animation stay in sync.
			Shooter->PlayActionAnim(Anim, Anim->GetPlayLength() / ReloadDuration, 1, true);
		}
	}
	OnReloadStarted.Broadcast(this);
	return true;
}

void ATPSWeapon::CancelReload()
{
	if (!bReloading)
	{
		return;
	}
	bReloading = false;
	if (ATPSCharacter* Shooter = GetOwningCharacter())
	{
		Shooter->StopActionAnim(0.15f);
	}
}

void ATPSWeapon::FinishReload()
{
	const int32 Cap = Stats.MagazineSize + ((!bReloadFromEmpty && Stats.bChamberRound) ? 1 : 0);
	int32 Need = FMath::Max(0, Cap - AmmoInMag);
	if (!Stats.bInfiniteReserve)
	{
		Need = FMath::Min(Need, ReserveAmmo);
		ReserveAmmo -= Need;
	}
	AmmoInMag += Need;
	bReloading = false;
	OnReloadFinished.Broadcast(this);
}

void ATPSWeapon::RefillAmmo()
{
	ReserveAmmo = Stats.MaxReserveAmmo;
	if (!bReloading)
	{
		AmmoInMag = FMath::Max(AmmoInMag, Stats.MagazineSize);
	}
}

float ATPSWeapon::GetReloadProgress() const
{
	if (!bReloading)
	{
		return 0.f;
	}
	if (Stats.ReloadStyle == ETPSReloadStyle::ShellByShell)
	{
		return Stats.MagazineSize > 0 ? float(AmmoInMag) / float(Stats.MagazineSize) : 1.f;
	}
	return FMath::Clamp((GetNow() - ReloadStart) / FMath::Max(0.01f, ReloadDuration), 0.f, 1.f);
}

void ATPSWeapon::TickReload(float Now)
{
	const FVector Loc = GetActorLocation();
	if (Stats.ReloadStyle == ETPSReloadStyle::ShellByShell)
	{
		if (Now < NextShellTime)
		{
			return;
		}
		if (!Stats.bInfiniteReserve)
		{
			--ReserveAmmo;
		}
		++AmmoInMag;
		UTPSStatics::PlaySoundAt(this, Audio.MagIn, Loc, 0.8f, FMath::FRandRange(0.95f, 1.05f));
		if (ATPSCharacter* Shooter = GetOwningCharacter())
		{
			Shooter->PlayActionAnim(Anims.ReloadInsert, 1.f, 1, true, 0.05f, 0.1f);
		}
		const bool bFull = AmmoInMag >= Stats.MagazineSize;
		const bool bOut = !Stats.bInfiniteReserve && ReserveAmmo <= 0;
		if (bFull || bOut || bCancelAfterShell)
		{
			if (bReloadFromEmpty)
			{
				UTPSStatics::PlaySoundAt(this, Audio.Cycle, Loc, 0.9f, 1.f);
			}
			bReloading = false;
			OnReloadFinished.Broadcast(this);
			if (bCancelAfterShell && bTriggerHeld)
			{
				NextFireTime = FMath::Max(NextFireTime, Now + 0.12f);
			}
			return;
		}
		NextShellTime += Stats.ShellInsertTime;
		return;
	}

	const float T = (Now - ReloadStart) / FMath::Max(0.01f, ReloadDuration);
	if (T > 0.2f && !bMagOutPlayed)
	{
		bMagOutPlayed = true;
		UTPSStatics::PlaySoundAt(this, Audio.MagOut, Loc, 0.8f, 1.f);
	}
	if (T > 0.62f && !bMagInPlayed)
	{
		bMagInPlayed = true;
		UTPSStatics::PlaySoundAt(this, Audio.MagIn, Loc, 0.9f, 1.f);
	}
	if (bReloadFromEmpty && T > 0.85f && !bCyclePlayedInReload)
	{
		bCyclePlayedInReload = true;
		UTPSStatics::PlaySoundAt(this, Audio.Cycle, Loc, 0.9f, 1.f);
	}
	if (T >= 1.f)
	{
		FinishReload();
	}
}

void ATPSWeapon::TickCycle(float Now)
{
	if (Now >= CycleStart && !bCycleSoundPlayed)
	{
		bCycleSoundPlayed = true;
		UTPSStatics::PlaySoundAt(this, Audio.Cycle, GetActorLocation(), 0.9f, 1.f);
		if (ATPSCharacter* Shooter = GetOwningCharacter())
		{
			if (Anims.Cycle)
			{
				Shooter->PlayActionAnim(Anims.Cycle, Anims.Cycle->GetPlayLength() / FMath::Max(0.1f, Stats.CycleTime), 1, true);
			}
		}
		if (bEjectShells)
		{
			UTPSFX::Shell(this, ShellEject->GetComponentLocation(), ShellEject->GetRightVector() * 140.f + FVector(0.f, 0.f, 140.f));
		}
	}
	if (Now >= CycleEnd)
	{
		bCycling = false;
	}
}

void ATPSWeapon::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	const float Now = GetNow();

	Bloom = FMath::Max(0.f, Bloom - Stats.BloomDecay * DeltaSeconds);
	RecoilAlpha = FMath::FInterpTo(RecoilAlpha, 0.f, DeltaSeconds, 10.f);
	KickOffset = FMath::VInterpTo(KickOffset, FVector::ZeroVector, DeltaSeconds, 14.f);
	KickRotation = FMath::RInterpTo(KickRotation, FRotator::ZeroRotator, DeltaSeconds, 12.f);
	KickRoot->SetRelativeLocationAndRotation(KickOffset, KickRotation);

	if (MuzzleLight->IsVisible() && Now >= MuzzleLightOffTime)
	{
		MuzzleLight->SetVisibility(false);
	}
	if (bReloading)
	{
		TickReload(Now);
	}
	if (bCycling)
	{
		TickCycle(Now);
	}

	if (bTriggerHeld && bEquippedState && !bReloading)
	{
		bool bRepeat = Stats.FireMode == ETPSFireMode::Auto;
		if (!bRepeat && Stats.FireMode == ETPSFireMode::Semi)
		{
			// Optional "auto fire" accessibility setting for semi-auto guns (player only).
			const ATPSCharacter* Shooter = GetOwningCharacter();
			const UTPSSettingsSave* Settings = UTPSSettingsSubsystem::Get(this);
			bRepeat = Shooter && Shooter->IsPlayerControlled() && Settings && Settings->bAutoFire;
		}
		if (bRepeat || !bFiredThisPull)
		{
			TryFire();
		}
	}
}
