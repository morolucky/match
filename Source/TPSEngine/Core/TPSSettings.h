#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "TPSSettings.generated.h"

UCLASS()
class TPSENGINE_API UTPSSettingsSave : public USaveGame
{
	GENERATED_BODY()

public:
	UPROPERTY() float MouseSensitivity = 1.f;
	UPROPERTY() float AimSensitivityScale = 0.75f;
	UPROPERTY() float GamepadSensitivity = 1.f;
	UPROPERTY() bool bInvertY = false;
	UPROPERTY() float FieldOfView = 80.f;
	UPROPERTY() float MasterVolume = 1.f;
	UPROPERTY() bool bAutoFire = false;
	UPROPERTY() bool bShowFPS = false;
	UPROPERTY() bool bCameraShake = true;
	UPROPERTY() bool bHitStop = true;
	UPROPERTY() bool bHoldToAim = false;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FTPSOnSettingsChanged);

/** Persistent user settings (Settings menu). Saved to the "TPSSettings" slot. */
UCLASS()
class TPSENGINE_API UTPSSettingsSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	UFUNCTION(BlueprintPure, Category = "TPS|Settings")
	UTPSSettingsSave* GetSettings() const { return Settings; }

	UFUNCTION(BlueprintCallable, Category = "TPS|Settings")
	void SaveSettings();

	UFUNCTION(BlueprintCallable, Category = "TPS|Settings")
	void ResetToDefaults();

	static UTPSSettingsSave* Get(const UObject* WorldContextObject);

	UPROPERTY(BlueprintAssignable, Category = "TPS|Settings")
	FTPSOnSettingsChanged OnSettingsChanged;

private:
	UPROPERTY() TObjectPtr<UTPSSettingsSave> Settings;
};
