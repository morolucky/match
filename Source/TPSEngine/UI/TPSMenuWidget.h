#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Core/TPSTypes.h"
#include "TPSMenuWidget.generated.h"

class UWidgetSwitcher;
class UTextBlock;
class UVerticalBox;
class USlider;
class UCheckBox;
class UImage;

UENUM(BlueprintType)
enum class ETPSMenuPanel : uint8
{
	Main,
	Pause,
	GameOver,
	Settings,
	Controls
};

/** Mode select, pause, game-over summary, settings and controls screens (built in C++). */
UCLASS(Blueprintable)
class TPSENGINE_API UTPSMenuWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "TPS|Menu") void ShowPanel(ETPSMenuPanel Panel);
	UFUNCTION(BlueprintCallable, Category = "TPS|Menu") void RefreshGameOver();

protected:
	virtual void NativeOnInitialized() override;

	UFUNCTION() void OnAimTrainer();
	UFUNCTION() void OnVersusAI();
	UFUNCTION() void OnSettings();
	UFUNCTION() void OnControls();
	UFUNCTION() void OnQuit();
	UFUNCTION() void OnResume();
	UFUNCTION() void OnRestart();
	UFUNCTION() void OnMainMenu();
	UFUNCTION() void OnOtherMode();
	UFUNCTION() void OnBack();
	UFUNCTION() void OnResetSettings();

	UFUNCTION() void OnMouseSens(float Value);
	UFUNCTION() void OnAimSens(float Value);
	UFUNCTION() void OnPadSens(float Value);
	UFUNCTION() void OnFOV(float Value);
	UFUNCTION() void OnVolume(float Value);
	UFUNCTION() void OnInvertY(bool bChecked);
	UFUNCTION() void OnHoldAim(bool bChecked);
	UFUNCTION() void OnAutoFire(bool bChecked);
	UFUNCTION() void OnShake(bool bChecked);
	UFUNCTION() void OnHitStop(bool bChecked);
	UFUNCTION() void OnShowFPS(bool bChecked);

private:
	void BuildLayout();
	UVerticalBox* MakePanel(const FString& Title, const FString& Subtitle, UTextBlock** OutTitle = nullptr, UTextBlock** OutSubtitle = nullptr);
	void AddMenuButton(UVerticalBox* Panel, const FString& Label, FName Handler, UTextBlock** OutLabel = nullptr);
	USlider* AddSliderRow(UVerticalBox* Panel, const FString& Label, float Min, float Max, float Step, float Value, UTextBlock** OutValue);
	UCheckBox* AddCheckRow(UVerticalBox* Panel, const FString& Label, bool bValue);
	void SyncSettingsWidgets();
	void UpdateSliderLabels();
	void ApplyShowFPS(bool bShow);

	UPROPERTY() TObjectPtr<UWidgetSwitcher> Switcher;
	UPROPERTY() TObjectPtr<UImage> Dim;
	UPROPERTY() TObjectPtr<UTextBlock> GameOverTitle;
	UPROPERTY() TObjectPtr<UTextBlock> GameOverSubtitle;
	UPROPERTY() TObjectPtr<UTextBlock> GameOverStats;
	UPROPERTY() TObjectPtr<UTextBlock> OtherModeLabel;

	UPROPERTY() TObjectPtr<USlider> MouseSlider;
	UPROPERTY() TObjectPtr<USlider> AimSlider;
	UPROPERTY() TObjectPtr<USlider> PadSlider;
	UPROPERTY() TObjectPtr<USlider> FOVSlider;
	UPROPERTY() TObjectPtr<USlider> VolumeSlider;
	UPROPERTY() TObjectPtr<UTextBlock> MouseValue;
	UPROPERTY() TObjectPtr<UTextBlock> AimValue;
	UPROPERTY() TObjectPtr<UTextBlock> PadValue;
	UPROPERTY() TObjectPtr<UTextBlock> FOVValue;
	UPROPERTY() TObjectPtr<UTextBlock> VolumeValue;
	UPROPERTY() TObjectPtr<UCheckBox> InvertCheck;
	UPROPERTY() TObjectPtr<UCheckBox> HoldAimCheck;
	UPROPERTY() TObjectPtr<UCheckBox> AutoFireCheck;
	UPROPERTY() TObjectPtr<UCheckBox> ShakeCheck;
	UPROPERTY() TObjectPtr<UCheckBox> HitStopCheck;
	UPROPERTY() TObjectPtr<UCheckBox> FPSCheck;

	ETPSMenuPanel CurrentPanel = ETPSMenuPanel::Main;
	ETPSMenuPanel ReturnPanel = ETPSMenuPanel::Main;
	bool bBuilt = false;
	bool bFPSShown = false;
	bool bSyncing = false;
};
