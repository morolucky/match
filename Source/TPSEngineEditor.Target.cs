using UnrealBuildTool;
using System.Collections.Generic;

public class TPSEngineEditorTarget : TargetRules
{
	public TPSEngineEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("TPSEngine");
	}
}
