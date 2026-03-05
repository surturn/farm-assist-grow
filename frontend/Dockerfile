FROM node:20-alpine AS builder
WORKDIR /app

# Copy essential monorepo configs
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install frontend dependencies
RUN npm install --workspace=frontend

COPY frontend/ ./frontend/
COPY .env.local ./

WORKDIR /app/frontend

# Build the Vite application
RUN npm run build

# Production server using Nginx
FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
# React Router support: fallback to index.html
RUN echo "server { listen 80; location / { root /usr/share/nginx/html; index index.html; try_files \$uri \$uri/ /index.html; } }" > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
