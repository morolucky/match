#pragma once

#include "CoreMinimal.h"
#include "Layout/Margin.h"
#include "Types/SlateEnums.h"
#include "Framework/Text/TextLayout.h"

class UWidgetTree;
class UTextBlock;
class UButton;
class UBorder;
class UImage;
class UWidget;
class UCanvasPanel;
class UCanvasPanelSlot;
class UVerticalBox;
class USlider;
class UCheckBox;

/** Shared look + tiny builders for the code-built UMG widgets. */
namespace TPSUI
{
	extern const FLinearColor Accent;
	extern const FLinearColor AccentDim;
	extern const FLinearColor Panel;
	extern const FLinearColor PanelLight;
	extern const FLinearColor TextMain;
	extern const FLinearColor TextDim;
	extern const FLinearColor Danger;
	extern const FLinearColor Good;
	extern const FLinearColor Head;

	TPSENGINE_API UTextBlock* Text(UWidgetTree* Tree, const FString& Value, int32 Size, const FLinearColor& Color, bool bBold = false, ETextJustify::Type Justify = ETextJustify::Left);
	TPSENGINE_API void SetFontSize(UTextBlock* Block, int32 Size);
	TPSENGINE_API UBorder* Box(UWidgetTree* Tree, const FLinearColor& Color, const FMargin& Padding);
	TPSENGINE_API UImage* Rect(UWidgetTree* Tree, const FLinearColor& Color);
	/** Button with a centered label; bind OnClicked on the returned button. */
	TPSENGINE_API UButton* Button(UWidgetTree* Tree, const FString& Label, int32 FontSize = 20, UTextBlock** OutLabel = nullptr);
	TPSENGINE_API USlider* Slider(UWidgetTree* Tree, float Min, float Max, float Step, float Value);
	TPSENGINE_API UCheckBox* Check(UWidgetTree* Tree, bool bChecked);

	/** Adds Child to a canvas with anchors/alignment/position; Size <= 0 means auto-size. */
	TPSENGINE_API UCanvasPanelSlot* Place(UCanvasPanel* Canvas, UWidget* Child, const FVector2D& Anchor, const FVector2D& Alignment,
		const FVector2D& Position, const FVector2D& Size = FVector2D::ZeroVector);
	/** Stretches Child over the whole canvas. */
	TPSENGINE_API UCanvasPanelSlot* Fill(UCanvasPanel* Canvas, UWidget* Child);
	TPSENGINE_API void AddRow(UVerticalBox* Box, UWidget* Child, const FMargin& Padding = FMargin(0.f, 4.f), EHorizontalAlignment HAlign = HAlign_Fill);
}
