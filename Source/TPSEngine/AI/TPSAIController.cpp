#include "AI/TPSAIController.h"
#include "AI/TPSAIDirector.h"
#include "Core/TPSStatics.h"
#include "Characters/TPSEnemyCharacter.h"
#include "Characters/TPSPlayerCharacter.h"
#include "Components/TPSHealthComponent.h"
#include "Components/TPSCombatComponent.h"
#include "Weapons/TPSWeapon.h"
#include "World/TPSCoverPoint.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "Navigation/PathFollowingComponent.h"
#include "CollisionQueryParams.h"

namespace TPSAI
{
	static float Gauss()
	{
		const float U1 = FMath::Max(FMath::FRand(), 1e-6f);
		const float U2 = FMath::FRand();
		return FMath::Sqrt(-2.f * FMath::Loge(U1)) * FMath::Cos(2.f * PI * U2);
	}
}

ATPSAIController::ATPSAIController()
{
	PrimaryActorTick.bCanEverTick = true;
	bSetControlRotationFromPawnOrientation = true;
}

float ATPSAIController::Now() const
{
	const UWorld* World = GetWorld();
	return World ? World->GetTimeSeconds() : 0.f;
}

void ATPSAIController::SetDifficulty(float InSigma, float InReact, int32 InMissShots)
{
	// Per-soldier variation, as in the web build.
	Sigma = InSigma * Rand(0.85f, 1.2f);
	React = InReact * Rand(0.8f, 1.25f);
	MissShots = InMissShots;
}

void ATPSAIController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);
	ATPSEnemyCharacter* E = Cast<ATPSEnemyCharacter>(InPawn);
	Enemy = E;
	if (!E)
	{
		return;
	}
	HomeLocation = E->GetActorLocation();
	Seed = FMath::RandRange(0, 1000);
	E->Health->OnDamaged.AddDynamic(this, &ATPSAIController::HandleDamaged);
	E->OnCharacterDied.AddDynamic(this, &ATPSAIController::HandleDied);
	Player = UTPSStatics::GetTPSPlayer(this);
	SetState(ETPSAIState::Patrol);
}

void ATPSAIController::OnUnPossess()
{
	ReleaseCover();
	if (bHasShooterSlot && Director.IsValid())
	{
		Director->ReleaseShooterSlot(this);
	}
	bHasShooterSlot = false;
	Super::OnUnPossess();
}

FVector ATPSAIController::PlayerChest() const
{
	const ATPSPlayerCharacter* P = Player.Get();
	return P ? P->GetActorLocation() + FVector(0.f, 0.f, P->bIsCrouched ? 10.f : 30.f) : FVector::ZeroVector;
}

FVector ATPSAIController::PlayerHead() const
{
	const ATPSPlayerCharacter* P = Player.Get();
	return P ? P->GetPawnViewLocation() + FVector(0.f, 0.f, 6.f) : FVector::ZeroVector;
}

int32 ATPSAIController::GetAmmo() const
{
	const ATPSEnemyCharacter* E = Enemy.Get();
	const ATPSWeapon* Weapon = E ? E->GetCurrentWeapon() : nullptr;
	return Weapon ? Weapon->GetAmmo() : 0;
}

void ATPSAIController::AlertTo(const FVector& Location)
{
	LastKnownPos = Location;
	bHasLastKnown = true;
	if (State == ETPSAIState::Patrol || State == ETPSAIState::Idle || State == ETPSAIState::Search)
	{
		SetState(ETPSAIState::Hesitate);
	}
}

void ATPSAIController::OnHeardNoise(const FVector& Location, float Radius, AActor* NoiseInstigator)
{
	const ATPSEnemyCharacter* E = Enemy.Get();
	if (!E || E->IsDead() || !Cast<ATPSPlayerCharacter>(NoiseInstigator))
	{
		return;
	}
	if (FVector::Dist(E->GetActorLocation(), Location) <= Radius)
	{
		AlertTo(Location);
	}
}

