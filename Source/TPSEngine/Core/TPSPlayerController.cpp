#include "Core/TPSPlayerController.h"
#include "Core/TPSGameMode.h"
#include "Core/TPSPlayerCameraManager.h"
#include "Core/TPSSettings.h"
#include "Core/TPSStatics.h"
#include "Characters/TPSPlayerCharacter.h"
#include "Components/TPSCombatComponent.h"
#include "Components/TPSTraversalComponent.h"
#include "Weapons/TPSWeapon.h"
#include "UI/TPSHUD.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputMappingContext.h"
#include "InputAction.h"
#include "InputModifiers.h"
#include "InputCoreTypes.h"
#include "Engine/LocalPlayer.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "HAL/PlatformTime.h"

namespace TPSInput
{
	static void Map(UInputMappingContext* Ctx, UObject* Outer, UInputAction* Action, const FKey& Key, bool bSwizzle = false, bool bNegate = false)
	{
		FEnhancedActionKeyMapping& Mapping = Ctx->MapKey(Action, Key);
		if (Key.IsGamepadKey() && Key.IsAxis1D())
		{
			Mapping.Modifiers.Add(NewObject<UInputModifierDeadZone>(Outer));
		}
		if (bSwizzle)
		{
			UInputModifierSwizzleAxis* Swizzle = NewObject<UInputModifierSwizzleAxis>(Outer);
			Swizzle->Order = EInputAxisSwizzle::YXZ;
			Mapping.Modifiers.Add(Swizzle);
		}
		if (bNegate)
		{
			Mapping.Modifiers.Add(NewObject<UInputModifierNegate>(Outer));
		}
	}
}

ATPSPlayerController::ATPSPlayerController()
{
	PlayerCameraManagerClass = ATPSPlayerCameraManager::StaticClass();
}

UInputAction* ATPSPlayerController::MakeAction(const TCHAR* Name, bool bAxis2D, bool bWhenPaused)
{
	UInputAction* Action = NewObject<UInputAction>(this, FName(Name));
	Action->ValueType = bAxis2D ? EInputActionValueType::Axis2D : EInputActionValueType::Boolean;
	Action->bTriggerWhenPaused = bWhenPaused;
	return Action;
}

