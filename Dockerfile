FROM node:22-alpine

WORKDIR /app

COPY package.json VERSION ./
COPY server.js ./
COPY index.html history.html ./
COPY css ./css
COPY js ./js
COPY vendor ./vendor
COPY fixtures ./fixtures
COPY data/switches/.gitkeep ./data/switches/.gitkeep

ENV NODE_ENV=production
ENV PORT=8080
ENV SWITCHDRAW_STORE_DIR=/data/switches

EXPOSE 8080

USER node

CMD ["node", "server.js"]
