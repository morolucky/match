#include "Components/TPSTraversalComponent.h"
#include "Characters/TPSCharacter.h"
#include "Components/TPSCombatComponent.h"
#include "World/TPSLadder.h"
#include "Weapons/TPSWeapon.h"
#include "Animation/AnimSequenceBase.h"
#include "Components/BoxComponent.h"
#include "Components/CapsuleComponent.h"
#include "Engine/World.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/Controller.h"
#include "GameFramework/RootMotionSource.h"
#include "CollisionQueryParams.h"

UTPSTraversalComponent::UTPSTraversalComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
}

ATPSCharacter* UTPSTraversalComponent::GetOwnerCharacter() const
{
	return Cast<ATPSCharacter>(GetOwner());
}

float UTPSTraversalComponent::GetHalfHeight() const
{
	// Standing half height (destinations are always reached standing, even if crouched now).
	const ATPSCharacter* C = GetOwnerCharacter();
	const ACharacter* CDO = C ? C->GetClass()->GetDefaultObject<ACharacter>() : nullptr;
	return CDO && CDO->GetCapsuleComponent() ? CDO->GetCapsuleComponent()->GetUnscaledCapsuleHalfHeight() : 88.f;
}

float UTPSTraversalComponent::GetTraversalAlpha() const
{
	const UWorld* World = GetWorld();
	if (!World || Duration <= 0.f)
	{
		return 0.f;
	}
	return FMath::Clamp((World->GetTimeSeconds() - StartTime) / Duration, 0.f, 1.f);
}

float UTPSTraversalComponent::PlayClip(UAnimSequenceBase* Clip, float FallbackTime, float Rate, int32 Loops)
{
	ATPSCharacter* C = GetOwnerCharacter();
	if (!C || !Clip)
	{
		return FallbackTime;
	}
	if (Loops > 1)
	{
		C->PlayActionAnim(Clip, Rate, Loops, false, 0.15f, 0.2f);
		return FallbackTime;
	}
	if (!bUseClipLength && FallbackTime > 0.f)
	{
		C->PlayActionAnim(Clip, Clip->GetPlayLength() / FallbackTime, 1, false, 0.12f, 0.2f);
		return FallbackTime;
	}
	const float Length = C->PlayActionAnim(Clip, Rate, 1, false, 0.12f, 0.2f);
	return Length > 0.f ? Length : FallbackTime;
}

void UTPSTraversalComponent::Begin(ETPSTraversalType NewType, float InDuration)
{
	ATPSCharacter* C = GetOwnerCharacter();
	if (C && C->Combat)
	{
		C->Combat->StopFire();
		if (ATPSWeapon* Weapon = C->Combat->GetCurrentWeapon())
		{
			Weapon->CancelReload();
		}
	}
	Type = NewType;
	StartTime = GetWorld()->GetTimeSeconds();
	Duration = InDuration;
	OnTraversalChanged.Broadcast(Type);
}

void UTPSTraversalComponent::Finish()
{
	ATPSCharacter* C = GetOwnerCharacter();
	if (C)
	{
		UCharacterMovementComponent* Move = C->GetCharacterMovement();
		if (RootMotionId != 0)
		{
			Move->RemoveRootMotionSourceByID(RootMotionId);
			RootMotionId = 0;
		}
		if (Move->MovementMode == MOVE_None || Move->MovementMode == MOVE_Flying)
		{
			Move->SetMovementMode(MOVE_Walking);
		}
	}
	if (Type == ETPSTraversalType::Ladder)
	{
		Ladder = nullptr;
		LadderPhase = ETPSLadderPhase::None;
		LadderRate = 0.f;
		LadderLoopDir = 0;
		if (C)
		{
			C->StopActionAnim(0.2f);
		}
	}
	Type = ETPSTraversalType::None;
	Duration = 0.f;
	OnTraversalChanged.Broadcast(Type);
}

void UTPSTraversalComponent::AbortTraversal()
{
	if (IsBusy())
	{
		Finish();
	}
}

