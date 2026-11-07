#include "Animation/TPSProceduralAnimInstance.h"
#include "Core/TPSStatics.h"
#include "Characters/TPSCharacter.h"
#include "Weapons/TPSWeapon.h"
#include "Animation/AnimSequence.h"
#include "Animation/AnimMontage.h"
#include "Animation/AnimNodeBase.h"
#include "Animation/AnimationPoseData.h"
#include "Animation/AnimTypes.h"
#include "Animation/AnimationAsset.h"
#include "BonePose.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "GameFramework/CharacterMovementComponent.h"

namespace TPSProc
{
	static const FName NAME_Pelvis(TEXT("pelvis"));
	static const FName NAME_Spine[] = { FName(TEXT("spine_01")), FName(TEXT("spine_02")), FName(TEXT("spine_03")), FName(TEXT("spine_04")), FName(TEXT("spine_05")) };
	static const FName NAME_Head(TEXT("head"));
	static const FName NAME_ThighL(TEXT("thigh_l"));
	static const FName NAME_CalfL(TEXT("calf_l"));
	static const FName NAME_FootL(TEXT("foot_l"));
	static const FName NAME_ThighR(TEXT("thigh_r"));
	static const FName NAME_CalfR(TEXT("calf_r"));
	static const FName NAME_FootR(TEXT("foot_r"));

	static FCompactPoseBoneIndex Find(const FBoneContainer& Bones, const FName& Name)
	{
		const int32 MeshIndex = Bones.GetPoseBoneIndexForBoneName(Name);
		return MeshIndex == INDEX_NONE ? FCompactPoseBoneIndex(INDEX_NONE) : Bones.MakeCompactPoseIndex(FMeshPoseBoneIndex(MeshIndex));
	}

	static bool Sample(const UAnimSequence* Seq, float Time, FPoseContext& Context)
	{
		if (!Seq || Seq->GetSkeleton() != Context.Pose.GetBoneContainer().GetSkeletonAsset())
		{
			return false;
		}
		FAnimationPoseData PoseData(Context);
		Seq->GetAnimationPose(PoseData, FAnimExtractContext(double(Time), false));
		return true;
	}

	static void LockRoot(FCompactPose& Pose)
	{
		const FCompactPoseBoneIndex Root(0);
		Pose[Root] = Pose.GetRefPose(Root);
	}

	static void BlendBones(FCompactPose& Out, const FCompactPose& Source, float Weight, const TArray<bool>* Mask)
	{
		if (Weight <= KINDA_SMALL_NUMBER)
		{
			return;
		}
		for (const FCompactPoseBoneIndex Index : Out.ForEachBoneIndex())
		{
			if (!Mask || (*Mask)[Index.GetInt()])
			{
				Out[Index].BlendWith(Source[Index], FMath::Min(Weight, 1.f));
			}
		}
	}

	static FVector AxisToward(const FVector& From, const FVector& To)
	{
		return FVector::CrossProduct(From, To).GetSafeNormal();
	}

	static void Rotate(TArray<FQuat>& Deltas, const FCompactPoseBoneIndex Index, const FVector& Axis, float Degrees)
	{
		if (Index.IsValid() && !Axis.IsNearlyZero() && FMath::Abs(Degrees) > 0.01f)
		{
			FQuat& Delta = Deltas[Index.GetInt()];
			Delta = FQuat(Axis, FMath::DegreesToRadians(Degrees)) * Delta;
		}
	}

