# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Build the Angular app
COPY . .
RUN npm run build

# --- Runtime stage (minimal) ---
FROM nginx:1.27-alpine AS runtime

# Remove default config and add ours
RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy the compiled SPA
COPY --from=build /app/dist/dynamite-lens/browser /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
