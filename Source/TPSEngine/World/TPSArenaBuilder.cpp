#include "World/TPSArenaBuilder.h"
#include "Core/TPSStatics.h"
#include "World/TPSTrainingTarget.h"
#include "World/TPSCoverPoint.h"
#include "World/TPSLadder.h"
#include "Components/StaticMeshComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/SkyLight.h"
#include "Engine/StaticMesh.h"
#include "Engine/CollisionProfile.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerStart.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

// ------------------------------------------------------------------ Block

ATPSArenaBlock::ATPSArenaBlock()
{
	PrimaryActorTick.bCanEverTick = false;
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
	Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	Mesh->SetStaticMesh(Cube.Object);
	Mesh->SetMobility(EComponentMobility::Movable);
	Mesh->SetCollisionProfileName(UCollisionProfile::BlockAll_ProfileName);
	Mesh->SetCanEverAffectNavigation(true);
	SetRootComponent(Mesh);
}

void ATPSArenaBlock::Setup(const FVector& Size, const FLinearColor& Color)
{
	SetActorScale3D(Size / 100.f);
	Mesh->SetMaterial(0, UTPSStatics::MakeColorMaterial(this, Color));
}

void ATPSArenaBlock::SetActive(bool bActive)
{
	SetActorHiddenInGame(!bActive);
	SetActorEnableCollision(bActive);
}

// ------------------------------------------------------------------ Builder

namespace TPSArena
{
	// Web build data (ai.js COVER_DEFS): x, z, width, depth, height, yaw(deg), kind. Converted with UTPSStatics::FromWeb.
	struct FCoverDef { float X, Z, W, D, H, Yaw; int32 Kind; };
	static const FCoverDef Covers[] = {
		{ -430, 560, 300, 40, 225, 0, 1 }, { 470, 600, 280, 40, 225, 0, 1 }, { 40, 900, 300, 70, 130, 0, 0 },
		{ -720, 1250, 130, 130, 130, 15, 2 }, { 260, 1380, 320, 70, 130, 10, 0 }, { -160, 1720, 360, 45, 230, 0, 1 },
		{ 860, 1650, 130, 130, 130, -10, 2 }, { -1060, 1900, 140, 140, 135, 30, 2 }, { 660, 2160, 45, 340, 230, 0, 1 },
		{ -460, 2460, 320, 70, 130, -12, 0 }, { 200, 2660, 140, 140, 230, 0, 2 }, { 1010, 2800, 300, 70, 130, 15, 0 },
		{ -900, 3020, 380, 45, 230, 0, 1 }, { -150, 3220, 130, 130, 130, 20, 2 }, { 520, 3360, 320, 70, 130, 0, 0 },
	};
	static const FLinearColor KindColors[] = {
		FLinearColor(0.55f, 0.57f, 0.59f), FLinearColor(0.66f, 0.64f, 0.6f), FLinearColor(0.54f, 0.38f, 0.22f) };

	// game.js plates: x, z, hang height, radius, move. Poppers: x, z, move.
	struct FPlateDef { float X, Z, Y, R, Move; };
	static const FPlateDef Plates[] = {
		{ -150, 650, 120, 22, 0 }, { 130, 900, 130, 18, 0 }, { -380, 1300, 140, 26, 0 }, { 320, 1700, 150, 30, 160 }, { 0, 2300, 160, 34, 0 } };
	struct FPopperDef { float X, Z, Move; };
	static const FPopperDef Poppers[] = { { 260, 820, 0 }, { -260, 1050, 170 }, { 60, 1500, 0 }, { -520, 1850, 0 }, { 480, 1250, 120 } };

	// ai.js spawn points (x, z).
	static const FVector2D EnemySpawns[] = { { -1300, 3700 }, { 0, 3950 }, { 1300, 3700 }, { -1750, 2500 }, { 1750, 2500 } };
}