	/** Applies component-space rotation deltas (children inherit them) and a component-space pelvis offset. */
	static void ApplyDeltas(FCompactPose& Pose, const TArray<FQuat>& Deltas, const FCompactPoseBoneIndex Pelvis, const FVector& PelvisOffset)
	{
		TArray<FQuat> Comp;
		Comp.SetNumUninitialized(Pose.GetNumBones());
		for (const FCompactPoseBoneIndex Index : Pose.ForEachBoneIndex())
		{
			const FCompactPoseBoneIndex Parent = Pose.GetParentBoneIndex(Index);
			const FQuat ParentRot = Parent.IsValid() ? Comp[Parent.GetInt()] : FQuat::Identity;
			FTransform& Local = Pose[Index];
			const FQuat& Delta = Deltas[Index.GetInt()];
			if (!Delta.Equals(FQuat::Identity, 1e-5f))
			{
				Local.SetRotation((ParentRot.Inverse() * Delta * ParentRot * Local.GetRotation()).GetNormalized());
			}
			if (Index == Pelvis && !PelvisOffset.IsNearlyZero())
			{
				Local.AddToTranslation(ParentRot.Inverse().RotateVector(PelvisOffset));
			}
			Comp[Index.GetInt()] = ParentRot * Local.GetRotation();
		}
	}

	/**
	 * Full-body clips: the root is locked and the pelvis travel is re-targeted so the body follows the clip's own
	 * trajectory scaled to the planned capsule displacement (or stays in place when there is none).
	 */
	static void PlaceOnCapsule(FPoseContext& Clip, const FTPSProcClipLayer& Layer, const FCompactPoseBoneIndex Pelvis)
	{
		FCompactPose& Pose = Clip.Pose;
		const FCompactPoseBoneIndex Root(0);
		if (!Pelvis.IsValid() || !(Pose.GetParentBoneIndex(Pelvis) == Root))
		{
			LockRoot(Pose);
			return;
		}

		FPoseContext StartCtx(Clip);
		FPoseContext EndCtx(Clip);
		Sample(Layer.Seq, 0.f, StartCtx);
		Sample(Layer.Seq, Layer.Length, EndCtx);

		const FTransform RootNow = Pose[Root];
		const FVector Now = RootNow.TransformPosition(Pose[Pelvis].GetTranslation());
		const FQuat PelvisCompRot = RootNow.GetRotation() * Pose[Pelvis].GetRotation();
		const FVector Start = StartCtx.Pose[Root].TransformPosition(StartCtx.Pose[Pelvis].GetTranslation());
		const FVector End = EndCtx.Pose[Root].TransformPosition(EndCtx.Pose[Pelvis].GetTranslation());
		const FVector ClipTravel = End - Start;
		const float Alpha = Layer.Length > 0.f ? FMath::Clamp(Layer.Time / Layer.Length, 0.f, 1.f) : 0.f;

		FVector Target = Now - ClipTravel * Alpha;
		if (Layer.bHasDisplacement)
		{
			for (int32 Axis = 0; Axis < 3; ++Axis)
			{
				const float ClipAxis = ClipTravel[Axis];
				const float Ratio = FMath::Abs(ClipAxis) > 5.f ? Layer.Displacement[Axis] / ClipAxis : -1.f;
				if (Ratio > 0.f && Ratio < 4.f)
				{
					Target[Axis] = Start[Axis] + (Now[Axis] - Start[Axis]) * Ratio - Layer.CapsuleDelta[Axis];
				}
			}
		}

		const FTransform& RefRoot = Pose.GetRefPose(Root);
		Pose[Root] = RefRoot;
		Pose[Pelvis].SetTranslation(RefRoot.InverseTransformPosition(Target));
		Pose[Pelvis].SetRotation((RefRoot.GetRotation().Inverse() * PelvisCompRot).GetNormalized());
	}
}

// ---------------------------------------------------------------- Worker thread

