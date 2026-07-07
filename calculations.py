import math
from typing import Dict, Any, List

# Sector Default target SEC norms (toe per unit production)
SECTOR_TARGET_SEC_DEFAULTS = {
    "Textile": 0.35,
    "Steel": 0.12,
    "Cement": 0.075,
    "Chemical": 0.22,
    "Refinery": 0.32,
    "Other": 0.28
}

def calculate_urgency_penalty(
    industry_type: str,
    annual_energy_consumption_toe: float,
    current_sec: float,
    annual_production_units: float,
    baseline_sec_norm: float = None,
    escert_price_inr: float = 1840.0,
    fixed_penalty_inr: float = 1000000.0
) -> Dict[str, Any]:
    """
    Calculates the 3-year cumulative PAT penalty risk for the Free Zone landing page.
    Under Section 26 of the Energy Conservation Act, 2001:
    Total Penalty = Fixed Component (10 Lakh) + (Shortfall in mtoe * Market Value of 1 mtoe)
    Here, mtoe = metric tonnes of oil equivalent (toe).
    """
    if not baseline_sec_norm:
        baseline_sec_norm = SECTOR_TARGET_SEC_DEFAULTS.get(industry_type, current_sec * 0.95)

    # SEC shortfall is the excess energy consumed per unit of production
    sec_shortfall = max(0.0, current_sec - baseline_sec_norm)
    
    # Annual shortfall in toe
    annual_shortfall_toe = sec_shortfall * annual_production_units
    
    # 3-year cycle cumulative shortfall
    cumulative_shortfall_toe = annual_shortfall_toe * 3.0
    
    # Penalty calculation
    variable_penalty_inr = cumulative_shortfall_toe * escert_price_inr
    total_penalty_inr = fixed_penalty_inr + variable_penalty_inr
    
    # Express penalty in Lakhs (1 Lakh = 100,000 INR)
    total_penalty_lakh = total_penalty_inr / 100000.0
    
    return {
        "inputs": {
            "industry_type": industry_type,
            "annual_energy_consumption_toe": annual_energy_consumption_toe,
            "current_sec": current_sec,
            "annual_production_units": annual_production_units,
            "baseline_sec_norm": baseline_sec_norm
        },
        "sec_shortfall": sec_shortfall,
        "annual_shortfall_toe": annual_shortfall_toe,
        "cumulative_shortfall_toe": cumulative_shortfall_toe,
        "escert_price_inr": escert_price_inr,
        "fixed_penalty_inr": fixed_penalty_inr,
        "total_penalty_inr": total_penalty_inr,
        "total_penalty_lakh": round(total_penalty_lakh, 2)
    }


def calculate_cost_of_inaction_forecast(
    current_sec: float,
    baseline_sec_norm: float,
    annual_production_units: float,
    escert_price_inr: float = 1840.0,
    fixed_penalty_inr: float = 1000000.0
) -> Dict[str, Any]:
    """
    Generates a time-series forecast over a 3-year compliance cycle mapping:
    (a) Projected baseline SEC if no action is taken.
    (b) BEE's tightening regulatory target line.
    (c) Cumulative financial penalty liability over time.
    """
    forecast = []
    cumulative_shortfall = 0.0
    
    # We model a slightly tightening target line or flat target depending on rules
    # Usually BEE sets a target for the target year (Year 3), but we represent it per year
    for year in range(1, 4):
        # Target SEC might tighten gradually or be a flat threshold to meet by Year 3
        # We simulate the target line as linearly decreasing to baseline_sec_norm
        target_sec = baseline_sec_norm + (current_sec - baseline_sec_norm) * (3 - year) / 3.0
        
        annual_shortfall = max(0.0, current_sec - target_sec) * annual_production_units
        cumulative_shortfall += annual_shortfall
        
        variable_penalty = cumulative_shortfall * escert_price_inr
        # Under Section 26, the 10 Lakh fixed penalty is applied once compliance is audited
        total_penalty = fixed_penalty_inr + variable_penalty
        
        forecast.append({
            "year": year,
            "baseline_sec": current_sec,
            "target_sec": round(target_sec, 4),
            "annual_shortfall_toe": round(annual_shortfall, 2),
            "cumulative_shortfall_toe": round(cumulative_shortfall, 2),
            "cumulative_penalty_inr": round(total_penalty, 2),
            "cumulative_penalty_lakh": round(total_penalty / 100000.0, 2)
        })
        
    return {
        "inputs": {
            "current_sec": current_sec,
            "baseline_sec_norm": baseline_sec_norm,
            "annual_production_units": annual_production_units
        },
        "forecast": forecast
    }


