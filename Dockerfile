# Servidor do Caramelo Molhado para nuvem (Render, Railway, Fly.io, VPS...).
# Guarde /data em um volume persistente — é onde fica o banco.
FROM node:22-alpine AS web
WORKDIR /app
COPY package*.json ./
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts
COPY . .
RUN npm run build:cliente

FROM node:22-alpine
ENV NODE_ENV=production TZ=America/Sao_Paulo PORT=3737 DATA_DIR=/data DEMO=0
RUN apk add --no-cache tzdata
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server ./server
COPY --from=web /app/dist-cliente ./dist-cliente
VOLUME /data
EXPOSE 3737
CMD ["node", "server/index.js"]
