#pragma once

#include "CoreMinimal.h"
#include "AIController.h"
#include "Core/TPSTypes.h"
#include "TPSAIController.generated.h"

class ATPSEnemyCharacter;
class ATPSPlayerCharacter;
class ATPSCoverPoint;
class ATPSAIDirector;

/**
 * Tactical squad AI ported from the web build (ai.js):
 * Patrol -> (sight / gunfire / footsteps) Hesitate -> Plan -> Move to cover -> Cover <-> Peek (bursts) -> Reload,
 * Search the last known position when contact is lost. Respects the director's simultaneous-shooter limit,
 * suppression, reaction time, wave-scaled accuracy and deliberate opening misses.
 * Uses the navmesh when present and falls back to obstacle-avoiding steering when there is none.
 */
UCLASS()
class TPSENGINE_API ATPSAIController : public AAIController
{
	GENERATED_BODY()

public:
	ATPSAIController();

	virtual void OnPossess(APawn* InPawn) override;
	virtual void OnUnPossess() override;
	virtual void Tick(float DeltaSeconds) override;

	/** Difficulty from the director (spread sigma in radians, reaction seconds, opening misses). */
	void SetDifficulty(float InSigma, float InReact, int32 InMissShots);
	void SetDirector(ATPSAIDirector* InDirector);
	void AlertTo(const FVector& Location);

	void OnHeardNoise(const FVector& Location, float Radius, AActor* NoiseInstigator);
	void OnBulletPassed(const FVector& Start, const FVector& End, AActor* ShotInstigator);

	UFUNCTION(BlueprintPure, Category = "TPS|AI") ETPSAIState GetAIState() const { return State; }
	UFUNCTION(BlueprintPure, Category = "TPS|AI") float GetSuppression() const { return Suppression; }
	UFUNCTION(BlueprintPure, Category = "TPS|AI") bool CanSeePlayer() const { return bVisible; }

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|AI") float SightRange = 6000.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|AI") float PatrolHalfFOV = 70.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|AI") float AlertHalfFOV = 93.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|AI") float MemoryTime = 2.8f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|AI") float SuppressionRadius = 250.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|AI") float PatrolRadius = 900.f;

protected:
	UFUNCTION() void HandleDamaged(float Damage, FVector SourceLocation, ETPSHitZone Zone, AController* InstigatorController);
	UFUNCTION() void HandleDied(ATPSCharacter* Character);

private:
	void SetState(ETPSAIState NewState);
	void UpdatePerception(float DeltaSeconds);
	void TickPatrol();
	void TickHesitate();
	void TickPlan();
	void TickMove();
	void TickCover();
	void TickPeek();
	void TickReload();
	void TickSearch();
	void StartPeek();
	void EndPeek();
	void FireOneShot();
	ATPSCoverPoint* ChooseCover() const;
	void MoveToPoint(const FVector& Dest, bool bRun);
	void StopMoving();
	bool HasArrived(float Radius) const;
	void TickSteering(float DeltaSeconds);
	void ReleaseCover();
	float Rand(float Min, float Max) const { return FMath::FRandRange(Min, Max); }
	float Now() const;
	FVector PlayerChest() const;
	FVector PlayerHead() const;
	int32 GetAmmo() const;

	TWeakObjectPtr<ATPSEnemyCharacter> Enemy;
	TWeakObjectPtr<ATPSPlayerCharacter> Player;
	TWeakObjectPtr<ATPSAIDirector> Director;
	TWeakObjectPtr<ATPSCoverPoint> Cover;

	ETPSAIState State = ETPSAIState::Idle;
	float StateStart = 0.f;
	float Timer = 0.f;

	float Sigma = 0.034f;
	float React = 0.75f;
	int32 MissShots = 3;
	int32 Seed = 0;

	bool bVisible = false;
	bool bHeadOnly = false;
	float LastSeenTime = -100.f;
	float AimT = 0.f;
	float LostT = 0.f;
	FVector LastKnownPos = FVector::ZeroVector;
	bool bHasLastKnown = false;
	float Suppression = 0.f;

	FVector HomeLocation = FVector::ZeroVector;
	FVector MoveDest = FVector::ZeroVector;
	bool bMoving = false;
	bool bSteering = false;
	float StuckTime = 0.f;

	int32 PeeksLeft = 0;
	int32 BurstLeft = 0;
	int32 Bursts = 0;
	int32 BurstLimit = 1;
	int32 BurstIdx = 0;
	int32 ShotsThisPeek = 0;
	float NextShotTime = 0.f;
	bool bHasShooterSlot = false;
	bool bReloadStarted = false;
};
