#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "Core/TPSStatics.h"
#include "TPSFX.generated.h"

class UStaticMeshComponent;
class UPointLightComponent;
class UNiagaraSystem;

/** Short-lived shape effect (tracer, flash, spark, debris, shell) that scales, moves and fades its light. */
UCLASS(NotBlueprintable)
class TPSENGINE_API ATPSTransientFX : public AActor
{
	GENERATED_BODY()

public:
	ATPSTransientFX();
	virtual void Tick(float DeltaSeconds) override;

	void Init(ETPSShape Shape, const FLinearColor& Color, const FVector& InStartScale, const FVector& InEndScale, float InLifeTime,
		const FVector& InVelocity = FVector::ZeroVector, bool bInGravity = false, float LightIntensity = 0.f, float LightRadius = 0.f);

	UPROPERTY(VisibleAnywhere, Category = "TPS|FX") TObjectPtr<UStaticMeshComponent> MeshComp;
	UPROPERTY(VisibleAnywhere, Category = "TPS|FX") TObjectPtr<UPointLightComponent> Light;

	FRotator SpinRate = FRotator::ZeroRotator;

private:
	FVector StartScale = FVector::OneVector;
	FVector EndScale = FVector::OneVector;
	FVector Velocity = FVector::ZeroVector;
	float LifeTime = 0.1f;
	float Age = 0.f;
	float StartLight = 0.f;
	bool bGravity = false;
};

/** Procedural combat effects that work without any content. Niagara overrides are used when assigned on the weapon. */
UCLASS()
class TPSENGINE_API UTPSFX : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "TPS|FX", meta = (WorldContext = "WorldContextObject"))
	static void Tracer(const UObject* WorldContextObject, FVector Start, FVector End, FLinearColor Color, float Thickness = 1.f);

	UFUNCTION(BlueprintCallable, Category = "TPS|FX", meta = (WorldContext = "WorldContextObject"))
	static void MuzzleFlash(const UObject* WorldContextObject, FVector Location, FVector Direction, float Size = 1.f);

	UFUNCTION(BlueprintCallable, Category = "TPS|FX", meta = (WorldContext = "WorldContextObject"))
	static void Impact(const UObject* WorldContextObject, FVector Location, FVector Normal, bool bFlesh, UNiagaraSystem* Override);

	UFUNCTION(BlueprintCallable, Category = "TPS|FX", meta = (WorldContext = "WorldContextObject"))
	static void Explosion(const UObject* WorldContextObject, FVector Location, float Radius);

	UFUNCTION(BlueprintCallable, Category = "TPS|FX", meta = (WorldContext = "WorldContextObject"))
	static void Shell(const UObject* WorldContextObject, FVector Location, FVector Velocity);

	UFUNCTION(BlueprintCallable, Category = "TPS|FX", meta = (WorldContext = "WorldContextObject"))
	static void SpawnNiagara(const UObject* WorldContextObject, UNiagaraSystem* System, FVector Location, FRotator Rotation);

	static ATPSTransientFX* SpawnShapeFX(const UObject* WorldContextObject, const FVector& Location, const FRotator& Rotation);
};
