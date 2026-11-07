#pragma once

#include "CoreMinimal.h"
#include "Animation/TPSAnimInstance.h"
#include "Animation/AnimInstanceProxy.h"
#include "TPSProceduralAnimInstance.generated.h"

class UAnimSequence;
class UAnimSequenceBase;

/** One sampled clip layer handed to the worker thread. */
struct FTPSProcClipLayer
{
	UAnimSequence* Seq = nullptr;
	float Time = 0.f;
	float Length = 0.f;
	float Weight = 0.f;
	bool bUpperBody = false;
	/** Full-body clips: keep the body on the capsule (see FTPSProcActionState::Displacement). */
	bool bInPlace = false;
	bool bHasDisplacement = false;
	FVector Displacement = FVector::ZeroVector;
	FVector CapsuleDelta = FVector::ZeroVector;
};

/** Everything the worker-thread evaluation needs, copied once per frame. Angles in degrees, vectors in component space. */
struct FTPSProcAnimFrame
{
	FTPSProcClipLayer BasePose;
	FTPSProcClipLayer MovePose;
	FTPSProcClipLayer CrouchPose;
	FTPSProcClipLayer Actions[2];

	FVector Forward = FVector(0.f, 1.f, 0.f);
	FVector Right = FVector(-1.f, 0.f, 0.f);
	FVector Up = FVector(0.f, 0.f, 1.f);
	FVector MoveDir = FVector(0.f, 1.f, 0.f);

	float Phase = 0.f;
	float MoveAlpha = 0.f;
	float RunAlpha = 0.f;
	float CrouchAlpha = 0.f;
	float CrouchDrop = 34.f;
	float AirAlpha = 0.f;
	float SpinePitch = 0.f;
	float SpineYaw = 0.f;
	float LeanAngle = 0.f;
	float Recoil = 0.f;
	float HitReact = 0.f;
	float LowerWeapon = 0.f;
};

class FTPSProceduralAnimProxy : public FAnimInstanceProxy
{
public:
	FTPSProceduralAnimProxy() = default;
	explicit FTPSProceduralAnimProxy(UAnimInstance* InAnimInstance) : FAnimInstanceProxy(InAnimInstance) {}

	FTPSProcAnimFrame Frame;

protected:
	virtual bool Evaluate(FPoseContext& Output) override;
};

/**
 * Ready-to-use character animation with no AnimBP needed:
 * - weapon idle/aim poses from the imported clips (rifle aim, rifle aim-walk, pistol, shotgun, sniper, launcher, sniper crouch);
 * - procedural walk/run/strafe/backpedal/crouch/turn-in-place/air gait (ported from the web build's procedural locomotion);
 * - spine aim pitch/yaw with closed-loop barrel alignment, lean, recoil, hit flinch, weapon lowering on switch;
 * - action layer: upper-body clips (reloads, bolt/pump) and full-body clips (mantle, rolls, ladder) whose root travel is
 *   matched to the capsule.
 * ATPSCharacter uses this automatically when no /Game/TPS/Animations/ABP_TPS exists.
 */
UCLASS(Blueprintable)
class TPSENGINE_API UTPSProceduralAnimInstance : public UTPSAnimInstance
{
	GENERATED_BODY()

public:
	virtual void NativeInitializeAnimation() override;
	virtual void NativeUpdateAnimation(float DeltaSeconds) override;

	/** Returns the play time (0 when the clip cannot play on this skeleton). WorldDisplacement: planned capsule travel for full-body clips. */
	float PlayAction(UAnimSequenceBase* Anim, float PlayRate, int32 Loops, bool bUpperBodyOnly, float BlendIn, float BlendOut, const FVector& WorldDisplacement, bool bHasDisplacement);
	void StopAction(float BlendOut);
	void SetActionRate(float PlayRate);
	void SetActionPaused(bool bPaused);
	bool IsUpperBodyActionActive() const;
	bool IsFullBodyActionActive() const;

	/** Optional overrides; empty slots use the stock clips from /Game/TPS/Animations. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Poses") TObjectPtr<UAnimSequence> RiflePose;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Poses") TObjectPtr<UAnimSequence> RifleMovePose;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Poses") TObjectPtr<UAnimSequence> PistolPose;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Poses") TObjectPtr<UAnimSequence> ShotgunPose;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Poses") TObjectPtr<UAnimSequence> SniperPose;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Poses") TObjectPtr<UAnimSequence> SniperCrouchPose;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Poses") TObjectPtr<UAnimSequence> LauncherPose;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Gait") float WalkStride = 150.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Gait") float RunStride = 285.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Gait") float CrouchStride = 110.f;
	/** Turn spine toward the aim so the barrel lines up with the crosshair. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Aim") bool bAlignBarrelToAim = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Aim") float MaxBarrelCorrection = 35.f;

protected:
	virtual FAnimInstanceProxy* CreateAnimInstanceProxy() override;
	virtual void DestroyAnimInstanceProxy(FAnimInstanceProxy* InProxy) override;

private:
	struct FTPSActionState
	{
		TWeakObjectPtr<UAnimSequence> Seq;
		float Time = 0.f;
		float Rate = 1.f;
		int32 LoopsLeft = 1;
		bool bUpperBody = false;
		float Weight = 0.f;
		float BlendIn = 0.15f;
		float BlendOut = 0.2f;
		bool bStopping = false;
		bool bPaused = false;
		bool bHasDisplacement = false;
		FVector Displacement = FVector::ZeroVector;
		FVector StartLocation = FVector::ZeroVector;
		bool IsActive() const { return Seq.IsValid() && (Weight > 0.f || !bStopping); }
	};

	void LoadDefaultPoses();
	UAnimSequence* PickPose(ETPSWeaponPoseType Pose) const;
	bool IsPlayable(const UAnimSequence* Seq) const;
	void TickAction(FTPSActionState& Action, float DeltaSeconds);
	void FillLayer(FTPSProcClipLayer& Layer, const FTPSActionState& Action, const FTransform& ComponentTransform) const;
	void UpdateBarrelCorrection(float DeltaSeconds);

	UPROPERTY() TArray<TObjectPtr<UAnimSequence>> LoadedPoses;

	FTPSActionState Current;
	FTPSActionState Previous;

	float GaitPhase = 0.f;
	float SmoothMove = 0.f;
	float SmoothRun = 0.f;
	float SmoothCrouch = 0.f;
	float SmoothAir = 0.f;
	FVector SmoothMoveDir = FVector::ForwardVector;
	float CorrectionYaw = 0.f;
	float CorrectionPitch = 0.f;
	float RecoilKick = 0.f;
};
