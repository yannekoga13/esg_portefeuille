"""
Portefeuille ESG Euronext - Backend FastAPI
Auteur : Généré automatiquement
Standard : VSME (EFRAG)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
from typing import List, Optional
from datetime import datetime

# ─── Tentative d'import yfinance (optionnel) ───────────────────────────────
try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False

# ─── Application ───────────────────────────────────────────────────────────
app = FastAPI(
    title="Portefeuille ESG Euronext API",
    description="API de scoring ESG (standard VSME) pour les entreprises du CAC 40",
    version="1.0.0"
)

# ─── CORS (autorise le frontend React) ─────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Chargement des données ESG ────────────────────────────────────────────
DATA_PATH = os.path.join(os.path.dirname(__file__), "esg_data.json")

def load_esg_data():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

# ─── Modèles Pydantic ──────────────────────────────────────────────────────
class PortfolioItem(BaseModel):
    ticker: str
    allocation_pct: float  # pourcentage du budget total (0-100)

class SimulationRequest(BaseModel):
    budget: float = 10000.0
    portfolio: List[PortfolioItem]

# ─── Routes ────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "message": "Portefeuille ESG Euronext API",
        "version": "1.0.0",
        "endpoints": ["/companies", "/stock/{ticker}", "/simulate", "/export/{ticker}"]
    }


@app.get("/companies")
def get_companies(
    sort_by: Optional[str] = None,
    min_score: Optional[float] = None
):
    """
    Retourne la liste des entreprises avec leurs scores ESG.
    - sort_by : 'environnement' | 'social' | 'gouvernance' | 'global'
    - min_score : score minimum (0-100)
    """
    companies = load_esg_data()

    # Filtrage par score minimum
    if min_score is not None:
        companies = [c for c in companies if c["esg"]["score_global"] >= min_score]

    # Tri
    sort_map = {
        "environnement": lambda c: c["esg"]["environnement"]["score"],
        "social": lambda c: c["esg"]["social"]["score"],
        "gouvernance": lambda c: c["esg"]["gouvernance"]["score"],
        "global": lambda c: c["esg"]["score_global"],
    }
    if sort_by and sort_by in sort_map:
        companies = sorted(companies, key=sort_map[sort_by], reverse=True)

    return {"count": len(companies), "companies": companies}


@app.get("/stock/{ticker}")
def get_stock(ticker: str):
    """
    Retourne le prix actuel et l'historique 1 an via yfinance.
    Si yfinance n'est pas disponible, retourne des données simulées.
    """
    companies = load_esg_data()
    company_info = next((c for c in companies if c["ticker"] == ticker), None)
    if not company_info:
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' non trouvé dans les données ESG.")

    if YFINANCE_AVAILABLE:
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1y")
            info = stock.info

            if hist.empty:
                raise ValueError("Historique vide")

            history_data = [
                {"date": str(row.name.date()), "close": round(row["Close"], 2)}
                for _, row in hist.iterrows()
            ]

            return {
                "ticker": ticker,
                "name": company_info["name"],
                "current_price": round(hist["Close"].iloc[-1], 2),
                "currency": info.get("currency", "EUR"),
                "market_cap": info.get("marketCap"),
                "pe_ratio": info.get("trailingPE"),
                "52w_high": round(hist["High"].max(), 2),
                "52w_low": round(hist["Low"].min(), 2),
                "history": history_data,
                "source": "yfinance"
            }
        except Exception as e:
            # Fallback sur données simulées si yfinance échoue
            return _simulated_stock(ticker, company_info, str(e))
    else:
        return _simulated_stock(ticker, company_info, "yfinance non installé")


def _simulated_stock(ticker: str, company_info: dict, reason: str):
    """Génère un historique simulé réaliste quand yfinance n'est pas disponible."""
    import random, math
    from datetime import timedelta

    random.seed(hash(ticker) % 10000)
    base_price = random.uniform(20, 500)
    history = []
    price = base_price
    today = datetime.now()

    for i in range(252):  # ~1 an de jours de bourse
        date = today - timedelta(days=252 - i)
        change = random.gauss(0.0002, 0.015)  # rendement journalier réaliste
        price = max(price * (1 + change), 1.0)
        history.append({"date": str(date.date()), "close": round(price, 2)})

    return {
        "ticker": ticker,
        "name": company_info["name"],
        "current_price": round(price, 2),
        "currency": "EUR",
        "market_cap": None,
        "pe_ratio": None,
        "52w_high": round(max(h["close"] for h in history), 2),
        "52w_low": round(min(h["close"] for h in history), 2),
        "history": history,
        "source": "simulé",
        "simulation_reason": reason
    }


