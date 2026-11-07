#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TPSCoverPoint.generated.h"

class UArrowComponent;

/**
 * A spot AI can take cover at. The arrow (actor forward) points at the cover object, i.e. toward expected threats.
 * Low cover: crouch to hide, stand to shoot. Tall cover: step PeekOffset sideways to shoot.
 */
UCLASS(Blueprintable)
class TPSENGINE_API ATPSCoverPoint : public AActor
{
	GENERATED_BODY()

public:
	ATPSCoverPoint();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Cover") TObjectPtr<USceneComponent> Root;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Cover") TObjectPtr<UArrowComponent> Arrow;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Cover") bool bEnabled = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Cover") bool bLowCover = true;
	/** Local offset of the shooting position (tall cover). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Cover", meta = (MakeEditWidget = "true")) FVector PeekOffset = FVector::ZeroVector;

	FVector GetPeekLocation() const { return GetActorTransform().TransformPosition(PeekOffset); }
	bool IsClaimedByOther(const AActor* By) const { return Occupant.IsValid() && Occupant.Get() != By; }
	void Claim(AActor* By) { Occupant = By; }
	void Release(const AActor* By) { if (Occupant.Get() == By) { Occupant = nullptr; } }

private:
	TWeakObjectPtr<AActor> Occupant;
};

/** Where the AI director spawns enemies. */
UCLASS(Blueprintable)
class TPSENGINE_API ATPSEnemySpawnPoint : public AActor
{
	GENERATED_BODY()

public:
	ATPSEnemySpawnPoint();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Spawn") TObjectPtr<USceneComponent> Root;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Spawn") TObjectPtr<UArrowComponent> Arrow;
};
