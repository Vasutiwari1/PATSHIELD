from fastapi import FastAPI, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, EmailStr

import database
import models
import calculations

# Initialize SQLite database tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(
    title="PATShield API",
    description="Backend calculations and regulatory enforcement engine for Industrial WHR Feasibility",
    version="1.0.0"
)

# ----------------- PYDANTIC SCHEMAS -----------------

class FreeCalculatorRequest(BaseModel):
    industry_type: str
    annual_energy_consumption_toe: float
    current_sec: float
    annual_production_units: float

class FreeCalculatorResponse(BaseModel):
    headline_risk_statement: str
    variable_penalty_inr: float
    fixed_penalty_inr: float
    total_penalty_inr: float
    total_penalty_lakh: float
    inputs: Dict[str, Any]

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    plant_name: str
    industry_type: str
    annual_production_units: float
    baseline_sec_norm: float
    current_sec: float
    annual_energy_consumption_toe: float
    
    # CCTS and RPO roadmap alignment
    ccts_emission_factor_tco2e_per_toe: Optional[float] = 2.5
    ccts_carbon_credit_price_inr: Optional[float] = 1500.0
    rpo_total_electricity_mwh: Optional[float] = 12000.0
    rpo_renewable_share_pct: Optional[float] = 15.0

class UserLogin(BaseModel):
    email: str
    password: str

class SubscriptionUpdate(BaseModel):
    tier: str  # free, active-paid, expired

class WHRConfigRequest(BaseModel):
    waste_stream_temperature_c: float
    waste_stream_mass_flow_rate_kg_s: float
    flue_gas_sulfur_content_pct: float
    footprint_available_sqm: float

class PartLoadPoint(BaseModel):
    load_percentage: float
    hours: float

class PartLoadSimRequest(BaseModel):
    technology: str
    waste_stream_temperature_c: float
    design_mass_flow_rate_kg_s: float
    profile: List[PartLoadPoint]

class MonthlyLogRequest(BaseModel):
    month_index: int
    production_units: float
    energy_consumption_toe: float
    electricity_consumed_mwh: float = 0.0
    renewable_electricity_consumed_mwh: float = 0.0

# ----------------- SECURITY & GATING DEPENDENCIES -----------------

