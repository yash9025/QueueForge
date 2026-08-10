# QueueForge

[![CI](https://github.com/yash9025/QueueForge/actions/workflows/ci.yml/badge.svg)](https://github.com/yash9025/QueueForge/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)](https://www.docker.com/)

[![Typing SVG](https://readme-typing-svg.herokuapp.com?font=Inter&pause=1000&color=2496ED&width=800&lines=Production-grade+distributed+job+queue;Built+from+first+principles+on+PostgreSQL;Designed+for+reliability+and+scale)](https://git.io/typing-svg)

QueueForge is a robust, distributed job processing queue architected from first principles. Utilizing PostgreSQL as the primary source of truth, it provides durable job storage and reliable distribution to a pool of independent worker processes. The system guarantees exact retry mechanisms, graceful failure recovery, and strict exactly-once processing semantics without relying on external message brokers.

## Problem Statement

Modern distributed applications frequently require asynchronous execution of compute-intensive or latency-sensitive tasks (e.g., sending emails, report generation, video transcoding). Synchronous execution within the request/response cycle introduces fragility and latency. QueueForge addresses this by decoupling task submission from execution, durably persisting work items, and orchestrating a fleet of scalable workers to process them efficiently.

## System Design Architecture

The architecture eliminates the need for standalone message brokers by leveraging advanced PostgreSQL features for coordination.

```mermaid
flowchart TB
    subgraph External
        C[Client Applications]
    end

    subgraph API Layer
        API[REST API Server]
        Dash[Operator Dashboard]
    end

    subgraph Storage
        DB[(PostgreSQL Database)]
    end

    subgraph Computation
        W1[Worker Node 1]
        W2[Worker Node 2]
        W3[Worker Node 3]
        RP[Reaper Process]
    end

    C -->|POST /jobs| API
    API <-->|WebSocket| Dash
    API -->|INSERT jobs| DB
    
    DB <-->|SELECT FOR UPDATE SKIP LOCKED| W1
    DB <-->|SELECT FOR UPDATE SKIP LOCKED| W2
    DB <-->|SELECT FOR UPDATE SKIP LOCKED| W3
    
    RP -->|Polls & resets stuck jobs| DB

    classDef database fill:#336791,stroke:#fff,stroke-width:2px,color:#fff;
    classDef worker fill:#2496ED,stroke:#fff,stroke-width:2px,color:#fff;
    classDef api fill:#4CAF50,stroke:#fff,stroke-width:2px,color:#fff;
    
    class DB database;
    class W1,W2,W3,RP worker;
    class API,Dash api;
```

## Key Design Decisions

### PostgreSQL for Concurrency Control
Rather than introducing additional infrastructure overhead with tools like Redis or RabbitMQ, QueueForge utilizes PostgreSQL's `SELECT ... FOR UPDATE SKIP LOCKED`. This provides atomic, race-condition-free job claiming. The database ensures strong ACID guarantees for job durability while maintaining a streamlined technology stack.

### Lock-Free Horizontal Scaling
Workers utilize the `SKIP LOCKED` directive during the polling phase. If a worker process locks a specific record, subsequent worker queries immediately bypass the locked row and claim the next available job. This completely eliminates database contention and allows the worker pool to scale horizontally without blocking.

### Fault Tolerance and Dead Letter Queue (DLQ)
Jobs that encounter runtime exceptions are gracefully caught. The system increments an attempt counter and requeues the job utilizing an **exponential backoff** strategy. To prevent infinite processing loops (poison-pill jobs), any task exceeding the configured `max_attempts` threshold is automatically routed to a Dead Letter Queue (`status = 'dead_letter'`) for manual inspection.

### Autonomous Reaper Process
In distributed systems, worker nodes may experience catastrophic failures (e.g., OOM kills, hardware faults) while actively processing a job. Such jobs remain locked in a `running` state. QueueForge employs an independent **Reaper** process that continuously monitors worker health via heartbeats. If a worker fails to emit a heartbeat within the acceptable threshold, the Reaper forcibly reclaims the stalled jobs and resets them to a `pending` state for reassignment.

## Setup & Running Locally

QueueForge is fully containerized, ensuring a consistent environment across development and production.

```bash
# Clone the repository
git clone https://github.com/yash9025/QueueForge.git
cd QueueForge

# Provision the entire stack (API, Workers, Reaper, Postgres, Dashboard, Seeder)
docker compose up --build
```

### Services Exposed

- **API Server:** `http://localhost:3000`
- **Dashboard:** `http://localhost:5173`
  - *Default Credentials:* `admin` / `secret123`