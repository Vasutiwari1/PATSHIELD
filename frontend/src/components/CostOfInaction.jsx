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
      // BEE regulatory target line gradually tightens linearly to the final target
      const yearTargetSec = currentSec - (currentSec - targetSec) * (year / 3.0);
      
      // Calculate annual shortfall in toe (tonnes of oil equivalent)
      const annualShortfall = Math.max(0, currentSec - yearTargetSec) * annualProduction;
      cumulativeShortfall += annualShortfall;

      // Variable component of penalty
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

  // Format monetary value
  const formatLakh = (value) => {
    return `${value} Lakh INR`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-xl max-w-5xl mx-auto my-6">
      {/* Header */}
      <div className="mb-6 border-b border-slate-800 pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="w-2.5 h-6 bg-red-500 rounded-full inline-block"></span>
          Cost-of-Inaction Forecast (PAT Cycle)
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          BEE Compliance risk projection mapping energy intensity trends and statutory financial penalties.
        </p>
      </div>

      {/* Grid Layout: Controls & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Controls Column */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-5 space-y-5">
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-400 mb-3 border-b border-slate-800/50 pb-1">
            Plant Assumptions
          </h3>

          {/* Current SEC */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Current Plant SEC (toe/unit)</span>
              <span className="text-red-400 font-semibold">{currentSec.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="2.00"
              step="0.05"
              value={currentSec}
              onChange={(e) => setCurrentSec(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
          </div>

          {/* Target SEC */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">BEE Target SEC (toe/unit)</span>
              <span className="text-emerald-400 font-semibold">{targetSec.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.95"
              step="0.05"
              value={targetSec}
              onChange={(e) => setTargetSec(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            {targetSec >= currentSec && (
              <p className="text-[10px] text-yellow-500 mt-1">Target SEC must be lower than Current SEC to simulate penalty risk.</p>
            )}
          </div>

          {/* Annual Production */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Annual Production Output (units)</label>
            <input
              type="number"
              value={annualProduction}
              onChange={(e) => setAnnualProduction(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
            />
          </div>

          {/* ESCert Certificate Price */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">BEE ESCert Price (INR/Certificate)</label>
            <input
              type="number"
              value={escertPrice}
              onChange={(e) => setEscertPrice(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">Statutory floor price is 1,840 INR per certificate.</p>
          </div>

          {/* Fixed Penalty Component */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Fixed Penalty Component (INR)</label>
            <input
              type="number"
              value={fixedPenalty}
              onChange={(e) => setFixedPenalty(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">Fixed penalty under Section 26 is 10 Lakh INR.</p>
          </div>

          {/* Compliance Risk Summary Card */}
          {forecastData.length > 0 && (
            <div className="bg-red-950/30 border border-red-900/40 rounded p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-red-400">Total Penalty Exposure (Year 3)</span>
              <p className="text-xl font-bold text-red-500 mt-1">
                {forecastData[2].penaltyLakh.toFixed(2)} Lakh INR
              </p>
            </div>
          )}
        </div>

        {/* Visualizations Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Legend and stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-950/40 border border-slate-800 p-3 rounded">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Unmitigated SEC</span>
              <span className="text-lg font-semibold text-red-400 mt-0.5 block">{currentSec.toFixed(3)} toe</span>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 p-3 rounded">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Target SEC Norm</span>
              <span className="text-lg font-semibold text-emerald-400 mt-0.5 block">{targetSec.toFixed(3)} toe</span>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 p-3 rounded">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">3-Yr Shortfall</span>
              <span className="text-lg font-semibold text-yellow-500 mt-0.5 block">
                {forecastData.length > 0 ? `${forecastData[2].cumulativeShortfallToe.toLocaleString()} toe` : '0 toe'}
              </span>
            </div>
          </div>

          {/* Recharts Area */}
          <div className="h-72 w-full bg-slate-950/30 border border-slate-800 rounded-lg p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} />
                <YAxis yAxisId="left" stroke="#ef4444" fontSize={11} label={{ value: 'SEC (toe/unit)', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8' } }} domain={['auto', 'auto']} />
                <YAxis yAxisId="right" orientation="right" stroke="#eab308" fontSize={11} label={{ value: 'Penalty (Lakh INR)', angle: 90, position: 'insideRight', style: { fill: '#94a3b8' } }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                  formatter={(value, name) => {
                    if (name === "penaltyLakh") return [formatLakh(value), "Cumulative Penalty"];
                    return [value, name === "baselineSec" ? "Projected SEC" : "BEE Target Line"];
                  }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                <Line yAxisId="left" type="monotone" dataKey="baselineSec" stroke="#ef4444" strokeWidth={2.5} name="Projected Baseline SEC" activeDot={{ r: 6 }} />
                <Line yAxisId="left" type="monotone" dataKey="targetSec" stroke="#10b981" strokeWidth={2.5} name="BEE Regulatory Target Line" strokeDasharray="5 5" />
                <Line yAxisId="right" type="monotone" dataKey="penaltyLakh" stroke="#eab308" strokeWidth={3} name="Cumulative Financial Penalty" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Numerical Table View */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-2 border border-slate-800">Timeline</th>
                  <th className="px-4 py-2 border border-slate-800">Baseline SEC (toe/unit)</th>
                  <th className="px-4 py-2 border border-slate-800">Target SEC Line (toe/unit)</th>
                  <th className="px-4 py-2 border border-slate-800">Annual Shortfall</th>
                  <th className="px-4 py-2 border border-slate-800">Cumulative Penalty</th>
                </tr>
              </thead>
              <tbody>
                {forecastData.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-800/80 hover:bg-slate-950/20">
                    <td className="px-4 py-2.5 font-medium text-white">{row.year}</td>
                    <td className="px-4 py-2.5">{row.baselineSec.toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-emerald-400">{row.targetSec.toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-yellow-500">{row.annualShortfallToe.toLocaleString()} toe</td>
                    <td className="px-4 py-2.5 font-semibold text-red-400">{formatLakh(row.penaltyLakh)}</td>
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
