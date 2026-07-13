import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
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
  const designEfficiency = 0.85; 
  const designPowerKw = 1200.0;  

  // Derate efficiency linearly: e.g. drops from 85% to 78% at 70% load
  const calculateEfficiency = (load) => {
    if (load >= 100) return designEfficiency;
    const deficit = 100 - load;
    const derateFactor = 0.002333;
    return Math.max(0.40, designEfficiency - (deficit * derateFactor));
  };

  const calculateRecoveredPower = (load, eff) => {
    const flowScale = load / 100.0;
    return designPowerKw * flowScale * (eff / designEfficiency);
  };

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

  // Damper positions (P&ID standards)
  const damperAPosition = 100 - loadPercentage; // Bypass valve position
  const damperBPosition = loadPercentage;       // WHR Inlet isolator position

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
    <div className="bg-[#1E2022] border border-[#303337] rounded-lg p-5 text-[#E2E8F0] shadow-xl relative overflow-hidden">
      
      {/* Corner Rivets */}
      <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-[#303337]"></div>
      <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#303337]"></div>
      <div className="absolute bottom-2 left-2 w-1.5 h-1.5 rounded-full bg-[#303337]"></div>
      <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-[#303337]"></div>

      {/* Header */}
      <div className="mb-5 border-b border-[#303337] pb-3">
        <h2 className="text-sm font-bold tracking-wider text-white uppercase flex items-center gap-2">
          <span className="w-1.5 h-4 bg-[#DC2626] inline-block"></span>
          WHR PART-LOAD OPERATIONS & BYPASS VALVE SIMULATOR
        </h2>
        <p className="text-slate-400 text-[10px] font-mono-inst mt-0.5">
          DYNAMIC VALVE ALIGNMENTS & DUAL-AXIS EFFICIENCY DERATING GRAPHICS
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Simulator controls and Damper status */}
        <div className="space-y-5">
          
          {/* Slider input */}
          <div className="bg-[#121314] border border-[#303337] p-4 rounded">
            <h3 className="text-[10px] font-bold tracking-wider uppercase text-slate-400 border-b border-[#303337] pb-1.5 mb-3">
              LOAD CONTROLS
            </h3>
            
            <div className="flex justify-between items-center mb-1 font-mono">
              <label className="text-[11px] text-slate-400">Part-Load Ratio</label>
              <span className="text-sm font-bold text-yellow-500">{loadPercentage}%</span>
            </div>
            
            <input
              type="range"
              min="50"
              max="100"
              step="1"
              value={loadPercentage}
              onChange={(e) => setLoadPercentage(parseInt(e.target.value))}
              className="w-full h-1 bg-[#1E2022] rounded appearance-none cursor-pointer accent-yellow-500"
            />
            
            <div className="flex justify-between text-[8px] text-slate-500 mt-1 font-mono">
              <span>50% Min Load</span>
              <span>100% Design Load</span>
            </div>

            <div className="mt-4 space-y-2 pt-3 border-t border-[#303337] text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-550">Current Efficiency</span>
                <span className="text-white font-bold">{(currentEff * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-550">Efficiency Deficit</span>
                <span className="text-red-500 font-bold">
                  {((designEfficiency - currentEff) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-550">Power Capacity</span>
                <span className="text-white font-bold">{currentPower.toFixed(1)} kW</span>
              </div>
            </div>
          </div>

          {/* Damper routing matrix */}
          <div className="bg-[#121314] border border-[#303337] p-4 rounded">
            <h3 className="text-[10px] font-bold tracking-wider uppercase text-slate-400 border-b border-[#303337] pb-1.5 mb-3">
              P&ID DAMPER ALIGNMENTS
            </h3>
            
            <div className="space-y-4 font-mono">
              {/* Damper A */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-300">Damper A (Bypass Stack)</span>
                  <span className={`font-bold ${damperAPosition > 0 ? 'text-amber-500' : 'text-slate-550'}`}>
                    {damperAPosition}% Open
                  </span>
                </div>
                <div className="w-full bg-[#1E2022] h-2 rounded overflow-hidden">
                  <div 
                    className="bg-[#D97706] h-full transition-all duration-300" 
                    style={{ width: `${damperAPosition}%` }}
                  ></div>
                </div>
                <span className="text-[8px] text-slate-550 mt-1 block">Fail-Safe State: Open (Safe exhaust path)</span>
              </div>

              {/* Damper B */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-300">Damper B (WHR Inlet)</span>
                  <span className="font-bold text-emerald-400">
                    {damperBPosition}% Open
                  </span>
                </div>
                <div className="w-full bg-[#1E2022] h-2 rounded overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300" 
                    style={{ width: `${damperBPosition}%` }}
                  ></div>
                </div>
                <span className="text-[8px] text-slate-550 mt-1 block">Fail-Safe State: Closed (WHR Protection)</span>
              </div>
            </div>
          </div>

        </div>

        {/* Graphs and Tie-in Timeline */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Recharts chart showing derating curve */}
          <div className="bg-[#121314] border border-[#303337] p-4 rounded">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 font-mono-inst">
              THERMODYNAMIC PERFORMANCE DERATING CURVES
            </h4>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curveData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#25272a" />
                  <XAxis dataKey="load" stroke="#94a3b8" fontSize={9} />
                  <YAxis yAxisId="left" stroke="#eab308" fontSize={9} domain={[30, 95]} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={9} domain={[0, 1500]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E2022', borderColor: '#303337', fontSize: 10 }}
                    formatter={(value, name) => {
                      if (name === "efficiencyPercent") return [`${value}%`, "Efficiency"];
                      return [`${value} kW`, "Thermal Power"];
                    }}
                  />
                  <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: '9px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="efficiencyPercent" stroke="#D97706" strokeWidth={2} name="Derated Efficiency" dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="powerKw" stroke="#2563EB" strokeWidth={2} name="Recovered Power" dot={false} />
                  
                  <ReferenceDot yAxisId="left" x={loadPercentage} y={parseFloat((currentEff * 100).toFixed(1))} r={5} fill="#D97706" stroke="#ffffff" strokeWidth={1.5} />
                  <ReferenceDot yAxisId="right" x={loadPercentage} y={parseFloat(currentPower.toFixed(1))} r={5} fill="#2563EB" stroke="#ffffff" strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tie-in schedule timeline */}
          <div className="bg-[#121314] border border-[#303337] p-4 rounded">
            <div className="flex justify-between items-center mb-3 border-b border-[#303337] pb-1.5">
              <h3 className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                12-HOUR SHUTDOWN TIE-IN SCHEDULE
              </h3>
              <span className="text-[8px] text-amber-500 border border-amber-800/40 bg-amber-950/20 px-2 py-0.5 rounded font-bold uppercase font-mono">
                MINIMAL FACTORY DOWNTIME CODES
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {shutdownTimeline.map((step, idx) => (
                <div key={idx} className="flex gap-2.5 text-[11px] border border-[#303337] p-2 rounded bg-[#1E2022]/30">
                  <div className="text-yellow-500 font-mono font-bold whitespace-nowrap">
                    {step.hour}
                  </div>
                  <div>
                    <p className="text-slate-200 font-semibold leading-tight">{step.task}</p>
                    <div className="flex items-center gap-1.5 mt-1 font-mono text-[9px]">
                      <span className={`w-1 h-1 rounded-full ${
                        step.status === 'Completed' ? 'bg-emerald-500' :
                        step.status === 'In Progress' ? 'bg-yellow-500' : 'bg-slate-700'
                      }`}></span>
                      <span className="text-slate-500 font-bold uppercase">{step.status}</span>
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
