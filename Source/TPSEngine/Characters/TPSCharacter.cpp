#include "Characters/TPSCharacter.h"
#include "TPSEngine.h"
#include "Core/TPSStatics.h"
#include "Components/TPSHealthComponent.h"
#include "Components/TPSCombatComponent.h"
#include "Components/TPSTraversalComponent.h"
#include "Weapons/TPSWeapon.h"
#include "Animation/TPSAnimInstance.h"
#include "Animation/TPSProceduralAnimInstance.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"
#include "Animation/AnimSequenceBase.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/StaticMesh.h"
#include "Engine/DamageEvents.h"
#include "Engine/World.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/Controller.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "PhysicsEngine/PhysicsAsset.h"
#include "UObject/ConstructorHelpers.h"
#include "CollisionQueryParams.h"

ATPSCharacter::ATPSCharacter(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	PrimaryActorTick.bCanEverTick = true;

	UCapsuleComponent* Capsule = GetCapsuleComponent();
	Capsule->InitCapsuleSize(34.f, 88.f);
	Capsule->SetCollisionResponseToChannel(TPS_TRACE_WEAPON, ECR_Block);

	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;

	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->bOrientRotationToMovement = false;
	Move->bUseControllerDesiredRotation = false;
	Move->MaxWalkSpeed = WalkSpeed;
	Move->MaxWalkSpeedCrouched = WalkSpeed;
	Move->MaxAcceleration = 1500.f;
	Move->BrakingDecelerationWalking = 1600.f;
	Move->GroundFriction = 8.f;
	Move->GravityScale = 1.f;
	Move->NavAgentProps.bCanCrouch = true;
	Move->SetCrouchedHalfHeight(88.f - CrouchDrop);
	Move->bCanWalkOffLedgesWhenCrouching = true;
	Move->PerchRadiusThreshold = 10.f;

	USkeletalMeshComponent* SkMesh = GetMesh();
	SkMesh->SetRelativeLocationAndRotation(FVector(0.f, 0.f, -88.f), FRotator(0.f, -90.f, 0.f));
	SkMesh->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	SkMesh->SetCollisionResponseToAllChannels(ECR_Ignore);
	SkMesh->SetCollisionResponseToChannel(TPS_TRACE_WEAPON, ECR_Block);
	SkMesh->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;

	Health = CreateDefaultSubobject<UTPSHealthComponent>(TEXT("Health"));
	Combat = CreateDefaultSubobject<UTPSCombatComponent>(TEXT("Combat"));
	Traversal = CreateDefaultSubobject<UTPSTraversalComponent>(TEXT("Traversal"));

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderMesh(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(TEXT("/Engine/BasicShapes/Sphere.Sphere"));

	PlaceholderRoot = CreateDefaultSubobject<USceneComponent>(TEXT("PlaceholderRoot"));
	PlaceholderRoot->SetupAttachment(Capsule);

	PlaceholderBody = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PlaceholderBody"));
	PlaceholderBody->SetupAttachment(PlaceholderRoot);
	PlaceholderBody->SetStaticMesh(CylinderMesh.Object);
	PlaceholderBody->SetRelativeLocation(FVector(0.f, 0.f, -15.f));
	PlaceholderBody->SetRelativeScale3D(FVector(0.6f, 0.5f, 1.46f));
	PlaceholderBody->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	PlaceholderBody->SetCanEverAffectNavigation(false);

	PlaceholderHead = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PlaceholderHead"));
	PlaceholderHead->SetupAttachment(PlaceholderRoot);
	PlaceholderHead->SetStaticMesh(SphereMesh.Object);
	PlaceholderHead->SetRelativeLocation(FVector(0.f, 0.f, 72.f));
	PlaceholderHead->SetRelativeScale3D(FVector(0.3f));
	PlaceholderHead->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	PlaceholderHead->SetCanEverAffectNavigation(false);

	WeaponHolder = CreateDefaultSubobject<USceneComponent>(TEXT("WeaponHolder"));
	WeaponHolder->SetupAttachment(Capsule);
	WeaponHolder->SetRelativeLocation(FVector(30.f, 16.f, 30.f));
}

void ATPSCharacter::BeginPlay()
{
	AutoLoadContent();
	RefreshVisualMode();

	Super::BeginPlay();

	if (UMaterialInstanceDynamic* BodyMat = UTPSStatics::MakeColorMaterial(this, PlaceholderColor))
	{
		PlaceholderBody->SetMaterial(0, BodyMat);
	}
	if (UMaterialInstanceDynamic* HeadMat = UTPSStatics::MakeColorMaterial(this, PlaceholderColor * 0.85f))
	{
		PlaceholderHead->SetMaterial(0, HeadMat);
	}

	GetCharacterMovement()->SetCrouchedHalfHeight(88.f - CrouchDrop);
	Health->OnDeath.AddDynamic(this, &ATPSCharacter::HandleDeath);
}

void ATPSCharacter::AutoLoadContent()
{
	if (!bAutoLoadDefaultContent)
	{
		return;
	}

	USkeletalMeshComponent* SkMesh = GetMesh();
	if (SkMesh && !SkMesh->GetSkeletalMeshAsset())
	{
		USkeletalMesh* BodyMesh = Body == ETPSBodyType::UE5Manny
			? UTPSStatics::TryLoad<USkeletalMesh>(TEXT("/Game/TPS/Characters/SK_Manny.SK_Manny"))
			: UTPSStatics::TryLoad<USkeletalMesh>(TEXT("/Game/TPS/Characters/SK_Mannequin.SK_Mannequin"));
		if (BodyMesh)
		{
			// A user AnimBP named ABP_TPS wins; otherwise the built-in procedural animation drives the clips.
			UClass* AnimClass = UTPSStatics::TryLoad<UClass>(TEXT("/Game/TPS/Animations/ABP_TPS.ABP_TPS_C"));
			if (!AnimClass || !AnimClass->IsChildOf(UAnimInstance::StaticClass()))
			{
				AnimClass = UTPSProceduralAnimInstance::StaticClass();
			}
			SkMesh->SetSkeletalMeshAsset(BodyMesh);
			SkMesh->SetAnimationMode(EAnimationMode::AnimationBlueprint);
			SkMesh->SetAnimInstanceClass(AnimClass);
		}
	}

	auto Fill = [](TObjectPtr<UAnimSequenceBase>& Slot, const TCHAR* Name)
	{
		if (!Slot)
		{
			Slot = UTPSStatics::TryLoad<UAnimSequenceBase>(FString::Printf(TEXT("/Game/TPS/Animations/%s.%s"), Name, Name));
		}
	};
	Fill(AnimSet.MantleLow, TEXT("A_Climb_Low_01"));
	Fill(AnimSet.MantleMid, TEXT("A_Climb_Up_02"));
	Fill(AnimSet.MantleHigh, TEXT("A_Climb_Up_03"));
	Fill(AnimSet.DiveRoll, TEXT("A_JumpRoll"));
	Fill(AnimSet.DodgeRoll, TEXT("A_JumpRoll"));
	Fill(AnimSet.LadderUpStart, TEXT("A_Ladder_Up_Start"));
	Fill(AnimSet.LadderUpLoop, TEXT("A_Ladder_Up_Loop"));
	Fill(AnimSet.LadderUpEnd, TEXT("A_Ladder_Up_End"));
	Fill(AnimSet.LadderDownStart, TEXT("A_Ladder_Dawn_Start"));
	Fill(AnimSet.LadderDownLoop, TEXT("A_Ladder_Dawn_Loop"));
	Fill(AnimSet.LadderDownEnd, TEXT("A_Ladder_Dawn_End"));
}

void ATPSCharacter::RefreshVisualMode()
{
	USkeletalMeshComponent* SkMesh = GetMesh();
	bHasSkeletalVisual = SkMesh && SkMesh->GetSkeletalMeshAsset() != nullptr;
	PlaceholderRoot->SetVisibility(!bHasSkeletalVisual, true);

	// With a physics asset, bullets hit bones (exact head/limb zones) instead of the capsule.
	const bool bBoneHits = bHasSkeletalVisual && SkMesh->GetPhysicsAsset() != nullptr;
	GetCapsuleComponent()->SetCollisionResponseToChannel(TPS_TRACE_WEAPON, bBoneHits ? ECR_Ignore : ECR_Block);
}

void ATPSCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (IsDead())
	{
		if (DeathTipAlpha >= 0.f && DeathTipAlpha < 1.f)
		{
			DeathTipAlpha = FMath::Min(1.f, DeathTipAlpha + DeltaSeconds * 2.5f);
			const float A = FMath::InterpEaseIn(0.f, 1.f, DeathTipAlpha, 2.f);
			PlaceholderRoot->SetRelativeLocationAndRotation(FVector(0.f, 0.f, -60.f * A), FRotator(0.f, 0.f, 90.f * A));
		}
		return;
	}

	UpdateMovementSpeed();
	UpdateLean(DeltaSeconds);
	UpdateFacing(DeltaSeconds);
}

