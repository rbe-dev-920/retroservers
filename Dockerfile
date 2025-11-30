FROM node:18-alpine

WORKDIR /app

# Copie les fichiers de dépendances
COPY package*.json ./

# Installe les dépendances
RUN npm ci --only=production

# Copie le reste du code source
COPY . .

# Crée le dossier uploads si besoin
RUN mkdir -p uploads

# Démarre le serveur
CMD ["node", "src/server.js"]