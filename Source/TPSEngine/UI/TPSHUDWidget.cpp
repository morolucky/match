#include "UI/TPSHUDWidget.h"
#include "UI/TPSUIStyle.h"
#include "Core/TPSStatics.h"
#include "Core/TPSGameMode.h"
#include "Core/TPSPlayerController.h"
#include "AI/TPSAIDirector.h"
#include "Characters/TPSPlayerCharacter.h"
#include "Components/TPSHealthComponent.h"
#include "Components/TPSCombatComponent.h"
#include "Components/TPSTraversalComponent.h"
#include "Weapons/TPSWeapon.h"
#include "Blueprint/WidgetTree.h"
#include "Blueprint/WidgetLayoutLibrary.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/TextBlock.h"
#include "Components/Image.h"
#include "Components/ProgressBar.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/VerticalBox.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/SizeBox.h"
#include "Camera/PlayerCameraManager.h"
#include "GameFramework/PlayerController.h"

using namespace TPSUI;

namespace
{
	const FVector2D Center(0.5f, 0.5f);
}

void UTPSHUDWidget::NativeOnInitialized()
{
	Super::NativeOnInitialized();
	if (WidgetTree && !WidgetTree->RootWidget)
	{
		BuildLayout();
	}
}

void UTPSHUDWidget::BuildLayout()
{
	UWidgetTree* Tree = WidgetTree;
	Root = Tree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass(), TEXT("HUDRoot"));
	Tree->RootWidget = Root;
	Root->SetVisibility(ESlateVisibility::SelfHitTestInvisible);

	// Damage vignette.
	Vignette = Rect(Tree, FLinearColor(0.6f, 0.f, 0.f, 0.f));
	Vignette->SetVisibility(ESlateVisibility::HitTestInvisible);
	Fill(Root, Vignette);

	// Scope overlay.
	ScopePanel = Tree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass());
	ScopePanel->SetVisibility(ESlateVisibility::Collapsed);
	Fill(Root, ScopePanel);
	{
		auto Stretch = [this, Tree](float MinX, float MinY, float MaxX, float MaxY, const FLinearColor& Color)
		{
			UImage* Img = Rect(Tree, Color);
			UCanvasPanelSlot* S = ScopePanel->AddChildToCanvas(Img);
			S->SetAnchors(FAnchors(MinX, MinY, MaxX, MaxY));
			S->SetOffsets(FMargin(0.f));
		};
		Stretch(0.f, 0.f, 0.24f, 1.f, FLinearColor::Black);
		Stretch(0.76f, 0.f, 1.f, 1.f, FLinearColor::Black);
		Stretch(0.24f, 0.f, 0.76f, 0.06f, FLinearColor::Black);
		Stretch(0.24f, 0.94f, 0.76f, 1.f, FLinearColor::Black);
		UImage* H = Rect(Tree, FLinearColor(0.f, 0.f, 0.f, 0.9f));
		Place(ScopePanel, H, Center, Center, FVector2D::ZeroVector, FVector2D(900.f, 2.f));
		UImage* V = Rect(Tree, FLinearColor(0.f, 0.f, 0.f, 0.9f));
		Place(ScopePanel, V, Center, Center, FVector2D::ZeroVector, FVector2D(2.f, 900.f));
		UImage* Dot = Rect(Tree, FLinearColor(1.f, 0.1f, 0.1f, 1.f));
		Place(ScopePanel, Dot, Center, Center, FVector2D::ZeroVector, FVector2D(4.f, 4.f));
	}

	// Top bar.
	{
		UBorder* Bar = Box(Tree, Panel, FMargin(18.f, 8.f));
		UHorizontalBox* Row = Tree->ConstructWidget<UHorizontalBox>(UHorizontalBox::StaticClass());
		Bar->SetContent(Row);
		TimeText = Text(Tree, TEXT("1:00"), 20, TextMain, true);
		ScoreText = Text(Tree, TEXT("SCORE 0"), 20, Accent, true);
		AccuracyText = Text(Tree, TEXT("ACC 0%"), 16, TextDim);
		WaveText = Text(Tree, TEXT("WAVE 1"), 18, TextMain, true);
		RemainingText = Text(Tree, TEXT("0 LEFT"), 16, TextDim);
		for (UTextBlock* T : { TimeText.Get(), ScoreText.Get(), AccuracyText.Get(), WaveText.Get(), RemainingText.Get() })
		{
			if (UHorizontalBoxSlot* S = Row->AddChildToHorizontalBox(T))
			{
				S->SetPadding(FMargin(14.f, 0.f));
				S->SetVerticalAlignment(VAlign_Center);
			}
		}
		Place(Root, Bar, FVector2D(0.5f, 0.f), FVector2D(0.5f, 0.f), FVector2D(0.f, 16.f));
	}

	// Ammo / weapon panel.
	{
		UBorder* Panel2 = Box(Tree, Panel, FMargin(18.f, 10.f));
		UVerticalBox* Col = Tree->ConstructWidget<UVerticalBox>(UVerticalBox::StaticClass());
		Panel2->SetContent(Col);
		WeaponText = Text(Tree, TEXT("WEAPON"), 16, TextDim, true, ETextJustify::Right);
		AmmoText = Text(Tree, TEXT("30 / 30"), 40, TextMain, true, ETextJustify::Right);
		ReloadBar = Tree->ConstructWidget<UProgressBar>(UProgressBar::StaticClass());
		ReloadBar->SetFillColorAndOpacity(Accent);
		ReloadBar->SetVisibility(ESlateVisibility::Hidden);
		USizeBox* BarSize = Tree->ConstructWidget<USizeBox>(USizeBox::StaticClass());
		BarSize->SetWidthOverride(220.f);
		BarSize->SetHeightOverride(6.f);
		BarSize->AddChild(ReloadBar);
		UHorizontalBox* Slots = Tree->ConstructWidget<UHorizontalBox>(UHorizontalBox::StaticClass());
		for (int32 i = 0; i < 7; ++i)
		{
			UTextBlock* SlotText = Text(Tree, FString::FromInt(i + 1), 14, TextDim, true, ETextJustify::Center);
			if (UHorizontalBoxSlot* S = Slots->AddChildToHorizontalBox(SlotText))
			{
				S->SetPadding(FMargin(6.f, 0.f));
			}
			SlotTexts.Add(SlotText);
		}
		AddRow(Col, WeaponText, FMargin(0.f, 0.f), HAlign_Right);
		AddRow(Col, AmmoText, FMargin(0.f, 0.f), HAlign_Right);
		AddRow(Col, BarSize, FMargin(0.f, 4.f), HAlign_Right);
		AddRow(Col, Slots, FMargin(0.f, 6.f, 0.f, 0.f), HAlign_Right);
		Place(Root, Panel2, FVector2D(1.f, 1.f), FVector2D(1.f, 1.f), FVector2D(-30.f, -30.f));
	}

	// Health panel (VS AI).
	{
		HealthPanel = Box(Tree, Panel, FMargin(16.f, 10.f));
		UVerticalBox* Col = Tree->ConstructWidget<UVerticalBox>(UVerticalBox::StaticClass());
		HealthPanel->SetContent(Col);
		AddRow(Col, Text(Tree, TEXT("HEALTH"), 13, TextDim, true));
		UHorizontalBox* Row = Tree->ConstructWidget<UHorizontalBox>(UHorizontalBox::StaticClass());
		HealthBar = Tree->ConstructWidget<UProgressBar>(UProgressBar::StaticClass());
		HealthBar->SetPercent(1.f);
		HealthBar->SetFillColorAndOpacity(Good);
		USizeBox* BarSize = Tree->ConstructWidget<USizeBox>(USizeBox::StaticClass());
		BarSize->SetWidthOverride(260.f);
		BarSize->SetHeightOverride(14.f);
		BarSize->AddChild(HealthBar);
		Row->AddChildToHorizontalBox(BarSize);
		HealthText = Text(Tree, TEXT("100"), 18, TextMain, true);
		if (UHorizontalBoxSlot* S = Row->AddChildToHorizontalBox(HealthText))
		{
			S->SetPadding(FMargin(10.f, 0.f, 0.f, 0.f));
			S->SetVerticalAlignment(VAlign_Center);
		}
		AddRow(Col, Row);
		Place(Root, HealthPanel, FVector2D(0.f, 1.f), FVector2D(0.f, 1.f), FVector2D(30.f, -30.f));
	}

	// Crosshair.
	for (int32 i = 0; i < 4; ++i)
	{
		UImage* Line = Rect(Tree, FLinearColor(1.f, 1.f, 1.f, 0.9f));
		const bool bHorizontal = i < 2;
		CrossSlots.Add(Place(Root, Line, Center, Center, FVector2D::ZeroVector, bHorizontal ? FVector2D(10.f, 2.f) : FVector2D(2.f, 10.f)));
		CrossLines.Add(Line);
	}
	CrossDot = Rect(Tree, FLinearColor(1.f, 1.f, 1.f, 0.9f));
	Place(Root, CrossDot, Center, Center, FVector2D::ZeroVector, FVector2D(3.f, 3.f));

	// Hit marker (four diagonal ticks).
	for (int32 i = 0; i < 4; ++i)
	{
		UImage* TickMark = Rect(Tree, FLinearColor::White);
		const float SX = (i == 0 || i == 3) ? 1.f : -1.f;
		const float SY = (i < 2) ? -1.f : 1.f;
		HitSlots.Add(Place(Root, TickMark, Center, Center, FVector2D(SX * 11.f, SY * 11.f), FVector2D(12.f, 2.f)));
		TickMark->SetRenderTransformPivot(FVector2D(0.5f, 0.5f));
		TickMark->SetRenderTransformAngle(SX * SY > 0.f ? 45.f : -45.f);
		TickMark->SetRenderOpacity(0.f);
		HitLines.Add(TickMark);
	}

	// Damage direction arrows.
	for (int32 i = 0; i < 4; ++i)
	{
		UImage* Arrow = Rect(Tree, FLinearColor(1.f, 0.15f, 0.1f, 0.85f));
		Arrow->SetRenderTransformPivot(FVector2D(0.5f, 0.5f));
		Arrow->SetVisibility(ESlateVisibility::Collapsed);
		DamageArrowSlots.Add(Place(Root, Arrow, Center, Center, FVector2D::ZeroVector, FVector2D(46.f, 7.f)));
		DamageArrows.Add(Arrow);
	}
	Arrows.SetNum(4);

	BannerText = Text(Tree, TEXT(""), 54, Accent, true, ETextJustify::Center);
	Place(Root, BannerText, FVector2D(0.5f, 0.26f), Center, FVector2D::ZeroVector);
	MedalText = Text(Tree, TEXT(""), 28, Head, true, ETextJustify::Center);
	Place(Root, MedalText, FVector2D(0.5f, 0.36f), Center, FVector2D::ZeroVector);
	ComboText = Text(Tree, TEXT(""), 20, Accent, true, ETextJustify::Center);
	Place(Root, ComboText, Center, Center, FVector2D(0.f, 64.f));
	ToastText = Text(Tree, TEXT(""), 20, TextMain, true, ETextJustify::Center);
	Place(Root, ToastText, FVector2D(0.5f, 0.8f), Center, FVector2D::ZeroVector);
	PromptText = Text(Tree, TEXT(""), 18, TextMain, false, ETextJustify::Center);
	Place(Root, PromptText, FVector2D(0.5f, 0.66f), Center, FVector2D::ZeroVector);

	KillFeedBox = Tree->ConstructWidget<UVerticalBox>(UVerticalBox::StaticClass());
	Place(Root, KillFeedBox, FVector2D(1.f, 0.f), FVector2D(1.f, 0.f), FVector2D(-24.f, 90.f));

	for (int32 i = 0; i < 8; ++i)
	{
		UTextBlock* Pop = Text(Tree, TEXT(""), 22, Accent, true, ETextJustify::Center);
		Pop->SetVisibility(ESlateVisibility::Collapsed);
		PopupSlots.Add(Place(Root, Pop, FVector2D::ZeroVector, FVector2D(0.5f, 1.f), FVector2D::ZeroVector));
		PopupTexts.Add(Pop);
	}
	Popups.SetNum(8);

