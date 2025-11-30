import { spawn } from 'child_process';

// Définir la variable d'environnement
process.env.DATABASE_URL = 'file:./prisma/dev.db';

console.log('🔧 Configuration DATABASE_URL:', process.env.DATABASE_URL);

// Exécuter les commandes Prisma
const commands = [
  { cmd: 'npx', args: ['prisma', 'generate'] },
  { cmd: 'npx', args: ['prisma', 'db', 'push', '--accept-data-loss'] }
];

async function runCommands() {
  for (const { cmd, args } of commands) {
    console.log(`🚀 Exécution: ${cmd} ${args.join(' ')}`);
    
    await new Promise((resolve, reject) => {
      const childProcess = spawn(cmd, args, { 
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: 'file:./prisma/dev.db' }
      });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Commande réussie: ${cmd} ${args.join(' ')}`);
          resolve();
        } else {
          console.error(`❌ Erreur lors de: ${cmd} ${args.join(' ')}`);
          reject(new Error(`Command failed with code ${code}`));
        }
      });
    });
  }
  
  console.log('🎉 Build terminé avec succès !');
}

runCommands().catch(console.error);