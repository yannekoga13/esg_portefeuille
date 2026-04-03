import { useState } from "react";
import Dashboard from "./components/Dashboard";
import Simulator from "./components/Simulator";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* ── Header ── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <span className="text-slate-900 font-black text-sm">ESG</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                Portefeuille ESG Euronext
              </h1>
              <p className="text-xs text-slate-400">Standard VSME · CAC 40</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex gap-1 bg-slate-800 rounded-lg p-1">
            {[
              { id: "dashboard", label: "📊 Dashboard" },
              { id: "simulator", label: "⚖️ Simulateur" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-emerald-500 text-slate-900"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="text-xs text-slate-500 hidden md:block">
            Données simulées · Standard EFRAG VSME
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "simulator" && <Simulator />}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 mt-16 py-6 text-center text-xs text-slate-600">
        Portefeuille ESG Euronext · Standard VSME (EFRAG) · Données à titre éducatif uniquement
      </footer>
    </div>
  );
}