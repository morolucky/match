#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/TPSTypes.h"
#include "TPSPickup.generated.h"

class USphereComponent;
class USoundBase;

/** Health (+35 HP) or ammo (refill all weapons) pickup dropped by enemies. */
UCLASS(Blueprintable)
class TPSENGINE_API ATPSPickup : public AActor
{
	GENERATED_BODY()

public:
	ATPSPickup();
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Pickup") TObjectPtr<USphereComponent> Trigger;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Pickup") TObjectPtr<USceneComponent> VisualRoot;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Pickup", meta = (ExposeOnSpawn = "true")) ETPSPickupType Type = ETPSPickupType::Health;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Pickup") float HealAmount = 35.f;
	/** Seconds before it disappears (0 = never). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Pickup") float Lifetime = 25.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Pickup") TObjectPtr<USoundBase> PickupSound;

protected:
	UFUNCTION() void OnOverlap(UPrimitiveComponent* OverlappedComp, AActor* OtherActor, UPrimitiveComponent* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult);

private:
	float Age = 0.f;
};
