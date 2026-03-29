FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

# Workspace directory for SOUL, MEMORY, HEARTBEAT, SKILLS
RUN mkdir -p /app/workspace /app/output

EXPOSE 3002

CMD ["node", "agent-server.js"]
