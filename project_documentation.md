# Distributed Job Processing Queue
## Project Documentation & System Design

A production-grade, from-scratch job queue engine built for a placement portfolio.

---

## 1. Project Overview

### 1.1 What Problem This System Solves
Modern applications frequently need to run work outside the request/response cycle: sending emails, resizing images, generating PDFs, processing payments, syncing data, or running scheduled reports. Doing this synchronously blocks the user and makes the system fragile — a slow downstream service (e.g. an email provider) directly slows down or crashes the API.

This project builds a distributed job queue from first principles: a system that lets producers submit units of work (“jobs”), durably stores them, and reliably distributes them to a pool of independent worker processes for execution — with guarantees around retries, failure recovery, and exactly-once-ish processing (“at-least-once with idempotency support”).

### 1.2 Real-World Use Cases
- Transactional email / SMS dispatch after signup, checkout, or password reset
- Image/video processing pipelines (thumbnails, transcoding)
- Report generation and data export (CSV/PDF) that takes seconds to minutes
- Webhook delivery with retry-on-failure to third-party endpoints
- Scheduled/periodic tasks (nightly billing runs, cleanup jobs)
- Fan-out workloads where one event triggers many independent tasks

### 1.3 Target Users
Backend teams at small-to-mid-sized companies who need reliable background processing but don't want to operate a heavyweight message broker (Kafka, RabbitMQ) for moderate throughput (hundreds–low thousands of jobs/sec). This mirrors the real-world niche filled by tools like Sidekiq, BullMQ, and Postgres-backed queues such as pgmq or Oban.

### 1.4 Business Value
**Why this matters:** Background processing is one of the most common pieces of infrastructure in real production systems. Building it from scratch — rather than importing BullMQ — demonstrates that a candidate understands what these libraries do internally: locking, concurrency, retries, and failure isolation. That is precisely the depth interviewers probe for in system design rounds.

---

## 2. Core Features

Every feature below was selected because it maps to a real distributed-systems concept an interviewer will ask about.

| Feature | Why It's Included |
| :--- | :--- |
| Queue creation & namespacing | Models isolation between job types; teaches resource partitioning. |
| Job submission API | Core write path; teaches request validation and durable enqueue. |
| Delayed / scheduled jobs | Teaches time-based querying (`run_at`) instead of naive cron. |
| Priority queues | Teaches ordering semantics with a single extra column + index. |
| Worker registration & heartbeat | Core distributed-systems concept: liveness detection without a central server. |
| Concurrent job locking (`SKIP LOCKED`) | The single most important concept — how workers avoid double-processing. |
| Retry with exponential backoff | Teaches failure handling and backoff strategy design. |
| Dead Letter Queue (DLQ) | Teaches bounding failure — poison-pill jobs must not loop forever. |
| Job status tracking / lifecycle | State machine design — a classic interview whiteboard exercise. |
| Real-time metrics dashboard | Demonstrates full-stack ability and observability thinking. |
| JWT authentication | Baseline security — expected of any "production-ready" claim. |
| Basic rate limiting | Shows awareness of abuse/DoS protection on public endpoints. |

### Deliberately Excluded (and why)
- **Full RBAC / multi-role permissions:** Adds weeks of work for a concept not central to a queue system.
- **Caching layer (Redis):** The Postgres queries here are already indexed and fast at portfolio scale.
- **Kubernetes / service mesh:** Massive infra overhead for a single-developer, one-month project. Docker Compose is sufficient.
- **Multi-region / geo-replication:** Distributed-systems concept worth mentioning in "Future Improvements", not worth building now.

---

## 3. System Architecture

### 3.1 Overall Architecture
The system has four logical components, deployed as three separate processes so it is genuinely distributed:

1. **API Server:** Accepts job submissions, exposes endpoints, serves dashboard WebSocket stream (Stateless, 1+ instances).
2. **Worker Pool:** Polls for jobs, executes logic, reports results (N independent processes).
3. **PostgreSQL:** Single source of truth (1 instance / container).
4. **Dashboard (React):** Subscribes to live metrics over WebSocket (Static SPA).

### 3.2 Request Flow (Job Submission → Completion)
1. Client calls `POST /queues/{queue}/jobs` with a JSON payload. API server inserts a row into `jobs` with `status = pending`.
2. A free worker polls the DB (`SELECT ... WHERE status='pending' ORDER BY priority, run_at FOR UPDATE SKIP LOCKED LIMIT N`) and atomically claims jobs by updating `status = running` and `locked_by = worker_id`.
3. Worker executes the registered handler function for that job's type.
4. **On success:** worker updates `status = completed` and writes a `job_events` row.
5. **On failure:** worker increments `attempts`; if `< max_attempts`, `status` goes to `pending` with a backoff-delayed `run_at`; else `status = dead_letter`.
6. API server's WebSocket pushes updated metrics to the dashboard.

### 3.3 Why Postgres as the Broker (not Redis/RabbitMQ)
**Design Decision:** Postgres's `SELECT ... FOR UPDATE SKIP LOCKED` provides safe concurrent job claiming without a separate broker. This avoids running two pieces of infrastructure and keeps the system operable by one person, while being a legitimate real-world pattern.

