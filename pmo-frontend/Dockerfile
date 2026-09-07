# Build estatico do frontend (Vite/React SPA) e serve via Caddy.
#
# As variaveis VITE_* sao "queimadas" no bundle JS em tempo de build (Vite
# nao le env em runtime, ao contrario do backend) -- por isso entram como
# build args, vindas do .env.prod da VPS (nunca commitadas aqui).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GOOGLE_MAPS_TILES_KEY
ARG VITE_USE_GEE_MOCK=false
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY} \
    VITE_GOOGLE_MAPS_TILES_KEY=${VITE_GOOGLE_MAPS_TILES_KEY} \
    VITE_USE_GEE_MOCK=${VITE_USE_GEE_MOCK}
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
