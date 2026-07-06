FROM node:22-alpine

WORKDIR /app

# Install dependencies first for Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# We don't specify a CMD or ENTRYPOINT here because we will override it in docker-compose.yml
# based on whether the container is the API, Worker, or Reaper.
