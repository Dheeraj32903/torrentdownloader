FROM node:22-alpine

# Universal native binary toolchain for low-RAM archive streaming & audio transcoding
RUN apk add --no-cache 7zip ffmpeg libarchive-tools unrar

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

ENV PORT=3000
VOLUME ["/app/downloads"]

CMD ["node", "server/index.js"]

