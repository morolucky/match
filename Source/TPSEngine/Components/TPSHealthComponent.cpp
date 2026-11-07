#include "Components/TPSHealthComponent.h"
#include "Engine/World.h"

UTPSHealthComponent::UTPSHealthComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.05f;
}

void UTPSHealthComponent::BeginPlay()
{
	Super::BeginPlay();
	Health = MaxHealth;
}

void UTPSHealthComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (!bDead && RegenRate > 0.f && Health < MaxHealth && GetTimeSinceDamage() >= RegenDelay)
	{
		Heal(RegenRate * DeltaTime);
	}
}

float UTPSHealthComponent::GetTimeSinceDamage() const
{
	const UWorld* World = GetWorld();
	return World ? World->GetTimeSeconds() - LastDamageTime : 0.f;
}

float UTPSHealthComponent::ApplyDamage(float Amount, FVector SourceLocation, ETPSHitZone Zone, AController* InstigatorController)
{
	if (bDead || bInvulnerable || Amount <= 0.f)
	{
		return 0.f;
	}
	const float Applied = FMath::Min(Amount, Health);
	Health -= Applied;
	LastDamageTime = GetWorld() ? GetWorld()->GetTimeSeconds() : 0.f;

	OnDamaged.Broadcast(Applied, SourceLocation, Zone, InstigatorController);
	OnHealthChanged.Broadcast(Health, -Applied);

	if (Health <= 0.f)
	{
		Health = 0.f;
		bDead = true;
		OnDeath.Broadcast(GetOwner(), InstigatorController, Zone == ETPSHitZone::Head);
	}
	return Applied;
}

float UTPSHealthComponent::Heal(float Amount)
{
	if (bDead || Amount <= 0.f)
	{
		return 0.f;
	}
	const float Old = Health;
	Health = FMath::Min(MaxHealth, Health + Amount);
	if (Health != Old)
	{
		OnHealthChanged.Broadcast(Health, Health - Old);
	}
	return Health - Old;
}

void UTPSHealthComponent::ResetHealth()
{
	bDead = false;
	const float Old = Health;
	Health = MaxHealth;
	LastDamageTime = -1000.f;
	OnHealthChanged.Broadcast(Health, Health - Old);
}