#if PLATFORM_ANDROID || PLATFORM_IOS
	BuildTouchControls();
#endif

	bBuilt = true;
}

UButton* UTPSHUDWidget::TouchButton(const FString& Label, const FVector2D& Pos, float Size)
{
	UButton* Btn = Button(WidgetTree, Label, 16);
	Btn->SetBackgroundColor(FLinearColor(0.1f, 0.1f, 0.12f, 0.55f));
	Place(Root, Btn, FVector2D(1.f, 1.f), Center, Pos, FVector2D(Size, Size));
	return Btn;
}

void UTPSHUDWidget::BuildTouchControls()
{
	UButton* Fire = TouchButton(TEXT("FIRE"), FVector2D(-120.f, -170.f), 110.f);
	Fire->OnPressed.AddDynamic(this, &UTPSHUDWidget::OnTouchFirePressed);
	Fire->OnReleased.AddDynamic(this, &UTPSHUDWidget::OnTouchFireReleased);
	TouchButton(TEXT("AIM"), FVector2D(-250.f, -120.f), 80.f)->OnPressed.AddDynamic(this, &UTPSHUDWidget::OnTouchAim);
	TouchButton(TEXT("R"), FVector2D(-250.f, -230.f), 64.f)->OnPressed.AddDynamic(this, &UTPSHUDWidget::OnTouchReload);
	UButton* Jump = TouchButton(TEXT("ROLL"), FVector2D(-110.f, -300.f), 72.f);
	Jump->OnPressed.AddDynamic(this, &UTPSHUDWidget::OnTouchJumpPressed);
	Jump->OnReleased.AddDynamic(this, &UTPSHUDWidget::OnTouchJumpReleased);
	TouchButton(TEXT("C"), FVector2D(-330.f, -60.f), 60.f)->OnPressed.AddDynamic(this, &UTPSHUDWidget::OnTouchCrouch);
	TouchButton(TEXT("GUN"), FVector2D(-60.f, -60.f), 60.f)->OnPressed.AddDynamic(this, &UTPSHUDWidget::OnTouchWeapon);
	TouchButton(TEXT("F"), FVector2D(-360.f, -170.f), 56.f)->OnPressed.AddDynamic(this, &UTPSHUDWidget::OnTouchLadder);

	UButton* PauseButton = Button(WidgetTree, TEXT("II"), 18);
	PauseButton->SetBackgroundColor(FLinearColor(0.1f, 0.1f, 0.12f, 0.55f));
	Place(Root, PauseButton, FVector2D(0.f, 0.f), FVector2D(0.f, 0.f), FVector2D(20.f, 20.f), FVector2D(56.f, 56.f));
	PauseButton->OnPressed.AddDynamic(this, &UTPSHUDWidget::OnTouchPause);
}

