"""
fao_cropcalendar_mz.py — Gera as tabelas de Moçambique de internal/zae a partir
do FAO Crop Calendar (calendário agrícola por zona agroecológica).

Moçambique não tem um equivalente digital ao ZARC brasileiro. O que existe de
aberto e estruturado é o calendário da FAO, organizado pelas 10 zonas
agroecológicas (R1–R10) do IIAM. Este script baixa esse calendário e escreve:

  pmo-bot-go/internal/zae/dados/zonas.csv        (gerado — não editar à mão)
  pmo-bot-go/internal/zae/dados/janelas_fao.csv  (gerado — não editar à mão)

Dados de outras fontes (IIAM, MASA, FEWS NET) entram à mão em
janelas_manual.csv, e o mapeamento distrito→zona em distritos_zonas.csv —
ambos curados, ambos com fonte em cada linha. Este script não toca neles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTICULARIDADES DA FONTE (verificadas em 2026-10-08)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  * API pública, sem chave:
      /api/v1/countries/MZ/aez               — 10 zonas, ids "001".."010"
      /api/v1/countries/MZ/cropCalendar?aez= — calendário de UMA zona; o
        parâmetro é o id numérico ("001"), não o nome ("R1"), que devolve [].
  * Não há português: language=pt devolve FRANCÊS. Os nomes de cultura são
    traduzidos por CULTURAS_PT abaixo; uma cultura nova sem tradução faz o
    script falhar de propósito (melhor parar do que publicar nome em inglês).
  * A cobertura é esparsa (~72 combinações cultura×zona; R9 vazia). Isso é da
    fonte, não do script.
  * Licença: o Banco Mundial distribui o "Crop Calendar for Africa" da FAO como
    CC BY 4.0 — confirmar com a FAO antes de uso comercial amplo.

Uso:
  python scripts/ingestion/fao_cropcalendar_mz.py
"""

import csv
import datetime
import json
import os
import sys
import urllib.request

API = "https://api-cropcalendar.apps.fao.org/api/v1/countries/MZ"
FONTE = "FAO Crop Calendar (Moçambique, zonas agroecológicas do IIAM)"
SAIDA = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "pmo-bot-go", "internal", "zae", "dados"
)

# Nome canônico em português (como o produtor moçambicano fala, quando há
# diferença do Brasil). Sinônimos ficam no Go (internal/zae), não aqui.
CULTURAS_PT = {
    "Bean": "feijão",
    "Bitter gourd": "cacana",
    "Bok choy": "couve-chinesa",
    "Cabbage": "repolho",
    "Carrot": "cenoura",
    "Cassava": "mandioca",
    "Chives": "cebolinha",
    "Corn": "milho",
    "Cowpea": "feijão-nhemba",
    "Eggplant": "beringela",
    "Garlic": "alho",
    "Leek": "alho-francês",
    "Lettuce": "alface",
    "Millet, foxtail": "painço",
    "Peanut": "amendoim",
    "Pearl millet": "mexoeira",
    "Potato": "batata",
    "Pumpkin": "abóbora",
    "Quinoa": "quinoa",
    "Rice": "arroz",
    "Sesame": "gergelim",
    "Soybean": "soja",
    "Spinach": "espinafre",
    "Sunflower": "girassol",
    "Teff": "tef",
    "Wheat, bread": "trigo",
}


def baixar(caminho):
    req = urllib.request.Request(API + caminho, headers={"User-Agent": "manejo-org-ingestao/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def ddmm(d):
    """{"day": "1", "month": 10} -> "01/10"; vazio se faltar."""
    if not d or not d.get("day") or not d.get("month"):
        return ""
    return f"{int(d['day']):02d}/{int(d['month']):02d}"


def epoca(sessao):
    if str(sessao.get("all_year", "")).lower() == "yes":
        return "todo_ano"
    info = (sessao.get("additional_information") or "").strip().lower()
    if info.startswith("first season"):
        return "1a"
    if info.startswith("second season"):
        return "2a"
    return "unica"


def ciclo(sessao):
    gp = sessao.get("growing_period") or {}
    valor = (gp.get("value") or "").replace(" ", "")
    if not valor:
        return ""
    return f"{valor} {'meses' if gp.get('period') == 'months' else 'dias'}"


def main():
    coletado = datetime.date.today().isoformat()
    zonas = baixar("/aez?language=en")
    zonas.sort(key=lambda z: z["zone_id"])

    os.makedirs(SAIDA, exist_ok=True)

    with open(os.path.join(SAIDA, "zonas.csv"), "w", newline="", encoding="utf-8") as f:
        f.write(f"# GERADO por scripts/ingestion/fao_cropcalendar_mz.py em {coletado} — não editar à mão.\n")
        w = csv.writer(f)
        w.writerow(["zona", "fao_aez_id", "unidades_administrativas", "praticas_agricolas", "fonte", "url"])
        for z in zonas:
            w.writerow([
                z["name"].replace("R0", "R"),  # a FAO grafa "R09" num texto e "R9" no nome
                z["zone_id"],
                z.get("administratrative_units", "").strip(),
                z.get("main_agricultural_practices", "").strip(),
                FONTE,
                f"{API}/aez?language=en",
            ])

    sem_traducao = set()
    linhas = []
    for z in zonas:
        url = f"{API}/cropCalendar?aez={z['zone_id']}&language=en"
        for reg in baixar(f"/cropCalendar?aez={z['zone_id']}&language=en"):
            nome_fao = reg["crop"]["name"]
            if nome_fao not in CULTURAS_PT:
                sem_traducao.add(nome_fao)
                continue
            ano = (reg.get("lastUpdated") or "")[-4:]
            for s in reg["sessions"]:
                linhas.append([
                    CULTURAS_PT[nome_fao], nome_fao, z["name"].replace("R0", "R"), epoca(s),
                    ddmm(s.get("early_sowing")), ddmm(s.get("later_sowing")),
                    ddmm(s.get("early_harvest")), ddmm(s.get("late_harvest")),
                    ciclo(s),
                    (s.get("additional_information") or "").strip(),
                    (s.get("comments") or "").strip(),
                    FONTE, ano, url, "",
                ])

    if sem_traducao:
        sys.exit(f"Culturas sem tradução em CULTURAS_PT: {sorted(sem_traducao)} — adicione e rode de novo.")

    linhas.sort(key=lambda l: (l[2], l[0], l[3]))
    with open(os.path.join(SAIDA, "janelas_fao.csv"), "w", newline="", encoding="utf-8") as f:
        f.write(f"# GERADO por scripts/ingestion/fao_cropcalendar_mz.py em {coletado} — não editar à mão.\n")
        w = csv.writer(f)
        w.writerow([
            "cultura", "cultura_fonte", "zona", "epoca", "sementeira_inicio", "sementeira_fim",
            "colheita_inicio", "colheita_fim", "ciclo", "observacao_epoca", "observacao",
            "fonte", "ano", "url", "revisor",
        ])
        w.writerows(linhas)

    print(f"zonas: {len(zonas)} | janelas: {len(linhas)} | saída: {os.path.normpath(SAIDA)}")


if __name__ == "__main__":
    main()
