#include "Components/TPSCombatComponent.h"
#include "Components/TPSTraversalComponent.h"
#include "Characters/TPSCharacter.h"
#include "Weapons/TPSWeapon.h"
#include "Core/TPSSettings.h"
#include "Engine/World.h"
#include "Components/SceneComponent.h"

UTPSCombatComponent::UTPSCombatComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	DefaultPresets = {
		ETPSWeaponPreset::Pistol, ETPSWeaponPreset::M4, ETPSWeaponPreset::Shotgun, ETPSWeaponPreset::Kar98k,
		ETPSWeaponPreset::RPG7, ETPSWeaponPreset::AK74M, ETPSWeaponPreset::BenelliM4 };
}

void UTPSCombatComponent::BeginPlay()
{
	Super::BeginPlay();
	SpawnLoadout();
}

void UTPSCombatComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	for (ATPSWeapon* Weapon : Weapons)
	{
		if (IsValid(Weapon))
		{
			Weapon->Destroy();
		}
	}
	Weapons.Reset();
	Super::EndPlay(EndPlayReason);
}

ATPSCharacter* UTPSCombatComponent::GetOwnerCharacter() const
{
	return Cast<ATPSCharacter>(GetOwner());
}

bool UTPSCombatComponent::IsOwnerBusy() const
{
	const ATPSCharacter* OwnerChar = GetOwnerCharacter();
	return OwnerChar && (OwnerChar->IsDead() || (OwnerChar->Traversal && OwnerChar->Traversal->IsBusy()));
}

