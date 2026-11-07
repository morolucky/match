#include "Animation/TPSAnimInstance.h"
#include "Characters/TPSCharacter.h"
#include "Components/TPSCombatComponent.h"
#include "Components/TPSTraversalComponent.h"
#include "Weapons/TPSWeapon.h"
#include "GameFramework/CharacterMovementComponent.h"

const FName UTPSAnimInstance::FullBodySlot(TEXT("DefaultSlot"));
const FName UTPSAnimInstance::UpperBodySlot(TEXT("UpperBody"));

void UTPSAnimInstance::NativeInitializeAnimation()
{
	Super::NativeInitializeAnimation();
	Character = Cast<ATPSCharacter>(TryGetPawnOwner());
}

void UTPSAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
	Super::NativeUpdateAnimation(DeltaSeconds);

	if (!Character)
	{
		Character = Cast<ATPSCharacter>(TryGetPawnOwner());
		if (!Character)
		{
			return;
		}
	}

	const FVector Velocity = Character->GetVelocity();
	const FRotator ActorRot = Character->GetActorRotation();
	Speed = Velocity.Size2D();
	bIsMoving = Speed > 5.f;
	Direction = bIsMoving ? FRotator::NormalizeAxis(Velocity.Rotation().Yaw - ActorRot.Yaw) : 0.f;
	bIsInAir = Character->GetCharacterMovement() && Character->GetCharacterMovement()->IsFalling();
	bIsCrouching = Character->bIsCrouched;
	bIsRunning = Character->IsRunning();
	bIsTurningInPlace = Character->IsTurningInPlace();

	const FRotator Aim = Character->GetAnimAimRotation();
	AimPitch = FRotator::NormalizeAxis(Aim.Pitch);
	AimYaw = FRotator::NormalizeAxis(Aim.Yaw - ActorRot.Yaw);
	TurnYawOffset = AimYaw;

	LeanAmount = Character->GetLeanAmount();
	LeanAngle = LeanAmount * MaxLeanAngle;
	bIsDead = Character->IsDead();

	if (const UTPSCombatComponent* Combat = Character->Combat)
	{
		bIsAiming = Combat->IsAiming();
		AimAlpha = Combat->GetAimAlpha();
		bIsScoped = Combat->IsScoped();
		const ATPSWeapon* Weapon = Combat->GetCurrentWeapon();
		bHasWeapon = Weapon != nullptr;
		if (Weapon)
		{
			WeaponPose = Weapon->Stats.PoseType;
			bIsReloading = Weapon->IsReloading();
			RecoilAlpha = Weapon->GetRecoilAlpha() * Weapon->Stats.Recoil.BodyK;
		}
		else
		{
			bIsReloading = false;
			RecoilAlpha = 0.f;
		}
	}

	if (const UTPSTraversalComponent* Traversal = Character->Traversal)
	{
		TraversalType = Traversal->GetTraversalType();
		bIsTraversing = Traversal->IsBusy();
		bOnLadder = Traversal->IsOnLadder();
		LadderPhase = Traversal->GetLadderPhase();
		LadderClimbRate = Traversal->GetLadderClimbRate();
	}
}
