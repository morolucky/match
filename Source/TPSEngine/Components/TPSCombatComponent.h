#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Core/TPSTypes.h"
#include "TPSCombatComponent.generated.h"

class ATPSWeapon;
class ATPSCharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FTPSOnWeaponChanged, ATPSWeapon*, NewWeapon, int32, SlotIndex);

/** Weapon inventory, aim stages (aim / scope), fire and reload routing. */
UCLASS(ClassGroup = (TPS), meta = (BlueprintSpawnableComponent))
class TPSENGINE_API UTPSCombatComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UTPSCombatComponent();

	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	/** Blueprint weapon classes. When empty, DefaultPresets are spawned as stock ATPSWeapon actors. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Combat") TArray<TSubclassOf<ATPSWeapon>> WeaponClasses;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Combat") TArray<ETPSWeaponPreset> DefaultPresets;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Combat") int32 StartingSlot = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Combat") float EquipTime = 0.35f;
	/** Shooting from the hip raises the weapon to aim for this long. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Combat") float FireAimHoldTime = 0.85f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Combat") float AimInterpSpeed = 12.f;
	/** Placeholder-weapon holder offsets (no skeletal mesh). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Combat") FVector HipHoldOffset = FVector(30.f, 16.f, 30.f);
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Combat") FVector AimHoldOffset = FVector(34.f, 12.f, 52.f);

	UPROPERTY(BlueprintAssignable, Category = "TPS|Combat") FTPSOnWeaponChanged OnWeaponChanged;

	UFUNCTION(BlueprintCallable, Category = "TPS|Combat") void EquipSlot(int32 Slot);
	UFUNCTION(BlueprintCallable, Category = "TPS|Combat") void CycleWeapon(int32 Direction);
	UFUNCTION(BlueprintCallable, Category = "TPS|Combat") void StartFire();
	UFUNCTION(BlueprintCallable, Category = "TPS|Combat") void StopFire();
	UFUNCTION(BlueprintCallable, Category = "TPS|Combat") void Reload();
	/** RMB: toggles aim stages (hip -> aim -> scope -> hip) or holds, per user setting. */
	UFUNCTION(BlueprintCallable, Category = "TPS|Combat") void AimPressed();
	UFUNCTION(BlueprintCallable, Category = "TPS|Combat") void AimReleased();
	UFUNCTION(BlueprintCallable, Category = "TPS|Combat") void SetAimStage(int32 Stage);
	UFUNCTION(BlueprintCallable, Category = "TPS|Combat") void RefillAllAmmo();
	void OnOwnerDied();

	UFUNCTION(BlueprintPure, Category = "TPS|Combat") ATPSWeapon* GetCurrentWeapon() const;
	UFUNCTION(BlueprintPure, Category = "TPS|Combat") int32 GetCurrentSlot() const { return CurrentSlot; }
	UFUNCTION(BlueprintPure, Category = "TPS|Combat") TArray<ATPSWeapon*> GetWeapons() const;
	UFUNCTION(BlueprintPure, Category = "TPS|Combat") bool IsAiming() const;
	UFUNCTION(BlueprintPure, Category = "TPS|Combat") float GetAimAlpha() const { return AimAlpha; }
	UFUNCTION(BlueprintPure, Category = "TPS|Combat") int32 GetAimStage() const { return AimStage; }
	UFUNCTION(BlueprintPure, Category = "TPS|Combat") bool IsScoped() const;
	UFUNCTION(BlueprintPure, Category = "TPS|Combat") bool HasFiredRecently() const { return FireAimTimer > 0.f; }
	UFUNCTION(BlueprintPure, Category = "TPS|Combat") bool IsTriggerDown() const { return bTriggerDown; }

private:
	void SpawnLoadout();
	void AttachWeapon(ATPSWeapon* Weapon) const;
	ATPSCharacter* GetOwnerCharacter() const;
	bool IsOwnerBusy() const;

	UPROPERTY() TArray<TObjectPtr<ATPSWeapon>> Weapons;
	int32 CurrentSlot = -1;
	int32 AimStage = 0;
	float AimAlpha = 0.f;
	float FireAimTimer = 0.f;
	bool bTriggerDown = false;
};
