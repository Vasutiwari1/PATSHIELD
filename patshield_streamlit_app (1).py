"""
PATShield v2 — AI-Enhanced WHR Feasibility Dashboard (Streamlit port)

Rule-based sizing engine (ported from the original calculations.py / HTML
dashboard) + explainable AI scoring layer (data quality, Monte-Carlo
uncertainty, literature/real-plant benchmark validation).

Run with:
    streamlit run patshield_streamlit_app.py
"""

import math
import random

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

# ============================================================
# PAGE CONFIG + THEME
# ============================================================
st.set_page_config(
    page_title="PATShield v2 — AI-Enhanced WHR Feasibility Dashboard",
    page_icon="🛡️",
    layout="wide",
)

BG = "#10161B"
PANEL = "#171F26"
PANEL_2 = "#1D262E"
LINE = "#2A343C"
INK = "#E7EDF1"
INK_DIM = "#9AACB6"
INK_FAINT = "#64757F"
AMBER = "#F2A93B"
AMBER_DIM = "#C98A2E"
TEAL = "#57C2C2"
GREEN = "#6FCF97"
RED = "#E8735F"
YELLOW = "#F2C94C"

st.markdown(
    f"""
    <style>
      .stApp {{ background-color: {BG}; color: {INK}; }}
      section[data-testid="stSidebar"] {{ background-color: {PANEL}; border-right: 1px solid {LINE}; }}
      h1, h2, h3, h4, h5, p, span, div, label {{ color: {INK}; }}
      .card {{
        background: {PANEL}; border: 1px solid {LINE}; border-radius: 10px;
        padding: 16px 18px; margin-bottom: 16px;
      }}
      .card h3 {{
        margin: 0 0 12px; font-size: 13px; color: {INK_DIM}; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.04em;
      }}
      .kpi-big {{ font-family: 'IBM Plex Mono', monospace; font-size: 24px; font-weight: 700; color:{INK}; }}
      .kpi-cap {{ font-size: 11.5px; color: {INK_FAINT}; margin-top: 4px; }}
      .note {{ font-size: 12.5px; color: {INK_FAINT}; line-height: 1.6; margin-top: 10px; }}
      .pill {{ display:inline-block; padding:3px 10px; border-radius:20px; font-size:11.5px; font-family: monospace; }}
      .pill-pass {{ background: rgba(111,207,151,0.15); color:{GREEN}; }}
      .pill-warn {{ background: rgba(242,201,76,0.15); color:{YELLOW}; }}
      .pill-fail {{ background: rgba(232,115,95,0.15); color:{RED}; }}
      .methodology-box {{
        border:1px dashed {LINE}; border-radius:10px; padding:14px 16px; font-size:12.5px;
        color:{INK_FAINT}; line-height:1.6; margin-top:8px;
      }}
      .verdict-banner {{
        border-radius:10px; padding:20px 22px; margin-bottom:22px; border:1px solid {LINE}; background:{PANEL};
      }}
      .dq-item {{ display:flex; justify-content:space-between; font-size:12.5px; padding:6px 0; border-bottom:1px solid {LINE}; }}
      div[data-baseweb="tab-list"] {{ gap: 2px; }}
    </style>
    """,
    unsafe_allow_html=True,
)

PLOTLY_LAYOUT = dict(
    paper_bgcolor=PANEL,
    plot_bgcolor=PANEL,
    font=dict(color=INK_DIM, family="IBM Plex Sans, sans-serif"),
    margin=dict(l=40, r=20, t=30, b=40),
    legend=dict(orientation="h", yanchor="bottom", y=-0.3),
)
GRID_COLOR = "#232E36"


# ============================================================
# ENGINE (ported from calculations.py + AI scoring layer)
# ============================================================
RANGES = {
    "wasteTempC": dict(min=90, max=900, typicalMin=120, typicalMax=600),
    "massFlowKgS": dict(min=0.2, max=300, typicalMin=1, typicalMax=80),
    "sulfurPct": dict(min=0, max=6, typicalMin=0, typicalMax=3),
    "footprintSqm": dict(min=1, max=5000, typicalMin=10, typicalMax=800),
    "boilerLoadPct": dict(min=20, max=110, typicalMin=50, typicalMax=100),
    "fuelPriceInrKwh": dict(min=1, max=12, typicalMin=2.5, typicalMax=7),
    "electricityPriceInrKwh": dict(min=3, max=15, typicalMin=5, typicalMax=11),
    "escertPriceInr": dict(min=500, max=4000, typicalMin=1200, typicalMax=2400),
}

BENCHMARKS = {
    "Economizer": dict(paybackMin=1.5, paybackMax=4.0, capexPerKwMin=10000, capexPerKwMax=22000),
    "WHRB": dict(paybackMin=1.7, paybackMax=5.0, capexPerKwMin=18000, capexPerKwMax=35000),
    "ORC": dict(paybackMin=3.0, paybackMax=8.0, capexPerKwMin=45000, capexPerKwMax=80000),
}

GRID_EF = 0.71   # kgCO2/kWh, India grid average
FUEL_EF = 2.5    # tCO2e per toe saved

SECTOR_SEC_DEFAULTS = {
    "Textile": 0.35, "Steel": 0.12, "Cement": 0.075,
    "Chemical": 0.22, "Refinery": 0.32, "Other": 0.28,
}


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def calculate_lmtd(t_in_hot, t_out_hot, t_in_cold, t_out_cold):
    dt1 = t_in_hot - t_out_cold
    dt2 = t_out_hot - t_in_cold
    if dt1 <= 0 or dt2 <= 0:
        return max(1.0, 0.5 * ((t_in_hot - t_in_cold) + (t_out_hot - t_out_cold)))
    if abs(dt1 - dt2) < 1e-5:
        return dt1
    return (dt1 - dt2) / math.log(dt1 / dt2)


def get_tech_params(tech):
    t = {
        "Economizer": dict(tOut=150, uCoeff=0.05, costPerKw=15000, tColdIn=80, tColdOut=130),
        "WHRB": dict(tOut=180, uCoeff=0.04, costPerKw=25000, tColdIn=190, tColdOut=200),
        "ORC": dict(tOut=80, uCoeff=0.03, costPerKw=60000, tColdIn=40, tColdOut=75),
    }
    return t[tech]


def derate_efficiency(design_eff, load_pct):
    if load_pct >= 100:
        return design_eff
    drop = (100 - load_pct) * 0.002333
    return max(0.40, design_eff - drop)


