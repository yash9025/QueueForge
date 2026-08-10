# QueueForge - Operator Dashboard

This directory contains the frontend Operator Dashboard for QueueForge, built with React, TypeScript, and Vite.

## Overview

The dashboard provides a real-time view into the QueueForge distributed job processing system. Operators can monitor the status of jobs, view worker health, and inspect items in the Dead Letter Queue (DLQ). It connects to the REST API via WebSockets for live updates.

For the complete project overview and system architecture, please refer to the [main project README](../README.md).

## Local Development

To run the frontend dashboard independently for development purposes:

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The dashboard will be available at `http://localhost:5173`.

> **Note:** The backend API and PostgreSQL database must be running to receive data on the dashboard. It is recommended to use the `docker compose up` command from the root directory to spin up the entire stack.
