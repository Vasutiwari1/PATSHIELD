import httpx
import json

def run_demo():
    url = "http://127.0.0.1:8000/api/free-urgency-calculator"
    payload = {
        "industry_type": "Steel",
        "annual_energy_consumption_toe": 8000.0,
        "current_sec": 0.15,
        "annual_production_units": 40000.0
    }
    
    print("Sending request to Free Urgency Calculator:")
    print(json.dumps(payload, indent=2))
    
    try:
        response = httpx.post(url, json=payload, timeout=5.0)
        print("\nResponse Status Code:", response.status_code)
        print("Response Content:")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"\nFailed to connect to the server: {e}")

if __name__ == "__main__":
    run_demo()