static void TPSInject(UUserWidget* Widget, ETPSInputAction Action, bool bPressed)
{
	if (ATPSPlayerController* PC = Cast<ATPSPlayerController>(Widget->GetOwningPlayer()))
	{
		PC->InjectAction(Action, bPressed);
	}
}

void UTPSHUDWidget::OnTouchFirePressed() { TPSInject(this, ETPSInputAction::Fire, true); }
void UTPSHUDWidget::OnTouchFireReleased() { TPSInject(this, ETPSInputAction::Fire, false); }
void UTPSHUDWidget::OnTouchAim() { TPSInject(this, ETPSInputAction::Aim, true); }
void UTPSHUDWidget::OnTouchReload() { TPSInject(this, ETPSInputAction::Reload, true); }
void UTPSHUDWidget::OnTouchJumpPressed() { TPSInject(this, ETPSInputAction::Traverse, true); }
void UTPSHUDWidget::OnTouchJumpReleased() { TPSInject(this, ETPSInputAction::Traverse, false); }
void UTPSHUDWidget::OnTouchCrouch() { TPSInject(this, ETPSInputAction::Crouch, true); }
void UTPSHUDWidget::OnTouchWeapon() { TPSInject(this, ETPSInputAction::NextWeapon, true); }
void UTPSHUDWidget::OnTouchLadder() { TPSInject(this, ETPSInputAction::Ladder, true); }
void UTPSHUDWidget::OnTouchPause() { TPSInject(this, ETPSInputAction::Pause, true); }

