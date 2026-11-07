#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "Core/TPSTypes.h"
#include "TPSHUD.generated.h"

class UTPSHUDWidget;
class UTPSMenuWidget;
class UTPSAnimStudioWidget;

/** Creates the HUD / menu / animation studio widgets and routes game-mode events to them. Swap classes in a Blueprint child. */
UCLASS(Blueprintable)
class TPSENGINE_API ATPSHUD : public AHUD
{
	GENERATED_BODY()

public:
	ATPSHUD();
	virtual void BeginPlay() override;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|UI") TSubclassOf<UTPSHUDWidget> HUDWidgetClass;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|UI") TSubclassOf<UTPSMenuWidget> MenuWidgetClass;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|UI") TSubclassOf<UTPSAnimStudioWidget> AnimStudioWidgetClass;

	UFUNCTION(BlueprintPure, Category = "TPS|UI") UTPSHUDWidget* GetHUDWidget() const { return HUDWidget; }
	UFUNCTION(BlueprintPure, Category = "TPS|UI") UTPSMenuWidget* GetMenuWidget() const { return MenuWidget; }
	UFUNCTION(BlueprintPure, Category = "TPS|UI") bool IsAnimStudioOpen() const { return bAnimStudioOpen; }
	UFUNCTION(BlueprintCallable, Category = "TPS|UI") void SetAnimStudioOpen(bool bOpen);

protected:
	UFUNCTION() void HandlePhaseChanged(ETPSMatchPhase Phase);
	UFUNCTION() void HandleScorePopup(FText Text, FVector WorldLocation, bool bHeadshot);
	UFUNCTION() void HandleHitMarker(bool bHeadshot, bool bKill);
	UFUNCTION() void HandleToast(FText Message);
	UFUNCTION() void HandleKillFeed(FText Text, bool bHeadshot);
	UFUNCTION() void HandleWaveStarted(int32 Wave);

private:
	UPROPERTY() TObjectPtr<UTPSHUDWidget> HUDWidget;
	UPROPERTY() TObjectPtr<UTPSMenuWidget> MenuWidget;
	UPROPERTY() TObjectPtr<UTPSAnimStudioWidget> AnimStudioWidget;
	bool bAnimStudioOpen = false;
};
