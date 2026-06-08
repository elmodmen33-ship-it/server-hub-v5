FROM node:20-slim

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
ENV PYTHONIOENCODING=utf-8

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    locales \
    && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen \
    && locale-gen \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install

COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install --force

COPY . .

RUN cd frontend && ./node_modules/.bin/vite build

EXPOSE 3001

CMD ["sh", "-c", "cd backend && npx tsx src/index.ts"]
