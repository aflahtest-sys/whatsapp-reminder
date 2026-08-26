# Builds the backend. The build context is THIS folder, so Railway's
# Root Directory must be set to:  WhatsApp Message Reminder
#
# (Before the project was moved this file sat at the repository root and copied
# from backend/. The paths below are relative to this folder, so the setting in
# Railway has to point here or the build fails with "backend: not found".)

FROM node:22-bookworm-slim

# System libraries Chromium needs. whatsapp-web.js drives a real headless
# browser, so without these the container starts but every send fails.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc-s1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, so a code-only change does not reinstall everything.
COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ .

# Where the linked WhatsApp account is stored. This must be a MOUNTED VOLUME in
# Railway, otherwise the login lives only inside the container filesystem and is
# destroyed on every redeploy -- you would have to rescan the QR code each time.
#   Railway > service > Volumes > mount at /data
ENV WA_SESSION_PATH=/data/wwebjs_auth
RUN mkdir -p /data/wwebjs_auth

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server.js"]
