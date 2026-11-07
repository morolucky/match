#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/TPSTypes.h"
#include "TPSWeapon.generated.h"

class USceneComponent;
class UStaticMeshComponent;
class USkeletalMeshComponent;
class UPointLightComponent;
class UNiagaraSystem;
class ATPSCharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FTPSOnWeaponEvent, ATPSWeapon*, Weapon);

/**
 * Hitscan weapon with pellets, bloom, recoil, pump/bolt cycling, magazine or shell-by-shell reloads and rocket blasts.
 * Pick a Preset for the ported stock weapons, or set Preset = Custom and edit Stats in a Blueprint child.
 */
UCLASS(Blueprintable)
class TPSENGINE_API ATPSWeapon : public AActor
{
	GENERATED_BODY()

public:
	ATPSWeapon();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Weapon") TObjectPtr<USceneComponent> Root;
	/** Recoil kick is applied to this component; meshes hang under it. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Weapon") TObjectPtr<USceneComponent> KickRoot;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Weapon") TObjectPtr<UStaticMeshComponent> Mesh;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Weapon") TObjectPtr<USkeletalMeshComponent> SkeletalMesh;
	/** Bullets and flashes start here. Move it to the barrel tip of your mesh. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Weapon") TObjectPtr<USceneComponent> Muzzle;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Weapon") TObjectPtr<USceneComponent> ShellEject;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "TPS|Weapon") TObjectPtr<UPointLightComponent> MuzzleLight;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Weapon") ETPSWeaponPreset Preset = ETPSWeaponPreset::M4;
	/** When true (and Preset != Custom) Stats are overwritten by the preset at BeginPlay. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Weapon") bool bUsePresetStats = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Weapon") bool bAutoLoadDefaultContent = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Weapon") FTPSWeaponStats Stats;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Weapon") FTPSWeaponAudio Audio;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Weapon") FTPSWeaponAnims Anims;
	/** Relative transform when attached to a hand socket (custom AnimBP without hand placement). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Weapon") FTransform GripOffset;
	/** Weapon-space points where the right wrist (hand_r) and the left/support wrist (hand_l) hold the weapon. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Weapon") FVector RightHandGrip = FVector(12.f, 0.f, -4.f);
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Weapon") FVector LeftHandGrip = FVector(40.f, 0.f, 0.f);
	/** Long guns are aimed by both hands; one-handed weapons point straight at the aim. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Weapon") bool bTwoHanded = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|FX") TObjectPtr<UNiagaraSystem> MuzzleFlashFX;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|FX") TObjectPtr<UNiagaraSystem> ImpactFX;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|FX") TObjectPtr<UNiagaraSystem> ExplosionFX;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|FX") FLinearColor TracerColor = FLinearColor(1.f, 0.85f, 0.4f);
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|FX") bool bEjectShells = true;

	UPROPERTY(BlueprintAssignable, Category = "TPS|Weapon") FTPSOnWeaponEvent OnFired;
	UPROPERTY(BlueprintAssignable, Category = "TPS|Weapon") FTPSOnWeaponEvent OnReloadStarted;
	UPROPERTY(BlueprintAssignable, Category = "TPS|Weapon") FTPSOnWeaponEvent OnReloadFinished;

	/** Ported stock stats (pistol, M4, shotgun, Kar98k, RPG-7, AK-74M, Benelli M4). */
	UFUNCTION(BlueprintPure, Category = "TPS|Weapon")
	static FTPSWeaponStats MakePresetStats(ETPSWeaponPreset InPreset);

	// ---- Control (called by UTPSCombatComponent) ----
	void SetEquipped(bool bEquipped, float ReadyDelay);
	void PullTrigger();
	void ReleaseTrigger();
	UFUNCTION(BlueprintCallable, Category = "TPS|Weapon") bool StartReload();
	UFUNCTION(BlueprintCallable, Category = "TPS|Weapon") void CancelReload();
	UFUNCTION(BlueprintCallable, Category = "TPS|Weapon") void RefillAmmo();

	// ---- Queries ----
	UFUNCTION(BlueprintPure, Category = "TPS|Weapon") int32 GetAmmo() const { return AmmoInMag; }
	UFUNCTION(BlueprintPure, Category = "TPS|Weapon") int32 GetMagazineSize() const { return Stats.MagazineSize; }
	UFUNCTION(BlueprintPure, Category = "TPS|Weapon") int32 GetReserveAmmo() const { return ReserveAmmo; }
	UFUNCTION(BlueprintPure, Category = "TPS|Weapon") bool IsReloading() const { return bReloading; }
	UFUNCTION(BlueprintPure, Category = "TPS|Weapon") bool IsCycling() const { return bCycling; }
	UFUNCTION(BlueprintPure, Category = "TPS|Weapon") float GetReloadProgress() const;
	/** Current spread multiplier for the dynamic crosshair (1 = base). */
	UFUNCTION(BlueprintPure, Category = "TPS|Weapon") float GetSpreadMultiplier() const;
	UFUNCTION(BlueprintPure, Category = "TPS|Weapon") float GetRecoilAlpha() const { return RecoilAlpha; }
	UFUNCTION(BlueprintPure, Category = "TPS|Weapon") FVector GetMuzzleLocation() const;
	UFUNCTION(BlueprintPure, Category = "TPS|Weapon") bool CanFireNow() const;
	/** 0 right after equipping, 1 once ready to fire (drives the raise animation). */
	UFUNCTION(BlueprintPure, Category = "TPS|Weapon") float GetReadyAlpha() const;

	ATPSCharacter* GetOwningCharacter() const;

protected:
	void TryFire();
	void FireShot();
	void ProcessHit(const FHitResult& Hit, const FVector& Dir, ATPSCharacter* Shooter, bool& bOutHitTarget, bool& bOutHeadshot, bool& bOutKill);
	void Explode(const FVector& Location, AActor* DirectVictim, ATPSCharacter* Shooter);
	void FinishReload();
	void TickReload(float Now);
	void TickCycle(float Now);
	void ApplyKick();
	void BuildPlaceholderVisual();
	void AutoLoadContent();
	float GetNow() const;

	int32 AmmoInMag = 0;
	int32 ReserveAmmo = 0;
	bool bTriggerHeld = false;
	bool bFiredThisPull = false;
	bool bEquippedState = false;
	float ReadyTime = 0.f;
	float EquipDuration = 0.f;
	float NextFireTime = 0.f;
	float Bloom = 0.f;
	float RecoilAlpha = 0.f;

	bool bReloading = false;
	bool bReloadFromEmpty = false;
	bool bCancelAfterShell = false;
	float ReloadStart = 0.f;
	float ReloadDuration = 0.f;
	float NextShellTime = 0.f;
	bool bMagOutPlayed = false;
	bool bMagInPlayed = false;
	bool bCyclePlayedInReload = false;

	bool bCycling = false;
	bool bCycleSoundPlayed = false;
	float CycleStart = 0.f;
	float CycleEnd = 0.f;

	float MuzzleLightOffTime = 0.f;
	FVector KickOffset = FVector::ZeroVector;
	FRotator KickRotation = FRotator::ZeroRotator;
};