void ATPSCharacter::UpdateMovementSpeed()
{
	UCharacterMovementComponent* Move = GetCharacterMovement();
	const bool bAim = IsAimingWeapon();
	const FVector Accel = Move->GetCurrentAcceleration().GetSafeNormal2D();
	const float ForwardDot = Accel.IsNearlyZero() ? 1.f : FVector::DotProduct(Accel, GetActorForwardVector());

	bIsRunning = bWantsRun && !bAim && !bIsCrouched && ForwardDot > 0.3f && !Accel.IsNearlyZero();

	float Speed = bIsRunning ? RunSpeed : WalkSpeed;
	if (!bIsRunning)
	{
		if (ForwardDot < -0.3f)
		{
			Speed *= BackpedalSpeedMultiplier;
		}
		else if (ForwardDot < 0.5f)
		{
			Speed *= StrafeSpeedMultiplier;
		}
	}
	if (bAim)
	{
		Speed *= AimSpeedMultiplier;
	}
	Speed *= FMath::Lerp(1.f, LeanSpeedMultiplier, FMath::Abs(LeanAmount));

	Move->MaxWalkSpeed = Speed;
	Move->MaxWalkSpeedCrouched = Speed;
}

void ATPSCharacter::UpdateLean(float DeltaSeconds)
{
	float Target = LeanInput;
	if (Traversal && Traversal->IsBusy())
	{
		Target = 0.f;
	}

	if (!FMath::IsNearlyZero(Target))
	{
		// Walls on the lean side limit how far the head can move.
		const float Sign = FMath::Sign(Target);
		const FVector Head = GetActorLocation() + FVector(0.f, 0.f, BaseEyeHeight);
		const float Reach = MaxLeanOffset + 25.f;
		FHitResult Hit;
		FCollisionQueryParams Params(SCENE_QUERY_STAT(TPSLean), false, this);
		if (GetWorld()->LineTraceSingleByChannel(Hit, Head, Head + GetActorRightVector() * Sign * Reach, ECC_Visibility, Params))
		{
			const float Allowed = FMath::Clamp((Hit.Distance - 25.f) / MaxLeanOffset, 0.f, 1.f);
			Target = Sign * FMath::Min(FMath::Abs(Target), Allowed);
		}
	}
	LeanAmount = FMath::FInterpTo(LeanAmount, Target, DeltaSeconds, LeanSpeed);
}