@app.post("/simulate")
def simulate_portfolio(req: SimulationRequest):
    """
    Simule un portefeuille ESG :
    - Impact financier (valeur par entreprise)
    - Score ESG pondéré
    - Température écologique (CO2/kWh)
    - Recommandation VSME
    """
    total_pct = sum(item.allocation_pct for item in req.portfolio)
    if total_pct > 100.01:
        raise HTTPException(status_code=400, detail=f"Allocation totale ({total_pct:.1f}%) dépasse 100%.")

    companies = {c["ticker"]: c for c in load_esg_data()}
    results = []

    weighted_env = weighted_soc = weighted_gov = weighted_global = 0.0
    total_co2 = total_energy = 0.0
    total_invested = 0.0

    for item in req.portfolio:
        if item.ticker not in companies:
            raise HTTPException(status_code=404, detail=f"Ticker '{item.ticker}' introuvable.")

        company = companies[item.ticker]
        esg = company["esg"]
        allocation_eur = req.budget * (item.allocation_pct / 100)
        total_invested += allocation_eur
        weight = item.allocation_pct / 100

        # Accumulation pondérée ESG
        weighted_env   += esg["environnement"]["score"] * weight
        weighted_soc   += esg["social"]["score"] * weight
        weighted_gov   += esg["gouvernance"]["score"] * weight
        weighted_global += esg["score_global"] * weight

        # Empreinte écologique proportionnelle à l'allocation
        co2_share  = esg["environnement"]["emissions_co2_tonnes"] * weight
        kwh_share  = esg["environnement"]["consommation_energie_kwh"] * weight
        total_co2     += co2_share
        total_energy  += kwh_share

        results.append({
            "ticker": item.ticker,
            "name": company["name"],
            "sector": company["sector"],
            "allocation_pct": item.allocation_pct,
            "montant_eur": round(allocation_eur, 2),
            "esg": esg,
            "co2_impute_tonnes": round(co2_share, 1),
            "energie_imputee_kwh": round(kwh_share, 0),
        })

    # Température écologique (0-3°C, inspiré du Paris Agreement scoring)
    # Calcul simplifié : basé sur l'intensité CO2 normalisée
    max_co2_ref = 50000  # référence haute : portefeuille 100% pétrole
    temperature = 1.0 + 2.0 * (total_co2 / max_co2_ref)
    temperature = min(round(temperature, 2), 3.5)

    # Notation VSME
    if weighted_global >= 80:
        vsme_rating = "AA"
    elif weighted_global >= 70:
        vsme_rating = "A"
    elif weighted_global >= 60:
        vsme_rating = "BBB"
    elif weighted_global >= 50:
        vsme_rating = "BB"
    else:
        vsme_rating = "B"

    return {
        "budget_total": req.budget,
        "montant_investi": round(total_invested, 2),
        "nombre_entreprises": len(results),
        "portefeuille": results,
        "scores_ponderes": {
            "environnement": round(weighted_env, 1),
            "social": round(weighted_soc, 1),
            "gouvernance": round(weighted_gov, 1),
            "global": round(weighted_global, 1),
        },
        "empreinte_ecologique": {
            "co2_total_tonnes": round(total_co2, 1),
            "energie_total_kwh": round(total_energy, 0),
            "temperature_portefeuille_celsius": temperature,
            "interpretation": _temperature_label(temperature),
        },
        "notation_vsme": vsme_rating,
        "recommandation": _vsme_recommendation(weighted_global),
        "generated_at": datetime.now().isoformat(),
    }


def _temperature_label(temp: float) -> str:
    if temp < 1.5:
        return "🟢 Aligné Accord de Paris (< 1.5°C)"
    elif temp < 2.0:
        return "🟡 Trajectoire raisonnable (< 2°C)"
    elif temp < 2.5:
        return "🟠 Attention requise (2-2.5°C)"
    else:
        return "🔴 Hors trajectoire Paris (> 2.5°C)"