bool FTPSProceduralAnimProxy::Evaluate(FPoseContext& Output)
{
	using namespace TPSProc;
	const FTPSProcAnimFrame& F = Frame;
	FCompactPose& OutPose = Output.Pose;
	const int32 NumBones = OutPose.GetNumBones();
	if (NumBones == 0)
	{
		return true;
	}
	const FBoneContainer& Bones = OutPose.GetBoneContainer();

	const FCompactPoseBoneIndex Pelvis = Find(Bones, NAME_Pelvis);
	TArray<FCompactPoseBoneIndex, TInlineAllocator<5>> Spine;
	for (const FName& Name : NAME_Spine)
	{
		const FCompactPoseBoneIndex Index = Find(Bones, Name);
		if (Index.IsValid())
		{
			Spine.Add(Index);
		}
	}
	const FCompactPoseBoneIndex Head = Find(Bones, NAME_Head);
	const FCompactPoseBoneIndex Thigh[2] = { Find(Bones, NAME_ThighL), Find(Bones, NAME_ThighR) };
	const FCompactPoseBoneIndex Calf[2] = { Find(Bones, NAME_CalfL), Find(Bones, NAME_CalfR) };
	const FCompactPoseBoneIndex Foot[2] = { Find(Bones, NAME_FootL), Find(Bones, NAME_FootR) };

	// Upper body = spine_01 and everything below it in the hierarchy.
	TArray<bool> UpperMask;
	UpperMask.SetNumZeroed(NumBones);
	if (Spine.Num() > 0)
	{
		for (const FCompactPoseBoneIndex Index : OutPose.ForEachBoneIndex())
		{
			const FCompactPoseBoneIndex Parent = OutPose.GetParentBoneIndex(Index);
			UpperMask[Index.GetInt()] = Index == Spine[0] || (Parent.IsValid() && UpperMask[Parent.GetInt()]);
		}
	}

	// 1. Weapon idle pose (+ rifle aim-walk upper body, + sniper crouch pose).
	if (!Sample(F.BasePose.Seq, F.BasePose.Time, Output))
	{
		Output.ResetToRefPose();
	}
	LockRoot(OutPose);
	if (F.MovePose.Seq && F.MovePose.Weight > 0.f)
	{
		FPoseContext Temp(Output);
		if (Sample(F.MovePose.Seq, F.MovePose.Time, Temp))
		{
			BlendBones(OutPose, Temp.Pose, F.MovePose.Weight, &UpperMask);
		}
	}
	if (F.CrouchPose.Seq && F.CrouchPose.Weight > 0.f)
	{
		FPoseContext Temp(Output);
		if (Sample(F.CrouchPose.Seq, F.CrouchPose.Time, Temp))
		{
			LockRoot(Temp.Pose);
			BlendBones(OutPose, Temp.Pose, F.CrouchPose.Weight, nullptr);
		}
	}

	// 2. Procedural legs: gait, crouch, air.
	const FVector Down = -F.Up;
	const FVector Move = F.MoveDir.IsNearlyZero() ? F.Forward : F.MoveDir;
	const FVector SwingAxis = AxisToward(Down, Move);
	const FVector KneeAxis = AxisToward(Down, F.Forward);
	const FVector YawAxis = AxisToward(F.Forward, F.Right);
	const FVector PitchAxis = AxisToward(F.Forward, F.Up);
	const FVector LeanAxis = AxisToward(F.Up, F.Right);
	{
		TArray<FQuat> Deltas;
		Deltas.Init(FQuat::Identity, NumBones);
		FVector PelvisOffset = FVector::ZeroVector;

		const float Amp = FMath::Lerp(20.f, 38.f, F.RunAlpha) * F.MoveAlpha;
		const float KneePeak = FMath::Lerp(55.f, 95.f, F.RunAlpha);
		for (int32 Side = 0; Side < 2; ++Side)
		{
			const float Phi = F.Phase + Side * PI;
			const float Swing = Amp * FMath::Sin(Phi);
			const float Knee = (KneePeak * FMath::Pow(FMath::Max(0.f, FMath::Cos(Phi)), 1.5f) + 4.f) * F.MoveAlpha;
			Rotate(Deltas, Thigh[Side], SwingAxis, Swing);
			Rotate(Deltas, Calf[Side], KneeAxis, -Knee);
			Rotate(Deltas, Foot[Side], SwingAxis, -Swing * 0.8f);
			Rotate(Deltas, Foot[Side], KneeAxis, Knee * 0.8f);
		}
		PelvisOffset += Down * (FMath::Lerp(2.f, 4.f, F.RunAlpha) * F.MoveAlpha * FMath::Abs(FMath::Sin(F.Phase)));
		const float Twist = FMath::Lerp(4.f, 8.f, F.RunAlpha) * F.MoveAlpha * FMath::Sin(F.Phase);
		Rotate(Deltas, Pelvis, YawAxis, Twist);
		if (Spine.Num() > 0)
		{
			Rotate(Deltas, Spine[0], YawAxis, -Twist);
			Rotate(Deltas, Spine[0], AxisToward(F.Up, F.Forward), 7.f * F.RunAlpha * F.MoveAlpha);
		}

		if (F.CrouchAlpha > 0.f)
		{
			// Knees forward, hips back: feet stay planted while the pelvis drops by CrouchDrop.
			const float Drop = F.CrouchDrop * F.CrouchAlpha;
			const float Theta = FMath::RadiansToDegrees(FMath::Acos(FMath::Clamp(1.f - Drop / 88.f, -1.f, 1.f)));
			for (int32 Side = 0; Side < 2; ++Side)
			{
				Rotate(Deltas, Thigh[Side], KneeAxis, Theta);
				Rotate(Deltas, Calf[Side], KneeAxis, -2.f * Theta);
				Rotate(Deltas, Foot[Side], KneeAxis, Theta);
			}
			PelvisOffset += Down * Drop;
			if (Spine.Num() > 0)
			{
				Rotate(Deltas, Spine[0], AxisToward(F.Up, F.Forward), 12.f * F.CrouchAlpha);
			}
		}
		if (F.AirAlpha > 0.f)
		{
			for (int32 Side = 0; Side < 2; ++Side)
			{
				Rotate(Deltas, Thigh[Side], KneeAxis, (Side == 0 ? 30.f : 15.f) * F.AirAlpha);
				Rotate(Deltas, Calf[Side], KneeAxis, (Side == 0 ? -55.f : -30.f) * F.AirAlpha);
			}
		}
		ApplyDeltas(OutPose, Deltas, Pelvis, PelvisOffset);
	}

	// 3. Action clips.
	float FullBodyWeight = 0.f;
	for (const FTPSProcClipLayer& Layer : F.Actions)
	{
		if (!Layer.Seq || Layer.Weight <= 0.f)
		{
			continue;
		}
		FPoseContext Temp(Output);
		if (!Sample(Layer.Seq, Layer.Time, Temp))
		{
			continue;
		}
		if (Layer.bUpperBody)
		{
			BlendBones(OutPose, Temp.Pose, Layer.Weight, &UpperMask);
		}
		else
		{
			PlaceOnCapsule(Temp, Layer, Pelvis);
			BlendBones(OutPose, Temp.Pose, Layer.Weight, nullptr);
			FullBodyWeight = FMath::Max(FullBodyWeight, Layer.Weight);
		}
	}

	// 4. Upper-body aim, lean, recoil, flinch and weapon lowering.
	const float Keep = 1.f - FMath::Clamp(FullBodyWeight, 0.f, 1.f);
	if (Keep > 0.f && Spine.Num() > 0)
	{
		TArray<FQuat> Deltas;
		Deltas.Init(FQuat::Identity, NumBones);
		const float N = float(Spine.Num());
		for (const FCompactPoseBoneIndex Index : Spine)
		{
			Rotate(Deltas, Index, PitchAxis, F.SpinePitch / N * Keep);
			Rotate(Deltas, Index, YawAxis, F.SpineYaw / N * Keep);
			Rotate(Deltas, Index, LeanAxis, F.LeanAngle / N * Keep);
		}
		const FCompactPoseBoneIndex Chest = Spine.Last();
		Rotate(Deltas, Chest, PitchAxis, F.Recoil * Keep);
		Rotate(Deltas, Chest, AxisToward(F.Up, -F.Forward), 9.f * F.HitReact * Keep);
		Rotate(Deltas, Chest, PitchAxis, -28.f * F.LowerWeapon * Keep);
		Rotate(Deltas, Head, LeanAxis, -0.5f * F.LeanAngle * Keep);
		ApplyDeltas(OutPose, Deltas, FCompactPoseBoneIndex(INDEX_NONE), FVector::ZeroVector);
	}
	return true;
}

