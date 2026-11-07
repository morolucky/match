#pragma once

#include "CoreMinimal.h"
#include "Characters/TPSCharacter.h"
#include "TPSEnemyCharacter.generated.h"

/** AI soldier. Takes head x4 / torso x1 / limb x0.65 damage and aims where its ATPSAIController tells it to. */
UCLASS(Blueprintable)
class TPSENGINE_API ATPSEnemyCharacter : public ATPSCharacter
{
	GENERATED_BODY()

public:
	ATPSEnemyCharacter(const FObjectInitializer& ObjectInitializer);

	virtual void BeginPlay() override;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|AI") float HeadMultiplier = 4.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|AI") float TorsoMultiplier = 1.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|AI") float LimbMultiplier = 0.65f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|AI") float AIReloadTime = 2.3f;

	void SetAimTarget(const FVector& Target) { AimTarget = Target; bHasAimTarget = true; }
	void ClearAimTarget() { bHasAimTarget = false; }
	bool HasAimTarget() const { return bHasAimTarget; }
	FVector GetAimTarget() const { return AimTarget; }

	virtual void GetAimRay(FVector& OutStart, FVector& OutDir) const override;
	virtual float GetSpreadScale() const override { return 0.f; }
	virtual float ModifyIncomingDamage(float BaseDamage, ETPSHitZone Zone, const ATPSCharacter* Shooter) const override;
	virtual float GetDesiredFacingYaw() const override;
	virtual bool WantsToFaceAim() const override { return bHasAimTarget; }

private:
	FVector AimTarget = FVector::ZeroVector;
	bool bHasAimTarget = false;
};
