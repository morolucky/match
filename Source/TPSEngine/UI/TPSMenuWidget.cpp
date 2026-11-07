#include "UI/TPSMenuWidget.h"
#include "UI/TPSUIStyle.h"
#include "Core/TPSStatics.h"
#include "Core/TPSGameMode.h"
#include "Core/TPSSettings.h"
#include "Blueprint/WidgetTree.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/WidgetSwitcher.h"
#include "Components/TextBlock.h"
#include "Components/Button.h"
#include "Components/Border.h"
#include "Components/Image.h"
#include "Components/VerticalBox.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/SizeBox.h"
#include "Components/Slider.h"
#include "Components/CheckBox.h"
#include "Engine/GameInstance.h"
#include "GameFramework/PlayerController.h"

using namespace TPSUI;

void UTPSMenuWidget::NativeOnInitialized()
{
	Super::NativeOnInitialized();
	if (WidgetTree && !WidgetTree->RootWidget)
	{
		BuildLayout();
	}
	if (const UTPSSettingsSave* S = UTPSSettingsSubsystem::Get(this))
	{
		ApplyShowFPS(S->bShowFPS);
	}
}

UVerticalBox* UTPSMenuWidget::MakePanel(const FString& Title, const FString& Subtitle, UTextBlock** OutTitle, UTextBlock** OutSubtitle)
{
	UBorder* Frame = Box(WidgetTree, PanelLight, FMargin(40.f, 30.f));
	UVerticalBox* Col = WidgetTree->ConstructWidget<UVerticalBox>(UVerticalBox::StaticClass());
	Frame->SetContent(Col);
	Switcher->AddChild(Frame);

	UTextBlock* TitleText = Text(WidgetTree, Title, 40, Accent, true, ETextJustify::Center);
	AddRow(Col, TitleText, FMargin(0.f, 0.f, 0.f, 6.f), HAlign_Center);
	UTextBlock* SubText = Text(WidgetTree, Subtitle, 15, TextDim, false, ETextJustify::Center);
	SubText->SetAutoWrapText(true);
	USizeBox* SubSize = WidgetTree->ConstructWidget<USizeBox>(USizeBox::StaticClass());
	SubSize->SetWidthOverride(520.f);
	SubSize->AddChild(SubText);
	AddRow(Col, SubSize, FMargin(0.f, 0.f, 0.f, 16.f), HAlign_Center);
	if (OutTitle)
	{
		*OutTitle = TitleText;
	}
	if (OutSubtitle)
	{
		*OutSubtitle = SubText;
	}
	return Col;
}

void UTPSMenuWidget::AddMenuButton(UVerticalBox* Panel, const FString& Label, FName Handler, UTextBlock** OutLabel)
{
	UButton* Btn = Button(WidgetTree, Label, 20, OutLabel);
	FScriptDelegate Delegate;
	Delegate.BindUFunction(this, Handler);
	Btn->OnClicked.Add(Delegate);
	USizeBox* Size = WidgetTree->ConstructWidget<USizeBox>(USizeBox::StaticClass());
	Size->SetWidthOverride(360.f);
	Size->SetHeightOverride(50.f);
	Size->AddChild(Btn);
	AddRow(Panel, Size, FMargin(0.f, 5.f), HAlign_Center);
}

USlider* UTPSMenuWidget::AddSliderRow(UVerticalBox* Panel, const FString& Label, float Min, float Max, float Step, float Value, UTextBlock** OutValue)
{
	UHorizontalBox* Row = WidgetTree->ConstructWidget<UHorizontalBox>(UHorizontalBox::StaticClass());
	UTextBlock* Name = Text(WidgetTree, Label, 16, TextMain);
	USizeBox* NameSize = WidgetTree->ConstructWidget<USizeBox>(USizeBox::StaticClass());
	NameSize->SetWidthOverride(220.f);
	NameSize->AddChild(Name);
	Row->AddChildToHorizontalBox(NameSize)->SetVerticalAlignment(VAlign_Center);

	USlider* S = Slider(WidgetTree, Min, Max, Step, Value);
	USizeBox* SliderSize = WidgetTree->ConstructWidget<USizeBox>(USizeBox::StaticClass());
	SliderSize->SetWidthOverride(260.f);
	SliderSize->AddChild(S);
	Row->AddChildToHorizontalBox(SliderSize)->SetVerticalAlignment(VAlign_Center);

	UTextBlock* ValueText = Text(WidgetTree, TEXT(""), 16, Accent, true);
	if (UHorizontalBoxSlot* ValueSlot = Row->AddChildToHorizontalBox(ValueText))
	{
		ValueSlot->SetPadding(FMargin(12.f, 0.f, 0.f, 0.f));
		ValueSlot->SetVerticalAlignment(VAlign_Center);
	}
	*OutValue = ValueText;
	AddRow(Panel, Row, FMargin(0.f, 4.f));
	return S;
}

