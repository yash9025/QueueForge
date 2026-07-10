#!/bin/bash
set -e

echo "🚀 Starting Chaos Test for QueueForge..."

# 1. Start the stack in the background
echo "📦 Spinning up Docker Compose stack..."
docker compose up -d
echo "⏳ Waiting 10s for API and DB to be fully ready..."
sleep 10

# 2. Generate a valid Admin JWT token using Node
echo "🔑 Generating JWT token..."
TOKEN=$(node -e "console.log(require('jsonwebtoken').sign({ username: 'admin' }, process.env.JWT_SECRET || 'fallback-super-secret-key', { expiresIn: '1h' }))")

# 3. Start the K6 load test in the background
echo "🔥 Starting k6 load test (Target: ~10,000 jobs)..."
k6 run -e TOKEN=$TOKEN tests/k6-load-test.js &
K6_PID=$!

# Wait for load to ramp up and workers to be fully saturated
sleep 15

# 4. Chaos Injection: Kill a worker mid-execution
echo "💣 CHAOS INJECTION: Killing queueforge-worker-2 mid-execution..."
# Use docker kill for a hard exit (simulating OOM or power failure)
docker kill queueforge-worker-2-1 || echo "Could not find worker-2 container, skipping kill."

# 5. Wait for the load test to finish submitting jobs
echo "⏳ Waiting for k6 to finish submitting jobs..."
wait $K6_PID

echo "✅ Load test complete."
echo "🔎 The Reaper process (runs every 60s) will now detect the jobs that were locked by worker-2."
echo "🔎 It will move them back to 'pending' so worker-1 and worker-3 can finish them."

# 6. Bring worker-2 back online to help clear the backlog
echo "🧹 Re-starting worker-2 to help drain the remaining queue..."
docker compose up -d worker-2

echo "🎉 Chaos test initiated! Open your dashboard at http://localhost:5173 to watch the system recover!"