def calculate_lmtd(t_in_hot: float, t_out_hot: float, t_in_cold: float, t_out_cold: float) -> float:
    """
    Calculates the Log Mean Temperature Difference (LMTD) for counter-flow heat exchanger.
    If temperatures lead to mathematical errors, falls back to Arithmetic Mean Temperature Difference.
    """
    dt_1 = t_in_hot - t_out_cold
    dt_2 = t_out_hot - t_in_cold
    
    if dt_1 <= 0 or dt_2 <= 0:
        # Fallback to arithmetic difference
        return max(1.0, 0.5 * ((t_in_hot - t_in_cold) + (t_out_hot - t_out_cold)))
        
    if abs(dt_1 - dt_2) < 1e-5:
        return dt_1
        
    return (dt_1 - dt_2) / math.log(dt_1 / dt_2)


def get_technology_parameters(tech_name: str, waste_temp: float) -> Dict[str, Any]:
    """
    Returns default sizing and cost parameters for WHR technologies.
    """
    if tech_name == "Economizer":
        # Gas cools to 150°C
        t_out = 150.0
        u_coeff = 0.05  # kW/m²·°C
        cost_per_kw = 15000.0
        # Cold fluid: feed water from 80°C to 130°C
        t_cold_in = 80.0
        t_cold_out = 130.0
        tube_od = 50.8
        tube_thickness = 3.2
    elif tech_name == "WHRB":
        # Gas cools to 180°C
        t_out = 180.0
        u_coeff = 0.04  # kW/m²·°C
        cost_per_kw = 25000.0
        # Cold fluid: saturated steam at 200°C
        t_cold_in = 190.0
        t_cold_out = 200.0
        tube_od = 63.5
        tube_thickness = 4.5
    elif tech_name == "ORC":
        # Gas cools to 80°C
        t_out = 80.0
        u_coeff = 0.03  # kW/m²·°C
        cost_per_kw = 60000.0
        # Cold fluid: organic working fluid vaporizes at 75°C
        t_cold_in = 40.0
        t_cold_out = 75.0
        tube_od = 38.1
        tube_thickness = 2.8
    else:
        raise ValueError(f"Unknown technology: {tech_name}")
        
    return {
        "t_out": t_out,
        "u_coeff": u_coeff,
        "cost_per_kw": cost_per_kw,
        "t_cold_in": t_cold_in,
        "t_cold_out": t_cold_out,
        "tube_od_mm": tube_od,
        "tube_thickness_mm": tube_thickness
    }


