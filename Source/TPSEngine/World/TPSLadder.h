#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TPSLadder.generated.h"

class UBoxComponent;
class UArrowComponent;

/**
 * Climbable ladder. Climbers stand at -X (ClimbOffset) facing +X and exit onto a platform at +X at the top.
 * Use F near the bottom or the top to climb; auto-climb toggles with F while on it.
 */
UCLASS(Blueprintable)
class TPSENGINE_API ATPSLadder : public AActor
{
	GENERATED_BODY()

public:
	ATPSLadder();

	virtual void OnConstruction(const FTransform& Transform) override;
	virtual void BeginPlay() override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Ladder") TObjectPtr<USceneComponent> Root;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Ladder") TObjectPtr<UBoxComponent> BottomTrigger;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Ladder") TObjectPtr<UBoxComponent> TopTrigger;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Ladder") TObjectPtr<UArrowComponent> ClimbDirection;

	/** Feet height at the top platform (web build: 86.49 + 150.71 + 215.86 = 453.06 cm). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Ladder") float Height = 453.06f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Ladder") float ClimbOffset = 38.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Ladder") float TopExitForward = 70.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Ladder") float Width = 50.f;
	/** Build rails and rungs from engine shapes (disable when using your own mesh). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Ladder") bool bBuildPlaceholderMesh = true;

	FVector GetClimbBase() const;
	FVector GetTopExit() const;
	float GetFacingYaw() const { return GetActorRotation().Yaw; }

private:
	void UpdateTriggers();
};