void ATPSPlayerController::BuildInputAssets()
{
	if (MappingContext)
	{
		return;
	}
	using namespace TPSInput;

	MappingContext = NewObject<UInputMappingContext>(this, TEXT("IMC_TPS_Default"));
	MoveAction = MakeAction(TEXT("IA_Move"), true);
	LookAction = MakeAction(TEXT("IA_Look"), true);
	LookPadAction = MakeAction(TEXT("IA_LookGamepad"), true);
	FireAction = MakeAction(TEXT("IA_Fire"), false);
	AimAction = MakeAction(TEXT("IA_Aim"), false);
	ReloadAction = MakeAction(TEXT("IA_Reload"), false);
	RunAction = MakeAction(TEXT("IA_Run"), false);
	CrouchAction = MakeAction(TEXT("IA_Crouch"), false);
	LeanLeftAction = MakeAction(TEXT("IA_LeanLeft"), false);
	LeanRightAction = MakeAction(TEXT("IA_LeanRight"), false);
	SwapShoulderAction = MakeAction(TEXT("IA_SwapShoulder"), false);
	TraverseAction = MakeAction(TEXT("IA_Traverse"), false);
	InteractAction = MakeAction(TEXT("IA_Interact"), false);
	NextWeaponAction = MakeAction(TEXT("IA_NextWeapon"), false);
	PrevWeaponAction = MakeAction(TEXT("IA_PrevWeapon"), false);
	PauseAction = MakeAction(TEXT("IA_Pause"), false, true);
	AnimStudioAction = MakeAction(TEXT("IA_AnimStudio"), false);

	UInputMappingContext* C = MappingContext;
	// Move: X = right, Y = forward.
	Map(C, this, MoveAction, EKeys::W, true);
	Map(C, this, MoveAction, EKeys::S, true, true);
	Map(C, this, MoveAction, EKeys::A, false, true);
	Map(C, this, MoveAction, EKeys::D);
	Map(C, this, MoveAction, EKeys::Up, true);
	Map(C, this, MoveAction, EKeys::Down, true, true);
	Map(C, this, MoveAction, EKeys::Left, false, true);
	Map(C, this, MoveAction, EKeys::Right);
	// 1D stick axes also receive the mobile virtual joysticks (2D keys would double-count real pads).
	Map(C, this, MoveAction, EKeys::Gamepad_LeftX);
	Map(C, this, MoveAction, EKeys::Gamepad_LeftY, true);
	Map(C, this, LookAction, EKeys::Mouse2D);
	Map(C, this, LookPadAction, EKeys::Gamepad_RightX);
	Map(C, this, LookPadAction, EKeys::Gamepad_RightY, true);

	Map(C, this, FireAction, EKeys::LeftMouseButton);
	Map(C, this, FireAction, EKeys::Gamepad_RightTrigger);
	Map(C, this, AimAction, EKeys::RightMouseButton);
	Map(C, this, AimAction, EKeys::Gamepad_LeftTrigger);
	Map(C, this, ReloadAction, EKeys::R);
	Map(C, this, ReloadAction, EKeys::Gamepad_FaceButton_Left);
	Map(C, this, RunAction, EKeys::LeftShift);
	Map(C, this, RunAction, EKeys::Gamepad_LeftThumbstick);
	Map(C, this, CrouchAction, EKeys::C);
	Map(C, this, CrouchAction, EKeys::Gamepad_FaceButton_Right);
	Map(C, this, LeanLeftAction, EKeys::Q);
	Map(C, this, LeanLeftAction, EKeys::Gamepad_LeftShoulder);
	Map(C, this, LeanRightAction, EKeys::E);
	Map(C, this, LeanRightAction, EKeys::Gamepad_RightShoulder);
	Map(C, this, SwapShoulderAction, EKeys::X);
	Map(C, this, SwapShoulderAction, EKeys::Gamepad_RightThumbstick);
	Map(C, this, TraverseAction, EKeys::SpaceBar);
	Map(C, this, TraverseAction, EKeys::Gamepad_FaceButton_Bottom);
	Map(C, this, InteractAction, EKeys::F);
	Map(C, this, InteractAction, EKeys::Gamepad_DPad_Up);
	Map(C, this, NextWeaponAction, EKeys::MouseScrollDown);
	Map(C, this, NextWeaponAction, EKeys::Gamepad_FaceButton_Top);
	Map(C, this, PrevWeaponAction, EKeys::MouseScrollUp);
	Map(C, this, PauseAction, EKeys::Escape);
	Map(C, this, PauseAction, EKeys::P);
	Map(C, this, PauseAction, EKeys::Gamepad_Special_Right);
	Map(C, this, AnimStudioAction, EKeys::K);

	const FKey SlotKeys[] = { EKeys::One, EKeys::Two, EKeys::Three, EKeys::Four, EKeys::Five, EKeys::Six, EKeys::Seven };
	WeaponSlotActions.Reset();
	for (int32 i = 0; i < int32(UE_ARRAY_COUNT(SlotKeys)); ++i)
	{
		UInputAction* SlotAction = MakeAction(*FString::Printf(TEXT("IA_Weapon%d"), i + 1), false);
		Map(C, this, SlotAction, SlotKeys[i]);
		WeaponSlotActions.Add(SlotAction);
	}
}

void ATPSPlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();
	BuildInputAssets();

	UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(InputComponent);
	if (!EIC)
	{
		UE_LOG(LogTemp, Error, TEXT("TPS: Enhanced Input is not the default input component class. Check Config/DefaultInput.ini."));
		return;
	}

	EIC->BindAction(MoveAction, ETriggerEvent::Triggered, this, &ATPSPlayerController::OnMove);
	EIC->BindAction(MoveAction, ETriggerEvent::Completed, this, &ATPSPlayerController::OnMoveStop);
	EIC->BindAction(LookAction, ETriggerEvent::Triggered, this, &ATPSPlayerController::OnLook);
	EIC->BindAction(LookPadAction, ETriggerEvent::Triggered, this, &ATPSPlayerController::OnLookPad);
	EIC->BindAction(LookPadAction, ETriggerEvent::Completed, this, &ATPSPlayerController::OnLookPadStop);
	EIC->BindAction(FireAction, ETriggerEvent::Started, this, &ATPSPlayerController::OnFireStart);
	EIC->BindAction(FireAction, ETriggerEvent::Completed, this, &ATPSPlayerController::OnFireStop);
	EIC->BindAction(AimAction, ETriggerEvent::Started, this, &ATPSPlayerController::OnAimStart);
	EIC->BindAction(AimAction, ETriggerEvent::Completed, this, &ATPSPlayerController::OnAimStop);
	EIC->BindAction(ReloadAction, ETriggerEvent::Started, this, &ATPSPlayerController::OnReload);
	EIC->BindAction(RunAction, ETriggerEvent::Started, this, &ATPSPlayerController::OnRunStart);
	EIC->BindAction(RunAction, ETriggerEvent::Completed, this, &ATPSPlayerController::OnRunStop);
	EIC->BindAction(CrouchAction, ETriggerEvent::Started, this, &ATPSPlayerController::OnCrouch);
	EIC->BindAction(LeanLeftAction, ETriggerEvent::Started, this, &ATPSPlayerController::OnLeanLeftStart);
	EIC->BindAction(LeanLeftAction, ETriggerEvent::Completed, this, &ATPSPlayerController::OnLeanLeftStop);
	EIC->BindAction(LeanRightAction, ETriggerEvent::Started, this, &ATPSPlayerController::OnLeanRightStart);
	EIC->BindAction(LeanRightAction, ETriggerEvent::Completed, this, &ATPSPlayerController::OnLeanRightStop);
	EIC->BindAction(SwapShoulderAction, ETriggerEvent::Started, this, &ATPSPlayerController::OnSwapShoulder);
	EIC->BindAction(TraverseAction, ETriggerEvent::Started, this, &ATPSPlayerController::OnTraverseStart);
	EIC->BindAction(TraverseAction, ETriggerEvent::Completed, this, &ATPSPlayerController::OnTraverseStop);
	EIC->BindAction(InteractAction, ETriggerEvent::Started, this, &ATPSPlayerController::OnInteract);
	EIC->BindAction(NextWeaponAction, ETriggerEvent::Started, this, &ATPSPlayerController::OnNextWeapon);
	EIC->BindAction(PrevWeaponAction, ETriggerEvent::Started, this, &ATPSPlayerController::OnPrevWeapon);
	EIC->BindAction(PauseAction, ETriggerEvent::Started, this, &ATPSPlayerController::OnPause);
	EIC->BindAction(AnimStudioAction, ETriggerEvent::Started, this, &ATPSPlayerController::OnToggleAnimStudio);

	if (WeaponSlotActions.Num() >= 7)
	{
		EIC->BindAction(WeaponSlotActions[0], ETriggerEvent::Started, this, &ATPSPlayerController::OnWeapon1);
		EIC->BindAction(WeaponSlotActions[1], ETriggerEvent::Started, this, &ATPSPlayerController::OnWeapon2);
		EIC->BindAction(WeaponSlotActions[2], ETriggerEvent::Started, this, &ATPSPlayerController::OnWeapon3);
		EIC->BindAction(WeaponSlotActions[3], ETriggerEvent::Started, this, &ATPSPlayerController::OnWeapon4);
		EIC->BindAction(WeaponSlotActions[4], ETriggerEvent::Started, this, &ATPSPlayerController::OnWeapon5);
		EIC->BindAction(WeaponSlotActions[5], ETriggerEvent::Started, this, &ATPSPlayerController::OnWeapon6);
		EIC->BindAction(WeaponSlotActions[6], ETriggerEvent::Started, this, &ATPSPlayerController::OnWeapon7);
	}
}

void ATPSPlayerController::BeginPlay()
{
	Super::BeginPlay();
	BuildInputAssets();

	if (UEnhancedInputLocalPlayerSubsystem* Subsystem = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer()))
	{
		Subsystem->AddMappingContext(MappingContext, 0);
	}

	if (ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
	{
		GM->OnPhaseChanged.AddDynamic(this, &ATPSPlayerController::HandlePhaseChanged);
		ApplyInputModeForPhase(GM->GetPhase());
	}
}

ATPSPlayerCharacter* ATPSPlayerController::GetPlayerChar() const
{
	return Cast<ATPSPlayerCharacter>(GetPawn());
}

bool ATPSPlayerController::IsPlaying() const
{
	const ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this);
	const ATPSPlayerCharacter* P = GetPlayerChar();
	// Without the TPS game mode (e.g. a custom one) input always works.
	return P && !P->IsDead() && (!GM || GM->IsPlaying());
}