def evaluate_technology_options(
    waste_temp_c: float,
    mass_flow_rate_kg_s: float,
    sulfur_content_pct: float,
    footprint_available_sqm: float,
    escert_price_inr: float = 1840.0
) -> Dict[str, Any]:
    """
    Evaluates temperature bounds to recommend WHR technologies and returns a comparison.
    - Economizer: 200°C – 350°C
    - WHRB: 400°C – 800°C
    - ORC: 90°C – 150°C
    """
    # Define design parameters
    cp_gas = 1.05  # kJ/kg·°C
    operating_hours = 7200.0  # 300 days * 24 hours
    boiler_efficiency = 0.80  # for fuel saving calculations
    orc_efficiency = 0.12  # electric generation efficiency
    thermal_fuel_cost_inr_kwh = 4.5
    electricity_cost_inr_kwh = 7.5
    
    recommendations = []
    
    # Potential technologies based on bounds
    tech_options = []
    if 90.0 <= waste_temp_c <= 150.0:
        tech_options.append("ORC")
    if 200.0 <= waste_temp_c <= 350.0:
        tech_options.append("Economizer")
    if 400.0 <= waste_temp_c <= 800.0:
        tech_options.append("WHRB")
        
    # Support edge cases or nearby thresholds
    if not tech_options:
        if 150.0 < waste_temp_c < 200.0:
            # Borderline low temperature
            tech_options.extend(["ORC", "Economizer"])
        elif 350.0 < waste_temp_c < 400.0:
            # Transition from Economizer to WHRB
            tech_options.extend(["Economizer", "WHRB"])
        elif waste_temp_c > 800.0:
            tech_options.append("WHRB")
            
    # Metallurgy recommendation based on sulfur content
    metallurgy = "Stainless Steel (SS316)" if sulfur_content_pct > 0.5 else "Carbon Steel"
    
    for tech in tech_options:
        params = get_technology_parameters(tech, waste_temp_c)
        t_out = params["t_out"]
        
        # If waste temperature is below the discharge threshold, adjust it
        if waste_temp_c <= t_out:
            t_out = waste_temp_c - 10.0
            
        dt = waste_temp_c - t_out
        q_dot = mass_flow_rate_kg_s * cp_gas * dt  # kW thermal
        
        # Sizing calculations
        lmtd = calculate_lmtd(waste_temp_c, t_out, params["t_cold_in"], params["t_cold_out"])
        area_sqm = q_dot / (params["u_coeff"] * lmtd)
        
        # Gating by footprint: 1 sqm of footprint fits roughly 4 sqm of heat transfer area (compact tube bundle)
        required_footprint = area_sqm / 4.0
        footprint_feasible = required_footprint <= footprint_available_sqm
        
        # Financial Sizing
        equip_capex = q_dot * params["cost_per_kw"]
        ducting_capex = equip_capex * 0.15
        fans_capex = equip_capex * 0.10
        install_capex = equip_capex * 0.20
        total_capex = equip_capex + ducting_capex + fans_capex + install_capex
        
        # Energy and Financial Savings
        if tech == "ORC":
            # Electrical recovery
            electrical_energy_kwh = q_dot * orc_efficiency * operating_hours
            annual_savings = electrical_energy_kwh * electricity_cost_inr_kwh
            # ESCert calculations: 1 toe = 11630 kWh
            saved_toe = electrical_energy_kwh / 11630.0
        else:
            # Thermal recovery (saving boiler fuel)
            thermal_saved_kwh = (q_dot * operating_hours) / boiler_efficiency
            annual_savings = thermal_saved_kwh * thermal_fuel_cost_inr_kwh
            # ESCert calculations
            saved_toe = thermal_saved_kwh / 11630.0
            
        annual_escert_value = saved_toe * escert_price_inr
        total_annual_benefit = annual_savings + annual_escert_value
        
        payback_years = total_capex / total_annual_benefit if total_annual_benefit > 0 else float('inf')
        
        # Future Carbon Credit Trading Scheme (CCTS) scaling
        # Assume emission factor of 2.5 tCO2e per toe saved
        co2_avoided_tco2e = saved_toe * 2.5
        
        recommendations.append({
            "technology": tech,
            "capacity_kw": round(q_dot, 2),
            "heat_transfer_area_sqm": round(area_sqm, 2),
            "required_footprint_sqm": round(required_footprint, 2),
            "footprint_feasible": footprint_feasible,
            "tube_outside_diameter_mm": params["tube_od_mm"],
            "tube_wall_thickness_mm": params["tube_thickness_mm"],
            "metallurgy_recommendation": metallurgy,
            "capex_breakdown": {
                "equipment_inr": round(equip_capex, 2),
                "ducting_inr": round(ducting_capex, 2),
                "fans_inr": round(fans_capex, 2),
                "installation_inr": round(install_capex, 2),
                "total_capex_inr": round(total_capex, 2)
            },
            "annual_savings_inr": round(annual_savings, 2),
            "annual_escerts_value_inr": round(annual_escert_value, 2),
            "total_annual_benefit_inr": round(total_annual_benefit, 2),
            "payback_period_years": round(payback_years, 2),
            "escerts_generated_annual": round(saved_toe, 2),
            "co2_avoided_tco2e_annual": round(co2_avoided_tco2e, 2)
        })
        
    return {
        "inputs": {
            "waste_temp_c": waste_temp_c,
            "mass_flow_rate_kg_s": mass_flow_rate_kg_s,
            "sulfur_content_pct": sulfur_content_pct,
            "footprint_available_sqm": footprint_available_sqm
        },
        "recommendations": recommendations
    }


