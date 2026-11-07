#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "TPSAnimStudioWidget.generated.h"

class UAnimSequenceBase;
class UTextBlock;
class USlider;
class UCheckBox;

/**
 * Runtime "Animation Studio" (web build motion-studio.js): browse the imported clips and preview them on the
 * player with play/pause, restart, loop and speed. Toggle with K.
 */
UCLASS(Blueprintable)
class TPSENGINE_API UTPSAnimStudioWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	/** Extra clips to list (the stock clips under /Game/TPS/Animations are found automatically). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|AnimStudio") TArray<TObjectPtr<UAnimSequenceBase>> ExtraClips;

	UFUNCTION(BlueprintCallable, Category = "TPS|AnimStudio") void RefreshClips();
	void OnClosed();

protected:
	virtual void NativeOnInitialized() override;

	UFUNCTION() void OnPrev();
	UFUNCTION() void OnNext();
	UFUNCTION() void OnPlayPause();
	UFUNCTION() void OnRestart();
	UFUNCTION() void OnClose();
	UFUNCTION() void OnSpeedChanged(float Value);
	UFUNCTION() void OnLoopChanged(bool bChecked);

private:
	void BuildLayout();
	void PlayCurrent();
	void UpdateLabels();

	UPROPERTY() TArray<TObjectPtr<UAnimSequenceBase>> Clips;
	UPROPERTY() TObjectPtr<UTextBlock> ClipText;
	UPROPERTY() TObjectPtr<UTextBlock> InfoText;
	UPROPERTY() TObjectPtr<UTextBlock> SpeedText;
	UPROPERTY() TObjectPtr<UTextBlock> PlayLabel;
	UPROPERTY() TObjectPtr<USlider> SpeedSlider;
	UPROPERTY() TObjectPtr<UCheckBox> LoopCheck;

	int32 Index = 0;
	float Speed = 1.f;
	bool bLoop = true;
	bool bPaused = false;
	bool bPlaying = false;
};