void ATPSAIController::OnBulletPassed(const FVector& Start, const FVector& End, AActor* ShotInstigator)
{
	const ATPSEnemyCharacter* E = Enemy.Get();
	if (!E || E->IsDead() || !Cast<ATPSPlayerCharacter>(ShotInstigator))
	{
		return;
	}
	const FVector Chest = E->GetActorLocation() + FVector(0.f, 0.f, 30.f);
	if (FMath::PointDistToSegment(Chest, Start, End) < SuppressionRadius)
	{
		Suppression += 0.8f;
		AlertTo(ShotInstigator->GetActorLocation());
	}
}

void ATPSAIController::HandleDamaged(float Damage, FVector SourceLocation, ETPSHitZone Zone, AController* InstigatorController)
{
	Suppression += 1.2f;
	LastKnownPos = SourceLocation;
	bHasLastKnown = true;
	if (State == ETPSAIState::Patrol || State == ETPSAIState::Idle || State == ETPSAIState::Search || State == ETPSAIState::Hesitate)
	{
		SetState(ETPSAIState::Plan);
	}
}

void ATPSAIController::HandleDied(ATPSCharacter* Character)
{
	SetState(ETPSAIState::Dead);
}

// ---------------------------------------------------------------- Movement

void ATPSAIController::MoveToPoint(const FVector& Dest, bool bRun)
{
	ATPSEnemyCharacter* E = Enemy.Get();
	if (!E)
	{
		return;
	}
	MoveDest = Dest;
	bMoving = true;
	StuckTime = 0.f;
	E->SetRunning(bRun);
	const EPathFollowingRequestResult::Type Result = MoveToLocation(Dest, 30.f, true, true, false, true, nullptr, true);
	bSteering = Result == EPathFollowingRequestResult::Failed;
}

void ATPSAIController::StopMoving()
{
	StopMovement();
	bMoving = false;
	bSteering = false;
	StuckTime = 0.f;
}

bool ATPSAIController::HasArrived(float Radius) const
{
	const ATPSEnemyCharacter* E = Enemy.Get();
	if (!E)
	{
		return false;
	}
	const FVector Loc = E->GetActorLocation();
	return FVector::Dist2D(Loc, MoveDest) <= Radius && FMath::Abs(Loc.Z - MoveDest.Z) < 200.f;
}

void ATPSAIController::TickSteering(float DeltaSeconds)
{
	ATPSEnemyCharacter* E = Enemy.Get();
	UWorld* World = GetWorld();
	if (!E || !World)
	{
		return;
	}
	FVector To = MoveDest - E->GetActorLocation();
	To.Z = 0.f;
	if (To.Size() < 35.f)
	{
		bSteering = false;
		return;
	}
	const FVector Desired = To.GetSafeNormal();
	const FVector Knee = E->GetActorLocation() - FVector(0.f, 0.f, 40.f);
	FCollisionQueryParams Params(SCENE_QUERY_STAT(TPSAISteer), false, E);
	FVector Dir = Desired;
	static const float Angles[] = { 0.f, 35.f, -35.f, 70.f, -70.f, 110.f, -110.f };
	for (const float Angle : Angles)
	{
		const FVector Candidate = Desired.RotateAngleAxis(Angle, FVector::UpVector);
		if (!World->LineTraceTestByChannel(Knee, Knee + Candidate * 140.f, ECC_Visibility, Params))
		{
			Dir = Candidate;
			break;
		}
	}
	E->AddMovementInput(Dir, 1.f);
}

// ---------------------------------------------------------------- State machine