def derate_efficiency(design_eff: float, load_pct: float) -> float:
    """
    Derates equipment efficiency linearly when operating below 100% design load.
    Example: drop from 85% (0.85) to 78% (0.78) at 70% load.
    Drop in load = 30%. Drop in eff = 7%. Derating factor = 7/30 = 0.233% per 1% drop in load.
    """
    if load_pct >= 100.0:
        return design_eff
    
    # 0.233% drop in efficiency per 1% drop in load
    derate_factor = 0.002333
    load_deficit = 100.0 - load_pct
    efficiency_drop = load_deficit * derate_factor
    
    # Cap efficiency at minimum 40% (0.40) to prevent negative/unrealistic efficiencies
    return max(0.40, design_eff - efficiency_drop)


def simulate_part_load_profile(
    tech_name: str,
    waste_temp_c: float,
    design_mass_flow_rate_kg_s: float,
    profile: List[Dict[str, float]]
) -> Dict[str, Any]:
    """
    Simulates operational part-load profiles to generate performance curves.
    Accepts: profile = [{"load_percentage": 100.0, "hours": 8.0}, {"load_percentage": 70.0, "hours": 10.0}]
    Outputs steam generation, recoverable energy, and efficiency at each load point.
    """
    cp_gas = 1.05
    params = get_technology_parameters(tech_name, waste_temp_c)
    t_out = params["t_out"]
    dt = waste_temp_c - t_out
    
    # Design reference efficiency
    design_eff = 0.85 if tech_name != "ORC" else 0.12
    latent_heat_steam = 2200.0  # kJ/kg
    
    sim_points = []
    total_energy_recovered_kwh = 0.0
    total_steam_generated_kg = 0.0
    total_hours = 0.0
    
    for pt in profile:
        load = pt["load_percentage"]
        hours = pt["hours"]
        total_hours += hours
        
        # Flow rate scales linearly with load
        flow_rate = design_mass_flow_rate_kg_s * (load / 100.0)
        
        # Derated efficiency
        eff = derate_efficiency(design_eff, load)
        
        # Total heat capacity entering the system (kW)
        inlet_heat_capacity_kw = flow_rate * cp_gas * dt
        
        # Actual recovered energy (kW)
        if tech_name == "ORC":
            # For ORC, recovery = inlet_heat_capacity * efficiency
            recovered_power_kw = inlet_heat_capacity_kw * (eff / design_eff) * design_eff
        else:
            # For WHRB/Economizer, recovery = inlet_heat_capacity * efficiency
            recovered_power_kw = inlet_heat_capacity_kw * (eff / design_eff) * design_eff
            
        energy_recovered_kwh = recovered_power_kw * hours
        total_energy_recovered_kwh += energy_recovered_kwh
        
        # Calculate steam generated (especially for WHRB/Economizer)
        # 1 kW thermal = 1 kJ/s. Saturated steam generated (kg/s) = recovered thermal energy / latent heat
        if tech_name == "WHRB":
            steam_flow_kg_s = recovered_power_kw / latent_heat_steam
            steam_generated_kg = steam_flow_kg_s * 3600.0 * hours
        else:
            steam_flow_kg_s = 0.0
            steam_generated_kg = 0.0
            
        total_steam_generated_kg += steam_generated_kg
        
        sim_points.append({
            "load_percentage": load,
            "hours": hours,
            "flow_rate_kg_s": round(flow_rate, 2),
            "efficiency": round(eff, 4),
            "recovered_power_kw": round(recovered_power_kw, 2),
            "energy_recovered_kwh": round(energy_recovered_kwh, 2),
            "steam_flow_kg_s": round(steam_flow_kg_s, 4),
            "steam_generated_kg": round(steam_generated_kg, 2)
        })
        
    return {
        "inputs": {
            "technology": tech_name,
            "waste_temp_c": waste_temp_c,
            "design_mass_flow_rate_kg_s": design_mass_flow_rate_kg_s,
            "profile": profile
        },
        "simulation_points": sim_points,
        "summary": {
            "total_hours": total_hours,
            "total_energy_recovered_kwh": round(total_energy_recovered_kwh, 2),
            "total_steam_generated_kg": round(total_steam_generated_kg, 2)
        }
    }


