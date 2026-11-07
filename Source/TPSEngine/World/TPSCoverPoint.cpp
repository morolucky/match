#include "World/TPSCoverPoint.h"
#include "Components/ArrowComponent.h"

ATPSCoverPoint::ATPSCoverPoint()
{
	PrimaryActorTick.bCanEverTick = false;
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);
	Arrow = CreateDefaultSubobject<UArrowComponent>(TEXT("Arrow"));
	Arrow->SetupAttachment(Root);
	Arrow->SetRelativeLocation(FVector(0.f, 0.f, 40.f));
	Arrow->ArrowColor = FColor(60, 200, 255);
	SetActorHiddenInGame(true);
}

ATPSEnemySpawnPoint::ATPSEnemySpawnPoint()
{
	PrimaryActorTick.bCanEverTick = false;
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);
	Arrow = CreateDefaultSubobject<UArrowComponent>(TEXT("Arrow"));
	Arrow->SetupAttachment(Root);
	Arrow->SetRelativeLocation(FVector(0.f, 0.f, 60.f));
	Arrow->ArrowColor = FColor(255, 70, 60);
	SetActorHiddenInGame(true);
}
