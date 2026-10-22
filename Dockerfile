# Produktions-Image der Festo Video Search (Next.js standalone).
#
#   docker build -t festo-video-search .
#   docker run -p 3000:3000 --env-file .env.production festo-video-search
#
# Konfiguration ausschliesslich ueber Umgebungsvariablen (siehe .env.local.example).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Die Typpruefung von next build braucht mehr als die ~1 GB, die Node auf einer
# 2-GB-Instanz von sich aus nimmt; der Rest kommt aus dem Swap des Servers.
ENV NODE_OPTIONS=--max-old-space-size=2560
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# CA-Buendel fuer die verschluesselte Verbindung zu Amazon RDS
# (DATABASE_SSL_CA=/app/certs/rds-global-bundle.pem)
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-global-bundle.pem

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

RUN chmod 644 /app/certs/rds-global-bundle.pem
USER node
EXPOSE 3000
CMD ["node", "server.js"]
