/**
 * Hand-authored database types derived from migrations 001–007.
 * Run `supabase gen types typescript` to regenerate when schema changes.
 */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          code: string
          description: string | null
          logo_url: string | null
          contact_email: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          description?: string | null
          logo_url?: string | null
          contact_email?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          role: 'admin' | 'commander' | 'observer' | 'participant' | 'guest'
          organization_id: string | null
          avatar_url: string | null
          phone: string | null
          position: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          role?: 'admin' | 'commander' | 'observer' | 'participant' | 'guest'
          organization_id?: string | null
          avatar_url?: string | null
          phone?: string | null
          position?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['profiles']['Insert'], 'id'>>
        Relationships: []
      }
      master_registry: {
        Row: {
          id: string
          type: 'personnel' | 'unit' | 'equipment'
          name: string
          code: string
          organization_id: string | null
          data: Json
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: 'personnel' | 'unit' | 'equipment'
          name: string
          code: string
          organization_id?: string | null
          data?: Json
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['master_registry']['Insert'], 'type' | 'name' | 'code'>>
        Relationships: []
      }
      standards_registry: {
        Row: {
          id: string
          title: string
          code: string
          category: string
          version: string
          content: string | null
          file_url: string | null
          is_active: boolean
          effective_date: string | null
          review_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          code: string
          category: string
          version?: string
          content?: string | null
          file_url?: string | null
          is_active?: boolean
          effective_date?: string | null
          review_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['standards_registry']['Insert'], 'title' | 'code' | 'category'>>
        Relationships: []
      }
      authority_matrix: {
        Row: {
          id: string
          role: 'admin' | 'commander' | 'observer' | 'participant' | 'guest'
          resource: string
          action: string
          allowed: boolean
          conditions: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          role: 'admin' | 'commander' | 'observer' | 'participant' | 'guest'
          resource: string
          action: string
          allowed?: boolean
          conditions?: Json | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['authority_matrix']['Insert']>
        Relationships: []
      }
      safety_gate_rules: {
        Row: {
          id: string
          name: string
          description: string | null
          condition_type: 'pre_check' | 'during' | 'post_check'
          action: 'block' | 'warn' | 'notify'
          priority: number
          is_active: boolean
          applies_to_modes: string[]
          rule_definition: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          condition_type: 'pre_check' | 'during' | 'post_check'
          action: 'block' | 'warn' | 'notify'
          priority?: number
          is_active?: boolean
          applies_to_modes?: string[]
          rule_definition?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['safety_gate_rules']['Insert'], 'name'>>
        Relationships: []
      }
      drills: {
        Row: {
          id: string
          title: string
          description: string | null
          mode: 'operation' | 'drill'
          status: 'draft' | 'planned' | 'active' | 'paused' | 'completed' | 'cancelled'
          organization_id: string | null
          scenario: Json | null
          objectives: string[] | null
          start_date: string | null
          end_date: string | null
          location: string | null
          max_participants: number | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          mode: 'operation' | 'drill'
          status?: 'draft' | 'planned' | 'active' | 'paused' | 'completed' | 'cancelled'
          organization_id?: string | null
          scenario?: Json | null
          objectives?: string[] | null
          start_date?: string | null
          end_date?: string | null
          location?: string | null
          max_participants?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['drills']['Insert'], 'title' | 'mode'>>
        Relationships: []
      }
      drill_participants: {
        Row: {
          id: string
          drill_id: string
          user_id: string
          role_in_drill: string | null
          status: 'invited' | 'confirmed' | 'active' | 'completed' | 'absent'
          joined_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          drill_id: string
          user_id: string
          role_in_drill?: string | null
          status?: 'invited' | 'confirmed' | 'active' | 'completed' | 'absent'
          joined_at?: string | null
          created_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['drill_participants']['Insert'], 'drill_id' | 'user_id'>>
        Relationships: []
      }
      event_log: {
        Row: {
          id: string
          event_type: string
          mode: 'operation' | 'drill'
          session_id: string | null
          drill_id: string | null
          user_id: string | null
          severity: 'info' | 'warning' | 'critical'
          title: string
          description: string | null
          data: Json | null
          location: string | null
          timestamp: string
        }
        Insert: {
          id?: string
          event_type: string
          mode: 'operation' | 'drill'
          session_id?: string | null
          drill_id?: string | null
          user_id?: string | null
          severity?: 'info' | 'warning' | 'critical'
          title: string
          description?: string | null
          data?: Json | null
          location?: string | null
          timestamp?: string
        }
        Update: Partial<Database['public']['Tables']['event_log']['Insert']>
        Relationships: []
      }
      aar_reports: {
        Row: {
          id: string
          drill_id: string
          title: string
          summary: string | null
          findings: Json
          lessons_learned: string | null
          recommendations: string | null
          rating: number | null
          status: 'draft' | 'review' | 'approved' | 'published'
          created_by: string | null
          approved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          drill_id: string
          title: string
          summary?: string | null
          findings?: Json
          lessons_learned?: string | null
          recommendations?: string | null
          rating?: number | null
          status?: 'draft' | 'review' | 'approved' | 'published'
          created_by?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['aar_reports']['Insert'], 'drill_id'>>
        Relationships: []
      }
      public_documents: {
        Row: {
          id: string
          title: string
          description: string | null
          category: 'manual' | 'sop' | 'guide' | 'form' | 'report' | 'other'
          file_url: string | null
          file_name: string | null
          file_size: number | null
          mime_type: string | null
          is_public: boolean
          tags: string[] | null
          download_count: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          category?: 'manual' | 'sop' | 'guide' | 'form' | 'report' | 'other'
          file_url?: string | null
          file_name?: string | null
          file_size?: number | null
          mime_type?: string | null
          is_public?: boolean
          tags?: string[] | null
          download_count?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['public_documents']['Insert']>
        Relationships: []
      }
      announcements: {
        Row: {
          id: string
          title: string
          content: string
          is_published: boolean
          pinned: boolean
          published_at: string | null
          expires_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          is_published?: boolean
          pinned?: boolean
          published_at?: string | null
          expires_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['announcements']['Insert'], 'title' | 'content'>>
        Relationships: []
      }
      drill_safety_gates: {
        Row: {
          id: string
          drill_id: string
          rule_id: string
          status: 'pending' | 'passed' | 'failed' | 'waived'
          checked_by: string | null
          checked_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          drill_id: string
          rule_id: string
          status?: 'pending' | 'passed' | 'failed' | 'waived'
          checked_by?: string | null
          checked_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['drill_safety_gates']['Insert'], 'drill_id' | 'rule_id'>>
        Relationships: []
      }
      iodp_sessions: {
        Row: {
          id: string
          drill_id: string | null
          code: string
          title_th: string
          title_en: string | null
          mode: 'operation' | 'drill'
          status: 'planned' | 'active' | 'paused' | 'completed' | 'cancelled'
          scenario_type: string | null
          op_period: string | null
          start_time: string | null
          end_time: string | null
          center_lat: number
          center_lng: number
          zoom_level: number
          organization_id: string | null
          meta: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          drill_id?: string | null
          code: string
          title_th: string
          title_en?: string | null
          mode?: 'operation' | 'drill'
          status?: 'planned' | 'active' | 'paused' | 'completed' | 'cancelled'
          scenario_type?: string | null
          op_period?: string | null
          start_time?: string | null
          end_time?: string | null
          center_lat?: number
          center_lng?: number
          zoom_level?: number
          organization_id?: string | null
          meta?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['iodp_sessions']['Insert'], 'code' | 'title_th'>>
        Relationships: []
      }
      iodp_sites: {
        Row: {
          id: string
          session_id: string
          site_code: string
          name: string | null
          type: 'facility' | 'incident' | 'ccp' | 'lz' | 'uav' | 'team'
          status: string | null
          lat: number
          lng: number
          capacity: number | null
          current_load: number
          meta: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          site_code: string
          name?: string | null
          type: 'facility' | 'incident' | 'ccp' | 'lz' | 'uav' | 'team'
          status?: string | null
          lat: number
          lng: number
          capacity?: number | null
          current_load?: number
          meta?: Json
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['iodp_sites']['Insert'], 'session_id' | 'site_code'>>
        Relationships: []
      }
      iodp_teams: {
        Row: {
          id: string
          session_id: string
          team_code: string
          name: string
          type: string | null
          status: string
          site_id: string | null
          personnel: number
          readiness: number
          lat: number | null
          lng: number | null
          meta: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          team_code: string
          name: string
          type?: string | null
          status?: string
          site_id?: string | null
          personnel?: number
          readiness?: number
          lat?: number | null
          lng?: number | null
          meta?: Json
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['iodp_teams']['Insert'], 'session_id' | 'team_code' | 'name'>>
        Relationships: []
      }
      iodp_patients: {
        Row: {
          id: string
          session_id: string
          patient_code: string
          triage_level: 'P1' | 'P2' | 'P3' | 'BLACK' | null
          status: string
          site_id: string | null
          destination_id: string | null
          transport_mode: string | null
          transport_object_id: string | null
          lat: number | null
          lng: number | null
          march_data: Json
          mist_data: Json
          meta: Json
          found_at: string | null
          triaged_at: string | null
          admitted_at: string | null
          departed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          patient_code: string
          triage_level?: 'P1' | 'P2' | 'P3' | 'BLACK' | null
          status?: string
          site_id?: string | null
          destination_id?: string | null
          transport_mode?: string | null
          transport_object_id?: string | null
          lat?: number | null
          lng?: number | null
          march_data?: Json
          mist_data?: Json
          meta?: Json
          found_at?: string | null
          triaged_at?: string | null
          admitted_at?: string | null
          departed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['iodp_patients']['Insert'], 'session_id' | 'patient_code'>>
        Relationships: []
      }
      iodp_events: {
        Row: {
          id: string
          session_id: string
          event_code: string
          severity: 'info' | 'warning' | 'critical' | 'drill'
          actor: string | null
          target: string | null
          description: string | null
          flagged: boolean
          site_id: string | null
          team_id: string | null
          patient_id: string | null
          meta: Json
          occurred_at: string
        }
        Insert: {
          id?: string
          session_id: string
          event_code: string
          severity?: 'info' | 'warning' | 'critical' | 'drill'
          actor?: string | null
          target?: string | null
          description?: string | null
          flagged?: boolean
          site_id?: string | null
          team_id?: string | null
          patient_id?: string | null
          meta?: Json
          occurred_at?: string
        }
        Update: Partial<Database['public']['Tables']['iodp_events']['Insert']>
        Relationships: []
      }
      facility_status: {
        Row: {
          id: string
          drill_id: string | null
          site_code: string
          site_name: string | null
          status: 'normal' | 'surge' | 'critical' | 'closed'
          current_load: number
          capacity: number | null
          icu_beds_total: number
          icu_beds_available: number
          or_available: boolean
          blood_available: boolean
          oxygen_level: 'normal' | 'low' | 'critical'
          diversion_status: 'open' | 'divert' | 'closed' | 'overloaded'
          facility_level: 'Role1' | 'Role2' | 'Role3' | 'CoE' | 'CCP' | null
          notes: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          drill_id?: string | null
          site_code: string
          site_name?: string | null
          status?: 'normal' | 'surge' | 'critical' | 'closed'
          current_load?: number
          capacity?: number | null
          icu_beds_total?: number
          icu_beds_available?: number
          or_available?: boolean
          blood_available?: boolean
          oxygen_level?: 'normal' | 'low' | 'critical'
          diversion_status?: 'open' | 'divert' | 'closed' | 'overloaded'
          facility_level?: 'Role1' | 'Role2' | 'Role3' | 'CoE' | 'CCP' | null
          notes?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['facility_status']['Insert'], 'site_code'>>
        Relationships: []
      }
      object_registry: {
        Row: {
          id: string
          drill_id: string | null
          session_id: string | null
          object_code: string
          name: string
          type: 'ambulance' | 'boat' | 'HEMS' | 'UAV' | 'ALS_unit' | 'BLS_unit' | 'personnel' | 'unit' | 'equipment' | 'vehicle' | 'other'
          capability: string[]
          limitations: string[]
          status: 'available' | 'en_route' | 'on_scene' | 'standby' | 'unavailable' | 'maintenance' | 'demobilized'
          readiness: number
          owner: string | null
          organization_id: string | null
          home_location: string | null
          assigned_patient_id: string | null
          lat: number | null
          lng: number | null
          notes: string | null
          meta: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          drill_id?: string | null
          session_id?: string | null
          object_code: string
          name: string
          type: 'ambulance' | 'boat' | 'HEMS' | 'UAV' | 'ALS_unit' | 'BLS_unit' | 'personnel' | 'unit' | 'equipment' | 'vehicle' | 'other'
          capability?: string[]
          limitations?: string[]
          status?: 'available' | 'en_route' | 'on_scene' | 'standby' | 'unavailable' | 'maintenance' | 'demobilized'
          readiness?: number
          owner?: string | null
          organization_id?: string | null
          home_location?: string | null
          assigned_patient_id?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          meta?: Json
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['object_registry']['Insert'], 'object_code'>>
        Relationships: []
      }
      lifecycle_events: {
        Row: {
          id: string
          object_id: string
          event_type: string
          from_value: string | null
          to_value: string | null
          actor_id: string | null
          actor_name: string | null
          notes: string | null
          meta: Json
          occurred_at: string
        }
        Insert: {
          id?: string
          object_id: string
          event_type: string
          from_value?: string | null
          to_value?: string | null
          actor_id?: string | null
          actor_name?: string | null
          notes?: string | null
          meta?: Json
          occurred_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['lifecycle_events']['Insert'], 'object_id'>>
        Relationships: []
      }
      capability_registry: {
        Row: {
          id: string
          code: string
          name: string
          category: string | null
          description: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          category?: string | null
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['capability_registry']['Insert'], 'code'>>
        Relationships: []
      }
      platform_events: {
        Row: {
          id: string
          event_type: string
          source_type: string | null
          source_id: string | null
          severity: 'info' | 'warning' | 'critical' | 'drill'
          title: string
          description: string | null
          actor_id: string | null
          drill_id: string | null
          meta: Json
          occurred_at: string
        }
        Insert: {
          id?: string
          event_type: string
          source_type?: string | null
          source_id?: string | null
          severity?: 'info' | 'warning' | 'critical' | 'drill'
          title: string
          description?: string | null
          actor_id?: string | null
          drill_id?: string | null
          meta?: Json
          occurred_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['platform_events']['Insert'], 'event_type'>>
        Relationships: []
      }
      patient_movements: {
        Row: {
          id: string
          patient_id: string
          from_site_id: string | null
          to_site_id: string | null
          transport_mode: string | null
          moved_by: string | null
          moved_at: string
          notes: string | null
        }
        Insert: {
          id?: string
          patient_id: string
          from_site_id?: string | null
          to_site_id?: string | null
          transport_mode?: string | null
          moved_by?: string | null
          moved_at?: string
          notes?: string | null
        }
        Update: Partial<Omit<Database['public']['Tables']['patient_movements']['Insert'], 'patient_id'>>
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'info' | 'warning' | 'critical' | 'success'
          title: string
          body: string | null
          link: string | null
          read: boolean
          drill_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type?: 'info' | 'warning' | 'critical' | 'success'
          title: string
          body?: string | null
          link?: string | null
          read?: boolean
          drill_id?: string | null
          created_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['notifications']['Insert'], 'user_id'>>
        Relationships: []
      }
      iodp_injects: {
        Row: {
          id: string
          session_id: string
          inject_code: string
          title: string
          description: string | null
          type: string
          status: 'queued' | 'pushed' | 'acknowledged' | 'completed' | 'skipped'
          scheduled_at: string | null
          pushed_at: string | null
          target_team: string | null
          severity: string
          expected_action: string | null
          actual_action: string | null
          meta: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          inject_code: string
          title: string
          description?: string | null
          type: string
          status?: 'queued' | 'pushed' | 'acknowledged' | 'completed' | 'skipped'
          scheduled_at?: string | null
          pushed_at?: string | null
          target_team?: string | null
          severity?: string
          expected_action?: string | null
          actual_action?: string | null
          meta?: Json
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['iodp_injects']['Insert'], 'session_id' | 'inject_code'>>
        Relationships: []
      }
      iodp_aar_findings: {
        Row: {
          id: string
          session_id: string
          finding_code: string
          severity: 'critical' | 'high' | 'medium' | 'low'
          title: string
          description: string | null
          category: string | null
          lms_course: string | null
          lms_deadline: string | null
          status: 'open' | 'in_progress' | 'resolved'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          finding_code: string
          severity?: 'critical' | 'high' | 'medium' | 'low'
          title: string
          description?: string | null
          category?: string | null
          lms_course?: string | null
          lms_deadline?: string | null
          status?: 'open' | 'in_progress' | 'resolved'
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['iodp_aar_findings']['Insert'], 'session_id' | 'finding_code'>>
        Relationships: []
      }
      iodp_safety_gates: {
        Row: {
          id: string
          session_id: string
          gate_code: string
          name: string
          status: 'passed' | 'pending' | 'failed' | 'waived' | 'critical'
          checked_by: string | null
          checked_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          gate_code: string
          name: string
          status?: 'passed' | 'pending' | 'failed' | 'waived' | 'critical'
          checked_by?: string | null
          checked_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['iodp_safety_gates']['Insert'], 'session_id' | 'gate_code'>>
        Relationships: []
      }
      scenario_templates: {
        Row: {
          id: string
          code: string
          title: string
          description: string | null
          scenario_type: string
          default_duration_minutes: number
          default_objectives: string[]
          default_sites: Json
          archetype_distribution: Json
          meta: Json
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          title: string
          description?: string | null
          scenario_type?: string
          default_duration_minutes?: number
          default_objectives?: string[]
          default_sites?: Json
          archetype_distribution?: Json
          meta?: Json
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['scenario_templates']['Insert']>
        Relationships: []
      }
      scenario_instances: {
        Row: {
          id: string
          drill_id: string
          template_id: string | null
          title: string
          description: string | null
          scenario_type: string
          status: 'draft' | 'ready' | 'active' | 'completed' | 'cancelled'
          objectives: string[]
          objectives_locked: boolean
          start_offset_minutes: number
          duration_minutes: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          drill_id: string
          template_id?: string | null
          title: string
          description?: string | null
          scenario_type?: string
          status?: 'draft' | 'ready' | 'active' | 'completed' | 'cancelled'
          objectives?: string[]
          objectives_locked?: boolean
          start_offset_minutes?: number
          duration_minutes?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['scenario_instances']['Insert'], 'drill_id'>>
        Relationships: []
      }
      scenario_sites: {
        Row: {
          id: string
          scenario_id: string
          site_code: string
          site_name: string
          site_type: string
          role: string | null
          capacity: number | null
          created_at: string
        }
        Insert: {
          id?: string
          scenario_id: string
          site_code: string
          site_name: string
          site_type?: string
          role?: string | null
          capacity?: number | null
          created_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['scenario_sites']['Insert'], 'scenario_id'>>
        Relationships: []
      }
      msel_injects: {
        Row: {
          id: string
          scenario_id: string
          inject_code: string
          title: string
          description: string | null
          inject_type: string
          severity: 'info' | 'warning' | 'critical'
          target_team: string | null
          expected_action: string | null
          offset_minutes: number
          status: 'queued' | 'pushed' | 'acknowledged' | 'completed' | 'skipped'
          pushed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scenario_id: string
          inject_code: string
          title: string
          description?: string | null
          inject_type?: string
          severity?: 'info' | 'warning' | 'critical'
          target_team?: string | null
          expected_action?: string | null
          offset_minutes?: number
          status?: 'queued' | 'pushed' | 'acknowledged' | 'completed' | 'skipped'
          pushed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['msel_injects']['Insert'], 'scenario_id'>>
        Relationships: []
      }
      casualty_archetypes: {
        Row: {
          id: string
          code: string
          name: string
          triage_level: 'P1' | 'P2' | 'P3' | 'BLACK'
          mechanism: string | null
          injuries: string[]
          expected_treatment: string | null
          difficulty: 'easy' | 'medium' | 'hard'
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          triage_level: 'P1' | 'P2' | 'P3' | 'BLACK'
          mechanism?: string | null
          injuries?: string[]
          expected_treatment?: string | null
          difficulty?: 'easy' | 'medium' | 'hard'
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['casualty_archetypes']['Insert']>
        Relationships: []
      }
      casualty_instances: {
        Row: {
          id: string
          scenario_id: string
          archetype_id: string | null
          patient_code: string
          triage_level: 'P1' | 'P2' | 'P3' | 'BLACK' | null
          name_alias: string | null
          age: number | null
          gender: string | null
          mechanism: string | null
          injuries: string[]
          initial_site_code: string | null
          meta: Json
          created_at: string
        }
        Insert: {
          id?: string
          scenario_id: string
          archetype_id?: string | null
          patient_code: string
          triage_level?: 'P1' | 'P2' | 'P3' | 'BLACK' | null
          name_alias?: string | null
          age?: number | null
          gender?: string | null
          mechanism?: string | null
          injuries?: string[]
          initial_site_code?: string | null
          meta?: Json
          created_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['casualty_instances']['Insert'], 'scenario_id'>>
        Relationships: []
      }
      exercise_teams: {
        Row: {
          id: string
          drill_id: string
          team_code: string
          team_name: string
          role: string
          leader_id: string | null
          member_count: number
          organization: string | null
          meta: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          drill_id: string
          team_code: string
          team_name: string
          role?: string
          leader_id?: string | null
          member_count?: number
          organization?: string | null
          meta?: Json
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['exercise_teams']['Insert'], 'drill_id' | 'team_code'>>
        Relationships: []
      }
      controllers_evaluators: {
        Row: {
          id: string
          drill_id: string
          user_id: string
          assignment_type: 'controller' | 'evaluator' | 'both'
          assigned_team: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          drill_id: string
          user_id: string
          assignment_type?: 'controller' | 'evaluator' | 'both'
          assigned_team?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['controllers_evaluators']['Insert'], 'drill_id' | 'user_id'>>
        Relationships: []
      }
      sim_clock_state: {
        Row: {
          id: string
          scenario_id: string
          status: 'standby' | 'live' | 'paused' | 'safety_pause' | 'completed'
          elapsed_seconds: number
          speed_multiplier: number
          started_at: string | null
          paused_at: string | null
          last_tick_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scenario_id: string
          status?: 'standby' | 'live' | 'paused' | 'safety_pause' | 'completed'
          elapsed_seconds?: number
          speed_multiplier?: number
          started_at?: string | null
          paused_at?: string | null
          last_tick_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['sim_clock_state']['Insert'], 'scenario_id'>>
        Relationships: []
      }
      inject_deliveries: {
        Row: {
          id: string
          inject_id: string
          scenario_id: string
          delivered_to_role: string | null
          delivered_to_team: string | null
          delivered_to_user: string | null
          delivered_at: string
          acknowledged_at: string | null
          acknowledged_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          inject_id: string
          scenario_id: string
          delivered_to_role?: string | null
          delivered_to_team?: string | null
          delivered_to_user?: string | null
          delivered_at?: string
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['inject_deliveries']['Insert'], 'inject_id' | 'scenario_id'>>
        Relationships: []
      }
      evaluator_flags: {
        Row: {
          id: string
          scenario_id: string
          flagged_by: string
          flagged_at: string
          category: 'observation' | 'strength' | 'weakness' | 'safety_concern' | 'critical_incident'
          title: string
          description: string | null
          severity: 'info' | 'warning' | 'critical'
          elapsed_seconds_at: number | null
          is_resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          scenario_id: string
          flagged_by: string
          flagged_at?: string
          category?: 'observation' | 'strength' | 'weakness' | 'safety_concern' | 'critical_incident'
          title: string
          description?: string | null
          severity?: 'info' | 'warning' | 'critical'
          elapsed_seconds_at?: number | null
          is_resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          created_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['evaluator_flags']['Insert'], 'scenario_id' | 'flagged_by'>>
        Relationships: []
      }
    }
    Views: {
      v_facility_latest_status: {
        Row: {
          id: string
          drill_id: string | null
          site_code: string
          site_name: string | null
          status: 'normal' | 'surge' | 'critical' | 'closed'
          current_load: number
          capacity: number | null
          icu_beds_total: number
          icu_beds_available: number
          or_available: boolean
          blood_available: boolean
          oxygen_level: 'normal' | 'low' | 'critical'
          diversion_status: 'open' | 'divert' | 'closed' | 'overloaded'
          facility_level: 'Role1' | 'Role2' | 'Role3' | 'CoE' | 'CCP' | null
          notes: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Relationships: []
      }
      patient_tracks: {
        Row: {
          id: string
          session_id: string
          drill_id: string | null
          patient_code: string
          triage_level: 'P1' | 'P2' | 'P3' | 'BLACK' | null
          status: string
          site_id: string | null
          site_name: string | null
          destination_id: string | null
          destination_name: string | null
          transport_mode: string | null
          transport_object_id: string | null
          lat: number | null
          lng: number | null
          march_data: Json
          mist_data: Json
          meta: Json
          found_at: string | null
          triaged_at: string | null
          admitted_at: string | null
          departed_at: string | null
          created_at: string
          updated_at: string
        }
        Relationships: []
      }
      v_drill_dashboard_summary: {
        Row: {
          drill_id: string
          drill_title: string
          drill_status: string
          scenario_count: number
          active_scenario_id: string | null
          active_scenario_title: string | null
          total_casualties: number
          p1_count: number
          p2_count: number
          p3_count: number
          black_count: number
          inject_total: number
          inject_pushed: number
          inject_pending: number
          team_count: number
          participant_count: number
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: {
        Args: Record<never, never>
        Returns: string
      }
      is_admin: {
        Args: Record<never, never>
        Returns: boolean
      }
      is_commander_or_above: {
        Args: Record<never, never>
        Returns: boolean
      }
      upsert_drill_safety_gate: {
        Args: {
          p_drill_id: string
          p_rule_id: string
          p_status: string
          p_notes?: string | null
        }
        Returns: Json
      }
      update_facility_status: {
        Args: { payload: Json }
        Returns: Json
      }
      assign_patient_destination: {
        Args: { payload: Json }
        Returns: Json
      }
      create_patient_movement: {
        Args: { payload: Json }
        Returns: Json
      }
      confirm_patient_handover: {
        Args: { payload: Json }
        Returns: Json
      }
      log_platform_event: {
        Args: { payload: Json }
        Returns: Json
      }
      dispatch_object: {
        Args: { payload: Json }
        Returns: Json
      }
      create_iap_version: {
        Args: { payload: Json }
        Returns: Json
      }
      update_iap_section: {
        Args: { payload: Json }
        Returns: Json
      }
      create_incident_from_methane: {
        Args: { payload: Json }
        Returns: Json
      }
      push_msel_inject: {
        Args: { payload: Json }
        Returns: Json
      }
      submit_field_triage: {
        Args: { payload: Json }
        Returns: Json
      }
      submit_field_checkin: {
        Args: { payload: Json }
        Returns: Json
      }
      submit_supply_request: {
        Args: { payload: Json }
        Returns: Json
      }
      update_sim_clock: {
        Args: { payload: Json }
        Returns: Json
      }
      generate_aar_findings: {
        Args: { payload: Json }
        Returns: Json
      }
      assign_lms_course: {
        Args: { payload: Json }
        Returns: Json
      }
      submit_evaluation_score: {
        Args: { payload: Json }
        Returns: Json
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type InsertDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type UpdateDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
