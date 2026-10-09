@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==== Instalando o J.A.R.V.I.S. ====
where py >nul 2>nul
if errorlevel 1 (
  echo Python nao encontrado. Instale o Python 3.12 em https://www.python.org/downloads/ marcando "Add python.exe to PATH".
  pause
  exit /b 1
)
if not exist .venv (
  echo Criando ambiente virtual...
  py -3.12 -m venv .venv 2>nul || py -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo Falha na instalacao. Veja a secao "Problemas comuns" do README.
  pause
  exit /b 1
)
echo Baixando modelos de fala (pode demorar na primeira vez)...
python -c "from faster_whisper import WhisperModel as W; W('base', device='cpu', compute_type='int8'); W('small', device='cpu', compute_type='int8')"
python -c "import openwakeword.utils as u; u.download_models(model_names=['hey_jarvis'])"
if not exist .env copy .env.example .env >nul
if not exist apps.json copy apps.json.example apps.json >nul
echo.
echo ==== Pronto! ====
echo 1. Abra o arquivo .env e cole sua ANTHROPIC_API_KEY.
echo 2. Rode diagnostico.bat para testar microfone e voz.
echo 3. Rode iniciar.bat.
pause
