@echo off
chcp 65001 >nul
title BabelTele Super Agent - 巴别语极速超级 Agent 图形控制台
cd /d "%~dp0"
echo ====================================================================
echo   ⚡ 正在启动 BabelTele Super Agent (巴别语极速超级 Agent 图形工作台)
echo   🌐 浏览器将自动打开: http://127.0.0.1:3720
echo   💡 提示: 关闭此黑色窗口即可停止后台服务
echo ====================================================================
python start.py --port 3720 --open
pause
