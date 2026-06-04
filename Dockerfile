FROM node:20-slim AS builder

# Install OpenSSL required by Prisma engine
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Install dependencies and build frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install
COPY database/ ./database/
COPY backend/ ./backend/
RUN cd backend && npm run prisma:generate

EXPOSE 5000

ENV NODE_ENV=production

WORKDIR /app/backend
CMD ["npm", "start"]