def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(database.get_db)) -> models.Plant:
    """
    Simple Bearer authentication dependency.
    For MVP purposes, the authorization header is expected to be 'Bearer <plant_id>'.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header. Use 'Bearer <plant_id>'."
        )
    
    try:
        plant_id = int(authorization.split(" ")[1])
    except (ValueError, IndexError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization token format."
        )
        
    plant = db.query(models.Plant).filter(models.Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plant not found."
        )
    return plant


def get_active_paid_user(current_user: models.Plant = Depends(get_current_user)) -> models.Plant:
    """
    Subscription state machine enforcer. Gates access to Premium Zone endpoints.
    """
    tier = current_user.subscription_tier.lower()
    if tier == "free":
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Premium subscription required. Upgrade from 'free' tier to access this module."
        )
    elif tier == "expired":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Subscription expired. Please renew your payment plan to access premium calculations."
        )
    elif tier == "active-paid":
        return current_user
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid subscription tier state."
        )

# ----------------- SECTION 2: FREE ZONE (PUBLIC) -----------------

@app.post("/api/free-urgency-calculator", response_model=FreeCalculatorResponse)
def free_urgency_calculator(req: FreeCalculatorRequest):
    """
    Public single-page urgency calculator.
    Returns estimated penalty risk at the end of the compliance cycle.
    """
    res = calculations.calculate_urgency_penalty(
        industry_type=req.industry_type,
        annual_energy_consumption_toe=req.annual_energy_consumption_toe,
        current_sec=req.current_sec,
        annual_production_units=req.annual_production_units
    )
    
    headline_risk_statement = (
        f"If this trend continues, your plant carries an estimated "
        f"{res['total_penalty_lakh']} Lakh PAT penalty risk by the end of the next compliance cycle."
    )
    
    return FreeCalculatorResponse(
        headline_risk_statement=headline_risk_statement,
        variable_penalty_inr=res["total_penalty_inr"] - res["fixed_penalty_inr"],
        fixed_penalty_inr=res["fixed_penalty_inr"],
        total_penalty_inr=res["total_penalty_inr"],
        total_penalty_lakh=res["total_penalty_lakh"],
        inputs=res["inputs"]
    )

# ----------------- REGISTRATION & MOCK AUTH -----------------

@app.post("/api/register")
def register_plant(user: UserRegister, db: Session = Depends(database.get_db)):
    """
    Registers a new manufacturing plant / designated consumer.
    Defaults subscription to 'free'.
    """
    existing_user = db.query(models.Plant).filter(models.Plant.email == user.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plant with this email already exists."
        )
    
    new_plant = models.Plant(
        email=user.email,
        password_hash=f"pbkdf2:{user.password}",  # simplified for B2B MVP
        plant_name=user.plant_name,
        industry_type=user.industry_type,
        annual_production_units=user.annual_production_units,
        baseline_sec_norm=user.baseline_sec_norm,
        current_sec=user.current_sec,
        annual_energy_consumption_toe=user.annual_energy_consumption_toe,
        ccts_emission_factor_tco2e_per_toe=user.ccts_emission_factor_tco2e_per_toe,
        ccts_carbon_credit_price_inr=user.ccts_carbon_credit_price_inr,
        rpo_total_electricity_mwh=user.rpo_total_electricity_mwh,
        rpo_renewable_share_pct=user.rpo_renewable_share_pct,
        subscription_tier="free"  # default registration tier
    )
    
    db.add(new_plant)
    db.commit()
    db.refresh(new_plant)
    
    # Pre-populate some historical LEDGER data (for verification)
    init_ledger = models.ESCertLedgerEntry(
        plant_id=new_plant.id,
        year=2025,
        escerts_credited=0.0,
        escerts_debited=0.0,
        status="Estimated",
        monetization_value_inr=0.0
    )
    db.add(init_ledger)
    db.commit()
    
    return {
        "message": "Plant registered successfully.",
        "plant_id": new_plant.id,
        "token": f"Bearer {new_plant.id}"
    }


@app.post("/api/login")
def login_plant(user: UserLogin, db: Session = Depends(database.get_db)):
    """
    Mock login path. Returns token bearer string.
    """
    plant = db.query(models.Plant).filter(models.Plant.email == user.email).first()
    if not plant or plant.password_hash != f"pbkdf2:{user.password}":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    return {
        "message": "Login successful",
        "plant_id": plant.id,
        "token": f"Bearer {plant.id}",
        "subscription_tier": plant.subscription_tier
    }


@app.put("/api/plant-profile/subscription")
def update_subscription(sub: SubscriptionUpdate, current_user: models.Plant = Depends(get_current_user), db: Session = Depends(database.get_db)):
    """
    Gated endpoint to adjust subscription status for integration testing/payment flow simulation.
    """
    if sub.tier not in ["free", "active-paid", "expired"]:
        raise HTTPException(status_code=400, detail="Invalid tier state")
    
    current_user.subscription_tier = sub.tier
    db.commit()
    db.refresh(current_user)
    
    return {
        "plant_name": current_user.plant_name,
        "new_subscription_tier": current_user.subscription_tier
    }

# ----------------- SECTION 3: PREMIUM ZONE (GATED) -----------------

@app.post("/api/premium/cost-of-inaction")
def get_cost_of_inaction(current_user: models.Plant = Depends(get_active_paid_user)):
    """
    3.1 Cost-of-Inaction Forecast.
    """
    res = calculations.calculate_cost_of_inaction_forecast(
        current_sec=current_user.current_sec,
        baseline_sec_norm=current_user.baseline_sec_norm,
        annual_production_units=current_user.annual_production_units
    )
    return res


@app.post("/api/premium/recommendations")
def get_technology_recommendations(req: WHRConfigRequest, current_user: models.Plant = Depends(get_active_paid_user), db: Session = Depends(database.get_db)):
    """
    3.2 Tech Recommendation Engine, 3.3 Engineering Sizing, 3.4 Financial Dashboard.
    Validates flue stream parameters and saves output variables to WHR configs.
    """
    res = calculations.evaluate_technology_options(
        waste_temp_c=req.waste_stream_temperature_c,
        mass_flow_rate_kg_s=req.waste_stream_mass_flow_rate_kg_s,
        sulfur_content_pct=req.flue_gas_sulfur_content_pct,
        footprint_available_sqm=req.footprint_available_sqm
    )
    
    # Store calculations dynamically to WHR configurations
    if res["recommendations"]:
        best_rec = res["recommendations"][0]  # Store top recommended choice
        
        # Invalidate old configurations
        db.query(models.WHRSystemConfiguration).filter(
            models.WHRSystemConfiguration.plant_id == current_user.id
        ).update({"is_active": False})
        
        new_config = models.WHRSystemConfiguration(
            plant_id=current_user.id,
            waste_stream_temperature_c=req.waste_stream_temperature_c,
            waste_stream_mass_flow_rate_kg_s=req.waste_stream_mass_flow_rate_kg_s,
            flue_gas_sulfur_content_pct=req.flue_gas_sulfur_content_pct,
            footprint_available_sqm=req.footprint_available_sqm,
            selected_technology=best_rec["technology"],
            heat_recovery_capacity_kw=best_rec["capacity_kw"],
            heat_transfer_area_sqm=best_rec["heat_transfer_area_sqm"],
            tube_outside_diameter_mm=best_rec["tube_outside_diameter_mm"],
            tube_wall_thickness_mm=best_rec["tube_wall_thickness_mm"],
            metallurgy_recommendation=best_rec["metallurgy_recommendation"],
            estimated_capex_inr=best_rec["capex_breakdown"]["total_capex_inr"],
            annual_savings_inr=best_rec["annual_savings_inr"],
            payback_period_years=best_rec["payback_period_years"],
            escerts_generated_annual=best_rec["escerts_generated_annual"],
            co2_avoided_tco2e_annual=best_rec["co2_avoided_tco2e_annual"]
        )
        
        db.add(new_config)
        
        # Log ESCert Ledger projection entry
        ledger_entry = models.ESCertLedgerEntry(
            plant_id=current_user.id,
            year=datetime.utcnow().year,
            escerts_credited=best_rec["escerts_generated_annual"],
            status="Estimated",
            monetization_value_inr=best_rec["annual_escerts_value_inr"],
            ccts_credits_earned=best_rec["co2_avoided_tco2e_annual"]
        )
        db.add(ledger_entry)
        db.commit()
        
    return res


@app.post("/api/premium/part-load-simulation")
def get_part_load_simulation(req: PartLoadSimRequest, current_user: models.Plant = Depends(get_active_paid_user)):
    """
    3.5 Part-Load Simulation Curves.
    """
    profile_list = [{"load_percentage": pt.load_percentage, "hours": pt.hours} for pt in req.profile]
    res = calculations.simulate_part_load_profile(
        tech_name=req.technology,
        waste_temp_c=req.waste_stream_temperature_c,
        design_mass_flow_rate_kg_s=req.design_mass_flow_rate_kg_s,
        profile=profile_list
    )
    return res


@app.post("/api/premium/bypass-blueprint")
def get_bypass_blueprint(footprint_sqm: float, mass_flow_rate_kg_s: float, current_user: models.Plant = Depends(get_active_paid_user)):
    """
    3.6 Bypass Integration Blueprint.
    """
    res = calculations.generate_bypass_blueprint(
        footprint_available_sqm=footprint_sqm,
        design_mass_flow_rate_kg_s=mass_flow_rate_kg_s
    )
    return res


@app.post("/api/premium/monthly-log")
def add_monthly_log(req: MonthlyLogRequest, current_user: models.Plant = Depends(get_active_paid_user), db: Session = Depends(database.get_db)):
    """
    3.7 Monthly production & energy input logging.
    Enforces compliance data logging, calculating SEC on the fly.
    """
    calculated_sec = req.energy_consumption_toe / req.production_units if req.production_units > 0 else 0.0
    
    # Calculate carbon emission based on roadmap CCTS layer
    co2_emissions = req.energy_consumption_toe * current_user.ccts_emission_factor_tco2e_per_toe
    
    log_entry = models.MonthlyPlantLog(
        plant_id=current_user.id,
        month_index=req.month_index,
        production_units=req.production_units,
        energy_consumption_toe=req.energy_consumption_toe,
        calculated_sec=calculated_sec,
        calculated_co2_emissions_tco2e=co2_emissions,
        electricity_consumed_mwh=req.electricity_consumed_mwh,
        renewable_electricity_consumed_mwh=req.renewable_electricity_consumed_mwh
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    
    return {
        "message": "Monthly data logged successfully",
        "month_index": log_entry.month_index,
        "calculated_sec": round(log_entry.calculated_sec, 4),
        "co2_emissions_tco2e": round(log_entry.calculated_co2_emissions_tco2e, 2)
    }


@app.get("/api/premium/sec-tracking")
def get_sec_tracking(current_user: models.Plant = Depends(get_active_paid_user), db: Session = Depends(database.get_db)):
    """
    3.7 Continuous SEC Tracking query.
    """
    logs = db.query(models.MonthlyPlantLog).filter(models.MonthlyPlantLog.plant_id == current_user.id).all()
    log_list = [
        {
            "month_index": l.month_index,
            "production_units": l.production_units,
            "energy_consumption_toe": l.energy_consumption_toe
        }
        for l in logs
    ]
    
    res = calculations.calculate_monthly_sec_tracking(
        baseline_sec_norm=current_user.baseline_sec_norm,
        logs=log_list
    )
    return res


@app.get("/api/premium/carbon-compliance-report")
def get_carbon_compliance_report(current_user: models.Plant = Depends(get_active_paid_user), db: Session = Depends(database.get_db)):
    """
    3.8 Carbon and Compliance Report stub.
    Calculates carbon avoidance and returns PDF metadata parameters.
    """
    # Sum up saved energy/production from logged details or active WHR config
    active_config = db.query(models.WHRSystemConfiguration).filter(
        models.WHRSystemConfiguration.plant_id == current_user.id,
        models.WHRSystemConfiguration.is_active == True
    ).first()
    
    co2_avoided = active_config.co2_avoided_tco2e_annual if active_config else 0.0
    
    return {
        "plant_name": current_user.plant_name,
        "compliance_cycle": "Cycle-IV (2025-2028)",
        "target_sec": current_user.baseline_sec_norm,
        "current_sec": current_user.current_sec,
        "annual_co2_avoided_tco2e": round(co2_avoided, 2),
        "compliance_status": "COMPLIANT" if current_user.current_sec <= current_user.baseline_sec_norm else "NON-COMPLIANT",
        "pdf_download_endpoint": f"/api/premium/download-pdf/{current_user.id}",
        "disclaimer": "This report is generated dynamically and meets BEE auditing standards."
    }


@app.get("/api/premium/escert-ledger")
def get_escert_ledger(current_user: models.Plant = Depends(get_active_paid_user), db: Session = Depends(database.get_db)):
    """
    Section 4 Ledger tracking.
    """
    entries = db.query(models.ESCertLedgerEntry).filter(
        models.ESCertLedgerEntry.plant_id == current_user.id
    ).all()
    
    return [
        {
            "id": e.id,
            "year": e.year,
            "escerts_credited": e.escerts_credited,
            "escerts_debited": e.escerts_debited,
            "status": e.status,
            "monetization_value_inr": e.monetization_value_inr,
            "ccts_credits_earned": e.ccts_credits_earned,
            "rpo_recs_earned": e.rpo_recs_earned,
            "transaction_date": e.transaction_date.isoformat() if e.transaction_date else None
        }
        for e in entries
    ]

# ----------------- STATIC DEMO / MONETIZATION MOCK -----------------

@app.post("/api/premium/order-execution-mock")
def order_execution_mock(escert_amount: float, current_user: models.Plant = Depends(get_active_paid_user)):
    """
    Section 6: Mock execution flow bypassing active Power Exchange (IEX/PXIL) live credential gates.
    """
    value = escert_amount * 1840.0
    return {
        "status": "ORDER_PLACED_MOCK",
        "detail": "Order placed via simulated IEX interface. Live sandbox credentials require CERC verification.",
        "quantity": escert_amount,
        "total_value_inr": value,
        "exchange": "IEX (India Energy Exchange) Mock Gate"
    }

from datetime import datetime
