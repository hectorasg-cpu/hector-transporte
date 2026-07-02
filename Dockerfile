FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY railway.json ./
COPY outputs ./outputs
COPY data ./data

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 4174

CMD ["node", "server.js"]