// ---------------------------------------------------------------- Game thread

FAnimInstanceProxy* UTPSProceduralAnimInstance::CreateAnimInstanceProxy()
{
	return new FTPSProceduralAnimProxy(this);
}

void UTPSProceduralAnimInstance::DestroyAnimInstanceProxy(FAnimInstanceProxy* InProxy)
{
	delete static_cast<FTPSProceduralAnimProxy*>(InProxy);
}

bool UTPSProceduralAnimInstance::IsPlayable(const UAnimSequence* Seq) const
{
	const USkeletalMeshComponent* MeshComp = GetSkelMeshComponent();
	const USkeletalMesh* Mesh = MeshComp ? MeshComp->GetSkeletalMeshAsset() : nullptr;
	return Seq && Mesh && Seq->GetSkeleton() == Mesh->GetSkeleton();
}

void UTPSProceduralAnimInstance::LoadDefaultPoses()
{
	auto Pick = [this](TObjectPtr<UAnimSequence>& Slot, std::initializer_list<const TCHAR*> Names)
	{
		if (IsPlayable(Slot))
		{
			return;
		}
		Slot = nullptr;
		for (const TCHAR* Name : Names)
		{
			UAnimSequence* Seq = UTPSStatics::TryLoad<UAnimSequence>(FString::Printf(TEXT("/Game/TPS/Animations/%s.%s"), Name, Name));
			if (Seq)
			{
				LoadedPoses.AddUnique(Seq);
			}
			if (IsPlayable(Seq))
			{
				Slot = Seq;
				return;
			}
		}
	};
	// Reload clips start from the weapon's ready pose, so frame 0 doubles as the idle/aim pose.
	Pick(RiflePose, { TEXT("A_AR_Aim_Fwd") });
	Pick(RifleMovePose, { TEXT("A_AR_AimWalkPose_Fwd") });
	Pick(PistolPose, { TEXT("MF_Pistol_Idle_ADS"), TEXT("A_TP_CH_Handgun_Reload_Empty"), TEXT("A_AR_Aim_Fwd") });
	Pick(ShotgunPose, { TEXT("A_TP_CH_Shotgun_01_Reload_Bolt"), TEXT("A_AR_Aim_Fwd") });
	Pick(SniperPose, { TEXT("A_TP_CH_Sniper_01_Reload_Bolt"), TEXT("A_AR_Aim_Fwd") });
	Pick(SniperCrouchPose, { TEXT("A_TP_CH_Sniper_02_Crouch_Aim_Pose") });
	Pick(LauncherPose, { TEXT("A_TP_CH_RL_01_Reload"), TEXT("A_AR_Aim_Fwd") });
}

