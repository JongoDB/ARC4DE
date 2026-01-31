FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5175

# Run dev server (enables proxy for /api and /ws)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5175"]
