#include "World/TPSPickup.h"
#include "Core/TPSStatics.h"
#include "Core/TPSGameMode.h"
#include "Characters/TPSPlayerCharacter.h"
#include "Components/TPSHealthComponent.h"
#include "Components/TPSCombatComponent.h"
#include "Components/SphereComponent.h"

ATPSPickup::ATPSPickup()
{
	PrimaryActorTick.bCanEverTick = true;

	Trigger = CreateDefaultSubobject<USphereComponent>(TEXT("Trigger"));
	Trigger->InitSphereRadius(70.f);
	Trigger->SetCollisionProfileName(TEXT("OverlapAllDynamic"));
	Trigger->SetCanEverAffectNavigation(false);
	SetRootComponent(Trigger);

	VisualRoot = CreateDefaultSubobject<USceneComponent>(TEXT("VisualRoot"));
	VisualRoot->SetupAttachment(Trigger);
}

void ATPSPickup::BeginPlay()
{
	Super::BeginPlay();
	Trigger->OnComponentBeginOverlap.AddDynamic(this, &ATPSPickup::OnOverlap);

	if (Type == ETPSPickupType::Health)
	{
		const FLinearColor Green(0.1f, 0.85f, 0.3f);
		UTPSStatics::AddShape(this, VisualRoot, ETPSShape::Cube, FVector::ZeroVector, FVector(0.36f, 0.12f, 0.12f), FRotator::ZeroRotator, Green, false);
		UTPSStatics::AddShape(this, VisualRoot, ETPSShape::Cube, FVector::ZeroVector, FVector(0.12f, 0.12f, 0.36f), FRotator::ZeroRotator, Green, false);
	}
	else
	{
		UTPSStatics::AddShape(this, VisualRoot, ETPSShape::Cube, FVector::ZeroVector, FVector(0.32f, 0.2f, 0.18f), FRotator::ZeroRotator, FLinearColor(0.75f, 0.6f, 0.15f), false);
		UTPSStatics::AddShape(this, VisualRoot, ETPSShape::Cube, FVector(0.f, 0.f, 10.f), FVector(0.34f, 0.22f, 0.03f), FRotator::ZeroRotator, FLinearColor(0.2f, 0.25f, 0.12f), false);
	}

	if (Lifetime > 0.f)
	{
		SetLifeSpan(Lifetime);
	}

	// Catch a player already standing on the spawn spot.
	TArray<AActor*> Overlapping;
	Trigger->GetOverlappingActors(Overlapping, ATPSPlayerCharacter::StaticClass());
	if (Overlapping.Num() > 0)
	{
		FHitResult Dummy;
		OnOverlap(Trigger, Overlapping[0], nullptr, 0, false, Dummy);
	}
}

void ATPSPickup::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Age += DeltaSeconds;
	VisualRoot->SetRelativeLocationAndRotation(FVector(0.f, 0.f, 10.f * FMath::Sin(Age * 3.f)), FRotator(0.f, Age * 90.f, 0.f));
}

void ATPSPickup::OnOverlap(UPrimitiveComponent* OverlappedComp, AActor* OtherActor, UPrimitiveComponent* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult)
{
	ATPSPlayerCharacter* Player = Cast<ATPSPlayerCharacter>(OtherActor);
	if (!Player || Player->IsDead() || IsActorBeingDestroyed())
	{
		return;
	}
	if (Type == ETPSPickupType::Health)
	{
		if (Player->Health->GetHealth() >= Player->Health->GetMaxHealth())
		{
			return;
		}
		Player->Health->Heal(HealAmount);
	}
	else if (Player->Combat)
	{
		Player->Combat->RefillAllAmmo();
	}
	UTPSStatics::PlaySoundAt(this, PickupSound, GetActorLocation(), 1.f, 1.f);
	if (ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
	{
		GM->NotifyPickup(Type);
	}
	Destroy();
}
