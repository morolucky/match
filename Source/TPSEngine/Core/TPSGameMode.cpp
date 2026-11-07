#include "Core/TPSGameMode.h"
#include "TPSEngine.h"
#include "Core/TPSStatics.h"
#include "Core/TPSPlayerController.h"
#include "Core/TPSPlayerCameraManager.h"
#include "Characters/TPSPlayerCharacter.h"
#include "Characters/TPSEnemyCharacter.h"
#include "Components/TPSHealthComponent.h"
#include "Components/TPSCombatComponent.h"
#include "AI/TPSAIDirector.h"
#include "World/TPSArenaBuilder.h"
#include "UI/TPSHUD.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "TimerManager.h"
#include "Kismet/GameplayStatics.h"
#include "Kismet/KismetSystemLibrary.h"

ATPSGameMode::ATPSGameMode()
{
	PrimaryActorTick.bCanEverTick = true;
	DefaultPawnClass = ATPSPlayerCharacter::StaticClass();
	PlayerControllerClass = ATPSPlayerController::StaticClass();
	HUDClass = ATPSHUD::StaticClass();
	DirectorClass = ATPSAIDirector::StaticClass();
}

void ATPSGameMode::InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage)
{
	Super::InitGame(MapName, Options, ErrorMessage);

	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}
	for (TActorIterator<ATPSArenaBuilder> It(World); It; ++It)
	{
		Arena = *It;
		break;
	}

	// An "empty" level (no static meshes, no builder) gets the ported arena so Play works immediately.
	bool bLevelHasGeometry = false;
	for (TActorIterator<AStaticMeshActor> It(World); It; ++It)
	{
		bLevelHasGeometry = true;
		break;
	}
	if (!Arena && bAutoBuildArena && !bLevelHasGeometry)
	{
		Arena = World->SpawnActor<ATPSArenaBuilder>(ATPSArenaBuilder::StaticClass(), FTransform::Identity);
	}
	// The player spawns before BeginPlay, so lights and a PlayerStart must exist now.
	if (Arena)
	{
		ATPSArenaBuilder::EnsureWorldBasics(World);
	}
}

void ATPSGameMode::StartPlay()
{
	Super::StartPlay();

	if (UWorld* World = GetWorld())
	{
		FActorSpawnParameters Params;
		Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		Director = World->SpawnActor<ATPSAIDirector>(DirectorClass ? DirectorClass.Get() : ATPSAIDirector::StaticClass(), FTransform::Identity, Params);
	}
	if (Arena)
	{
		Arena->ApplyMode(ETPSGameModeType::AimTrainer);
	}
	SetPhase(ETPSMatchPhase::MainMenu);
}

void ATPSGameMode::SetPhase(ETPSMatchPhase NewPhase)
{
	Phase = NewPhase;
	OnPhaseChanged.Broadcast(Phase);
}

void ATPSGameMode::ResetPlayer()
{
	APlayerController* PC = GetWorld() ? GetWorld()->GetFirstPlayerController() : nullptr;
	if (!PC)
	{
		return;
	}
	ATPSPlayerCharacter* Player = Cast<ATPSPlayerCharacter>(PC->GetPawn());
	if (!Player || Player->IsDead())
	{
		// Dead bodies have altered collision/movement, so respawn a fresh pawn.
		if (APawn* Old = PC->GetPawn())
		{
			PC->UnPossess();
			Old->Destroy();
		}
		RestartPlayer(PC);
		Player = Cast<ATPSPlayerCharacter>(PC->GetPawn());
	}
	else
	{
		const AActor* Start = FindPlayerStart(PC);
		Player->ResetForRound(Start ? Start->GetActorTransform() : FTransform(FVector(0.f, 0.f, 100.f)));
	}
	if (Player)
	{
		Player->Health->bInvulnerable = ModeType == ETPSGameModeType::AimTrainer;
		Player->OnCharacterDied.AddUniqueDynamic(this, &ATPSGameMode::HandlePlayerDied);
		Player->Health->OnDamaged.AddUniqueDynamic(this, &ATPSGameMode::HandlePlayerDamaged);
	}
}

