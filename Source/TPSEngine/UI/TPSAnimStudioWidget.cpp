#include "UI/TPSAnimStudioWidget.h"
#include "UI/TPSUIStyle.h"
#include "UI/TPSHUD.h"
#include "Core/TPSStatics.h"
#include "Characters/TPSPlayerCharacter.h"
#include "Animation/AnimSequenceBase.h"
#include "Blueprint/WidgetTree.h"
#include "Components/CanvasPanel.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/CheckBox.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/Slider.h"
#include "Components/SizeBox.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "GameFramework/PlayerController.h"

using namespace TPSUI;

namespace
{
	struct FStudioButton
	{
		const TCHAR* Label;
		FName Handler;
	};

	// Every clip shipped with the web build (imported by Scripts/import_tps_assets.py).
	const TCHAR* GStockClips[] = {
		TEXT("A_TP_CH_Handgun_Reload_Empty"), TEXT("A_TP_CH_RL_01_Reload"), TEXT("A_TP_CH_SMG_02_Reload"), TEXT("A_TP_CH_SMG_02_Reload_Empty"),
		TEXT("A_TP_CH_Shotgun_01_Reload_Bolt"), TEXT("A_TP_CH_Sniper_01_Reload_Bolt"), TEXT("A_TP_CH_Sniper_01_Reload_Insert"),
		TEXT("A_TP_CH_Sniper_02_Crouch_Aim_Pose"), TEXT("A_AR_Aim_Fwd"), TEXT("A_AR_AimWalkPose_Fwd"), TEXT("MF_Pistol_Idle_ADS"),
		TEXT("A_Climb_Low_01"), TEXT("A_Climb_Up_02"), TEXT("A_Climb_Up_03"), TEXT("A_JumpRoll"),
		TEXT("A_Ladder_Up_Start"), TEXT("A_Ladder_Up_Loop"), TEXT("A_Ladder_Up_End"),
		TEXT("A_Ladder_Dawn_Start"), TEXT("A_Ladder_Dawn_Loop"), TEXT("A_Ladder_Dawn_End") };
}

void UTPSAnimStudioWidget::NativeOnInitialized()
{
	Super::NativeOnInitialized();
	if (WidgetTree && !WidgetTree->RootWidget)
	{
		BuildLayout();
	}
}