void ATPSAIController::SetState(ETPSAIState NewState)
{
	ATPSEnemyCharacter* E = Enemy.Get();
	const ETPSAIState Old = State;
	State = NewState;
	StateStart = Now();

	if (Old == ETPSAIState::Peek && NewState != ETPSAIState::Peek && bHasShooterSlot)
	{
		if (Director.IsValid())
		{
			Director->ReleaseShooterSlot(this);
		}
		bHasShooterSlot = false;
	}
	if (!E)
	{
		return;
	}

	switch (NewState)
	{
	case ETPSAIState::Patrol:
		ReleaseCover();
		E->UnCrouch();
		E->ClearAimTarget();
		MoveToPoint(HomeLocation + FVector(FMath::FRandRange(-1.f, 1.f), FMath::FRandRange(-1.f, 1.f), 0.f).GetSafeNormal() * Rand(200.f, PatrolRadius), false);
		break;
	case ETPSAIState::Hesitate:
		StopMoving();
		Timer = Rand(0.3f, 0.7f);
		if (bHasLastKnown)
		{
			E->SetAimTarget(LastKnownPos + FVector(0.f, 0.f, 60.f));
		}
		break;
	case ETPSAIState::Plan:
		StopMoving();
		Timer = Rand(0.55f, 0.95f);
		break;
	case ETPSAIState::Reload:
		Timer = 2.3f;
		bReloadStarted = false;
		break;
	case ETPSAIState::Search:
		ReleaseCover();
		E->UnCrouch();
		E->ClearAimTarget();
		MoveToPoint(bHasLastKnown ? LastKnownPos : HomeLocation, true);
		Timer = 7.f;
		break;
	case ETPSAIState::Dead:
		StopMoving();
		ReleaseCover();
		E->ClearAimTarget();
		if (E->Combat)
		{
			E->Combat->StopFire();
		}
		break;
	default:
		break;
	}
}

void ATPSAIController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	ATPSEnemyCharacter* E = Enemy.Get();
	if (!E)
	{
		return;
	}
	if (E->IsDead())
	{
		if (State != ETPSAIState::Dead)
		{
			SetState(ETPSAIState::Dead);
		}
		return;
	}
	if (!Player.IsValid())
	{
		Player = UTPSStatics::GetTPSPlayer(this);
	}

	UpdatePerception(DeltaSeconds);
	Suppression = FMath::Max(0.f, Suppression - 0.6f * DeltaSeconds);

	if (bMoving)
	{
		StuckTime = E->GetVelocity().Size2D() < 15.f ? StuckTime + DeltaSeconds : 0.f;
	}

	switch (State)
	{
	case ETPSAIState::Patrol: TickPatrol(); break;
	case ETPSAIState::Hesitate: TickHesitate(); break;
	case ETPSAIState::Plan: TickPlan(); break;
	case ETPSAIState::Move: TickMove(); break;
	case ETPSAIState::Cover: TickCover(); break;
	case ETPSAIState::Peek: TickPeek(); break;
	case ETPSAIState::Reload: TickReload(); break;
	case ETPSAIState::Search: TickSearch(); break;
	default: break;
	}

	if (bSteering)
	{
		TickSteering(DeltaSeconds);
	}
}

void ATPSAIController::UpdatePerception(float DeltaSeconds)
{
	const ATPSEnemyCharacter* E = Enemy.Get();
	const ATPSPlayerCharacter* P = Player.Get();
	UWorld* World = GetWorld();
	bVisible = false;
	bHeadOnly = false;

	if (E && P && World && !P->IsDead())
	{
		const FVector Eye = E->GetPawnViewLocation();
		const FVector ToHead = PlayerHead() - Eye;
		const float Dist = ToHead.Size();
		if (Dist <= SightRange && Dist > KINDA_SMALL_NUMBER)
		{
			const bool bRelaxed = State == ETPSAIState::Patrol || State == ETPSAIState::Idle;
			const float HalfFOV = FMath::DegreesToRadians(bRelaxed ? PatrolHalfFOV : AlertHalfFOV);
			const float CosAngle = FVector::DotProduct(E->GetActorForwardVector(), ToHead / Dist);
			if (CosAngle >= FMath::Cos(HalfFOV) || Dist < 250.f)
			{
				FCollisionQueryParams Params(SCENE_QUERY_STAT(TPSAISight), false, E);
				Params.AddIgnoredActor(P);
				const bool bHeadVisible = !World->LineTraceTestByChannel(Eye, PlayerHead(), ECC_Visibility, Params);
				const bool bChestVisible = !World->LineTraceTestByChannel(Eye, PlayerChest(), ECC_Visibility, Params);
				bVisible = bHeadVisible || bChestVisible;
				bHeadOnly = bHeadVisible && !bChestVisible;
			}
		}
	}

	if (bVisible)
	{
		LastSeenTime = Now();
		LastKnownPos = P->GetActorLocation();
		bHasLastKnown = true;
		AimT += DeltaSeconds;
		LostT = 0.f;
		if (State == ETPSAIState::Patrol || State == ETPSAIState::Idle || State == ETPSAIState::Search)
		{
			SetState(ETPSAIState::Hesitate);
		}
	}
	else
	{
		AimT = FMath::Max(0.f, AimT - 2.f * DeltaSeconds);
		LostT += DeltaSeconds;
	}
}

