# First 3-Day Plan: Core Engine Foundations

## Day 1: Setup & Database Architecture
**Focus:** Establishing the foundational environment, project structure, and database schema.

### Tasks
- **Deployment:** Create a `docker-compose.yml` with just Postgres running locally.
- **Backend:** Scaffold the API server (using Node/TypeScript with Express or Fastify).
- **Database:** Design and run initial database migrations to create the core tables:
  - `queues`
  - `jobs`
  - `workers`
  - `job_events`
- **Database:** Add the composite index on `jobs(status, run_at, priority)` for optimized querying.

---

## Day 2: Job Ingestion & Validation
**Focus:** Building the API to accept jobs, validating payloads, and seeding data.

### Tasks
- **Backend:** Implement the `POST /queues` endpoint.
- **Backend:** Implement the `POST /queues/:queue/jobs` endpoint with strict schema validation.
- **Testing:** Write the first set of unit tests specifically for the payload validation logic.
- **Database:** Write a seed script to insert test jobs for manual testing in later stages.

---

## Day 3: Worker Execution & E2E Testing
**Focus:** Implementing the core locking mechanism, processing jobs, and verifying the end-to-end flow.

### Tasks
- **Backend:** Implement the job-claiming query (`UPDATE ... FOR UPDATE SKIP LOCKED`) as a standalone worker script.
- **Backend:** Build a basic handler registry (mapping `job.type` to a specific function) and include 2–3 fake handlers (e.g., simulate an email send with a delay).
- **Testing (Manual):** Perform an end-to-end manual test:
  1. Submit jobs via the API.
  2. Run the standalone worker script.
  3. Confirm correct status transitions in the database (`pending` → `running` → `completed`/`failed`).

---

### Expected Outcome by End of Day 3:
A single worker process can successfully claim jobs from Postgres using `SKIP LOCKED`, execute a fake handler from the registry, and correctly transition the job status. This proves the technical core of the system works.
