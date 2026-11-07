#include "Core/TPSStatics.h"
#include "Core/TPSSettings.h"
#include "Core/TPSGameMode.h"
#include "Characters/TPSPlayerCharacter.h"
#include "Components/StaticMeshComponent.h"
#include "Components/CapsuleComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/CollisionProfile.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "GameFramework/Character.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Sound/SoundBase.h"

UStaticMesh* UTPSStatics::GetShapeMesh(ETPSShape Shape)
{
	const TCHAR* Path = TEXT("/Engine/BasicShapes/Cube.Cube");
	switch (Shape)
	{
	case ETPSShape::Sphere: Path = TEXT("/Engine/BasicShapes/Sphere.Sphere"); break;
	case ETPSShape::Cylinder: Path = TEXT("/Engine/BasicShapes/Cylinder.Cylinder"); break;
	case ETPSShape::Cone: Path = TEXT("/Engine/BasicShapes/Cone.Cone"); break;
	default: break;
	}
	return LoadObject<UStaticMesh>(nullptr, Path);
}

UMaterialInstanceDynamic* UTPSStatics::MakeColorMaterial(UObject* Outer, const FLinearColor& Color)
{
	UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	if (!Base)
	{
		return nullptr;
	}
	UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(Base, Outer);
	if (MID)
	{
		MID->SetVectorParameterValue(TEXT("Color"), Color);
	}
	return MID;
}

UStaticMeshComponent* UTPSStatics::AddShape(AActor* Owner, USceneComponent* Parent, ETPSShape Shape, const FVector& Location,
	const FVector& Scale, const FRotator& Rotation, const FLinearColor& Color, bool bCollision)
{
	if (!Owner)
	{
		return nullptr;
	}
	UStaticMeshComponent* Comp = NewObject<UStaticMeshComponent>(Owner);
	Comp->SetStaticMesh(GetShapeMesh(Shape));
	Comp->SetMaterial(0, MakeColorMaterial(Comp, Color));
	if (bCollision)
	{
		Comp->SetCollisionProfileName(UCollisionProfile::BlockAll_ProfileName);
	}
	else
	{
		Comp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Comp->SetCanEverAffectNavigation(false);
	}
	USceneComponent* AttachTo = Parent ? Parent : Owner->GetRootComponent();
	if (AttachTo)
	{
		Comp->SetupAttachment(AttachTo);
	}
	Comp->SetRelativeLocation(Location);
	Comp->SetRelativeRotation(Rotation);
	Comp->SetRelativeScale3D(Scale);
	Comp->RegisterComponent();
	Owner->AddInstanceComponent(Comp);
	if (!Owner->GetRootComponent())
	{
		Owner->SetRootComponent(Comp);
	}
	return Comp;
}

ETPSHitZone UTPSStatics::ResolveHitZone(const FHitResult& Hit, const ACharacter* Victim)
{
	if (Hit.BoneName != NAME_None)
	{
		const FString Bone = Hit.BoneName.ToString().ToLower();
		if (Bone.Contains(TEXT("head")) || Bone.Contains(TEXT("neck")))
		{
			return ETPSHitZone::Head;
		}
		if (Bone.Contains(TEXT("spine")) || Bone.Contains(TEXT("pelvis")) || Bone.Contains(TEXT("clavicle")) || Bone.Contains(TEXT("chest")))
		{
			return ETPSHitZone::Torso;
		}
		return ETPSHitZone::Limb;
	}
	if (Victim && Victim->GetCapsuleComponent())
	{
		const UCapsuleComponent* Capsule = Victim->GetCapsuleComponent();
		const float Half = Capsule->GetScaledCapsuleHalfHeight();
		const float Bottom = Capsule->GetComponentLocation().Z - Half;
		const float Frac = (Hit.ImpactPoint.Z - Bottom) / FMath::Max(1.f, Half * 2.f);
		if (Frac > 0.86f)
		{
			return ETPSHitZone::Head;
		}
		return Frac > 0.48f ? ETPSHitZone::Torso : ETPSHitZone::Limb;
	}
	return ETPSHitZone::Torso;
}

ATPSPlayerCharacter* UTPSStatics::GetTPSPlayer(const UObject* WorldContextObject)
{
	return Cast<ATPSPlayerCharacter>(UGameplayStatics::GetPlayerCharacter(WorldContextObject, 0));
}

ATPSGameMode* UTPSStatics::GetTPSGameMode(const UObject* WorldContextObject)
{
	return Cast<ATPSGameMode>(UGameplayStatics::GetGameMode(WorldContextObject));
}

static float TPSMasterVolume(const UObject* WorldContextObject)
{
	const UTPSSettingsSave* S = UTPSSettingsSubsystem::Get(WorldContextObject);
	return S ? S->MasterVolume : 1.f;
}

void UTPSStatics::PlaySoundAt(const UObject* WorldContextObject, USoundBase* Sound, FVector Location, float Volume, float Pitch)
{
	if (Sound)
	{
		const float V = Volume * TPSMasterVolume(WorldContextObject);
		if (V > KINDA_SMALL_NUMBER)
		{
			UGameplayStatics::PlaySoundAtLocation(WorldContextObject, Sound, Location, V, Pitch);
		}
	}
}

void UTPSStatics::PlaySound2D(const UObject* WorldContextObject, USoundBase* Sound, float Volume, float Pitch)
{
	if (Sound)
	{
		const float V = Volume * TPSMasterVolume(WorldContextObject);
		if (V > KINDA_SMALL_NUMBER)
		{
			UGameplayStatics::PlaySound2D(WorldContextObject, Sound, V, Pitch);
		}
	}
}

float UTPSStatics::SmoothNoise(float X)
{
	return FMath::Clamp(FMath::PerlinNoise1D(X) * 1.6f, -1.f, 1.f);
}

FString UTPSStatics::FormatTime(float Seconds)
{
	const int32 S = FMath::Max(0, FMath::FloorToInt(Seconds));
	return FString::Printf(TEXT("%d:%02d"), S / 60, S % 60);
}
