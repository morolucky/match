#pragma once

#include "CoreMinimal.h"
#include "Characters/TPSCharacter.h"
#include "TPSPlayerCharacter.generated.h"

class USpringArmComponent;
class UCameraComponent;

/** Over-the-shoulder player: shoulder swap, aim zoom, scope, lean camera, regen health, footstep noise. */
UCLASS(Blueprintable)
class TPSENGINE_API ATPSPlayerCharacter : public ATPSCharacter
{
	GENERATED_BODY()

public:
	ATPSPlayerCharacter(const FObjectInitializer& ObjectInitializer);

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Camera") TObjectPtr<USpringArmComponent> CameraBoom;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Camera") TObjectPtr<UCameraComponent> FollowCamera;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float HipArmLength = 170.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float AimArmLength = 100.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float ShoulderOffset = 48.f;
	/** Camera height above the capsule center (web: 160 cm above the feet). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float CameraHeight = 72.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float RollArmExtra = 60.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float RollHeightDrop = 40.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float LeanCameraRoll = 4.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float CameraInterpSpeed = 10.f;
	/** Horizontal FOV used when the settings save is unavailable. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float DefaultFOV = 80.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Noise") float FootstepNoiseSpeed = 260.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Noise") float FootstepNoiseRadius = 900.f;

	UFUNCTION(BlueprintCallable, Category = "TPS|Camera") void SwapShoulder() { ShoulderSide = -ShoulderSide; }
	UFUNCTION(BlueprintPure, Category = "TPS|Camera") float GetShoulderSide() const { return ShoulderSide; }
	UFUNCTION(BlueprintPure, Category = "TPS|Camera") float GetHipFOV() const;

	/** Resets health, ammo, traversal and position for a new round. */
	void ResetForRound(const FTransform& SpawnTransform);

	virtual void GetAimRay(FVector& OutStart, FVector& OutDir) const override;
	virtual float ModifyIncomingDamage(float BaseDamage, ETPSHitZone Zone, const ATPSCharacter* Shooter) const override;
	virtual void OnWeaponFired(ATPSWeapon* Weapon) override;

private:
	float ShoulderSide = 1.f;
	float CurrentSide = 1.f;
	float NextFootstepNoise = 0.f;
};
