"""
iiam_variedades.py — Extrai as fichas de variedades do "Catálogo de Tecnologias
Libertadas pelo IIAM 2011-2022" para pmo-bot-go/internal/zae/dados/variedades_iiam.csv.

Pré-requisito: python scripts/ingestion/fontes_mz.py (baixa e confere o PDF).

O catálogo é diagramado em duas colunas e a ordem rótulo/valor varia entre as
culturas ("RENDIMENTO 2 a 5 T/Ha" vs "2.5 T/Ha ... RENDIMENTO"). Por isso:
  * os campos estruturados (tipo, maturação, rendimento, ano) são extraídos
    só quando o padrão é inequívoco — senão ficam vazios, nunca chutados;
  * a coluna `ficha` guarda o TEXTO ORIGINAL da ficha, e é dela que o bot
    responde; os campos estruturados servem para filtrar e ordenar.
Problemas da própria fonte vão em NOTAS (nota_curadoria), não são "corrigidos".

Uso:
  python scripts/ingestion/iiam_variedades.py
"""

import csv
import os
import re

import pymupdf

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
PDF = os.path.join(RAIZ, "pmo-bot-go", "docs", "knowledge_base_mz", "IIAM_Catalogo_Tecnologias_Libertadas_2011-2022.pdf")
SAIDA = os.path.join(RAIZ, "pmo-bot-go", "internal", "zae", "dados", "variedades_iiam.csv")
FONTE = "IIAM — Catálogo de Tecnologias Libertadas pelo IIAM 2011-2022"
URL = "https://iiam.gov.mz/wp-content/uploads/2025/07/Catalogo-de-Tecnologias-Libertadas-do-IIAM-2011-22-1.pdf"

# Cabeçalho de seção no catálogo -> nome canônico usado em internal/zae.
CULTURAS = {
    "arroz": "arroz", "milho": "milho", "mapira": "mapira", "cevada": "cevada",
    "mandioca": "mandioca", "batata doce": "batata-doce", "feijão vulgar": "feijão",
    "soja": "soja", "amendoim": "amendoim", "gergelim": "gergelim", "algodão": "algodão",
    "tomate": "tomate", "alho": "alho", "cebola": "cebola", "repolho": "repolho",
    "amaranthus": "amaranto", "manga": "manga",
}

# Problemas DA FONTE, verificados no PDF — registrados, não corrigidos.
NOTAS = {
    ("gergelim", "RAMA-JACOMA"): 'Maturação impressa como "10 a 110 dias" na fonte (provável erro de digitação).',
    ("milho", "WE3128"): "O catálogo traz duas fichas desta variedade (pág. 21 e 22) com dados diferentes.",
    ("milho", "WE 3128"): "O catálogo traz duas fichas desta variedade (pág. 21 e 22) com dados diferentes.",
}

# A fonte grafa "VARIEDADE", "Variedade", "VARIEDADES" e até "VATRIEDADE".
RE_VARIEDADE = re.compile(r"TECNOLOGIA\s+(?:VAT?RIEDADES?)\s+(.+?)(?:\s+CARACTER\S*|$)", re.I)
# Fim de ficha: começo da próxima, ou de outra seção do catálogo.
RE_FIM_FICHA = re.compile(r"\s(?:NOME DA TECNOLOGIA|TIPO DE TECNOLOGIA|FRUTEIRAS NATIVAS|Principais Resultados|Bibliografia)\b|\s\*\s")
RE_RUIDO = re.compile(r"INSTITUTO DE INVESTIGAÇÃO AGRÁRIA DE MOÇAMBIQUE\s*\d*|\b\d+\s+INSTITUTO DE INVESTIGAÇÃO AGRÁRIA DE MOÇAMBIQUE|2011 - 2022|CATÁLOGO DE TECNOLOGIAS LIBERTA\w* PELO IIAM|\* OPV - Variedade de Polinização Aberta")


def campo(padrao, texto):
    m = re.search(padrao, texto, re.I)
    return m.group(1).strip() if m else ""