float ATPSCharacter::GetDesiredFacingYaw() const
{
	return Controller ? Controller->GetControlRotation().Yaw : GetActorRotation().Yaw;
}

bool ATPSCharacter::WantsToFaceAim() const
{
	return IsAimingWeapon() || (Combat && Combat->HasFiredRecently());
}

void ATPSCharacter::UpdateFacing(float DeltaSeconds)
{
	if (Traversal && Traversal->IsBusy())
	{
		bTurningInPlace = false;
		return;
	}

	const float Current = GetActorRotation().Yaw;
	const float Error = FMath::FindDeltaAngleDegrees(Current, GetDesiredFacingYaw());
	const bool bMoving = GetVelocity().Size2D() > 10.f;

	float Rate = TurnRate;
	if (WantsToFaceAim() || bMoving)
	{
		bTurningInPlace = false;
	}
	else
	{
		if (!bTurningInPlace && FMath::Abs(Error) > TurnInPlaceStartAngle)
		{
			bTurningInPlace = true;
		}
		if (bTurningInPlace && FMath::Abs(Error) < TurnInPlaceStopAngle)
		{
			bTurningInPlace = false;
		}
		if (!bTurningInPlace)
		{
			return;
		}
		Rate *= 0.6f;
	}

	const float Step = FMath::Clamp(Error, -Rate * DeltaSeconds, Rate * DeltaSeconds);
	SetActorRotation(FRotator(0.f, Current + Step, 0.f));
}

void ATPSCharacter::ToggleCrouch()
{
	if (Traversal && Traversal->IsBusy())
	{
		return;
	}
	if (bIsCrouched)
	{
		UnCrouch();
	}
	else
	{
		Crouch();
	}
}

UTPSProceduralAnimInstance* ATPSCharacter::GetProceduralAnim() const
{
	return GetMesh() ? Cast<UTPSProceduralAnimInstance>(GetMesh()->GetAnimInstance()) : nullptr;
}

bool ATPSCharacter::IsUpperBodyActionActive() const
{
	const UTPSProceduralAnimInstance* Proc = GetProceduralAnim();
	if (Proc)
	{
		return Proc->IsUpperBodyActionActive();
	}
	const UAnimInstance* AnimInstance = GetMesh() ? GetMesh()->GetAnimInstance() : nullptr;
	return AnimInstance && AnimInstance->IsSlotActive(UTPSAnimInstance::UpperBodySlot);
}