bool UTPSTraversalComponent::TryTraverse(FVector MoveDir)
{
	const ATPSCharacter* C = GetOwnerCharacter();
	if (!C || IsBusy() || C->IsDead())
	{
		return false;
	}
	MoveDir.Z = 0.f;
	const FVector Dir = MoveDir.IsNearlyZero() ? C->GetActorForwardVector() : MoveDir.GetSafeNormal();
	return TryMantle(Dir) || TryDiveRoll(Dir) || TryDodgeRoll(Dir);
}

bool UTPSTraversalComponent::TryMantle(FVector Dir)
{
	ATPSCharacter* C = GetOwnerCharacter();
	UWorld* World = GetWorld();
	if (!C || !World || IsBusy() || !C->GetCharacterMovement()->IsMovingOnGround())
	{
		return false;
	}
	const float Half = GetHalfHeight();
	const float CurHalf = C->GetCapsuleComponent()->GetScaledCapsuleHalfHeight();
	const float Radius = C->GetCapsuleComponent()->GetUnscaledCapsuleRadius();
	const FVector Loc = C->GetActorLocation();
	const FVector Feet = Loc - FVector(0.f, 0.f, CurHalf);
	Dir.Z = 0.f;
	const FVector Fwd = Dir.IsNearlyZero() ? C->GetActorForwardVector().GetSafeNormal2D() : Dir.GetSafeNormal();

	FCollisionQueryParams Params(SCENE_QUERY_STAT(TPSMantle), false, C);

	// 1. Wall in front, scanning from knee height up.
	FHitResult Wall;
	bool bWall = false;
	for (float H = 40.f; H <= MaxMantleHeight; H += 40.f)
	{
		const FVector S = Feet + FVector(0.f, 0.f, H);
		if (World->LineTraceSingleByChannel(Wall, S, S + Fwd * MantleReach, ECC_Visibility, Params) &&
			FVector::DotProduct(Wall.ImpactNormal.GetSafeNormal2D(), -Fwd) > 0.5f)
		{
			bWall = true;
			break;
		}
	}
	if (!bWall)
	{
		return false;
	}

	// 2. Ledge top.
	const FVector Into = -Wall.ImpactNormal.GetSafeNormal2D();
	const FVector DownStart = FVector(Wall.ImpactPoint.X, Wall.ImpactPoint.Y, Feet.Z + MaxMantleHeight + 40.f) + Into * 35.f;
	const FVector DownEnd = FVector(DownStart.X, DownStart.Y, Feet.Z + MinMantleHeight - 10.f);
	FHitResult Top;
	if (!World->LineTraceSingleByChannel(Top, DownStart, DownEnd, ECC_Visibility, Params) || Top.bStartPenetrating || Top.ImpactNormal.Z < 0.7f)
	{
		return false;
	}
	const float Height = Top.ImpactPoint.Z - Feet.Z;
	if (Height < MinMantleHeight || Height > MaxMantleHeight)
	{
		return false;
	}

	// 3. Room to stand on top, and headroom for the climb.
	const FVector Dest = FVector(Top.ImpactPoint) + FVector(0.f, 0.f, Half + 2.f);
	if (World->OverlapBlockingTestByChannel(Dest, FQuat::Identity, ECC_Pawn, FCollisionShape::MakeCapsule(Radius, Half), Params))
	{
		return false;
	}
	const FVector RiseEnd(Loc.X, Loc.Y, Dest.Z);
	if (World->SweepTestByChannel(Loc + FVector(0.f, 0.f, 5.f), RiseEnd, FQuat::Identity, ECC_Pawn, FCollisionShape::MakeCapsule(Radius - 6.f, CurHalf - 6.f), Params))
	{
		return false;
	}

	ETPSTraversalType MantleType = ETPSTraversalType::MantleHigh;
	UAnimSequenceBase* Clip = C->AnimSet.MantleHigh;
	float Fallback = HighMantleTime;
	if (Height <= LowMantleMax)
	{
		MantleType = ETPSTraversalType::MantleLow;
		Clip = C->AnimSet.MantleLow;
		Fallback = LowMantleTime;
	}
	else if (Height <= MidMantleMax)
	{
		MantleType = ETPSTraversalType::MantleMid;
		Clip = C->AnimSet.MantleMid;
		Fallback = MidMantleTime;
	}

	if (C->bIsCrouched)
	{
		C->UnCrouch();
	}
	UCharacterMovementComponent* Move = C->GetCharacterMovement();
	Move->StopMovementImmediately();
	Move->SetMovementMode(MOVE_Flying);

	StartLoc = Loc + FVector(0.f, 0.f, Half - CurHalf);
	EndLoc = Dest;
	TargetRot = FRotator(0.f, Into.Rotation().Yaw, 0.f);
	Begin(MantleType, 0.f);
	Duration = FMath::Max(0.3f, PlayClip(Clip, Fallback));
	return true;
}

