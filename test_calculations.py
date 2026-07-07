import pytest
from fastapi.testclient import TestClient
import calculations
from main import app
from database import get_db
import models
from database import Base, engine
from sqlalchemy.orm import sessionmaker

# Setup test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_patshield.db"
from sqlalchemy import create_engine
test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

Base.metadata.drop_all(bind=test_engine)
Base.metadata.create_all(bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

# ----------------- UNIT TESTS FOR CALCULATIONS -----------------

def test_calculate_urgency_penalty():
    # Input: Cement, energy=5000 toe, current_sec=0.08, prod=50000
    # Default target for Cement is 0.075.
    # Shortfall = 0.08 - 0.075 = 0.005.
    # Annual shortfall = 0.005 * 50000 = 250 toe.
    # Cumulative shortfall (3 years) = 750 toe.
    # Variable penalty = 750 * 1840 = 1,380,000 INR.
    # Total penalty = 1,000,000 (fixed) + 1,380,000 = 2,380,000 INR = 23.8 Lakh.
    
    res = calculations.calculate_urgency_penalty(
        industry_type="Cement",
        annual_energy_consumption_toe=5000.0,
        current_sec=0.08,
        annual_production_units=50000.0
    )
    
    assert res["sec_shortfall"] == pytest.approx(0.005)
    assert res["annual_shortfall_toe"] == pytest.approx(250.0)
    assert res["cumulative_shortfall_toe"] == pytest.approx(750.0)
    assert res["total_penalty_inr"] == pytest.approx(2380000.0)
    assert res["total_penalty_lakh"] == pytest.approx(23.80)


def test_technology_recommendations():
    # Test low temp: ORC (e.g. 120 C)
    res_orc = calculations.evaluate_technology_options(
        waste_temp_c=120.0,
        mass_flow_rate_kg_s=15.0,
        sulfur_content_pct=0.2,
        footprint_available_sqm=50.0
    )
    recs_orc = [r["technology"] for r in res_orc["recommendations"]]
    assert "ORC" in recs_orc
    assert "WHRB" not in recs_orc
    assert res_orc["recommendations"][0]["metallurgy_recommendation"] == "Carbon Steel"
    
    # Test high temp and high sulfur: WHRB & SS316 (e.g. 500 C, 0.8% sulfur)
    res_whrb = calculations.evaluate_technology_options(
        waste_temp_c=500.0,
        mass_flow_rate_kg_s=25.0,
        sulfur_content_pct=0.8,
        footprint_available_sqm=80.0
    )
    recs_whrb = [r["technology"] for r in res_whrb["recommendations"]]
    assert "WHRB" in recs_whrb
    assert "ORC" not in recs_whrb
    assert res_whrb["recommendations"][0]["metallurgy_recommendation"] == "Stainless Steel (SS316)"
    
    # Test mid temp: Economizer (e.g. 280 C)
    res_econ = calculations.evaluate_technology_options(
        waste_temp_c=280.0,
        mass_flow_rate_kg_s=20.0,
        sulfur_content_pct=0.1,
        footprint_available_sqm=60.0
    )
    recs_econ = [r["technology"] for r in res_econ["recommendations"]]
    assert "Economizer" in recs_econ


def test_derate_efficiency():
    # Design eff = 85%, at 100% load should be 85%
    assert calculations.derate_efficiency(0.85, 100.0) == 0.85
    # At 70% load, should drop to 78% (0.78)
    assert calculations.derate_efficiency(0.85, 70.0) == pytest.approx(0.78, abs=0.001)
    # At 50% load, drop is 50 * 0.002333 = 0.1166, efficiency = 0.85 - 0.1166 = 0.7333
    assert calculations.derate_efficiency(0.85, 50.0) == pytest.approx(0.7333, abs=0.001)


def test_simulate_part_load_profile():
    profile = [
        {"load_percentage": 100.0, "hours": 8.0},
        {"load_percentage": 70.0, "hours": 10.0}
    ]
    res = calculations.simulate_part_load_profile(
        tech_name="WHRB",
        waste_temp_c=500.0,
        design_mass_flow_rate_kg_s=20.0,
        profile=profile
    )
    
    # Verify we get two points
    assert len(res["simulation_points"]) == 2
    # Check linear derating in simulation
    p1 = res["simulation_points"][0]
    p2 = res["simulation_points"][1]
    assert p1["efficiency"] == 0.85
    assert p2["efficiency"] == pytest.approx(0.78, abs=0.001)


# ----------------- INTEGRATION TESTS FOR FASTAPI ENDPOINTS -----------------

def test_api_free_calculator():
    payload = {
        "industry_type": "Steel",
        "annual_energy_consumption_toe": 8000.0,
        "current_sec": 0.15,
        "annual_production_units": 40000.0
    }
    response = client.post("/api/free-urgency-calculator", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "headline_risk_statement" in data
    assert "total_penalty_lakh" in data
    assert data["inputs"]["industry_type"] == "Steel"


def test_api_subscription_state_machine_gating():
    # 1. Register a plant
    register_payload = {
        "email": "testplant@steel.in",
        "password": "securepassword",
        "plant_name": "Tata Steel Kalinganagar",
        "industry_type": "Steel",
        "annual_production_units": 60000.0,
        "baseline_sec_norm": 0.12,
        "current_sec": 0.14,
        "annual_energy_consumption_toe": 8400.0
    }
    reg_response = client.post("/api/register", json=register_payload)
    assert reg_response.status_code == 200
    reg_data = reg_response.json()
    plant_id = reg_data["plant_id"]
    token = reg_data["token"]
    
    # Verify starting state is 'free'
    # Try calling a Premium endpoint (Cost-of-Inaction). It should return 402 Payment Required.
    headers = {"Authorization": token}
    premium_res = client.post("/api/premium/cost-of-inaction", headers=headers)
    assert premium_res.status_code == 402
    assert "Premium subscription required" in premium_res.json()["detail"]
    
    # 2. Upgrade to 'active-paid'
    update_res = client.put(
        "/api/plant-profile/subscription",
        headers=headers,
        json={"tier": "active-paid"}
    )
    assert update_res.status_code == 200
    assert update_res.json()["new_subscription_tier"] == "active-paid"
    
    # Try calling Premium endpoint now. It should succeed (200 OK).
    premium_res_success = client.post("/api/premium/cost-of-inaction", headers=headers)
    assert premium_res_success.status_code == 200
    assert "forecast" in premium_res_success.json()
    
    # 3. Expire the subscription
    update_res_expire = client.put(
        "/api/plant-profile/subscription",
        headers=headers,
        json={"tier": "expired"}
    )
    assert update_res_expire.status_code == 200
    
    # Try calling Premium endpoint. It should return 403 Forbidden.
    premium_res_expired = client.post("/api/premium/cost-of-inaction", headers=headers)
    assert premium_res_expired.status_code == 403
    assert "Subscription expired" in premium_res_expired.json()["detail"]


if __name__ == "__main__":
    import sys
    # Allow running the test script directly
    pytest.main(sys.argv)
