#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "Misc/PackageName.h"
#include "UObject/UObjectGlobals.h"
#include "Core/TPSTypes.h"
#include "TPSStatics.generated.h"

class AActor;
class USceneComponent;
struct FHitResult;
class UStaticMesh;
class UStaticMeshComponent;
class UMaterialInstanceDynamic;
class ACharacter;
class ATPSPlayerCharacter;
class ATPSGameMode;
class USoundBase;

UENUM(BlueprintType)
enum class ETPSShape : uint8
{
	Cube,
	Sphere,
	Cylinder,
	Cone
};

UCLASS()
class TPSENGINE_API UTPSStatics : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/** Loads an asset only when its package exists, so optional content never spams load errors. */
	template <typename T>
	static T* TryLoad(const FString& ObjectPath)
	{
		const FString PackageName = FPackageName::ObjectPathToPackageName(ObjectPath);
		if (PackageName.IsEmpty() || !FPackageName::DoesPackageExist(PackageName))
		{
			return nullptr;
		}
		return LoadObject<T>(nullptr, *ObjectPath, nullptr, LOAD_NoWarn | LOAD_Quiet);
	}

	static UStaticMesh* GetShapeMesh(ETPSShape Shape);

	/** Dynamic instance of the engine BasicShapeMaterial tinted with Color. */
	static UMaterialInstanceDynamic* MakeColorMaterial(UObject* Outer, const FLinearColor& Color);

	/** Creates, attaches and registers a basic-shape primitive at runtime. */
	static UStaticMeshComponent* AddShape(AActor* Owner, USceneComponent* Parent, ETPSShape Shape, const FVector& Location,
		const FVector& Scale, const FRotator& Rotation, const FLinearColor& Color, bool bCollision);

	/** Head / torso / limb from bone name, falling back to hit height on the capsule. */
	static ETPSHitZone ResolveHitZone(const FHitResult& Hit, const ACharacter* Victim);

	UFUNCTION(BlueprintPure, Category = "TPS", meta = (WorldContext = "WorldContextObject"))
	static ATPSPlayerCharacter* GetTPSPlayer(const UObject* WorldContextObject);

	UFUNCTION(BlueprintPure, Category = "TPS", meta = (WorldContext = "WorldContextObject"))
	static ATPSGameMode* GetTPSGameMode(const UObject* WorldContextObject);

	/** Plays a 3D sound scaled by the user's master volume. */
	UFUNCTION(BlueprintCallable, Category = "TPS|Audio", meta = (WorldContext = "WorldContextObject"))
	static void PlaySoundAt(const UObject* WorldContextObject, USoundBase* Sound, FVector Location, float Volume = 1.f, float Pitch = 1.f);

	UFUNCTION(BlueprintCallable, Category = "TPS|Audio", meta = (WorldContext = "WorldContextObject"))
	static void PlaySound2D(const UObject* WorldContextObject, USoundBase* Sound, float Volume = 1.f, float Pitch = 1.f);

	/** Smooth 1D noise in [-1, 1]. */
	static float SmoothNoise(float X);

	/** Ported web coordinates (x right-negative, y up, z forward) to Unreal (X forward, Y right, Z up). */
	static FVector FromWeb(float X, float Y, float Z) { return FVector(Z, -X, Y); }

	static FString FormatTime(float Seconds);
};
