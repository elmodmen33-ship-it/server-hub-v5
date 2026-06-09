FROM node:20-slim
ENV LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
RUN apt-get update && apt-get install -y python3 make g++ locales && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package.json ./backend/
RUN cd backend && npm install --no-package-lock
COPY frontend/package.json ./frontend/
RUN cd frontend && npm install --no-package-lock
COPY backend/ ./backend/
COPY frontend/ ./frontend/
RUN cd backend && npm run build
RUN cd frontend && npm run build
EXPOSE 3001
CMD ["sh", "-c", "cd backend && npm start"]
