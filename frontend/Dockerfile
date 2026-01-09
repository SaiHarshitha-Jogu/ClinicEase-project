FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expose Vite's default port
EXPOSE 5173

# Host flag is required to expose the server to the network
CMD ["npm", "run", "dev", "--", "--host"]
