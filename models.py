from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base

class Plant(Base):
    __tablename__ = "plants"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    plant_name = Column(String, nullable=False)
    industry_type = Column(String, nullable=False)  # Textile, Steel, Cement, Chemical, Refinery, Other
    subscription_tier = Column(String, default="free")  # free, active-paid, expired
    
    # Baseline Parameters
    annual_production_units = Column(Float, nullable=False, default=10000.0)
    baseline_sec_norm = Column(Float, nullable=False, default=0.5)  # toe per unit production
    current_sec = Column(Float, nullable=False, default=0.6)  # toe per unit production
    annual_energy_consumption_toe = Column(Float, nullable=False, default=6000.0)

    # Roadmap Scaling Layer - CCTS (Carbon Credit Trading Scheme)
    ccts_emission_factor_tco2e_per_toe = Column(Float, default=2.5)  # standard emission factor
    ccts_carbon_credit_price_inr = Column(Float, default=1500.0)  # carbon price per tCO2e

    # Roadmap Scaling Layer - RPO (Renewable Purchase Obligation)
    rpo_total_electricity_mwh = Column(Float, default=12000.0)
    rpo_renewable_share_pct = Column(Float, default=15.0)  # percentage of green power
    rpo_solar_purchase_obligation_mwh = Column(Float, default=1200.0)
    rpo_non_solar_purchase_obligation_mwh = Column(Float, default=600.0)
    rpo_rec_price_inr_per_mwh = Column(Float, default=1000.0)  # REC price floor

    # Relationships
    monthly_logs = relationship("MonthlyPlantLog", back_populates="plant", cascade="all, delete-orphan")
    whr_systems = relationship("WHRSystemConfiguration", back_populates="plant", cascade="all, delete-orphan")
    escert_ledger = relationship("ESCertLedgerEntry", back_populates="plant", cascade="all, delete-orphan")


class MonthlyPlantLog(Base):
    __tablename__ = "monthly_plant_logs"

    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    month_index = Column(Integer, nullable=False)  # 1 to 36 (covering 3-year compliance cycle)
    production_units = Column(Float, nullable=False)
    energy_consumption_toe = Column(Float, nullable=False)
    calculated_sec = Column(Float, nullable=False)  # toe/unit production
    
    # CCTS tracking
    calculated_co2_emissions_tco2e = Column(Float, default=0.0)
    
    # RPO tracking
    electricity_consumed_mwh = Column(Float, default=0.0)
    renewable_electricity_consumed_mwh = Column(Float, default=0.0)

    plant = relationship("Plant", back_populates="monthly_logs")


class WHRSystemConfiguration(Base):
    __tablename__ = "whr_system_configurations"

    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    system_name = Column(String, default="Main Flue Gas WHR")
    
    # Design Inputs
    waste_stream_temperature_c = Column(Float, nullable=False)
    waste_stream_mass_flow_rate_kg_s = Column(Float, nullable=False)
    flue_gas_sulfur_content_pct = Column(Float, default=0.0)
    footprint_available_sqm = Column(Float, default=50.0)
    selected_technology = Column(String, nullable=True)  # Economizer, WHRB, ORC, None
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Calculated Sizing Outputs
    heat_recovery_capacity_kw = Column(Float, default=0.0)
    heat_transfer_area_sqm = Column(Float, default=0.0)
    tube_outside_diameter_mm = Column(Float, default=0.0)
    tube_wall_thickness_mm = Column(Float, default=0.0)
    metallurgy_recommendation = Column(String, default="Carbon Steel")
    
    # Calculated Financial Outputs
    estimated_capex_inr = Column(Float, default=0.0)
    annual_savings_inr = Column(Float, default=0.0)
    payback_period_years = Column(Float, default=0.0)
    escerts_generated_annual = Column(Float, default=0.0)
    co2_avoided_tco2e_annual = Column(Float, default=0.0)

    plant = relationship("Plant", back_populates="whr_systems")


class ESCertLedgerEntry(Base):
    __tablename__ = "escert_ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    year = Column(Integer, nullable=False)
    escerts_credited = Column(Float, default=0.0)  # positive values mean certificates earned
    escerts_debited = Column(Float, default=0.0)   # positive values mean certificates sold/used
    status = Column(String, default="Estimated")   # Estimated, Verified, Traded
    monetization_value_inr = Column(Float, default=0.0)
    
    # CCTS scale extension
    ccts_credits_earned = Column(Float, default=0.0)
    
    # RPO scale extension
    rpo_recs_earned = Column(Float, default=0.0)
    
    transaction_date = Column(DateTime, default=datetime.utcnow)

    plant = relationship("Plant", back_populates="escert_ledger")
