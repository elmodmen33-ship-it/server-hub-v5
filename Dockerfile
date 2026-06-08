FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm install

COPY frontend/package.json frontend/package-lock.json* ./../frontend/
RUN cd ../frontend && npm install --force

COPY . .

RUN cd frontend && npx vite build

EXPOSE 3001

CMD ["sh", "-c", "cd backend && npx tsx src/index.ts"]
