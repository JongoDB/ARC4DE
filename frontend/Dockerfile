FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build for production
RUN npm run build

EXPOSE 5175

# Serve the production build
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5175"]
