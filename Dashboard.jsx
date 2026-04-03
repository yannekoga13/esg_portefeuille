import { useState, useEffect } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const API = "http://localhost:8000";

// ─── Score color helper ────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 65) return "text-yellow-400";
  if (score >= 50) return "text-orange-400";
  return "text-red-400";
}
function scoreBg(score) {
  if (score >= 80) return "bg-emerald-500/20 border-emerald-500/30";
  if (score >= 65) return "bg-yellow-500/20 border-yellow-500/30";
  if (score >= 50) return "bg-orange-500/20 border-orange-500/30";
  return "bg-red-500/20 border-red-500/30";
}
function vsmeRating(score) {
  if (score >= 80) return "AA";
  if (score >= 70) return "A";
  if (score >= 60) return "BBB";
  if (score >= 50) return "BB";
  return "B";
}

// ─── Company Card ──────────────────────────────────────────────────────────
function CompanyCard({ company, onClick, selected }) {
  const { name, ticker, sector, esg } = company;
  return (
    <div
      onClick={() => onClick(company)}
      className={`cursor-pointer rounded-xl border p-4 transition-all hover:scale-[1.02] ${
        selected
          ? "border-emerald-500 bg-emerald-500/10"
          : "border-slate-700 bg-slate-800/50 hover:border-slate-500"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-white text-sm">{name}</p>
          <p className="text-xs text-slate-400">{ticker} · {sector}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded border ${scoreBg(esg.score_global)} ${scoreColor(esg.score_global)}`}>
          {vsmeRating(esg.score_global)}
        </span>
      </div>

      {/* Score bars */}
      <div className="space-y-1.5">
        {[
          { label: "E", score: esg.environnement.score, color: "bg-emerald-500" },
          { label: "S", score: esg.social.score, color: "bg-blue-500" },
          { label: "G", score: esg.gouvernance.score, color: "bg-purple-500" },
        ].map(({ label, score, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-4">{label}</span>
            <div className="flex-1 bg-slate-700 rounded-full h-1.5">
              <div
                className={`${color} h-1.5 rounded-full transition-all`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-xs text-slate-300 w-6 text-right">{score}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">Score Global</span>
        <span className={`text-sm font-bold ${scoreColor(esg.score_global)}`}>
          {esg.score_global}/100
        </span>
      </div>
    </div>
  );
}

// ─── Company Detail Panel ──────────────────────────────────────────────────
function CompanyDetail({ company, onExport }) {
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { name, ticker, sector, esg } = company;

  useEffect(() => {
    setLoading(true);
    setStockData(null);
    fetch(`${API}/stock/${ticker}`)
      .then((r) => r.json())
      .then((d) => setStockData(d))
      .catch(() => setStockData(null))
      .finally(() => setLoading(false));
  }, [ticker]);

  const radarData = [
    { subject: "Environnement", A: esg.environnement.score },
    { subject: "Social", A: esg.social.score },
    { subject: "Gouvernance", A: esg.gouvernance.score },
  ];

  // Format history for chart (monthly sampling)
  const chartData = stockData?.history
    ? stockData.history.filter((_, i) => i % 5 === 0).map((h) => ({
        date: h.date.slice(5), // MM-DD
        price: h.close,
      }))
    : [];

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 sticky top-24">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-white">{name}</h2>
          <p className="text-sm text-slate-400">{ticker} · {sector}</p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-black ${scoreColor(esg.score_global)}`}>
            {vsmeRating(esg.score_global)}
          </div>
          <div className="text-xs text-slate-500">VSME Rating</div>
        </div>
      </div>

      {/* Prix actuel */}
      {loading && (
        <div className="text-sm text-slate-400 mb-4 animate-pulse">⏳ Chargement du cours...</div>
      )}
      {stockData && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-400 mb-1">Prix actuel</p>
            <p className="text-lg font-bold text-white">
              {stockData.current_price}€
              {stockData.source === "simulé" && (
                <span className="text-xs text-slate-500 ml-1">(sim.)</span>
              )}
            </p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-400 mb-1">Plus haut 52s</p>
            <p className="text-sm font-semibold text-emerald-400">{stockData["52w_high"]}€</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-400 mb-1">Plus bas 52s</p>
            <p className="text-sm font-semibold text-red-400">{stockData["52w_low"]}€</p>
          </div>
        </div>
      )}

      {/* Graphique cours */}
      {chartData.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-slate-400 mb-2">Historique 1 an</p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} interval={20} />
              <YAxis tick={{ fontSize: 9, fill: "#64748b" }} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                labelStyle={{ color: "#94a3b8" }}
                itemStyle={{ color: "#10b981" }}
              />
              <Line type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Radar ESG */}
      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">Radar ESG (Standard VSME)</p>
        <ResponsiveContainer width="100%" height={160}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Radar name="Score" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Détails VSME */}
      <div className="space-y-3 mb-5">
        <Detail icon="🌿" label="CO₂ (t/an)" value={esg.environnement.emissions_co2_tonnes.toLocaleString()} />
        <Detail icon="⚡" label="Énergie (kWh/an)" value={esg.environnement.consommation_energie_kwh.toLocaleString()} />
        <Detail icon="⚖️" label="Parité femmes" value={`${esg.social.parite_femmes_pct}%`} />
        <Detail icon="🦺" label="Accidents travail" value={esg.social.accidents_travail} />
        <Detail icon="🏛️" label="Indépendance conseil" value={`${esg.gouvernance.independance_conseil_pct}%`} />
        <Detail icon="📋" label="Transparence fiscale" value={esg.gouvernance.transparence_fiscale ? "✅ Oui" : "❌ Non"} />
      </div>

      {/* Export */}
      <button
        onClick={() => onExport(ticker)}
        className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-300 transition-colors"
      >
        📥 Exporter rapport JSON
      </button>
    </div>
  );
}

function Detail({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{icon} {label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

// ─── Dashboard Principal ───────────────────────────────────────────────────
export default function Dashboard() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("global");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/companies?sort_by=${filter}`)
      .then((r) => r.json())
      .then((d) => {
        setCompanies(d.companies);
        setSelected(d.companies[0]);
        setLoading(false);
      })
      .catch(() => {
        setError("❌ Impossible de joindre le backend. Vérifiez que FastAPI tourne sur le port 8000.");
        setLoading(false);
      });
  }, [filter]);

  const handleExport = async (ticker) => {
    const res = await fetch(`${API}/export/${ticker}`);
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport_esg_${ticker}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.ticker.toLowerCase().includes(search.toLowerCase()) ||
      c.sector.toLowerCase().includes(search.toLowerCase())
  );

  const FILTERS = [
    { id: "global",        label: "🏆 Top Global" },
    { id: "environnement", label: "🌿 Top Environnement" },
    { id: "social",        label: "👥 Top Social" },
    { id: "gouvernance",   label: "🏛️ Top Gouvernance" },
  ];

  return (
    <div>
      {/* Stats bar */}
      {!loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Entreprises", value: companies.length, icon: "🏢" },
            { label: "Score moyen global", value: Math.round(companies.reduce((s, c) => s + c.esg.score_global, 0) / companies.length), icon: "📊" },
            { label: "Noté AA/A", value: companies.filter(c => c.esg.score_global >= 70).length, icon: "⭐" },
            { label: "Score env. moyen", value: Math.round(companies.reduce((s, c) => s + c.esg.environnement.score, 0) / companies.length), icon: "🌿" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              filter === f.id
                ? "bg-emerald-500 text-slate-900 border-emerald-500"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500"
            }`}
          >
            {f.label}
          </button>
        ))}

        {/* Recherche */}
        <input
          type="text"
          placeholder="🔍 Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Layout: liste + détail */}
      {error ? (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 text-red-300">{error}</div>
      ) : loading ? (
        <div className="text-slate-400 animate-pulse py-20 text-center">Chargement des données ESG...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Liste des entreprises */}
          <div className="lg:col-span-2">
            <p className="text-xs text-slate-500 mb-3">{filtered.length} entreprise(s) affichée(s)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
              {filtered.map((company) => (
                <CompanyCard
                  key={company.ticker}
                  company={company}
                  onClick={setSelected}
                  selected={selected?.ticker === company.ticker}
                />
              ))}
            </div>
          </div>

          {/* Panneau détail */}
          <div>
            {selected && (
              <CompanyDetail company={selected} onExport={handleExport} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}