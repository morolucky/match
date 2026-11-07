#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Core/TPSTypes.h"
#include "TPSHealthComponent.generated.h"

class AController;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FTPSOnHealthChanged, float, NewHealth, float, Delta);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_FourParams(FTPSOnDamaged, float, Damage, FVector, SourceLocation, ETPSHitZone, Zone, AController*, InstigatorController);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FTPSOnDeath, AActor*, Victim, AController*, Killer, bool, bHeadshot);

/** Health, damage, regeneration and death. Works on any actor. */
UCLASS(ClassGroup = (TPS), meta = (BlueprintSpawnableComponent))
class TPSENGINE_API UTPSHealthComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UTPSHealthComponent();

	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	/** Applies already-scaled damage. Returns the amount actually removed. */
	UFUNCTION(BlueprintCallable, Category = "TPS|Health")
	float ApplyDamage(float Amount, FVector SourceLocation, ETPSHitZone Zone, AController* InstigatorController);

	UFUNCTION(BlueprintCallable, Category = "TPS|Health")
	float Heal(float Amount);

	UFUNCTION(BlueprintCallable, Category = "TPS|Health")
	void ResetHealth();

	UFUNCTION(BlueprintPure, Category = "TPS|Health") float GetHealth() const { return Health; }
	UFUNCTION(BlueprintPure, Category = "TPS|Health") float GetMaxHealth() const { return MaxHealth; }
	UFUNCTION(BlueprintPure, Category = "TPS|Health") float GetHealthPercent() const { return MaxHealth > 0.f ? Health / MaxHealth : 0.f; }
	UFUNCTION(BlueprintPure, Category = "TPS|Health") bool IsDead() const { return bDead; }
	UFUNCTION(BlueprintPure, Category = "TPS|Health") float GetTimeSinceDamage() const;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Health") float MaxHealth = 100.f;
	/** HP per second once RegenDelay has passed without damage (0 disables). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Health") float RegenRate = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Health") float RegenDelay = 3.5f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Health") bool bInvulnerable = false;

	UPROPERTY(BlueprintAssignable, Category = "TPS|Health") FTPSOnHealthChanged OnHealthChanged;
	UPROPERTY(BlueprintAssignable, Category = "TPS|Health") FTPSOnDamaged OnDamaged;
	UPROPERTY(BlueprintAssignable, Category = "TPS|Health") FTPSOnDeath OnDeath;

private:
	float Health = 100.f;
	float LastDamageTime = -1000.f;
	bool bDead = false;
};