void ATPSPlayerController::HandlePhaseChanged(ETPSMatchPhase Phase)
{
	if (Phase != ETPSMatchPhase::Playing)
	{
		MoveInput = FVector2D::ZeroVector;
		PadLook = FVector2D::ZeroVector;
		bLeanLeft = bLeanRight = false;
		bSpaceFiring = false;
		if (ATPSPlayerCharacter* P = GetPlayerChar())
		{
			P->SetRunning(false);
			P->SetLeanInput(0.f);
			if (P->Combat)
			{
				P->Combat->StopFire();
			}
		}
		if (bHitStopActive)
		{
			bHitStopActive = false;
			UGameplayStatics::SetGlobalTimeDilation(this, 1.f);
		}
	}
	ApplyInputModeForPhase(Phase);
}

void ATPSPlayerController::ApplyInputModeForPhase(ETPSMatchPhase Phase)
{
	const ATPSHUD* TPSHud = Cast<ATPSHUD>(GetHUD());
	const bool bStudioOpen = TPSHud && TPSHud->IsAnimStudioOpen();
	if (Phase == ETPSMatchPhase::Playing && !bStudioOpen)
	{
		FInputModeGameOnly Mode;
		SetInputMode(Mode);
		SetShowMouseCursor(false);
	}
	else
	{
		FInputModeGameAndUI Mode;
		Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
		Mode.SetHideCursorDuringCapture(false);
		SetInputMode(Mode);
		SetShowMouseCursor(true);
	}
}

float ATPSPlayerController::GetLookScale() const
{
	const ATPSPlayerCharacter* P = GetPlayerChar();
	const UTPSSettingsSave* Settings = UTPSSettingsSubsystem::Get(this);
	float Scale = 1.f;
	if (P && P->Combat && P->Combat->IsAiming())
	{
		Scale *= Settings ? Settings->AimSensitivityScale : 0.75f;
		const ATPSWeapon* Weapon = P->GetCurrentWeapon();
		if (Weapon && P->Combat->IsScoped())
		{
			Scale *= Weapon->Stats.ScopeFOV / FMath::Max(1.f, P->GetHipFOV());
		}
	}
	return Scale;
}

void ATPSPlayerController::ApplyLook(float DeltaYaw, float DeltaPitch)
{
	FRotator R = GetControlRotation();
	R.Pitch = FMath::Clamp(FRotator::NormalizeAxis(R.Pitch) + DeltaPitch, ViewPitchMin, ViewPitchMax);
	R.Yaw = FRotator::NormalizeAxis(R.Yaw + DeltaYaw);
	R.Roll = 0.f;
	SetControlRotation(R);
}

void ATPSPlayerController::AddRecoil(float PitchKick, float YawKick)
{
	ApplyLook(YawKick, PitchKick);
	RecoilPending += PitchKick * RecoilRecoveryShare;
}

void ATPSPlayerController::TriggerHitStop(float RealSeconds, float TimeScale)
{
	const UTPSSettingsSave* Settings = UTPSSettingsSubsystem::Get(this);
	if ((Settings && !Settings->bHitStop) || RealSeconds <= 0.f)
	{
		return;
	}
	UGameplayStatics::SetGlobalTimeDilation(this, TimeScale);
	HitStopEndRealTime = FPlatformTime::Seconds() + RealSeconds;
	bHitStopActive = true;
}

FVector ATPSPlayerController::GetWorldMoveDirection() const
{
	const FRotator Yaw(0.f, GetControlRotation().Yaw, 0.f);
	const FVector Dir = FRotationMatrix(Yaw).GetUnitAxis(EAxis::X) * MoveInput.Y + FRotationMatrix(Yaw).GetUnitAxis(EAxis::Y) * MoveInput.X;
	return Dir.GetClampedToMaxSize(1.f);
}

