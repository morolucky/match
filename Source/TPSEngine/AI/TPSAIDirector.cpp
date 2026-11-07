#include "AI/TPSAIDirector.h"
#include "AI/TPSAIController.h"
#include "Core/TPSStatics.h"
#include "Core/TPSGameMode.h"
#include "Characters/TPSEnemyCharacter.h"
#include "Characters/TPSPlayerCharacter.h"
#include "Components/TPSHealthComponent.h"
#include "World/TPSCoverPoint.h"
#include "World/TPSPickup.h"
#include "Engine/World.h"
#include "EngineUtils.h"

ATPSAIDirector::ATPSAIDirector()
{
	PrimaryActorTick.bCanEverTick = true;
	EnemyClass = ATPSEnemyCharacter::StaticClass();
	PickupClass = ATPSPickup::StaticClass();
}

int32 ATPSAIDirector::GetAliveCount() const
{
	return Alive.Num();
}

void ATPSAIDirector::StartWaves()
{
	StopAll();
	bRunning = true;
	Wave = 0;
	BeginWave();
}

void ATPSAIDirector::StopAll()
{
	bRunning = false;
	bInBreak = false;
	for (const TWeakObjectPtr<ATPSEnemyCharacter>& Enemy : AllSpawned)
	{
		if (Enemy.IsValid())
		{
			if (AController* C = Enemy->GetController())
			{
				C->Destroy();
			}
			Enemy->Destroy();
		}
	}
	for (const TWeakObjectPtr<ATPSPickup>& Pickup : Pickups)
	{
		if (Pickup.IsValid())
		{
			Pickup->Destroy();
		}
	}
	AllSpawned.Reset();
	Alive.Reset();
	Pickups.Reset();
	Shooters.Reset();
}

void ATPSAIDirector::BeginWave()
{
	++Wave;
	const int32 W = Wave;
	ToKill = 3 + 2 * W;
	Killed = 0;
	Spawned = 0;
	MaxAlive = FMath::Min(2 + W, MaxAliveCap);
	MaxShooters = W < 3 ? 2 : 3;
	Sigma = FMath::Max(0.015f, 0.034f - 0.0028f * (W - 1));
	React = FMath::Max(0.3f, 0.75f - 0.06f * (W - 1));
	MissShots = W < 3 ? 3 : (W < 6 ? 2 : 1);
	SpawnTimer = FirstSpawnDelay;
	bInBreak = false;
	Shooters.Reset();

	if (ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
	{
		GM->NotifyWaveStarted(Wave);
	}
}

void ATPSAIDirector::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!bRunning)
	{
		return;
	}

	if (bInBreak)
	{
		BreakTimer -= DeltaSeconds;
		if (BreakTimer <= 0.f)
		{
			BeginWave();
		}
		return;
	}

	Alive.RemoveAll([](const TObjectPtr<ATPSEnemyCharacter>& E) { return !IsValid(E) || E->IsDead(); });

	if (Spawned < ToKill && Alive.Num() < MaxAlive)
	{
		SpawnTimer -= DeltaSeconds;
		if (SpawnTimer <= 0.f)
		{
			SpawnEnemy();
			SpawnTimer = FMath::FRandRange(0.8f, 2.f);
		}
	}

	if (Killed >= ToKill && Alive.Num() == 0)
	{
		bInBreak = true;
		BreakTimer = WaveBreakTime;
		if (ATPSPlayerCharacter* Player = UTPSStatics::GetTPSPlayer(this))
		{
			Player->Health->Heal(Player->Health->GetMaxHealth());
		}
		if (ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
		{
			GM->NotifyWaveCleared(Wave, true);
		}
	}
}

bool ATPSAIDirector::FindSpawnTransform(FTransform& OutTransform) const
{
	UWorld* World = GetWorld();
	const ATPSPlayerCharacter* Player = UTPSStatics::GetTPSPlayer(this);
	const FVector PlayerLoc = Player ? Player->GetActorLocation() : FVector::ZeroVector;

	// Prefer far spawn points the player cannot see.
	TArray<TPair<float, const AActor*>> Candidates;
	for (TActorIterator<ATPSEnemySpawnPoint> It(World); It; ++It)
	{
		float Score = FVector::Dist2D(It->GetActorLocation(), PlayerLoc) + FMath::FRand() * 900.f;
		if (Player)
		{
			FCollisionQueryParams Params(SCENE_QUERY_STAT(TPSSpawnLOS), false, Player);
			if (!World->LineTraceTestByChannel(Player->GetPawnViewLocation(), It->GetActorLocation() + FVector(0.f, 0.f, 120.f), ECC_Visibility, Params))
			{
				Score -= 1500.f;
			}
		}
		Candidates.Add(TPair<float, const AActor*>(Score, *It));
	}
	if (Candidates.Num() > 0)
	{
		Candidates.Sort([](const TPair<float, const AActor*>& A, const TPair<float, const AActor*>& B) { return A.Key > B.Key; });
		const AActor* Chosen = Candidates[FMath::RandRange(0, FMath::Min(1, Candidates.Num() - 1))].Value;
		OutTransform = FTransform(Chosen->GetActorRotation(), Chosen->GetActorLocation() + FVector(0.f, 0.f, 100.f));
		return true;
	}

	// No spawn points placed: ring around the player.
	const FVector Dir = FRotator(0.f, FMath::FRandRange(0.f, 360.f), 0.f).Vector();
	OutTransform = FTransform((-Dir).Rotation(), PlayerLoc + Dir * FallbackSpawnDistance + FVector(0.f, 0.f, 100.f));
	return true;
}

