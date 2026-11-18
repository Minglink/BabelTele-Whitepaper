@echo off
chcp 65001 >nul
title BabelTele · 巴别语超级 Agent (BT-Spec v1.0 底层重构版)
cd /d "%~dp0"

echo ======================================================================
echo   🗼 BabelTele · 巴别语超级 Agent (BT-Spec v1.0 双平面全栈重构内核)
echo ======================================================================

if not exist "node_modules\.pnpm" (
  echo [1/2] 首次运行：正在链接本地工作区依赖...
  call pnpm install --ignore-scripts=false
)

if not exist "apps\cli\lib\bin.js" (
  echo [2/2] 首次运行：正在编译 BabelTele 全栈源码与 Web 产物...
  call pnpm run build:babeltele
)

set "DSH_HOME=%~dp0.dsh-home"
echo [启动] 正在启动内置 Web 工作台 (默认端口 http://127.0.0.1:3720 )...
node apps\cli\lib\bin.js --profile web
pause
