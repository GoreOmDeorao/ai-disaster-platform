import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import os

np.random.seed(42)
SAMPLES = 100000

def generate_flood_data():
    data = []
    t = datetime.now()
    level = 50.0
    for _ in range(SAMPLES):
        level += np.random.normal(0, 3)
        level = max(0, min(300, level))
        if np.random.random() < 0.02:
            level += np.random.uniform(50, 150)
        label = 1 if level >= 180 else 0
        data.append({"timestamp": t.isoformat(), "value": round(level, 2),
                     "unit": "cm", "label": label})
        t += timedelta(seconds=2)
    return pd.DataFrame(data)

def generate_seismic_data():
    data = []
    t = datetime.now()
    for _ in range(SAMPLES):
        base = abs(np.random.normal(1.5, 0.8))
        if np.random.random() < 0.02:
            base += np.random.uniform(3, 7)
        label = 1 if base >= 5.5 else 0
        data.append({"timestamp": t.isoformat(), "value": round(base, 2),
                     "unit": "richter", "label": label})
        t += timedelta(seconds=2)
    return pd.DataFrame(data)

def generate_fire_data():
    data = []
    t = datetime.now()
    temp = 35.0
    for _ in range(SAMPLES):
        temp += np.random.normal(0, 2)
        temp = max(10, min(150, temp))
        if np.random.random() < 0.02:
            temp += np.random.uniform(30, 80)
        label = 1 if temp >= 85 else 0
        data.append({"timestamp": t.isoformat(), "value": round(temp, 2),
                     "unit": "celsius", "label": label})
        t += timedelta(seconds=2)
    return pd.DataFrame(data)

def generate_gas_data():
    data = []
    t = datetime.now()
    ppm = 400.0
    for _ in range(SAMPLES):
        ppm += np.random.normal(0, 30)
        ppm = max(0, min(2000, ppm))
        if np.random.random() < 0.02:
            ppm += np.random.uniform(400, 800)
        label = 1 if ppm >= 1000 else 0
        data.append({"timestamp": t.isoformat(), "value": round(ppm, 2),
                     "unit": "ppm", "label": label})
        t += timedelta(seconds=2)
    return pd.DataFrame(data)

os.makedirs("data", exist_ok=True)

print("Generating flood data...")
generate_flood_data().to_csv("data/flood_data.csv", index=False)
print("Generating seismic data...")
generate_seismic_data().to_csv("data/seismic_data.csv", index=False)
print("Generating fire data...")
generate_fire_data().to_csv("data/fire_data.csv", index=False)
print("Generating gas data...")
generate_gas_data().to_csv("data/gas_data.csv", index=False)
print("✅ All training data generated — 400,000 rows total")