void ATPSAIDirector::SpawnEnemy()
{
	UWorld* World = GetWorld();
	FTransform SpawnTransform;
	if (!World || !EnemyClass || !FindSpawnTransform(SpawnTransform))
	{
		return;
	}
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButDontSpawnIfColliding;
	ATPSEnemyCharacter* Enemy = World->SpawnActor<ATPSEnemyCharacter>(EnemyClass, SpawnTransform, Params);
	if (!Enemy)
	{
		return;
	}
	if (!Enemy->GetController())
	{
		Enemy->SpawnDefaultController();
	}
	++Spawned;
	Alive.Add(Enemy);
	AllSpawned.Add(Enemy);
	Enemy->OnCharacterDied.AddDynamic(this, &ATPSAIDirector::HandleEnemyDied);

	if (ATPSAIController* AI = Cast<ATPSAIController>(Enemy->GetController()))
	{
		AI->SetDirector(this);
		AI->SetDifficulty(Sigma, React, MissShots);
		// Later waves arrive already hunting the player.
		const ATPSPlayerCharacter* Player = UTPSStatics::GetTPSPlayer(this);
		if (Player && (Wave > 1 || FMath::FRand() < 0.5f))
		{
			AI->AlertTo(Player->GetActorLocation());
		}
	}
}

void ATPSAIDirector::HandleEnemyDied(ATPSCharacter* Character)
{
	++Killed;
	if (ATPSEnemyCharacter* Enemy = Cast<ATPSEnemyCharacter>(Character))
	{
		Alive.Remove(Enemy);
		if (FMath::FRand() < PickupDropChance)
		{
			DropPickup(Enemy->GetActorLocation());
		}
	}
}

void ATPSAIDirector::DropPickup(const FVector& Location)
{
	Pickups.RemoveAll([](const TWeakObjectPtr<ATPSPickup>& P) { return !P.IsValid(); });
	UWorld* World = GetWorld();
	if (!World || !PickupClass || Pickups.Num() >= MaxPickups)
	{
		return;
	}
	const ATPSPlayerCharacter* Player = UTPSStatics::GetTPSPlayer(this);
	const bool bHurt = Player && Player->Health->GetHealthPercent() < 0.7f;
	const ETPSPickupType Type = (bHurt || FMath::FRand() < 0.5f) ? ETPSPickupType::Health : ETPSPickupType::Ammo;

	const FTransform T(FRotator::ZeroRotator, Location - FVector(0.f, 0.f, 40.f));
	if (ATPSPickup* Pickup = World->SpawnActorDeferred<ATPSPickup>(PickupClass, T, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn))
	{
		Pickup->Type = Type;
		Pickup->FinishSpawning(T);
		Pickups.Add(Pickup);
	}
}

bool ATPSAIDirector::RequestShooterSlot(AController* Shooter)
{
	for (auto It = Shooters.CreateIterator(); It; ++It)
	{
		if (!It->IsValid())
		{
			It.RemoveCurrent();
		}
	}
	if (Shooters.Contains(Shooter))
	{
		return true;
	}
	if (Shooters.Num() < MaxShooters)
	{
		Shooters.Add(Shooter);
		return true;
	}
	return false;
}

void ATPSAIDirector::ReleaseShooterSlot(AController* Shooter)
{
	Shooters.Remove(Shooter);
}

void ATPSAIDirector::ReportNoise(const FVector& Location, float Radius, AActor* NoiseInstigator)
{
	for (const TObjectPtr<ATPSEnemyCharacter>& Enemy : Alive)
	{
		if (IsValid(Enemy))
		{
			if (ATPSAIController* AI = Cast<ATPSAIController>(Enemy->GetController()))
			{
				AI->OnHeardNoise(Location, Radius, NoiseInstigator);
			}
		}
	}
}

void ATPSAIDirector::ReportBulletPath(const FVector& Start, const FVector& End, AActor* ShotInstigator)
{
	for (const TObjectPtr<ATPSEnemyCharacter>& Enemy : Alive)
	{
		if (IsValid(Enemy))
		{
			if (ATPSAIController* AI = Cast<ATPSAIController>(Enemy->GetController()))
			{
				AI->OnBulletPassed(Start, End, ShotInstigator);
			}
		}
	}
}