void UTPSProceduralAnimInstance::NativeInitializeAnimation()
{
	Super::NativeInitializeAnimation();
	LoadDefaultPoses();
}

UAnimSequence* UTPSProceduralAnimInstance::PickPose(ETPSWeaponPoseType Pose) const
{
	switch (Pose)
	{
	case ETPSWeaponPoseType::Pistol: return PistolPose;
	case ETPSWeaponPoseType::Shotgun: return ShotgunPose;
	case ETPSWeaponPoseType::Sniper: return SniperPose;
	case ETPSWeaponPoseType::Launcher: return LauncherPose;
	default: return RiflePose;
	}
}

float UTPSProceduralAnimInstance::PlayAction(UAnimSequenceBase* Anim, float PlayRate, int32 Loops, bool bUpperBodyOnly, float BlendIn, float BlendOut,
	const FVector& WorldDisplacement, bool bHasDisplacement)
{
	UAnimSequence* Seq = Cast<UAnimSequence>(Anim);
	// No slot graph here: a montage plays its first segment's sequence.
	if (const UAnimMontage* Montage = Cast<UAnimMontage>(Anim))
	{
		if (Montage->SlotAnimTracks.Num() > 0 && Montage->SlotAnimTracks[0].AnimTrack.AnimSegments.Num() > 0)
		{
			Seq = Cast<UAnimSequence>(Montage->SlotAnimTracks[0].AnimTrack.AnimSegments[0].GetAnimReference());
		}
	}
	if (!IsPlayable(Seq))
	{
		return 0.f;
	}
	if (Current.IsActive())
	{
		Previous = Current;
		Previous.bStopping = true;
		Previous.BlendOut = FMath::Max(BlendIn, 0.05f);
	}
	Current = FTPSActionState();
	Current.Seq = Seq;
	Current.Rate = FMath::Max(PlayRate, 0.01f);
	Current.LoopsLeft = FMath::Max(1, Loops);
	Current.bUpperBody = bUpperBodyOnly;
	Current.BlendIn = FMath::Max(BlendIn, 0.f);
	Current.BlendOut = FMath::Max(BlendOut, 0.01f);
	Current.Weight = Current.BlendIn <= 0.f ? 1.f : 0.f;
	Current.bHasDisplacement = bHasDisplacement;
	Current.Displacement = WorldDisplacement;
	Current.StartLocation = Character ? Character->GetActorLocation() : FVector::ZeroVector;
	return Seq->GetPlayLength() * Current.LoopsLeft / Current.Rate;
}

