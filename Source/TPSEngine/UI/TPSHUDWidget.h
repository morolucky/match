#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Core/TPSTypes.h"
#include "TPSHUDWidget.generated.h"

class UTextBlock;
class UImage;
class UProgressBar;
class UCanvasPanel;
class UCanvasPanelSlot;
class UVerticalBox;
class UHorizontalBox;
class UBorder;
class UButton;
class ATPSPlayerCharacter;
class AController;

struct FTPSHUDPopup
{
	FVector World = FVector::ZeroVector;
	float Age = 10.f;
};

struct FTPSHUDDamageArrow
{
	FVector Source = FVector::ZeroVector;
	float Age = 10.f;
};

struct FTPSHUDFeedLine
{
	TWeakObjectPtr<UTextBlock> Text;
	float Age = 0.f;
};

/**
 * In-game HUD built in C++ (no widget asset needed): top bar (time, score, accuracy, wave, kills left),
 * ammo / weapon / reload bar / weapon slots, health bar, dynamic crosshair, scope overlay, hit markers,
 * damage direction indicators + vignette, wave banner, combo, kill feed, medals, score popups, toasts,
 * interaction prompts and touch buttons on mobile.
 * Subclass in Blueprint to restyle; if the Blueprint has its own designer tree, the code layout is skipped.
 */
UCLASS(Blueprintable)
class TPSENGINE_API UTPSHUDWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "TPS|HUD") void ShowHitMarker(bool bHeadshot, bool bKill);
	UFUNCTION(BlueprintCallable, Category = "TPS|HUD") void AddScorePopup(FText Label, FVector WorldLocation, bool bHeadshot);
	UFUNCTION(BlueprintCallable, Category = "TPS|HUD") void ShowToast(FText Message);
	UFUNCTION(BlueprintCallable, Category = "TPS|HUD") void AddKillFeed(FText Message, bool bHeadshot);
	UFUNCTION(BlueprintCallable, Category = "TPS|HUD") void ShowWaveBanner(int32 Wave);

protected:
	virtual void NativeOnInitialized() override;
	virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;

	UFUNCTION() void HandleDamaged(float Damage, FVector SourceLocation, ETPSHitZone Zone, AController* InstigatorController);
	UFUNCTION() void OnTouchFirePressed();
	UFUNCTION() void OnTouchFireReleased();
	UFUNCTION() void OnTouchAim();
	UFUNCTION() void OnTouchReload();
	UFUNCTION() void OnTouchJumpPressed();
	UFUNCTION() void OnTouchJumpReleased();
	UFUNCTION() void OnTouchCrouch();
	UFUNCTION() void OnTouchWeapon();
	UFUNCTION() void OnTouchLadder();
	UFUNCTION() void OnTouchPause();

private:
	void BuildLayout();
	void BuildTouchControls();
	void UpdateCrosshair(const ATPSPlayerCharacter* Player, float DeltaTime);
	void UpdatePopups(float DeltaTime);
	UButton* TouchButton(const FString& Label, const FVector2D& Pos, float Size);

	bool bBuilt = false;
	UPROPERTY() TObjectPtr<UCanvasPanel> Root;

	UPROPERTY() TObjectPtr<UTextBlock> TimeText;
	UPROPERTY() TObjectPtr<UTextBlock> ScoreText;
	UPROPERTY() TObjectPtr<UTextBlock> AccuracyText;
	UPROPERTY() TObjectPtr<UTextBlock> WaveText;
	UPROPERTY() TObjectPtr<UTextBlock> RemainingText;

	UPROPERTY() TObjectPtr<UTextBlock> AmmoText;
	UPROPERTY() TObjectPtr<UTextBlock> WeaponText;
	UPROPERTY() TObjectPtr<UProgressBar> ReloadBar;
	UPROPERTY() TArray<TObjectPtr<UTextBlock>> SlotTexts;

	UPROPERTY() TObjectPtr<UBorder> HealthPanel;
	UPROPERTY() TObjectPtr<UProgressBar> HealthBar;
	UPROPERTY() TObjectPtr<UTextBlock> HealthText;

	UPROPERTY() TArray<TObjectPtr<UImage>> CrossLines;
	UPROPERTY() TArray<TObjectPtr<UCanvasPanelSlot>> CrossSlots;
	UPROPERTY() TObjectPtr<UImage> CrossDot;
	UPROPERTY() TArray<TObjectPtr<UImage>> HitLines;
	UPROPERTY() TArray<TObjectPtr<UCanvasPanelSlot>> HitSlots;

	UPROPERTY() TObjectPtr<UCanvasPanel> ScopePanel;
	UPROPERTY() TObjectPtr<UImage> Vignette;

	UPROPERTY() TArray<TObjectPtr<UImage>> DamageArrows;
	UPROPERTY() TArray<TObjectPtr<UCanvasPanelSlot>> DamageArrowSlots;

	UPROPERTY() TObjectPtr<UTextBlock> BannerText;
	UPROPERTY() TObjectPtr<UTextBlock> ComboText;
	UPROPERTY() TObjectPtr<UTextBlock> MedalText;
	UPROPERTY() TObjectPtr<UTextBlock> ToastText;
	UPROPERTY() TObjectPtr<UTextBlock> PromptText;
	UPROPERTY() TObjectPtr<UVerticalBox> KillFeedBox;

	UPROPERTY() TArray<TObjectPtr<UTextBlock>> PopupTexts;
	UPROPERTY() TArray<TObjectPtr<UCanvasPanelSlot>> PopupSlots;

	TWeakObjectPtr<ATPSPlayerCharacter> BoundPlayer;

	TArray<FTPSHUDPopup> Popups;
	int32 NextPopup = 0;

	TArray<FTPSHUDDamageArrow> Arrows;
	int32 NextArrow = 0;

	TArray<FTPSHUDFeedLine> Feed;

	float HitMarkerAge = 10.f;
	float DamageFlash = 0.f;
	float BannerAge = 10.f;
	float ToastAge = 10.f;
	float MedalAge = 10.f;
	float CrossGap = 8.f;
};
