FROM node:20-slim

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    locales \
    && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen \
    && locale-gen \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend
COPY backend/package.json ./backend/
# Using --no-package-lock to avoid errors if the lockfile is missing
RUN cd backend && npm install --no-package-lock

# Frontend
COPY frontend/package.json ./frontend/
RUN cd frontend && npm install --no-package-lock

# Copy source
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build backend
RUN cd backend && npm run build

# Build frontend
RUN cd frontend && npm run build

EXPOSE 3001

CMD ["sh", "-c", "cd backend && npm start"]
