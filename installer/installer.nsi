; Instalador do Caramelo Molhado Pet Shop Inc. (NSIS) - instalação por usuário, sem exigir administrador.
Unicode true
!define APP_NAME "Caramelo Molhado Pet Shop Inc."
!define SHORT_NAME "Caramelo Molhado Pet Shop"
!define APP_EXE "Caramelo Molhado Pet Shop Inc.exe"
!define APP_VERSION "2.0.0"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\CarameloMolhadoPetShop"

Name "${APP_NAME}"
OutFile "..\release\Caramelo-Molhado-Setup-${APP_VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\${SHORT_NAME}"
InstallDirRegKey HKCU "Software\CarameloMolhadoPetShop" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 32
BrandingText "${APP_NAME}"
VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey /LANG=1046 "ProductName" "${APP_NAME}"
VIAddVersionKey /LANG=1046 "FileDescription" "Instalador do ${APP_NAME}"
VIAddVersionKey /LANG=1046 "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1046 "CompanyName" "${APP_NAME}"

!include MUI2.nsh
!define MUI_ICON "..\build\icon-nsis.ico"
!define MUI_UNICON "..\build\icon-nsis.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir o ${SHORT_NAME} agora"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

Section "Instalar"
  SetOutPath "$INSTDIR"
  File /r "..\release\win-unpacked\*.*"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"

  CreateShortCut "$DESKTOP\${SHORT_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateDirectory "$SMPROGRAMS\${SHORT_NAME}"
  CreateShortCut "$SMPROGRAMS\${SHORT_NAME}\${SHORT_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut "$SMPROGRAMS\${SHORT_NAME}\Desinstalar.lnk" "$INSTDIR\Desinstalar.exe"

  WriteRegStr HKCU "Software\CarameloMolhadoPetShop" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${SHORT_NAME}.lnk"
  Delete "$SMPROGRAMS\${SHORT_NAME}\${SHORT_NAME}.lnk"
  Delete "$SMPROGRAMS\${SHORT_NAME}\Desinstalar.lnk"
  RMDir "$SMPROGRAMS\${SHORT_NAME}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\CarameloMolhadoPetShop"
  ; Os dados (clientes, pets, agenda) ficam em %APPDATA%\CarameloMolhadoPetShop e só são apagados se você escolher.
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Deseja também apagar os dados do sistema (clientes, pets, agenda e backups)?$\r$\n$\r$\nEscolha NÃO para manter tudo guardado caso reinstale o programa." /SD IDNO IDNO keepdata
    RMDir /r "$APPDATA\CarameloMolhadoPetShop"
  keepdata:
SectionEnd