void ATPSAIController::TickPatrol()
{
	if (!bMoving || HasArrived(80.f) || StuckTime > 2.f)
	{
		SetState(ETPSAIState::Patrol);
	}
}

void ATPSAIController::TickHesitate()
{
	if (Now() - StateStart >= Timer)
	{
		SetState(ETPSAIState::Plan);
	}
}

void ATPSAIController::TickPlan()
{
	ATPSEnemyCharacter* E = Enemy.Get();
	if (bHasLastKnown)
	{
		E->SetAimTarget(LastKnownPos + FVector(0.f, 0.f, 60.f));
	}
	if (Now() - StateStart < Timer)
	{
		return;
	}

	if (ATPSCoverPoint* NewCover = ChooseCover())
	{
		ReleaseCover();
		Cover = NewCover;
		NewCover->Claim(E);
		PeeksLeft = FMath::RandRange(2, 3);
		E->UnCrouch();
		E->ClearAimTarget();
		SetState(ETPSAIState::Move);
		MoveToPoint(NewCover->GetActorLocation(), true);
		return;
	}

	// No usable cover: fight from here.
	PeeksLeft = 1;
	if (Suppression < 0.65f && Director.IsValid() && Director->RequestShooterSlot(this))
	{
		bHasShooterSlot = true;
		StartPeek();
	}
	else
	{
		SetState(ETPSAIState::Cover);
		Timer = Rand(0.5f, 1.f);
	}
}

void ATPSAIController::TickMove()
{
	ATPSEnemyCharacter* E = Enemy.Get();
	const ATPSCoverPoint* C = Cover.Get();
	if (HasArrived(60.f))
	{
		StopMoving();
		if (C && C->bLowCover)
		{
			E->Crouch();
		}
		SetState(ETPSAIState::Cover);
		Timer = Rand(0.25f, 0.55f);
		AimT = React * 0.4f;
		return;
	}
	if (StuckTime > 3.f || Now() - StateStart > 12.f)
	{
		SetState(ETPSAIState::Plan);
	}
}

void ATPSAIController::TickCover()
{
	ATPSEnemyCharacter* E = Enemy.Get();
	const ATPSCoverPoint* C = Cover.Get();
	const ATPSPlayerCharacter* P = Player.Get();

	if (bHasLastKnown)
	{
		E->SetAimTarget(LastKnownPos + FVector(0.f, 0.f, 60.f));
	}
	if (C && C->bLowCover && !E->bIsCrouched)
	{
		E->Crouch();
	}
	if (GetAmmo() <= 0)
	{
		SetState(ETPSAIState::Reload);
		return;
	}
	if (Now() - StateStart < Timer)
	{
		return;
	}
	if (!bVisible && Now() - LastSeenTime > 8.f)
	{
		SetState(ETPSAIState::Search);
		return;
	}

	const bool bFlanked = C && P && FVector::DotProduct(C->GetActorForwardVector(), (P->GetActorLocation() - C->GetActorLocation()).GetSafeNormal2D()) < 0.1f;
	if (!C || bFlanked || PeeksLeft <= 0)
	{
		SetState(ETPSAIState::Plan);
		return;
	}
	if (Suppression < 0.65f && Director.IsValid() && Director->RequestShooterSlot(this))
	{
		bHasShooterSlot = true;
		StartPeek();
		return;
	}
	StateStart = Now();
	Timer = Rand(0.2f, 0.8f);
}