float ATPSCharacter::GetTimeSinceHit() const
{
	const UWorld* World = GetWorld();
	return World ? World->GetTimeSeconds() - LastHitTime : 1000.f;
}

float ATPSCharacter::PlayTraversalAnim(UAnimSequenceBase* Anim, float PlayRate, int32 Loops, const FVector& WorldDisplacement, bool bHasDisplacement)
{
	if (UTPSProceduralAnimInstance* Proc = GetProceduralAnim())
	{
		return (Anim && bHasSkeletalVisual) ? Proc->PlayAction(Anim, PlayRate, Loops, false, 0.12f, 0.2f, WorldDisplacement, bHasDisplacement) : 0.f;
	}
	return PlayActionAnim(Anim, PlayRate, Loops, false, 0.12f, 0.2f);
}

float ATPSCharacter::PlayActionAnim(UAnimSequenceBase* Anim, float PlayRate, int32 Loops, bool bUpperBodyOnly, float BlendIn, float BlendOut)
{
	UAnimInstance* AnimInstance = GetMesh() ? GetMesh()->GetAnimInstance() : nullptr;
	if (!Anim || !AnimInstance || !bHasSkeletalVisual)
	{
		return 0.f;
	}
	if (UTPSProceduralAnimInstance* Proc = Cast<UTPSProceduralAnimInstance>(AnimInstance))
	{
		return Proc->PlayAction(Anim, PlayRate, Loops, bUpperBodyOnly, BlendIn, BlendOut, FVector::ZeroVector, false);
	}
	const float Rate = FMath::Max(PlayRate, 0.01f);
	if (UAnimMontage* AsMontage = Cast<UAnimMontage>(Anim))
	{
		const float Length = AnimInstance->Montage_Play(AsMontage, Rate);
		return Length > 0.f ? AsMontage->GetPlayLength() / Rate : 0.f;
	}
	const FName Slot = bUpperBodyOnly ? UTPSAnimInstance::UpperBodySlot : UTPSAnimInstance::FullBodySlot;
	const UAnimMontage* Montage = AnimInstance->PlaySlotAnimationAsDynamicMontage(Anim, Slot, BlendIn, BlendOut, Rate, FMath::Max(1, Loops));
	return Montage ? Anim->GetPlayLength() * FMath::Max(1, Loops) / Rate : 0.f;
}

void ATPSCharacter::StopActionAnim(float BlendOut)
{
	if (UTPSProceduralAnimInstance* Proc = GetProceduralAnim())
	{
		Proc->StopAction(BlendOut);
		return;
	}
	if (UAnimInstance* AnimInstance = GetMesh() ? GetMesh()->GetAnimInstance() : nullptr)
	{
		AnimInstance->Montage_Stop(BlendOut);
	}
}

void ATPSCharacter::SetActionAnimRate(float PlayRate)
{
	if (UTPSProceduralAnimInstance* Proc = GetProceduralAnim())
	{
		Proc->SetActionRate(PlayRate);
		return;
	}
	if (UAnimInstance* AnimInstance = GetMesh() ? GetMesh()->GetAnimInstance() : nullptr)
	{
		if (UAnimMontage* Current = AnimInstance->GetCurrentActiveMontage())
		{
			AnimInstance->Montage_SetPlayRate(Current, PlayRate);
		}
	}
}

void ATPSCharacter::SetActionAnimPaused(bool bPaused)
{
	if (UTPSProceduralAnimInstance* Proc = GetProceduralAnim())
	{
		Proc->SetActionPaused(bPaused);
		return;
	}
	if (UAnimInstance* AnimInstance = GetMesh() ? GetMesh()->GetAnimInstance() : nullptr)
	{
		if (UAnimMontage* Current = AnimInstance->GetCurrentActiveMontage())
		{
			if (bPaused)
			{
				AnimInstance->Montage_Pause(Current);
			}
			else
			{
				AnimInstance->Montage_Resume(Current);
			}
		}
	}
}

void ATPSCharacter::GetAimRay(FVector& OutStart, FVector& OutDir) const
{
	FRotator Rot;
	GetActorEyesViewPoint(OutStart, Rot);
	OutDir = Rot.Vector();
}

