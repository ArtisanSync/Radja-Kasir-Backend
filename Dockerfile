FROM node:18-bullseye-slim

RUN apt-get update -y && \
    apt-get install -y openssl libssl1.1 ca-certificates curl dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production

COPY . .

RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

RUN groupadd -r radjakasir && useradd -r -g radjakasir radjakasir
RUN chown -R radjakasir:radjakasir /app
USER radjakasir

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/_health

CMD ["node", "app.js"]