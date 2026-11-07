#include "UI/TPSUIStyle.h"
#include "Blueprint/WidgetTree.h"
#include "Components/TextBlock.h"
#include "Components/Button.h"
#include "Components/Border.h"
#include "Components/Image.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "Components/Slider.h"
#include "Components/CheckBox.h"
#include "Fonts/SlateFontInfo.h"

namespace TPSUI
{
	const FLinearColor Accent(1.f, 0.62f, 0.12f, 1.f);
	const FLinearColor AccentDim(0.55f, 0.33f, 0.06f, 1.f);
	const FLinearColor Panel(0.015f, 0.018f, 0.024f, 0.82f);
	const FLinearColor PanelLight(0.06f, 0.07f, 0.09f, 0.9f);
	const FLinearColor TextMain(0.95f, 0.95f, 0.95f, 1.f);
	const FLinearColor TextDim(0.62f, 0.65f, 0.7f, 1.f);
	const FLinearColor Danger(1.f, 0.2f, 0.16f, 1.f);
	const FLinearColor Good(0.3f, 1.f, 0.45f, 1.f);
	const FLinearColor Head(1.f, 0.82f, 0.2f, 1.f);

	UTextBlock* Text(UWidgetTree* Tree, const FString& Value, int32 Size, const FLinearColor& Color, bool bBold, ETextJustify::Type Justify)
	{
		UTextBlock* Block = Tree->ConstructWidget<UTextBlock>(UTextBlock::StaticClass());
		Block->SetText(FText::FromString(Value));
		Block->SetColorAndOpacity(FSlateColor(Color));
		Block->SetShadowOffset(FVector2D(1.f, 1.f));
		Block->SetShadowColorAndOpacity(FLinearColor(0.f, 0.f, 0.f, 0.75f));
		Block->SetJustification(Justify);
		FSlateFontInfo Font = Block->GetFont();
		Font.Size = Size;
		Font.TypefaceFontName = bBold ? FName(TEXT("Bold")) : FName(TEXT("Regular"));
		Block->SetFont(Font);
		return Block;
	}

	void SetFontSize(UTextBlock* Block, int32 Size)
	{
		if (Block)
		{
			FSlateFontInfo Font = Block->GetFont();
			Font.Size = Size;
			Block->SetFont(Font);
		}
	}

	UBorder* Box(UWidgetTree* Tree, const FLinearColor& Color, const FMargin& Padding)
	{
		UBorder* Border = Tree->ConstructWidget<UBorder>(UBorder::StaticClass());
		Border->SetBrushColor(Color);
		Border->SetPadding(Padding);
		return Border;
	}

	UImage* Rect(UWidgetTree* Tree, const FLinearColor& Color)
	{
		UImage* Image = Tree->ConstructWidget<UImage>(UImage::StaticClass());
		Image->SetColorAndOpacity(Color);
		return Image;
	}

	UButton* Button(UWidgetTree* Tree, const FString& Label, int32 FontSize, UTextBlock** OutLabel)
	{
		UButton* Btn = Tree->ConstructWidget<UButton>(UButton::StaticClass());
		Btn->SetBackgroundColor(FLinearColor(0.12f, 0.13f, 0.16f, 0.95f));
		UTextBlock* LabelText = Text(Tree, Label, FontSize, TextMain, true, ETextJustify::Center);
		Btn->AddChild(LabelText);
		if (OutLabel)
		{
			*OutLabel = LabelText;
		}
		return Btn;
	}

	USlider* Slider(UWidgetTree* Tree, float Min, float Max, float Step, float Value)
	{
		USlider* S = Tree->ConstructWidget<USlider>(USlider::StaticClass());
		S->SetMinValue(Min);
		S->SetMaxValue(Max);
		S->SetStepSize(Step);
		S->SetValue(Value);
		S->SetSliderBarColor(FLinearColor(0.25f, 0.27f, 0.3f));
		S->SetSliderHandleColor(Accent);
		return S;
	}

	UCheckBox* Check(UWidgetTree* Tree, bool bChecked)
	{
		UCheckBox* CheckWidget = Tree->ConstructWidget<UCheckBox>(UCheckBox::StaticClass());
		CheckWidget->SetIsChecked(bChecked);
		return CheckWidget;
	}

	UCanvasPanelSlot* Place(UCanvasPanel* Canvas, UWidget* Child, const FVector2D& Anchor, const FVector2D& Alignment,
		const FVector2D& Position, const FVector2D& Size)
	{
		UCanvasPanelSlot* Slot = Canvas->AddChildToCanvas(Child);
		Slot->SetAnchors(FAnchors(Anchor.X, Anchor.Y));
		Slot->SetAlignment(Alignment);
		Slot->SetPosition(Position);
		if (Size.X > 0.f && Size.Y > 0.f)
		{
			Slot->SetAutoSize(false);
			Slot->SetSize(Size);
		}
		else
		{
			Slot->SetAutoSize(true);
		}
		return Slot;
	}

	UCanvasPanelSlot* Fill(UCanvasPanel* Canvas, UWidget* Child)
	{
		UCanvasPanelSlot* Slot = Canvas->AddChildToCanvas(Child);
		Slot->SetAnchors(FAnchors(0.f, 0.f, 1.f, 1.f));
		Slot->SetOffsets(FMargin(0.f));
		return Slot;
	}

	void AddRow(UVerticalBox* Box, UWidget* Child, const FMargin& Padding, EHorizontalAlignment HAlign)
	{
		if (UVerticalBoxSlot* Slot = Box->AddChildToVerticalBox(Child))
		{
			Slot->SetPadding(Padding);
			Slot->SetHorizontalAlignment(HAlign);
		}
	}
}
