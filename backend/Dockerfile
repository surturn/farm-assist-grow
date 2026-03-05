FROM node:20-alpine AS builder

WORKDIR /app

# Copy the monorepo essential configs
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies exclusively for the backend to build
RUN npm install --workspace=backend

COPY backend/ ./backend/
COPY .env.local ./

WORKDIR /app/backend
# Generate Prisma Client & compile typescript
RUN npx prisma generate
RUN npm run build

# Production Stage
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/.env.local ./

WORKDIR /app/backend

EXPOSE 5000
CMD ["npm", "start"]
