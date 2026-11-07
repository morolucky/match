#include "Core/TPSSettings.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "Engine/Engine.h"

static const TCHAR* GTPSSettingsSlot = TEXT("TPSSettings");

void UTPSSettingsSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	if (UGameplayStatics::DoesSaveGameExist(GTPSSettingsSlot, 0))
	{
		Settings = Cast<UTPSSettingsSave>(UGameplayStatics::LoadGameFromSlot(GTPSSettingsSlot, 0));
	}
	if (!Settings)
	{
		Settings = Cast<UTPSSettingsSave>(UGameplayStatics::CreateSaveGameObject(UTPSSettingsSave::StaticClass()));
	}
}

void UTPSSettingsSubsystem::SaveSettings()
{
	if (Settings)
	{
		UGameplayStatics::SaveGameToSlot(Settings, GTPSSettingsSlot, 0);
		OnSettingsChanged.Broadcast();
	}
}

void UTPSSettingsSubsystem::ResetToDefaults()
{
	Settings = Cast<UTPSSettingsSave>(UGameplayStatics::CreateSaveGameObject(UTPSSettingsSave::StaticClass()));
	SaveSettings();
}

UTPSSettingsSave* UTPSSettingsSubsystem::Get(const UObject* WorldContextObject)
{
	const UWorld* World = GEngine ? GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::ReturnNull) : nullptr;
	const UGameInstance* GI = World ? World->GetGameInstance() : nullptr;
	const UTPSSettingsSubsystem* Sub = GI ? GI->GetSubsystem<UTPSSettingsSubsystem>() : nullptr;
	return Sub ? Sub->GetSettings() : nullptr;
}