void UTPSProceduralAnimInstance::StopAction(float BlendOut)
{
	if (Current.Seq.IsValid())
	{
		Current.bStopping = true;
		Current.BlendOut = FMath::Max(BlendOut, 0.01f);
		if (BlendOut <= 0.f)
		{
			Current = FTPSActionState();
		}
	}
}

void UTPSProceduralAnimInstance::SetActionRate(float PlayRate)
{
	Current.Rate = FMath::Max(PlayRate, 0.01f);
	Current.bPaused = false;
}

void UTPSProceduralAnimInstance::SetActionPaused(bool bPaused)
{
	Current.bPaused = bPaused;
}

bool UTPSProceduralAnimInstance::IsUpperBodyActionActive() const
{
	return Current.Seq.IsValid() && Current.bUpperBody && !Current.bStopping;
}

bool UTPSProceduralAnimInstance::IsFullBodyActionActive() const
{
	return Current.Seq.IsValid() && !Current.bUpperBody && !Current.bStopping;
}

void UTPSProceduralAnimInstance::TickAction(FTPSActionState& Action, float DeltaSeconds)
{
	const UAnimSequence* Seq = Action.Seq.Get();
	if (!Seq)
	{
		Action = FTPSActionState();
		return;
	}
	const float Length = Seq->GetPlayLength();
	if (!Action.bPaused)
	{
		Action.Time += DeltaSeconds * Action.Rate;
	}
	if (Length > 0.f && Action.Time >= Length)
	{
		const int32 Completed = FMath::FloorToInt(Action.Time / Length);
		if (Action.LoopsLeft > Completed)
		{
			Action.Time -= Completed * Length;
			Action.LoopsLeft -= Completed;
		}
		else
		{
			Action.LoopsLeft = 1;
			Action.Time = Length;
			Action.bStopping = true;
		}
	}
	// Blend out so the clip finishes exactly as its last frame plays.
	if (!Action.bStopping && !Action.bPaused && Action.LoopsLeft <= 1 && Length - Action.Time <= Action.BlendOut * Action.Rate)
	{
		Action.bStopping = true;
	}
	if (Action.bStopping)
	{
		Action.Weight -= DeltaSeconds / Action.BlendOut;
		if (Action.Weight <= 0.f)
		{
			Action = FTPSActionState();
		}
	}
	else
	{
		Action.Weight = Action.BlendIn <= 0.f ? 1.f : FMath::Min(1.f, Action.Weight + DeltaSeconds / Action.BlendIn);
	}
}

