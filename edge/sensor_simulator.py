#!/usr/bin/env python3
"""Kafka sensor simulator — India network (10 nodes)."""
import argparse
import json
import random
import sys
import time
from datetime import datetime, timezone

from kafka import KafkaProducer

TOPIC = "sensor-raw"

SENSORS = [
    {"id": "Flood-Sensor-Mumbai-01", "type": "flood", "lat": 19.076, "lon": 72.878, "location": "Mumbai, Maharashtra", "base": 50, "var": 30},
    {"id": "Flood-Sensor-Kolkata-01", "type": "flood", "lat": 22.573, "lon": 88.364, "location": "Kolkata, West Bengal", "base": 45, "var": 25},
    {"id": "Flood-Sensor-Assam-01", "type": "flood", "lat": 26.145, "lon": 91.736, "location": "Guwahati, Assam", "base": 55, "var": 35},
    {"id": "Seismic-Sensor-Delhi-01", "type": "seismic", "lat": 28.614, "lon": 77.209, "location": "New Delhi, Delhi", "base": 2.0, "var": 1.5},
    {"id": "Seismic-Sensor-Nepal-01", "type": "seismic", "lat": 27.717, "lon": 85.324, "location": "Kathmandu Border", "base": 3.0, "var": 2.0},
    {"id": "Seismic-Sensor-Gujarat-01", "type": "seismic", "lat": 23.242, "lon": 69.667, "location": "Bhuj, Gujarat", "base": 2.5, "var": 2.0},
    {"id": "Fire-Sensor-Chennai-01", "type": "fire", "lat": 13.083, "lon": 80.271, "location": "Chennai, Tamil Nadu", "base": 30, "var": 20},
    {"id": "Fire-Sensor-Odisha-01", "type": "fire", "lat": 20.296, "lon": 85.825, "location": "Bhubaneswar, Odisha", "base": 28, "var": 18},
    {"id": "Gas-Sensor-Bhopal-01", "type": "gas", "lat": 23.260, "lon": 77.413, "location": "Bhopal, MP", "base": 200, "var": 150},
    {"id": "Gas-Sensor-Vizag-01", "type": "gas", "lat": 17.687, "lon": 83.219, "location": "Visakhapatnam, AP", "base": 180, "var": 120},
]

THRESH = {"flood": 180, "seismic": 5.5, "fire": 85, "gas": 1000}
UNITS = {"flood": "cm", "seismic": "richter", "fire": "celsius", "gas": "ppm"}


def spike_value(stype: str) -> float:
    t = THRESH[stype]
    return random.uniform(t * 1.5, t * 3.0)


def normal_value(s: dict) -> float:
    return random.uniform(s["base"], s["base"] + s["var"])


def make_reading(sensor: dict, disaster: bool) -> dict:
    st = sensor["type"]
    v = spike_value(st) if disaster else normal_value(sensor)
    return {
        "sensor_id": sensor["id"],
        "sensor_type": st,
        "value": round(v, 2),
        "unit": UNITS[st],
        "location": sensor["location"],
        "latitude": sensor["lat"],
        "longitude": sensor["lon"],
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def run_demo(producer: KafkaProducer) -> None:
    order = ["flood", "seismic", "fire", "gas"]
    for typ in order:
        sensor = next(s for s in SENSORS if s["type"] == typ)
        r = make_reading(sensor, True)
        producer.send(TOPIC, r)
        print(f"🚨 DEMO {typ.upper()} DISASTER at {sensor['location']} | {r['value']} {r['unit']}")
    producer.flush()
    print("\n✅ Demo complete (one spike per disaster type).")


def run_loop(mode: str, broker: str) -> None:
    try:
        producer = KafkaProducer(
            bootstrap_servers=[broker],
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            acks="all",
        )
    except Exception as e:
        print(f"❌ Kafka: {e}", file=sys.stderr)
        sys.exit(1)

    if mode == "demo":
        print(f"✅ Kafka {broker} topic={TOPIC} mode=demo\n")
        run_demo(producer)
        producer.close()
        return

    print(f"✅ Kafka {broker} topic={TOPIC} mode={mode}\n")
    iteration = 0
    burst_left = 0
    burst_idx = 0

    try:
        while True:
            disaster_all = mode == "disaster" and iteration > 0 and iteration % 20 == 0
            disaster_this = False
            if mode == "normal":
                if burst_left <= 0 and iteration > 0 and iteration % 60 == 0:
                    burst_idx = random.randrange(len(SENSORS))
                    burst_left = random.randint(3, 5)
                    s = SENSORS[burst_idx]
                    print(f"🚨 SIMULATING {s['type'].upper()} DISASTER at {s['location']}", flush=True)
                disaster_this = burst_left > 0

            for i, sensor in enumerate(SENSORS):
                d = False
                if mode == "normal":
                    d = disaster_this and i == burst_idx
                elif mode == "disaster":
                    d = disaster_all
                reading = make_reading(sensor, d)
                producer.send(TOPIC, reading)
                tag = "🚨" if d else "✓"
                print(f"{tag} {sensor['type']:8} | {sensor['id']:30} | {reading['value']:8.2f} {reading['unit']}")

            if mode == "normal" and disaster_this:
                burst_left -= 1

            producer.flush()
            iteration += 1
            time.sleep(1 if disaster_all else 3)
    except KeyboardInterrupt:
        print("\n🛑 Stopped.")
    finally:
        producer.close()


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--mode", choices=("normal", "disaster", "demo"), default="normal")
    p.add_argument("--broker", default="localhost:9092")
    args = p.parse_args()
    run_loop(args.mode, args.broker)


if __name__ == "__main__":
    main()
