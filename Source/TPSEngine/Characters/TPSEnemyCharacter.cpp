#include "Characters/TPSEnemyCharacter.h"
#include "AI/TPSAIController.h"
#include "Components/TPSHealthComponent.h"
#include "Components/TPSCombatComponent.h"
#include "Weapons/TPSWeapon.h"

ATPSEnemyCharacter::ATPSEnemyCharacter(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	AIControllerClass = ATPSAIController::StaticClass();
	AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;
	PlaceholderColor = FLinearColor(0.7f, 0.22f, 0.18f);
	CorpseLifeSpan = 5.6f;
	Combat->DefaultPresets = { ETPSWeaponPreset::M4 };
	Health->MaxHealth = 100.f;
	Health->RegenRate = 0.f;
}

void ATPSEnemyCharacter::BeginPlay()
{
	Super::BeginPlay();
	for (ATPSWeapon* Weapon : Combat->GetWeapons())
	{
		if (Weapon)
		{
			Weapon->Stats.ReloadTime = AIReloadTime;
			Weapon->Stats.ReloadEmptyTime = AIReloadTime;
		}
	}
}

void ATPSEnemyCharacter::GetAimRay(FVector& OutStart, FVector& OutDir) const
{
	const ATPSWeapon* Weapon = GetCurrentWeapon();
	OutStart = Weapon ? Weapon->GetMuzzleLocation() : GetPawnViewLocation();
	OutDir = bHasAimTarget ? (AimTarget - OutStart).GetSafeNormal() : GetActorForwardVector();
}

float ATPSEnemyCharacter::ModifyIncomingDamage(float BaseDamage, ETPSHitZone Zone, const ATPSCharacter* Shooter) const
{
	switch (Zone)
	{
	case ETPSHitZone::Head: return BaseDamage * HeadMultiplier;
	case ETPSHitZone::Torso: return BaseDamage * TorsoMultiplier;
	default: return BaseDamage * LimbMultiplier;
	}
}

float ATPSEnemyCharacter::GetDesiredFacingYaw() const
{
	if (bHasAimTarget)
	{
		return (AimTarget - GetActorLocation()).Rotation().Yaw;
	}
	const FVector Vel = GetVelocity();
	return Vel.Size2D() > 10.f ? Vel.Rotation().Yaw : GetActorRotation().Yaw;
}
