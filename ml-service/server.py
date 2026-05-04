import os
import pickle
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

MODELS, SCALERS = {}, {}
SENSOR_TYPES = ["flood", "seismic", "fire", "gas"]
THRESHOLDS = {"flood": 180, "seismic": 5.5, "fire": 85, "gas": 1000}
UNITS = {"flood": "cm", "seismic": "richter", "fire": "celsius", "gas": "ppm"}


def _try_load_models():
    """Models are gitignored; service stays up without them (run train_models.py to generate)."""
    global MODELS, SCALERS
    MODELS, SCALERS = {}, {}
    try:
        import tensorflow as tf
    except ImportError as e:
        print(f"⚠️ TensorFlow not available: {e}")
        return

    for s in SENSOR_TYPES:
        model_path, scaler_path = f"models/{s}_lstm.h5", f"models/{s}_scaler.pkl"
        if not (os.path.isfile(model_path) and os.path.isfile(scaler_path)):
            print(f"⚠️ Skipping {s}: missing {model_path} or {scaler_path} (run train_models.py)")
            continue
        try:
            MODELS[s] = tf.keras.models.load_model(model_path)
            with open(scaler_path, "rb") as f:
                SCALERS[s] = pickle.load(f)
            print(f"✅ Loaded model: {s}")
        except Exception as ex:
            print(f"⚠️ Failed to load {s}: {ex}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Starting {app.title}…")
    _try_load_models()
    yield


app = FastAPI(title="AI Disaster ML Service", version="1.0.0", lifespan=lifespan)


class PredictRequest(BaseModel):
    sensor_type: str
    readings: list[float]


class PredictResponse(BaseModel):
    sensor_type: str
    prediction: str
    confidence: float
    is_disaster: bool
    threshold: float
    unit: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": list(MODELS.keys()),
        "models_ready": len(MODELS) == len(SENSOR_TYPES),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if req.sensor_type not in SENSOR_TYPES:
        raise HTTPException(400, f"Unknown sensor type: {req.sensor_type}")
    if len(req.readings) < 24:
        raise HTTPException(400, f"Need 24 readings, got {len(req.readings)}")
    if req.sensor_type not in MODELS:
        raise HTTPException(
            503,
            f"Model for '{req.sensor_type}' not loaded. Run train_models.py and ensure models/{req.sensor_type}_lstm.h5 exists.",
        )

    scaler = SCALERS[req.sensor_type]
    model = MODELS[req.sensor_type]

    arr = np.array(req.readings[-24:]).reshape(-1, 1)
    df = pd.DataFrame(arr, columns=["value"])
    scaled = scaler.transform(df).reshape(1, 24, 1)
    conf = float(model.predict(scaled, verbose=0)[0][0])
    is_dis = conf >= 0.5

    return PredictResponse(
        sensor_type=req.sensor_type,
        prediction="DISASTER" if is_dis else "NORMAL",
        confidence=round(conf, 4),
        is_disaster=is_dis,
        threshold=THRESHOLDS[req.sensor_type],
        unit=UNITS[req.sensor_type],
    )


@app.get("/models")
def model_info():
    return {"models": SENSOR_TYPES, "window_size": 24, "thresholds": THRESHOLDS, "loaded": list(MODELS.keys())}
