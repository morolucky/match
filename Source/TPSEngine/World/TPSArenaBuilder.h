#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/TPSTypes.h"
#include "TPSArenaBuilder.generated.h"

class UStaticMeshComponent;
class ATPSTrainingTarget;
class ATPSCoverPoint;
class ATPSEnemySpawnPoint;
class ATPSLadder;

/** Solid colored box used for floors, walls and cover. Affects navigation. */
UCLASS(NotBlueprintable)
class TPSENGINE_API ATPSArenaBlock : public AActor
{
	GENERATED_BODY()

public:
	ATPSArenaBlock();
	void Setup(const FVector& Size, const FLinearColor& Color);
	void SetActive(bool bActive);

	UPROPERTY(VisibleAnywhere, Category = "TPS|Arena") TObjectPtr<UStaticMeshComponent> Mesh;
};

/**
 * Builds the web build's arena from engine shapes: floor, boundary, lighting, ladder tower, the 15 cover pieces
 * (with AI cover points), enemy spawn points and the aim-trainer plates/poppers.
 * Place one in your level to customise flags, or let ATPSGameMode spawn it in an empty level.
 */
UCLASS(Blueprintable)
class TPSENGINE_API ATPSArenaBuilder : public AActor
{
	GENERATED_BODY()

public:
	ATPSArenaBuilder();

	virtual void BeginPlay() override;

	/** Idempotent. Called automatically at BeginPlay. */
	UFUNCTION(BlueprintCallable, Category = "TPS|Arena") void BuildArena();
	/** Shows the cover set in VS AI and the targets in the aim trainer. */
	UFUNCTION(BlueprintCallable, Category = "TPS|Arena") void ApplyMode(ETPSGameModeType Mode);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Arena") bool bBuildFloor = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Arena") bool bBuildLighting = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Arena") bool bBuildLadder = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Arena") bool bBuildCover = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Arena") bool bBuildTargets = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Arena") bool bBuildSpawnPoints = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Arena") FLinearColor FloorColor = FLinearColor(0.32f, 0.33f, 0.3f);

	/** Spawns lights/atmosphere and a PlayerStart if the world has none. Safe to call from InitGame. */
	static void EnsureWorldBasics(UWorld* World);

private:
	ATPSArenaBlock* SpawnBlock(const FVector& Center, const FVector& Size, float Yaw, const FLinearColor& Color);

	bool bBuilt = false;
	UPROPERTY() TArray<TObjectPtr<AActor>> CoverActors;
	UPROPERTY() TArray<TObjectPtr<AActor>> TargetActors;
};
