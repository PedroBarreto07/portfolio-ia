"""Terminal real do Claude Code (aba Terminal), num pseudo-terminal do Windows (ConPTY).

A saída é juntada em pacotes a cada ~30 ms antes de ir para a interface; mandar cada
pedacinho separado deixaria a tela lenta quando o Claude Code anima o indicador.
"""
import threading
import time

from config import CFG
from core.claude_code import ambiente, localizar

INTERVALO_ENVIO = 0.03


class TerminalClaude:
    def __init__(self, ao_receber, ao_sair):
        self._ao_receber = ao_receber     # recebe o texto da tela (com códigos de cor)
        self._ao_sair = ao_sair           # o processo terminou
        self._proc = None
        self._pendente = []
        self._trava = threading.Lock()

    @property
    def rodando(self):
        return self._proc is not None and self._proc.isalive()

    def iniciar(self, colunas, linhas):
        if self.rodando:
            self.redimensionar(colunas, linhas)
            return
        from winpty import PtyProcess
        exe = localizar()
        if not exe:
            raise RuntimeError("Claude Code não encontrado (veja CLAUDE_CODE_EXE no .env).")
        self._proc = PtyProcess.spawn([exe], cwd=CFG.CLAUDE_CODE_PASTA, env=ambiente(),
                                      dimensions=(max(5, int(linhas)), max(20, int(colunas))))
        proc = self._proc
        threading.Thread(target=self._ler, args=(proc,), name="terminal-ler", daemon=True).start()
        threading.Thread(target=self._despachar, args=(proc,), name="terminal-enviar", daemon=True).start()

    def _ler(self, proc):
        while True:
            try:
                dados = proc.read(65536)
            except EOFError:
                break
            except Exception:  # noqa: BLE001  processo encerrado à força
                break
            if dados:
                with self._trava:
                    self._pendente.append(dados)
        time.sleep(INTERVALO_ENVIO * 2)   # deixa o último pacote sair antes do aviso
        if proc is self._proc:
            self._ao_sair()

    def _despachar(self, proc):
        while proc.isalive() or self._pendente:
            time.sleep(INTERVALO_ENVIO)
            with self._trava:
                pacote, self._pendente = "".join(self._pendente), []
            if pacote:
                self._ao_receber(pacote)

    def escrever(self, dados):
        if self.rodando:
            self._proc.write(dados)

    def redimensionar(self, colunas, linhas):
        if self.rodando:
            self._proc.setwinsize(max(5, int(linhas)), max(20, int(colunas)))

    def encerrar(self):
        proc, self._proc = self._proc, None
        if proc is not None and proc.isalive():
            proc.terminate(force=True)
