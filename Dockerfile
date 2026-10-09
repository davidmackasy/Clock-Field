FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATA_DIR=/tmp/clockfield TRUST_PROXY=1 DATABASE_SSL_CA_PATH=/app/config/supabase-ca.crt
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY config/supabase-ca.crt ./config/supabase-ca.crt
RUN mkdir -p /tmp/clockfield && chown -R node:node /tmp/clockfield
USER node
EXPOSE 8080
CMD ["node", "dist/index.cjs"]