void UTPSProceduralAnimInstance::FillLayer(FTPSProcClipLayer& Layer, const FTPSActionState& Action, const FTransform& ComponentTransform) const
{
	Layer = FTPSProcClipLayer();
	UAnimSequence* Seq = Action.Seq.Get();
	if (!Seq || Action.Weight <= 0.f)
	{
		return;
	}
	Layer.Seq = Seq;
	Layer.Time = Action.Time;
	Layer.Length = Seq->GetPlayLength();
	Layer.Weight = Action.Weight;
	Layer.bUpperBody = Action.bUpperBody;
	Layer.bInPlace = !Action.bUpperBody;
	Layer.bHasDisplacement = Action.bHasDisplacement;
	Layer.Displacement = ComponentTransform.InverseTransformVectorNoScale(Action.Displacement);
	if (Character)
	{
		Layer.CapsuleDelta = ComponentTransform.InverseTransformVectorNoScale(Character->GetActorLocation() - Action.StartLocation);
	}
}

void UTPSProceduralAnimInstance::UpdateBarrelCorrection(float DeltaSeconds)
{
	const ATPSWeapon* Weapon = Character ? Character->GetCurrentWeapon() : nullptr;
	const bool bActive = bAlignBarrelToAim && Weapon && !Weapon->IsHidden() && !bIsTraversing && !bIsDead && !IsUpperBodyActionActive()
		&& Character->HasSkeletalVisual();
	if (!bActive)
	{
		const float Decay = FMath::Clamp(DeltaSeconds * 4.f, 0.f, 1.f);
		CorrectionYaw -= CorrectionYaw * Decay;
		CorrectionPitch -= CorrectionPitch * Decay;
		return;
	}
	const FRotator Barrel = Weapon->GetActorForwardVector().Rotation();
	const FRotator Aim = Character->GetAnimAimRotation();
	const float Gain = FMath::Clamp(DeltaSeconds * 6.f, 0.f, 1.f);
	CorrectionYaw = FMath::Clamp(CorrectionYaw + FMath::FindDeltaAngleDegrees(Barrel.Yaw, Aim.Yaw) * Gain, -MaxBarrelCorrection, MaxBarrelCorrection);
	CorrectionPitch = FMath::Clamp(CorrectionPitch + FMath::FindDeltaAngleDegrees(Barrel.Pitch, Aim.Pitch) * Gain, -MaxBarrelCorrection, MaxBarrelCorrection);
}

void UTPSProceduralAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
	Super::NativeUpdateAnimation(DeltaSeconds);

	FTPSProceduralAnimProxy& Proxy = GetProxyOnGameThread<FTPSProceduralAnimProxy>();
	FTPSProcAnimFrame& F = Proxy.Frame;
	USkeletalMeshComponent* MeshComp = GetSkelMeshComponent();
	if (!Character || !MeshComp)
	{
		F = FTPSProcAnimFrame();
		F.BasePose.Seq = RiflePose;
		return;
	}
	const float Dt = FMath::Max(DeltaSeconds, 0.f);
	const FTransform CT = MeshComp->GetComponentTransform();
	F.Forward = CT.InverseTransformVectorNoScale(Character->GetActorForwardVector()).GetSafeNormal();
	F.Right = CT.InverseTransformVectorNoScale(Character->GetActorRightVector()).GetSafeNormal();
	F.Up = CT.InverseTransformVectorNoScale(Character->GetActorUpVector()).GetSafeNormal();

	// Gait.
	FVector Planar = Character->GetVelocity();
	Planar.Z = 0.f;
	if (Planar.SizeSquared() > 25.f)
	{
		SmoothMoveDir = FMath::VInterpNormalRotationTo(SmoothMoveDir, Planar.GetSafeNormal(), Dt, 540.f);
	}
	F.MoveDir = CT.InverseTransformVectorNoScale(SmoothMoveDir).GetSafeNormal();

	const float WalkSpeed = FMath::Max(1.f, Character->WalkSpeed);
	const float RunSpeed = FMath::Max(WalkSpeed + 1.f, Character->RunSpeed);
	float MoveTarget = FMath::Clamp(Speed / (WalkSpeed * 0.85f), 0.f, 1.f);
	if (bIsTurningInPlace)
	{
		MoveTarget = FMath::Max(MoveTarget, 0.3f);
	}
	if (bIsInAir || bIsTraversing)
	{
		MoveTarget = 0.f;
	}
	SmoothMove = FMath::FInterpTo(SmoothMove, MoveTarget, Dt, 10.f);
	SmoothRun = FMath::FInterpTo(SmoothRun, FMath::Clamp((Speed - WalkSpeed) / (RunSpeed - WalkSpeed), 0.f, 1.f), Dt, 6.f);
	SmoothCrouch = FMath::FInterpTo(SmoothCrouch, bIsCrouching ? 1.f : 0.f, Dt, 10.f);
	SmoothAir = FMath::FInterpTo(SmoothAir, (bIsInAir && !bIsTraversing) ? 1.f : 0.f, Dt, 8.f);

	const float Stride = FMath::Lerp(FMath::Lerp(WalkStride, RunStride, SmoothRun), CrouchStride, SmoothCrouch);
	const float CycleSpeed = FMath::Max(Speed, bIsTurningInPlace ? 70.f : 0.f);
	GaitPhase = FMath::Fmod(GaitPhase + 2.f * PI * CycleSpeed / FMath::Max(Stride, 1.f) * Dt, 2.f * PI);
	F.Phase = GaitPhase;
	F.MoveAlpha = SmoothMove;
	F.RunAlpha = SmoothRun;
	F.AirAlpha = SmoothAir;
	F.CrouchDrop = Character->CrouchDrop;

	// Poses.
	const ATPSWeapon* Weapon = Character->GetCurrentWeapon();
	UAnimSequence* Base = PickPose(WeaponPose);
	float BaseTime = 0.f;
	if (Weapon)
	{
		if (UAnimSequence* Override = Cast<UAnimSequence>(Weapon->Anims.IdlePose.Get()))
		{
			if (IsPlayable(Override))
			{
				Base = Override;
				BaseTime = Weapon->Anims.IdlePoseTime;
			}
		}
	}
	F.BasePose = FTPSProcClipLayer();
	F.BasePose.Seq = Base;
	F.BasePose.Time = BaseTime;
	F.BasePose.Weight = 1.f;

	F.MovePose = FTPSProcClipLayer();
	if (WeaponPose == ETPSWeaponPoseType::Rifle && Base == RiflePose)
	{
		F.MovePose.Seq = RifleMovePose;
		F.MovePose.Weight = SmoothMove * (1.f - SmoothCrouch);
	}
	F.CrouchPose = FTPSProcClipLayer();
	float PoseCrouch = 0.f;
	if (WeaponPose == ETPSWeaponPoseType::Sniper && SniperCrouchPose)
	{
		PoseCrouch = SmoothCrouch * (1.f - SmoothMove);
		F.CrouchPose.Seq = SniperCrouchPose;
		F.CrouchPose.Weight = PoseCrouch;
	}
	F.CrouchAlpha = SmoothCrouch * (1.f - PoseCrouch);

	// Actions.
	TickAction(Previous, Dt);
	TickAction(Current, Dt);
	FillLayer(F.Actions[0], Previous, CT);
	FillLayer(F.Actions[1], Current, CT);

	// Upper body.
	UpdateBarrelCorrection(Dt);
	F.SpinePitch = FMath::Clamp(AimPitch, -70.f, 70.f) + CorrectionPitch;
	F.SpineYaw = FMath::Clamp(AimYaw, -90.f, 90.f) + CorrectionYaw;
	F.LeanAngle = LeanAngle;
	RecoilKick = FMath::FInterpTo(RecoilKick, RecoilAlpha * 6.f, Dt, 30.f);
	F.Recoil = RecoilKick;
	const float SinceHit = Character->GetTimeSinceHit();
	F.HitReact = SinceHit < 1.f ? FMath::Exp(-SinceHit * 8.f) : 0.f;
	F.LowerWeapon = Weapon ? 1.f - Weapon->GetReadyAlpha() : 0.f;
}
