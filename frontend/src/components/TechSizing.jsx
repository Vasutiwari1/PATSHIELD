import React, { useState, useEffect } from 'react';

export default function TechSizing() {
  // Input parameters
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

  // Format currency in Lakhs
  const formatLakhs = (val) => {
    return `${(val / 100000.0).toFixed(2)} Lakh INR`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-xl max-w-5xl mx-auto my-6">
      
      {/* Header */}
      <div className="mb-6 border-b border-slate-800 pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="w-2.5 h-6 bg-emerald-500 rounded-full inline-block"></span>
          WHR Technology Feasibility & Sizing Engine
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Perform thermodynamic sizing calculations and side-by-side technology comparisons.
        </p>
      </div>

      {/* Metallurgy Alert Banner (Section 3.3) */}
      <div className="mb-6">
        {isHighSulfur ? (
          <div className="bg-amber-950/40 border border-amber-800/80 rounded-lg p-4 text-amber-300 flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="font-bold text-amber-200">Corrosion Protection Active</h4>
              <p className="text-xs mt-0.5">
                Flue gas sulfur content exceeds 0.5% (Current: {sulfurContent}%). Recommending{" "}
                <span className="font-bold text-white underline decoration-amber-400">{metallurgyType}</span> to prevent acid dew-point corrosion during condensation.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 text-slate-300 flex items-start gap-3">
            <span className="text-xl">✅</span>
            <div>
              <h4 className="font-semibold text-slate-200">Standard Material Design</h4>
              <p className="text-xs mt-0.5">
                Flue gas sulfur content is within safe limits (Current: {sulfurContent}%). Recommending{" "}
                <span className="font-bold text-emerald-400">{metallurgyType}</span> for standard operational integrity.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Grid Layout: Inputs Left, Comparison Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Controls Column */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-5 space-y-5 h-fit">
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-400 border-b border-slate-800/50 pb-1">
            Exhaust Stream Inputs
          </h3>

          {/* Waste Gas Temperature */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Gas Temperature</span>
              <span className="text-white font-semibold">{temperature} °C</span>
            </div>
            <input
              type="range"
              min="50"
              max="900"
              step="10"
              value={temperature}
              onChange={(e) => setTemperature(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>90-150°C (ORC)</span>
              <span>200-350°C (Econ)</span>
              <span>400-800°C (WHRB)</span>
            </div>
          </div>

          {/* Mass Flow Rate */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Mass Flow Rate</span>
              <span className="text-white font-semibold">{massFlowRate} kg/s</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="100.0"
              step="0.5"
              value={massFlowRate}
              onChange={(e) => setMassFlowRate(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Sulfur Content */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Sulfur Content</span>
              <span className={`font-semibold ${isHighSulfur ? 'text-amber-400' : 'text-slate-300'}`}>
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
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">Limit is 0.5% for standard carbon steel.</p>
          </div>

          {/* Footprint Available */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Available Footprint Area</span>
              <span className="text-white font-semibold">{footprintAvailable} sqm</span>
            </div>
            <input
              type="range"
              min="10"
              max="150"
              step="5"
              value={footprintAvailable}
              onChange={(e) => setFootprintAvailable(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

        </div>

        {/* Side-by-Side Comparison Panels */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {techResults.map((tech) => {
              const borderClass = tech.isViable 
                ? "border-emerald-800/80 bg-emerald-950/10" 
                : "border-slate-800 bg-slate-950/30 opacity-60";

              return (
                <div 
                  key={tech.key} 
                  className={`border rounded-lg p-4 flex flex-col justify-between transition-all ${borderClass}`}
                >
                  <div>
                    {/* Badge */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                        {tech.key}
                      </span>
                      {tech.isViable ? (
                        <span className="bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 text-[9px] font-bold px-1.5 py-0.5 rounded">
                          Recommended
                        </span>
                      ) : (
                        <span className="bg-slate-900 text-slate-500 border border-slate-800 text-[9px] px-1.5 py-0.5 rounded">
                          Infeasible
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-white leading-tight mb-4 min-h-[40px]">
                      {tech.name}
                    </h3>

                    {/* Sizing Outputs Panel */}
                    <div className="space-y-2 border-t border-slate-800/80 pt-3 text-xs mb-4">
                      <h4 className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
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
                        <span className={`font-semibold ${tech.footprintFeasible ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tech.footprintFeasible ? 'Feasible' : 'Exceeded'}
                        </span>
                      </div>
                    </div>

                    {/* Financial Dashboard Panel */}
                    <div className="space-y-2 border-t border-slate-800/80 pt-3 text-xs">
                      <h4 className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
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
                        <span className="text-yellow-400 font-semibold">
                          {tech.paybackPeriod === 999 ? 'N/A' : `${tech.paybackPeriod.toFixed(1)} Years`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footnote warnings */}
                  {!tech.footprintFeasible && tech.isViable && (
                    <div className="mt-3 bg-red-950/20 border border-red-900/30 rounded p-1.5 text-[9px] text-red-400 text-center">
                      Required space exceeds available constraint.
                    </div>
                  )}
                </div>
              );
            })}

          </div>
          
          {/* Engineering Metallurgy design standard details */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4 text-xs space-y-2">
            <h4 className="font-semibold text-slate-200">Algorithmic Sizing & Metallurgy Recommendation Matrix</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Design calculations are fully automated and based on counter-flow heat exchanger thermodynamics where Q_dot = m_dot * Cp * delta_T. 
              Metallurgy recommendations prevent acid dew-point corrosion under cooling cycles. Economizer tube designs employ 50.8 mm tubes, 
              WHRB boilers use 63.5 mm high-pressure configurations, and ORC organic evaporators rely on 38.1 mm piping.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
