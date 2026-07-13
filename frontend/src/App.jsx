import React, { useState, useEffect } from 'react';
import CostOfInaction from './components/CostOfInaction';
import TechSizing from './components/TechSizing';
import LoadSimulation from './components/LoadSimulation';

export default function App() {
  const [calculatedData, setCalculatedData] = useState(null);
  const [activeTab, setActiveTab] = useState('cost');
  const [subscriptionTier, setSubscriptionTier] = useState('active-paid'); // free, active-paid, expired

  // 4 Primary Physics & Sizing Inputs (Section 4)
  const [tStack, setTStack] = useState(260); // Stack Temp in °C
  const [isWet, setIsWet] = useState(false);  // Smoke moisture profile
  const [isHighSulfur, setIsHighSulfur] = useState(false); // High sulfur flag (>0.05%)
  const [capexBoundary, setCapexBoundary] = useState(45); // CAPEX boundary in Lakh INR

  // Statutory/Industrial baseline form inputs
  const [industryType, setIndustryType] = useState('Steel');
  const [production, setProduction] = useState(12000);
  const [currentSec, setCurrentSec] = useState(0.150);
  const [overrideTarget, setOverrideTarget] = useState(false);
  const [customTargetSec, setCustomTargetSec] = useState(0.120);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sparkline data for ESCert ledger compliance widget (30-day index)
  const [sparklineData, setSparklineData] = useState([]);

  useEffect(() => {
    // Generate mock sparkline values reflecting ESCert price variations
    const base = 1840;
    const points = Array.from({ length: 30 }, (_, i) => {
      const rand = Math.sin(i * 0.5) * 45 + Math.cos(i * 0.2) * 20;
      return Math.round(base + rand);
    });
    setSparklineData(points);
  }, []);

  const sectorDefaults = {
    Textile: 0.35,
    Steel: 0.12,
    Cement: 0.075,
    Chemical: 0.22,
    Refinery: 0.32,
    Other: 0.28
  };

  const handleSectorChange = (sector) => {
    setIndustryType(sector);
    if (!overrideTarget) {
      setCustomTargetSec(sectorDefaults[sector] || 0.12);
    }
  };

  const handleOverrideToggle = (checked) => {
    setOverrideTarget(checked);
    if (checked) {
      setCustomTargetSec(sectorDefaults[industryType] || 0.12);
    }
  };

  const handleAnalyze = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      const targetSec = overrideTarget ? customTargetSec : (sectorDefaults[industryType] || 0.12);
      const secShortfall = Math.max(0, currentSec - targetSec);
      const annualShortfall = secShortfall * production;
      const cumulativeShortfall = annualShortfall * 3;
      const fixedPenalty = 1000000;
      const variablePenalty = cumulativeShortfall * 1840;
      const totalPenaltyLakh = (fixedPenalty + variablePenalty) / 100000.0;

      // Thermodynamic yield estimate
      const cpGas = 1.05;
      const massFlowEstimate = 18.5; // kg/s
      const dtWhr = Math.max(0, tStack - 155);
      const thermalRecoveryKw = massFlowEstimate * cpGas * dtWhr;

      setCalculatedData({
        industryType,
        production,
        currentSec,
        targetSec,
        tStack,
        isWet,
        isHighSulfur,
        capexBoundary,
        thermalRecoveryKw: Math.round(thermalRecoveryKw),
        penaltyLakh: parseFloat(totalPenaltyLakh.toFixed(2)),
        estimated_penalty_lakh: parseFloat(totalPenaltyLakh.toFixed(2)),
      });
      setIsSubmitting(false);
    }, 500);
  };

  // Thermocouple margin metrics
  const safetyLimitTemp = 155;
  const tempSafetyMargin = tStack - safetyLimitTemp;
  const inAcidZone = tStack >= 120 && tStack <= 140;

  // Metallurgy recommendation logic (SS316 mandatory check)
  const requiresSS316 = isHighSulfur && isWet;

  // Sparkline coordinates helper
  const renderSparkline = (data) => {
    if (!data.length) return '';
    const width = 140;
    const height = 30;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
    return pts;
  };

  return (
    <div className="min-h-screen bg-[#121314] text-[#E2E8F0] flex flex-col font-sans selection:bg-[#DC2626] selection:text-white">
      
      {/* Top Header HMI Console */}
      <header className="bg-[#1E2022] border-b border-[#303337] py-3.5 px-6 flex justify-between items-center shadow-md relative">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-9 h-9 border border-[#DC2626] bg-[#2C1D1E] text-[#DC2626] rounded font-mono font-bold text-lg shadow-inner">
            TC
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-white uppercase font-sans">
              PATShield // THERMAL INTELLIGENCE COCKPIT
            </h1>
            <span className="text-[10px] text-slate-400 font-mono-inst uppercase tracking-widest block mt-0.5">
              Ref: EC Act 2001 / BEE-WHR-04 / STACK CONTROL AREA
            </span>
          </div>
        </div>

        {/* Console control inputs & status indicators */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold tracking-widest uppercase">
              SYS STATUS: SECURED
            </span>
          </div>

          <div className="flex items-center gap-3 border-l border-[#303337] pl-6">
            <span className="text-[11px] font-mono-inst text-slate-400">SIMULATION TIER:</span>
            <select 
              value={subscriptionTier}
              onChange={(e) => setSubscriptionTier(e.target.value)}
              className="bg-[#121314] text-xs font-mono border border-[#303337] rounded px-3 py-1 text-white focus:outline-none focus:border-[#DC2626]"
            >
              <option value="free">FREE COCKPIT (GATED)</option>
              <option value="active-paid">PREMIUM MASTER (UNLOCKED)</option>
              <option value="expired">PREMIUM EXPIRED (LOCKED)</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-grow p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Input Form Control Station */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Physical Instrumentation Card Profile */}
          <div className="bg-[#1E2022] border border-[#303337] rounded-lg p-5 shadow-xl relative overflow-hidden">
            {/* Rivet representation details in corners */}
            <div className="absolute top-2 left-2 w-1 h-1 rounded-full bg-[#303337]"></div>
            <div className="absolute top-2 right-2 w-1 h-1 rounded-full bg-[#303337]"></div>
            <div className="absolute bottom-2 left-2 w-1 h-1 rounded-full bg-[#303337]"></div>
            <div className="absolute bottom-2 right-2 w-1 h-1 rounded-full bg-[#303337]"></div>
            
            <div className="border-b border-[#303337] pb-3 mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-sans flex items-center gap-2">
                <span className="w-1.5 h-3 bg-[#DC2626]"></span>
                INPUT HOOKS CONTROL BOARD
              </h2>
              <p className="text-[10px] text-slate-400 font-mono-inst mt-0.5">
                FIELD DEVICE TRANSMITTER SIMULATION
              </p>
            </div>

            <form onSubmit={handleAnalyze} className="space-y-5">
              
              {/* Hook 1: Stack Temperature slider & numeric input */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-slate-300 font-mono-inst uppercase tracking-wider font-semibold">T_stack (Flue Gas Temp)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={tStack}
                      onChange={(e) => setTStack(Math.max(50, Math.min(900, parseInt(e.target.value) || 0)))}
                      className="w-16 bg-[#121314] border border-[#303337] rounded px-1.5 py-0.5 text-right font-mono font-bold text-emerald-400 focus:outline-none focus:border-[#DC2626]"
                    />
                    <span className="text-[10px] text-slate-400">°C</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="50"
                  max="900"
                  step="5"
                  value={tStack}
                  onChange={(e) => setTStack(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-[#121314] rounded-lg appearance-none cursor-pointer accent-[#DC2626]"
                />
              </div>

              {/* Hook 2 & 3: Smoke Profile (Dry/Wet) & High-Sulfur Yes/No Toggles */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* Smoke moisture toggle */}
                <div className="bg-[#121314] border border-[#303337] p-2.5 rounded">
                  <span className="block text-[10px] text-slate-400 uppercase font-mono-inst tracking-wide mb-2">Smoke Moisture</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsWet(false)}
                      className={`flex-1 text-[10px] font-bold py-1 px-2 rounded uppercase border transition-all ${
                        !isWet ? 'bg-[#2C3035] border-[#50555C] text-white' : 'bg-transparent border-[#303337] text-slate-500'
                      }`}
                    >
                      Dry
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsWet(true)}
                      className={`flex-1 text-[10px] font-bold py-1 px-2 rounded uppercase border transition-all ${
                        isWet ? 'bg-[#DC2626]/20 border-[#DC2626] text-white' : 'bg-transparent border-[#303337] text-slate-500'
                      }`}
                    >
                      Wet
                    </button>
                  </div>
                </div>

                {/* High Sulfur toggle */}
                <div className="bg-[#121314] border border-[#303337] p-2.5 rounded">
                  <span className="block text-[10px] text-slate-400 uppercase font-mono-inst tracking-wide mb-2">Sulfur Content</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsHighSulfur(false)}
                      className={`flex-1 text-[10px] font-bold py-1 px-2 rounded uppercase border transition-all ${
                        !isHighSulfur ? 'bg-[#2C3035] border-[#50555C] text-white' : 'bg-transparent border-[#303337] text-slate-500'
                      }`}
                    >
                      Low
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsHighSulfur(true)}
                      className={`flex-1 text-[10px] font-bold py-1 px-2 rounded uppercase border transition-all ${
                        isHighSulfur ? 'bg-[#DC2626]/20 border-[#DC2626] text-white' : 'bg-transparent border-[#303337] text-slate-500'
                      }`}
                    >
                      High
                    </button>
                  </div>
                </div>

              </div>

              {/* Hook 4: CAPEX Boundary Field */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-slate-300 font-mono-inst uppercase tracking-wider font-semibold">CAPEX Budget Limit</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={capexBoundary}
                      onChange={(e) => setCapexBoundary(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-16 bg-[#121314] border border-[#303337] rounded px-1.5 py-0.5 text-right font-mono font-bold text-amber-500 focus:outline-none focus:border-[#DC2626]"
                    />
                    <span className="text-[10px] text-slate-400">Lakh INR</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="5"
                  value={capexBoundary}
                  onChange={(e) => setCapexBoundary(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-[#121314] rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Statutory inputs segment */}
              <div className="bg-[#121314] border border-[#303337] p-3 rounded-lg space-y-3">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-1">PAT Compliance Constants</span>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[9px] text-slate-500 block">Sector</label>
                    <select
                      value={industryType}
                      onChange={(e) => handleSectorChange(e.target.value)}
                      className="w-full bg-[#1A1C1E] border border-[#303337] text-slate-300 rounded px-1.5 py-1 focus:outline-none"
                    >
                      <option value="Steel">Steel</option>
                      <option value="Cement">Cement</option>
                      <option value="Textile">Textile</option>
                      <option value="Chemical">Chemical</option>
                      <option value="Refinery">Refinery</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 block">Prod (units/yr)</label>
                    <input
                      type="number"
                      value={production}
                      onChange={(e) => setProduction(Math.max(100, parseInt(e.target.value) || 0))}
                      className="w-full bg-[#1A1C1E] border border-[#303337] text-slate-300 rounded px-1.5 py-1 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[9px] text-slate-500 block">Current SEC (toe)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={currentSec}
                      onChange={(e) => setCurrentSec(Math.max(0.001, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#1A1C1E] border border-[#303337] text-slate-300 rounded px-1.5 py-1 focus:outline-none"
                    />
                  </div>
                  <div className="relative">
                    <label className="text-[9px] text-slate-500 block">Target Override</label>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="checkbox"
                        checked={overrideTarget}
                        onChange={(e) => handleOverrideToggle(e.target.checked)}
                        className="rounded bg-[#1A1C1E] border-[#303337] text-[#DC2626]"
                      />
                      <span className="text-[10px] text-slate-400 font-semibold">Override</span>
                    </div>
                  </div>
                </div>

                {overrideTarget && (
                  <div>
                    <label className="text-[9px] text-slate-550 block">Target SEC Norm</label>
                    <input
                      type="number"
                      step="0.001"
                      value={customTargetSec}
                      onChange={(e) => setCustomTargetSec(parseFloat(e.target.value))}
                      className="w-full bg-[#1A1C1E] border border-[#303337] text-emerald-400 font-mono rounded px-1.5 py-1 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white font-mono uppercase tracking-wider font-bold py-2.5 px-4 rounded transition-all focus:outline-none shadow-md disabled:opacity-50 text-xs border border-[#E11D48]"
              >
                {isSubmitting ? 'ENERGIZING ENGINE...' : 'EXECUTE STATUTORY ASSESSMENT'}
              </button>
            </form>
          </div>

          {/* Access Gating Metallurgy Warning Badge (Section 4 Indicator) */}
          {requiresSS316 && (
            <div className="bg-crosshatch border-2 border-[#DC2626] rounded-lg p-4 text-center space-y-2 animate-pulse shadow-md">
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl text-[#DC2626]">☣️</span>
                <span className="text-[10px] font-black tracking-widest text-[#DC2626] uppercase">
                  METALLURGICAL CORROSION WARNING
                </span>
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-tight">
                MANDATORY STAINLESS STEEL (SS316) SPECIFICATION REQUIRED
              </h4>
              <p className="text-[9px] text-slate-400">
                Wet Smoke combined with high sulfur parameters triggers immediate risk of sulfuric acid dew point condensation.
              </p>
            </div>
          )}

        </div>

        {/* Right Dashboard Cockpit */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main calculated panel */}
          {calculatedData ? (
            <div className="space-y-6">
              
              {/* Urgency Alert Banner (Section 2 Output) */}
              <div className="w-full bg-gradient-to-r from-red-950 via-slate-950 to-red-950 border-2 border-red-500 rounded-xl p-5 text-center shadow-2xl relative">
                <div className="absolute top-0.5 right-1 text-[8px] text-slate-500 font-mono">SYS-ID: B-504</div>
                <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block mb-1">
                  ⚠️ CRITICAL COMPLIANCE LIABILITY IDENTIFIED
                </span>
                <h2 className="text-3xl font-black text-red-500 tracking-tight my-1 font-mono-inst">
                  INR {calculatedData.estimated_penalty_lakh || "186.64"} Lakh
                </h2>
                <p className="text-slate-300 text-xs max-w-xl mx-auto font-medium mt-1">
                  If this trend continues, your plant carries this estimated PAT penalty risk by the end of the next compliance cycle.
                </p>
              </div>

              {/* The centerpiece: Integrated Thermocouple Safety Floor HUD */}
              <div className="bg-[#1E2022] border border-[#303337] rounded-lg p-5 shadow-xl">
                <div className="flex justify-between items-center border-b border-[#303337] pb-2 mb-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    THERMOCOUPLE SAFETY FLOOR HUD
                  </h3>
                  <span className="text-[9px] font-mono-inst bg-[#2C1D1E] text-[#DC2626] border border-[#5F2120] px-2 py-0.5 rounded">
                    ANALOG STRIP CHART SIMULATOR
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  
                  {/* The Vertical Strip Gauge Representation */}
                  <div className="md:col-span-3 bg-[#121314] rounded border border-[#303337] p-3 flex flex-col justify-between h-48 relative overflow-hidden">
                    {/* Scale axis */}
                    <div className="absolute inset-x-0 bottom-4 top-4 flex flex-col justify-between text-[9px] font-mono text-slate-500 pointer-events-none px-2 border-r border-[#303337]">
                      <div>400°C</div>
                      <div>300°C</div>
                      <div>200°C</div>
                      <div>155°C</div>
                      <div>100°C</div>
                    </div>

                    {/* Gradient thermometer background */}
                    <div className="absolute top-4 bottom-4 left-16 right-4 bg-slate-900 rounded overflow-hidden">
                      {/* Cool blue */}
                      <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-[#2563EB]/25"></div>
                      {/* Mid Amber */}
                      <div className="absolute bottom-1/4 left-0 right-0 h-2/4 bg-[#D97706]/10"></div>
                      {/* Acid Dew point hatching zone (120-140°C) */}
                      <div className="absolute bottom-[10%] left-0 right-0 h-[10%] bg-crosshatch border-y border-[#DC2626]/40 z-10 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-red-500 tracking-wider">ACID DEW POINT (120-140°C)</span>
                      </div>
                      {/* Safety Limit stop line (155°C) */}
                      <div className="absolute bottom-[23%] left-0 right-0 h-0.5 bg-[#DC2626] z-20 shadow-glow"></div>
                      {/* Live T_stack indicator bar */}
                      <div 
                        className="absolute bottom-0 left-0 w-4 bg-gradient-to-t from-[#2563EB] via-[#D97706] to-[#DC2626] transition-all duration-300"
                        style={{ height: `${Math.min(100, Math.max(0, ((tStack - 100) / 300) * 100))}%` }}
                      ></div>
                    </div>

                    {/* Indicator Flag for 155°C stop */}
                    <div className="absolute bottom-[24%] left-4 z-30">
                      <span className="bg-[#DC2626] text-white text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wide shadow whitespace-nowrap">
                        155°C MIN FLOOR STOP
                      </span>
                    </div>

                    {/* Safety Margin Alert flag */}
                    <div 
                      className="absolute left-24 z-30 transition-all duration-300"
                      style={{ bottom: `${Math.min(90, Math.max(10, ((tStack - 100) / 300) * 100))}%` }}
                    >
                      <span className="bg-[#1E2022] border border-white/40 text-emerald-400 text-[9px] font-mono px-2 py-0.5 rounded shadow whitespace-nowrap flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        T_stack: {tStack}°C
                      </span>
                    </div>
                  </div>

                  {/* Reactive readouts and warning indicators */}
                  <div className="md:col-span-1 space-y-3">
                    <div className="bg-[#121314] border border-[#303337] p-2.5 rounded text-center">
                      <span className="text-[9px] text-slate-500 uppercase block tracking-wider font-semibold">T_stack Margin</span>
                      <h4 className={`text-xl font-bold font-mono mt-0.5 ${tempSafetyMargin < 0 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                        {tempSafetyMargin >= 0 ? `+${tempSafetyMargin}°C` : `${tempSafetyMargin}°C`}
                      </h4>
                      <span className="text-[8px] text-slate-500 uppercase mt-0.5 block">Above 155°C limit</span>
                    </div>

                    {tempSafetyMargin < 0 ? (
                      <div className="bg-red-950/20 border border-red-900 text-red-500 text-[10px] p-2 rounded text-center font-bold tracking-tight">
                        🚨 STACK CONDENSATION TEMP VIOLATION
                      </div>
                    ) : inAcidZone ? (
                      <div className="bg-amber-950/20 border border-amber-900 text-amber-500 text-[10px] p-2 rounded text-center font-bold tracking-tight">
                        ⚠️ LIQUID PHASE DEW POINT CONDENSATION
                      </div>
                    ) : (
                      <div className="bg-emerald-950/10 border border-emerald-900/60 text-emerald-400 text-[10px] p-2 rounded text-center font-bold tracking-tight">
                        ✓ SECURE OPERATING RANGE
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Tabbed workspace panels relative container */}
              <div className="relative border border-[#303337] rounded-lg p-5 bg-[#1E2022] shadow-xl overflow-hidden min-h-[500px]">
                
                {/* Paywall Blur Mask Overlay for Free/Expired Tiers */}
                {subscriptionTier !== 'active-paid' && (
                  <div className="absolute inset-0 bg-[#121314]/85 backdrop-blur-[6px] z-50 flex flex-col items-center justify-center p-8 text-center">
                    <div className="bg-[#1E2022] border border-[#303337] rounded-lg p-6 max-w-md shadow-2xl relative">
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#DC2626]"></div>
                      <div className="text-3xl mb-3">🔒</div>
                      {subscriptionTier === 'free' ? (
                        <>
                          <h3 className="text-base font-bold text-white uppercase mb-2 tracking-wider">Premium Compliance Cockpit Locked</h3>
                          <p className="text-slate-400 text-[11px] leading-relaxed mb-5">
                            You have unlocked the basic compliance penalty assessment. Upgrade to access 3-year cost of inaction projections, thermodynamic sizing recommenders, and bypass damper routing metrics.
                          </p>
                          <button 
                            onClick={() => setSubscriptionTier('active-paid')}
                            className="bg-[#DC2626] hover:bg-[#B91C1C] text-white border border-[#E11D48] font-bold py-2 px-4 rounded text-xs tracking-wider uppercase transition-all shadow-md"
                          >
                            UPGRADE COCKPIT ACCOUNT
                          </button>
                        </>
                      ) : (
                        <>
                          <h3 className="text-base font-bold text-red-500 uppercase mb-2 tracking-wider">Subscription Gated</h3>
                          <p className="text-slate-400 text-[11px] leading-relaxed mb-5">
                            Your enterprise licensing has expired. Re-authenticate standard credentials to unlock live load simulations and continuous tracking ledgers.
                          </p>
                          <button 
                            onClick={() => setSubscriptionTier('active-paid')}
                            className="bg-[#DC2626] hover:bg-[#B91C1C] text-white border border-[#E11D48] font-bold py-2 px-4 rounded text-xs tracking-wider uppercase transition-all shadow-md"
                          >
                            RE-AUTHORIZE CONSOLE ACCESS
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Dashboard Tabs styled dynamically */}
                <div className="bg-[#121314] border border-[#303337] p-1 rounded flex gap-1 w-fit mb-5">
                  <button
                    onClick={() => setActiveTab('cost')}
                    className={`px-3 py-1.5 text-xs uppercase font-mono tracking-wider transition-all ${
                      activeTab === 'cost' ? 'bg-[#2C3035] text-white border border-[#50555C]' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Cost of Inaction
                  </button>
                  <button
                    onClick={() => setActiveTab('sizing')}
                    className={`px-3 py-1.5 text-xs uppercase font-mono tracking-wider transition-all ${
                      activeTab === 'sizing' ? 'bg-[#2C3035] text-white border border-[#50555C]' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sizing & Metallurgy
                  </button>
                  <button
                    onClick={() => setActiveTab('load')}
                    className={`px-3 py-1.5 text-xs uppercase font-mono tracking-wider transition-all ${
                      activeTab === 'load' ? 'bg-[#2C3035] text-white border border-[#50555C]' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Bypass & Load Simulation
                  </button>
                </div>

                {/* Tab content wrappers */}
                <div className="w-full">
                  {activeTab === 'cost' && (
                    <CostOfInaction 
                      initialData={[
                        {
                          year: "Year 1",
                          baselineSec: calculatedData.currentSec,
                          targetSec: calculatedData.currentSec - (calculatedData.currentSec - calculatedData.targetSec) * 0.33,
                          annualShortfallToe: Math.max(0, calculatedData.currentSec - (calculatedData.currentSec - (calculatedData.currentSec - calculatedData.targetSec) * 0.33)) * calculatedData.production,
                          cumulativeShortfallToe: Math.max(0, calculatedData.currentSec - (calculatedData.currentSec - (calculatedData.currentSec - calculatedData.targetSec) * 0.33)) * calculatedData.production,
                          penaltyLakh: (1000000 + (Math.max(0, calculatedData.currentSec - (calculatedData.currentSec - (calculatedData.currentSec - calculatedData.targetSec) * 0.33)) * calculatedData.production) * 1840) / 100000.0
                        },
                        {
                          year: "Year 2",
                          baselineSec: calculatedData.currentSec,
                          targetSec: calculatedData.currentSec - (calculatedData.currentSec - calculatedData.targetSec) * 0.66,
                          annualShortfallToe: Math.max(0, calculatedData.currentSec - (calculatedData.currentSec - (calculatedData.currentSec - calculatedData.targetSec) * 0.66)) * calculatedData.production,
                          cumulativeShortfallToe: (Math.max(0, calculatedData.currentSec - (calculatedData.currentSec - (calculatedData.currentSec - calculatedData.targetSec) * 0.33)) * calculatedData.production) + (Math.max(0, calculatedData.currentSec - (calculatedData.currentSec - (calculatedData.currentSec - calculatedData.targetSec) * 0.66)) * calculatedData.production),
                          penaltyLakh: (1000000 + ((Math.max(0, calculatedData.currentSec - (calculatedData.currentSec - (calculatedData.currentSec - calculatedData.targetSec) * 0.33)) * calculatedData.production) + (Math.max(0, calculatedData.currentSec - (calculatedData.currentSec - (calculatedData.currentSec - calculatedData.targetSec) * 0.66)) * calculatedData.production)) * 1840) / 100000.0
                        },
                        {
                          year: "Year 3",
                          baselineSec: calculatedData.currentSec,
                          targetSec: calculatedData.targetSec,
                          annualShortfallToe: Math.max(0, calculatedData.currentSec - calculatedData.targetSec) * calculatedData.production,
                          cumulativeShortfallToe: ((Math.max(0, calculatedData.currentSec - (calculatedData.currentSec - (calculatedData.currentSec - calculatedData.targetSec) * 0.33)) * calculatedData.production) + (Math.max(0, calculatedData.currentSec - (calculatedData.currentSec - (calculatedData.currentSec - calculatedData.targetSec) * 0.66)) * calculatedData.production)) + (Math.max(0, calculatedData.currentSec - calculatedData.targetSec) * calculatedData.production),
                          penaltyLakh: calculatedData.penaltyLakh
                        }
                      ]}
                    />
                  )}
                  {activeTab === 'sizing' && <TechSizing />}
                  {activeTab === 'load' && <LoadSimulation />}
                </div>

              </div>

              {/* Process Flow Cascade, Environmental Carbon Audit, & Transaction Ledger Cards */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 relative">
                
                {/* Style override inject for P&ID animated pipelines */}
                <style dangerouslySetInnerHTML={{__html: `
                  @keyframes dash {
                    to {
                      stroke-dashoffset: -20;
                    }
                  }
                  .animate-dash {
                    animation: dash 1.5s linear infinite;
                  }
                `}} />

                {/* 1. Process Flow Animation Cascade */}
                <div className="bg-[#1E2022] border border-[#303337] rounded-lg p-5 flex flex-col justify-between h-[270px] relative">
                  {/* Corner Rivet Details */}
                  <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-[#303337]/50"></div>
                  <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#303337]/50"></div>
                  <div className="absolute bottom-2 left-2 w-1.5 h-1.5 rounded-full bg-[#303337]/50"></div>
                  <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-[#303337]/50"></div>

                  <div className="flex justify-between items-center border-b border-[#303337] pb-2 mb-3">
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">
                      DYNAMIC THERMAL CASCADE FLOW
                    </span>
                    <span className="text-[8px] font-mono text-emerald-400">ACTIVE FLOW</span>
                  </div>

                  <div className="relative border border-[#303337] bg-[#121314] rounded p-3 h-48 flex flex-col justify-between overflow-hidden">
                    {/* Stage 1: High-Temp ORC */}
                    <div className="flex justify-between items-center bg-[#1E2022] border border-[#303337] px-2 py-1 rounded relative z-10">
                      <div>
                        <span className="text-[8px] font-mono text-slate-500 uppercase block">Stage 01 Recovery</span>
                        <span className="text-[10px] font-bold text-white">ORC Power Loop</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-mono text-red-500 font-bold block">300°C → 200°C</span>
                      </div>
                    </div>

                    {/* Animated arrow lines */}
                    <div className="h-4 flex justify-center items-center relative">
                      <div className="w-0.5 h-full bg-[#D97706]/40 relative">
                        <div className="absolute top-0 w-1.5 h-1.5 rounded-full bg-[#D97706] left-[-2.5px] animate-bounce"></div>
                      </div>
                    </div>

                    {/* Stage 2: Feedwater Economizer */}
                    <div className="flex justify-between items-center bg-[#1E2022] border border-[#303337] px-2 py-1 rounded relative z-10">
                      <div>
                        <span className="text-[8px] font-mono text-slate-500 uppercase block">Stage 02 Recovery</span>
                        <span className="text-[10px] font-bold text-white">Economizer Feedwater</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-mono text-amber-500 font-bold block">200°C → 155°C</span>
                      </div>
                    </div>

                    {/* Animated arrow lines */}
                    <div className="h-4 flex justify-center items-center relative">
                      <div className="w-0.5 h-full bg-[#2563EB]/40 relative">
                        <div className="absolute top-0 w-1.5 h-1.5 rounded-full bg-[#2563EB] left-[-2.5px] animate-bounce"></div>
                      </div>
                    </div>

                    {/* Terminal Safety stop */}
                    <div className="bg-[#2C1D1E] border border-[#DC2626]/30 px-2 py-1 rounded flex justify-between items-center z-10">
                      <div>
                        <span className="text-[8px] font-mono text-slate-500 uppercase block">Terminal Output</span>
                        <span className="text-[10px] font-bold text-red-500">Terminal Exhaust Limit</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono font-bold text-white">155°C LIMIT</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Environmental Carbon Audit Ledger */}
                <div className="bg-[#1E2022] border border-[#303337] rounded-lg p-5 flex flex-col justify-between h-[270px] relative">
                  {/* Corner Rivet Details */}
                  <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-[#303337]/50"></div>
                  <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#303337]/50"></div>
                  <div className="absolute bottom-2 left-2 w-1.5 h-1.5 rounded-full bg-[#303337]/50"></div>
                  <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-[#303337]/50"></div>

                  <div>
                    <div className="flex justify-between items-start border-b border-[#303337] pb-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider font-sans">
                          ENVIRONMENTAL CARBON AUDIT LEDGER
                        </span>
                      </div>
                    </div>

                    {/* Blinking telemetry status badge */}
                    <div className="mb-3 flex justify-between items-center">
                      <span className="text-[8px] text-slate-500 font-mono font-bold">EMISSION CONVERTER READOUT</span>
                      <span className="text-[9px] font-mono bg-[#162A20] text-[#10B981] border border-[#14532D] px-2 py-0.5 rounded font-bold animate-pulse">
                        [STATUS: {((5135.36 * (calculatedData.thermalRecoveryKw || 1200)) / 1200).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MT-CO2/YR ABATED]
                      </span>
                    </div>

                    {/* Mass Balance Calculations HUD grid */}
                    <div className="space-y-2 font-mono text-xs bg-[#121314] border border-[#303337] p-2.5 rounded">
                      <div className="flex justify-between items-center border-b border-[#202225] pb-1.5">
                        <span className="text-[9px] text-slate-500 uppercase">Hourly Carbon Offset Rate (E_co2)</span>
                        <span className="text-white font-bold">
                          {((641.92 * (calculatedData.thermalRecoveryKw || 1200)) / 1200).toFixed(2)} kg/hr
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-0.5">
                        <span className="text-[9px] text-slate-500 uppercase">Annual Plant Carbon Abatement</span>
                        <span className="text-emerald-400 font-bold">
                          {((5135.36 * (calculatedData.thermalRecoveryKw || 1200)) / 1200).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MT/Yr
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Micro text baseline footer */}
                  <div className="text-[8px] text-slate-500 border-t border-[#303337] pt-2 mt-2 leading-relaxed">
                    Computed at a baseline factor of 1.83 kg of CO2 suppressed per 1.0 kg of industrial coal fuel mass reduction. (Standard 8,000-hr oper. index).
                  </div>

                  {/* Directional data pipeline connector pointing to ESCert Transactions */}
                  <div className="hidden xl:block absolute top-1/2 -right-4 translate-y-[-50%] z-20 pointer-events-none">
                    <svg className="w-8 h-8" viewBox="0 0 32 32">
                      <path
                        d="M 2,16 L 26,16"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3"
                        strokeDasharray="4 2"
                        className="animate-dash"
                      />
                      <polygon points="24,11 30,16 24,21" fill="#10b981" />
                    </svg>
                  </div>
                </div>

                {/* 3. Transaction Ledger with live sparkline */}
                <div className="bg-[#1E2022] border border-[#303337] rounded-lg p-5 flex flex-col justify-between h-[270px] relative">
                  {/* Corner Rivet Details */}
                  <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-[#303337]/50"></div>
                  <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#303337]/50"></div>
                  <div className="absolute bottom-2 left-2 w-1.5 h-1.5 rounded-full bg-[#303337]/50"></div>
                  <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-[#303337]/50"></div>

                  <div>
                    <div className="flex justify-between items-center border-b border-[#303337] pb-2 mb-3">
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">
                        REGULATORY ESCERT TRANSACTIONS
                      </span>
                      <span className="text-[8px] font-mono text-amber-500 uppercase">Cycle Live Index</span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase block leading-tight">Market Floor price</span>
                          <span className="text-sm font-bold text-white font-mono">1,840 INR</span>
                        </div>
                        
                        {/* Live sparkline index chart */}
                        <div className="bg-[#121314] border border-[#303337] rounded p-1 flex items-center justify-center">
                          <svg className="w-28 h-6" viewBox="0 0 140 30">
                            <polyline
                              fill="none"
                              stroke="#D97706"
                              strokeWidth="1.5"
                              points={renderSparkline(sparklineData)}
                            />
                          </svg>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="bg-[#121314] p-2 rounded border border-[#303337]">
                          <span className="text-[8px] text-slate-500 block uppercase">Projected Yield</span>
                          <span className="text-white font-bold block">{calculatedData.thermalRecoveryKw || 0} kW</span>
                        </div>
                        <div className="bg-[#121314] p-2 rounded border border-[#303337]">
                          <span className="text-[8px] text-slate-500 block uppercase">ESCert Generation</span>
                          <span className="text-emerald-400 font-bold block">
                            {Math.round((calculatedData.thermalRecoveryKw || 0) * 7.2).toLocaleString()} toe/yr
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[9px] text-slate-550 border-t border-[#303337] pt-2 mt-2 font-mono">
                    Ledger entries are tracked dynamically per plant based on BEE and ESCert standard market pricing.
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 flex flex-col items-center justify-center border border-dashed border-[#303337] rounded-lg bg-[#121314] p-12 text-center h-[500px]">
              <div className="text-4xl mb-4">⚙️</div>
              <h3 className="text-base font-bold text-slate-300 uppercase tracking-wider">Awaiting Control Room Telemetry</h3>
              <p className="text-slate-500 text-xs max-w-sm mt-2 leading-relaxed">
                Please configure the primary flue gas temperature and compliance boundaries on the left control hook panel to run the statutory compliance simulation.
              </p>
            </div>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-[#1E2022] border-t border-[#303337] py-3 px-6 text-center text-[10px] text-slate-500 font-mono-inst">
        PATShield HMI Console Terminal // Registered BEE Designated Consumer Module // Security Gated System
      </footer>

    </div>
  );
}
