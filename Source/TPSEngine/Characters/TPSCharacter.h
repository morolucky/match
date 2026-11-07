#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Core/TPSTypes.h"
#include "TPSCharacter.generated.h"

class UTPSHealthComponent;
class UTPSCombatComponent;
class UTPSTraversalComponent;
class UStaticMeshComponent;
class USceneComponent;
class ATPSWeapon;
class UAnimSequenceBase;
class UAnimMontage;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FTPSOnCharacterDied, ATPSCharacter*, Character);

/**
 * Shared base for the player and AI soldiers: movement (walk/run/crouch/lean), turn-in-place,
 * health, weapons (UTPSCombatComponent), traversal (mantle/roll/ladder) and death.
 *
 * Works with no content at all (placeholder mannequin built from engine shapes). Assign a Skeletal Mesh +
 * an AnimBP derived from UTPSAnimInstance in a Blueprint child to use a real character.
 */
UCLASS(Abstract)
class TPSENGINE_API ATPSCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	ATPSCharacter(const FObjectInitializer& ObjectInitializer);

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual float TakeDamage(float DamageAmount, struct FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

	// ---- Components ----
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS") TObjectPtr<UTPSHealthComponent> Health;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS") TObjectPtr<UTPSCombatComponent> Combat;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS") TObjectPtr<UTPSTraversalComponent> Traversal;
	/** Root of the shape-based stand-in body; hidden automatically when a skeletal mesh is assigned. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS") TObjectPtr<USceneComponent> PlaceholderRoot;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS") TObjectPtr<UStaticMeshComponent> PlaceholderBody;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS") TObjectPtr<UStaticMeshComponent> PlaceholderHead;
	/** Weapon attach point used when the skeletal mesh has no WeaponSocket. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS") TObjectPtr<USceneComponent> WeaponHolder;

	// ---- Tuning (defaults ported from the web build) ----
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Movement") float WalkSpeed = 140.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Movement") float RunSpeed = 400.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Movement") float AimSpeedMultiplier = 0.86f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Movement") float StrafeSpeedMultiplier = 0.9f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Movement") float BackpedalSpeedMultiplier = 0.75f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Movement") float LeanSpeedMultiplier = 0.8f;
	/** Capsule shrink on crouch (camera drops the same amount). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Movement") float CrouchDrop = 34.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Movement") float TurnRate = 540.f;
	/** Idle turn-in-place begins above this yaw error and stops below TurnInPlaceStopAngle. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Movement") float TurnInPlaceStartAngle = 60.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Movement") float TurnInPlaceStopAngle = 6.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Lean") float MaxLeanOffset = 22.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Lean") float LeanSpeed = 7.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Weapon") FName WeaponSocket = TEXT("hand_r");
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Animation") FTPSCharacterAnimSet AnimSet;
	/** Fill empty mesh/anim/sound slots from /Game/TPS/... (created by Scripts/import_tps_assets.py). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Animation") bool bAutoLoadDefaultContent = true;
	/** Seconds before a dead body is removed (0 = keep). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Health") float CorpseLifeSpan = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Visual") FLinearColor PlaceholderColor = FLinearColor(0.6f, 0.62f, 0.66f);

	UPROPERTY(BlueprintAssignable, Category = "TPS") FTPSOnCharacterDied OnCharacterDied;

	// ---- Actions ----
	UFUNCTION(BlueprintCallable, Category = "TPS|Movement") void SetRunning(bool bRun) { bWantsRun = bRun; }
	UFUNCTION(BlueprintCallable, Category = "TPS|Movement") void ToggleCrouch();
	UFUNCTION(BlueprintCallable, Category = "TPS|Movement") void SetLeanInput(float Direction) { LeanInput = FMath::Clamp(Direction, -1.f, 1.f); }

	/** Plays a sequence/montage on a slot as a dynamic montage. Returns its duration (0 if not played). */
	UFUNCTION(BlueprintCallable, Category = "TPS|Animation")
	float PlayActionAnim(UAnimSequenceBase* Anim, float PlayRate = 1.f, int32 Loops = 1, bool bUpperBodyOnly = false, float BlendIn = 0.15f, float BlendOut = 0.2f);
	UFUNCTION(BlueprintCallable, Category = "TPS|Animation") void StopActionAnim(float BlendOut = 0.2f);
	UFUNCTION(BlueprintCallable, Category = "TPS|Animation") void SetActionAnimRate(float PlayRate);
	UFUNCTION(BlueprintCallable, Category = "TPS|Animation") void SetActionAnimPaused(bool bPaused);

	// ---- Combat hooks ----
	/** Origin and direction used by weapons. Base: eyes + control rotation. */
	virtual void GetAimRay(FVector& OutStart, FVector& OutDir) const;
	/** Multiplier on weapon spread (AI computes its own aim error and returns 0). */
	virtual float GetSpreadScale() const { return 1.f; }
	/** Final damage for a hit on this character. */
	virtual float ModifyIncomingDamage(float BaseDamage, ETPSHitZone Zone, const ATPSCharacter* Shooter) const { return BaseDamage; }
	/** Weapon hit entry point. Returns applied damage; bOutKilled is true when this hit killed. */
	virtual float ReceiveWeaponHit(float BaseDamage, const FHitResult& Hit, ATPSCharacter* Shooter, bool& bOutKilled, ETPSHitZone& OutZone);
	/** Explosion / non-bullet damage with an explicit zone. */
	virtual float ReceiveDirectDamage(float Damage, FVector SourceLocation, ETPSHitZone Zone, ATPSCharacter* Shooter, bool& bOutKilled);
	virtual void OnWeaponFired(ATPSWeapon* Weapon) {}

	// ---- Queries (also used by the AnimInstance and UI) ----
	UFUNCTION(BlueprintPure, Category = "TPS") bool IsDead() const;
	UFUNCTION(BlueprintPure, Category = "TPS") bool IsRunning() const { return bIsRunning; }
	UFUNCTION(BlueprintPure, Category = "TPS") float GetLeanAmount() const { return LeanAmount; }
	UFUNCTION(BlueprintPure, Category = "TPS") bool IsTurningInPlace() const { return bTurningInPlace; }
	UFUNCTION(BlueprintPure, Category = "TPS") float GetMoveSpeedAlpha() const;
	UFUNCTION(BlueprintPure, Category = "TPS") ATPSWeapon* GetCurrentWeapon() const;
	UFUNCTION(BlueprintPure, Category = "TPS") bool HasSkeletalVisual() const { return bHasSkeletalVisual; }
	UFUNCTION(BlueprintPure, Category = "TPS") virtual bool IsAimingWeapon() const;

	/** Facing yaw the character tries to hold (control yaw for the player, aim focus for AI). */
	virtual float GetDesiredFacingYaw() const;
	/** True when the character should face its aim direction instead of idling. */
	virtual bool WantsToFaceAim() const;

	USceneComponent* GetWeaponAttachParent(FName& OutSocket) const;

protected:
	UFUNCTION() virtual void HandleDeath(AActor* Victim, AController* Killer, bool bHeadshot);
	virtual void UpdateMovementSpeed();
	virtual void UpdateLean(float DeltaSeconds);
	virtual void UpdateFacing(float DeltaSeconds);
	void AutoLoadContent();
	void RefreshVisualMode();

	bool bWantsRun = false;
	bool bIsRunning = false;
	float LeanInput = 0.f;
	float LeanAmount = 0.f;
	bool bTurningInPlace = false;
	bool bHasSkeletalVisual = false;
	float DeathTipAlpha = -1.f;
};
