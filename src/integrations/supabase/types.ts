export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absences: {
        Row: {
          classe_id: string | null
          commentaire: string | null
          cours_id: string | null
          created_at: string
          date: string
          etudiant_id: string
          heure: string | null
          id: string
          justification: string | null
          justifiee: boolean
          matiere_id: string | null
          motif: string | null
          statut: Database["public"]["Enums"]["statut_presence"]
          updated_at: string
        }
        Insert: {
          classe_id?: string | null
          commentaire?: string | null
          cours_id?: string | null
          created_at?: string
          date: string
          etudiant_id: string
          heure?: string | null
          id?: string
          justification?: string | null
          justifiee?: boolean
          matiere_id?: string | null
          motif?: string | null
          statut?: Database["public"]["Enums"]["statut_presence"]
          updated_at?: string
        }
        Update: {
          classe_id?: string | null
          commentaire?: string | null
          cours_id?: string | null
          created_at?: string
          date?: string
          etudiant_id?: string
          heure?: string | null
          id?: string
          justification?: string | null
          justifiee?: boolean
          matiere_id?: string | null
          motif?: string | null
          statut?: Database["public"]["Enums"]["statut_presence"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_cours_id_fkey"
            columns: ["cours_id"]
            isOneToOne: false
            referencedRelation: "cours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_etudiant_id_fkey"
            columns: ["etudiant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
        ]
      }
      annee_scolaire: {
        Row: {
          active: boolean
          created_at: string
          debut: string
          fin: string
          id: string
          libelle: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          debut: string
          fin: string
          id?: string
          libelle: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          debut?: string
          fin?: string
          id?: string
          libelle?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          payload: Json | null
          row_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          payload?: Json | null
          row_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          payload?: Json | null
          row_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classe_etudiants: {
        Row: {
          classe_id: string
          created_at: string
          date_inscription: string
          etudiant_id: string
          id: string
          statut: Database["public"]["Enums"]["statut_inscription"]
          updated_at: string
        }
        Insert: {
          classe_id: string
          created_at?: string
          date_inscription?: string
          etudiant_id: string
          id?: string
          statut?: Database["public"]["Enums"]["statut_inscription"]
          updated_at?: string
        }
        Update: {
          classe_id?: string
          created_at?: string
          date_inscription?: string
          etudiant_id?: string
          id?: string
          statut?: Database["public"]["Enums"]["statut_inscription"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classe_etudiants_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classe_etudiants_etudiant_id_fkey"
            columns: ["etudiant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          annee_scolaire_id: string | null
          created_at: string
          effectif_max: number
          id: string
          nom: string
          programme_id: string
          updated_at: string
        }
        Insert: {
          annee_scolaire_id?: string | null
          created_at?: string
          effectif_max?: number
          id?: string
          nom: string
          programme_id: string
          updated_at?: string
        }
        Update: {
          annee_scolaire_id?: string | null
          created_at?: string
          effectif_max?: number
          id?: string
          nom?: string
          programme_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_annee_scolaire_id_fkey"
            columns: ["annee_scolaire_id"]
            isOneToOne: false
            referencedRelation: "annee_scolaire"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      cours: {
        Row: {
          classe_id: string | null
          created_at: string
          date: string | null
          description: string | null
          enseignant_id: string | null
          heure_debut: string | null
          heure_fin: string | null
          id: string
          matiere_id: string
          salle_id: string | null
          titre: string
          updated_at: string
        }
        Insert: {
          classe_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          enseignant_id?: string | null
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          matiere_id: string
          salle_id?: string | null
          titre: string
          updated_at?: string
        }
        Update: {
          classe_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          enseignant_id?: string | null
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          matiere_id?: string
          salle_id?: string | null
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cours_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cours_enseignant_id_fkey"
            columns: ["enseignant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cours_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cours_salle_id_fkey"
            columns: ["salle_id"]
            isOneToOne: false
            referencedRelation: "salles"
            referencedColumns: ["id"]
          },
        ]
      }
      cours_documents: {
        Row: {
          cours_id: string
          created_at: string
          id: string
          nom: string
          storage_path: string
          type: string
          uploader_id: string | null
        }
        Insert: {
          cours_id: string
          created_at?: string
          id?: string
          nom: string
          storage_path: string
          type: string
          uploader_id?: string | null
        }
        Update: {
          cours_id?: string
          created_at?: string
          id?: string
          nom?: string
          storage_path?: string
          type?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cours_documents_cours_id_fkey"
            columns: ["cours_id"]
            isOneToOne: false
            referencedRelation: "cours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cours_documents_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          id: string
          matiere_id: string
          nom: string
          storage_path: string
          type: string
          uploader_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          matiere_id: string
          nom: string
          storage_path: string
          type: string
          uploader_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          matiere_id?: string
          nom?: string
          storage_path?: string
          type?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      domaines: {
        Row: {
          created_at: string
          description: string | null
          formation_type_id: string
          id: string
          nom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          formation_type_id: string
          id?: string
          nom: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          formation_type_id?: string
          id?: string
          nom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "domaines_formation_type_id_fkey"
            columns: ["formation_type_id"]
            isOneToOne: false
            referencedRelation: "formations_types"
            referencedColumns: ["id"]
          },
        ]
      }
      emploi_du_temps: {
        Row: {
          classe_id: string
          created_at: string
          enseignant_id: string | null
          heure_debut: string
          heure_fin: string
          id: string
          jour: number
          matiere_id: string
          salle_id: string | null
          updated_at: string
        }
        Insert: {
          classe_id: string
          created_at?: string
          enseignant_id?: string | null
          heure_debut: string
          heure_fin: string
          id?: string
          jour: number
          matiere_id: string
          salle_id?: string | null
          updated_at?: string
        }
        Update: {
          classe_id?: string
          created_at?: string
          enseignant_id?: string | null
          heure_debut?: string
          heure_fin?: string
          id?: string
          jour?: number
          matiere_id?: string
          salle_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emploi_du_temps_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emploi_du_temps_enseignant_id_fkey"
            columns: ["enseignant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emploi_du_temps_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emploi_du_temps_salle_id_fkey"
            columns: ["salle_id"]
            isOneToOne: false
            referencedRelation: "salles"
            referencedColumns: ["id"]
          },
        ]
      }
      enseignants_infos: {
        Row: {
          adresse: string | null
          created_at: string
          cv_path: string | null
          diplome: string | null
          id: string
          photo_path: string | null
          profile_id: string
          specialite: string | null
          tarif_horaire: number
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          cv_path?: string | null
          diplome?: string | null
          id?: string
          photo_path?: string | null
          profile_id: string
          specialite?: string | null
          tarif_horaire?: number
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          created_at?: string
          cv_path?: string | null
          diplome?: string | null
          id?: string
          photo_path?: string | null
          profile_id?: string
          specialite?: string | null
          tarif_horaire?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enseignants_infos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      etudiants_infos: {
        Row: {
          adresse: string | null
          created_at: string
          date_naissance: string | null
          id: string
          matricule: string | null
          photo_path: string | null
          profile_id: string
          sexe: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          date_naissance?: string | null
          id?: string
          matricule?: string | null
          photo_path?: string | null
          profile_id: string
          sexe?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          created_at?: string
          date_naissance?: string | null
          id?: string
          matricule?: string | null
          photo_path?: string | null
          profile_id?: string
          sexe?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etudiants_infos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      examens: {
        Row: {
          coefficient: number
          created_at: string
          date: string | null
          duree_min: number | null
          heure: string | null
          id: string
          matiere_id: string
          nom: string
          note_max: number
          sujet_path: string | null
          type: Database["public"]["Enums"]["type_examen"]
          updated_at: string
        }
        Insert: {
          coefficient?: number
          created_at?: string
          date?: string | null
          duree_min?: number | null
          heure?: string | null
          id?: string
          matiere_id: string
          nom: string
          note_max?: number
          sujet_path?: string | null
          type?: Database["public"]["Enums"]["type_examen"]
          updated_at?: string
        }
        Update: {
          coefficient?: number
          created_at?: string
          date?: string | null
          duree_min?: number | null
          heure?: string | null
          id?: string
          matiere_id?: string
          nom?: string
          note_max?: number
          sujet_path?: string | null
          type?: Database["public"]["Enums"]["type_examen"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "examens_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
        ]
      }
      examens_corriges: {
        Row: {
          corrige_path: string
          created_at: string
          examen_id: string
        }
        Insert: {
          corrige_path: string
          created_at?: string
          examen_id: string
        }
        Update: {
          corrige_path?: string
          created_at?: string
          examen_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "examens_corriges_examen_id_fkey"
            columns: ["examen_id"]
            isOneToOne: true
            referencedRelation: "examens"
            referencedColumns: ["id"]
          },
        ]
      }
      formations_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          nom: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          updated_at?: string
        }
        Relationships: []
      }
      frais_scolarite: {
        Row: {
          annee_scolaire_id: string | null
          created_at: string
          frais_inscription: number
          frais_scolarite: number
          id: string
          mensualite: number
          programme_id: string
          updated_at: string
        }
        Insert: {
          annee_scolaire_id?: string | null
          created_at?: string
          frais_inscription?: number
          frais_scolarite?: number
          id?: string
          mensualite?: number
          programme_id: string
          updated_at?: string
        }
        Update: {
          annee_scolaire_id?: string | null
          created_at?: string
          frais_inscription?: number
          frais_scolarite?: number
          id?: string
          mensualite?: number
          programme_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "frais_scolarite_annee_scolaire_id_fkey"
            columns: ["annee_scolaire_id"]
            isOneToOne: false
            referencedRelation: "annee_scolaire"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frais_scolarite_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      login_audit: {
        Row: {
          created_at: string
          email: string
          id: string
          ip: string | null
          reason: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip?: string | null
          reason?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
          reason?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      matieres: {
        Row: {
          code: string | null
          coefficient: number
          created_at: string
          description: string | null
          enseignant_id: string | null
          heures: number | null
          id: string
          module_id: string
          nom: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          coefficient?: number
          created_at?: string
          description?: string | null
          enseignant_id?: string | null
          heures?: number | null
          id?: string
          module_id: string
          nom: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          coefficient?: number
          created_at?: string
          description?: string | null
          enseignant_id?: string | null
          heures?: number | null
          id?: string
          module_id?: string
          nom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matieres_enseignant_id_fkey"
            columns: ["enseignant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matieres_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string | null
          heures_total: number | null
          id: string
          nom: string
          programme_id: string
          semestre: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          heures_total?: number | null
          id?: string
          nom: string
          programme_id: string
          semestre?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          heures_total?: number | null
          id?: string
          nom?: string
          programme_id?: string
          semestre?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          commentaire: string | null
          created_at: string
          etudiant_id: string
          examen_id: string
          id: string
          note: number | null
          updated_at: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          etudiant_id: string
          examen_id: string
          id?: string
          note?: number | null
          updated_at?: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          etudiant_id?: string
          examen_id?: string
          id?: string
          note?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_etudiant_id_fkey"
            columns: ["etudiant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_examen_id_fkey"
            columns: ["examen_id"]
            isOneToOne: false
            referencedRelation: "examens"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lien: string | null
          lu: boolean
          message: string | null
          titre: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lien?: string | null
          lu?: boolean
          message?: string | null
          titre: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lien?: string | null
          lu?: boolean
          message?: string | null
          titre?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements: {
        Row: {
          commentaire: string | null
          created_at: string
          date: string
          etudiant_id: string
          id: string
          mode: string | null
          montant: number
          programme_id: string | null
          reference: string | null
          remise: number
          statut: string
          type: Database["public"]["Enums"]["type_paiement"]
          updated_at: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          date?: string
          etudiant_id: string
          id?: string
          mode?: string | null
          montant: number
          programme_id?: string | null
          reference?: string | null
          remise?: number
          statut?: string
          type?: Database["public"]["Enums"]["type_paiement"]
          updated_at?: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          date?: string
          etudiant_id?: string
          id?: string
          mode?: string | null
          montant?: number
          programme_id?: string | null
          reference?: string | null
          remise?: number
          statut?: string
          type?: Database["public"]["Enums"]["type_paiement"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paiements_etudiant_id_fkey"
            columns: ["etudiant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements_enseignants: {
        Row: {
          commentaire: string | null
          created_at: string
          date: string
          enseignant_id: string
          heures: number
          id: string
          mode: string | null
          montant: number
          periode_debut: string
          periode_fin: string
          reference: string | null
          statut: string
          tarif_horaire: number
          updated_at: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          date?: string
          enseignant_id: string
          heures?: number
          id?: string
          mode?: string | null
          montant?: number
          periode_debut: string
          periode_fin: string
          reference?: string | null
          statut?: string
          tarif_horaire?: number
          updated_at?: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          date?: string
          enseignant_id?: string
          heures?: number
          id?: string
          mode?: string | null
          montant?: number
          periode_debut?: string
          periode_fin?: string
          reference?: string | null
          statut?: string
          tarif_horaire?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paiements_enseignants_enseignant_id_fkey"
            columns: ["enseignant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          adresse: string | null
          avatar_url: string | null
          bio: string | null
          classe_id: string | null
          created_at: string
          date_naissance: string | null
          email: string | null
          id: string
          nom: string
          prenom: string | null
          specialite: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          avatar_url?: string | null
          bio?: string | null
          classe_id?: string | null
          created_at?: string
          date_naissance?: string | null
          email?: string | null
          id: string
          nom?: string
          prenom?: string | null
          specialite?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          avatar_url?: string | null
          bio?: string | null
          classe_id?: string | null
          created_at?: string
          date_naissance?: string | null
          email?: string | null
          id?: string
          nom?: string
          prenom?: string | null
          specialite?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      programmes: {
        Row: {
          annee: number | null
          created_at: string
          description: string | null
          domaine_id: string
          duree: string | null
          id: string
          niveau: string | null
          nom: string
          updated_at: string
        }
        Insert: {
          annee?: number | null
          created_at?: string
          description?: string | null
          domaine_id: string
          duree?: string | null
          id?: string
          niveau?: string | null
          nom: string
          updated_at?: string
        }
        Update: {
          annee?: number | null
          created_at?: string
          description?: string | null
          domaine_id?: string
          duree?: string | null
          id?: string
          niveau?: string | null
          nom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programmes_domaine_id_fkey"
            columns: ["domaine_id"]
            isOneToOne: false
            referencedRelation: "domaines"
            referencedColumns: ["id"]
          },
        ]
      }
      salles: {
        Row: {
          capacite: number | null
          created_at: string
          description: string | null
          id: string
          nom: string
          updated_at: string
        }
        Insert: {
          capacite?: number | null
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          updated_at?: string
        }
        Update: {
          capacite?: number | null
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_document: { Args: { _path: string }; Returns: boolean }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_my_student: {
        Args: { _student_id: string; _teacher_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "directeur"
        | "responsable_pedagogique"
        | "comptable"
        | "enseignant"
        | "etudiant"
      statut_inscription:
        | "inscrit"
        | "transfere"
        | "suspendu"
        | "abandon"
        | "diplome"
      statut_presence: "present" | "absent" | "retard" | "justifie"
      type_examen: "controle" | "devoir" | "tp" | "final" | "rattrapage"
      type_paiement: "inscription" | "scolarite" | "mensualite" | "autre"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "directeur",
        "responsable_pedagogique",
        "comptable",
        "enseignant",
        "etudiant",
      ],
      statut_inscription: [
        "inscrit",
        "transfere",
        "suspendu",
        "abandon",
        "diplome",
      ],
      statut_presence: ["present", "absent", "retard", "justifie"],
      type_examen: ["controle", "devoir", "tp", "final", "rattrapage"],
      type_paiement: ["inscription", "scolarite", "mensualite", "autre"],
    },
  },
} as const