void ATPSPlayerController::PlayerTick(float DeltaTime)
{
	Super::PlayerTick(DeltaTime);

	if (bHitStopActive && FPlatformTime::Seconds() >= HitStopEndRealTime)
	{
		bHitStopActive = false;
		UGameplayStatics::SetGlobalTimeDilation(this, 1.f);
	}

	ATPSPlayerCharacter* P = GetPlayerChar();
	if (!P || !IsPlaying())
	{
		return;
	}

	if (!PadLook.IsNearlyZero())
	{
		const UTPSSettingsSave* Settings = UTPSSettingsSubsystem::Get(this);
		const float Sens = (Settings ? Settings->GamepadSensitivity : 1.f) * GetLookScale() * GamepadLookRate * DeltaTime;
		const float Invert = (Settings && Settings->bInvertY) ? -1.f : 1.f;
		ApplyLook(PadLook.X * Sens, PadLook.Y * Sens * Invert);
	}

	if (RecoilPending > 0.f)
	{
		const float Recover = RecoilPending * FMath::Clamp(RecoilRecoveryRate * DeltaTime, 0.f, 1.f);
		RecoilPending -= Recover;
		ApplyLook(0.f, -Recover);
	}

	P->SetLeanInput((bLeanRight ? 1.f : 0.f) - (bLeanLeft ? 1.f : 0.f));

	if (P->Traversal && P->Traversal->IsOnLadder())
	{
		P->Traversal->SetLadderInput(MoveInput.Y);
	}
	else if (!MoveInput.IsNearlyZero())
	{
		const FRotator Yaw(0.f, GetControlRotation().Yaw, 0.f);
		P->AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::X), MoveInput.Y);
		P->AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::Y), MoveInput.X);
	}
}

// ---------------------------------------------------------------- Input handlers

void ATPSPlayerController::OnMove(const FInputActionValue& Value)
{
	const FVector2D Input = Value.Get<FVector2D>();
	MoveInput = Input.SizeSquared() > 1.0 ? Input.GetSafeNormal() : Input;
}

void ATPSPlayerController::OnMoveStop(const FInputActionValue& Value)
{
	MoveInput = FVector2D::ZeroVector;
}

void ATPSPlayerController::OnLook(const FInputActionValue& Value)
{
	if (!IsPlaying())
	{
		return;
	}
	const UTPSSettingsSave* Settings = UTPSSettingsSubsystem::Get(this);
	const FVector2D Delta = Value.Get<FVector2D>();
	const float Sens = BaseMouseDegreesPerCount * (Settings ? Settings->MouseSensitivity : 1.f) * GetLookScale();
	const float Invert = (Settings && Settings->bInvertY) ? -1.f : 1.f;
	ApplyLook(Delta.X * Sens, Delta.Y * Sens * Invert);
}

void ATPSPlayerController::OnLookPad(const FInputActionValue& Value)
{
	PadLook = Value.Get<FVector2D>();
}

void ATPSPlayerController::OnLookPadStop(const FInputActionValue& Value)
{
	PadLook = FVector2D::ZeroVector;
}

void ATPSPlayerController::OnFireStart()
{
	ATPSPlayerCharacter* P = GetPlayerChar();
	if (P && IsPlaying() && P->Combat)
	{
		P->Combat->StartFire();
	}
}

void ATPSPlayerController::OnFireStop()
{
	ATPSPlayerCharacter* P = GetPlayerChar();
	if (P && P->Combat && !bSpaceFiring)
	{
		P->Combat->StopFire();
	}
}

void ATPSPlayerController::OnAimStart()
{
	ATPSPlayerCharacter* P = GetPlayerChar();
	if (P && IsPlaying() && P->Combat)
	{
		P->Combat->AimPressed();
	}
}

void ATPSPlayerController::OnAimStop()
{
	ATPSPlayerCharacter* P = GetPlayerChar();
	if (P && P->Combat)
	{
		P->Combat->AimReleased();
	}
}

void ATPSPlayerController::OnReload()
{
	ATPSPlayerCharacter* P = GetPlayerChar();
	if (P && IsPlaying() && P->Combat)
	{
		P->Combat->Reload();
	}
}

void ATPSPlayerController::OnRunStart()
{
	if (ATPSPlayerCharacter* P = GetPlayerChar())
	{
		P->SetRunning(true);
		P->Traversal->SetLadderFast(true);
	}
}

void ATPSPlayerController::OnRunStop()
{
	if (ATPSPlayerCharacter* P = GetPlayerChar())
	{
		P->SetRunning(false);
		P->Traversal->SetLadderFast(false);
	}
}

void ATPSPlayerController::OnCrouch()
{
	ATPSPlayerCharacter* P = GetPlayerChar();
	if (!P || !IsPlaying())
	{
		return;
	}
	if (P->Traversal->IsOnLadder())
	{
		P->Traversal->DropFromLadder();
	}
	else
	{
		P->ToggleCrouch();
	}
}

void ATPSPlayerController::OnLeanLeftStart() { bLeanLeft = true; }
void ATPSPlayerController::OnLeanLeftStop() { bLeanLeft = false; }
void ATPSPlayerController::OnLeanRightStart() { bLeanRight = true; }
void ATPSPlayerController::OnLeanRightStop() { bLeanRight = false; }

