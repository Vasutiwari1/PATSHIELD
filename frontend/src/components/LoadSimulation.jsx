import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot
} from 'recharts';

export default function LoadSimulation() {
  const [loadPercentage, setLoadPercentage] = useState(100);
  const [curveData, setCurveData] = useState([]);

  // Constants for calculations
  const designEfficiency = 0.85; // 85% design efficiency at 100% load
  const designPowerKw = 1200.0;  // 1200 kW recovered thermal energy at 100% load

  // Derate efficiency linearly: e.g. drops from 85% to 78% at 70% load
  // Delta load = 30%, Delta eff = 7%. Slope = 7 / 30 = 0.2333% efficiency drop per 1% load drop
  const calculateEfficiency = (load) => {
    if (load >= 100) return designEfficiency;
    const deficit = 100 - load;
    const derateFactor = 0.002333;
    return Math.max(0.40, designEfficiency - (deficit * derateFactor));
  };

  const calculateRecoveredPower = (load, eff) => {
    // Flow rate scales linearly with load percentage
    const flowScale = load / 100.0;
    // Power scales with both flow rate and efficiency ratio
    return designPowerKw * flowScale * (eff / designEfficiency);
  };

  // Build performance curve data (from 50% to 100% load)
  useEffect(() => {
    const data = [];
    for (let l = 50; l <= 100; l += 5) {
      const eff = calculateEfficiency(l);
      const power = calculateRecoveredPower(l, eff);
      data.push({
        load: l,
        efficiencyPercent: parseFloat((eff * 100).toFixed(1)),
        powerKw: parseFloat(power.toFixed(1))
      });
    }
    setCurveData(data);
  }, []);

  const currentEff = calculateEfficiency(loadPercentage);
  const currentPower = calculateRecoveredPower(loadPercentage, currentEff);

  // Damper states based on load percentage
  const damperAPosition = 100 - loadPercentage; // Bypass open percentage
  const damperBPosition = loadPercentage;       // WHR Inlet open percentage

  // 12-Hour Scheduled Shutdown Window (Section 3.6)
  const shutdownTimeline = [
    { hour: "Hour 0-2", task: "Safe venting, purge, cool line to below 50°C", status: "Completed" },
    { hour: "Hour 2-4", task: "Duct segment cutting and frame preparation", status: "In Progress" },
    { hour: "Hour 4-8", task: "Structural welding of Damper A/B housings", status: "Pending" },
    { hour: "Hour 8-10", task: "Actuator integration & power/pneumatic line wiring", status: "Pending" },
    { hour: "Hour 10-11", task: "Cold loop testing, leak checks & calibration", status: "Pending" },
    { hour: "Hour 11-12", task: "Warm restart, bypass alignment & handover", status: "Pending" }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-xl max-w-5xl mx-auto my-6">
      
      {/* Header */}
      <div className="mb-6 border-b border-slate-800 pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="w-2.5 h-6 bg-yellow-500 rounded-full inline-block"></span>
          WHR Part-Load Operations & Bypass Simulator
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Simulate performance derating curves at part-load operational profiles and view bypass routing damper states.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Simulator controls and Damper status */}
        <div className="space-y-6">
          
          {/* Slider input */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-5">
            <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-400 border-b border-slate-800/50 pb-1.5 mb-4">
              Load Ratio Controls
            </h3>
            
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs text-slate-400">Part-Load Operational Ratio</label>
              <span className="text-lg font-bold text-yellow-500">{loadPercentage}%</span>
            </div>
            
            <input
              type="range"
              min="50"
              max="100"
              step="1"
              value={loadPercentage}
              onChange={(e) => setLoadPercentage(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
            />
            
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>50% Min Stable Load</span>
              <span>100% Full Design Load</span>
            </div>

            <div className="mt-5 space-y-3 pt-3 border-t border-slate-800/50 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Current Efficiency</span>
                <span className="text-white font-semibold">{(currentEff * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Efficiency Loss (Derated)</span>
                <span className="text-red-400 font-semibold">
                  {((designEfficiency - currentEff) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recoverable Power</span>
                <span className="text-white font-semibold">{currentPower.toFixed(1)} kW</span>
              </div>
            </div>
          </div>

          {/* Damper routing matrix (Section 3.6) */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-5">
            <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-400 border-b border-slate-800/50 pb-1.5 mb-4">
              Dual-Damper Routing Matrix
            </h3>
            
            <div className="space-y-4">
              {/* Damper A */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-white">Damper A (Bypass Stack)</span>
                  <span className={`font-semibold ${damperAPosition > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {damperAPosition}% Open
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full transition-all duration-300" 
                    style={{ width: `${damperAPosition}%` }}
                  ></div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Actuator position: Motorized Fail-Open stack diverter</span>
              </div>

              {/* Damper B */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-white">Damper B (WHR Inlet)</span>
                  <span className="font-semibold text-emerald-400">
                    {damperBPosition}% Open
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300" 
                    style={{ width: `${damperBPosition}%` }}
                  ></div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Actuator position: Pneumatic Fail-Closed isolator</span>
              </div>
            </div>
          </div>

        </div>

        {/* Graphs and Tie-in Timeline */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Recharts chart showing derating curve */}
          <div className="bg-slate-950/30 border border-slate-800 rounded-lg p-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Thermodynamic Performance Curves (Efficiency vs Load)
            </h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curveData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="load" stroke="#94a3b8" fontSize={11} label={{ value: 'Operational Load (%)', position: 'insideBottom', offset: -5, style: { fill: '#94a3b8' } }} />
                  <YAxis yAxisId="left" stroke="#eab308" fontSize={11} label={{ value: 'Efficiency (%)', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8' } }} domain={[30, 95]} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={11} label={{ value: 'Power Output (kW)', angle: 90, position: 'insideRight', style: { fill: '#94a3b8' } }} domain={[0, 1500]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                    formatter={(value, name) => {
                      if (name === "efficiencyPercent") return [`${value}%`, "Derated Efficiency"];
                      return [`${value} kW`, "Recoverable Thermal Power"];
                    }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="efficiencyPercent" stroke="#eab308" strokeWidth={2.5} name="Efficiency Curve" dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="powerKw" stroke="#6366f1" strokeWidth={2.5} name="Power Capacity" dot={false} />
                  
                  {/* Highlight current point on the curves */}
                  <ReferenceDot yAxisId="left" x={loadPercentage} y={parseFloat((currentEff * 100).toFixed(1))} r={6} fill="#eab308" stroke="#ffffff" strokeWidth={2} />
                  <ReferenceDot yAxisId="right" x={loadPercentage} y={parseFloat(currentPower.toFixed(1))} r={6} fill="#6366f1" stroke="#ffffff" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tie-in schedule timeline (Section 3.6) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-5">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
              <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-400">
                12-Hour Scheduled Shutdown Tie-In Blueprint
              </h3>
              <span className="text-[10px] text-yellow-500 border border-yellow-800/40 bg-yellow-950/20 px-2 py-0.5 rounded font-bold uppercase">
                Minimizes Downtime
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shutdownTimeline.map((step, idx) => (
                <div key={idx} className="flex gap-3 text-xs border border-slate-800/80 p-2.5 rounded bg-slate-950/30">
                  <div className="text-yellow-500 font-bold tracking-tight whitespace-nowrap min-w-[70px]">
                    {step.hour}
                  </div>
                  <div>
                    <p className="text-slate-200 font-medium">{step.task}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        step.status === 'Completed' ? 'bg-emerald-500' :
                        step.status === 'In Progress' ? 'bg-yellow-500' : 'bg-slate-700'
                      }`}></span>
                      <span className="text-[9px] uppercase font-bold text-slate-500">{step.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
