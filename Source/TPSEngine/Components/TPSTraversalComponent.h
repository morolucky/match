#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Core/TPSTypes.h"
#include "TPSTraversalComponent.generated.h"

class ATPSCharacter;
class ATPSLadder;
class UAnimSequenceBase;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FTPSOnTraversalChanged, ETPSTraversalType, Type);

/**
 * Space-bar traversal in the web build's priority order: mantle (low/mid/high), dive-roll off cover, dodge roll.
 * Also drives ladder climbing (start / loop / end, auto-climb, manual W/S).
 */
UCLASS(ClassGroup = (TPS), meta = (BlueprintSpawnableComponent))
class TPSENGINE_API UTPSTraversalComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UTPSTraversalComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	/** Space: tries mantle, then dive off cover, then dodge roll. MoveDir is the world-space input direction (may be zero). */
	UFUNCTION(BlueprintCallable, Category = "TPS|Traversal") bool TryTraverse(FVector MoveDir);
	UFUNCTION(BlueprintCallable, Category = "TPS|Traversal") bool TryMantle(FVector Dir);
	UFUNCTION(BlueprintCallable, Category = "TPS|Traversal") bool TryDiveRoll(FVector Dir);
	UFUNCTION(BlueprintCallable, Category = "TPS|Traversal") bool TryDodgeRoll(FVector Dir);

	/** F: enter the nearest ladder, or toggle auto-climb while on one. */
	UFUNCTION(BlueprintCallable, Category = "TPS|Ladder") bool LadderInteract();
	/** W/S on the ladder (-1..1). */
	UFUNCTION(BlueprintCallable, Category = "TPS|Ladder") void SetLadderInput(float Axis) { LadderInput = FMath::Clamp(Axis, -1.f, 1.f); }
	UFUNCTION(BlueprintCallable, Category = "TPS|Ladder") void SetLadderFast(bool bFast) { bLadderFast = bFast; }
	UFUNCTION(BlueprintCallable, Category = "TPS|Ladder") void DropFromLadder();
	UFUNCTION(BlueprintCallable, Category = "TPS|Traversal") void AbortTraversal();

	UFUNCTION(BlueprintPure, Category = "TPS|Traversal") bool IsBusy() const { return Type != ETPSTraversalType::None; }
	UFUNCTION(BlueprintPure, Category = "TPS|Traversal") ETPSTraversalType GetTraversalType() const { return Type; }
	UFUNCTION(BlueprintPure, Category = "TPS|Traversal") float GetTraversalAlpha() const;
	UFUNCTION(BlueprintPure, Category = "TPS|Ladder") bool IsOnLadder() const { return Type == ETPSTraversalType::Ladder; }
	UFUNCTION(BlueprintPure, Category = "TPS|Ladder") ETPSLadderPhase GetLadderPhase() const { return LadderPhase; }
	/** Signed climb speed / base speed, for the AnimBP loop play rate. */
	UFUNCTION(BlueprintPure, Category = "TPS|Ladder") float GetLadderClimbRate() const { return LadderRate; }
	UFUNCTION(BlueprintPure, Category = "TPS|Ladder") bool IsLadderAutoClimb() const { return bAutoClimb; }
	UFUNCTION(BlueprintPure, Category = "TPS|Ladder") bool IsNearLadder() const;

	UPROPERTY(BlueprintAssignable, Category = "TPS|Traversal") FTPSOnTraversalChanged OnTraversalChanged;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Mantle") float MinMantleHeight = 55.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Mantle") float MaxMantleHeight = 300.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Mantle") float LowMantleMax = 135.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Mantle") float MidMantleMax = 220.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Mantle") float MantleReach = 110.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Mantle") float LowMantleTime = 0.85f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Mantle") float MidMantleTime = 1.25f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Mantle") float HighMantleTime = 1.65f;
	/** Use the clip length for timing when a mantle clip is assigned. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Mantle") bool bUseClipLength = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Roll") float RollDistance = 340.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Roll") float RollDuration = 0.7f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Roll") float MinRollDistance = 120.f;
	/** Backward rolls are rejected below this dot(dir, facing). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Roll") float BackwardRollDot = -0.35f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Roll") float DiveSpeed = 480.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Roll") float DiveUpSpeed = 260.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Roll") float MinDiveDrop = 70.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Ladder") float LadderSpeed = 206.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Ladder") float LadderFastMultiplier = 1.35f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Ladder") float LadderStartRise = 86.49f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Ladder") float LadderEndRise = 215.86f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Ladder") float LadderStartTime = 0.8f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Ladder") float LadderEndTime = 1.3f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Ladder") bool bAutoClimbByDefault = true;

private:
	ATPSCharacter* GetOwnerCharacter() const;
	void Begin(ETPSTraversalType NewType, float Duration);
	void Finish();
	void TickMantle();
	void TickDive();
	void TickLadder(float DeltaTime);
	void SetLadderPhase(ETPSLadderPhase Phase);
	float PlayClip(UAnimSequenceBase* Clip, float FallbackTime, float Rate = 1.f, int32 Loops = 1);
	ATPSLadder* FindLadder(bool& bOutAtTop) const;
	FVector LadderPoint(float FeetHeight, float ForwardOffset) const;
	float GetHalfHeight() const;

	ETPSTraversalType Type = ETPSTraversalType::None;
	float StartTime = 0.f;
	float Duration = 0.f;
	FVector StartLoc = FVector::ZeroVector;
	FVector EndLoc = FVector::ZeroVector;
	FRotator TargetRot = FRotator::ZeroRotator;
	uint16 RootMotionId = 0;

	UPROPERTY() TObjectPtr<ATPSLadder> Ladder;
	ETPSLadderPhase LadderPhase = ETPSLadderPhase::None;
	float LadderFeet = 0.f;
	float LadderInput = 0.f;
	float LadderRate = 0.f;
	int32 LadderLoopDir = 0;
	bool bLadderFast = false;
	bool bAutoClimb = true;
	int32 LadderAutoDir = 1;
};
