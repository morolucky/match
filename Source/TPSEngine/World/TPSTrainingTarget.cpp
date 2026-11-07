#include "World/TPSTrainingTarget.h"
#include "Core/TPSStatics.h"
#include "Core/TPSGameMode.h"
#include "Characters/TPSCharacter.h"
#include "Components/StaticMeshComponent.h"
#include "Sound/SoundBase.h"

ATPSTrainingTarget::ATPSTrainingTarget()
{
	PrimaryActorTick.bCanEverTick = true;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	Root->SetMobility(EComponentMobility::Movable);
	SetRootComponent(Root);

	Pivot = CreateDefaultSubobject<USceneComponent>(TEXT("Pivot"));
	Pivot->SetupAttachment(Root);
}

void ATPSTrainingTarget::BeginPlay()
{
	Super::BeginPlay();
	BaseLocation = GetActorLocation();
	Phase = FMath::FRandRange(0.f, 6.28f);
	Build();
}

void ATPSTrainingTarget::Build()
{
	if (bBuilt)
	{
		return;
	}
	bBuilt = true;
	const FLinearColor Post(0.18f, 0.18f, 0.2f);

	if (Kind == ETPSTargetKind::SteelPlate)
	{
		// Frame: two posts and a crossbar; the plate hangs from the pivot on the bar.
		const float Top = HangHeight + 8.f;
		for (const float Side : { -1.f, 1.f })
		{
			UTPSStatics::AddShape(this, Root, ETPSShape::Cube, FVector(0.f, Side * (PlateRadius + 25.f), Top * 0.5f),
				FVector(0.05f, 0.05f, Top / 100.f), FRotator::ZeroRotator, Post, true);
		}
		UTPSStatics::AddShape(this, Root, ETPSShape::Cube, FVector(0.f, 0.f, Top), FVector(0.05f, (PlateRadius + 30.f) * 2.f / 100.f, 0.05f),
			FRotator::ZeroRotator, Post, true);
		Pivot->SetRelativeLocation(FVector(0.f, 0.f, HangHeight));
		UTPSStatics::AddShape(this, Pivot, ETPSShape::Cylinder, FVector(0.f, 0.f, -8.f - PlateRadius),
			FVector(PlateRadius * 2.f / 100.f, PlateRadius * 2.f / 100.f, 0.014f), FRotator(90.f, 0.f, 0.f), FLinearColor(0.85f, 0.85f, 0.82f), true);
		UTPSStatics::AddShape(this, Pivot, ETPSShape::Cube, FVector(0.f, 0.f, -4.f), FVector(0.01f, 0.01f, 0.08f), FRotator::ZeroRotator, Post, false);
	}
	else
	{
		// Popper silhouette (body 46 x 60 + head), pivoting at its base.
		Pivot->SetRelativeLocation(FVector::ZeroVector);
		const FLinearColor Orange(0.82f, 0.48f, 0.2f);
		UTPSStatics::AddShape(this, Pivot, ETPSShape::Cube, FVector(0.f, 0.f, 30.f), FVector(0.012f, 0.46f, 0.6f), FRotator::ZeroRotator, Orange, true);
		UTPSStatics::AddShape(this, Pivot, ETPSShape::Cube, FVector(0.f, 0.f, 68.f), FVector(0.012f, 0.2f, 0.16f), FRotator::ZeroRotator, Orange, true);
		UTPSStatics::AddShape(this, Root, ETPSShape::Cube, FVector(0.f, 0.f, -1.f), FVector(0.3f, 0.5f, 0.03f), FRotator::ZeroRotator, FLinearColor(0.2f, 0.2f, 0.22f), false);
	}
}

void ATPSTrainingTarget::ResetTarget()
{
	SwingAngle = SwingVelocity = 0.f;
	bDown = false;
	DownTimer = 0.f;
	FallAngle = 0.f;
	Pivot->SetRelativeRotation(FRotator::ZeroRotator);
}

bool ATPSTrainingTarget::ReceiveShot(const FHitResult& Hit, ATPSCharacter* Shooter, bool& bOutHeadshot)
{
	bOutHeadshot = false;
	ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this);
	const float Distance = FVector::Dist(Hit.TraceStart, Hit.ImpactPoint);

	if (Kind == ETPSTargetKind::SteelPlate)
	{
		SwingVelocity += FMath::FRandRange(260.f, 340.f);
		UTPSStatics::PlaySoundAt(this, HitSound, Hit.ImpactPoint, 1.f, 1.f + 0.5f * (20.f / FMath::Max(10.f, PlateRadius)));
		if (!GM || !GM->IsPlaying())
		{
			return false;
		}
		const int32 Points = 100 + FMath::RoundToInt(Distance / 20.f);
		GM->AddScore(Points, Hit.ImpactPoint, FText::FromString(FString::Printf(TEXT("+%d"), Points)), false);
		return true;
	}

	if (bDown)
	{
		return false;
	}
	bOutHeadshot = (Hit.ImpactPoint.Z - Pivot->GetComponentLocation().Z) > PopperHeadHeight * GetActorScale3D().Z;
	bDown = true;
	DownTimer = PopperResetTime;
	UTPSStatics::PlaySoundAt(this, HitSound, Hit.ImpactPoint, 1.f, 0.8f);
	if (!GM || !GM->IsPlaying())
	{
		return false;
	}
	const int32 Points = bOutHeadshot ? 150 : 100;
	GM->AddScore(Points, Hit.ImpactPoint, FText::FromString(FString::Printf(bOutHeadshot ? TEXT("HEAD +%d") : TEXT("+%d"), Points)), bOutHeadshot);
	return true;
}

void ATPSTrainingTarget::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (MoveAmplitude > 0.f)
	{
		Phase += DeltaSeconds * MoveSpeed;
		SetActorLocation(BaseLocation + GetActorRightVector() * FMath::Sin(Phase) * MoveAmplitude);
	}

	if (Kind == ETPSTargetKind::SteelPlate)
	{
		// Damped spring swing (degrees).
		SwingVelocity += (-SwingAngle * 60.f - SwingVelocity * 3.f) * DeltaSeconds;
		SwingAngle += SwingVelocity * DeltaSeconds;
		Pivot->SetRelativeRotation(FRotator(SwingAngle, 0.f, 0.f));
	}
	else
	{
		if (bDown)
		{
			DownTimer -= DeltaSeconds;
			if (DownTimer <= 0.f)
			{
				bDown = false;
			}
		}
		FallAngle = FMath::FInterpTo(FallAngle, bDown ? -85.f : 0.f, DeltaSeconds, bDown ? 9.f : 4.f);
		Pivot->SetRelativeRotation(FRotator(FallAngle, 0.f, 0.f));
	}
}