// ---------------------------------------------------------------- Events

void UTPSHUDWidget::ShowHitMarker(bool bHeadshot, bool bKill)
{
	HitMarkerAge = 0.f;
	const FLinearColor Color = bKill ? Danger : (bHeadshot ? Head : FLinearColor::White);
	for (UImage* Line : HitLines)
	{
		if (Line)
		{
			Line->SetColorAndOpacity(Color);
		}
	}
}

void UTPSHUDWidget::AddScorePopup(FText Label, FVector WorldLocation, bool bHeadshot)
{
	if (!bBuilt || PopupTexts.Num() == 0)
	{
		return;
	}
	const int32 Index = NextPopup++ % PopupTexts.Num();
	Popups[Index].World = WorldLocation;
	Popups[Index].Age = 0.f;
	PopupTexts[Index]->SetText(Label);
	PopupTexts[Index]->SetColorAndOpacity(FSlateColor(bHeadshot ? Head : Accent));
}

void UTPSHUDWidget::ShowToast(FText Message)
{
	if (ToastText)
	{
		ToastText->SetText(Message);
		ToastAge = 0.f;
	}
}

void UTPSHUDWidget::AddKillFeed(FText Message, bool bHeadshot)
{
	if (!bBuilt)
	{
		return;
	}
	UTextBlock* Line = Text(WidgetTree, Message.ToString(), 16, bHeadshot ? Head : TextMain, true, ETextJustify::Right);
	AddRow(KillFeedBox, Line, FMargin(0.f, 2.f), HAlign_Right);
	FTPSHUDFeedLine Entry;
	Entry.Text = Line;
	Feed.Add(Entry);
	while (Feed.Num() > 5)
	{
		if (UTextBlock* Old = Feed[0].Text.Get())
		{
			Old->RemoveFromParent();
		}
		Feed.RemoveAt(0);
	}

	// Medals for quick multi-kills (streak resets when the combo window expires).
	if (const ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
	{
		const int32 Streak = GM->GetStats().Streak;
		if (Streak >= 2 && MedalText)
		{
			MedalText->SetText(FText::FromString(Streak == 2 ? TEXT("DOUBLE KILL") : Streak == 3 ? TEXT("TRIPLE KILL") : FString::Printf(TEXT("MULTI KILL x%d"), Streak)));
			MedalAge = 0.f;
		}
	}
}

void UTPSHUDWidget::ShowWaveBanner(int32 Wave)
{
	if (BannerText)
	{
		BannerText->SetText(FText::FromString(FString::Printf(TEXT("WAVE %d"), Wave)));
		BannerAge = 0.f;
	}
}

void UTPSHUDWidget::HandleDamaged(float Damage, FVector SourceLocation, ETPSHitZone Zone, AController* InstigatorController)
{
	DamageFlash = FMath::Min(1.f, DamageFlash + Damage / 40.f);
	if (Arrows.Num() > 0)
	{
		FTPSHUDDamageArrow& Arrow = Arrows[NextArrow++ % Arrows.Num()];
		Arrow.Source = SourceLocation;
		Arrow.Age = 0.f;
	}
}

// ---------------------------------------------------------------- Tick

void UTPSHUDWidget::UpdateCrosshair(const ATPSPlayerCharacter* Player, float DeltaTime)
{
	APlayerController* PC = GetOwningPlayer();
	const ATPSWeapon* Weapon = Player ? Player->GetCurrentWeapon() : nullptr;
	const bool bScoped = Player && Player->Combat && Player->Combat->IsScoped();
	const bool bBusy = Player && Player->Traversal && Player->Traversal->IsBusy();

	ScopePanel->SetVisibility(bScoped ? ESlateVisibility::HitTestInvisible : ESlateVisibility::Collapsed);
	const bool bShowCross = Weapon && !bScoped && !bBusy;
	const ESlateVisibility CrossVis = bShowCross ? ESlateVisibility::HitTestInvisible : ESlateVisibility::Collapsed;
	for (UImage* Line : CrossLines)
	{
		Line->SetVisibility(CrossVis);
	}
	CrossDot->SetVisibility(CrossVis);
	if (!bShowCross || !PC || !PC->PlayerCameraManager)
	{
		return;
	}

	const float Scale = FMath::Max(0.1f, UWidgetLayoutLibrary::GetViewportScale(this));
	const float HalfWidth = UWidgetLayoutLibrary::GetViewportSize(this).X / Scale * 0.5f;
	const float HalfFOV = FMath::DegreesToRadians(FMath::Clamp(PC->PlayerCameraManager->GetFOVAngle(), 5.f, 170.f) * 0.5f);
	const float Spread = Weapon->Stats.Spread * Weapon->GetSpreadMultiplier();
	const float Wanted = 4.f + HalfWidth * FMath::Tan(Spread * 1.5f) / FMath::Tan(HalfFOV);
	CrossGap = FMath::FInterpTo(CrossGap, FMath::Clamp(Wanted, 4.f, 160.f), DeltaTime, 20.f);

	const float Off = CrossGap + 5.f;
	CrossSlots[0]->SetPosition(FVector2D(Off, 0.f));
	CrossSlots[1]->SetPosition(FVector2D(-Off, 0.f));
	CrossSlots[2]->SetPosition(FVector2D(0.f, -Off));
	CrossSlots[3]->SetPosition(FVector2D(0.f, Off));
}

void UTPSHUDWidget::UpdatePopups(float DeltaTime)
{
	APlayerController* PC = GetOwningPlayer();
	const float Scale = FMath::Max(0.1f, UWidgetLayoutLibrary::GetViewportScale(this));
	for (int32 i = 0; i < Popups.Num(); ++i)
	{
		FTPSHUDPopup& Pop = Popups[i];
		UTextBlock* Txt = PopupTexts[i];
		if (Pop.Age >= 1.2f || !PC)
		{
			Txt->SetVisibility(ESlateVisibility::Collapsed);
			continue;
		}
		Pop.Age += DeltaTime;
		FVector2D Screen;
		if (PC->ProjectWorldLocationToScreen(Pop.World + FVector(0.f, 0.f, 70.f * Pop.Age), Screen, true))
		{
			PopupSlots[i]->SetPosition(Screen / Scale);
			Txt->SetRenderOpacity(1.f - FMath::Clamp(Pop.Age / 1.2f, 0.f, 1.f));
			Txt->SetVisibility(ESlateVisibility::HitTestInvisible);
		}
		else
		{
			Txt->SetVisibility(ESlateVisibility::Collapsed);
		}
	}
}

void UTPSHUDWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
	Super::NativeTick(MyGeometry, InDeltaTime);
	if (!bBuilt)
	{
		return;
	}

	APlayerController* PC = GetOwningPlayer();
	ATPSPlayerCharacter* Player = PC ? Cast<ATPSPlayerCharacter>(PC->GetPawn()) : nullptr;
	const ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this);

	if (Player && BoundPlayer.Get() != Player)
	{
		Player->Health->OnDamaged.AddUniqueDynamic(this, &UTPSHUDWidget::HandleDamaged);
		BoundPlayer = Player;
	}

	// Top bar.
	const bool bAI = GM && GM->GetModeType() == ETPSGameModeType::VersusAI;
	if (GM)
	{
		const FTPSRoundStats Stats = GM->GetStats();
		const float Clock = bAI ? Stats.Time : GM->GetTimeLeft();
		TimeText->SetText(FText::FromString(UTPSStatics::FormatTime(Clock)));
		TimeText->SetColorAndOpacity(FSlateColor(!bAI && Clock < 10.f ? Danger : TextMain));
		ScoreText->SetText(FText::FromString(FString::Printf(TEXT("SCORE %d"), Stats.Score)));
		AccuracyText->SetText(FText::FromString(FString::Printf(TEXT("ACC %d%%"), FMath::RoundToInt(Stats.GetAccuracy() * 100.f))));

		const ATPSAIDirector* Director = GM->GetDirector();
		WaveText->SetVisibility(bAI ? ESlateVisibility::HitTestInvisible : ESlateVisibility::Collapsed);
		RemainingText->SetVisibility(bAI ? ESlateVisibility::HitTestInvisible : ESlateVisibility::Collapsed);
		if (bAI && Director)
		{
			WaveText->SetText(FText::FromString(FString::Printf(TEXT("WAVE %d"), Director->GetWave())));
			RemainingText->SetText(FText::FromString(Director->IsInBreak()
				? FString::Printf(TEXT("NEXT WAVE IN %d"), FMath::CeilToInt(Director->GetBreakTimeLeft()))
				: FString::Printf(TEXT("%d LEFT"), Director->GetRemainingKills())));
		}

		ComboText->SetText(GM->GetComboTimeLeft() > 0.f && Stats.Multiplier > 1.f
			? FText::FromString(FString::Printf(TEXT("x%.1f COMBO"), Stats.Multiplier)) : FText::GetEmpty());
	}

	// Weapon + ammo.
	const ATPSWeapon* Weapon = Player ? Player->GetCurrentWeapon() : nullptr;
	if (Weapon)
	{
		WeaponText->SetText(Weapon->Stats.DisplayName);
		const int32 Ammo = Weapon->GetAmmo();
		const int32 Mag = Weapon->GetMagazineSize();
		AmmoText->SetText(FText::FromString(Weapon->IsReloading() ? FString::Printf(TEXT("%d  ..."), Ammo) : FString::Printf(TEXT("%d / %d"), Ammo, Mag)));
		AmmoText->SetColorAndOpacity(FSlateColor(Ammo <= FMath::Max(1, FMath::FloorToInt(Mag * 0.2f)) ? Danger : TextMain));
		ReloadBar->SetVisibility(Weapon->IsReloading() ? ESlateVisibility::HitTestInvisible : ESlateVisibility::Hidden);
		ReloadBar->SetPercent(Weapon->GetReloadProgress());
	}
	const int32 CurrentSlot = (Player && Player->Combat) ? Player->Combat->GetCurrentSlot() : -1;
	const int32 WeaponCount = (Player && Player->Combat) ? Player->Combat->GetWeapons().Num() : 0;
	for (int32 i = 0; i < SlotTexts.Num(); ++i)
	{
		SlotTexts[i]->SetVisibility(i < WeaponCount ? ESlateVisibility::HitTestInvisible : ESlateVisibility::Collapsed);
		SlotTexts[i]->SetColorAndOpacity(FSlateColor(i == CurrentSlot ? Accent : TextDim));
	}

	// Health.
	HealthPanel->SetVisibility(bAI && Player ? ESlateVisibility::HitTestInvisible : ESlateVisibility::Collapsed);
	float HealthPct = 1.f;
	if (Player)
	{
		HealthPct = Player->Health->GetHealthPercent();
		HealthBar->SetPercent(HealthPct);
		HealthBar->SetFillColorAndOpacity(HealthPct < 0.35f ? Danger : (HealthPct < 0.6f ? Accent : Good));
		HealthText->SetText(FText::AsNumber(FMath::CeilToInt(Player->Health->GetHealth())));
	}

	UpdateCrosshair(Player, InDeltaTime);

	// Hit marker.
	HitMarkerAge += InDeltaTime;
	const float HitAlpha = 1.f - FMath::Clamp(HitMarkerAge / 0.25f, 0.f, 1.f);
	for (UImage* Line : HitLines)
	{
		Line->SetRenderOpacity(HitAlpha);
	}

	// Damage direction + vignette.
	DamageFlash = FMath::Max(0.f, DamageFlash - InDeltaTime * 1.5f);
	const float LowHealth = bAI ? FMath::Clamp((0.5f - HealthPct) / 0.5f, 0.f, 1.f) : 0.f;
	Vignette->SetColorAndOpacity(FLinearColor(0.6f, 0.f, 0.f, FMath::Clamp(DamageFlash * 0.35f + LowHealth * 0.22f, 0.f, 0.45f)));
	const float CamYaw = (PC && PC->PlayerCameraManager) ? PC->PlayerCameraManager->GetCameraRotation().Yaw : 0.f;
	for (int32 i = 0; i < Arrows.Num(); ++i)
	{
		FTPSHUDDamageArrow& Arrow = Arrows[i];
		Arrow.Age += InDeltaTime;
		if (Arrow.Age >= 1.2f || !Player)
		{
			DamageArrows[i]->SetVisibility(ESlateVisibility::Collapsed);
			continue;
		}
		const FVector To = (Arrow.Source - Player->GetActorLocation()).GetSafeNormal2D();
		const float Angle = FMath::FindDeltaAngleDegrees(CamYaw, To.Rotation().Yaw);
		const float Rad = FMath::DegreesToRadians(Angle);
		DamageArrowSlots[i]->SetPosition(FVector2D(FMath::Sin(Rad), -FMath::Cos(Rad)) * 130.f);
		DamageArrows[i]->SetRenderTransformAngle(Angle);
		DamageArrows[i]->SetRenderOpacity(1.f - Arrow.Age / 1.2f);
		DamageArrows[i]->SetVisibility(ESlateVisibility::HitTestInvisible);
	}

	// Banners, medals, toasts.
	BannerAge += InDeltaTime;
	BannerText->SetRenderOpacity(1.f - FMath::Clamp((BannerAge - 1.4f) / 0.6f, 0.f, 1.f));
	MedalAge += InDeltaTime;
	MedalText->SetRenderOpacity(1.f - FMath::Clamp((MedalAge - 1.f) / 0.5f, 0.f, 1.f));
	ToastAge += InDeltaTime;
	ToastText->SetRenderOpacity(1.f - FMath::Clamp((ToastAge - 2.f) / 0.5f, 0.f, 1.f));

	// Interaction prompt.
	FString Prompt;
	if (Player && Player->Traversal)
	{
		if (Player->Traversal->IsOnLadder())
		{
			Prompt = FString::Printf(TEXT("[W/S] Climb   [Shift] Faster   [F] Auto-climb: %s   [C] Let go"), Player->Traversal->IsLadderAutoClimb() ? TEXT("ON") : TEXT("OFF"));
		}
		else if (Player->Traversal->IsNearLadder())
		{
			Prompt = TEXT("[F] Climb ladder");
		}
	}
	PromptText->SetText(FText::FromString(Prompt));

	// Kill feed.
	for (int32 i = Feed.Num() - 1; i >= 0; --i)
	{
		Feed[i].Age += InDeltaTime;
		UTextBlock* Line = Feed[i].Text.Get();
		if (!Line || Feed[i].Age > 4.f)
		{
			if (Line)
			{
				Line->RemoveFromParent();
			}
			Feed.RemoveAt(i);
		}
		else
		{
			Line->SetRenderOpacity(1.f - FMath::Clamp((Feed[i].Age - 3.f), 0.f, 1.f));
		}
	}

	UpdatePopups(InDeltaTime);
}