UCheckBox* UTPSMenuWidget::AddCheckRow(UVerticalBox* Panel, const FString& Label, bool bValue)
{
	UHorizontalBox* Row = WidgetTree->ConstructWidget<UHorizontalBox>(UHorizontalBox::StaticClass());
	UTextBlock* Name = Text(WidgetTree, Label, 16, TextMain);
	USizeBox* NameSize = WidgetTree->ConstructWidget<USizeBox>(USizeBox::StaticClass());
	NameSize->SetWidthOverride(220.f);
	NameSize->AddChild(Name);
	Row->AddChildToHorizontalBox(NameSize)->SetVerticalAlignment(VAlign_Center);
	UCheckBox* CheckWidget = Check(WidgetTree, bValue);
	Row->AddChildToHorizontalBox(CheckWidget)->SetVerticalAlignment(VAlign_Center);
	AddRow(Panel, Row, FMargin(0.f, 3.f));
	return CheckWidget;
}

void UTPSMenuWidget::BuildLayout()
{
	UCanvasPanel* Root = WidgetTree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass(), TEXT("MenuRoot"));
	WidgetTree->RootWidget = Root;

	Dim = Rect(WidgetTree, FLinearColor(0.f, 0.f, 0.f, 0.55f));
	Fill(Root, Dim);

	Switcher = WidgetTree->ConstructWidget<UWidgetSwitcher>(UWidgetSwitcher::StaticClass());
	Place(Root, Switcher, FVector2D(0.5f, 0.5f), FVector2D(0.5f, 0.5f), FVector2D::ZeroVector);

	// Order must match ETPSMenuPanel.
	{
		UVerticalBox* P = MakePanel(TEXT("TPS ENGINE"),
			TEXT("Aim Trainer: 60 s on steel plates and poppers.\nVS AI: tactical squads patrol, search your last position, hesitate, plan flanks and fight from cover. Survive the waves!\n\nRMB aim (sniper: 2nd RMB opens the scope)  -  LMB / Space fire"));
		AddMenuButton(P, TEXT("AIM TRAINER"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnAimTrainer));
		AddMenuButton(P, TEXT("VS AI"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnVersusAI));
		AddMenuButton(P, TEXT("SETTINGS"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnSettings));
		AddMenuButton(P, TEXT("CONTROLS"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnControls));
		AddMenuButton(P, TEXT("QUIT"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnQuit));
	}
	{
		UVerticalBox* P = MakePanel(TEXT("PAUSED"), TEXT("Esc / P to resume"));
		AddMenuButton(P, TEXT("RESUME"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnResume));
		AddMenuButton(P, TEXT("RESTART"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnRestart));
		AddMenuButton(P, TEXT("SETTINGS"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnSettings));
		AddMenuButton(P, TEXT("CONTROLS"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnControls));
		AddMenuButton(P, TEXT("MAIN MENU"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnMainMenu));
		AddMenuButton(P, TEXT("QUIT"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnQuit));
	}
	{
		UTextBlock* TitleText = nullptr;
		UTextBlock* SubText = nullptr;
		UVerticalBox* P = MakePanel(TEXT("GAME OVER"), TEXT(""), &TitleText, &SubText);
		GameOverTitle = TitleText;
		GameOverSubtitle = SubText;
		GameOverStats = Text(WidgetTree, TEXT(""), 17, TextMain, false, ETextJustify::Left);
		AddRow(P, GameOverStats, FMargin(0.f, 0.f, 0.f, 14.f), HAlign_Center);
		AddMenuButton(P, TEXT("PLAY AGAIN"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnRestart));
		UTextBlock* OtherLabel = nullptr;
		AddMenuButton(P, TEXT("VS AI"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnOtherMode), &OtherLabel);
		OtherModeLabel = OtherLabel;
		AddMenuButton(P, TEXT("MAIN MENU"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnMainMenu));
	}
	{
		UVerticalBox* P = MakePanel(TEXT("SETTINGS"), TEXT("Saved automatically when you leave this screen."));
		const UTPSSettingsSave* S = UTPSSettingsSubsystem::Get(this);
		const UTPSSettingsSave* D = GetDefault<UTPSSettingsSave>();
		const UTPSSettingsSave* V = S ? S : D;
		UTextBlock* Tmp = nullptr;
		MouseSlider = AddSliderRow(P, TEXT("Mouse sensitivity"), 0.1f, 3.f, 0.05f, V->MouseSensitivity, &Tmp); MouseValue = Tmp;
		AimSlider = AddSliderRow(P, TEXT("Aim sensitivity scale"), 0.2f, 1.5f, 0.05f, V->AimSensitivityScale, &Tmp); AimValue = Tmp;
		PadSlider = AddSliderRow(P, TEXT("Gamepad sensitivity"), 0.2f, 3.f, 0.05f, V->GamepadSensitivity, &Tmp); PadValue = Tmp;
		FOVSlider = AddSliderRow(P, TEXT("Field of view"), 60.f, 110.f, 1.f, V->FieldOfView, &Tmp); FOVValue = Tmp;
		VolumeSlider = AddSliderRow(P, TEXT("Master volume"), 0.f, 1.f, 0.05f, V->MasterVolume, &Tmp); VolumeValue = Tmp;
		InvertCheck = AddCheckRow(P, TEXT("Invert Y"), V->bInvertY);
		HoldAimCheck = AddCheckRow(P, TEXT("Hold to aim"), V->bHoldToAim);
		AutoFireCheck = AddCheckRow(P, TEXT("Auto fire (semi-auto)"), V->bAutoFire);
		ShakeCheck = AddCheckRow(P, TEXT("Camera shake"), V->bCameraShake);
		HitStopCheck = AddCheckRow(P, TEXT("Kill hit-stop"), V->bHitStop);
		FPSCheck = AddCheckRow(P, TEXT("Show FPS"), V->bShowFPS);

		MouseSlider->OnValueChanged.AddDynamic(this, &UTPSMenuWidget::OnMouseSens);
		AimSlider->OnValueChanged.AddDynamic(this, &UTPSMenuWidget::OnAimSens);
		PadSlider->OnValueChanged.AddDynamic(this, &UTPSMenuWidget::OnPadSens);
		FOVSlider->OnValueChanged.AddDynamic(this, &UTPSMenuWidget::OnFOV);
		VolumeSlider->OnValueChanged.AddDynamic(this, &UTPSMenuWidget::OnVolume);
		InvertCheck->OnCheckStateChanged.AddDynamic(this, &UTPSMenuWidget::OnInvertY);
		HoldAimCheck->OnCheckStateChanged.AddDynamic(this, &UTPSMenuWidget::OnHoldAim);
		AutoFireCheck->OnCheckStateChanged.AddDynamic(this, &UTPSMenuWidget::OnAutoFire);
		ShakeCheck->OnCheckStateChanged.AddDynamic(this, &UTPSMenuWidget::OnShake);
		HitStopCheck->OnCheckStateChanged.AddDynamic(this, &UTPSMenuWidget::OnHitStop);
		FPSCheck->OnCheckStateChanged.AddDynamic(this, &UTPSMenuWidget::OnShowFPS);

		AddMenuButton(P, TEXT("RESET DEFAULTS"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnResetSettings));
		AddMenuButton(P, TEXT("BACK"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnBack));
		UpdateSliderLabels();
	}
	{
		UVerticalBox* P = MakePanel(TEXT("CONTROLS"), TEXT("Keyboard & mouse  |  Gamepad"));
		UTextBlock* Help = Text(WidgetTree,
			TEXT("WASD / Arrows ........ Move                     | Left stick\n"
				 "Mouse ................ Look                     | Right stick\n"
				 "Shift ................ Run (faster on ladders)  | L3\n"
				 "C .................... Crouch / let go of ladder | B\n"
				 "Q / E ................ Lean left / right        | LB / RB\n"
				 "X .................... Swap camera shoulder     | R3\n"
				 "RMB .................. Aim (2nd RMB: scope)     | LT\n"
				 "LMB .................. Fire                     | RT\n"
				 "Space ................ Fire while aiming, else mantle / dive / dodge roll | A\n"
				 "F .................... Ladder (toggle auto-climb on it) | D-pad up\n"
				 "R .................... Reload                   | X\n"
				 "1-7 / Mouse wheel .... Pistol, M4, Shotgun, Kar98k, RPG-7, AK-74M, Benelli | Y\n"
				 "Esc / P .............. Pause                    | Start\n"
				 "K .................... Animation Studio"),
			14, TextMain);
		AddRow(P, Help, FMargin(0.f, 0.f, 0.f, 14.f), HAlign_Center);
		AddMenuButton(P, TEXT("BACK"), GET_FUNCTION_NAME_CHECKED(UTPSMenuWidget, OnBack));
	}

	bBuilt = true;
	ShowPanel(ETPSMenuPanel::Main);
}

