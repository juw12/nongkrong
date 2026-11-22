; Nongkrong for Windows - per-user installer (no admin rights). build.py compiles it with:
;   iscc /DAppVersion=1.0.0 /DSourceDir=<dist\Nongkrong> /DOutputDir=<dist> /DIconFile=<build\nongkrong.ico> nongkrong.iss
; Installs to %LOCALAPPDATA%\Programs\Nongkrong, adds Nongkrong to the Start menu (and optionally the desktop) and lists it
; in Settings > Apps. The window keeps its data (what you saved in it) in %LOCALAPPDATA%\Nongkrong, which
; uninstalling leaves in place so a reinstall finds it again.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "dist\Nongkrong"
#endif
#ifndef OutputDir
  #define OutputDir "dist"
#endif
#ifndef IconFile
  #define IconFile "build\nongkrong.ico"
#endif

[Setup]
AppId={{E81247BA-698B-569E-A6DE-E1E1C366EEFB}
AppName=Nongkrong
AppVersion={#AppVersion}
AppVerName=Nongkrong {#AppVersion}
AppPublisher=Juwen Lie
AppPublisherURL=https://juw12.github.io/nongkrong/
AppSupportURL=https://github.com/juw12/nongkrong
DefaultDirName={autopf}\Nongkrong
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=Nongkrong-Windows-Setup
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\Nongkrong.exe
UninstallDisplayName=Nongkrong
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=no
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\Nongkrong"; Filename: "{app}\Nongkrong.exe"; Comment: "Sit at a table in a virtual warung, kopitiam"
Name: "{userdesktop}\Nongkrong"; Filename: "{app}\Nongkrong.exe"; Comment: "Sit at a table in a virtual warung, kopitiam"; Tasks: desktopicon

[Run]
Filename: "{app}\Nongkrong.exe"; Description: "{cm:LaunchProgram,Nongkrong}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\Nongkrong.exe"; Parameters: "--stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopNongkrong"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  { Updating: close an open Nongkrong window first so its files can be replaced. }
  if FileExists(ExpandConstant('{app}\Nongkrong.exe')) then
    Exec(ExpandConstant('{app}\Nongkrong.exe'), '--stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;
