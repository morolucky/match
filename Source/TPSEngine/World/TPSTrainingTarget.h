#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TPSTrainingTarget.generated.h"

class ATPSCharacter;
class UStaticMeshComponent;
class USoundBase;

UENUM(BlueprintType)
enum class ETPSTargetKind : uint8
{
	SteelPlate,
	Popper
};

/** Aim-trainer target: swinging steel plate (100 + distance/20 pts) or falling popper (100, head 150, resets after 2.6 s). */
UCLASS(Blueprintable)
class TPSENGINE_API ATPSTrainingTarget : public AActor
{
	GENERATED_BODY()

public:
	ATPSTrainingTarget();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	/** Returns true when the hit scored. */
	bool ReceiveShot(const FHitResult& Hit, ATPSCharacter* Shooter, bool& bOutHeadshot);

	UFUNCTION(BlueprintCallable, Category = "TPS|Target") void ResetTarget();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Target") TObjectPtr<USceneComponent> Root;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Target") TObjectPtr<USceneComponent> Pivot;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Target") ETPSTargetKind Kind = ETPSTargetKind::SteelPlate;
	/** Plate radius (cm). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Target") float PlateRadius = 22.f;
	/** Plate hinge height (cm). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Target") float HangHeight = 120.f;
	/** Side-to-side travel (cm, 0 = static). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Target") float MoveAmplitude = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Target") float MoveSpeed = 0.9f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Target") float PopperResetTime = 2.6f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Target") float PopperHeadHeight = 75.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Target") TObjectPtr<USoundBase> HitSound;

private:
	void Build();

	FVector BaseLocation = FVector::ZeroVector;
	float Phase = 0.f;
	float SwingAngle = 0.f;
	float SwingVelocity = 0.f;
	bool bDown = false;
	float DownTimer = 0.f;
	float FallAngle = 0.f;
	bool bBuilt = false;
};
