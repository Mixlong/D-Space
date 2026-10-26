; 自定义安装器脚本

; 安装前检查和准备
!macro customInit
  ; Windows 7 兼容性提示（简化版本）
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentVersion"
  ${If} $0 == "6.1"
    MessageBox MB_YESNO "检测到Windows 7系统。$\n$\n为确保程序正常运行，需要：$\n1. 已安装Windows 7 SP1$\n2. 已安装Visual C++ 2015-2022运行库$\n$\n是否继续安装？" IDYES continue
    Abort
    continue:
  ${EndIf}
!macroend

; electron-builder 自带 CHECK_APP_RUNNING 在复制文件前处理旧进程。
; customInstall 在文件复制后执行，不可再次杀进程以免干扰重启。
!macro customInstall
  ; 强制重建快捷方式，避免覆盖安装后沿用旧图标缓存
  DetailPrint "正在重建桌面和开始菜单快捷方式..."
  Delete "$DESKTOP\\D-Space.lnk"
  Delete "$DESKTOP\\DigiSmart.lnk"
  Delete "$SMPROGRAMS\\D-Space.lnk"
  Delete "$SMPROGRAMS\\DigiSmart.lnk"
  Delete "$SMPROGRAMS\\D-Space\\D-Space.lnk"
  Delete "$SMPROGRAMS\\D-Space\\DigiSmart.lnk"
  RMDir "$SMPROGRAMS\\D-Space"

  ${If} ${FileExists} "$INSTDIR\\D-Space.exe"
    CreateShortCut "$DESKTOP\\D-Space.lnk" "$INSTDIR\\D-Space.exe"
    CreateShortCut "$SMPROGRAMS\\D-Space.lnk" "$INSTDIR\\D-Space.exe"
  ${ElseIf} ${FileExists} "$INSTDIR\\DigiSmart.exe"
    CreateShortCut "$DESKTOP\\DigiSmart.lnk" "$INSTDIR\\DigiSmart.exe"
    CreateShortCut "$SMPROGRAMS\\DigiSmart.lnk" "$INSTDIR\\DigiSmart.exe"
  ${EndIf}

!macroend

; 卸载前
!macro customUnInstall
  ; 关闭正在运行的程序（同时兼容新旧 exe 名）
  ${nsProcess::FindProcess} "D-Space.exe" $R0
  ${If} $R0 == 0
    ${nsProcess::KillProcess} "D-Space.exe" $R0
    Sleep 1000
  ${EndIf}

  ${nsProcess::FindProcess} "DigiSmart.exe" $R0
  ${If} $R0 == 0
    ${nsProcess::KillProcess} "DigiSmart.exe" $R0
    Sleep 1000
  ${EndIf}
  ${nsProcess::Unload}
!macroend
