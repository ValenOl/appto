// ─────────────────────────────────────────────
// Row types — shape of each record from the DB
// ─────────────────────────────────────────────

export interface Profile {
  id: string              // UUID
  cuit: string            // "20-28531940-2"
  full_name: string
  bcra_situation: number  // 1–6  (Situación BCRA)
  bcra_label: string      // "Normal", "Con seguimiento", etc.
  social_score: number    // 0.0–10.0
  social_label: string    // "Alta Confianza", "Riesgo Moderado", etc.
  estimated_income: number // ARS, ej: 1200000
  income_type: string     // "Relación de Dependencia", "Monotributista", etc.
  is_apto: boolean
  created_at: string      // ISO 8601
  updated_at: string      // ISO 8601
}

export interface Company {
  id: string              // UUID
  user_id: string         // UUID → auth.users.id
  cuit: string            // "30-71234567-8"
  name: string
  verified: boolean
  created_at: string
  plan_tier: string           // "BASICO" | "PRO"
  monthly_quota: number       // consultas totales por ciclo
  queries_used: number        // consumidas en el ciclo activo
  cycle_reset_date: string    // ISO 8601 — fecha del próximo reset
  subscription_status: string // "pending" | "active" | "cancelled"
}

export interface Review {
  id: string              // UUID
  profile_id: string      // UUID → profiles.id
  company_id: string      // UUID → companies.id
  rating: number          // 1–5
  rating_label: string    // "CONFIANZA MUY ALTA", "CONFIANZA ALTA", etc.
  text: string
  reply_text: string | null  // réplica pública del titular — null si no respondió
  created_at: string
}

export interface GuarantorLink {
  id: string              // UUID
  profile_id: string      // UUID → profiles.id  (sujeto consultado)
  guarantor_id: string    // UUID → profiles.id  (garante potencial)
  link_type: string       // "Domicilio Compartido", "Apellido Común", etc.
  risk_level: string      // "RIESGO BAJO", "RIESGO MODERADO", "RIESGO ALTO"
  risk_score: number      // 0.0–10.0
  created_at: string
}

// ─────────────────────────────────────────────
// Joined types — usados en la UI tras un JOIN
// ─────────────────────────────────────────────

export interface ReviewWithCompany extends Review {
  company: Company
}

export interface GuarantorLinkWithProfile extends GuarantorLink {
  guarantor: Profile
}

// ─────────────────────────────────────────────
// Database schema — tipado para el cliente Supabase
// ─────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, "id" | "created_at" | "updated_at">
        Update: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>
      }
      companies: {
        Row: Company
        Insert: Omit<Company, "id" | "created_at">
        Update: Partial<Omit<Company, "id" | "created_at">>
      }
      reviews: {
        Row: Review
        Insert: Omit<Review, "id" | "created_at">
        Update: Partial<Omit<Review, "id" | "created_at">>
      }
      guarantor_links: {
        Row: GuarantorLink
        Insert: Omit<GuarantorLink, "id" | "created_at">
        Update: Partial<Omit<GuarantorLink, "id" | "created_at">>
      }
    }
    Views: Record<string, never>
    Functions: {
      consume_credit: {
        Args: { p_company_id: string }
        Returns: Company[]
      }
    }
    Enums: Record<string, never>
  }
}