def _vsme_recommendation(score: float) -> str:
    if score >= 80:
        return "Portefeuille exemplaire. Conforme aux critères VSME avancés."
    elif score >= 70:
        return "Bon portefeuille ESG. Quelques axes d'amélioration sur les indicateurs sociaux ou environnementaux."
    elif score >= 60:
        return "Portefeuille modéré. Envisagez de remplacer les positions faibles par des entreprises mieux notées."
    else:
        return "Portefeuille à risque ESG élevé. Revoyez vos allocations en faveur d'entreprises plus durables."


@app.get("/export/{ticker}")
def export_company_report(ticker: str):
    """
    Exporte un rapport JSON complet pour une entreprise donnée.
    Peut servir de base à la génération PDF côté frontend.
    """
    companies = load_esg_data()
    company = next((c for c in companies if c["ticker"] == ticker), None)
    if not company:
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' introuvable.")

    esg = company["esg"]
    report = {
        "rapport_esg": {
            "entreprise": company["name"],
            "ticker": ticker,
            "secteur": company["sector"],
            "standard": "VSME (EFRAG)",
            "date_rapport": datetime.now().strftime("%d/%m/%Y"),
            "piliers": {
                "environnement": {
                    "score": esg["environnement"]["score"],
                    "consommation_energie_kwh": esg["environnement"]["consommation_energie_kwh"],
                    "emissions_co2_tonnes": esg["environnement"]["emissions_co2_tonnes"],
                    "appreciation": "Excellent" if esg["environnement"]["score"] >= 80 else
                                   "Bon" if esg["environnement"]["score"] >= 65 else
                                   "Moyen" if esg["environnement"]["score"] >= 50 else "Faible"
                },
                "social": {
                    "score": esg["social"]["score"],
                    "parite_femmes_pct": esg["social"]["parite_femmes_pct"],
                    "accidents_travail": esg["social"]["accidents_travail"],
                    "appreciation": "Excellent" if esg["social"]["score"] >= 80 else
                                   "Bon" if esg["social"]["score"] >= 65 else
                                   "Moyen" if esg["social"]["score"] >= 50 else "Faible"
                },
                "gouvernance": {
                    "score": esg["gouvernance"]["score"],
                    "independance_conseil_pct": esg["gouvernance"]["independance_conseil_pct"],
                    "transparence_fiscale": esg["gouvernance"]["transparence_fiscale"],
                    "appreciation": "Excellent" if esg["gouvernance"]["score"] >= 80 else
                                   "Bon" if esg["gouvernance"]["score"] >= 65 else
                                   "Moyen" if esg["gouvernance"]["score"] >= 50 else "Faible"
                }
            },
            "score_global": esg["score_global"],
            "notation_vsme": (
                "AA" if esg["score_global"] >= 80 else
                "A"  if esg["score_global"] >= 70 else
                "BBB" if esg["score_global"] >= 60 else
                "BB" if esg["score_global"] >= 50 else "B"
            ),
        }
    }
    return report


@app.post("/export/simulation")
def export_simulation_report(req: SimulationRequest):
    """
    Génère et retourne un rapport complet de simulation en JSON,
    prêt à être utilisé pour générer un PDF côté frontend.
    """
    simulation = simulate_portfolio(req)

    report = {
        "titre": "Rapport de Portefeuille ESG - Standard VSME",
        "genere_le": datetime.now().strftime("%d/%m/%Y à %H:%M"),
        "resume": {
            "budget": f"{simulation['budget_total']:,.0f} €",
            "investi": f"{simulation['montant_investi']:,.0f} €",
            "notation_vsme": simulation["notation_vsme"],
            "score_global": simulation["scores_ponderes"]["global"],
            "temperature": f"{simulation['empreinte_ecologique']['temperature_portefeuille_celsius']}°C",
            "recommandation": simulation["recommandation"],
        },
        "scores_detailles": simulation["scores_ponderes"],
        "empreinte_ecologique": simulation["empreinte_ecologique"],
        "portefeuille": [
            {
                "entreprise": p["name"],
                "ticker": p["ticker"],
                "secteur": p["sector"],
                "allocation": f"{p['allocation_pct']}%",
                "montant": f"{p['montant_eur']:,.0f} €",
                "score_esg": p["esg"]["score_global"],
                "co2_impute": f"{p['co2_impute_tonnes']} t",
            }
            for p in simulation["portefeuille"]
        ]
    }
    return report