ATPSArenaBuilder::ATPSArenaBuilder()
{
	PrimaryActorTick.bCanEverTick = false;
	SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("Root")));
}

void ATPSArenaBuilder::BeginPlay()
{
	Super::BeginPlay();
	BuildArena();
}

void ATPSArenaBuilder::EnsureWorldBasics(UWorld* World)
{
	if (!World)
	{
		return;
	}

	bool bHasSun = false;
	for (TActorIterator<ADirectionalLight> It(World); It; ++It)
	{
		bHasSun = true;
		break;
	}
	if (!bHasSun)
	{
		const FTransform SunTransform(FRotator(-48.f, 35.f, 0.f), FVector(0.f, 0.f, 1000.f));
		if (ADirectionalLight* Sun = World->SpawnActorDeferred<ADirectionalLight>(ADirectionalLight::StaticClass(), SunTransform))
		{
			if (UDirectionalLightComponent* SunComp = Cast<UDirectionalLightComponent>(Sun->GetLightComponent()))
			{
				SunComp->SetMobility(EComponentMobility::Movable);
				SunComp->SetIntensity(8.f);
				SunComp->SetAtmosphereSunLight(true);
			}
			Sun->FinishSpawning(SunTransform);
		}

		bool bHasSkyLight = false;
		for (TActorIterator<ASkyLight> It(World); It; ++It)
		{
			bHasSkyLight = true;
			break;
		}
		if (!bHasSkyLight)
		{
			const FTransform SkyTransform(FVector(0.f, 0.f, 1200.f));
			if (ASkyLight* Sky = World->SpawnActorDeferred<ASkyLight>(ASkyLight::StaticClass(), SkyTransform))
			{
				if (USkyLightComponent* SkyComp = Sky->GetLightComponent())
				{
					SkyComp->SetMobility(EComponentMobility::Movable);
					SkyComp->bRealTimeCapture = true;
					SkyComp->SetIntensity(1.f);
				}
				Sky->FinishSpawning(SkyTransform);
			}
		}

		bool bHasAtmosphere = false;
		for (TActorIterator<ASkyAtmosphere> It(World); It; ++It)
		{
			bHasAtmosphere = true;
			break;
		}
		if (!bHasAtmosphere)
		{
			World->SpawnActor<ASkyAtmosphere>(ASkyAtmosphere::StaticClass(), FTransform::Identity);
		}
	}

	bool bHasStart = false;
	for (TActorIterator<APlayerStart> It(World); It; ++It)
	{
		bHasStart = true;
		break;
	}
	if (!bHasStart)
	{
		FActorSpawnParameters Params;
		Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		World->SpawnActor<APlayerStart>(APlayerStart::StaticClass(), FVector(0.f, 0.f, 100.f), FRotator::ZeroRotator, Params);
	}
}

ATPSArenaBlock* ATPSArenaBuilder::SpawnBlock(const FVector& Center, const FVector& Size, float Yaw, const FLinearColor& Color)
{
	FActorSpawnParameters Params;
	Params.Owner = this;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	ATPSArenaBlock* Block = GetWorld()->SpawnActor<ATPSArenaBlock>(ATPSArenaBlock::StaticClass(), GetActorTransform().TransformPosition(Center),
		FRotator(0.f, GetActorRotation().Yaw + Yaw, 0.f), Params);
	if (Block)
	{
		Block->Setup(Size, Color);
	}
	return Block;
}

