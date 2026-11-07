#include "FX/TPSFX.h"
#include "Components/StaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "NiagaraFunctionLibrary.h"
#include "NiagaraSystem.h"

ATPSTransientFX::ATPSTransientFX()
{
	PrimaryActorTick.bCanEverTick = true;

	MeshComp = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	SetRootComponent(MeshComp);
	MeshComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	MeshComp->SetCanEverAffectNavigation(false);
	MeshComp->SetCastShadow(false);

	Light = CreateDefaultSubobject<UPointLightComponent>(TEXT("Light"));
	Light->SetupAttachment(MeshComp);
	Light->SetCastShadows(false);
	Light->SetIntensityUnits(ELightUnits::Candelas);
	Light->SetLightColor(FLinearColor(1.f, 0.7f, 0.35f));
	Light->SetVisibility(false);
	Light->SetAbsolute(false, false, true);
}

void ATPSTransientFX::Init(ETPSShape Shape, const FLinearColor& Color, const FVector& InStartScale, const FVector& InEndScale, float InLifeTime,
	const FVector& InVelocity, bool bInGravity, float LightIntensity, float LightRadius)
{
	MeshComp->SetStaticMesh(UTPSStatics::GetShapeMesh(Shape));
	MeshComp->SetMaterial(0, UTPSStatics::MakeColorMaterial(this, Color));
	StartScale = InStartScale;
	EndScale = InEndScale;
	LifeTime = FMath::Max(0.01f, InLifeTime);
	Velocity = InVelocity;
	bGravity = bInGravity;
	StartLight = LightIntensity;
	SetActorScale3D(StartScale);
	if (LightIntensity > 0.f)
	{
		Light->SetIntensity(LightIntensity);
		Light->SetAttenuationRadius(LightRadius);
		Light->SetVisibility(true);
	}
	SetLifeSpan(LifeTime + 0.05f);
}

void ATPSTransientFX::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Age += DeltaSeconds;
	const float A = FMath::Clamp(Age / LifeTime, 0.f, 1.f);
	SetActorScale3D(FMath::Lerp(StartScale, EndScale, A));
	if (bGravity)
	{
		Velocity.Z -= 981.f * DeltaSeconds;
	}
	if (!Velocity.IsNearlyZero())
	{
		SetActorLocation(GetActorLocation() + Velocity * DeltaSeconds);
	}
	if (!SpinRate.IsNearlyZero())
	{
		AddActorWorldRotation(SpinRate * DeltaSeconds);
	}
	if (StartLight > 0.f)
	{
		Light->SetIntensity(StartLight * (1.f - A));
	}
	if (Age >= LifeTime)
	{
		Destroy();
	}
}

ATPSTransientFX* UTPSFX::SpawnShapeFX(const UObject* WorldContextObject, const FVector& Location, const FRotator& Rotation)
{
	UWorld* World = GEngine ? GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::ReturnNull) : nullptr;
	if (!World || World->GetNetMode() == NM_DedicatedServer)
	{
		return nullptr;
	}
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	return World->SpawnActor<ATPSTransientFX>(ATPSTransientFX::StaticClass(), Location, Rotation, Params);
}

void UTPSFX::Tracer(const UObject* WorldContextObject, FVector Start, FVector End, FLinearColor Color, float Thickness)
{
	const FVector Delta = End - Start;
	const float Len = Delta.Size();
	if (Len < 10.f)
	{
		return;
	}
	const FRotator Rot = FRotationMatrix::MakeFromZ(Delta / Len).Rotator();
	if (ATPSTransientFX* FX = SpawnShapeFX(WorldContextObject, (Start + End) * 0.5f, Rot))
	{
		const float W = 0.012f * Thickness;
		FX->Init(ETPSShape::Cylinder, Color, FVector(W, W, Len / 100.f), FVector(W * 0.2f, W * 0.2f, Len / 100.f), 0.06f);
	}
}

void UTPSFX::MuzzleFlash(const UObject* WorldContextObject, FVector Location, FVector Direction, float Size)
{
	if (ATPSTransientFX* FX = SpawnShapeFX(WorldContextObject, Location + Direction * 4.f * Size, FRotationMatrix::MakeFromZ(Direction).Rotator()))
	{
		FX->Init(ETPSShape::Cone, FLinearColor(1.f, 0.75f, 0.3f), FVector(0.08f, 0.08f, 0.16f) * Size, FVector(0.02f, 0.02f, 0.05f) * Size, 0.05f);
	}
}

