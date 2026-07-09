# QueueForge ⚙️

![CI](https://github.com/yash9025/QueueForge/actions/workflows/ci.yml/badge.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)

A production-grade, distributed job queue built from first principles on top of PostgreSQL. Designed to demonstrate deep understanding of distributed systems, concurrency, and failure recovery.

## 🚀 Problem Statement

Modern applications frequently need to run work outside the request/response cycle (sending emails, video transcoding, etc). Doing this synchronously makes the system fragile. This project builds a distributed job queue that durably stores work and reliably distributes it to a pool of independent worker processes — with guarantees around retries, failure recovery, and exactly-once processing semantics.

## 🏛️ Architecture

QueueForge uses PostgreSQL as the single source of truth for coordination, leveraging `FOR UPDATE SKIP LOCKED` for atomic, race-condition-free job claiming without needing a separate message broker like Redis or RabbitMQ.

```text
[Client] 
   │ (POST /jobs)
   ▼
[REST API] ────(WebSocket)────> [Operator Dashboard]
   │
   │ (INSERT)
   ▼
[Postgres Database] <────(SKIP LOCKED)───── [Worker Pool (x3)]
   ▲                                              │
   │ (Clean stuck jobs)                           │
[Reaper Process] <────────────────────────────────┘
```

## 🧠 Key Design Decisions

### Why PostgreSQL over Redis/RabbitMQ?
Using Postgres's `SELECT ... FOR UPDATE SKIP LOCKED` provides safe concurrent job claiming without a separate broker. This simplifies the infrastructure stack (no Redis needed) while maintaining strong ACID guarantees for job durability.

### Concurrency & Locking
Workers use `SKIP LOCKED` when polling. If Worker A locks row 1, Worker B's query will instantly skip row 1 and lock row 2 instead of blocking. This allows horizontal scaling of workers without database contention.

### Failure Handling & DLQ
Jobs that throw exceptions are caught, and their `attempts` counter increments. They are requeued with an **exponential backoff** delay. If a job exceeds `max_attempts`, it is moved to a **Dead Letter Queue (DLQ)** (`status = 'dead_letter'`) to prevent poison-pill jobs from looping forever.

### The Reaper Process
If a worker crashes mid-job (OOM, killed), the job remains stuck in `running` state with a lock. The independent **Reaper** process runs every minute to find `running` jobs whose worker hasn't sent a heartbeat recently, forcibly returning them to `pending`.

## 🛠️ Setup & Running Locally

QueueForge is fully containerised. 

```bash
# Clone the repository
git clone https://github.com/yash9025/QueueForge.git
cd QueueForge

# Start the entire stack (API, 3x Workers, Reaper, Postgres, Dashboard, Seeder)
docker compose up --build
```

The stack will expose:
- **API Server:** `http://localhost:3000`
- **Dashboard:** `http://localhost:5173` (Login: `admin` / `secret123`)

## 🎤 Interview Talking Points

1. **"How do you prevent double-processing?"**
   We use Postgres row-level locks combined with `SKIP LOCKED`. The database guarantees that the `UPDATE` returning the row is atomic, so two workers can never claim the same job ID.

2. **"What happens when a worker crashes?"**
   The job stays locked in `running` state. However, workers emit a heartbeat every 5 seconds. The background Reaper process scans for jobs held by workers whose heartbeat is older than a threshold (e.g., 2 minutes) and resets them to `pending`.

3. **"How would you scale this further?"**
   Currently, we poll the database. At very high scale (>10k jobs/sec), polling adds load. I would introduce `LISTEN/NOTIFY` in Postgres to push wake-up events to workers, or partition the `jobs` table by queue name.

4. **"Why the separation of API and Workers?"**
   It allows asymmetric scaling. We can run 2 API nodes to handle web traffic, but 50 worker nodes to handle heavy CPU-bound background processing independently.