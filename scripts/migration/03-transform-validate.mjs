// ==============================================================================
// 03-transform-validate.mjs
// Transformation documentée, validation des contraintes et isolation des rejets
// ==============================================================================

import fs from 'fs';
import path from 'path';

const RAW_DIR = path.resolve('scripts/migration/data/raw');
const TRANSFORMED_DIR = path.resolve('scripts/migration/data/transformed');
const REJECTED_FILE = path.resolve('scripts/migration/data/rejected_records.json');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ENUMS = {
  app_role: ['super_admin', 'directeur', 'responsable_pedagogique', 'comptable', 'enseignant', 'etudiant'],
  statut_inscription: ['inscrit', 'transfere', 'suspendu', 'abandon', 'diplome'],
  type_examen: ['controle', 'devoir', 'tp', 'final', 'rattrapage'],
  statut_presence: ['present', 'absent', 'retard', 'justifie'],
  type_paiement: ['inscription', 'scolarite', 'mensualite', 'autre']
};

function isValidUuid(id) {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

function normalizeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function normalizeDateTime(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeNumber(val, defaultVal = 0) {
  if (val === null || val === undefined || val === '') return defaultVal;
  const n = Number(val);
  return isNaN(n) ? defaultVal : n;
}

export async function transformAndValidate() {
  if (!fs.existsSync(RAW_DIR)) {
    console.error('❌ Dossier raw inexistant. Veuillez exécuter l\'export au préalable.');
    process.exit(1);
  }

  if (!fs.existsSync(TRANSFORMED_DIR)) {
    fs.mkdirSync(TRANSFORMED_DIR, { recursive: true });
  }

  const rawFiles = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json');
  const rejected = [];
  const stats = {};

  // Dictionnaire d'IDs existants pour vérifier les clés étrangères
  const knownIds = {
    profiles: new Set(),
    formations_types: new Set(),
    domaines: new Set(),
    programmes: new Set(),
    modules: new Set(),
    matieres: new Set(),
    classes: new Set(),
    annee_scolaire: new Set(),
    salles: new Set(),
    cours: new Set(),
    examens: new Set()
  };

  // Chargement des données brutes
  const dataset = {};
  for (const file of rawFiles) {
    const table = file.replace('.json', '');
    try {
      dataset[table] = JSON.parse(fs.readFileSync(path.join(RAW_DIR, file), 'utf-8'));
    } catch {
      dataset[table] = [];
    }
  }

  // Passe 1 : Récupération des IDs maîtres
  for (const table of Object.keys(knownIds)) {
    if (Array.isArray(dataset[table])) {
      for (const row of dataset[table]) {
        if (row.id && isValidUuid(row.id)) knownIds[table].add(row.id);
      }
    }
  }

  // Passe 2 : Validation et transformation table par table
  for (const [table, rows] of Object.entries(dataset)) {
    const validRows = [];
    let tableRejected = 0;

    for (const row of rows) {
      const errors = [];

      // Validation de la clé primaire
      if (!row.id || !isValidUuid(row.id)) {
        // Exception pour examens_corriges dont la PK est examen_id
        if (table === 'examens_corriges') {
          if (!row.examen_id || !isValidUuid(row.examen_id)) {
            errors.push('examen_id invalide ou manquant');
          }
        } else {
          errors.push(`Identifiant 'id' manquant ou UUID non conforme : ${row.id}`);
        }
      }

      // Validations spécifiques
      switch (table) {
        case 'user_roles': {
          let role = row.role;
          if (role === 'admin') role = 'super_admin';
          if (role === 'formateur') role = 'enseignant';
          if (!ENUMS.app_role.includes(role)) {
            errors.push(`Rôle non reconnu: ${row.role}`);
          } else {
            row.role = role;
          }
          if (!knownIds.profiles.has(row.user_id)) {
            errors.push(`user_id orphelin (absent de profiles): ${row.user_id}`);
          }
          break;
        }

        case 'profiles': {
          if (!row.nom || String(row.nom).trim() === '') {
            row.nom = row.email ? row.email.split('@')[0] : 'Utilisateur';
          }
          row.created_at = normalizeDateTime(row.created_at) || new Date().toISOString();
          row.updated_at = normalizeDateTime(row.updated_at) || new Date().toISOString();
          break;
        }

        case 'domaines': {
          if (!knownIds.formations_types.has(row.formation_type_id)) {
            errors.push(`formation_type_id orphelin: ${row.formation_type_id}`);
          }
          break;
        }

        case 'programmes': {
          if (!knownIds.domaines.has(row.domaine_id)) {
            errors.push(`domaine_id orphelin: ${row.domaine_id}`);
          }
          break;
        }

        case 'modules': {
          if (!knownIds.programmes.has(row.programme_id)) {
            errors.push(`programme_id orphelin: ${row.programme_id}`);
          }
          break;
        }

        case 'matieres': {
          if (!knownIds.modules.has(row.module_id)) {
            errors.push(`module_id orphelin: ${row.module_id}`);
          }
          row.coefficient = normalizeNumber(row.coefficient, 1.0);
          break;
        }

        case 'classes': {
          if (!knownIds.programmes.has(row.programme_id)) {
            errors.push(`programme_id orphelin: ${row.programme_id}`);
          }
          row.effectif_max = Math.max(1, parseInt(row.effectif_max || 30, 10));
          break;
        }

        case 'classe_etudiants': {
          if (!knownIds.classes.has(row.classe_id)) {
            errors.push(`classe_id orphelin: ${row.classe_id}`);
          }
          if (!knownIds.profiles.has(row.etudiant_id)) {
            errors.push(`etudiant_id orphelin: ${row.etudiant_id}`);
          }
          if (!ENUMS.statut_inscription.includes(row.statut)) {
            row.statut = 'inscrit';
          }
          row.date_inscription = normalizeDate(row.date_inscription) || normalizeDate(new Date());
          break;
        }

        case 'examens': {
          if (!knownIds.matieres.has(row.matiere_id)) {
            errors.push(`matiere_id orphelin: ${row.matiere_id}`);
          }
          if (!ENUMS.type_examen.includes(row.type)) {
            row.type = 'controle';
          }
          row.coefficient = normalizeNumber(row.coefficient, 1.0);
          row.note_max = normalizeNumber(row.note_max, 20.0);
          break;
        }

        case 'notes': {
          if (!knownIds.examens.has(row.examen_id)) {
            errors.push(`examen_id orphelin: ${row.examen_id}`);
          }
          if (!knownIds.profiles.has(row.etudiant_id)) {
            errors.push(`etudiant_id orphelin: ${row.etudiant_id}`);
          }
          if (row.note !== null && row.note !== undefined) {
            row.note = normalizeNumber(row.note, 0);
          }
          break;
        }

        case 'paiements': {
          if (!knownIds.profiles.has(row.etudiant_id)) {
            errors.push(`etudiant_id orphelin: ${row.etudiant_id}`);
          }
          if (!ENUMS.type_paiement.includes(row.type)) {
            row.type = 'scolarite';
          }
          row.montant = normalizeNumber(row.montant, 0);
          row.remise = normalizeNumber(row.remise, 0);
          row.date = normalizeDate(row.date) || normalizeDate(new Date());
          break;
        }

        case 'paiements_enseignants': {
          if (!knownIds.profiles.has(row.enseignant_id)) {
            errors.push(`enseignant_id orphelin: ${row.enseignant_id}`);
          }
          row.heures = normalizeNumber(row.heures, 0);
          row.tarif_horaire = normalizeNumber(row.tarif_horaire, 0);
          row.montant = normalizeNumber(row.montant, 0);
          row.date = normalizeDate(row.date) || normalizeDate(new Date());
          row.periode_debut = normalizeDate(row.periode_debut) || normalizeDate(new Date());
          row.periode_fin = normalizeDate(row.periode_fin) || normalizeDate(new Date());
          break;
        }

        case 'absences': {
          if (!knownIds.profiles.has(row.etudiant_id)) {
            errors.push(`etudiant_id orphelin: ${row.etudiant_id}`);
          }
          if (!ENUMS.statut_presence.includes(row.statut)) {
            row.statut = 'present';
          }
          row.date = normalizeDate(row.date) || normalizeDate(new Date());
          row.justifiee = Boolean(row.justifiee);
          break;
        }
      }

      if (errors.length > 0) {
        rejected.push({
          table,
          recordId: row.id || row.examen_id || 'UNKNOWN',
          reasons: errors,
          payload: row
        });
        tableRejected++;
      } else {
        validRows.push(row);
      }
    }

    fs.writeFileSync(
      path.join(TRANSFORMED_DIR, `${table}.json`),
      JSON.stringify(validRows, null, 2),
      'utf-8'
    );

    stats[table] = {
      reçus: rows.length,
      validés: validRows.length,
      rejetés: tableRejected
    };
  }

  fs.writeFileSync(REJECTED_FILE, JSON.stringify(rejected, null, 2), 'utf-8');

  console.log('\n📊 Résumé de la validation & transformation :');
  console.table(stats);
  console.log(`\nNombre total d'enregistrements rejetés : ${rejected.length}`);
  if (rejected.length > 0) {
    console.warn(`⚠️ Consultez les rejets détaillés dans ${REJECTED_FILE}`);
  }

  return { stats, rejectedCount: rejected.length };
}

if (process.argv[1]?.endsWith('03-transform-validate.mjs')) {
  transformAndValidate();
}
