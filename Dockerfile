# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Accept build-time API URL (injected by docker-compose build args)
ARG VITE_API_URL=http://localhost:8080
ARG VITE_SIGNALR_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SIGNALR_URL=$VITE_SIGNALR_URL

COPY package*.json ./
RUN npm ci --silent
COPY . .
RUN npm run build

# ── Stage 2: Serve with Nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