def evaluate_technology_options(inp):
    waste_temp_c = inp["wasteTempC"]
    mass_flow_kg_s = inp["massFlowKgS"]
    sulfur_pct = inp["sulfurPct"]
    footprint_sqm = inp["footprintSqm"]
    boiler_load_pct = inp.get("boilerLoadPct", 100)
    escert_price_inr = inp.get("escertPriceInr", 1840)
    thermal_fuel_cost = inp.get("thermalFuelCostInrKwh", 4.5)
    electricity_cost = inp.get("electricityCostInrKwh", 7.5)

    cp_gas, operating_hours, boiler_eff, orc_eff = 1.05, 7200, 0.80, 0.12
    load_factor = boiler_load_pct / 100
    eff_flow = mass_flow_kg_s * load_factor
    load_derate = derate_efficiency(1.0, boiler_load_pct)

    techs = []
    if 90 <= waste_temp_c <= 150:
        techs.append("ORC")
    if 200 <= waste_temp_c <= 350:
        techs.append("Economizer")
    if 400 <= waste_temp_c <= 800:
        techs.append("WHRB")
    if not techs:
        if 150 < waste_temp_c < 200:
            techs.extend(["ORC", "Economizer"])
        elif 350 < waste_temp_c < 400:
            techs.extend(["Economizer", "WHRB"])
        elif waste_temp_c > 800:
            techs.append("WHRB")

    metallurgy = "Stainless Steel (SS316)" if sulfur_pct > 0.5 else "Carbon Steel"
    recs = []
    for tech in techs:
        p = get_tech_params(tech)
        t_out = p["tOut"]
        if waste_temp_c <= t_out:
            t_out = waste_temp_c - 10
        dt = waste_temp_c - t_out
        q_dot_design = mass_flow_kg_s * cp_gas * dt
        q_dot = eff_flow * cp_gas * dt * load_derate
        lmtd = calculate_lmtd(waste_temp_c, t_out, p["tColdIn"], p["tColdOut"])
        area_sqm = q_dot_design / (p["uCoeff"] * lmtd)
        required_footprint = area_sqm / 4.0
        footprint_feasible = required_footprint <= footprint_sqm

        equip_capex = q_dot_design * p["costPerKw"]
        ducting_capex = equip_capex * 0.15
        fans_capex = equip_capex * 0.10
        install_capex = equip_capex * 0.20
        total_capex = equip_capex + ducting_capex + fans_capex + install_capex

        if tech == "ORC":
            elec_kwh = q_dot * orc_eff * operating_hours
            annual_savings = elec_kwh * electricity_cost
            saved_toe = elec_kwh / 11630.0
        else:
            therm_kwh = (q_dot * operating_hours) / boiler_eff
            annual_savings = therm_kwh * thermal_fuel_cost
            saved_toe = therm_kwh / 11630.0

        escert_val = saved_toe * escert_price_inr
        total_benefit = annual_savings + escert_val
        payback_years = total_capex / total_benefit if total_benefit > 0 else float("inf")

        co2_fuel = co2_grid = 0
        if tech == "ORC":
            elec_kwh = q_dot * orc_eff * operating_hours
            co2_grid = (elec_kwh * GRID_EF) / 1000
        else:
            co2_fuel = saved_toe * FUEL_EF

        recs.append(dict(
            technology=tech, capacityKw=q_dot, designCapacityKw=q_dot_design,
            heatTransferAreaSqm=area_sqm, requiredFootprintSqm=required_footprint,
            footprintFeasible=footprint_feasible, metallurgy=metallurgy,
            capex=dict(equipment=equip_capex, ducting=ducting_capex, fans=fans_capex,
                       install=install_capex, total=total_capex),
            annualSavingsInr=annual_savings, annualEscertValueInr=escert_val,
            totalAnnualBenefitInr=total_benefit, paybackYears=payback_years,
            savedToeAnnual=saved_toe, co2AvoidedTco2eAnnual=co2_fuel + co2_grid,
            capexPerKw=total_capex / (q_dot_design or 1),
        ))
    return dict(techOptions=techs, metallurgy=metallurgy, recommendations=recs)


def assess_data_quality(inputs, touched):
    fields = list(RANGES.keys())
    plaus_sum = comp_sum = 0
    details = []
    for f in fields:
        r = RANGES[f]
        v = inputs[f]
        in_hard = r["min"] <= v <= r["max"]
        in_typ = r["typicalMin"] <= v <= r["typicalMax"]
        plaus = 100 if in_typ else (60 if in_hard else 15)
        is_touched = bool(touched.get(f))
        plaus_sum += plaus
        comp_sum += 100 if is_touched else 55
        details.append(dict(field=f, value=v, plausibility=plaus, provided=is_touched, inTypicalRange=in_typ))
    plausibility_score = plaus_sum / len(fields)
    completeness_score = comp_sum / len(fields)
    return dict(
        dataQualityScore=0.6 * plausibility_score + 0.4 * completeness_score,
        plausibilityScore=plausibility_score, completenessScore=completeness_score, details=details,
    )


def sensitivity_analysis(inputs, best_tech, base_payback):
    variables = [
        ("wasteTempC", "Waste Temperature"), ("boilerLoadPct", "Boiler Load"),
        ("thermalFuelCostInrKwh", "Fuel Price"), ("electricityCostInrKwh", "Electricity Price"),
        ("massFlowKgS", "Mass Flow Rate"),
    ]
    rows = []
    for key, label in variables:
        lo_inputs = {**inputs, key: inputs[key] * 0.8}
        hi_inputs = {**inputs, key: inputs[key] * 1.2}
        lo_res = next((r for r in evaluate_technology_options(lo_inputs)["recommendations"] if r["technology"] == best_tech), None)
        hi_res = next((r for r in evaluate_technology_options(hi_inputs)["recommendations"] if r["technology"] == best_tech), None)
        lo_p = lo_res["paybackYears"] if lo_res else base_payback
        hi_p = hi_res["paybackYears"] if hi_res else base_payback
        rows.append(dict(label=label, key=key, low=lo_p, base=base_payback, high=hi_p, swing=abs(hi_p - lo_p)))
    rows.sort(key=lambda r: r["swing"], reverse=True)
    return rows