void ATPSAIController::StartPeek()
{
	ATPSEnemyCharacter* E = Enemy.Get();
	const ATPSCoverPoint* C = Cover.Get();
	const ATPSPlayerCharacter* P = Player.Get();

	SetState(ETPSAIState::Peek);
	E->UnCrouch();
	if (C && !C->bLowCover)
	{
		MoveToPoint(C->GetPeekLocation(), false);
	}
	BurstLeft = 3 + FMath::RandRange(0, 2);
	BurstLimit = (P && P->Health->GetHealth() < 40.f) ? 1 : 1 + FMath::RandRange(0, 2);
	Bursts = 0;
	BurstIdx = 0;
	ShotsThisPeek = 0;
	AimT = AimT > 0.f ? FMath::Min(AimT, React * 0.45f) : 0.f;
	NextShotTime = Now();
}

void ATPSAIController::EndPeek()
{
	ATPSEnemyCharacter* E = Enemy.Get();
	const ATPSCoverPoint* C = Cover.Get();
	--PeeksLeft;
	if (C && !C->bLowCover)
	{
		MoveToPoint(C->GetActorLocation(), false);
	}
	SetState(ETPSAIState::Cover);
	Timer = Rand(0.75f, 1.65f) + Suppression;
	AimT = 0.f;
	if (C && C->bLowCover && E)
	{
		E->Crouch();
	}
}

void ATPSAIController::TickPeek()
{
	ATPSEnemyCharacter* E = Enemy.Get();
	const ATPSPlayerCharacter* P = Player.Get();
	if (!P || P->IsDead())
	{
		EndPeek();
		return;
	}
	E->SetAimTarget(PlayerChest());

	const float Elapsed = Now() - StateStart;
	if (Suppression > 1.8f || Elapsed > 4.5f || (Elapsed > 0.6f && LostT > 1.2f) || GetAmmo() <= 0)
	{
		EndPeek();
		return;
	}
	if (bVisible && AimT >= React && Now() >= NextShotTime)
	{
		FireOneShot();
		if (--BurstLeft <= 0)
		{
			++Bursts;
			++BurstIdx;
			if (Bursts >= BurstLimit)
			{
				EndPeek();
				return;
			}
			BurstLeft = 3 + FMath::RandRange(0, 2);
			NextShotTime = Now() + Rand(0.45f, 0.85f);
		}
		else
		{
			NextShotTime = Now() + Rand(0.095f, 0.13f);
		}
	}
}

void ATPSAIController::FireOneShot()
{
	ATPSEnemyCharacter* E = Enemy.Get();
	const ATPSPlayerCharacter* P = Player.Get();
	ATPSWeapon* Weapon = E ? E->GetCurrentWeapon() : nullptr;
	if (!Weapon || !P)
	{
		return;
	}
	const FVector Muzzle = Weapon->GetMuzzleLocation();
	const bool bAimHead = bHeadOnly || FMath::FRand() < 0.12f;
	FVector Target = (bAimHead ? PlayerHead() : PlayerChest()) + FVector(Rand(-6.f, 6.f), Rand(-6.f, 6.f), Rand(-10.f, 10.f));

	// Telegraph: the opening rounds of each peek land beside the player.
	if (ShotsThisPeek < MissShots)
	{
		const float Dist = FVector::Dist(Target, Muzzle);
		const FVector Side = FVector::CrossProduct(FVector::UpVector, (Target - Muzzle).GetSafeNormal()).GetSafeNormal();
		Target += Side * ((Seed % 2 == 0) ? 1.f : -1.f) * FMath::Clamp(Dist * 0.06f, 70.f, 150.f);
		Target.Z += Rand(-20.f, 20.f);
	}
	++ShotsThisPeek;

	FVector Dir = (Target - Muzzle).GetSafeNormal();
	float Sig = Sigma * (1.f + 1.8f * FMath::Exp(-AimT / 0.9f)) * (1.f + P->GetVelocity().Size2D() / 320.f) * (1.f + 0.15f * BurstIdx);
	Sig *= (P->bIsCrouched ? 1.35f : 1.f) * (bHeadOnly ? 1.35f : 1.f) * (P->Health->GetHealth() < 40.f ? 1.6f : 1.f);
	Dir = (Dir + FVector(TPSAI::Gauss(), TPSAI::Gauss(), TPSAI::Gauss()) * Sig).GetSafeNormal();

	E->SetAimTarget(Muzzle + Dir * 10000.f);
	Weapon->PullTrigger();
	Weapon->ReleaseTrigger();
}

