import React, { useState, useEffect } from 'react';

export default function TechSizing() {
  // Input parameters (FIELD DEVICES SIMULATED)
  const [temperature, setTemperature] = useState(250);
  const [massFlowRate, setMassFlowRate] = useState(15.0);
  const [sulfurContent, setSulfurContent] = useState(0.2);
  const [footprintAvailable, setFootprintAvailable] = useState(50);

  const [techResults, setTechResults] = useState([]);

  // Metallurgy recommendation based on sulfur content
  const isHighSulfur = sulfurContent > 0.5;
  const metallurgyType = isHighSulfur
    ? "Stainless Steel (SS316) - Acid Dew-Point Corrosion Protection Active"
    : "Carbon Steel";

  useEffect(() => {
    const cpGas = 1.05; // kJ/kg·°C
    const operatingHours = 7200; // 300 days * 24 hrs
    const boilerEfficiency = 0.80;
    const orcEfficiency = 0.12;
    const thermalFuelCostKwh = 4.5;
    const electricityCostKwh = 7.5;
    const escertPriceInr = 1840;

    const technologies = [
      {
        name: "ORC (Organic Rankine Cycle)",
        key: "ORC",
        minTemp: 90,
        maxTemp: 150,
        tOut: 80,
        uCoeff: 0.03, // kW/m²·°C
        costPerKw: 60000.0,
        tColdIn: 40,
        tColdOut: 75,
        tubeOd: 38.1,
        tubeThickness: 2.8,
        isElectric: true
      },
      {
        name: "Economizer",
        key: "Economizer",
        minTemp: 200,
        maxTemp: 350,
        tOut: 150,
        uCoeff: 0.05, // kW/m²·°C
        costPerKw: 15000.0,
        tColdIn: 80,
        tColdOut: 130,
        tubeOd: 50.8,
        tubeThickness: 3.2,
        isElectric: false
      },
      {
        name: "WHRB (Waste Heat Recovery Boiler)",
        key: "WHRB",
        minTemp: 400,
        maxTemp: 800,
        tOut: 180,
        uCoeff: 0.04, // kW/m²·°C
        costPerKw: 25000.0,
        tColdIn: 190,
        tColdOut: 200,
        tubeOd: 63.5,
        tubeThickness: 4.5,
        isElectric: false
      }
    ];

    const results = technologies.map(tech => {
      // Determine feasibility based on temperature range
      let isFeasible = temperature >= tech.minTemp && temperature <= tech.maxTemp;
      
      // Borderline support (expand viability indicators)
      let borderMatch = false;
      if (!isFeasible) {
        if (tech.key === "ORC" && temperature > 150 && temperature <= 180) borderMatch = true;
        if (tech.key === "Economizer" && ((temperature > 150 && temperature < 200) || (temperature > 350 && temperature < 400))) borderMatch = true;
        if (tech.key === "WHRB" && ((temperature > 350 && temperature < 400) || temperature > 800)) borderMatch = true;
      }
      
      const isViable = isFeasible || borderMatch;

      // Calculate output temperature
      let tDischarge = tech.tOut;
      if (temperature <= tDischarge) {
        tDischarge = temperature - 10.0;
      }

      const dT = Math.max(0, temperature - tDischarge);
      const qDot = massFlowRate * cpGas * dT; // kW thermal capacity

      // LMTD calculation
      const dt1 = temperature - tech.tColdOut;
      const dt2 = tDischarge - tech.tColdIn;
      let lmtd = 0;
      if (dt1 <= 0 || dt2 <= 0) {
        lmtd = Math.max(1, 0.5 * ((temperature - tech.tColdIn) + (tDischarge - tech.tColdOut)));
      } else if (Math.abs(dt1 - dt2) < 1e-5) {
        lmtd = dt1;
      } else {
        lmtd = (dt1 - dt2) / Math.log(dt1 / dt2);
      }

      const area = qDot / (tech.uCoeff * lmtd);
      
      // Footprint constraint validation (1 sqm footprint supports ~4 sqm heat transfer area)
      const requiredFootprint = area / 4.0;
      const footprintFeasible = requiredFootprint <= footprintAvailable;

      // Financials
      const equipCapex = qDot * tech.costPerKw;
      const ductingCapex = equipCapex * 0.15;
      const fansCapex = equipCapex * 0.10;
      const installCapex = equipCapex * 0.20;
      const totalCapex = equipCapex + ductingCapex + fansCapex + installCapex;

      let annualSavings = 0;
      let savedToe = 0;

      if (tech.isElectric) {
        const electricalEnergyKwh = qDot * orcEfficiency * operatingHours;
        annualSavings = electricalEnergyKwh * electricityCostKwh;
        savedToe = electricalEnergyKwh / 11630.0;
      } else {
        const thermalSavedKwh = (qDot * operatingHours) / boilerEfficiency;
        annualSavings = thermalSavedKwh * thermalFuelCostKwh;
        savedToe = thermalSavedKwh / 11630.0;
      }

      const annualEscertValue = savedToe * escertPriceInr;
      const totalAnnualBenefit = annualSavings + annualEscertValue;
      const payback = totalAnnualBenefit > 0 ? totalCapex / totalAnnualBenefit : 999;

      return {
        ...tech,
        isViable,
        capacityKw: qDot,
        areaSqm: area,
        requiredFootprintSqm: requiredFootprint,
        footprintFeasible,
        totalCapexInr: totalCapex,
        annualSavingsInr: annualSavings,
        escertsGenerated: savedToe,
        escertsValueInr: annualEscertValue,
        paybackPeriod: payback
      };
    });

    setTechResults(results);
  }, [temperature, massFlowRate, sulfurContent, footprintAvailable]);

  const formatLakhs = (val) => {
    return `${(val / 100000.0).toFixed(2)} Lakh INR`;
  };

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
          WHR COPROCESSOR FEASIBILITY & SIZING ENGINE
        </h2>
        <p className="text-[#94A3B8] text-[10px] font-mono-inst mt-0.5">
          STAGE-BY-STAGE HEAT TRANSFER MATRIX & CORROSION PREVENTION CODES
        </p>
      </div>

      {/* Metallurgy Alert Banner (Section 3.3 / Stage 4 Warning) */}
      <div className="mb-5">
        {isHighSulfur ? (
          <div className="bg-crosshatch border-2 border-[#DC2626] rounded p-4 text-center">
            <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-1">
              ☣️ ACID DEW-POINT CORROSION WARNING
            </h4>
            <p className="text-xs font-bold text-white uppercase">
              MANDATORY STAINLESS STEEL (SS316) SPECIFICATION REQUIRED
            </p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-lg mx-auto leading-relaxed">
              Exhaust stream sulfur levels exceed 0.5% (Current: {sulfurContent}%). Acid condensations at boundary temperatures will destroy carbon steel tubes.
            </p>
          </div>
        ) : (
          <div className="bg-[#121314] border border-[#303337] rounded p-3 text-slate-300 flex items-center gap-2.5">
            <span className="text-emerald-400 font-bold font-mono">STATUS:</span>
            <span className="text-xs font-semibold text-slate-200">
              {metallurgyType} - Design parameters conform to standard structural steel limit thresholds.
            </span>
          </div>
        )}
      </div>

      {/* Grid Layout: Inputs Left, Comparison Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Controls Column */}
        <div className="bg-[#121314] border border-[#303337] rounded p-4 space-y-4 h-fit">
          <h3 className="text-[10px] font-bold tracking-wider uppercase text-slate-400 border-b border-[#303337] pb-1">
            LOCAL EXHAUST TELEMETRY
          </h3>

          {/* Waste Gas Temperature */}
          <div>
            <div className="flex justify-between text-[11px] mb-1 font-mono-inst">
              <span className="text-slate-400">Gas Inlet Temperature</span>
              <span className="text-white font-bold">{temperature} °C</span>
            </div>
            <input
              type="range"
              min="50"
              max="900"
              step="10"
              value={temperature}
              onChange={(e) => setTemperature(parseInt(e.target.value))}
              className="w-full h-1 bg-[#1E2022] rounded appearance-none cursor-pointer accent-[#DC2626]"
            />
            <div className="flex justify-between text-[9px] text-slate-550 mt-1 font-mono">
              <span>90°C (ORC)</span>
              <span>200°C (Econ)</span>
              <span>400°C (WHRB)</span>
            </div>
          </div>

          {/* Mass Flow Rate */}
          <div>
            <div className="flex justify-between text-[11px] mb-1 font-mono-inst">
              <span className="text-slate-400">Gas Mass Flow</span>
              <span className="text-white font-bold">{massFlowRate} kg/s</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="100.0"
              step="0.5"
              value={massFlowRate}
              onChange={(e) => setMassFlowRate(parseFloat(e.target.value))}
              className="w-full h-1 bg-[#1E2022] rounded appearance-none cursor-pointer accent-[#D97706]"
            />
          </div>

          {/* Sulfur Content */}
          <div>
            <div className="flex justify-between text-[11px] mb-1 font-mono-inst">
              <span className="text-slate-400">Gas Sulfur Content</span>
              <span className={`font-bold ${isHighSulfur ? 'text-red-500' : 'text-slate-300'}`}>
                {sulfurContent.toFixed(2)} %
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="2.5"
              step="0.05"
              value={sulfurContent}
              onChange={(e) => setSulfurContent(parseFloat(e.target.value))}
              className="w-full h-1 bg-[#1E2022] rounded appearance-none cursor-pointer accent-[#D97706]"
            />
          </div>

          {/* Footprint Available */}
          <div>
            <div className="flex justify-between text-[11px] mb-1 font-mono-inst">
              <span className="text-slate-400">Available Space Area</span>
              <span className="text-white font-bold">{footprintAvailable} sqm</span>
            </div>
            <input
              type="range"
              min="10"
              max="150"
              step="5"
              value={footprintAvailable}
              onChange={(e) => setFootprintAvailable(parseInt(e.target.value))}
              className="w-full h-1 bg-[#1E2022] rounded appearance-none cursor-pointer accent-[#2563EB]"
            />
          </div>

        </div>

        {/* Side-by-Side Comparison Panels */}
        <div className="lg:col-span-2 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {techResults.map((tech) => {
              const borderClass = tech.isViable 
                ? "border-[#303337] bg-[#121314]" 
                : "border-[#303337] bg-[#121314] opacity-40";

              return (
                <div 
                  key={tech.key} 
                  className={`border rounded p-4 flex flex-col justify-between transition-all relative ${borderClass}`}
                >
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[9px] font-bold font-mono tracking-wider text-slate-400">
                        {tech.key}
                      </span>
                      {tech.isViable ? (
                        <span className="text-[#10B981] border border-[#10B981]/30 bg-[#10B981]/5 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase font-mono">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="text-slate-600 border border-[#303337] bg-transparent text-[8px] px-1.5 py-0.5 rounded uppercase font-mono">
                          INACTIVE
                        </span>
                      )}
                    </div>

                    <h3 className="text-xs font-bold text-white tracking-tight leading-tight mb-4 min-h-[32px]">
                      {tech.name}
                    </h3>

                    {/* Sizing Outputs Panel */}
                    <div className="space-y-1.5 border-t border-[#303337] pt-3 text-[11px] font-mono mb-4">
                      <h4 className="text-[8px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                        Sizing Parameters
                      </h4>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Recovery Cap</span>
                        <span className="text-white font-medium">{(tech.capacityKw / 1000.0).toFixed(2)} MW</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tube Area</span>
                        <span className="text-white font-medium">{tech.areaSqm.toFixed(1)} sqm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tube OD</span>
                        <span className="text-white font-medium">{tech.tubeOd} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Wall Thickness</span>
                        <span className="text-white font-medium">{tech.tubeThickness} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Footprint Fit</span>
                        <span className={`font-semibold ${tech.footprintFeasible ? 'text-emerald-400' : 'text-red-500'}`}>
                          {tech.footprintFeasible ? 'Feasible' : 'Exceeded'}
                        </span>
                      </div>
                    </div>

                    {/* Financial Dashboard Panel */}
                    <div className="space-y-1.5 border-t border-[#303337] pt-3 text-[11px] font-mono">
                      <h4 className="text-[8px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                        Financial Yield
                      </h4>
                      <div className="flex justify-between">
                        <span className="text-slate-500">CAPEX</span>
                        <span className="text-white font-semibold">{formatLakhs(tech.totalCapexInr)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Annual Savings</span>
                        <span className="text-white font-semibold">{formatLakhs(tech.annualSavingsInr)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">ESCerts Earned</span>
                        <span className="text-emerald-400 font-semibold">{tech.escertsGenerated.toFixed(1)} toe</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Payback Period</span>
                        <span className="text-amber-500 font-semibold">
                          {tech.paybackPeriod === 999 ? 'N/A' : `${tech.paybackPeriod.toFixed(1)} Yrs`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!tech.footprintFeasible && tech.isViable && (
                    <div className="mt-3 bg-red-950/20 border border-red-900/30 rounded p-1 text-[9px] text-red-500 text-center font-mono">
                      SPACE EXCEEDED BY {(tech.requiredFootprintSqm - footprintAvailable).toFixed(1)} sqm
                    </div>
                  )}
                </div>
              );
            })}

          </div>
          
          {/* Engineering Metallurgy design standard details */}
          <div className="bg-[#121314] border border-[#303337] rounded p-4 text-[10px] space-y-1.5 font-mono-inst">
            <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-xs">P&ID Sizing & Metallurgy Recommendation Matrix</h4>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Primary calculation sets are derived using standard thermodynamics equations. 
              Metallurgy recommendations are hardcoded at threshold limit intervals. Economizers employ 50.8 mm tubes, 
              WHRB boilers use 63.5 mm boiler-grade lines, and ORC organic evaporators rely on 38.1 mm pressure vessels.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