def monte_carlo_uncertainty(inputs, best_tech, iterations=800, seed=None):
    stdev = dict(wasteTempC=0.06, boilerLoadPct=0.08, thermalFuelCostInrKwh=0.12,
                 electricityCostInrKwh=0.10, massFlowKgS=0.10, sulfurPct=0.15)
    rng = random.Random(seed)
    paybacks, savings = [], []
    for _ in range(iterations):
        s = dict(inputs)
        for k, sd in stdev.items():
            base = inputs[k]
            noise = 1 + rng.gauss(0, 1) * sd
            s[k] = max(base * 0.4, base * noise)
        r = next((x for x in evaluate_technology_options(s)["recommendations"] if x["technology"] == best_tech), None)
        if r and math.isfinite(r["paybackYears"]):
            paybacks.append(r["paybackYears"])
            savings.append(r["totalAnnualBenefitInr"])
    paybacks.sort()
    savings.sort()

    def pct(arr, p):
        if not arr:
            return 0
        idx = int(clamp(p, 0, 0.999) * len(arr))
        return arr[idx]

    median, p10, p90 = pct(paybacks, 0.5), pct(paybacks, 0.1), pct(paybacks, 0.9)
    spread = (p90 - p10) / median if median > 0 else 1
    uncertainty_confidence = clamp(100 * (1 - clamp(spread / 1.5, 0, 1)), 0, 100)
    return dict(
        paybackP10=p10, paybackP50=median, paybackP90=p90,
        savingsP10=pct(savings, 0.1), savingsP50=pct(savings, 0.5), savingsP90=pct(savings, 0.9),
        uncertaintyConfidence=uncertainty_confidence, spread=spread, rawPaybacks=paybacks,
    )


def validate_against_benchmarks(best):
    if not best:
        return dict(status="fail", notes=["No feasible technology found for given inputs."])
    b = BENCHMARKS[best["technology"]]
    notes = []
    status = "pass"
    if best["paybackYears"] < b["paybackMin"]:
        status = "warn"
        notes.append(
            f"Computed payback ({best['paybackYears']:.2f} yr) is faster than the typical published range for "
            f"{best['technology']} ({b['paybackMin']}–{b['paybackMax']} yr) — double-check flow, price, and "
            f"operating-hours inputs against metered data."
        )
    elif best["paybackYears"] > b["paybackMax"]:
        status = "warn"
        notes.append(
            f"Computed payback ({best['paybackYears']:.2f} yr) exceeds the typical published range for "
            f"{best['technology']} ({b['paybackMin']}–{b['paybackMax']} yr) — economics may be marginal."
        )
    else:
        notes.append(
            f"Computed payback ({best['paybackYears']:.2f} yr) falls within the typical published range for "
            f"{best['technology']} ({b['paybackMin']}–{b['paybackMax']} yr)."
        )
    if best["capexPerKw"] < b["capexPerKwMin"] * 0.7 or best["capexPerKw"] > b["capexPerKwMax"] * 1.3:
        status = "fail" if status == "fail" else "warn"
        notes.append(
            f"Capex intensity (₹{round(best['capexPerKw']):,}/kW) sits outside the typical "
            f"₹{b['capexPerKwMin']:,}–₹{b['capexPerKwMax']:,}/kW band for {best['technology']}."
        )
    if not best["footprintFeasible"]:
        status = "fail"
        notes.append("Required heat-exchanger footprint exceeds the space you indicated is available.")
    return dict(status=status, notes=notes)


def compute_recommendation(best, data_quality, monte_carlo, validation):
    if not best:
        return dict(verdict="Not Recommended", score=0,
                     reasons=["No WHR technology matches the given waste-heat temperature."], breakdown=None)
    payback_score = clamp(100 * (1 - (best["paybackYears"] - 1) / 7), 0, 100)
    footprint_score = 100 if best["footprintFeasible"] else 0
    validation_score = 100 if validation["status"] == "pass" else (55 if validation["status"] == "warn" else 10)
    confidence_score = 0.5 * data_quality["dataQualityScore"] + 0.5 * monte_carlo["uncertaintyConfidence"]
    w = dict(payback=0.35, footprint=0.15, validation=0.20, confidence=0.30)
    feasibility_score = (w["payback"] * payback_score + w["footprint"] * footprint_score
                          + w["validation"] * validation_score + w["confidence"] * confidence_score)
    reasons = []
    if not best["footprintFeasible"] or validation["status"] == "fail":
        verdict = "Not Recommended"
        reasons.append("A hard constraint failed — footprint fit or benchmark validation.")
    elif feasibility_score >= 68 and confidence_score >= 55:
        verdict = "Proceed"
        reasons.append("Strong payback, plausible inputs, and benchmark-consistent economics.")
    elif feasibility_score >= 42 or confidence_score < 55:
        verdict = "More Data Required"
        if confidence_score < 55:
            reasons.append(
                "Input data quality / measurement uncertainty is too high for a confident call — use metered "
                "(not estimated) waste-heat temperature and flow."
            )
        if feasibility_score < 68:
            reasons.append("Economics are borderline; a tighter energy audit would sharpen the payback estimate.")
    else:
        verdict = "Not Recommended"
        reasons.append("Payback and/or validation checks indicate weak economics at current inputs.")
    return dict(verdict=verdict, score=feasibility_score,
                breakdown=dict(paybackScore=payback_score, footprintScore=footprint_score,
                                validationScore=validation_score, confidenceScore=confidence_score, w=w),
                reasons=reasons)


# ============================================================
# FORMATTING HELPERS
# ============================================================
def fmt_inr(n):
    return "₹" + f"{round(n):,}"


def fmt_inr_short(n):
    if abs(n) >= 10_000_000:
        return f"₹{n/10_000_000:.2f} Cr"
    if abs(n) >= 100_000:
        return f"₹{n/100_000:.2f} L"
    return fmt_inr(n)


def fmt_num(n, d=1):
    return f"{n:,.{d}f}"


def verdict_colors(v):
    if v == "Proceed":
        return GREEN, "rgba(111,207,151,0.14)"
    if v == "More Data Required":
        return YELLOW, "rgba(242,201,76,0.14)"
    return RED, "rgba(232,115,95,0.14)"


# ============================================================
# SESSION STATE / DEFAULTS
# ============================================================
DEFAULTS = dict(
    industry="Cement", wasteTempC=420.0, massFlowKgS=8.5, boilerLoadPct=85, sulfurPct=0.3,
    footprintSqm=200, fuelPrice=4.5, elecPrice=7.5, escert=1840, sec=0.09, prod=120000,
)
DEFAULT_TOUCHED = dict(
    wasteTempC=True, massFlowKgS=True, sulfurPct=False, footprintSqm=True, boilerLoadPct=True,
    fuelPriceInrKwh=True, electricityPriceInrKwh=False, escertPriceInr=False,
)

if "touched" not in st.session_state:
    st.session_state.touched = dict(DEFAULT_TOUCHED)