void UTPSCombatComponent::SpawnLoadout()
{
	ATPSCharacter* OwnerChar = GetOwnerCharacter();
	UWorld* World = GetWorld();
	if (!OwnerChar || !World)
	{
		return;
	}

	const FTransform SpawnTransform = OwnerChar->GetActorTransform();
	FActorSpawnParameters Params;
	Params.Owner = OwnerChar;
	Params.Instigator = OwnerChar;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	if (WeaponClasses.Num() > 0)
	{
		for (const TSubclassOf<ATPSWeapon>& WeaponClass : WeaponClasses)
		{
			if (WeaponClass)
			{
				if (ATPSWeapon* Weapon = World->SpawnActor<ATPSWeapon>(WeaponClass, SpawnTransform, Params))
				{
					Weapons.Add(Weapon);
				}
			}
		}
	}
	else
	{
		for (const ETPSWeaponPreset Preset : DefaultPresets)
		{
			ATPSWeapon* Weapon = World->SpawnActorDeferred<ATPSWeapon>(ATPSWeapon::StaticClass(), SpawnTransform, OwnerChar, OwnerChar,
				ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
			if (Weapon)
			{
				Weapon->Preset = Preset;
				Weapon->FinishSpawning(SpawnTransform);
				Weapons.Add(Weapon);
			}
		}
	}

	for (ATPSWeapon* Weapon : Weapons)
	{
		AttachWeapon(Weapon);
		Weapon->SetEquipped(false, 0.f);
	}
	if (Weapons.Num() > 0)
	{
		const int32 Slot = FMath::Clamp(StartingSlot, 0, Weapons.Num() - 1);
		CurrentSlot = Slot;
		Weapons[Slot]->SetEquipped(true, 0.f);
		OnWeaponChanged.Broadcast(Weapons[Slot], Slot);
	}
}

void UTPSCombatComponent::AttachWeapon(ATPSWeapon* Weapon) const
{
	const ATPSCharacter* OwnerChar = GetOwnerCharacter();
	if (!Weapon || !OwnerChar)
	{
		return;
	}
	FName Socket = NAME_None;
	USceneComponent* Parent = OwnerChar->GetWeaponAttachParent(Socket);
	if (!Parent)
	{
		return;
	}
	Weapon->AttachToComponent(Parent, FAttachmentTransformRules::SnapToTargetNotIncludingScale, Socket);
	if (Socket != NAME_None)
	{
		Weapon->SetActorRelativeTransform(Weapon->GripOffset);
	}
}

void UTPSCombatComponent::EquipSlot(int32 Slot)
{
	if (!Weapons.IsValidIndex(Slot) || Slot == CurrentSlot || IsOwnerBusy())
	{
		return;
	}
	if (ATPSWeapon* Old = GetCurrentWeapon())
	{
		Old->SetEquipped(false, 0.f);
	}
	CurrentSlot = Slot;
	ATPSWeapon* New = Weapons[Slot];
	AttachWeapon(New);
	New->SetEquipped(true, EquipTime);
	if (bTriggerDown)
	{
		New->PullTrigger();
	}
	AimStage = FMath::Min(AimStage, 1);

	if (ATPSCharacter* OwnerChar = GetOwnerCharacter())
	{
		if (New->Anims.Equip)
		{
			OwnerChar->PlayActionAnim(New->Anims.Equip, 1.f, 1, true);
		}
	}
	OnWeaponChanged.Broadcast(New, Slot);
}

void UTPSCombatComponent::CycleWeapon(int32 Direction)
{
	if (Weapons.Num() > 1)
	{
		const int32 Num = Weapons.Num();
		EquipSlot(((CurrentSlot + (Direction >= 0 ? 1 : -1)) % Num + Num) % Num);
	}
}

void UTPSCombatComponent::StartFire()
{
	if (IsOwnerBusy())
	{
		return;
	}
	bTriggerDown = true;
	FireAimTimer = FireAimHoldTime;
	if (ATPSWeapon* Weapon = GetCurrentWeapon())
	{
		Weapon->PullTrigger();
	}
}

void UTPSCombatComponent::StopFire()
{
	bTriggerDown = false;
	if (ATPSWeapon* Weapon = GetCurrentWeapon())
	{
		Weapon->ReleaseTrigger();
	}
}

void UTPSCombatComponent::Reload()
{
	if (IsOwnerBusy())
	{
		return;
	}
	if (ATPSWeapon* Weapon = GetCurrentWeapon())
	{
		Weapon->StartReload();
	}
}

void UTPSCombatComponent::AimPressed()
{
	const ATPSWeapon* Weapon = GetCurrentWeapon();
	const int32 MaxStage = Weapon ? FMath::Clamp(Weapon->Stats.AimStages, 1, 2) : 1;
	const ATPSCharacter* OwnerChar = GetOwnerCharacter();
	const UTPSSettingsSave* Settings = UTPSSettingsSubsystem::Get(this);
	const bool bHold = OwnerChar && OwnerChar->IsPlayerControlled() && Settings && Settings->bHoldToAim;

	if (bHold)
	{
		SetAimStage(AimStage == 0 ? 1 : MaxStage);
	}
	else
	{
		SetAimStage((AimStage + 1) % (MaxStage + 1));
	}
}

void UTPSCombatComponent::AimReleased()
{
	const ATPSCharacter* OwnerChar = GetOwnerCharacter();
	const UTPSSettingsSave* Settings = UTPSSettingsSubsystem::Get(this);
	if (OwnerChar && OwnerChar->IsPlayerControlled() && Settings && Settings->bHoldToAim)
	{
		SetAimStage(0);
	}
}

void UTPSCombatComponent::SetAimStage(int32 Stage)
{
	const ATPSWeapon* Weapon = GetCurrentWeapon();
	const int32 MaxStage = Weapon ? FMath::Clamp(Weapon->Stats.AimStages, 1, 2) : 1;
	AimStage = FMath::Clamp(Stage, 0, MaxStage);
}

void UTPSCombatComponent::RefillAllAmmo()
{
	for (ATPSWeapon* Weapon : Weapons)
	{
		if (Weapon)
		{
			Weapon->RefillAmmo();
		}
	}
}

void UTPSCombatComponent::OnOwnerDied()
{
	StopFire();
	AimStage = 0;
	FireAimTimer = 0.f;
	if (ATPSWeapon* Weapon = GetCurrentWeapon())
	{
		Weapon->SetEquipped(false, 0.f);
	}
}

ATPSWeapon* UTPSCombatComponent::GetCurrentWeapon() const
{
	return Weapons.IsValidIndex(CurrentSlot) ? Weapons[CurrentSlot].Get() : nullptr;
}

TArray<ATPSWeapon*> UTPSCombatComponent::GetWeapons() const
{
	TArray<ATPSWeapon*> Out;
	for (const TObjectPtr<ATPSWeapon>& Weapon : Weapons)
	{
		Out.Add(Weapon.Get());
	}
	return Out;
}

bool UTPSCombatComponent::IsAiming() const
{
	return (AimStage > 0 || FireAimTimer > 0.f) && !IsOwnerBusy();
}

bool UTPSCombatComponent::IsScoped() const
{
	return AimStage >= 2 && AimAlpha > 0.85f && !IsOwnerBusy();
}

void UTPSCombatComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (bTriggerDown)
	{
		FireAimTimer = FireAimHoldTime;
	}
	else
	{
		FireAimTimer = FMath::Max(0.f, FireAimTimer - DeltaTime);
	}
	if (IsOwnerBusy() && AimStage > 0)
	{
		AimStage = 0;
	}
	AimAlpha = FMath::FInterpTo(AimAlpha, IsAiming() ? 1.f : 0.f, DeltaTime, AimInterpSpeed);

	// Without a skeleton the weapon floats in front of the chest and follows the aim pitch.
	ATPSCharacter* OwnerChar = GetOwnerCharacter();
	if (OwnerChar && !OwnerChar->HasSkeletalVisual() && OwnerChar->WeaponHolder && !OwnerChar->IsDead())
	{
		const float Pitch = FRotator::NormalizeAxis(OwnerChar->GetBaseAimRotation().Pitch);
		OwnerChar->WeaponHolder->SetRelativeLocationAndRotation(FMath::Lerp(HipHoldOffset, AimHoldOffset, AimAlpha), FRotator(Pitch, 0.f, 0.f));
	}
}
