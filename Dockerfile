FROM node:22-alpine

# Install bsdtar and unrar for archive extraction
RUN apk add --no-cache libarchive-tools unrar

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

ENV PORT=3000
VOLUME ["/app/downloads"]

CMD ["node", "server/index.js"]