void UTPSFX::Impact(const UObject* WorldContextObject, FVector Location, FVector Normal, bool bFlesh, UNiagaraSystem* Override)
{
	if (Override)
	{
		SpawnNiagara(WorldContextObject, Override, Location, Normal.Rotation());
		return;
	}
	const FLinearColor Puff = bFlesh ? FLinearColor(0.45f, 0.02f, 0.02f) : FLinearColor(0.55f, 0.52f, 0.45f);
	if (ATPSTransientFX* FX = SpawnShapeFX(WorldContextObject, Location + Normal * 2.f, FRotator::ZeroRotator))
	{
		FX->Init(ETPSShape::Sphere, Puff, FVector(0.05f), FVector(bFlesh ? 0.16f : 0.12f), bFlesh ? 0.22f : 0.3f, Normal * 40.f);
	}
	for (int32 i = 0; i < 3; ++i)
	{
		const FVector Vel = (Normal + FMath::VRand() * 0.6f).GetSafeNormal() * FMath::FRandRange(150.f, 320.f);
		if (ATPSTransientFX* Bit = SpawnShapeFX(WorldContextObject, Location + Normal * 2.f, FRotator::ZeroRotator))
		{
			Bit->Init(ETPSShape::Cube, bFlesh ? Puff : FLinearColor(1.f, 0.8f, 0.4f), FVector(0.012f), FVector(0.004f), 0.35f, Vel, true);
		}
	}
	if (!bFlesh)
	{
		// Bullet hole.
		if (ATPSTransientFX* Hole = SpawnShapeFX(WorldContextObject, Location + Normal * 0.3f, FRotationMatrix::MakeFromZ(Normal).Rotator()))
		{
			Hole->Init(ETPSShape::Cylinder, FLinearColor(0.02f, 0.02f, 0.02f), FVector(0.035f, 0.035f, 0.002f), FVector(0.035f, 0.035f, 0.002f), 8.f);
		}
	}
}

void UTPSFX::Explosion(const UObject* WorldContextObject, FVector Location, float Radius)
{
	const float R = FMath::Max(50.f, Radius);
	if (ATPSTransientFX* Fire = SpawnShapeFX(WorldContextObject, Location, FRotator::ZeroRotator))
	{
		Fire->Init(ETPSShape::Sphere, FLinearColor(1.f, 0.45f, 0.08f), FVector(0.4f), FVector(R / 100.f * 0.9f), 0.4f, FVector::ZeroVector, false, 40000.f, R * 3.f);
	}
	if (ATPSTransientFX* Smoke = SpawnShapeFX(WorldContextObject, Location, FRotator::ZeroRotator))
	{
		Smoke->Init(ETPSShape::Sphere, FLinearColor(0.12f, 0.11f, 0.1f), FVector(R / 100.f * 0.5f), FVector(R / 100.f * 1.1f), 1.3f, FVector(0.f, 0.f, 90.f));
	}
	for (int32 i = 0; i < 10; ++i)
	{
		const FVector Vel = (FMath::VRand() + FVector(0.f, 0.f, 0.8f)).GetSafeNormal() * FMath::FRandRange(400.f, 900.f);
		if (ATPSTransientFX* Bit = SpawnShapeFX(WorldContextObject, Location, FRotator::ZeroRotator))
		{
			Bit->Init(ETPSShape::Cube, FLinearColor(0.15f, 0.12f, 0.1f), FVector(0.05f), FVector(0.02f), 0.9f, Vel, true);
		}
	}
}

void UTPSFX::Shell(const UObject* WorldContextObject, FVector Location, FVector Velocity)
{
	if (ATPSTransientFX* Case = SpawnShapeFX(WorldContextObject, Location, FRotator(FMath::FRandRange(0.f, 90.f), FMath::FRandRange(0.f, 360.f), 0.f)))
	{
		Case->Init(ETPSShape::Cylinder, FLinearColor(0.85f, 0.62f, 0.2f), FVector(0.01f, 0.01f, 0.035f), FVector(0.01f, 0.01f, 0.035f), 1.2f,
			Velocity + FMath::VRand() * 30.f, true);
		Case->SpinRate = FRotator(FMath::FRandRange(400.f, 900.f), FMath::FRandRange(-300.f, 300.f), 0.f);
	}
}

void UTPSFX::SpawnNiagara(const UObject* WorldContextObject, UNiagaraSystem* System, FVector Location, FRotator Rotation)
{
	if (System && WorldContextObject)
	{
		UNiagaraFunctionLibrary::SpawnSystemAtLocation(WorldContextObject, System, Location, Rotation);
	}
}