void ATPSGameMode::StartRound(ETPSGameModeType Mode)
{
	GetWorldTimerManager().ClearTimer(GameOverTimer);
	UGameplayStatics::SetGamePaused(this, false);
	UGameplayStatics::SetGlobalTimeDilation(this, 1.f);

	ModeType = Mode;
	Stats = FTPSRoundStats();
	TimeLeft = Mode == ETPSGameModeType::AimTrainer ? TrainerDuration : 0.f;
	ComboTimer = 0.f;
	bWaveFlawless = true;

	if (Director)
	{
		Director->StopAll();
	}
	if (Arena)
	{
		Arena->ApplyMode(Mode);
	}
	ResetPlayer();
	SetPhase(ETPSMatchPhase::Playing);

	if (Mode == ETPSGameModeType::VersusAI && Director)
	{
		Director->StartWaves();
	}
	ShowToast(FText::FromString(Mode == ETPSGameModeType::AimTrainer
		? TEXT("Aim Trainer: 60 seconds on steel plates and poppers")
		: TEXT("VS AI: survive the waves - use cover!")));
}

void ATPSGameMode::EndRound()
{
	if (Phase != ETPSMatchPhase::Playing && Phase != ETPSMatchPhase::Paused)
	{
		return;
	}
	UGameplayStatics::SetGamePaused(this, false);
	UGameplayStatics::SetGlobalTimeDilation(this, 1.f);
	if (Director)
	{
		Director->StopAll();
	}
	if (ATPSPlayerCharacter* Player = UTPSStatics::GetTPSPlayer(this))
	{
		if (Player->Combat)
		{
			Player->Combat->StopFire();
			Player->Combat->SetAimStage(0);
		}
	}
	SetPhase(ETPSMatchPhase::GameOver);
}

void ATPSGameMode::ReturnToMainMenu()
{
	GetWorldTimerManager().ClearTimer(GameOverTimer);
	UGameplayStatics::SetGamePaused(this, false);
	UGameplayStatics::SetGlobalTimeDilation(this, 1.f);
	if (Director)
	{
		Director->StopAll();
	}
	SetPhase(ETPSMatchPhase::MainMenu);
}

void ATPSGameMode::SetMatchPaused(bool bPaused)
{
	if (bPaused && Phase == ETPSMatchPhase::Playing)
	{
		UGameplayStatics::SetGamePaused(this, true);
		SetPhase(ETPSMatchPhase::Paused);
	}
	else if (!bPaused && Phase == ETPSMatchPhase::Paused)
	{
		UGameplayStatics::SetGamePaused(this, false);
		SetPhase(ETPSMatchPhase::Playing);
	}
}

void ATPSGameMode::TogglePause()
{
	SetMatchPaused(Phase == ETPSMatchPhase::Playing);
}

void ATPSGameMode::QuitToDesktop()
{
	UKismetSystemLibrary::QuitGame(this, GetWorld() ? GetWorld()->GetFirstPlayerController() : nullptr, EQuitPreference::Quit, false);
}

void ATPSGameMode::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (Phase != ETPSMatchPhase::Playing)
	{
		return;
	}

	Stats.Time += DeltaSeconds;
	if (ModeType == ETPSGameModeType::AimTrainer)
	{
		TimeLeft -= DeltaSeconds;
		if (TimeLeft <= 0.f)
		{
			TimeLeft = 0.f;
			EndRound();
			return;
		}
	}

	if (ComboTimer > 0.f)
	{
		ComboTimer -= DeltaSeconds;
		if (ComboTimer <= 0.f)
		{
			ComboTimer = 0.f;
			Stats.Multiplier = 1.f;
			Stats.Streak = 0;
		}
	}
}

// ---------------------------------------------------------------- Reports

void ATPSGameMode::NotifyShot(ATPSCharacter* Shooter, bool bHitSomething)
{
	if (Phase == ETPSMatchPhase::Playing && Cast<ATPSPlayerCharacter>(Shooter))
	{
		++Stats.Shots;
		if (bHitSomething)
		{
			++Stats.Hits;
		}
	}
}

void ATPSGameMode::NotifyHitConfirmed(ATPSCharacter* Shooter, bool bHeadshot, bool bKill)
{
	if (Cast<ATPSPlayerCharacter>(Shooter))
	{
		OnHitMarker.Broadcast(bHeadshot, bKill);
	}
}