void UTPSAnimStudioWidget::BuildLayout()
{
	UCanvasPanel* Root = WidgetTree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass(), TEXT("StudioRoot"));
	WidgetTree->RootWidget = Root;

	UBorder* Frame = Box(WidgetTree, PanelLight, FMargin(22.f, 18.f));
	UVerticalBox* Col = WidgetTree->ConstructWidget<UVerticalBox>(UVerticalBox::StaticClass());
	Frame->SetContent(Col);
	Place(Root, Frame, FVector2D(1.f, 0.5f), FVector2D(1.f, 0.5f), FVector2D(-24.f, 0.f));

	AddRow(Col, Text(WidgetTree, TEXT("ANIMATION STUDIO"), 22, Accent, true));
	ClipText = Text(WidgetTree, TEXT("-"), 16, TextMain, true);
	AddRow(Col, ClipText);
	InfoText = Text(WidgetTree, TEXT(""), 13, TextDim);
	InfoText->SetAutoWrapText(true);
	USizeBox* InfoSize = WidgetTree->ConstructWidget<USizeBox>(USizeBox::StaticClass());
	InfoSize->SetWidthOverride(320.f);
	InfoSize->AddChild(InfoText);
	AddRow(Col, InfoSize);

	auto AddButtonRow = [this, Col](const TArray<FStudioButton>& Buttons, UTextBlock** FirstLabel)
	{
		UHorizontalBox* Row = WidgetTree->ConstructWidget<UHorizontalBox>(UHorizontalBox::StaticClass());
		for (int32 i = 0; i < Buttons.Num(); ++i)
		{
			UTextBlock* Label = nullptr;
			UButton* Btn = Button(WidgetTree, Buttons[i].Label, 15, &Label);
			FScriptDelegate Delegate;
			Delegate.BindUFunction(this, Buttons[i].Handler);
			Btn->OnClicked.Add(Delegate);
			if (UHorizontalBoxSlot* S = Row->AddChildToHorizontalBox(Btn))
			{
				S->SetPadding(FMargin(3.f));
				S->SetSize(FSlateChildSize(ESlateSizeRule::Fill));
			}
			if (i == 0 && FirstLabel)
			{
				*FirstLabel = Label;
			}
		}
		AddRow(Col, Row);
	};

	AddButtonRow({ { TEXT("< PREV"), GET_FUNCTION_NAME_CHECKED(UTPSAnimStudioWidget, OnPrev) },
		{ TEXT("NEXT >"), GET_FUNCTION_NAME_CHECKED(UTPSAnimStudioWidget, OnNext) } }, nullptr);
	UTextBlock* PlayText = nullptr;
	AddButtonRow({ { TEXT("PLAY"), GET_FUNCTION_NAME_CHECKED(UTPSAnimStudioWidget, OnPlayPause) },
		{ TEXT("RESTART"), GET_FUNCTION_NAME_CHECKED(UTPSAnimStudioWidget, OnRestart) } }, &PlayText);
	PlayLabel = PlayText;

	UHorizontalBox* SpeedRow = WidgetTree->ConstructWidget<UHorizontalBox>(UHorizontalBox::StaticClass());
	SpeedRow->AddChildToHorizontalBox(Text(WidgetTree, TEXT("Speed "), 14, TextMain))->SetVerticalAlignment(VAlign_Center);
	SpeedSlider = Slider(WidgetTree, 0.1f, 2.f, 0.05f, Speed);
	SpeedSlider->OnValueChanged.AddDynamic(this, &UTPSAnimStudioWidget::OnSpeedChanged);
	USizeBox* SliderSize = WidgetTree->ConstructWidget<USizeBox>(USizeBox::StaticClass());
	SliderSize->SetWidthOverride(180.f);
	SliderSize->AddChild(SpeedSlider);
	SpeedRow->AddChildToHorizontalBox(SliderSize)->SetVerticalAlignment(VAlign_Center);
	SpeedText = Text(WidgetTree, TEXT("1.00x"), 14, Accent, true);
	SpeedRow->AddChildToHorizontalBox(SpeedText)->SetVerticalAlignment(VAlign_Center);
	AddRow(Col, SpeedRow);

	UHorizontalBox* LoopRow = WidgetTree->ConstructWidget<UHorizontalBox>(UHorizontalBox::StaticClass());
	LoopCheck = Check(WidgetTree, bLoop);
	LoopCheck->OnCheckStateChanged.AddDynamic(this, &UTPSAnimStudioWidget::OnLoopChanged);
	LoopRow->AddChildToHorizontalBox(LoopCheck)->SetVerticalAlignment(VAlign_Center);
	LoopRow->AddChildToHorizontalBox(Text(WidgetTree, TEXT(" Loop"), 14, TextMain))->SetVerticalAlignment(VAlign_Center);
	AddRow(Col, LoopRow);

	AddButtonRow({ { TEXT("CLOSE (K)"), GET_FUNCTION_NAME_CHECKED(UTPSAnimStudioWidget, OnClose) } }, nullptr);
}

void UTPSAnimStudioWidget::RefreshClips()
{
	Clips.Reset();
	for (const TCHAR* Name : GStockClips)
	{
		if (UAnimSequenceBase* Clip = UTPSStatics::TryLoad<UAnimSequenceBase>(FString::Printf(TEXT("/Game/TPS/Animations/%s.%s"), Name, Name)))
		{
			Clips.Add(Clip);
		}
	}
	for (UAnimSequenceBase* Clip : ExtraClips)
	{
		if (Clip)
		{
			Clips.AddUnique(Clip);
		}
	}
	Index = Clips.Num() > 0 ? FMath::Clamp(Index, 0, Clips.Num() - 1) : 0;
	UpdateLabels();
}

