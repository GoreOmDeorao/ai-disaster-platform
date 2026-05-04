#!/bin/bash

echo "=========================================="
echo "  AI Disaster Response Platform"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "Step 1: Starting Infrastructure (Kafka, PostgreSQL, Redis)..."
cd infra
docker-compose up -d
cd ..

echo ""
echo "Waiting for services to be ready..."
sleep 10

# Check if services are running
echo ""
echo "Step 2: Checking services..."
docker ps --format "table {{.Names}}\t{{.Status}}" | grep disaster

echo ""
echo "Step 3: Starting Backend (Go server)..."
cd backend
go run cmd/server/main.go &
BACKEND_PID=$!
cd ..

echo ""
echo "Step 4: Starting ML Service..."
cd ml-service
source venv/bin/activate 2>/dev/null || true
python server.py &
ML_PID=$!
cd ..

echo ""
echo "Step 5: Starting Sensor Simulator..."
cd sensor-simulator
pip install -q kafka-python 2>/dev/null
python main.py &
SIM_PID=$!
cd ..

echo ""
echo "=========================================="
echo "  All services started!"
echo "=========================================="
echo ""
echo "Services:"
echo "  - Backend API:    http://localhost:8080"
echo "  - ML Service:     http://localhost:8001"
echo "  - PostgreSQL:     localhost:5432"
echo "  - Kafka:          localhost:9092"
echo "  - Redis:          localhost:6379"
echo ""
echo "Frontend:"
echo "  - cd frontend && npm start"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "kill $BACKEND_PID $ML_PID $SIM_PID 2>/dev/null; echo ''; echo 'Stopping services...'" EXIT
wait