void ATPSAIController::TickReload()
{
	ATPSEnemyCharacter* E = Enemy.Get();
	ATPSWeapon* Weapon = E->GetCurrentWeapon();
	const ATPSCoverPoint* C = Cover.Get();
	if (!bReloadStarted)
	{
		bReloadStarted = true;
		if (Weapon)
		{
			Weapon->StartReload();
		}
		if (C && C->bLowCover)
		{
			E->Crouch();
		}
	}
	if (Now() - StateStart >= Timer && (!Weapon || !Weapon->IsReloading()))
	{
		SetState(ETPSAIState::Cover);
		Timer = 0.3f;
	}
}

void ATPSAIController::TickSearch()
{
	ATPSEnemyCharacter* E = Enemy.Get();
	if (bMoving && (HasArrived(100.f) || StuckTime > 2.f))
	{
		StopMoving();
	}
	if (!bMoving)
	{
		// Look around the last known position.
		const float Yaw = E->GetActorRotation().Yaw + FMath::Sin((Now() - StateStart) * 1.5f) * 70.f;
		E->SetAimTarget(E->GetActorLocation() + FRotator(0.f, Yaw, 0.f).Vector() * 500.f + FVector(0.f, 0.f, 40.f));
	}
	if (Now() - StateStart > Timer)
	{
		HomeLocation = E->GetActorLocation();
		SetState(ETPSAIState::Patrol);
	}
}

void ATPSAIController::ReleaseCover()
{
	if (ATPSCoverPoint* C = Cover.Get())
	{
		C->Release(Enemy.Get());
	}
	Cover = nullptr;
}

ATPSCoverPoint* ATPSAIController::ChooseCover() const
{
	const ATPSEnemyCharacter* E = Enemy.Get();
	const ATPSPlayerCharacter* P = Player.Get();
	UWorld* World = GetWorld();
	if (!E || !World)
	{
		return nullptr;
	}
	const FVector Threat = bHasLastKnown ? LastKnownPos : (P ? P->GetActorLocation() : E->GetActorLocation() + E->GetActorForwardVector() * 1000.f);

	FCollisionQueryParams Params(SCENE_QUERY_STAT(TPSAICover), false, E);
	if (P)
	{
		Params.AddIgnoredActor(P);
	}

	ATPSCoverPoint* Best = nullptr;
	float BestScore = -TNumericLimits<float>::Max();
	for (TActorIterator<ATPSCoverPoint> It(World); It; ++It)
	{
		ATPSCoverPoint* C = *It;
		if (!C->bEnabled || C->IsClaimedByOther(E))
		{
			continue;
		}
		const FVector Loc = C->GetActorLocation();
		const float DSelf = FVector::Dist2D(Loc, E->GetActorLocation());
		const float DThreat = FVector::Dist2D(Loc, Threat);
		if (DSelf > 2600.f || DThreat < 500.f || DThreat > 3800.f)
		{
			continue;
		}
		const float Facing = FVector::DotProduct(C->GetActorForwardVector(), (Threat - Loc).GetSafeNormal2D());
		if (Facing < 0.35f)
		{
			continue;
		}
		const FVector HiddenEye = Loc + FVector(0.f, 0.f, C->bLowCover ? 70.f : 140.f);
		if (!World->LineTraceTestByChannel(HiddenEye, Threat + FVector(0.f, 0.f, 60.f), ECC_Visibility, Params))
		{
			continue;
		}
		float Score = Facing * 400.f - FMath::Abs(DThreat - 1500.f) * 0.3f - DSelf * 0.5f + FMath::FRand() * 120.f;
		if (C == Cover.Get())
		{
			Score -= 300.f;
		}
		if (Score > BestScore)
		{
			BestScore = Score;
			Best = C;
		}
	}
	return Best;
}