for k, v in DEFAULTS.items():
    st.session_state.setdefault(k, v)


def mark_touched(field):
    def _cb():
        st.session_state.touched[field] = True
    return _cb


# Fields that are driven by the RANGES table (used for the data-quality score).
# field_key: state key holding the value used by the engine
# touched_key: key in st.session_state.touched to flip when the user edits it
RANGE_FIELD_MAP = {
    "wasteTempC": "wasteTempC",
    "massFlowKgS": "massFlowKgS",
    "boilerLoadPct": "boilerLoadPct",
    "sulfurPct": "sulfurPct",
    "footprintSqm": "footprintSqm",
    "fuelPrice": "fuelPriceInrKwh",
    "elecPrice": "electricityPriceInrKwh",
    "escert": "escertPriceInr",
}


def synced_field(label, field_key, min_v, max_v, step, touched_key=None, number_format="%.2f", help=None):
    """Render a slider + a manual number input side by side, kept in sync via
    a shared session_state value (`field_key`). Editing either one updates the
    other and marks the field as 'touched' for the data-quality score."""
    slider_key = f"{field_key}_slider"
    input_key = f"{field_key}_input"

    if field_key not in st.session_state:
        st.session_state[field_key] = DEFAULTS[field_key]
    if slider_key not in st.session_state:
        st.session_state[slider_key] = st.session_state[field_key]
    if input_key not in st.session_state:
        st.session_state[input_key] = st.session_state[field_key]

    def _touch():
        if touched_key:
            st.session_state.touched[touched_key] = True

    def _on_slider_change():
        v = st.session_state[slider_key]
        st.session_state[field_key] = v
        st.session_state[input_key] = v
        _touch()

    def _on_input_change():
        v = clamp(st.session_state[input_key], min_v, max_v)
        st.session_state[field_key] = v
        st.session_state[slider_key] = v
        st.session_state[input_key] = v
        _touch()

    col_slider, col_input = st.columns([3, 1.3])
    with col_slider:
        st.slider(label, min_v, max_v, step=step, key=slider_key,
                  on_change=_on_slider_change, help=help)
    with col_input:
        st.number_input("Manual entry", min_value=min_v, max_value=max_v, step=step,
                         key=input_key, on_change=_on_input_change,
                         format=number_format, label_visibility="collapsed")

    return st.session_state[field_key]


def reset_defaults():
    for k, v in DEFAULTS.items():
        st.session_state[k] = v
    for field_key in RANGE_FIELD_MAP:
        st.session_state[f"{field_key}_slider"] = DEFAULTS[field_key]
        st.session_state[f"{field_key}_input"] = DEFAULTS[field_key]
    st.session_state.touched = dict(DEFAULT_TOUCHED)