void ATPSGameMode::NotifyKill(ATPSCharacter* Shooter, ATPSCharacter* Victim, bool bHeadshot)
{
	if (Phase != ETPSMatchPhase::Playing || !Cast<ATPSPlayerCharacter>(Shooter) || !Cast<ATPSEnemyCharacter>(Victim))
	{
		return;
	}

	++Stats.Kills;
	if (bHeadshot)
	{
		++Stats.Headshots;
	}
	Stats.Streak += 1;
	Stats.BestStreak = FMath::Max(Stats.BestStreak, Stats.Streak);

	// Kills inside the combo window raise the multiplier by 0.5 (max x5).
	Stats.Multiplier = ComboTimer > 0.f ? FMath::Min(MaxMultiplier, Stats.Multiplier + 0.5f) : 1.f;
	Stats.MaxMultiplier = FMath::Max(Stats.MaxMultiplier, Stats.Multiplier);
	ComboTimer = ComboWindow;

	const int32 Base = bHeadshot ? HeadshotKillScore : KillScore;
	const int32 Points = FMath::RoundToInt(Base * Stats.Multiplier);
	Stats.ComboBonus += Points - Base;
	Stats.Score += Points;

	const FString Label = Stats.Multiplier > 1.f
		? FString::Printf(TEXT("%s+%d  x%.1f"), bHeadshot ? TEXT("HEADSHOT ") : TEXT(""), Points, Stats.Multiplier)
		: FString::Printf(TEXT("%s+%d"), bHeadshot ? TEXT("HEADSHOT ") : TEXT(""), Points);
	OnScorePopup.Broadcast(FText::FromString(Label), Victim->GetActorLocation() + FVector(0.f, 0.f, 100.f), bHeadshot);
	OnKillFeed.Broadcast(FText::FromString(bHeadshot ? TEXT("You  >  Enemy  [HEADSHOT]") : TEXT("You  >  Enemy")), bHeadshot);

	// Kill juice: hit-stop, trauma and FOV kick.
	if (ATPSPlayerController* PC = Cast<ATPSPlayerController>(Shooter->GetController()))
	{
		PC->TriggerHitStop(bHeadshot ? 0.075f : 0.05f);
		if (ATPSPlayerCameraManager* Cam = Cast<ATPSPlayerCameraManager>(PC->PlayerCameraManager))
		{
			Cam->AddTrauma(bHeadshot ? 0.32f : 0.2f);
			Cam->AddFOVKick(bHeadshot ? 1.f : 0.6f);
		}
	}
}

void ATPSGameMode::NotifyPlayerDamaged(float Damage)
{
	if (Phase != ETPSMatchPhase::Playing)
	{
		return;
	}
	Stats.DamageTaken += Damage;
	bWaveFlawless = false;
	ComboTimer *= 0.5f;
}

void ATPSGameMode::HandlePlayerDamaged(float Damage, FVector SourceLocation, ETPSHitZone Zone, AController* InstigatorController)
{
	NotifyPlayerDamaged(Damage);
}

void ATPSGameMode::HandlePlayerDied(ATPSCharacter* Character)
{
	if (Phase == ETPSMatchPhase::Playing)
	{
		// Let the death read for a moment before the summary.
		GetWorldTimerManager().SetTimer(GameOverTimer, this, &ATPSGameMode::EndRound, 1.5f, false);
	}
}

void ATPSGameMode::NotifyPickup(ETPSPickupType Type)
{
	++Stats.Pickups;
	ShowToast(FText::FromString(Type == ETPSPickupType::Health ? TEXT("+35 HP") : TEXT("Ammo refilled")));
}

void ATPSGameMode::NotifyWaveStarted(int32 Wave)
{
	Stats.Wave = Wave;
	bWaveFlawless = true;
	OnWaveStarted.Broadcast(Wave);
}

void ATPSGameMode::NotifyWaveCleared(int32 Wave, bool bFlawless)
{
	if (Phase != ETPSMatchPhase::Playing)
	{
		return;
	}
	const int32 Bonus = 250 * Wave + (bWaveFlawless ? 500 : 0);
	Stats.WaveBonus += Bonus;
	Stats.Score += Bonus;
	OnWaveCleared.Broadcast(Wave);
	ShowToast(FText::FromString(FString::Printf(TEXT("Wave %d cleared  +%d%s"), Wave, Bonus, bWaveFlawless ? TEXT("  FLAWLESS") : TEXT(""))));
}

void ATPSGameMode::AddScore(int32 Points, FVector WorldLocation, FText Label, bool bHeadshot)
{
	if (Phase != ETPSMatchPhase::Playing)
	{
		return;
	}
	Stats.Score += Points;
	if (bHeadshot)
	{
		++Stats.Headshots;
	}
	OnScorePopup.Broadcast(Label, WorldLocation, bHeadshot);
}

void ATPSGameMode::ReportNoise(const FVector& Location, float Radius, AActor* NoiseInstigator)
{
	if (Director)
	{
		Director->ReportNoise(Location, Radius, NoiseInstigator);
	}
}

void ATPSGameMode::ReportBulletPath(const FVector& Start, const FVector& End, AActor* ShotInstigator)
{
	if (Director)
	{
		Director->ReportBulletPath(Start, End, ShotInstigator);
	}
}