void UTPSTraversalComponent::TickMantle()
{
	ATPSCharacter* C = GetOwnerCharacter();
	const float Alpha = GetTraversalAlpha();
	C->GetCharacterMovement()->StopMovementImmediately();

	// Rise to ledge height first, then step forward onto it.
	const float RiseA = FMath::Clamp(Alpha / 0.6f, 0.f, 1.f);
	const float ForwardA = FMath::Clamp((Alpha - 0.35f) / 0.65f, 0.f, 1.f);
	FVector NewLoc = FMath::Lerp(StartLoc, EndLoc, FMath::InterpEaseInOut(0.f, 1.f, ForwardA, 2.f));
	NewLoc.Z = FMath::Lerp(StartLoc.Z, EndLoc.Z, FMath::InterpEaseOut(0.f, 1.f, RiseA, 2.f));
	C->SetActorLocation(NewLoc, false, nullptr, ETeleportType::TeleportPhysics);
	C->SetActorRotation(FMath::RInterpTo(C->GetActorRotation(), TargetRot, GetWorld()->GetDeltaSeconds(), 12.f));

	if (Alpha >= 1.f)
	{
		C->SetActorLocation(EndLoc, false, nullptr, ETeleportType::TeleportPhysics);
		Finish();
	}
}

bool UTPSTraversalComponent::TryDiveRoll(FVector Dir)
{
	ATPSCharacter* C = GetOwnerCharacter();
	UWorld* World = GetWorld();
	if (!C || !World || IsBusy() || !C->GetCharacterMovement()->IsMovingOnGround())
	{
		return false;
	}
	Dir.Z = 0.f;
	Dir = Dir.GetSafeNormal();
	if (Dir.IsNearlyZero())
	{
		return false;
	}

	const float Half = C->GetCapsuleComponent()->GetScaledCapsuleHalfHeight();
	const float Radius = C->GetCapsuleComponent()->GetUnscaledCapsuleRadius();
	const FVector Loc = C->GetActorLocation();
	const float FeetZ = Loc.Z - Half;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(TPSDive), false, C);

	// Only from an elevated edge (e.g. on top of cover) with a real drop ahead.
	const FVector Ahead = Loc + Dir * 120.f;
	FHitResult Ground;
	if (World->LineTraceSingleByChannel(Ground, Ahead, Ahead - FVector(0.f, 0.f, 500.f), ECC_Visibility, Params) &&
		FeetZ - Ground.ImpactPoint.Z < MinDiveDrop)
	{
		return false;
	}
	if (World->SweepTestByChannel(Loc, Ahead, FQuat::Identity, ECC_Pawn, FCollisionShape::MakeCapsule(Radius, Half - 4.f), Params))
	{
		return false;
	}

	if (C->bIsCrouched)
	{
		C->UnCrouch();
	}
	TargetRot = FRotator(0.f, Dir.Rotation().Yaw, 0.f);
	C->SetActorRotation(TargetRot);
	C->LaunchCharacter(Dir * DiveSpeed + FVector(0.f, 0.f, DiveUpSpeed), true, true);
	Begin(ETPSTraversalType::DiveRoll, 3.f);
	PlayClip(C->AnimSet.DiveRoll, 0.f);
	return true;
}

void UTPSTraversalComponent::TickDive()
{
	const ATPSCharacter* C = GetOwnerCharacter();
	const float Elapsed = GetWorld()->GetTimeSeconds() - StartTime;
	if ((Elapsed > 0.2f && C->GetCharacterMovement()->IsMovingOnGround()) || Elapsed > Duration)
	{
		Finish();
	}
}

