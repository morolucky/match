#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "Core/TPSTypes.h"
#include "TPSAnimInstance.generated.h"

class ATPSCharacter;

/**
 * Parent class for the character AnimBP (reparent your AnimBP to this).
 * Exposes everything the locomotion / aim / lean / ladder graph needs, and defines the two montage slots:
 *   "DefaultSlot" (full body: mantle, roll, ladder, death) and "UpperBody" (reload, fire, equip, hit react).
 */
UCLASS()
class TPSENGINE_API UTPSAnimInstance : public UAnimInstance
{
	GENERATED_BODY()

public:
	static const FName FullBodySlot;
	static const FName UpperBodySlot;

	virtual void NativeInitializeAnimation() override;
	virtual void NativeUpdateAnimation(float DeltaSeconds) override;

	UPROPERTY(BlueprintReadOnly, Category = "TPS|Owner") TObjectPtr<ATPSCharacter> Character;

	UPROPERTY(BlueprintReadOnly, Category = "TPS|Locomotion") float Speed = 0.f;
	/** -180..180, movement direction relative to facing (for strafe blend spaces). */
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Locomotion") float Direction = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Locomotion") bool bIsMoving = false;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Locomotion") bool bIsInAir = false;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Locomotion") bool bIsCrouching = false;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Locomotion") bool bIsRunning = false;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Locomotion") bool bIsTurningInPlace = false;
	/** Yaw from facing to aim (deg), for turn-in-place and aim offsets. */
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Locomotion") float TurnYawOffset = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "TPS|Aim") bool bIsAiming = false;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Aim") float AimAlpha = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Aim") float AimPitch = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Aim") float AimYaw = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Aim") bool bIsScoped = false;
	/** -1 (left) .. 1 (right). */
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Aim") float LeanAmount = 0.f;
	/** Spine roll for a "Transform (Modify) Bone" lean node, degrees. */
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Aim") float LeanAngle = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Aim") float MaxLeanAngle = 16.f;

	UPROPERTY(BlueprintReadOnly, Category = "TPS|Weapon") bool bHasWeapon = false;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Weapon") ETPSWeaponPoseType WeaponPose = ETPSWeaponPoseType::Rifle;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Weapon") bool bIsReloading = false;
	/** 0..1 kick, already scaled by the weapon's BodyK. */
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Weapon") float RecoilAlpha = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "TPS|Traversal") ETPSTraversalType TraversalType = ETPSTraversalType::None;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Traversal") bool bIsTraversing = false;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Traversal") bool bOnLadder = false;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Traversal") ETPSLadderPhase LadderPhase = ETPSLadderPhase::None;
	UPROPERTY(BlueprintReadOnly, Category = "TPS|Traversal") float LadderClimbRate = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "TPS|State") bool bIsDead = false;
};