# ============================================================
# SIDEBAR
# ============================================================
with st.sidebar:
    st.markdown(
        f"""
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
          <div style="width:34px;height:34px;border-radius:8px;background:radial-gradient(circle at 30% 30%, {AMBER}, {AMBER_DIM} 70%);
                      display:flex;align-items:center;justify-content:center;font-family:monospace;font-weight:700;color:#1a1006;font-size:15px;">PS</div>
          <div style="font-weight:700;font-size:18px;">PATShield <span style="color:{AMBER};font-family:monospace;font-size:13px;">v2</span></div>
        </div>
        <div style="font-size:11.5px;color:{INK_FAINT};margin:2px 0 20px;line-height:1.5;">
          AI-enhanced Waste Heat Recovery feasibility engine for BEE&nbsp;PAT compliance. Adjust plant inputs — every panel recalculates live.
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown("###### PLANT & SECTOR")
    industry = st.selectbox("Industry sector", list(SECTOR_SEC_DEFAULTS.keys()), key="industry")

    st.caption("Drag the dial or type an exact value in the box next to it.")

    st.markdown("###### WASTE HEAT SOURCE")
    waste_temp_c = synced_field("Waste gas temperature (°C)", "wasteTempC", 90, 850, 5,
                                 touched_key="wasteTempC", number_format="%.0f")
    mass_flow_kg_s = synced_field("Flue gas mass flow (kg/s)", "massFlowKgS", 0.5, 60.0, 0.1,
                                   touched_key="massFlowKgS", number_format="%.1f")
    boiler_load_pct = synced_field("Boiler / process load (%)", "boilerLoadPct", 30, 105, 1,
                                    touched_key="boilerLoadPct", number_format="%.0f")
    sulfur_pct = synced_field("Fuel sulfur content (%)", "sulfurPct", 0.0, 5.0, 0.1,
                               touched_key="sulfurPct", number_format="%.1f")
    footprint_sqm = synced_field("Footprint available (m²)", "footprintSqm", 10, 1000, 5,
                                  touched_key="footprintSqm", number_format="%.0f")

    st.markdown("###### ECONOMICS")
    fuel_price = synced_field("Fuel price (₹/kWh)", "fuelPrice", 1.5, 10.0, 0.1,
                               touched_key="fuelPriceInrKwh", number_format="%.2f")
    elec_price = synced_field("Electricity price (₹/kWh)", "elecPrice", 3.0, 14.0, 0.1,
                               touched_key="electricityPriceInrKwh", number_format="%.2f")
    escert_price = synced_field("ESCert price (₹/toe)", "escert", 800, 3200, 10,
                                 touched_key="escertPriceInr", number_format="%.0f")

    st.markdown("###### PAT COMPLIANCE (optional)")
    sec = st.slider("Current SEC (toe/unit)", 0.02, 0.5, key="sec", step=0.005, format="%.3f")
    prod = st.slider("Annual production (units)", 5000, 500000, key="prod", step=1000)

    st.button("Reset to sector defaults", on_click=reset_defaults, use_container_width=True)
    st.markdown(
        f"""<div class="note">Sliders feed the AI confidence score — moving them away from a plant's actual
        metered values will lower confidence, by design.</div>""",
        unsafe_allow_html=True,
    )

# ============================================================
# COMPUTE
# ============================================================
inputs = dict(
    wasteTempC=float(waste_temp_c), massFlowKgS=float(mass_flow_kg_s), boilerLoadPct=float(boiler_load_pct),
    sulfurPct=float(sulfur_pct), footprintSqm=float(footprint_sqm),
    thermalFuelCostInrKwh=float(fuel_price), electricityCostInrKwh=float(elec_price),
    escertPriceInr=float(escert_price),
)
eval_res = evaluate_technology_options(inputs)
sorted_recs = sorted(eval_res["recommendations"], key=lambda r: r["paybackYears"])
best = sorted_recs[0] if sorted_recs else None

dq_inputs = {**inputs, "fuelPriceInrKwh": inputs["thermalFuelCostInrKwh"],
             "electricityPriceInrKwh": inputs["electricityCostInrKwh"]}
dq = assess_data_quality(dq_inputs, st.session_state.touched)

mc = dict(uncertaintyConfidence=0, paybackP10=0, paybackP50=0, paybackP90=0,
          savingsP10=0, savingsP50=0, savingsP90=0, rawPaybacks=[])
val = dict(status="fail", notes=["No feasible technology for this waste-heat temperature."])
rec = dict(verdict="Not Recommended", score=0,
           reasons=["No feasible technology for this waste-heat temperature."], breakdown=None)

if best:
    mc = monte_carlo_uncertainty(inputs, best["technology"], 800)
    val = validate_against_benchmarks(best)
    rec = compute_recommendation(best, dq, mc, val)

confidence_score = rec["breakdown"]["confidenceScore"] if rec["breakdown"] else 0.5 * dq["dataQualityScore"]

# ============================================================
# MAIN — HEADER + VERDICT
# ============================================================
top_l, top_r = st.columns([4, 1])
with top_l:
    st.markdown("## Waste Heat Recovery — Feasibility Dashboard")
    st.markdown(
        f'<div style="color:{INK_FAINT};font-size:13px;margin-top:-10px;">'
        f'Rule-based sizing engine (ported from PATShield\'s calculations.py) + explainable AI scoring layer</div>',
        unsafe_allow_html=True,
    )
with top_r:
    st.markdown(
        f'<div style="text-align:right;margin-top:10px;"><span class="pill" style="border:1px solid {LINE};'
        f'color:{INK_FAINT};font-family:monospace;">live · recalculates on input change</span></div>',
        unsafe_allow_html=True,
    )

vcolor, vbg = verdict_colors(rec["verdict"])
reasons_html = " ".join(rec["reasons"])
tech_lead = f"<b>{best['technology']} recommended.</b> " if best else ""
st.markdown(
    f"""
    <div class="verdict-banner">
      <div style="display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center;">
        <div style="font-family:monospace;font-weight:700;font-size:20px;padding:10px 18px;border-radius:8px;
                    background:{vbg};color:{vcolor};border:1px solid {vcolor}66;white-space:nowrap;">
          {rec['verdict'].upper()}
        </div>
        <div style="font-size:13px;color:{INK_DIM};line-height:1.55;">{tech_lead}{reasons_html}</div>
        <div style="text-align:center;">
          <div style="font-family:monospace;font-size:26px;font-weight:700;">{rec['score']:.0f}</div>
          <div style="font-size:10.5px;color:{INK_FAINT};text-transform:uppercase;letter-spacing:0.06em;">Feasibility Score</div>
        </div>
      </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ============================================================
# TABS
# ============================================================
tab_overview, tab_sensitivity, tab_confidence, tab_validation, tab_emissions = st.tabs(
    ["Overview", "Sensitivity & What-If", "Confidence & Uncertainty", "Validation vs. Real Data", "Emissions"]
)

# ---------------- OVERVIEW ----------------
with tab_overview:
    c1, c2, c3, c4 = st.columns(4)
    kpis = [
        ("Recommended Tech", best["technology"] if best else "—",
         (f"{fmt_num(best['capacityKw'],0)} kW recovered @ current load" if best else "No technology matches this temperature")),
        ("Simple Payback", f"{best['paybackYears']:.2f} yr" if best else "—", "Total capex ÷ annual benefit"),
        ("Annual Savings", fmt_inr_short(best["totalAnnualBenefitInr"]) if best else "—",
         (f"{fmt_inr_short(best['annualSavingsInr'])} energy + {fmt_inr_short(best['annualEscertValueInr'])} ESCert" if best else "—")),
        ("CO₂ Avoided / yr", fmt_num(best["co2AvoidedTco2eAnnual"], 0) if best else "—",
         (f"tCO₂e/yr · {fmt_num(best['savedToeAnnual'],0)} toe saved" if best else "tCO₂e")),
    ]
    for col, (title, big, cap) in zip([c1, c2, c3, c4], kpis):
        with col:
            st.markdown(
                f'<div class="card"><h3>{title}</h3><div class="kpi-big">{big}</div>'
                f'<div class="kpi-cap">{cap}</div></div>', unsafe_allow_html=True,
            )

    col_a, col_b = st.columns(2)
    with col_a:
        st.markdown('<div class="card"><h3>Technology Comparison</h3>', unsafe_allow_html=True)
        if sorted_recs:
            df = pd.DataFrame([{
                "Tech": r["technology"],
                "Capacity": f"{fmt_num(r['capacityKw'],0)} kW",
                "Capex": fmt_inr_short(r["capex"]["total"]),
                "Payback": f"{r['paybackYears']:.2f} yr" if math.isfinite(r["paybackYears"]) else "—",
                "Footprint": "fits" if r["footprintFeasible"] else "too small",
            } for r in sorted_recs])
            st.dataframe(df, hide_index=True, use_container_width=True)
        else:
            st.markdown(
                f'<div style="color:{INK_FAINT};font-size:13px;">No technology matches {inputs["wasteTempC"]:.0f}°C. '
                f'Economizer needs 200–350°C, WHRB 400–800°C, ORC 90–150°C.</div>'
            )
        st.markdown("</div>", unsafe_allow_html=True)

    with col_b:
        st.markdown('<div class="card"><h3>Capex Breakdown (recommended technology)</h3>', unsafe_allow_html=True)
        if best:
            fig = go.Figure(data=[go.Pie(
                labels=["Equipment", "Ducting", "Fans", "Installation"],
                values=[best["capex"]["equipment"], best["capex"]["ducting"], best["capex"]["fans"], best["capex"]["install"]],
                hole=0.62, marker=dict(colors=[AMBER, TEAL, GREEN, "#8E7CC3"]),
            )])
            fig.update_layout(**PLOTLY_LAYOUT, height=280)
            st.plotly_chart(fig, use_container_width=True)
        st.markdown("</div>", unsafe_allow_html=True)

    st.markdown('<div class="card"><h3>PAT Penalty vs. WHR Investment — 3-Year View</h3>', unsafe_allow_html=True)
    baseline = SECTOR_SEC_DEFAULTS.get(industry, sec * 0.95)
    years = [1, 2, 3]
    penalties, cum = [], 0
    for y in years:
        target = baseline + (sec - baseline) * (3 - y) / 3.0
        shortfall = max(0, sec - target) * prod
        cum += shortfall
        penalties.append(1_000_000 + cum * escert_price)
    capex_line = [best["capex"]["total"]] * 3 if best else [0, 0, 0]
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=[f"Year {y}" for y in years], y=penalties, name="Cumulative PAT penalty (no action)",
                              line=dict(color=RED), fill="tozeroy", fillcolor="rgba(232,115,95,0.12)"))
    fig.add_trace(go.Scatter(x=[f"Year {y}" for y in years], y=capex_line, name="WHR one-time capex",
                              line=dict(color=TEAL, dash="dash")))
    fig.update_layout(**PLOTLY_LAYOUT, height=320, yaxis=dict(gridcolor=GRID_COLOR, tickprefix="₹"))
    st.plotly_chart(fig, use_container_width=True)
    st.markdown(
        f'<div class="note">Compares the cumulative Section-26 non-compliance penalty (if no action is taken) '
        f'against the one-time WHR capex, using your SEC and production inputs.</div></div>',
        unsafe_allow_html=True,
    )

