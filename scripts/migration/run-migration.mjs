// ==============================================================================
// run-migration.mjs
// Orchestrateur central de migration des données Lovable/Supabase vers PostgreSQL
// ==============================================================================

import { verifySourceAccess } from './01-verify-source-access.mjs';
import { exportAll } from './02-export-source.mjs';
import { transformAndValidate } from './03-transform-validate.mjs';
import { importToLocalDb } from './04-import-target.mjs';
import { verifyIntegrity } from './05-verify-integrity.mjs';
import { seedReferenceData } from './00-seed-reference-data.mjs';

const args = process.argv.slice(2);
const command = args[0] || '--help';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║       FormaCenter — Pipeline de Migration des Données              ║');
  console.log('║               Lovable (Supabase) ➔ PostgreSQL (Prisma)             ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  switch (command) {
    case '--check':
      console.log('Action : Vérification de la source Supabase...');
      await verifySourceAccess();
      break;

    case '--export':
      console.log('Action : Exportation contrôlée de la source...');
      await exportAll();
      break;

    case '--transform':
      console.log('Action : Transformation et validation des schémas...');
      await transformAndValidate();
      break;

    case '--import':
      console.log('Action : Injection ordonnancée dans PostgreSQL local...');
      await importToLocalDb();
      break;

    case '--verify':
      console.log('Action : Vérification approfondie de la cohérence...');
      await verifyIntegrity();
      break;

    case '--seed':
      console.log('Action : Injection des données de référence (seed)...');
      await seedReferenceData();
      await verifyIntegrity();
      break;

    case '--all':
      console.log('Action : Exécution du pipeline complet (End-to-End)...');
      const check = await verifySourceAccess();
      if (!check.ok) {
        console.error('Arrêt : Prérequis d\'accès non satisfaits.');
        process.exit(1);
      }
      await exportAll();
      await transformAndValidate();
      await importToLocalDb();
      await verifyIntegrity();
      break;

    default:
      console.log('Utilisation : node scripts/migration/run-migration.mjs [OPTION]\n');
      console.log('Options disponibles :');
      console.log('  --check      Vérifie les accès et affiche l\'inventaire source');
      console.log('  --export     Exporte les tables source dans scripts/migration/data/raw');
      console.log('  --transform  Valide et convertit les données vers scripts/migration/data/transformed');
      console.log('  --import     Injecte les données transformées dans PostgreSQL local');
      console.log('  --verify     Contrôle les volumes, orphelins et montants, puis génère le rapport');
      console.log('  --seed       Initialise les données de référence (BTS/BTP, salles, admin)');
      console.log('  --all        Lance l\'intégralité du pipeline en séquence sécurisée');
      break;
  }
}

main().catch(err => {
  console.error('\n❌ Erreur fatale dans le pipeline de migration :', err.message);
  process.exit(1);
});