bool UTPSTraversalComponent::TryDodgeRoll(FVector Dir)
{
	ATPSCharacter* C = GetOwnerCharacter();
	UWorld* World = GetWorld();
	if (!C || !World || IsBusy() || !C->GetCharacterMovement()->IsMovingOnGround())
	{
		return false;
	}
	Dir.Z = 0.f;
	Dir = Dir.IsNearlyZero() ? C->GetActorForwardVector() : Dir.GetSafeNormal();

	// Backward rolls are disabled (web build rule).
	const FVector Facing = C->Controller ? FRotator(0.f, C->Controller->GetControlRotation().Yaw, 0.f).Vector() : C->GetActorForwardVector();
	if (FVector::DotProduct(Dir, Facing) < BackwardRollDot)
	{
		return false;
	}

	const float Half = C->GetCapsuleComponent()->GetScaledCapsuleHalfHeight();
	const float Radius = C->GetCapsuleComponent()->GetUnscaledCapsuleRadius();
	const FVector Start = C->GetActorLocation() + FVector(0.f, 0.f, 12.f);
	FCollisionQueryParams Params(SCENE_QUERY_STAT(TPSRoll), false, C);
	FHitResult Hit;
	float Dist = RollDistance;
	if (World->SweepSingleByChannel(Hit, Start, Start + Dir * RollDistance, FQuat::Identity, ECC_Pawn, FCollisionShape::MakeCapsule(Radius, Half - 14.f), Params))
	{
		Dist = Hit.Distance - 5.f;
	}
	if (Dist < MinRollDistance)
	{
		return false;
	}

	const float RollTime = FMath::Max(0.35f, RollDuration * Dist / RollDistance);
	UCharacterMovementComponent* Move = C->GetCharacterMovement();

	TSharedPtr<FRootMotionSource_ConstantForce> Force = MakeShared<FRootMotionSource_ConstantForce>();
	Force->InstanceName = TEXT("TPSDodgeRoll");
	Force->AccumulateMode = ERootMotionAccumulateMode::Override;
	Force->Priority = 5;
	Force->Force = Dir * (Dist / RollTime);
	Force->Duration = RollTime;
	Force->FinishVelocityParams.Mode = ERootMotionFinishVelocityMode::SetVelocity;
	Force->FinishVelocityParams.SetVelocity = Dir * 120.f;
	Force->Settings.SetFlag(ERootMotionSourceSettingsFlags::IgnoreZAccumulate);
	RootMotionId = Move->ApplyRootMotionSource(Force);

	TargetRot = FRotator(0.f, Dir.Rotation().Yaw, 0.f);
	C->SetActorRotation(TargetRot);
	Begin(ETPSTraversalType::DodgeRoll, RollTime);
	if (UAnimSequenceBase* Clip = C->AnimSet.DodgeRoll)
	{
		C->PlayActionAnim(Clip, Clip->GetPlayLength() / RollTime, 1, false, 0.08f, 0.15f);
	}
	return true;
}

// ---------------------------------------------------------------- Ladder

ATPSLadder* UTPSTraversalComponent::FindLadder(bool& bOutAtTop) const
{
	bOutAtTop = false;
	ATPSCharacter* C = GetOwnerCharacter();
	if (!C)
	{
		return nullptr;
	}
	TArray<AActor*> Overlapping;
	C->GetOverlappingActors(Overlapping, ATPSLadder::StaticClass());
	for (AActor* Actor : Overlapping)
	{
		ATPSLadder* L = Cast<ATPSLadder>(Actor);
		if (!L)
		{
			continue;
		}
		if (L->TopTrigger->IsOverlappingActor(C))
		{
			bOutAtTop = true;
			return L;
		}
		if (L->BottomTrigger->IsOverlappingActor(C))
		{
			return L;
		}
	}
	return nullptr;
}

bool UTPSTraversalComponent::IsNearLadder() const
{
	bool bTop = false;
	return !IsBusy() && FindLadder(bTop) != nullptr;
}

