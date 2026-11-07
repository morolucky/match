#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "Core/TPSTypes.h"
#include "TPSGameMode.generated.h"

class ATPSCharacter;
class ATPSAIDirector;
class ATPSArenaBuilder;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FTPSOnScorePopup, FText, Text, FVector, WorldLocation, bool, bHeadshot);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FTPSOnHitMarker, bool, bHeadshot, bool, bKill);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FTPSOnToast, FText, Message);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FTPSOnPhaseChanged, ETPSMatchPhase, Phase);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FTPSOnKillFeed, FText, Text, bool, bHeadshot);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FTPSOnWaveEvent, int32, Wave);

/**
 * Match flow (menu -> play <-> pause -> game over), both game modes (Aim Trainer / VS AI), scoring, combos,
 * and the event hub the HUD listens to. Builds a playable arena automatically when the level is empty.
 */
UCLASS()
class TPSENGINE_API ATPSGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ATPSGameMode();

	virtual void InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage) override;
	virtual void StartPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	// ---- Flow ----
	UFUNCTION(BlueprintCallable, Category = "TPS|Match") void StartRound(ETPSGameModeType Mode);
	UFUNCTION(BlueprintCallable, Category = "TPS|Match") void RestartRound() { StartRound(ModeType); }
	UFUNCTION(BlueprintCallable, Category = "TPS|Match") void EndRound();
	UFUNCTION(BlueprintCallable, Category = "TPS|Match") void ReturnToMainMenu();
	UFUNCTION(BlueprintCallable, Category = "TPS|Match") void SetMatchPaused(bool bPaused);
	UFUNCTION(BlueprintCallable, Category = "TPS|Match") void TogglePause();
	UFUNCTION(BlueprintCallable, Category = "TPS|Match") void QuitToDesktop();

	UFUNCTION(BlueprintPure, Category = "TPS|Match") ETPSMatchPhase GetPhase() const { return Phase; }
	UFUNCTION(BlueprintPure, Category = "TPS|Match") ETPSGameModeType GetModeType() const { return ModeType; }
	UFUNCTION(BlueprintPure, Category = "TPS|Match") FTPSRoundStats GetStats() const { return Stats; }
	UFUNCTION(BlueprintPure, Category = "TPS|Match") float GetTimeLeft() const { return TimeLeft; }
	UFUNCTION(BlueprintPure, Category = "TPS|Match") float GetComboTimeLeft() const { return ComboTimer; }
	UFUNCTION(BlueprintPure, Category = "TPS|Match") ATPSAIDirector* GetDirector() const { return Director; }
	UFUNCTION(BlueprintPure, Category = "TPS|Match") bool IsPlaying() const { return Phase == ETPSMatchPhase::Playing; }

	// ---- Gameplay reports ----
	void NotifyShot(ATPSCharacter* Shooter, bool bHitSomething);
	void NotifyHitConfirmed(ATPSCharacter* Shooter, bool bHeadshot, bool bKill);
	void NotifyKill(ATPSCharacter* Shooter, ATPSCharacter* Victim, bool bHeadshot);
	void NotifyPlayerDamaged(float Damage);
	void NotifyPickup(ETPSPickupType Type);
	void NotifyWaveCleared(int32 Wave, bool bFlawless);
	void NotifyWaveStarted(int32 Wave);
	/** Adds points with a floating popup (used by trainer targets). */
	UFUNCTION(BlueprintCallable, Category = "TPS|Match") void AddScore(int32 Points, FVector WorldLocation, FText Label, bool bHeadshot);
	UFUNCTION(BlueprintCallable, Category = "TPS|Match") void ShowToast(FText Message) { OnToast.Broadcast(Message); }
	/** Gunshots / footsteps that AI can hear. */
	void ReportNoise(const FVector& Location, float Radius, AActor* NoiseInstigator);
	/** Bullet segment, used for AI suppression. */
	void ReportBulletPath(const FVector& Start, const FVector& End, AActor* ShotInstigator);

	UPROPERTY(BlueprintAssignable, Category = "TPS|Events") FTPSOnScorePopup OnScorePopup;
	UPROPERTY(BlueprintAssignable, Category = "TPS|Events") FTPSOnHitMarker OnHitMarker;
	UPROPERTY(BlueprintAssignable, Category = "TPS|Events") FTPSOnToast OnToast;
	UPROPERTY(BlueprintAssignable, Category = "TPS|Events") FTPSOnPhaseChanged OnPhaseChanged;
	UPROPERTY(BlueprintAssignable, Category = "TPS|Events") FTPSOnKillFeed OnKillFeed;
	UPROPERTY(BlueprintAssignable, Category = "TPS|Events") FTPSOnWaveEvent OnWaveStarted;
	UPROPERTY(BlueprintAssignable, Category = "TPS|Events") FTPSOnWaveEvent OnWaveCleared;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Match") float TrainerDuration = 60.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Match") float ComboWindow = 4.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Match") float MaxMultiplier = 5.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Match") int32 KillScore = 100;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Match") int32 HeadshotKillScore = 150;
	/** Spawns floor, cover, ladder, targets and lights when the level has no ATPSArenaBuilder. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Match") bool bAutoBuildArena = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Match") TSubclassOf<ATPSAIDirector> DirectorClass;

private:
	UFUNCTION() void HandlePlayerDied(ATPSCharacter* Character);
	UFUNCTION() void HandlePlayerDamaged(float Damage, FVector SourceLocation, ETPSHitZone Zone, AController* InstigatorController);
	void SetPhase(ETPSMatchPhase NewPhase);
	void ResetPlayer();

	ETPSMatchPhase Phase = ETPSMatchPhase::MainMenu;
	ETPSGameModeType ModeType = ETPSGameModeType::AimTrainer;
	FTPSRoundStats Stats;
	float TimeLeft = 0.f;
	float ComboTimer = 0.f;
	bool bWaveFlawless = true;
	FTimerHandle GameOverTimer;

	UPROPERTY() TObjectPtr<ATPSAIDirector> Director;
	UPROPERTY() TObjectPtr<ATPSArenaBuilder> Arena;
};
