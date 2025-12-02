FROM node:18

WORKDIR /app

# Copie les fichiers de dépendances ET le schema Prisma (requis pour postinstall)
COPY package*.json ./
COPY prisma ./prisma

# Installe les dépendances (execute postinstall: prisma generate)
RUN npm install --production

# Copie le reste du code source
COPY . .

# Copie le script de démarrage
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Crée le dossier uploads si besoin
RUN mkdir -p uploads

# Démarra le serveur avec le script
CMD ["sh", "./start.sh"]