FVector UTPSTraversalComponent::LadderPoint(float FeetHeight, float ForwardOffset) const
{
	if (!Ladder)
	{
		return FVector::ZeroVector;
	}
	return Ladder->GetClimbBase() + Ladder->GetActorForwardVector() * ForwardOffset + FVector(0.f, 0.f, FeetHeight + GetHalfHeight());
}

bool UTPSTraversalComponent::LadderInteract()
{
	if (IsOnLadder())
	{
		bAutoClimb = !bAutoClimb;
		return true;
	}
	ATPSCharacter* C = GetOwnerCharacter();
	if (!C || IsBusy() || C->IsDead())
	{
		return false;
	}
	bool bTop = false;
	ATPSLadder* Found = FindLadder(bTop);
	if (!Found)
	{
		return false;
	}

	if (C->bIsCrouched)
	{
		C->UnCrouch();
	}
	Ladder = Found;
	UCharacterMovementComponent* Move = C->GetCharacterMovement();
	Move->StopMovementImmediately();
	Move->SetMovementMode(MOVE_Flying);

	bAutoClimb = bAutoClimbByDefault;
	LadderAutoDir = bTop ? -1 : 1;
	LadderInput = 0.f;
	LadderLoopDir = 0;
	TargetRot = FRotator(0.f, Found->GetFacingYaw(), 0.f);
	Begin(ETPSTraversalType::Ladder, 0.f);
	LadderFeet = bTop ? Found->Height : 0.f;
	SetLadderPhase(bTop ? ETPSLadderPhase::StartDown : ETPSLadderPhase::StartUp);
	return true;
}

void UTPSTraversalComponent::DropFromLadder()
{
	if (IsOnLadder() && LadderPhase == ETPSLadderPhase::Climbing)
	{
		ATPSCharacter* C = GetOwnerCharacter();
		Finish();
		if (C)
		{
			C->GetCharacterMovement()->SetMovementMode(MOVE_Falling);
		}
	}
}

void UTPSTraversalComponent::SetLadderPhase(ETPSLadderPhase Phase)
{
	ATPSCharacter* C = GetOwnerCharacter();
	LadderPhase = Phase;
	StartTime = GetWorld()->GetTimeSeconds();
	StartLoc = C ? C->GetActorLocation() : FVector::ZeroVector;
	LadderLoopDir = 0;

	switch (Phase)
	{
	case ETPSLadderPhase::StartUp: Duration = PlayClip(C ? C->AnimSet.LadderUpStart.Get() : nullptr, LadderStartTime); break;
	case ETPSLadderPhase::EndUp: Duration = PlayClip(C ? C->AnimSet.LadderUpEnd.Get() : nullptr, LadderEndTime); break;
	case ETPSLadderPhase::StartDown: Duration = PlayClip(C ? C->AnimSet.LadderDownStart.Get() : nullptr, LadderEndTime); break;
	case ETPSLadderPhase::EndDown: Duration = PlayClip(C ? C->AnimSet.LadderDownEnd.Get() : nullptr, 0.45f); break;
	default: Duration = 0.f; break;
	}
	Duration = FMath::Max(Duration, 0.05f);
}