def generate_bypass_blueprint(
    footprint_available_sqm: float,
    design_mass_flow_rate_kg_s: float
) -> Dict[str, Any]:
    """
    Generates a dual-damper routing blueprint and standard 12-hour tie-in timeline based on footprint constraints.
    """
    # Sizing damper area based on flue gas volume flow at 15 m/s velocity
    flue_gas_density = 0.8  # kg/m3 (typical density at ~150-200C)
    volume_flow_m3_s = design_mass_flow_rate_kg_s / flue_gas_density
    
    # Velocity design criteria = 15 m/s
    required_damper_area_sqm = volume_flow_m3_s / 15.0
    damper_diameter_m = math.sqrt(4.0 * required_damper_area_sqm / math.pi)
    
    # Limit sizing output if footprint is critically small
    clashing_alert = False
    if footprint_available_sqm < 15.0:
        clashing_alert = True
        
    damper_a_specs = {
        "name": "Damper A (Bypass Stack Isolation)",
        "diameter_m": round(damper_diameter_m, 2),
        "actuator_type": "Motorized (Multi-turn electric)",
        "fail_safe_position": "Fail-Open (Vent safely to environment)"
    }
    
    damper_b_specs = {
        "name": "Damper B (WHR Inlet Isolation & Control)",
        "diameter_m": round(damper_diameter_m, 2),
        "actuator_type": "Pneumatic (Quarter-turn piston)",
        "fail_safe_position": "Fail-Closed (Protect WHR unit)"
    }
    
    timeline = [
        {"hours": "00:00 - 02:00", "task": "Safe plant shutdown, purging flue gas ducts, and thermal cooling confirmation."},
        {"hours": "02:00 - 04:00", "task": "Marking, cutting, and structural preparation of existing exhaust ducting."},
        {"hours": "04:00 - 08:00", "task": "Positioning, alignment, and structural welding of Damper A & B bypass T-junction frame structures."},
        {"hours": "08:00 - 10:00", "task": "Actuator mounting, pneumatic lines routing, and electrical power/control cabling integration."},
        {"hours": "10:00 - 11:00", "task": "Cold loop testing, leak inspections, and actuator open/close calibration."},
        {"hours": "11:00 - 12:00", "task": "Plant warm restart, bypass flow routing validation, and system handover."}
    ]
    
    return {
        "inputs": {
            "footprint_available_sqm": footprint_available_sqm,
            "design_mass_flow_rate_kg_s": design_mass_flow_rate_kg_s
        },
        "damper_a": damper_a_specs,
        "damper_b": damper_b_specs,
        "footprint_fit_feasible": footprint_available_sqm >= (required_damper_area_sqm * 3),
        "footprint_warning": clashing_alert,
        "tie_in_timeline": timeline
    }


def calculate_monthly_sec_tracking(
    baseline_sec_norm: float,
    logs: List[Dict[str, float]]
) -> Dict[str, Any]:
    """
    Accepts monthly energy and production inputs and charts the running SEC against targets.
    Logs format: [{"month_index": 1, "production_units": 1000.0, "energy_consumption_toe": 500.0}]
    """
    processed_months = []
    cumulative_shortfall_toe = 0.0
    
    for log in sorted(logs, key=lambda x: x["month_index"]):
        month = log["month_index"]
        prod = log["production_units"]
        energy = log["energy_consumption_toe"]
        
        # Calculate SEC
        actual_sec = energy / prod if prod > 0 else 0.0
        shortfall = max(0.0, actual_sec - baseline_sec_norm) * prod
        cumulative_shortfall_toe += shortfall
        
        processed_months.append({
            "month_index": month,
            "production_units": prod,
            "energy_consumption_toe": energy,
            "actual_sec": round(actual_sec, 4),
            "target_sec": baseline_sec_norm,
            "monthly_shortfall_toe": round(shortfall, 2),
            "cumulative_shortfall_toe": round(cumulative_shortfall_toe, 2)
        })
        
    return {
        "baseline_sec_norm": baseline_sec_norm,
        "months": processed_months,
        "cumulative_shortfall_total_toe": round(cumulative_shortfall_toe, 2)
    }