void UTPSMenuWidget::ShowPanel(ETPSMenuPanel Panel)
{
	if (!bBuilt)
	{
		return;
	}
	CurrentPanel = Panel;
	Switcher->SetActiveWidgetIndex(static_cast<int32>(Panel));
	if (Panel == ETPSMenuPanel::GameOver)
	{
		RefreshGameOver();
	}
	if (Panel == ETPSMenuPanel::Settings)
	{
		SyncSettingsWidgets();
	}
}

void UTPSMenuWidget::RefreshGameOver()
{
	const ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this);
	if (!GM || !GameOverTitle)
	{
		return;
	}
	const FTPSRoundStats S = GM->GetStats();
	const int32 Acc = FMath::RoundToInt(S.GetAccuracy() * 100.f);
	if (GM->GetModeType() == ETPSGameModeType::VersusAI)
	{
		GameOverTitle->SetText(FText::FromString(TEXT("YOU DIED")));
		GameOverSubtitle->SetText(FText::FromString(FString::Printf(TEXT("Survived %s  -  reached wave %d"), *UTPSStatics::FormatTime(S.Time), S.Wave)));
		GameOverStats->SetText(FText::FromString(FString::Printf(
			TEXT("Time            %s\nWave            %d\nKills           %d\nHeadshots       %d\nAccuracy        %d%%  (%d / %d)\nBest streak     %d\nMax multiplier  x%.1f\nCombo bonus     %d\nWave bonus      %d\nDamage taken    %d\nPickups         %d\n\nSCORE           %d"),
			*UTPSStatics::FormatTime(S.Time), S.Wave, S.Kills, S.Headshots, Acc, S.Hits, S.Shots, S.BestStreak, S.MaxMultiplier,
			S.ComboBonus, S.WaveBonus, FMath::RoundToInt(S.DamageTaken), S.Pickups, S.Score)));
		OtherModeLabel->SetText(FText::FromString(TEXT("AIM TRAINER")));
	}
	else
	{
		GameOverTitle->SetText(FText::FromString(TEXT("TIME'S UP")));
		GameOverSubtitle->SetText(FText::FromString(FString::Printf(TEXT("Score %d"), S.Score)));
		GameOverStats->SetText(FText::FromString(FString::Printf(
			TEXT("Score       %d\nHits        %d / %d\nAccuracy    %d%%\nHeadshots   %d"), S.Score, S.Hits, S.Shots, Acc, S.Headshots)));
		OtherModeLabel->SetText(FText::FromString(TEXT("VS AI")));
	}
}

