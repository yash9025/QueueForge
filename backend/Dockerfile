FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript code into optimized JS
RUN npm run build

# We don't specify a CMD or ENTRYPOINT here because we will override it in docker-compose.yml
# based on whether the container is the API, Worker, or Reaper.