float ATPSCharacter::ReceiveWeaponHit(float BaseDamage, const FHitResult& Hit, ATPSCharacter* Shooter, bool& bOutKilled, ETPSHitZone& OutZone)
{
	OutZone = UTPSStatics::ResolveHitZone(Hit, this);
	const FVector Source = Shooter ? Shooter->GetActorLocation() : FVector(Hit.TraceStart);
	return ReceiveDirectDamage(ModifyIncomingDamage(BaseDamage, OutZone, Shooter), Source, OutZone, Shooter, bOutKilled);
}

float ATPSCharacter::ReceiveDirectDamage(float Damage, FVector SourceLocation, ETPSHitZone Zone, ATPSCharacter* Shooter, bool& bOutKilled)
{
	bOutKilled = false;
	if (IsDead())
	{
		return 0.f;
	}
	const float Applied = Health->ApplyDamage(Damage, SourceLocation, Zone, Shooter ? Shooter->GetController() : nullptr);
	bOutKilled = IsDead();
	if (Applied > 0.f && GetWorld())
	{
		LastHitTime = GetWorld()->GetTimeSeconds();
	}
	if (!bOutKilled && Applied > 0.f && AnimSet.HitReact && !(Traversal && Traversal->IsBusy()))
	{
		PlayActionAnim(AnimSet.HitReact, 1.f, 1, true, 0.05f, 0.15f);
	}
	return Applied;
}

float ATPSCharacter::TakeDamage(float DamageAmount, FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	const float Actual = Super::TakeDamage(DamageAmount, DamageEvent, EventInstigator, DamageCauser);
	if (Actual > 0.f)
	{
		const FVector Source = DamageCauser ? DamageCauser->GetActorLocation() : GetActorLocation();
		Health->ApplyDamage(Actual, Source, ETPSHitZone::Torso, EventInstigator);
	}
	return Actual;
}

void ATPSCharacter::HandleDeath(AActor* Victim, AController* Killer, bool bHeadshot)
{
	if (Combat)
	{
		Combat->OnOwnerDied();
	}
	if (Traversal)
	{
		Traversal->AbortTraversal();
	}
	if (bIsCrouched)
	{
		UnCrouch();
	}

	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->StopMovementImmediately();
	Move->DisableMovement();

	UCapsuleComponent* Capsule = GetCapsuleComponent();
	Capsule->SetCollisionResponseToChannel(ECC_Pawn, ECR_Ignore);
	Capsule->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
	Capsule->SetCollisionResponseToChannel(TPS_TRACE_WEAPON, ECR_Ignore);
	GetMesh()->SetCollisionResponseToChannel(TPS_TRACE_WEAPON, ECR_Ignore);

	if (bHasSkeletalVisual)
	{
		UAnimInstance* AnimInstance = GetMesh()->GetAnimInstance();
		if (AnimSet.Death && AnimInstance && !Cast<UTPSProceduralAnimInstance>(AnimInstance))
		{
			if (UAnimMontage* Montage = AnimInstance->PlaySlotAnimationAsDynamicMontage(AnimSet.Death, UTPSAnimInstance::FullBodySlot, 0.1f, 0.f, 1.f, 1))
			{
				Montage->bEnableAutoBlendOut = false;
			}
		}
		else if (GetMesh()->GetPhysicsAsset())
		{
			GetMesh()->SetCollisionProfileName(TEXT("Ragdoll"));
			GetMesh()->SetSimulatePhysics(true);
		}
	}
	else
	{
		DeathTipAlpha = 0.f;
	}

	if (CorpseLifeSpan > 0.f)
	{
		SetLifeSpan(CorpseLifeSpan);
	}
	OnCharacterDied.Broadcast(this);
}

bool ATPSCharacter::IsDead() const
{
	return Health && Health->IsDead();
}

float ATPSCharacter::GetMoveSpeedAlpha() const
{
	return RunSpeed > 0.f ? GetVelocity().Size2D() / RunSpeed : 0.f;
}

ATPSWeapon* ATPSCharacter::GetCurrentWeapon() const
{
	return Combat ? Combat->GetCurrentWeapon() : nullptr;
}

bool ATPSCharacter::IsAimingWeapon() const
{
	return Combat && Combat->IsAiming();
}

USceneComponent* ATPSCharacter::GetWeaponAttachParent(FName& OutSocket) const
{
	// The procedural animation places the weapon between the hands every frame (UTPSCombatComponent).
	if (bHasSkeletalVisual && !GetProceduralAnim() && WeaponSocket != NAME_None && GetMesh()->DoesSocketExist(WeaponSocket))
	{
		OutSocket = WeaponSocket;
		return GetMesh();
	}
	OutSocket = NAME_None;
	return WeaponHolder;
}