void UTPSAnimStudioWidget::UpdateLabels()
{
	if (!ClipText)
	{
		return;
	}
	const ATPSPlayerCharacter* Player = UTPSStatics::GetTPSPlayer(this);
	if (Clips.Num() == 0)
	{
		ClipText->SetText(FText::FromString(TEXT("No clips found")));
		InfoText->SetText(FText::FromString(TEXT("Run Scripts/import_tps_assets.py in the editor to import the FBX clips into /Game/TPS/Animations.")));
		return;
	}
	const UAnimSequenceBase* Clip = Clips[Index];
	ClipText->SetText(FText::FromString(FString::Printf(TEXT("%d / %d  %s"), Index + 1, Clips.Num(), *Clip->GetName())));
	FString Info = FString::Printf(TEXT("Length %.2f s"), Clip->GetPlayLength());
	if (!Player || !Player->HasSkeletalVisual())
	{
		Info += TEXT("\nPreview needs the skeletal character: create ABP_TPS (see Docs/SETUP.md).");
	}
	InfoText->SetText(FText::FromString(Info));
	SpeedText->SetText(FText::FromString(FString::Printf(TEXT("%.2fx"), Speed)));
	PlayLabel->SetText(FText::FromString(bPlaying && !bPaused ? TEXT("PAUSE") : TEXT("PLAY")));
}

void UTPSAnimStudioWidget::PlayCurrent()
{
	ATPSPlayerCharacter* Player = UTPSStatics::GetTPSPlayer(this);
	if (!Player || !Clips.IsValidIndex(Index))
	{
		return;
	}
	Player->PlayActionAnim(Clips[Index], Speed, bLoop ? 999 : 1, false, 0.1f, 0.2f);
	bPlaying = true;
	bPaused = false;
	UpdateLabels();
}

void UTPSAnimStudioWidget::OnPrev()
{
	if (Clips.Num() > 0)
	{
		Index = (Index - 1 + Clips.Num()) % Clips.Num();
		PlayCurrent();
	}
}

void UTPSAnimStudioWidget::OnNext()
{
	if (Clips.Num() > 0)
	{
		Index = (Index + 1) % Clips.Num();
		PlayCurrent();
	}
}

void UTPSAnimStudioWidget::OnPlayPause()
{
	ATPSPlayerCharacter* Player = UTPSStatics::GetTPSPlayer(this);
	if (!Player)
	{
		return;
	}
	if (!bPlaying)
	{
		PlayCurrent();
		return;
	}
	bPaused = !bPaused;
	Player->SetActionAnimPaused(bPaused);
	UpdateLabels();
}

void UTPSAnimStudioWidget::OnRestart()
{
	PlayCurrent();
}

void UTPSAnimStudioWidget::OnClose()
{
	if (ATPSHUD* TPSHud = Cast<ATPSHUD>(GetOwningPlayer() ? GetOwningPlayer()->GetHUD() : nullptr))
	{
		TPSHud->SetAnimStudioOpen(false);
	}
}

void UTPSAnimStudioWidget::OnClosed()
{
	if (bPlaying)
	{
		if (ATPSPlayerCharacter* Player = UTPSStatics::GetTPSPlayer(this))
		{
			Player->StopActionAnim(0.2f);
		}
	}
	bPlaying = false;
	bPaused = false;
	UpdateLabels();
}

void UTPSAnimStudioWidget::OnSpeedChanged(float Value)
{
	Speed = Value;
	if (bPlaying)
	{
		if (ATPSPlayerCharacter* Player = UTPSStatics::GetTPSPlayer(this))
		{
			Player->SetActionAnimRate(Speed);
		}
	}
	UpdateLabels();
}

void UTPSAnimStudioWidget::OnLoopChanged(bool bChecked)
{
	bLoop = bChecked;
}
