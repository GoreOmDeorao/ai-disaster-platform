#!/usr/bin/env python3
"""
Sensor Data Simulator - Generates realistic sensor readings and sends to Kafka
"""
import json
import random
import time
import os
from datetime import datetime
from kafka import KafkaProducer

KAFKA_BROKER = os.getenv("KAFKA_BROKERS", "localhost:9092")
TOPIC = "sensor-raw"

SENSORS = [
    {"id": "Flood-Sensor-Mumbai-01", "type": "flood", "location": "Mumbai, Maharashtra", "lat": 19.0760, "lon": 72.8777, "base": 50, "var": 30},
    {"id": "Flood-Sensor-Kolkata-01", "type": "flood", "location": "Kolkata, West Bengal", "lat": 22.5726, "lon": 88.3639, "base": 45, "var": 25},
    {"id": "Seismic-Sensor-Delhi-01", "type": "seismic", "location": "New Delhi, Delhi", "lat": 28.6139, "lon": 77.2090, "base": 2.0, "var": 1.5},
    {"id": "Seismic-Sensor-Nepal-01", "type": "seismic", "location": "Kathmandu Border", "lat": 27.7172, "lon": 85.3240, "base": 3.0, "var": 2.0},
    {"id": "Fire-Sensor-Chennai-01", "type": "fire", "location": "Chennai, Tamil Nadu", "lat": 13.0827, "lon": 80.2707, "base": 30, "var": 20},
    {"id": "Fire-Sensor-Odisha-01", "type": "fire", "location": "Bhubaneswar, Odisha", "lat": 20.2961, "lon": 85.8245, "base": 28, "var": 18},
    {"id": "Gas-Sensor-Bhopal-01", "type": "gas", "location": "Bhopal, MP", "lat": 23.2599, "lon": 77.4126, "base": 200, "var": 150},
    {"id": "Gas-Sensor-Vizag-01", "type": "gas", "location": "Visakhapatnam, AP", "lat": 17.6868, "lon": 83.2185, "base": 180, "var": 120},
    {"id": "Flood-Sensor-Assam-01", "type": "flood", "location": "Guwahati, Assam", "lat": 26.1445, "lon": 91.7362, "base": 55, "var": 35},
    {"id": "Seismic-Sensor-Gujarat-01", "type": "seismic", "location": "Bhuj, Gujarat", "lat": 23.2419, "lon": 69.6669, "base": 2.5, "var": 2.0},
]

UNITS = {"flood": "cm", "seismic": "richter", "fire": "celsius", "gas": "ppm"}

def create_reading(sensor, disaster_mode=False):
    if disaster_mode:
        # Generate high value for disaster simulation
        if sensor["type"] == "flood":
            value = random.uniform(180, 250)
        elif sensor["type"] == "seismic":
            value = random.uniform(5.5, 8.0)
        elif sensor["type"] == "fire":
            value = random.uniform(85, 120)
        else:
            value = random.uniform(1000, 2000)
    else:
        value = random.uniform(sensor["base"], sensor["base"] + sensor["var"])
    
    return {
        "sensor_id": sensor["id"],
        "sensor_type": sensor["type"],
        "value": round(value, 2),
        "unit": UNITS[sensor["type"]],
        "location": sensor["location"],
        "latitude": sensor["lat"],
        "longitude": sensor["lon"],
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

def main():
    print(f"Connecting to Kafka at {KAFKA_BROKER}...")
    try:
        producer = KafkaProducer(
            bootstrap_servers=[KAFKA_BROKER],
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            acks='all'
        )
        print("✅ Connected to Kafka")
    except Exception as e:
        print(f"❌ Failed to connect to Kafka: {e}")
        return

    print(f"Publishing to topic: {TOPIC}")
    print("Press Ctrl+C to stop\n")

    iteration = 0
    try:
        while True:
            # Every 20th iteration, trigger a disaster event for testing
            disaster_mode = (iteration % 20 == 0 and iteration > 0)
            
            for sensor in SENSORS:
                reading = create_reading(sensor, disaster_mode)
                producer.send(TOPIC, reading)
                
                status = "🚨 DISASTER" if disaster_mode else "✓"
                print(f"{status} {sensor['type'].upper():8} | {sensor['id']:30} | {reading['value']:8.2f} {reading['unit']}")
            
            producer.flush()
            iteration += 1
            
            # Normal: 3 second delay, Disaster: 1 second for rapid alerts
            time.sleep(1 if disaster_mode else 3)
            
    except KeyboardInterrupt:
        print("\n🛑 Stopping simulator...")
    finally:
        producer.close()

if __name__ == "__main__":
    main()