# ---------------- SENSITIVITY ----------------
with tab_sensitivity:
    if best:
        sens = sensitivity_analysis(inputs, best["technology"], best["paybackYears"])
        col_a, col_b = st.columns(2)
        with col_a:
            st.markdown('<div class="card"><h3>Tornado Chart — Payback Sensitivity (±20%)</h3>', unsafe_allow_html=True)
            labels = [s["label"] for s in sens]
            fig = go.Figure()
            fig.add_trace(go.Bar(y=labels, x=[s["low"] for s in sens], name="Payback at -20%",
                                  orientation="h", marker_color=TEAL))
            fig.add_trace(go.Bar(y=labels, x=[s["high"] for s in sens], name="Payback at +20%",
                                  orientation="h", marker_color=AMBER))
            fig.update_layout(**PLOTLY_LAYOUT, height=320, barmode="group",
                               xaxis=dict(title="Payback (years)", gridcolor=GRID_COLOR))
            st.plotly_chart(fig, use_container_width=True)
            st.markdown(
                '<div class="note">Each bar shows how payback moves when one input is flexed ±20% while all '
                'others stay fixed at your current sidebar values. Longer bars = higher-leverage variables.</div></div>',
                unsafe_allow_html=True,
            )

        with col_b:
            st.markdown('<div class="card"><h3>What-If: Boiler Load vs. Payback &amp; CO₂</h3>', unsafe_allow_html=True)
            load_range, load_paybacks, load_co2 = [], [], []
            for l in range(40, 106, 5):
                r = next((x for x in evaluate_technology_options({**inputs, "boilerLoadPct": l})["recommendations"]
                          if x["technology"] == best["technology"]), None)
                load_range.append(f"{l}%")
                load_paybacks.append(r["paybackYears"] if r else None)
                load_co2.append(r["co2AvoidedTco2eAnnual"] if r else None)
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=load_range, y=load_paybacks, name="Payback (yr)", line=dict(color=AMBER)))
            fig.add_trace(go.Scatter(x=load_range, y=load_co2, name="CO₂ avoided (tCO₂e/yr)",
                                      line=dict(color=GREEN), yaxis="y2"))
            fig.update_layout(**PLOTLY_LAYOUT, height=320,
                               yaxis=dict(title="Payback (yr)", gridcolor=GRID_COLOR),
                               yaxis2=dict(title="tCO₂e/yr", overlaying="y", side="right"))
            st.plotly_chart(fig, use_container_width=True)
            st.markdown("</div>", unsafe_allow_html=True)

        col_c, col_d = st.columns(2)
        with col_c:
            st.markdown('<div class="card"><h3>What-If: Fuel Price vs. Annual Benefit</h3>', unsafe_allow_html=True)
            fp_range, fp_benefit = [], []
            base_price = inputs["thermalFuelCostInrKwh"]
            m = 0.6
            while m <= 1.6001:
                price = base_price * m
                new_inputs = {**inputs, "thermalFuelCostInrKwh": price}
                if best["technology"] == "ORC":
                    new_inputs["electricityCostInrKwh"] = inputs["electricityCostInrKwh"] * m
                r = next((x for x in evaluate_technology_options(new_inputs)["recommendations"]
                          if x["technology"] == best["technology"]), None)
                fp_range.append(f"₹{price:.1f}")
                fp_benefit.append(r["totalAnnualBenefitInr"] if r else None)
                m += 0.1
            fig = go.Figure(data=[go.Bar(x=fp_range, y=fp_benefit, marker_color=TEAL)])
            fig.update_layout(**PLOTLY_LAYOUT, height=320, showlegend=False,
                               yaxis=dict(gridcolor=GRID_COLOR, tickprefix="₹"))
            st.plotly_chart(fig, use_container_width=True)
            st.markdown("</div>", unsafe_allow_html=True)

        with col_d:
            st.markdown('<div class="card"><h3>What-If: Waste Temperature vs. Recovered Capacity</h3>', unsafe_allow_html=True)
            tech_min = 90 if best["technology"] == "ORC" else (150 if best["technology"] == "Economizer" else 350)
            tech_max = 200 if best["technology"] == "ORC" else (400 if best["technology"] == "Economizer" else 850)
            t_range, t_capacity = [], []
            step = (tech_max - tech_min) / 14
            t = tech_min
            for _ in range(15):
                r = next((x for x in evaluate_technology_options({**inputs, "wasteTempC": t})["recommendations"]
                          if x["technology"] == best["technology"]), None)
                t_range.append(f"{round(t)}°C")
                t_capacity.append(r["capacityKw"] if r else None)
                t += step
            fig = go.Figure(data=[go.Scatter(x=t_range, y=t_capacity, name="Recovered capacity (kW)",
                                              line=dict(color=AMBER), fill="tozeroy",
                                              fillcolor="rgba(242,169,59,0.12)")])
            fig.update_layout(**PLOTLY_LAYOUT, height=320, showlegend=False, yaxis=dict(gridcolor=GRID_COLOR))
            st.plotly_chart(fig, use_container_width=True)
            st.markdown("</div>", unsafe_allow_html=True)

        top_driver = sens[0]
        st.markdown(
            f"""
            <div class="card"><h3>Reading this correctly</h3>
            <div class="note"><b style="color:{INK_DIM}">{top_driver['label']}</b> is the highest-leverage variable
            for this project — a ±20% swing moves payback between
            <span style="color:{TEAL}">{min(top_driver['low'], top_driver['high']):.2f} yr</span> and
            <span style="color:{AMBER}">{max(top_driver['low'], top_driver['high']):.2f} yr</span>.
            Note that waste-heat temperature and mass flow rate typically show a much smaller swing here: in this
            rule-based costing model, capex/kW is fixed, so scaling the recovered duty up or down moves capex and
            savings by roughly the same factor and payback barely moves. Payback is genuinely most sensitive to
            <b>price ratios</b> (fuel/electricity price) and <b>operating load</b> — get those numbers right before
            anything else.</div></div>
            """,
            unsafe_allow_html=True,
        )
    else:
        st.info("No feasible technology at the current waste-heat temperature — sensitivity analysis unavailable.")

