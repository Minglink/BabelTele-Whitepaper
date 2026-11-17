@echo off
chcp 65001 >nul
title BabelTele DSH Super Agent - 基于 DeepSeek Harness 深度魔改版
cd /d "%~dp0"
echo ========================================================================
echo   ⚡ 正在启动 BabelTele · DSH Super Agent (基于 DeepSeek Harness 构建)
echo   🌐 启动完成后将自动在默认浏览器打开带安全鉴权的官方 Web 界面
echo ========================================================================
if not exist "node_modules" (
  echo 首次运行，正在通过 pnpm 安装依赖...
  call pnpm install
)
node scripts/launch.mjs web
pause
