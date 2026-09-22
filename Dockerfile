FROM node:22-alpine

RUN apk add --no-cache su-exec

WORKDIR /app

COPY package.json VERSION ./
COPY server.js ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY index.html history.html ./
COPY css ./css
COPY js ./js
COPY vendor ./vendor
COPY fixtures ./fixtures
COPY data/switches/.gitkeep ./data/switches/.gitkeep

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080
ENV SWITCHDRAW_STORE_DIR=/data/switches

EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