// ---------------------------------------------------------------- Buttons

void UTPSMenuWidget::OnAimTrainer()
{
	if (ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
	{
		GM->StartRound(ETPSGameModeType::AimTrainer);
	}
}

void UTPSMenuWidget::OnVersusAI()
{
	if (ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
	{
		GM->StartRound(ETPSGameModeType::VersusAI);
	}
}

void UTPSMenuWidget::OnSettings()
{
	ReturnPanel = CurrentPanel;
	ShowPanel(ETPSMenuPanel::Settings);
}

void UTPSMenuWidget::OnControls()
{
	ReturnPanel = CurrentPanel;
	ShowPanel(ETPSMenuPanel::Controls);
}

void UTPSMenuWidget::OnQuit()
{
	if (ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
	{
		GM->QuitToDesktop();
	}
}

void UTPSMenuWidget::OnResume()
{
	if (ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
	{
		GM->SetMatchPaused(false);
	}
}

void UTPSMenuWidget::OnRestart()
{
	if (ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
	{
		GM->RestartRound();
	}
}

void UTPSMenuWidget::OnMainMenu()
{
	if (ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
	{
		GM->ReturnToMainMenu();
	}
}

void UTPSMenuWidget::OnOtherMode()
{
	if (ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
	{
		GM->StartRound(GM->GetModeType() == ETPSGameModeType::VersusAI ? ETPSGameModeType::AimTrainer : ETPSGameModeType::VersusAI);
	}
}

void UTPSMenuWidget::OnBack()
{
	if (CurrentPanel == ETPSMenuPanel::Settings)
	{
		if (UGameInstance* GI = GetGameInstance())
		{
			if (UTPSSettingsSubsystem* Sub = GI->GetSubsystem<UTPSSettingsSubsystem>())
			{
				Sub->SaveSettings();
			}
		}
	}
	ShowPanel(ReturnPanel);
}

void UTPSMenuWidget::OnResetSettings()
{
	if (UGameInstance* GI = GetGameInstance())
	{
		if (UTPSSettingsSubsystem* Sub = GI->GetSubsystem<UTPSSettingsSubsystem>())
		{
			Sub->ResetToDefaults();
		}
	}
	SyncSettingsWidgets();
}

// ---------------------------------------------------------------- Settings

void UTPSMenuWidget::SyncSettingsWidgets()
{
	const UTPSSettingsSave* S = UTPSSettingsSubsystem::Get(this);
	if (!S || !MouseSlider)
	{
		return;
	}
	bSyncing = true;
	MouseSlider->SetValue(S->MouseSensitivity);
	AimSlider->SetValue(S->AimSensitivityScale);
	PadSlider->SetValue(S->GamepadSensitivity);
	FOVSlider->SetValue(S->FieldOfView);
	VolumeSlider->SetValue(S->MasterVolume);
	InvertCheck->SetIsChecked(S->bInvertY);
	HoldAimCheck->SetIsChecked(S->bHoldToAim);
	AutoFireCheck->SetIsChecked(S->bAutoFire);
	ShakeCheck->SetIsChecked(S->bCameraShake);
	HitStopCheck->SetIsChecked(S->bHitStop);
	FPSCheck->SetIsChecked(S->bShowFPS);
	bSyncing = false;
	UpdateSliderLabels();
	ApplyShowFPS(S->bShowFPS);
}

void UTPSMenuWidget::UpdateSliderLabels()
{
	if (!MouseSlider)
	{
		return;
	}
	MouseValue->SetText(FText::FromString(FString::Printf(TEXT("%.2f"), MouseSlider->GetValue())));
	AimValue->SetText(FText::FromString(FString::Printf(TEXT("%.2f"), AimSlider->GetValue())));
	PadValue->SetText(FText::FromString(FString::Printf(TEXT("%.2f"), PadSlider->GetValue())));
	FOVValue->SetText(FText::FromString(FString::Printf(TEXT("%d"), FMath::RoundToInt(FOVSlider->GetValue()))));
	VolumeValue->SetText(FText::FromString(FString::Printf(TEXT("%d%%"), FMath::RoundToInt(VolumeSlider->GetValue() * 100.f))));
}

void UTPSMenuWidget::ApplyShowFPS(bool bShow)
{
	if (bShow != bFPSShown)
	{
		if (APlayerController* PC = GetOwningPlayer())
		{
			PC->ConsoleCommand(TEXT("stat fps"));
			bFPSShown = bShow;
		}
	}
}

#define TPS_SETTING_SETTER(Func, Field, Type) \
	void UTPSMenuWidget::Func(Type Value) \
	{ \
		if (bSyncing) { return; } \
		if (UTPSSettingsSave* S = UTPSSettingsSubsystem::Get(this)) { S->Field = Value; } \
		UpdateSliderLabels(); \
	}

TPS_SETTING_SETTER(OnMouseSens, MouseSensitivity, float)
TPS_SETTING_SETTER(OnAimSens, AimSensitivityScale, float)
TPS_SETTING_SETTER(OnPadSens, GamepadSensitivity, float)
TPS_SETTING_SETTER(OnFOV, FieldOfView, float)
TPS_SETTING_SETTER(OnVolume, MasterVolume, float)
TPS_SETTING_SETTER(OnInvertY, bInvertY, bool)
TPS_SETTING_SETTER(OnHoldAim, bHoldToAim, bool)
TPS_SETTING_SETTER(OnAutoFire, bAutoFire, bool)
TPS_SETTING_SETTER(OnShake, bCameraShake, bool)
TPS_SETTING_SETTER(OnHitStop, bHitStop, bool)

#undef TPS_SETTING_SETTER

void UTPSMenuWidget::OnShowFPS(bool bChecked)
{
	if (bSyncing)
	{
		return;
	}
	if (UTPSSettingsSave* S = UTPSSettingsSubsystem::Get(this))
	{
		S->bShowFPS = bChecked;
	}
	ApplyShowFPS(bChecked);
}
