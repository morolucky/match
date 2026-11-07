#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TPSAIDirector.generated.h"

class ATPSEnemyCharacter;
class ATPSCharacter;
class ATPSPickup;
class AController;

/**
 * VS AI wave director (web build director.js): wave w needs 3 + 2w kills, max alive min(2 + w, 5),
 * 2 simultaneous shooters before wave 3 then 3, spawn delays 0.8-2.0 s, 3.5 s break between waves,
 * accuracy/reaction scaling per wave, and pickups (up to 8) dropped on kills.
 */
UCLASS(Blueprintable)
class TPSENGINE_API ATPSAIDirector : public AActor
{
	GENERATED_BODY()

public:
	ATPSAIDirector();
	virtual void Tick(float DeltaSeconds) override;

	UFUNCTION(BlueprintCallable, Category = "TPS|Director") void StartWaves();
	UFUNCTION(BlueprintCallable, Category = "TPS|Director") void StopAll();

	bool RequestShooterSlot(AController* Shooter);
	void ReleaseShooterSlot(AController* Shooter);
	void ReportNoise(const FVector& Location, float Radius, AActor* NoiseInstigator);
	void ReportBulletPath(const FVector& Start, const FVector& End, AActor* ShotInstigator);

	UFUNCTION(BlueprintPure, Category = "TPS|Director") int32 GetWave() const { return Wave; }
	UFUNCTION(BlueprintPure, Category = "TPS|Director") int32 GetRemainingKills() const { return FMath::Max(0, ToKill - Killed); }
	UFUNCTION(BlueprintPure, Category = "TPS|Director") int32 GetAliveCount() const;
	UFUNCTION(BlueprintPure, Category = "TPS|Director") bool IsInBreak() const { return bInBreak; }
	UFUNCTION(BlueprintPure, Category = "TPS|Director") float GetBreakTimeLeft() const { return bInBreak ? BreakTimer : 0.f; }
	UFUNCTION(BlueprintPure, Category = "TPS|Director") bool IsRunning() const { return bRunning; }

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Director") TSubclassOf<ATPSEnemyCharacter> EnemyClass;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Director") TSubclassOf<ATPSPickup> PickupClass;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Director") float WaveBreakTime = 3.5f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Director") float FirstSpawnDelay = 1.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Director") int32 MaxAliveCap = 5;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Director") float PickupDropChance = 0.45f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Director") int32 MaxPickups = 8;
	/** Used when the level has no ATPSEnemySpawnPoint. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Director") float FallbackSpawnDistance = 2500.f;

protected:
	UFUNCTION() void HandleEnemyDied(ATPSCharacter* Character);

private:
	void BeginWave();
	void SpawnEnemy();
	bool FindSpawnTransform(FTransform& OutTransform) const;
	void DropPickup(const FVector& Location);

	bool bRunning = false;
	int32 Wave = 0;
	int32 ToKill = 0;
	int32 Killed = 0;
	int32 Spawned = 0;
	int32 MaxAlive = 3;
	int32 MaxShooters = 2;
	float Sigma = 0.034f;
	float React = 0.75f;
	int32 MissShots = 3;
	float SpawnTimer = 0.f;
	bool bInBreak = false;
	float BreakTimer = 0.f;

	UPROPERTY() TArray<TObjectPtr<ATPSEnemyCharacter>> Alive;
	TArray<TWeakObjectPtr<ATPSEnemyCharacter>> AllSpawned;
	TArray<TWeakObjectPtr<ATPSPickup>> Pickups;
	TSet<TWeakObjectPtr<AController>> Shooters;
};
