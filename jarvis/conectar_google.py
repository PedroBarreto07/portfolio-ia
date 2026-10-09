"""Faz o login no Google (Agenda + Gmail) uma única vez e salva o token.json."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import CFG  # noqa: E402

if not CFG.GOOGLE_CREDENCIAIS.exists():
    print("ERRO: coloque o arquivo credentials.json na pasta do Jarvis (veja o README, passo Google).")
    sys.exit(1)

if CFG.GOOGLE_TOKEN.exists():
    CFG.GOOGLE_TOKEN.unlink()   # força um login novo

from skills.google_svc import credenciais  # noqa: E402

print("Uma janela do navegador vai abrir. Entre na sua conta Google e autorize o Jarvis.")
print("Se aparecer 'O Google não verificou este app', clique em Avançado > Acessar (não seguro).")
credenciais(permitir_login=True)
print("\nGoogle conectado! Reinicie o Jarvis para ativar Agenda e Gmail.")
