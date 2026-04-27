# Stage 1: Build the React application
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve the application
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js

# Cloud Run sets the PORT environment variable
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