**Trade-offs:**
- **Pros:** One less moving part; durable by default; SQL is easy to inspect/debug; strong consistency.
- **Cons:** Higher latency than an in-memory broker at very high throughput (>10k jobs/sec); polling adds slight delay vs push.

### 3.4 Communication Between Components
- **API ↔ Postgres:** Standard SQL over a connection pool.
- **Workers ↔ Postgres:** Same DB, separate connection pool per worker process.
- **API → Dashboard:** WebSocket push.
- **No direct Worker ↔ API communication:** The database is the single coordination point.

---

## 4. Database Design

### 4.1 Core Tables

**`queues`**
- `id`: UUID PK
- `name`: TEXT UNIQUE
- `created_at`: TIMESTAMPTZ

**`jobs`**
- `id`: UUID PK
- `queue_id`: UUID FK → `queues` (indexed)
- `type`: TEXT (maps to a registered handler)
- `payload`: JSONB
- `status`: TEXT (`pending` | `running` | `completed` | `failed` | `dead_letter`)
- `priority`: SMALLINT (lower = higher priority; default 0)
- `attempts`: INT (default 0)
- `max_attempts`: INT (default 5)
- `run_at`: TIMESTAMPTZ (supports delayed jobs; indexed)
- `locked_by`: TEXT (`worker_id`, nullable)
- `locked_at`: TIMESTAMPTZ (nullable)
- `last_error`: TEXT (nullable)
- `created_at` / `updated_at`: TIMESTAMPTZ

**`workers`**
- `id`: TEXT PK (e.g. `hostname-pid-uuid`)
- `status`: TEXT (`online` | `offline`)
- `last_heartbeat`: TIMESTAMPTZ (updated every N seconds)
- `current_job_id`: UUID (nullable)

**`job_events` (audit log)**
- Append-only table logging every status transition (`job_id`, `from_status`, `to_status`, `worker_id`, `created_at`).

### 4.2 Indexes
- `jobs (status, run_at, priority)`: Composite index used by the exact claiming query — the most important index in the system.
- `jobs (queue_id)`: Fast per-queue filtering.
- `workers (last_heartbeat)`: Fast scan to detect dead workers.

### 4.3 Crash Recovery (Reaper)
**Design Decision:** If a worker crashes while holding a job (`running`), the job would be stuck forever. A background reaper process periodically resets jobs where `locked_at` is older than a timeout back to `pending`.

---

## 5. API Design

All endpoints are prefixed with `/api/v1` and require a valid JWT (except health checks).

- `POST /queues`: Create a new named queue.
- `POST /queues/:queue/jobs`: Submit a new job to a queue.
- `GET /jobs/:id`: Fetch a single job's state/history.
- `GET /queues/:queue/jobs`: List jobs in a queue with pagination/filtering.
- `POST /jobs/:id/retry`: Manually requeue from `dead_letter` to `pending`.
- `POST /workers/heartbeat`: Called internally by workers every N seconds.
- `GET /metrics`: Aggregate stats for the dashboard.
- `GET /health`: Liveness/readiness probe.

**Validation:** Request bodies validated with Zod at the API boundary.

---

## 6. Worker Architecture

### 6.1 Polling Strategy
Each worker runs a loop: `poll → claim → execute → report → repeat`. Polling uses short intervals (e.g. 500ms–1s) with jitter.

### 6.2 Job Locking
The core query every worker runs:
```sql
UPDATE jobs SET status='running', locked_by=$1, locked_at=now() WHERE id IN (
  SELECT id FROM jobs 
  WHERE status='pending' AND run_at <= now() 
  ORDER BY priority ASC, run_at ASC 
  LIMIT $2 
  FOR UPDATE SKIP LOCKED
) RETURNING *;
```

### 6.3 Retry Strategy (Exponential Backoff)
On failure, next `run_at = now() + base_delay * 2^attempts` (capped at max delay), with jitter. Once `attempts >= max_attempts`, the job moves to `dead_letter`.

---

## 7. Security
- **JWT Authentication:** Simple `POST /auth/login` to issue access tokens.
- **Input Validation:** Zod schemas prevent malformed payloads.
- **Rate Limiting:** Token-bucket rate limiter on job-submission endpoint.

---

## 8. Performance
- **Database Indexing:** The composite index on `(status, run_at, priority)` is critical.
- **Batch Processing:** Workers claim jobs in small batches (e.g. 5-10) to reduce round-trips.
- **Caching:** Intentionally excluded, as indexed Postgres queries return in single-digit ms at this scale.

---

## 9. Deployment
- **Docker Compose:** `docker-compose.yml` runs the full system locally: `postgres`, `api`, `worker` (scaled), and `dashboard`.

---

## 10. Testing
- **Unit Testing:** Backoff calculation, schema validation.
- **API Testing:** Integration tests against a real test DB.
- **Worker Testing:** Spin up workers against a seeded DB, assert `SKIP LOCKED` behavior with concurrency.
- **Failure/Retry Testing:** Assert exponential backoff calculations and dead-letter logic.

---

## 11. Future Improvements (Talking Points)
- `LISTEN/NOTIFY` push-based job claiming to cut poll latency.
- Per-queue scoped API keys.
- Job dependency graphs (DAGs).
- Sharding the jobs table.
- Distributed tracing.
- Horizontal autoscaling based on queue depth.
