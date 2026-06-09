FROM node:20-slim
ENV LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# Temporarily set to development to ensure devDependencies are installed
ENV NODE_ENV=development

RUN apt-get update && apt-get install -y python3 make g++ locales && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json ./backend/
RUN cd backend && npm install --include=dev --no-package-lock

COPY frontend/package.json ./frontend/
RUN cd frontend && npm install --include=dev --no-package-lock

COPY backend/ ./backend/
COPY frontend/ ./frontend/

RUN cd backend && npm run build
RUN cd frontend && npm run build

# Switch back to production for runtime
ENV NODE_ENV=production
EXPOSE 3001

CMD ["sh", "-c", "cd backend && npm start"]
