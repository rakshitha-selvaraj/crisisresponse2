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

# Expose the port Cloud Run uses
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
