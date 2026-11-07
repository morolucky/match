#include "Core/TPSPlayerCameraManager.h"
#include "Core/TPSStatics.h"
#include "Core/TPSSettings.h"
#include "Characters/TPSPlayerCharacter.h"
#include "Components/TPSCombatComponent.h"

ATPSPlayerCameraManager::ATPSPlayerCameraManager()
{
	ViewPitchMin = -50.f;
	ViewPitchMax = 45.f;
}

void ATPSPlayerCameraManager::UpdateViewTarget(FTViewTarget& OutVT, float DeltaTime)
{
	Super::UpdateViewTarget(OutVT, DeltaTime);

	NoiseTime += DeltaTime;
	Trauma = FMath::Max(0.f, Trauma - TraumaDecay * DeltaTime);
	FOVKick = FMath::Max(0.f, FOVKick - FOVKickDecay * DeltaTime);

	const UTPSSettingsSave* Settings = UTPSSettingsSubsystem::Get(this);
	const bool bShakeEnabled = !Settings || Settings->bCameraShake;

	float Intensity = Trauma * Trauma;
	if (const ATPSPlayerCharacter* Player = Cast<ATPSPlayerCharacter>(OutVT.Target))
	{
		if (Player->Combat && Player->Combat->IsScoped())
		{
			Intensity *= ScopedShakeScale;
		}
	}

	if (bShakeEnabled && Intensity > KINDA_SMALL_NUMBER)
	{
		OutVT.POV.Rotation.Yaw += UTPSStatics::SmoothNoise(NoiseTime * ShakeFrequency) * MaxYawPitchShake * Intensity;
		OutVT.POV.Rotation.Pitch += UTPSStatics::SmoothNoise(NoiseTime * ShakeFrequency + 37.1f) * MaxYawPitchShake * Intensity;
		OutVT.POV.Rotation.Roll += UTPSStatics::SmoothNoise(NoiseTime * RollFrequency + 91.7f) * MaxRollShake * Intensity;
	}
	OutVT.POV.FOV = FMath::Clamp(OutVT.POV.FOV + FOVKick, 5.f, 170.f);
}