void ATPSPlayerController::OnSwapShoulder()
{
	if (ATPSPlayerCharacter* P = GetPlayerChar())
	{
		P->SwapShoulder();
	}
}

void ATPSPlayerController::OnTraverseStart()
{
	ATPSPlayerCharacter* P = GetPlayerChar();
	if (!P || !IsPlaying())
	{
		return;
	}
	// Space fires while aiming; otherwise it mantles / dives / rolls.
	if (P->Combat && P->Combat->GetAimStage() > 0)
	{
		bSpaceFiring = true;
		P->Combat->StartFire();
		return;
	}
	P->Traversal->TryTraverse(GetWorldMoveDirection());
}

void ATPSPlayerController::OnTraverseStop()
{
	if (bSpaceFiring)
	{
		bSpaceFiring = false;
		if (ATPSPlayerCharacter* P = GetPlayerChar())
		{
			P->Combat->StopFire();
		}
	}
}

void ATPSPlayerController::OnInteract()
{
	ATPSPlayerCharacter* P = GetPlayerChar();
	if (P && IsPlaying())
	{
		P->Traversal->LadderInteract();
	}
}

void ATPSPlayerController::OnNextWeapon()
{
	ATPSPlayerCharacter* P = GetPlayerChar();
	if (P && IsPlaying())
	{
		P->Combat->CycleWeapon(1);
	}
}

void ATPSPlayerController::OnPrevWeapon()
{
	ATPSPlayerCharacter* P = GetPlayerChar();
	if (P && IsPlaying())
	{
		P->Combat->CycleWeapon(-1);
	}
}

void ATPSPlayerController::OnWeapon1() { OnWeaponSlot(0); }
void ATPSPlayerController::OnWeapon2() { OnWeaponSlot(1); }
void ATPSPlayerController::OnWeapon3() { OnWeaponSlot(2); }
void ATPSPlayerController::OnWeapon4() { OnWeaponSlot(3); }
void ATPSPlayerController::OnWeapon5() { OnWeaponSlot(4); }
void ATPSPlayerController::OnWeapon6() { OnWeaponSlot(5); }
void ATPSPlayerController::OnWeapon7() { OnWeaponSlot(6); }

void ATPSPlayerController::OnWeaponSlot(int32 Slot)
{
	ATPSPlayerCharacter* P = GetPlayerChar();
	if (P && IsPlaying())
	{
		P->Combat->EquipSlot(Slot);
	}
}

void ATPSPlayerController::OnPause()
{
	if (ATPSHUD* TPSHud = Cast<ATPSHUD>(GetHUD()))
	{
		if (TPSHud->IsAnimStudioOpen())
		{
			TPSHud->SetAnimStudioOpen(false);
			return;
		}
	}
	if (ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this))
	{
		GM->TogglePause();
	}
}

void ATPSPlayerController::OnToggleAnimStudio()
{
	ATPSHUD* TPSHud = Cast<ATPSHUD>(GetHUD());
	const ATPSGameMode* GM = UTPSStatics::GetTPSGameMode(this);
	if (TPSHud && (!GM || GM->GetPhase() != ETPSMatchPhase::Paused))
	{
		TPSHud->SetAnimStudioOpen(!TPSHud->IsAnimStudioOpen());
	}
}

void ATPSPlayerController::InjectAction(ETPSInputAction Action, bool bPressed)
{
	switch (Action)
	{
	case ETPSInputAction::Fire: bPressed ? OnFireStart() : OnFireStop(); break;
	case ETPSInputAction::Aim: bPressed ? OnAimStart() : OnAimStop(); break;
	case ETPSInputAction::Reload: if (bPressed) { OnReload(); } break;
	case ETPSInputAction::Traverse: bPressed ? OnTraverseStart() : OnTraverseStop(); break;
	case ETPSInputAction::Crouch: if (bPressed) { OnCrouch(); } break;
	case ETPSInputAction::Run: bPressed ? OnRunStart() : OnRunStop(); break;
	case ETPSInputAction::NextWeapon: if (bPressed) { OnNextWeapon(); } break;
	case ETPSInputAction::Ladder: if (bPressed) { OnInteract(); } break;
	case ETPSInputAction::SwapShoulder: if (bPressed) { OnSwapShoulder(); } break;
	case ETPSInputAction::Pause: if (bPressed) { OnPause(); } break;
	default: break;
	}
}
