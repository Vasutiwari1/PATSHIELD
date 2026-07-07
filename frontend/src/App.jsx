import React, { useState } from 'react';
import CostOfInaction from './components/CostOfInaction';
import TechSizing from './components/TechSizing';
import LoadSimulation from './components/LoadSimulation';

export default function App() {
  const [calculatedData, setCalculatedData] = useState(null);
  const [activeTab, setActiveTab] = useState('cost');
  
  // Simulation states
  const [subscriptionTier, setSubscriptionTier] = useState('free'); // free, active-paid, expired

  // Form states
  const [industryType, setIndustryType] = useState('Steel');
  const [annualEnergy, setAnnualEnergy] = useState(6000);
  const [currentSec, setCurrentSec] = useState(0.60);
  const [production, setProduction] = useState(10000);
  
  // Target SEC customization
  const [overrideTarget, setOverrideTarget] = useState(false);
  const [customTargetSec, setCustomTargetSec] = useState(0.12);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default target norms per sector for the PAT scheme calculation
  const sectorDefaults = {
    Textile: 0.35,
    Steel: 0.12,
    Cement: 0.075,
    Chemical: 0.22,
    Refinery: 0.32,
    Other: 0.28
  };

  // Sync custom target value if sector changes and override is not active
  const handleSectorChange = (sector) => {
    setIndustryType(sector);
    if (!overrideTarget) {
      setCustomTargetSec(sectorDefaults[sector] || 0.30);
    }
  };

  const handleOverrideToggle = (checked) => {
    setOverrideTarget(checked);
    if (checked) {
      setCustomTargetSec(sectorDefaults[industryType] || 0.30);
    }
  };

  const handleAnalyze = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Mock API call to represent backend or run logic locally
    setTimeout(() => {
      const targetSec = overrideTarget ? customTargetSec : (sectorDefaults[industryType] || (currentSec * 0.95));
      const secShortfall = Math.max(0, currentSec - targetSec);
      const annualShortfall = secShortfall * production;
      const cumulativeShortfall = annualShortfall * 3;
      const fixedPenalty = 1000000;
      const variablePenalty = cumulativeShortfall * 1840;
      const totalPenaltyLakh = (fixedPenalty + variablePenalty) / 100000.0;

      setCalculatedData({
        industryType,
        annualEnergy,
        currentSec,
        production,
        targetSec,
        penaltyLakh: parseFloat(totalPenaltyLakh.toFixed(2)),
        estimated_penalty_lakh: parseFloat(totalPenaltyLakh.toFixed(2)),
        headline: `If this trend continues, your plant carries an estimated ${totalPenaltyLakh.toFixed(2)} Lakh PAT penalty risk by the end of the next compliance cycle.`
      });
      setIsSubmitting(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 py-4 px-8 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-lg shadow-md">
            🛡️
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white leading-none">PATShield</h1>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              Industrial WHR & Compliance MVP
            </span>
          </div>
        </div>

        {/* Demo control switches */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Simulation Tier:</span>
          <select 
            value={subscriptionTier}
            onChange={(e) => setSubscriptionTier(e.target.value)}
            className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="free">Free Zone (Paywalled)</option>
            <option value="active-paid">Active Paid (Unlocked)</option>
            <option value="expired">Expired (Gated)</option>
          </select>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Input Form Panel */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit shadow-xl space-y-5">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
              BEE Plant Assessor
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Enter plant parameters via sliders or numerical inputs below.
            </p>
          </div>

          <form onSubmit={handleAnalyze} className="space-y-4">
            {/* Industry Type */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Industry Sector</label>
              <select
                value={industryType}
                onChange={(e) => handleSectorChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Steel">Steel</option>
                <option value="Cement">Cement</option>
                <option value="Textile">Textile</option>
                <option value="Chemical">Chemical</option>
                <option value="Refinery">Refinery</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Annual Energy Consumption (toe) */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400">Annual Energy (toe)</span>
                <input
                  type="number"
                  value={annualEnergy}
                  onChange={(e) => setAnnualEnergy(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-right text-white font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <input
                type="range"
                min="100"
                max="50000"
                step="100"
                value={annualEnergy}
                onChange={(e) => setAnnualEnergy(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Current SEC */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400">Current SEC (toe/unit)</span>
                <input
                  type="number"
                  step="0.001"
                  value={currentSec}
                  onChange={(e) => setCurrentSec(Math.max(0.001, parseFloat(e.target.value) || 0))}
                  className="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-right text-white font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <input
                type="range"
                min="0.010"
                max="2.500"
                step="0.005"
                value={currentSec}
                onChange={(e) => setCurrentSec(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Production Output */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400">Annual Production (units)</span>
                <input
                  type="number"
                  value={production}
                  onChange={(e) => setProduction(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-right text-white font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <input
                type="range"
                min="1000"
                max="100000"
                step="500"
                value={production}
                onChange={(e) => setProduction(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Custom Target SEC Norm Override */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-3 space-y-2">
              <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideTarget}
                  onChange={(e) => handleOverrideToggle(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
                Override statutory SEC target
              </label>

              {overrideTarget ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Target SEC Norm</span>
                    <input
                      type="number"
                      step="0.001"
                      value={customTargetSec}
                      onChange={(e) => setCustomTargetSec(Math.max(0.001, parseFloat(e.target.value) || 0))}
                      className="w-20 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-right text-white font-semibold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <input
                    type="range"
                    min="0.005"
                    max="2.000"
                    step="0.005"
                    value={customTargetSec}
                    onChange={(e) => setCustomTargetSec(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 leading-normal">
                  Currently using BEE baseline target norm of <span className="font-semibold text-emerald-400">{sectorDefaults[industryType] || 0.30} toe/unit</span> for the {industryType} sector.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2.5 px-4 rounded text-sm transition-all focus:outline-none shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Calculating...' : 'Analyze Compliance Penalty Risk'}
            </button>
          </form>

          {/* Simple informational footnote in sidebar */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-4 mt-6 text-[10px] text-slate-500 leading-relaxed">
            Statutory baseline targets align with Bureau of Energy Efficiency norms under the Energy Conservation Act, 2001. Penalty calculations are updated in real-time.
          </div>
        </div>

        {/* Right Dashboard Column (Conditional Render) */}
        {calculatedData ? (
          <div className="lg:col-span-2 space-y-6">
            
            {/* Urgency Alert Banner at the very top of main body (Section 2 Output) */}
            {calculatedData && (
              <div className="w-full bg-gradient-to-r from-red-950 via-slate-950 to-red-950 border-2 border-red-500 rounded-xl p-6 text-center shadow-2xl mb-6 animate-pulse">
                <span className="text-xs font-black text-red-400 uppercase tracking-widest block mb-2">
                  ⚠️ CRITICAL COMPLIANCE LIABILITY IDENTIFIED
                </span>
                <h2 className="text-4xl font-black text-red-500 tracking-tight my-2">
                  INR {calculatedData.estimated_penalty_lakh || "186.64"} Lakh
                </h2>
                <p className="text-slate-300 text-sm max-w-xl mx-auto font-medium mt-2">
                  If this trend continues, your plant carries this estimated PAT penalty risk by the end of the next compliance cycle.
                </p>
              </div>
            )}

            {/* Tabbed Premium Dashboard Area (Enclosed inside relative container for clean blur overlay) */}
            <div className="relative border border-slate-800 rounded-xl p-6 bg-slate-900 shadow-xl overflow-hidden min-h-[500px]">
              
              {/* Paywall Blur Mask Overlay for Free/Expired Tiers */}
              {subscriptionTier !== 'active-paid' && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[6px] z-50 flex flex-col items-center justify-center p-8 text-center">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-red-500"></div>
                    
                    <div className="text-4xl mb-4">🔒</div>
                    
                    {subscriptionTier === 'free' ? (
                      <>
                        <h3 className="text-xl font-bold text-white mb-2">Premium Compliance Dashboard Locked</h3>
                        <p className="text-slate-400 text-xs leading-relaxed mb-6">
                          You have unlocked the landing page urgency shortfall calculation. Upgrade to Premium to see the 3-year cost of inaction timelines, WHR thermodynamic Recommendations, and Bypass installation blueprints.
                        </p>
                        <button 
                          onClick={() => setSubscriptionTier('active-paid')}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 px-6 rounded-lg text-xs tracking-wide uppercase transition-all shadow-md hover:scale-[1.02]"
                        >
                          Upgrade to Active Paid Subscription
                        </button>
                      </>
                    ) : (
                      <>
                        <h3 className="text-xl font-bold text-red-400 mb-2">Subscription Expired</h3>
                        <p className="text-slate-400 text-xs leading-relaxed mb-6">
                          Your enterprise access subscription has expired. Re-authorize payment credentials to unlock live load simulations and continuous SEC tracking logs.
                        </p>
                        <button 
                          onClick={() => setSubscriptionTier('active-paid')}
                          className="bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-6 rounded-lg text-xs tracking-wide uppercase transition-all shadow-md hover:scale-[1.02]"
                        >
                          Renew Subscription
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Dashboard Tabs */}
              <div className="bg-slate-950 border border-slate-850 p-1.5 rounded-lg flex gap-1 w-fit mb-6">
                <button
                  onClick={() => setActiveTab('cost')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${
                    activeTab === 'cost' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cost of Inaction
                </button>
                <button
                  onClick={() => setActiveTab('sizing')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${
                    activeTab === 'sizing' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sizing & Metallurgy
                </button>
                <button
                  onClick={() => setActiveTab('load')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${
                    activeTab === 'load' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Bypass & Load Simulation
                </button>
              </div>

              {/* Sub-component views */}
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
                        cumulativeShortfallToe: (Math.max(0, calculatedData.currentSec - (calculatedData.currentSec - calculatedData.targetSec) * 0.33) * calculatedData.production) + (Math.max(0, calculatedData.currentSec - (calculatedData.currentSec - (calculatedData.currentSec - calculatedData.targetSec) * 0.66)) * calculatedData.production),
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

          </div>
        ) : (
          <div className="lg:col-span-2 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-950/30 p-12 text-center h-[500px]">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-bold text-slate-300">Awaiting Plant Metrics</h3>
            <p className="text-slate-500 text-sm max-w-sm mt-1">
              Please enter your industry type and energy parameters on the left panel to execute the statutory PAT penalty assessment.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/40 border-t border-slate-900 py-4 px-8 text-center text-xs text-slate-500">
        PATShield Industrial Compliance Analytics Platform. All calculations align with Bureau of Energy Efficiency statutory frameworks.
      </footer>

    </div>
  );
}
