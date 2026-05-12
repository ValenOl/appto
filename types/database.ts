export interface DebtEntry {
  descripcion: string
  situacion:   number
  monto:       number
}

export type Database = {
  public: {
    Tables: {

      companies: {
        Row: {
          id:                  string
          cuit:                string
          company_name:        string
          user_id:             string | null
          subscription_status: string
          plan_tier:           string
          monthly_quota:       number
          queries_used:        number
          cycle_reset_date:    string
          created_at:          string
        }
        Insert: {
          id?:                  string
          cuit:                 string
          company_name:         string
          user_id?:             string | null
          subscription_status?: string
          plan_tier:            string
          monthly_quota:        number
          queries_used?:        number
          cycle_reset_date:     string
          created_at?:          string
        }
        Update: {
          id?:                  string
          cuit?:                string
          company_name?:        string
          user_id?:             string | null
          subscription_status?: string
          plan_tier?:           string
          monthly_quota?:       number
          queries_used?:        number
          cycle_reset_date?:    string
          created_at?:          string
        }
      }

      profiles: {
        Row: {
          id:               string
          cuit:             string
          full_name:        string
          bcra_score:       number
          appto_score:      number
          estimated_income: number
          user_id:          string | null
          created_at:       string
          debt_detail:      DebtEntry[] | null
        }
        Insert: {
          id?:               string
          cuit:              string
          full_name:         string
          bcra_score:        number
          appto_score?:      number
          estimated_income:  number
          user_id?:          string | null
          created_at?:       string
          debt_detail?:      DebtEntry[] | null
        }
        Update: {
          id?:               string
          cuit?:             string
          full_name?:        string
          bcra_score?:       number
          appto_score?:      number
          estimated_income?: number
          user_id?:          string | null
          created_at?:       string
          debt_detail?:      DebtEntry[] | null
        }
      }

      reviews: {
        Row: {
          id:          string
          company_id:  string
          profile_id:  string
          rating:      number
          comment:     string | null
          reply_text:  string | null
          created_at:  string
        }
        Insert: {
          id?:         string
          company_id:  string
          profile_id:  string
          rating:      number
          comment?:    string | null
          reply_text?: string | null
          created_at?: string
        }
        Update: {
          id?:         string
          company_id?: string
          profile_id?: string
          rating?:     number
          comment?:    string | null
          reply_text?: string | null
          created_at?: string
        }
      }

      notes: {
        Row: {
          id:         string
          company_id: string
          profile_id: string
          content:    string
          created_at: string
        }
        Insert: {
          id?:         string
          company_id:  string
          profile_id:  string
          content:     string
          created_at?: string
        }
        Update: {
          id?:         string
          company_id?: string
          profile_id?: string
          content?:    string
          created_at?: string
        }
      }

      search_history: {
        Row: {
          id:           string
          company_id:   string
          query_target: string
          result_score: number | null
          status:       string
          created_at:   string
        }
        Insert: {
          id?:           string
          company_id:    string
          query_target:  string
          result_score?: number | null
          status?:       string
          created_at?:   string
        }
        Update: {
          id?:           string
          company_id?:   string
          query_target?: string
          result_score?: number | null
          status?:       string
          created_at?:   string
        }
      }

      guarantor_links: {
        Row: {
          id:                 string
          primary_profile_id: string
          linked_profile_id:  string
          relation_type:      string
          created_at:         string
        }
        Insert: {
          id?:                string
          primary_profile_id: string
          linked_profile_id:  string
          relation_type:      string
          created_at?:        string
        }
        Update: {
          id?:                 string
          primary_profile_id?: string
          linked_profile_id?:  string
          relation_type?:      string
          created_at?:         string
        }
      }

    }
    Views: Record<string, never>
    Functions: {
      consume_credit: {
        Args:    { p_company_id: string }
        Returns: Database['public']['Tables']['companies']['Row'][]
      }
    }
    Enums: Record<string, never>
  }
}

// ─────────────────────────────────────────────
// Convenience types
// ─────────────────────────────────────────────

export type Company       = Database['public']['Tables']['companies']['Row']
export type Profile       = Database['public']['Tables']['profiles']['Row']
export type Review        = Database['public']['Tables']['reviews']['Row']
export type Note          = Database['public']['Tables']['notes']['Row']
export type GuarantorLink = Database['public']['Tables']['guarantor_links']['Row']
export type SearchHistory = Database['public']['Tables']['search_history']['Row']

export type ReviewWithCompany        = Review & { company: Company }
export type GuarantorLinkWithProfile = GuarantorLink & { guarantor: Profile }