def main():
    doc = pymupdf.open(PDF)
    # Fluxo único com marcas de página e de cultura: uma ficha pode começar no
    # meio de um bloco do PDF e terminar em outro, e um bloco pode ter duas.
    partes = []
    for num in range(13, len(doc)):  # fichas começam na pág. 15
        blocos = doc[num].get_text("blocks", sort=True)
        if "CIÊNCIAS ANIMAIS" in " ".join(b[4] for b in blocos).upper() and num > 20:
            break
        partes.append(f" @@PAG {num + 1}@@ ")
        for b in blocos:
            l = re.sub(r"\s+", " ", b[4]).strip()
            baixa = l.lower()
            for chave in sorted(CULTURAS, key=len, reverse=True):
                # Cabeçalho de seção: o bloco é só o nome da cultura, ou começa
                # com ele em minúsculas ("mapira NOME DA...", "tomate Peso:").
                if baixa == chave or l.startswith(chave + " "):
                    partes.append(f" @@CULT {CULTURAS[chave]}@@ ")
                    break
            partes.append(" " + l)
    fluxo = "".join(partes)

    fichas = []
    marcas = list(re.finditer(r"(?:NOME DA|TIPO DE)\s+TECNOLOGIA\s+VAT?RIEDADES?\s+", fluxo, re.I))
    for k, m in enumerate(marcas):
        fim = marcas[k + 1].start() if k + 1 < len(marcas) else len(fluxo)
        trecho = fluxo[m.end():fim]
        antes = fluxo[:m.start()]
        cult = re.findall(r"@@CULT ([^@]+)@@", antes)
        pag = re.findall(r"@@PAG (\d+)@@", antes)
        nome = re.split(r"\s+(?:CARACTER\S*|ADAPTABILIDADE|ADAPTAÇÃO|RENDIMENTO|@@|(?:Tamanho|Peso|Maturação|Cor|Altura)\b)", trecho, maxsplit=1)[0].strip()
        if not cult or not nome or nome.lower().startswith("de "):
            continue
        texto = re.sub(r"@@(?:PAG|CULT) [^@]+@@", " ", trecho)
        fichas.append({"cultura": cult[-1], "variedade": nome, "pagina": int(pag[-1]) if pag else 0, "texto": "VARIEDADE " + texto})

    linhas = []
    for f in fichas:
        t = re.sub(r"\s+", " ", RE_RUIDO.sub(" ", f["texto"])).strip()
        # Corta o que for da próxima ficha ou de outra seção.
        t = RE_FIM_FICHA.split(t)[0].strip()
        # "ANO DE LIBERTAÇÃO 23": o 23 é número de página, não ano — o ano
        # dessas fichas não sai na extração e fica vazio, não chutado.
        t = re.sub(r"ANO DE LIBERTAÇÃO\s+\d{1,3}\b(?!\d)", "ANO DE LIBERTAÇÃO", t)
        # Cabeçalho da próxima cultura que sobra no fim ("... LIBERTAÇÃO Milho").
        t = re.sub(r"\s+(?:" + "|".join(map(re.escape, CULTURAS)) + r")$", "", t, flags=re.I).strip()
        linhas.append([
            f["cultura"], f["variedade"],
            campo(r"\b(Híbrido|OPV)\b", t),
            campo(r"(?:Ciclo de )?Matura[çc][ãa]o\s*:\s*(\d+\s*(?:a|-)\s*\d+\s*(?:dias|meses)|\d+\s*(?:dias|meses))", t),
            campo(r"((?:Até\s*)?\d+(?:[.,]\d+)?(?:\s*(?:a|-)\s*\d+(?:[.,]\d+)?)?\s*(?:T|ton|t|Kg|kg)\s*/\s*[Hh]a)", t),
            campo(r"ANO DE LIBERTAÇÃO\s*(\d{4})", t) or campo(r"(\d{4})\s*ANO DE LIBERTAÇÃO", t),
            t, f["pagina"], NOTAS.get((f["cultura"], f["variedade"]), ""), FONTE, URL,
        ])

    with open(SAIDA, "w", newline="", encoding="utf-8") as out:
        out.write("# GERADO por scripts/ingestion/iiam_variedades.py — não editar à mão.\n")
        out.write("# Campos estruturados só quando inequívocos; a coluna `ficha` é o texto original da fonte.\n")
        w = csv.writer(out)
        w.writerow(["cultura", "variedade", "tipo", "maturacao", "rendimento", "ano_libertacao", "ficha", "pagina", "nota_curadoria", "fonte", "url"])
        w.writerows(linhas)
    print(f"{len(linhas)} variedades -> {os.path.normpath(SAIDA)}")


if __name__ == "__main__":
    main()
