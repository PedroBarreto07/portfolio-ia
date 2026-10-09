"""Registro de ferramentas (habilidades) que o Claude pode chamar.

Para criar uma habilidade nova, basta decorar uma função com @ferramenta
em qualquer módulo dentro de skills/ e importá-lo em skills/__init__.py.
"""
import inspect
import traceback

FERRAMENTAS = []   # esquemas enviados ao Claude
FUNCOES = {}       # nome -> função Python


def ferramenta(nome, descricao, parametros=None, obrigatorios=None):
    """Registra uma função como ferramenta do Jarvis.

    parametros: dict no formato JSON Schema, ex.:
        {"cidade": {"type": "string", "description": "Nome da cidade"}}
    """
    def decorador(func):
        FERRAMENTAS.append({
            "name": nome,
            "description": descricao,
            "input_schema": {
                "type": "object",
                "properties": parametros or {},
                "required": obrigatorios or [],
            },
        })
        FUNCOES[nome] = func
        return func
    return decorador


def executar(nome, argumentos):
    """Executa a ferramenta e devolve (texto_resultado, deu_erro)."""
    func = FUNCOES.get(nome)
    if func is None:
        return f"Ferramenta '{nome}' não existe.", True
    try:
        # ignora argumentos que a função não conhece (o modelo às vezes inventa)
        aceitos = inspect.signature(func).parameters
        args = {k: v for k, v in (argumentos or {}).items() if k in aceitos}
        resultado = func(**args)
        return (str(resultado) if resultado is not None else "OK"), False
    except Exception as erro:  # noqa: BLE001
        traceback.print_exc()
        return f"Erro ao executar {nome}: {erro}", True
