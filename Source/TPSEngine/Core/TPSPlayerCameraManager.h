#pragma once

#include "CoreMinimal.h"
#include "Camera/PlayerCameraManager.h"
#include "TPSPlayerCameraManager.generated.h"

/** Trauma-based camera shake and FOV kick (web build juice.js: trauma decays 1.35/s, intensity = trauma^2). */
UCLASS()
class TPSENGINE_API ATPSPlayerCameraManager : public APlayerCameraManager
{
	GENERATED_BODY()

public:
	ATPSPlayerCameraManager();

	UFUNCTION(BlueprintCallable, Category = "TPS|Camera") void AddTrauma(float Amount) { Trauma = FMath::Clamp(Trauma + Amount, 0.f, 1.f); }
	UFUNCTION(BlueprintCallable, Category = "TPS|Camera") void AddFOVKick(float Degrees) { FOVKick = FMath::Max(FOVKick, Degrees); }
	UFUNCTION(BlueprintPure, Category = "TPS|Camera") float GetTrauma() const { return Trauma; }

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float TraumaDecay = 1.35f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float MaxYawPitchShake = 1.26f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float MaxRollShake = 1.76f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float ShakeFrequency = 22.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float RollFrequency = 18.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float ScopedShakeScale = 0.12f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Camera") float FOVKickDecay = 5.f;

protected:
	virtual void UpdateViewTarget(FTViewTarget& OutVT, float DeltaTime) override;

private:
	float Trauma = 0.f;
	float FOVKick = 0.f;
	float NoiseTime = 0.f;
};
