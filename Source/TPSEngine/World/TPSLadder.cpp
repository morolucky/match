#include "World/TPSLadder.h"
#include "Core/TPSStatics.h"
#include "Components/BoxComponent.h"
#include "Components/ArrowComponent.h"
#include "Components/StaticMeshComponent.h"

ATPSLadder::ATPSLadder()
{
	PrimaryActorTick.bCanEverTick = false;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	BottomTrigger = CreateDefaultSubobject<UBoxComponent>(TEXT("BottomTrigger"));
	BottomTrigger->SetupAttachment(Root);
	BottomTrigger->SetCollisionProfileName(TEXT("OverlapAllDynamic"));
	BottomTrigger->SetCanEverAffectNavigation(false);

	TopTrigger = CreateDefaultSubobject<UBoxComponent>(TEXT("TopTrigger"));
	TopTrigger->SetupAttachment(Root);
	TopTrigger->SetCollisionProfileName(TEXT("OverlapAllDynamic"));
	TopTrigger->SetCanEverAffectNavigation(false);

	ClimbDirection = CreateDefaultSubobject<UArrowComponent>(TEXT("ClimbDirection"));
	ClimbDirection->SetupAttachment(Root);
	ClimbDirection->SetRelativeLocation(FVector(-ClimbOffset, 0.f, 90.f));

	UpdateTriggers();
}

void ATPSLadder::UpdateTriggers()
{
	BottomTrigger->SetBoxExtent(FVector(70.f, Width + 40.f, 100.f));
	BottomTrigger->SetRelativeLocation(FVector(-ClimbOffset - 20.f, 0.f, 100.f));
	TopTrigger->SetBoxExtent(FVector(80.f, Width + 40.f, 100.f));
	TopTrigger->SetRelativeLocation(FVector(TopExitForward, 0.f, Height + 100.f));
}

void ATPSLadder::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	UpdateTriggers();
}

void ATPSLadder::BeginPlay()
{
	Super::BeginPlay();
	UpdateTriggers();
	if (!bBuildPlaceholderMesh)
	{
		return;
	}

	const FLinearColor Steel(0.45f, 0.45f, 0.42f);
	const FLinearColor Hazard(0.9f, 0.65f, 0.05f);
	const float RailHeight = Height + 100.f;
	for (const float Side : { -1.f, 1.f })
	{
		UTPSStatics::AddShape(this, Root, ETPSShape::Cube, FVector(0.f, Side * Width * 0.5f, RailHeight * 0.5f),
			FVector(0.05f, 0.05f, RailHeight / 100.f), FRotator::ZeroRotator, Steel, false);
		UTPSStatics::AddShape(this, Root, ETPSShape::Cube, FVector(0.f, Side * Width * 0.5f, 1.f),
			FVector(0.14f, 0.1f, 0.02f), FRotator::ZeroRotator, Hazard, false);
	}
	for (float Z = 30.f; Z < Height + 10.f; Z += 30.f)
	{
		UTPSStatics::AddShape(this, Root, ETPSShape::Cylinder, FVector(0.f, 0.f, Z),
			FVector(0.03f, 0.03f, Width / 100.f), FRotator(0.f, 0.f, 90.f), Steel, false);
	}
}

FVector ATPSLadder::GetClimbBase() const
{
	return GetActorLocation() - GetActorForwardVector() * ClimbOffset;
}

FVector ATPSLadder::GetTopExit() const
{
	return GetActorLocation() + GetActorForwardVector() * TopExitForward + FVector(0.f, 0.f, Height);
}
