import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

export default function CostOfInaction({ initialData = null }) {
  // Interactive inputs for local calculations
  const [currentSec, setCurrentSec] = useState(0.60);
  const [targetSec, setTargetSec] = useState(0.50);
  const [annualProduction, setAnnualProduction] = useState(15000);
  const [escertPrice, setEscertPrice] = useState(1840);
  const [fixedPenalty, setFixedPenalty] = useState(1000000);

  const [forecastData, setForecastData] = useState([]);

  // Recalculate forecast data locally whenever inputs change
  useEffect(() => {
    if (initialData) {
      setForecastData(initialData);
      return;
    }

    const calculatedForecast = [];
    let cumulativeShortfall = 0;

    for (let year = 1; year <= 3; year++) {
      const yearTargetSec = currentSec - (currentSec - targetSec) * (year / 3.0);
      const annualShortfall = Math.max(0, currentSec - yearTargetSec) * annualProduction;
      cumulativeShortfall += annualShortfall;

      const variablePenalty = cumulativeShortfall * escertPrice;
      const totalPenaltyInr = fixedPenalty + variablePenalty;
      const totalPenaltyLakh = totalPenaltyInr / 100000.0;

      calculatedForecast.push({
        year: `Year ${year}`,
        baselineSec: parseFloat(currentSec.toFixed(4)),
        targetSec: parseFloat(yearTargetSec.toFixed(4)),
        annualShortfallToe: parseFloat(annualShortfall.toFixed(2)),
        cumulativeShortfallToe: parseFloat(cumulativeShortfall.toFixed(2)),
        penaltyLakh: parseFloat(totalPenaltyLakh.toFixed(2)),
      });
    }

    setForecastData(calculatedForecast);
  }, [currentSec, targetSec, annualProduction, escertPrice, fixedPenalty, initialData]);

  const formatLakh = (value) => {
    return `${value} Lakh INR`;
  };

  return (
    <div className="bg-[#1E2022] border border-[#303337] rounded-lg p-5 text-[#E2E8F0] shadow-xl relative overflow-hidden">
      
      {/* Corner Rivet Details */}
      <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-[#303337]"></div>
      <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#303337]"></div>
      <div className="absolute bottom-2 left-2 w-1.5 h-1.5 rounded-full bg-[#303337]"></div>
      <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-[#303337]"></div>

      {/* Header */}
      <div className="mb-5 border-b border-[#303337] pb-3">
        <h2 className="text-sm font-bold tracking-wider text-white uppercase flex items-center gap-2">
          <span className="w-1.5 h-4 bg-[#DC2626] inline-block"></span>
          PAT CYCLE COST-OF-INACTION FORECAST (3-YEAR TIMELINE)
        </h2>
        <p className="text-slate-400 text-[10px] font-mono-inst mt-0.5">
          BEE REGULATORY COMPLIANCE TARGET TRACKING / PENALTY RISK
        </p>
      </div>

      {/* Grid Layout: Controls & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Controls Column */}
        <div className="bg-[#121314] border border-[#303337] rounded p-4 space-y-4">
          <h3 className="text-[10px] font-bold tracking-wider uppercase text-slate-400 border-b border-[#303337] pb-1 mb-2">
            SIMULATION ADJUSTMENTS
          </h3>

          {/* Current SEC */}
          <div>
            <div className="flex justify-between text-[11px] mb-1 font-mono-inst">
              <span className="text-slate-400">Current Plant SEC (toe/unit)</span>
              <span className="text-red-500 font-bold">{currentSec.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="2.00"
              step="0.05"
              value={currentSec}
              onChange={(e) => setCurrentSec(parseFloat(e.target.value))}
              className="w-full h-1 bg-[#1E2022] rounded appearance-none cursor-pointer accent-[#DC2626]"
            />
          </div>

          {/* Target SEC */}
          <div>
            <div className="flex justify-between text-[11px] mb-1 font-mono-inst">
              <span className="text-slate-400">BEE Target SEC (toe/unit)</span>
              <span className="text-emerald-400 font-bold">{targetSec.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.95"
              step="0.05"
              value={targetSec}
              onChange={(e) => setTargetSec(parseFloat(e.target.value))}
              className="w-full h-1 bg-[#1E2022] rounded appearance-none cursor-pointer accent-[#2563EB]"
            />
          </div>

          {/* Annual Production */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-mono-inst mb-1">
              Production Output (units)
            </label>
            <input
              type="number"
              value={annualProduction}
              onChange={(e) => setAnnualProduction(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full bg-[#1A1C1E] border border-[#303337] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#DC2626] font-mono"
            />
          </div>

          {/* ESCert price */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-mono-inst mb-1">
              ESCert Price (INR/Cert)
            </label>
            <input
              type="number"
              value={escertPrice}
              onChange={(e) => setEscertPrice(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-[#1A1C1E] border border-[#303337] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#DC2626] font-mono"
            />
          </div>

          {/* Fixed Penalty */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-mono-inst mb-1">
              Section 26 Fixed Penalty (INR)
            </label>
            <input
              type="number"
              value={fixedPenalty}
              onChange={(e) => setFixedPenalty(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-[#1A1C1E] border border-[#303337] rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-[#DC2626] font-mono"
            />
          </div>

          {forecastData.length > 0 && (
            <div className="bg-[#2C1D1E] border border-[#DC2626]/30 rounded p-3 text-center">
              <span className="text-[9px] uppercase tracking-wider text-[#DC2626] font-bold">PENALTY AT CYCLE TERMINAL</span>
              <p className="text-lg font-bold text-[#DC2626] font-mono mt-0.5">
                {forecastData[2].penaltyLakh.toFixed(2)} Lakh
              </p>
            </div>
          )}
        </div>

        {/* Visualizations Column */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Status metrics grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#121314] border border-[#303337] p-2.5 rounded text-center">
              <span className="text-[9px] text-slate-500 block uppercase font-mono-inst">Baseline SEC</span>
              <span className="text-sm font-bold text-red-500 font-mono mt-0.5 block">{currentSec.toFixed(3)} toe</span>
            </div>
            <div className="bg-[#121314] border border-[#303337] p-2.5 rounded text-center">
              <span className="text-[9px] text-slate-500 block uppercase font-mono-inst">Target Norm</span>
              <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">{targetSec.toFixed(3)} toe</span>
            </div>
            <div className="bg-[#121314] border border-[#303337] p-2.5 rounded text-center">
              <span className="text-[9px] text-slate-500 block uppercase font-mono-inst">Shortfall Sum</span>
              <span className="text-sm font-bold text-amber-500 font-mono mt-0.5 block">
                {forecastData.length > 0 ? `${Math.round(forecastData[2].cumulativeShortfallToe).toLocaleString()} toe` : '0 toe'}
              </span>
            </div>
          </div>

          {/* Recharts chart area */}
          <div className="h-64 w-full bg-[#121314] border border-[#303337] rounded p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#25272a" />
                <XAxis dataKey="year" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis yAxisId="left" stroke="#ef4444" fontSize={10} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#eab308" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1E2022', borderColor: '#303337', color: '#E2E8F0', fontSize: 11 }}
                  formatter={(value, name) => {
                    if (name === "penaltyLakh") return [formatLakh(value), "Penalty Exposure"];
                    return [value, name === "baselineSec" ? "SEC Projection" : "BEE Target Line"];
                  }}
                />
                <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: '10px' }} />
                <Line yAxisId="left" type="monotone" dataKey="baselineSec" stroke="#DC2626" strokeWidth={2} name="SEC Projected" dot={true} />
                <Line yAxisId="left" type="monotone" dataKey="targetSec" stroke="#10b981" strokeWidth={2} name="BEE Target" strokeDasharray="5 5" />
                <Line yAxisId="right" type="monotone" dataKey="penaltyLakh" stroke="#D97706" strokeWidth={2.5} name="Total Penalty" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Control Room Table */}
          <div className="overflow-x-auto border border-[#303337] rounded">
            <table className="w-full text-left text-[11px] text-slate-300 font-mono">
              <thead className="bg-[#121314] text-slate-400 uppercase text-[9px] tracking-wider border-b border-[#303337]">
                <tr>
                  <th className="px-3 py-2 border-r border-[#303337]">COMPLIANCE TIMELINE</th>
                  <th className="px-3 py-2 border-r border-[#303337]">BASELINE SEC</th>
                  <th className="px-3 py-2 border-r border-[#303337]">TARGET SEC LINE</th>
                  <th className="px-3 py-2 border-r border-[#303337]">ANNUAL SHORTFALL</th>
                  <th className="px-3 py-2">CUMULATIVE PENALTY</th>
                </tr>
              </thead>
              <tbody>
                {forecastData.map((row, idx) => (
                  <tr key={idx} className="border-b border-[#303337] hover:bg-[#121314]/30">
                    <td className="px-3 py-2 border-r border-[#303337] font-medium text-white">{row.year}</td>
                    <td className="px-3 py-2 border-r border-[#303337]">{row.baselineSec.toFixed(3)}</td>
                    <td className="px-3 py-2 border-r border-[#303337] text-emerald-400">{row.targetSec.toFixed(3)}</td>
                    <td className="px-3 py-2 border-r border-[#303337] text-amber-500">{row.annualShortfallToe.toLocaleString()} toe</td>
                    <td className="px-3 py-2 font-bold text-red-500">{formatLakh(row.penaltyLakh)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
}