void ATPSArenaBuilder::BuildArena()
{
	UWorld* World = GetWorld();
	if (bBuilt || !World)
	{
		return;
	}
	bBuilt = true;
	using namespace TPSArena;

	if (bBuildLighting)
	{
		EnsureWorldBasics(World);
	}

	if (bBuildFloor)
	{
		SpawnBlock(FVector(1900.f, 0.f, -10.f), FVector(6400.f, 5200.f, 20.f), 0.f, FloorColor);
		const FLinearColor Wall(0.42f, 0.42f, 0.4f);
		SpawnBlock(FVector(1900.f, 2620.f, 150.f), FVector(6400.f, 40.f, 300.f), 0.f, Wall);
		SpawnBlock(FVector(1900.f, -2620.f, 150.f), FVector(6400.f, 40.f, 300.f), 0.f, Wall);
		SpawnBlock(FVector(-1320.f, 0.f, 150.f), FVector(40.f, 5200.f, 300.f), 0.f, Wall);
		SpawnBlock(FVector(5120.f, 0.f, 150.f), FVector(40.f, 5200.f, 300.f), 0.f, Wall);
	}

	if (bBuildLadder)
	{
		// Web: LADDER.pos (-95, 0, 40), yaw 0; tower platform behind it at the ladder's top height.
		const FVector LadderPos = UTPSStatics::FromWeb(-95.f, 0.f, 40.f);
		FActorSpawnParameters Params;
		Params.Owner = this;
		if (ATPSLadder* Ladder = World->SpawnActor<ATPSLadder>(ATPSLadder::StaticClass(), GetActorTransform().TransformPosition(LadderPos), GetActorRotation(), Params))
		{
			const float H = Ladder->Height;
			// Kept narrow so it does not block the trainer lanes.
			SpawnBlock(LadderPos + FVector(8.f + 45.f, 0.f, H * 0.5f), FVector(90.f, 80.f, H), 0.f, FLinearColor(0.35f, 0.33f, 0.3f));
		}
	}

	if (bBuildCover)
	{
		for (const FCoverDef& Def : Covers)
		{
			const FVector Center = UTPSStatics::FromWeb(Def.X, Def.H * 0.5f, Def.Z);
			const float Yaw = -Def.Yaw;
			// Web local X (width) is UE local Y; web local Z (depth) is UE local X.
			if (ATPSArenaBlock* Block = SpawnBlock(Center, FVector(Def.D, Def.W, Def.H), Yaw, KindColors[Def.Kind]))
			{
				CoverActors.Add(Block);
			}

			// Cover spots 42 cm off each face; tall walls only near their ends so the AI can step out.
			const bool bTall = Def.H > 180.f;
			const FTransform Local(FRotator(0.f, GetActorRotation().Yaw + Yaw, 0.f), GetActorTransform().TransformPosition(FVector(Center.X, Center.Y, 0.f)));
			const FVector2D Half(Def.D * 0.5f, Def.W * 0.5f);
			const FVector Normals[] = { FVector(1, 0, 0), FVector(-1, 0, 0), FVector(0, 1, 0), FVector(0, -1, 0) };
			for (const FVector& N : Normals)
			{
				const bool bAlongX = FMath::Abs(N.X) > 0.5f;
				const float FaceHalf = bAlongX ? Half.Y : Half.X;
				const float Depth = bAlongX ? Half.X : Half.Y;
				const FVector Tangent = bAlongX ? FVector(0, 1, 0) : FVector(1, 0, 0);
				const float L = FaceHalf * 2.f;
				const int32 Count = FMath::Max(1, FMath::FloorToInt(L / 110.f));
				for (int32 K = 0; K < Count; ++K)
				{
					const bool bEnd = K == 0 || K == Count - 1;
					if (bTall && !bEnd)
					{
						continue;
					}
					const float Off = Count == 1 ? 0.f : -FaceHalf + 45.f + (L - 90.f) * K / float(Count - 1);
					const FVector LocalPos = N * (Depth + 42.f) + Tangent * Off + FVector(0.f, 0.f, 2.f);
					const FVector WorldPos = Local.TransformPosition(LocalPos);
					const FRotator Facing = Local.TransformVectorNoScale(-N).Rotation();
					FActorSpawnParameters Params;
					Params.Owner = this;
					if (ATPSCoverPoint* Point = World->SpawnActor<ATPSCoverPoint>(ATPSCoverPoint::StaticClass(), WorldPos, Facing, Params))
					{
						Point->bLowCover = !bTall;
						if (bTall)
						{
							// Step past the nearest edge (cover-point local space: +Y is the point's right).
							const float Side = (Off >= 0.f ? 1.f : -1.f);
							const FVector EdgeLocal = Tangent * Side * (FaceHalf - FMath::Abs(Off) + 55.f);
							Point->PeekOffset = Point->GetActorTransform().InverseTransformVectorNoScale(Local.TransformVectorNoScale(EdgeLocal));
						}
						CoverActors.Add(Point);
					}
				}
			}
		}
	}

	if (bBuildSpawnPoints)
	{
		for (const FVector2D& S : EnemySpawns)
		{
			const FVector Pos = GetActorTransform().TransformPosition(UTPSStatics::FromWeb(S.X, 2.f, S.Y));
			const FRotator Facing = (GetActorLocation() - Pos).GetSafeNormal2D().Rotation();
			FActorSpawnParameters Params;
			Params.Owner = this;
			World->SpawnActor<ATPSEnemySpawnPoint>(ATPSEnemySpawnPoint::StaticClass(), Pos, Facing, Params);
		}
	}

	if (bBuildTargets)
	{
		// Backstop berm behind the range.
		if (ATPSArenaBlock* Berm = SpawnBlock(FVector(2700.f, 0.f, 150.f), FVector(80.f, 1800.f, 300.f), 0.f, FLinearColor(0.35f, 0.27f, 0.18f)))
		{
			TargetActors.Add(Berm);
		}
		auto SpawnTarget = [this, World](const FVector& WebPos, ETPSTargetKind Kind, float Radius, float Hang, float Move) -> ATPSTrainingTarget*
		{
			const FVector Pos = GetActorTransform().TransformPosition(WebPos);
			const FTransform T(FRotator(0.f, GetActorRotation().Yaw, 0.f), Pos);
			ATPSTrainingTarget* Target = World->SpawnActorDeferred<ATPSTrainingTarget>(ATPSTrainingTarget::StaticClass(), T, this);
			if (Target)
			{
				Target->Kind = Kind;
				Target->PlateRadius = Radius;
				Target->HangHeight = Hang;
				Target->MoveAmplitude = Move;
				Target->FinishSpawning(T);
				TargetActors.Add(Target);
			}
			return Target;
		};
		for (const FPlateDef& P : Plates)
		{
			SpawnTarget(UTPSStatics::FromWeb(P.X, 0.f, P.Z), ETPSTargetKind::SteelPlate, P.R, P.Y, P.Move);
		}
		for (const FPopperDef& P : Poppers)
		{
			SpawnTarget(UTPSStatics::FromWeb(P.X, 0.f, P.Z), ETPSTargetKind::Popper, 22.f, 0.f, P.Move);
		}
	}
}

void ATPSArenaBuilder::ApplyMode(ETPSGameModeType Mode)
{
	BuildArena();
	const bool bAI = Mode == ETPSGameModeType::VersusAI;
	for (AActor* Actor : CoverActors)
	{
		if (ATPSArenaBlock* Block = Cast<ATPSArenaBlock>(Actor))
		{
			Block->SetActive(bAI);
		}
		else if (ATPSCoverPoint* Point = Cast<ATPSCoverPoint>(Actor))
		{
			Point->bEnabled = bAI;
		}
	}
	for (AActor* Actor : TargetActors)
	{
		if (!Actor)
		{
			continue;
		}
		if (ATPSArenaBlock* Block = Cast<ATPSArenaBlock>(Actor))
		{
			Block->SetActive(!bAI);
		}
		else
		{
			Actor->SetActorHiddenInGame(bAI);
			Actor->SetActorEnableCollision(!bAI);
			Actor->SetActorTickEnabled(!bAI);
			if (ATPSTrainingTarget* Target = Cast<ATPSTrainingTarget>(Actor))
			{
				Target->ResetTarget();
			}
		}
	}
}
