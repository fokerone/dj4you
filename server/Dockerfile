FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY index.js ./
ENV PORT=9000
EXPOSE 9000
CMD ["node", "index.js"]
