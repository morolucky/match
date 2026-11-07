#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "Core/TPSTypes.h"
#include "InputActionValue.h"
#include "TPSPlayerController.generated.h"

class UInputAction;
class UInputMappingContext;
class ATPSPlayerCharacter;
class ATPSHUD;

/** Actions that on-screen (touch) buttons can trigger. */
UENUM(BlueprintType)
enum class ETPSInputAction : uint8
{
	Fire,
	Aim,
	Reload,
	Traverse,
	Crouch,
	Run,
	NextWeapon,
	Ladder,
	SwapShoulder,
	Pause
};

/**
 * Player input (Enhanced Input built at runtime, no assets required), look/recoil, hit-stop, pause and UI input modes.
 *
 * Keyboard/mouse: WASD move, Shift run, C crouch, Q/E lean, X swap shoulder, Space fire-if-aiming / traverse,
 * F ladder, R reload, 1-7 weapons, mouse wheel cycle, LMB fire, RMB aim/scope, Esc or P pause, K animation studio.
 * Gamepad: sticks move/look, RT fire, LT aim, A traverse, B crouch, X reload, Y next weapon, L3 run,
 * R3 shoulder, LB/RB lean, D-pad up ladder, Start pause.
 */
UCLASS()
class TPSENGINE_API ATPSPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	ATPSPlayerController();

	virtual void BeginPlay() override;
	virtual void SetupInputComponent() override;
	virtual void PlayerTick(float DeltaTime) override;

	/** Camera kick from weapon recoil (degrees). Most of the pitch recovers automatically. */
	UFUNCTION(BlueprintCallable, Category = "TPS|Input") void AddRecoil(float PitchKick, float YawKick);
	/** Briefly slows the world (kill feedback). Runs on real time. */
	UFUNCTION(BlueprintCallable, Category = "TPS|Juice") void TriggerHitStop(float RealSeconds, float TimeScale = 0.08f);
	UFUNCTION(BlueprintCallable, Category = "TPS|UI") void ApplyInputModeForPhase(ETPSMatchPhase Phase);
	/** Press/release an action from UI (touch buttons, Blueprint). */
	UFUNCTION(BlueprintCallable, Category = "TPS|Input") void InjectAction(ETPSInputAction Action, bool bPressed);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Input") float ViewPitchMin = -50.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Input") float ViewPitchMax = 45.f;
	/** Degrees per mouse count at sensitivity 1 (web build: 0.0022 rad/px). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Input") float BaseMouseDegreesPerCount = 0.126f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Input") float GamepadLookRate = 180.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Input") float RecoilRecoveryRate = 7.f;
	/** Share of recoil pitch that recovers on its own. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TPS|Input") float RecoilRecoveryShare = 0.7f;

	/** Runtime-built mapping context (inspect it in the details panel while playing). */
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "TPS|Input") TObjectPtr<UInputMappingContext> MappingContext;

protected:
	UFUNCTION() void HandlePhaseChanged(ETPSMatchPhase Phase);

private:
	void BuildInputAssets();
	UInputAction* MakeAction(const TCHAR* Name, bool bAxis2D, bool bWhenPaused = false);
	ATPSPlayerCharacter* GetPlayerChar() const;
	bool IsPlaying() const;
	FVector GetWorldMoveDirection() const;
	void ApplyLook(float DeltaYaw, float DeltaPitch);
	float GetLookScale() const;

	void OnMove(const FInputActionValue& Value);
	void OnMoveStop(const FInputActionValue& Value);
	void OnLook(const FInputActionValue& Value);
	void OnLookPad(const FInputActionValue& Value);
	void OnLookPadStop(const FInputActionValue& Value);
	void OnFireStart();
	void OnFireStop();
	void OnAimStart();
	void OnAimStop();
	void OnReload();
	void OnRunStart();
	void OnRunStop();
	void OnCrouch();
	void OnLeanLeftStart();
	void OnLeanLeftStop();
	void OnLeanRightStart();
	void OnLeanRightStop();
	void OnSwapShoulder();
	void OnTraverseStart();
	void OnTraverseStop();
	void OnInteract();
	void OnNextWeapon();
	void OnPrevWeapon();
	void OnPause();
	void OnToggleAnimStudio();
	void OnWeaponSlot(int32 Slot);
	void OnWeapon1();
	void OnWeapon2();
	void OnWeapon3();
	void OnWeapon4();
	void OnWeapon5();
	void OnWeapon6();
	void OnWeapon7();

	UPROPERTY() TObjectPtr<UInputAction> MoveAction;
	UPROPERTY() TObjectPtr<UInputAction> LookAction;
	UPROPERTY() TObjectPtr<UInputAction> LookPadAction;
	UPROPERTY() TObjectPtr<UInputAction> FireAction;
	UPROPERTY() TObjectPtr<UInputAction> AimAction;
	UPROPERTY() TObjectPtr<UInputAction> ReloadAction;
	UPROPERTY() TObjectPtr<UInputAction> RunAction;
	UPROPERTY() TObjectPtr<UInputAction> CrouchAction;
	UPROPERTY() TObjectPtr<UInputAction> LeanLeftAction;
	UPROPERTY() TObjectPtr<UInputAction> LeanRightAction;
	UPROPERTY() TObjectPtr<UInputAction> SwapShoulderAction;
	UPROPERTY() TObjectPtr<UInputAction> TraverseAction;
	UPROPERTY() TObjectPtr<UInputAction> InteractAction;
	UPROPERTY() TObjectPtr<UInputAction> NextWeaponAction;
	UPROPERTY() TObjectPtr<UInputAction> PrevWeaponAction;
	UPROPERTY() TObjectPtr<UInputAction> PauseAction;
	UPROPERTY() TObjectPtr<UInputAction> AnimStudioAction;
	UPROPERTY() TArray<TObjectPtr<UInputAction>> WeaponSlotActions;

	FVector2D MoveInput = FVector2D::ZeroVector;
	FVector2D PadLook = FVector2D::ZeroVector;
	bool bLeanLeft = false;
	bool bLeanRight = false;
	bool bSpaceFiring = false;
	float RecoilPending = 0.f;
	double HitStopEndRealTime = 0.0;
	bool bHitStopActive = false;
};