# ---------------- CONFIDENCE ----------------
with tab_confidence:
    c1, c2, c3 = st.columns(3)
    for col, (title, big, cap) in zip(
        [c1, c2, c3],
        [
            ("Overall Confidence", f"{confidence_score:.0f} / 100", "Data quality × outcome stability"),
            ("Data Quality Score", f"{dq['dataQualityScore']:.0f} / 100", "Plausibility + completeness of inputs"),
            ("Monte-Carlo Stability", f"{mc['uncertaintyConfidence']:.0f} / 100", "Payback spread across 800 simulated scenarios"),
        ],
    ):
        with col:
            st.markdown(
                f'<div class="card"><h3>{title}</h3><div class="kpi-big">{big}</div>'
                f'<div class="kpi-cap">{cap}</div></div>', unsafe_allow_html=True,
            )

    col_a, col_b = st.columns(2)
    with col_a:
        st.markdown('<div class="card"><h3>Payback Distribution (Monte Carlo, N=800)</h3>', unsafe_allow_html=True)
        if best and mc["rawPaybacks"]:
            paybacks = mc["rawPaybacks"]
            fig = go.Figure(data=[go.Histogram(x=paybacks, nbinsx=16, marker_color=TEAL)])
            fig.update_layout(**PLOTLY_LAYOUT, height=280, showlegend=False,
                               xaxis=dict(title="Payback (years)"), yaxis=dict(gridcolor=GRID_COLOR))
            st.plotly_chart(fig, use_container_width=True)
            st.markdown(
                f'<div class="note">P10 = <b style="color:{INK_DIM}">{mc["paybackP10"]:.2f} yr</b>, '
                f'median = <b style="color:{INK_DIM}">{mc["paybackP50"]:.2f} yr</b>, '
                f'P90 = <b style="color:{INK_DIM}">{mc["paybackP90"]:.2f} yr</b> across 800 simulated scenarios with '
                f'realistic measurement/market noise on temperature, load, flow, and prices.</div>',
                unsafe_allow_html=True,
            )
        else:
            st.markdown('<div class="note">No feasible technology to simulate at the current waste-heat temperature.</div>',
                        unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)

    with col_b:
        st.markdown('<div class="card"><h3>Data Quality — Field by Field</h3><div>', unsafe_allow_html=True)
        rows_html = ""
        for d in dq["details"]:
            color = GREEN if d["plausibility"] >= 90 else (YELLOW if d["plausibility"] >= 55 else RED)
            status = "measured" if d["provided"] else "default"
            typical = "typical range" if d["inTypicalRange"] else "atypical"
            rows_html += (
                f'<div class="dq-item"><span>{d["field"]}</span>'
                f'<span style="font-family:monospace;color:{INK_FAINT};font-size:11px;">{status} · '
                f'<span style="color:{color}">{typical}</span></span></div>'
            )
        st.markdown(rows_html + "</div></div>", unsafe_allow_html=True)

    st.markdown(
        f"""
        <div class="card"><h3>How the confidence score is built</h3>
        <div class="methodology-box">
        This is a transparent weighted scorecard, not an opaque black-box model — every input to the score is shown above.<br><br>
        <b>Data Quality (50%)</b> — each field is checked against typical industrial-engineering ranges for Indian WHR
        retrofits, and against whether you've actually adjusted it from a generic default (a default value is treated
        as lower-confidence than a metered one).<br>
        <b>Outcome Stability (50%)</b> — a Monte-Carlo simulation perturbs temperature, load, prices, and flow using
        empirically reasonable measurement/market noise (6–15% std. dev. depending on variable) and re-runs the full
        sizing + financial engine 800 times. A tight P10–P90 payback band → high confidence; a wide one → low
        confidence, regardless of how good the single-point estimate looks.<br><br>
        <b>Honest limitation:</b> this scorecard approximates the value a trained ML model would add
        (uncertainty-awareness, multi-factor weighting) without requiring a labelled dataset of past WHR projects,
        which PATShield does not yet have. Once real project outcomes are logged (Validation tab), the weights above
        can be recalibrated against them.
        </div></div>
        """,
        unsafe_allow_html=True,
    )