void UTPSTraversalComponent::TickLadder(float DeltaTime)
{
	ATPSCharacter* C = GetOwnerCharacter();
	if (!Ladder || !C)
	{
		Finish();
		return;
	}
	C->GetCharacterMovement()->StopMovementImmediately();
	C->SetActorRotation(FMath::RInterpTo(C->GetActorRotation(), TargetRot, DeltaTime, 12.f));

	const float Alpha = GetTraversalAlpha();
	const float TopFeet = FMath::Max(LadderStartRise, Ladder->Height - LadderEndRise);

	switch (LadderPhase)
	{
	case ETPSLadderPhase::StartUp:
	{
		C->SetActorLocation(FMath::Lerp(StartLoc, LadderPoint(LadderStartRise, 0.f), FMath::InterpEaseInOut(0.f, 1.f, Alpha, 2.f)));
		if (Alpha >= 1.f)
		{
			LadderFeet = LadderStartRise;
			SetLadderPhase(ETPSLadderPhase::Climbing);
		}
		break;
	}
	case ETPSLadderPhase::Climbing:
	{
		const float Dir = !FMath::IsNearlyZero(LadderInput) ? LadderInput : (bAutoClimb ? float(LadderAutoDir) : 0.f);
		const float Mult = bLadderFast ? LadderFastMultiplier : 1.f;
		LadderFeet += Dir * LadderSpeed * Mult * DeltaTime;
		LadderRate = Dir * Mult;

		const int32 NewDir = Dir > 0.05f ? 1 : (Dir < -0.05f ? -1 : 0);
		if (NewDir != LadderLoopDir)
		{
			LadderLoopDir = NewDir;
			if (NewDir > 0)
			{
				PlayClip(C->AnimSet.LadderUpLoop, 0.f, Mult, 999);
			}
			else if (NewDir < 0)
			{
				PlayClip(C->AnimSet.LadderDownLoop, 0.f, Mult, 999);
			}
			else
			{
				C->SetActionAnimPaused(true);
			}
		}
		else if (NewDir != 0)
		{
			C->SetActionAnimRate(FMath::Abs(LadderRate));
		}

		if (LadderFeet >= TopFeet)
		{
			LadderFeet = TopFeet;
			C->SetActorLocation(LadderPoint(LadderFeet, 0.f));
			SetLadderPhase(ETPSLadderPhase::EndUp);
		}
		else if (LadderFeet <= 0.f && Dir < 0.f)
		{
			LadderFeet = 0.f;
			C->SetActorLocation(LadderPoint(LadderFeet, 0.f));
			SetLadderPhase(ETPSLadderPhase::EndDown);
		}
		else
		{
			C->SetActorLocation(LadderPoint(LadderFeet, 0.f));
		}
		break;
	}
	case ETPSLadderPhase::EndUp:
	{
		const FVector Target = Ladder->GetTopExit() + FVector(0.f, 0.f, GetHalfHeight() + 2.f);
		FVector NewLoc = FMath::Lerp(StartLoc, Target, FMath::InterpEaseInOut(0.f, 1.f, FMath::Clamp((Alpha - 0.5f) / 0.5f, 0.f, 1.f), 2.f));
		NewLoc.Z = FMath::Lerp(StartLoc.Z, Target.Z, FMath::InterpEaseOut(0.f, 1.f, FMath::Clamp(Alpha / 0.65f, 0.f, 1.f), 2.f));
		C->SetActorLocation(NewLoc);
		if (Alpha >= 1.f)
		{
			Finish();
		}
		break;
	}
	case ETPSLadderPhase::StartDown:
	{
		const FVector Target = LadderPoint(TopFeet, 0.f);
		FVector NewLoc = FMath::Lerp(StartLoc, Target, FMath::InterpEaseInOut(0.f, 1.f, FMath::Clamp(Alpha / 0.45f, 0.f, 1.f), 2.f));
		NewLoc.Z = FMath::Lerp(StartLoc.Z, Target.Z, FMath::InterpEaseIn(0.f, 1.f, FMath::Clamp((Alpha - 0.3f) / 0.7f, 0.f, 1.f), 2.f));
		C->SetActorLocation(NewLoc);
		if (Alpha >= 1.f)
		{
			LadderFeet = TopFeet;
			SetLadderPhase(ETPSLadderPhase::Climbing);
		}
		break;
	}
	case ETPSLadderPhase::EndDown:
	{
		C->SetActorLocation(FMath::Lerp(StartLoc, LadderPoint(0.f, -20.f), Alpha));
		if (Alpha >= 1.f)
		{
			Finish();
		}
		break;
	}
	default:
		Finish();
		break;
	}
}

void UTPSTraversalComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	switch (Type)
	{
	case ETPSTraversalType::MantleLow:
	case ETPSTraversalType::MantleMid:
	case ETPSTraversalType::MantleHigh:
		TickMantle();
		break;
	case ETPSTraversalType::DiveRoll:
		TickDive();
		break;
	case ETPSTraversalType::DodgeRoll:
		if (GetTraversalAlpha() >= 1.f)
		{
			Finish();
		}
		break;
	case ETPSTraversalType::Ladder:
		TickLadder(DeltaTime);
		break;
	default:
		break;
	}
}
