#include "Characters/TPSPlayerCharacter.h"
#include "Core/TPSGameMode.h"
#include "Core/TPSSettings.h"
#include "Core/TPSStatics.h"
#include "Core/TPSPlayerController.h"
#include "Core/TPSPlayerCameraManager.h"
#include "Components/TPSHealthComponent.h"
#include "Components/TPSCombatComponent.h"
#include "Components/TPSTraversalComponent.h"
#include "Weapons/TPSWeapon.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Engine/World.h"

ATPSPlayerCharacter::ATPSPlayerCharacter(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->TargetArmLength = HipArmLength;
	CameraBoom->bUsePawnControlRotation = true;
	CameraBoom->SocketOffset = FVector(0.f, ShoulderOffset, 0.f);
	CameraBoom->TargetOffset = FVector(0.f, 0.f, CameraHeight);
	CameraBoom->ProbeSize = 12.f;
	CameraBoom->bDoCollisionTest = true;
	CameraBoom->bEnableCameraLag = false;

	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;
	FollowCamera->SetFieldOfView(DefaultFOV);

	PlaceholderColor = FLinearColor(0.25f, 0.42f, 0.75f);
	Health->RegenRate = 22.f;
	Health->RegenDelay = 3.5f;
}

void ATPSPlayerCharacter::BeginPlay()
{
	Super::BeginPlay();
	CurrentSide = ShoulderSide;
}

float ATPSPlayerCharacter::GetHipFOV() const
{
	const UTPSSettingsSave* Settings = UTPSSettingsSubsystem::Get(this);
	return Settings ? Settings->FieldOfView : DefaultFOV;
}

void ATPSPlayerCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	const float Aim = Combat ? Combat->GetAimAlpha() : 0.f;
	const bool bRolling = Traversal && (Traversal->GetTraversalType() == ETPSTraversalType::DodgeRoll || Traversal->GetTraversalType() == ETPSTraversalType::DiveRoll);
	const float RollW = bRolling ? 1.f : 0.f;

	CurrentSide = FMath::FInterpTo(CurrentSide, ShoulderSide, DeltaSeconds, 8.f);
	const float WantLength = FMath::Lerp(HipArmLength, AimArmLength, Aim) + RollArmExtra * RollW;
	CameraBoom->TargetArmLength = FMath::FInterpTo(CameraBoom->TargetArmLength, WantLength, DeltaSeconds, CameraInterpSpeed);

	const float Side = ShoulderOffset * CurrentSide + LeanAmount * MaxLeanOffset;
	const FVector WantSocket(0.f, Side, 0.f);
	CameraBoom->SocketOffset = FMath::VInterpTo(CameraBoom->SocketOffset, WantSocket, DeltaSeconds, CameraInterpSpeed);
	const float WantHeight = CameraHeight - RollHeightDrop * RollW;
	CameraBoom->TargetOffset.Z = FMath::FInterpTo(CameraBoom->TargetOffset.Z, WantHeight, DeltaSeconds, CameraInterpSpeed);
	FollowCamera->SetRelativeRotation(FRotator(0.f, 0.f, LeanAmount * LeanCameraRoll));

	// FOV: hip (settings) -> weapon aim FOV -> scope FOV.
	float WantFOV = GetHipFOV();
	if (const ATPSWeapon* Weapon = GetCurrentWeapon())
	{
		WantFOV = FMath::Lerp(WantFOV, Weapon->Stats.AimFOV, Aim);
		if (Combat->IsScoped())
		{
			WantFOV = Weapon->Stats.ScopeFOV;
		}
	}
	FollowCamera->SetFieldOfView(FMath::FInterpTo(FollowCamera->FieldOfView, WantFOV, DeltaSeconds, 14.f));

	// Running footsteps can be heard by AI through cover.
	const UWorld* World = GetWorld();
	if (World && !bIsCrouched && GetVelocity().Size2D() > FootstepNoiseSpeed && World->GetTimeSeconds() >= NextFootstepNoise)
	{
		NextFootstepNoise = World->GetTimeSeconds() + 0.3f;
		if (ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
		{
			GM->ReportNoise(GetActorLocation(), FootstepNoiseRadius, this);
		}
	}
}

void ATPSPlayerCharacter::GetAimRay(FVector& OutStart, FVector& OutDir) const
{
	const APlayerController* PC = Cast<APlayerController>(Controller);
	if (PC && PC->PlayerCameraManager)
	{
		OutStart = PC->PlayerCameraManager->GetCameraLocation();
		OutDir = PC->PlayerCameraManager->GetCameraRotation().Vector();
		return;
	}
	Super::GetAimRay(OutStart, OutDir);
}

float ATPSPlayerCharacter::ModifyIncomingDamage(float BaseDamage, ETPSHitZone Zone, const ATPSCharacter* Shooter) const
{
	// AI rounds use the web build's fixed table: head 30, torso 11, limbs 7.
	if (Shooter && !Shooter->IsPlayerControlled())
	{
		switch (Zone)
		{
		case ETPSHitZone::Head: return 30.f;
		case ETPSHitZone::Torso: return 11.f;
		default: return 7.f;
		}
	}
	return BaseDamage;
}

void ATPSPlayerCharacter::OnWeaponFired(ATPSWeapon* Weapon)
{
	if (!Weapon)
	{
		return;
	}
	const FTPSRecoilProfile& R = Weapon->Stats.Recoil;
	const float Scale = FMath::FRandRange(0.85f, 1.15f);
	if (ATPSPlayerController* PC = Cast<ATPSPlayerController>(Controller))
	{
		const float AimDamp = Combat ? FMath::Lerp(1.f, 0.7f, Combat->GetAimAlpha()) : 1.f;
		PC->AddRecoil(R.CameraKick * Scale * AimDamp, FMath::FRandRange(-1.f, 1.f) * R.Yaw * 0.25f * Scale * AimDamp);
		if (ATPSPlayerCameraManager* Cam = Cast<ATPSPlayerCameraManager>(PC->PlayerCameraManager))
		{
			const float Trauma = Weapon->Stats.ShotTrauma > 0.f ? Weapon->Stats.ShotTrauma : FMath::Min(0.3f, 0.03f + 0.04f * R.CameraKick);
			Cam->AddTrauma(Trauma * FMath::Max(0.25f, R.ShakeK));
		}
	}
}

void ATPSPlayerCharacter::ResetForRound(const FTransform& SpawnTransform)
{
	if (Traversal)
	{
		Traversal->AbortTraversal();
	}
	if (bIsCrouched)
	{
		UnCrouch();
	}
	StopActionAnim(0.f);
	SetActorLocationAndRotation(SpawnTransform.GetLocation(), SpawnTransform.GetRotation(), false, nullptr, ETeleportType::ResetPhysics);
	if (Controller)
	{
		Controller->SetControlRotation(FRotator(0.f, SpawnTransform.Rotator().Yaw, 0.f));
	}
	GetCharacterMovement()->StopMovementImmediately();
	GetCharacterMovement()->SetMovementMode(MOVE_Walking);
	Health->ResetHealth();
	if (Combat)
	{
		Combat->StopFire();
		Combat->SetAimStage(0);
		Combat->RefillAllAmmo();
	}
}
