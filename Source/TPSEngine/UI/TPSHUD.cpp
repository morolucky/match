#include "UI/TPSHUD.h"
#include "UI/TPSHUDWidget.h"
#include "UI/TPSMenuWidget.h"
#include "UI/TPSAnimStudioWidget.h"
#include "Core/TPSStatics.h"
#include "Core/TPSGameMode.h"
#include "Core/TPSPlayerController.h"
#include "Blueprint/UserWidget.h"
#include "GameFramework/PlayerController.h"

ATPSHUD::ATPSHUD()
{
	HUDWidgetClass = UTPSHUDWidget::StaticClass();
	MenuWidgetClass = UTPSMenuWidget::StaticClass();
	AnimStudioWidgetClass = UTPSAnimStudioWidget::StaticClass();
}

void ATPSHUD::BeginPlay()
{
	Super::BeginPlay();

	APlayerController* PC = GetOwningPlayerController();
	if (!PC || !PC->IsLocalController())
	{
		return;
	}

	if (HUDWidgetClass)
	{
		HUDWidget = CreateWidget<UTPSHUDWidget>(PC, HUDWidgetClass);
		if (HUDWidget)
		{
			HUDWidget->AddToViewport(0);
		}
	}
	if (AnimStudioWidgetClass)
	{
		AnimStudioWidget = CreateWidget<UTPSAnimStudioWidget>(PC, AnimStudioWidgetClass);
		if (AnimStudioWidget)
		{
			AnimStudioWidget->AddToViewport(5);
			AnimStudioWidget->SetVisibility(ESlateVisibility::Collapsed);
		}
	}
	if (MenuWidgetClass)
	{
		MenuWidget = CreateWidget<UTPSMenuWidget>(PC, MenuWidgetClass);
		if (MenuWidget)
		{
			MenuWidget->AddToViewport(10);
		}
	}

	if (ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
	{
		GM->OnPhaseChanged.AddDynamic(this, &ATPSHUD::HandlePhaseChanged);
		GM->OnScorePopup.AddDynamic(this, &ATPSHUD::HandleScorePopup);
		GM->OnHitMarker.AddDynamic(this, &ATPSHUD::HandleHitMarker);
		GM->OnToast.AddDynamic(this, &ATPSHUD::HandleToast);
		GM->OnKillFeed.AddDynamic(this, &ATPSHUD::HandleKillFeed);
		GM->OnWaveStarted.AddDynamic(this, &ATPSHUD::HandleWaveStarted);
		HandlePhaseChanged(GM->GetPhase());
	}
	else if (MenuWidget)
	{
		// Custom game mode: plain HUD only.
		MenuWidget->SetVisibility(ESlateVisibility::Collapsed);
	}
}

void ATPSHUD::HandlePhaseChanged(ETPSMatchPhase Phase)
{
	const bool bInRound = Phase == ETPSMatchPhase::Playing || Phase == ETPSMatchPhase::Paused;
	if (HUDWidget)
	{
		HUDWidget->SetVisibility(bInRound ? ESlateVisibility::SelfHitTestInvisible : ESlateVisibility::Collapsed);
	}
	if (MenuWidget)
	{
		MenuWidget->SetVisibility(Phase == ETPSMatchPhase::Playing ? ESlateVisibility::Collapsed : ESlateVisibility::Visible);
		switch (Phase)
		{
		case ETPSMatchPhase::MainMenu: MenuWidget->ShowPanel(ETPSMenuPanel::Main); break;
		case ETPSMatchPhase::Paused: MenuWidget->ShowPanel(ETPSMenuPanel::Pause); break;
		case ETPSMatchPhase::GameOver: MenuWidget->ShowPanel(ETPSMenuPanel::GameOver); break;
		default: break;
		}
	}
	if (Phase != ETPSMatchPhase::Playing && bAnimStudioOpen)
	{
		SetAnimStudioOpen(false);
	}
}

void ATPSHUD::SetAnimStudioOpen(bool bOpen)
{
	if (!AnimStudioWidget || bOpen == bAnimStudioOpen)
	{
		return;
	}
	bAnimStudioOpen = bOpen;
	AnimStudioWidget->SetVisibility(bOpen ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
	if (bOpen)
	{
		AnimStudioWidget->RefreshClips();
	}
	else
	{
		AnimStudioWidget->OnClosed();
	}
	if (ATPSPlayerController* PC = Cast<ATPSPlayerController>(GetOwningPlayerController()))
	{
		const ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this);
		PC->ApplyInputModeForPhase(GM ? GM->GetPhase() : ETPSMatchPhase::Playing);
	}
}

void ATPSHUD::HandleScorePopup(FText Text, FVector WorldLocation, bool bHeadshot)
{
	if (HUDWidget)
	{
		HUDWidget->AddScorePopup(Text, WorldLocation, bHeadshot);
	}
}

void ATPSHUD::HandleHitMarker(bool bHeadshot, bool bKill)
{
	if (HUDWidget)
	{
		HUDWidget->ShowHitMarker(bHeadshot, bKill);
	}
}

void ATPSHUD::HandleToast(FText Message)
{
	if (HUDWidget)
	{
		HUDWidget->ShowToast(Message);
	}
}

void ATPSHUD::HandleKillFeed(FText Text, bool bHeadshot)
{
	if (HUDWidget)
	{
		HUDWidget->AddKillFeed(Text, bHeadshot);
	}
}

void ATPSHUD::HandleWaveStarted(int32 Wave)
{
	if (HUDWidget)
	{
		HUDWidget->ShowWaveBanner(Wave);
	}
}
