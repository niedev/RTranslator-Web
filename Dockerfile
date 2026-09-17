# Stage 1: Build the Vite (React) Frontend
FROM node:24-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build


# Stage 2: Build the Node.js (TS) Backend
FROM node:24-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
# Compile tsc
RUN npm run build 


# Stage 3: The Production Image
FROM node:24-alpine AS runner
WORKDIR /app

# Set to production to optimize Node.js performance
ENV NODE_ENV=production

# Copy backend package.json and install ONLY production dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy the compiled backend code
COPY --from=backend-builder /app/backend/dist ./dist

# Copy the compiled Vite frontend to serve statically
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

# Copy your 2GB of .zip files into the image
# (Assuming they live in backend/internal-zips)
COPY backend/internal-zips ./internal-zips

# Expose your backend port
EXPOSE 3847

# Start the Node.js server
CMD ["node", "dist/index.js"]

LABEL org.opencontainers.image.source="https://github.com/niedev/RTranslator-Web"
LABEL org.opencontainers.image.title="RTranslator Web"
LABEL org.opencontainers.image.description="Self-hosted RTranslator web application"
LABEL org.opencontainers.image.licenses="Apache-2.0"

ARG VERSION
ARG BUILD_DATE
LABEL org.opencontainers.image.version=$VERSION
LABEL org.opencontainers.image.created=$BUILD_DATE