# ---------------- VALIDATION ----------------
with tab_validation:
    st.markdown('<div class="card"><h3>Benchmark Check — Computed Result vs. Published/Real-Plant Data</h3>', unsafe_allow_html=True)
    pill_class = "pill-pass" if val["status"] == "pass" else ("pill-warn" if val["status"] == "warn" else "pill-fail")
    st.markdown(
        f'<span class="pill {pill_class}">{val["status"].upper()}</span>&nbsp; against literature/real-plant '
        f'benchmark bands for {best["technology"] if best else "—"}',
        unsafe_allow_html=True,
    )
    if best:
        b = BENCHMARKS[best["technology"]]
        fig = go.Figure()
        fig.add_trace(go.Bar(y=["Payback (years)"], x=[b["paybackMin"]], name="Typical range min",
                              orientation="h", marker_color="rgba(87,194,194,0.35)"))
        fig.add_trace(go.Bar(y=["Payback (years)"], x=[b["paybackMax"] - b["paybackMin"]], name="Typical range max",
                              orientation="h", marker_color="rgba(87,194,194,0.15)"))
        fig.add_trace(go.Bar(y=["Payback (years)"], x=[best["paybackYears"]], name="Your computed value",
                              orientation="h", marker_color=AMBER, width=0.3))
        fig.update_layout(**PLOTLY_LAYOUT, height=200, barmode="overlay", xaxis=dict(gridcolor=GRID_COLOR))
        st.plotly_chart(fig, use_container_width=True)
    st.markdown('<div class="note">' + "<br>".join("• " + n for n in val["notes"]) + "</div></div>", unsafe_allow_html=True)

    col_a, col_b = st.columns(2)
    with col_a:
        st.markdown('<div class="card"><h3>Reference Data Used</h3>', unsafe_allow_html=True)
        ref_df = pd.DataFrame([
            {"Technology": "Economizer", "Typical Payback": "1.5–4.0 yr", "Typical ₹/kW": "₹10,000–22,000"},
            {"Technology": "WHRB (waste heat boiler)", "Typical Payback": "1.7–5.0 yr", "Typical ₹/kW": "₹18,000–35,000"},
            {"Technology": "ORC (electricity)", "Typical Payback": "3.0–8.0 yr", "Typical ₹/kW": "₹45,000–80,000"},
        ])
        st.dataframe(ref_df, hide_index=True, use_container_width=True)
        st.markdown(
            '<div class="note">Ranges are synthesized from published waste-heat-recovery literature and case '
            'studies (e.g. cement-sector flue-gas power recovery projects reporting simple paybacks around '
            '1.5–2 years at favourable scale) alongside general industrial WHR cost benchmarks. They are a sanity '
            'check, not a substitute for a site energy audit.</div></div>',
            unsafe_allow_html=True,
        )
    with col_b:
        st.markdown('<div class="card"><h3>Log a Real Result to Improve Future Confidence</h3>', unsafe_allow_html=True)
        actual_payback = st.number_input("Actual measured payback achieved (years)", value=None,
                                          step=0.1, format="%.1f", placeholder="e.g. 2.4")
        actual_savings = st.number_input("Actual annual savings achieved (₹)", value=None,
                                          step=1000.0, placeholder="e.g. 4200000")
        if st.button("Compare against prediction", type="secondary"):
            if not best or (actual_payback is None and actual_savings is None):
                st.markdown("Enter at least one actual figure to compare against the model's prediction.")
            else:
                lines = []
                if actual_payback is not None:
                    err = (actual_payback - best["paybackYears"]) / best["paybackYears"] * 100
                    direction = "optimistic" if err > 0 else "conservative"
                    lines.append(
                        f"Predicted payback {best['paybackYears']:.2f} yr vs. actual {actual_payback:.2f} yr → "
                        f"model was {direction} by {abs(err):.0f}%."
                    )
                if actual_savings is not None:
                    err = (actual_savings - best["totalAnnualBenefitInr"]) / best["totalAnnualBenefitInr"] * 100
                    direction = "optimistic" if err > 0 else "conservative"
                    lines.append(
                        f"Predicted annual benefit {fmt_inr_short(best['totalAnnualBenefitInr'])} vs. actual "
                        f"{fmt_inr_short(actual_savings)} → model was {direction} by {abs(err):.0f}%."
                    )
                st.markdown("<br>".join(lines), unsafe_allow_html=True)
                st.markdown(
                    "<i>In production, entries like this accumulate into a real project outcomes dataset — enough "
                    "of them let the confidence-score weights above be recalibrated statistically instead of set "
                    "by engineering judgement.</i>", unsafe_allow_html=True,
                )
        st.markdown("</div>", unsafe_allow_html=True)

# ---------------- EMISSIONS ----------------
with tab_emissions:
    c1, c2, c3, c4 = st.columns(4)
    if best:
        em_vals = [
            ("CO₂ Avoided", fmt_num(best["co2AvoidedTco2eAnnual"], 0), "tCO₂e / year"),
            ("≈ Passenger Cars Off Road", fmt_num(best["co2AvoidedTco2eAnnual"] / 4.6, 0), "illustrative equivalence"),
            ("≈ Trees Planted (20 yr)", fmt_num(best["co2AvoidedTco2eAnnual"] * 1000 / 21, 0), "illustrative equivalence"),
            ("ESCerts Generated", fmt_num(best["savedToeAnnual"], 0), "toe saved / year"),
        ]
    else:
        em_vals = [("CO₂ Avoided", "—", "tCO₂e / year"), ("≈ Passenger Cars Off Road", "—", "illustrative equivalence"),
                   ("≈ Trees Planted (20 yr)", "—", "illustrative equivalence"), ("ESCerts Generated", "—", "toe saved / year")]
    for col, (title, big, cap) in zip([c1, c2, c3, c4], em_vals):
        with col:
            st.markdown(
                f'<div class="card"><h3>{title}</h3><div class="kpi-big">{big}</div>'
                f'<div class="kpi-cap">{cap}</div></div>', unsafe_allow_html=True,
            )

    col_a, col_b = st.columns(2)
    with col_a:
        st.markdown('<div class="card"><h3>Fuel Savings vs. Emission Reduction</h3>', unsafe_allow_html=True)
        if best:
            fig = go.Figure()
            fig.add_trace(go.Bar(x=[r["technology"] for r in sorted_recs],
                                  y=[r["annualSavingsInr"] / 100000 for r in sorted_recs],
                                  name="Annual fuel/power savings (₹ Lakh)", marker_color=AMBER))
            fig.add_trace(go.Bar(x=[r["technology"] for r in sorted_recs],
                                  y=[r["co2AvoidedTco2eAnnual"] for r in sorted_recs],
                                  name="CO₂ avoided (tCO₂e/yr)", marker_color=GREEN, yaxis="y2"))
            fig.update_layout(**PLOTLY_LAYOUT, height=320,
                               yaxis=dict(title="₹ Lakh/yr", gridcolor=GRID_COLOR),
                               yaxis2=dict(title="tCO₂e/yr", overlaying="y", side="right"))
            st.plotly_chart(fig, use_container_width=True)
        st.markdown("</div>", unsafe_allow_html=True)

    with col_b:
        st.markdown(
            f"""
            <div class="card"><h3>Emissions Basis</h3>
            <div class="note">
            <b style="color:{INK_DIM}">Thermal technologies (Economizer / WHRB)</b> avoid emissions from the fuel
            that would otherwise be burnt, using a plant-fuel-mix average of 2.5 tCO₂e per toe saved.<br><br>
            <b style="color:{INK_DIM}">ORC (electricity)</b> avoids emissions from grid electricity displaced,
            using an approximate India all-India average grid factor of 0.71 kgCO₂/kWh. Use plant-specific
            fuel/grid factors where available — this default is a national average and can materially over- or
            under-state site-level emissions.
            </div></div>
            """,
            unsafe_allow_html=True,
        )

st.markdown(
    f"""
    <div style="margin-top:26px;text-align:center;font-size:12px;color:{INK_FAINT};">
      PATShield v2 dashboard · sizing &amp; financial core ported from the project's
      <span style="color:{INK_DIM}">calculations.py</span> · AI layer adds sensitivity analysis, Monte-Carlo
      confidence scoring, and literature/real-data benchmark validation on top of it.
    </div>
    """,
    unsafe_allow_html=True,
)
