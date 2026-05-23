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
      dashboard_ai_conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dashboard_ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
          tool_call_id: string | null
          tool_calls: Json | null
          tool_name: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
          tool_call_id?: string | null
          tool_calls?: Json | null
          tool_name?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
          tool_call_id?: string | null
          tool_calls?: Json | null
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "dashboard_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_audit_log: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: number
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      dashboard_campaign_allocations: {
        Row: {
          allocated_leads: number
          allocated_voice_minutes: number
          allocation_month: string
          campaign_id: string
          created_at: string | null
          id: number
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          allocated_leads?: number
          allocated_voice_minutes?: number
          allocation_month: string
          campaign_id: string
          created_at?: string | null
          id?: number
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          allocated_leads?: number
          allocated_voice_minutes?: number
          allocation_month?: string
          campaign_id?: string
          created_at?: string | null
          id?: number
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dashboard_maintenance_notice: {
        Row: {
          id: number
          is_active: boolean
          message: string
          severity: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: number
          is_active?: boolean
          message?: string
          severity?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: number
          is_active?: boolean
          message?: string
          severity?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      dashboard_modules: {
        Row: {
          description: string | null
          display_name: string
          display_order: number | null
          enabled_for_admin: boolean | null
          enabled_for_client: boolean | null
          enabled_for_super_admin: boolean | null
          module_key: string
          updated_at: string | null
        }
        Insert: {
          description?: string | null
          display_name: string
          display_order?: number | null
          enabled_for_admin?: boolean | null
          enabled_for_client?: boolean | null
          enabled_for_super_admin?: boolean | null
          module_key: string
          updated_at?: string | null
        }
        Update: {
          description?: string | null
          display_name?: string
          display_order?: number | null
          enabled_for_admin?: boolean | null
          enabled_for_client?: boolean | null
          enabled_for_super_admin?: boolean | null
          module_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      dashboard_user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          display_name: string | null
          organization: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          organization?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          organization?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_webhook_triggers: {
        Row: {
          id: number
          payload_sent: Json | null
          response_body: string | null
          response_status: number | null
          success: boolean | null
          triggered_at: string | null
          triggered_by: string | null
          workflow_key: string
        }
        Insert: {
          id?: number
          payload_sent?: Json | null
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
          triggered_at?: string | null
          triggered_by?: string | null
          workflow_key: string
        }
        Update: {
          id?: number
          payload_sent?: Json | null
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
          triggered_at?: string | null
          triggered_by?: string | null
          workflow_key?: string
        }
        Relationships: []
      }
      dashboard_workflow_webhooks: {
        Row: {
          default_payload: Json | null
          description: string | null
          display_name: string
          display_order: number | null
          http_method: string | null
          id: number
          is_active: boolean | null
          last_triggered_at: string | null
          last_triggered_by: string | null
          requires_confirmation: boolean | null
          webhook_url: string
          workflow_key: string
        }
        Insert: {
          default_payload?: Json | null
          description?: string | null
          display_name: string
          display_order?: number | null
          http_method?: string | null
          id?: number
          is_active?: boolean | null
          last_triggered_at?: string | null
          last_triggered_by?: string | null
          requires_confirmation?: boolean | null
          webhook_url: string
          workflow_key: string
        }
        Update: {
          default_payload?: Json | null
          description?: string | null
          display_name?: string
          display_order?: number | null
          http_method?: string | null
          id?: number
          is_active?: boolean | null
          last_triggered_at?: string | null
          last_triggered_by?: string | null
          requires_confirmation?: boolean | null
          webhook_url?: string
          workflow_key?: string
        }
        Relationships: []
      }
      upgrad_active_leads: {
        Row: {
          callback_booked: boolean | null
          callback_datetime: string | null
          campaign_id: string | null
          city: string | null
          connects_meaningful: number | null
          created_at: string | null
          crm_push_at: string | null
          crm_push_error: string | null
          current_status: string | null
          disqualification_reason: string | null
          disqualified: boolean | null
          email: string | null
          father_name: string | null
          id: string
          interested_field: string | null
          last_called_at: string | null
          lead_source: string | null
          lead_stage: string | null
          lead_stage_extracted: string | null
          lead_status: string | null
          ls_ingested_at: string | null
          ls_prospect_id: string
          ls_prospect_stage: string | null
          main_lead_stage: string | null
          name: string | null
          parent_phone: string | null
          persona: string | null
          phone: string
          preferred_campus: string | null
          pushed_to_crm: boolean | null
          state: string | null
          stream: string | null
          total_attempts: number | null
          total_connects: number | null
          twelfth_score: number | null
          twelfth_year: number | null
          ugnet_registered: boolean | null
          updated_at: string | null
        }
        Insert: {
          callback_booked?: boolean | null
          callback_datetime?: string | null
          campaign_id?: string | null
          city?: string | null
          connects_meaningful?: number | null
          created_at?: string | null
          crm_push_at?: string | null
          crm_push_error?: string | null
          current_status?: string | null
          disqualification_reason?: string | null
          disqualified?: boolean | null
          email?: string | null
          father_name?: string | null
          id?: string
          interested_field?: string | null
          last_called_at?: string | null
          lead_source?: string | null
          lead_stage?: string | null
          lead_stage_extracted?: string | null
          lead_status?: string | null
          ls_ingested_at?: string | null
          ls_prospect_id: string
          ls_prospect_stage?: string | null
          main_lead_stage?: string | null
          name?: string | null
          parent_phone?: string | null
          persona?: string | null
          phone: string
          preferred_campus?: string | null
          pushed_to_crm?: boolean | null
          state?: string | null
          stream?: string | null
          total_attempts?: number | null
          total_connects?: number | null
          twelfth_score?: number | null
          twelfth_year?: number | null
          ugnet_registered?: boolean | null
          updated_at?: string | null
        }
        Update: {
          callback_booked?: boolean | null
          callback_datetime?: string | null
          campaign_id?: string | null
          city?: string | null
          connects_meaningful?: number | null
          created_at?: string | null
          crm_push_at?: string | null
          crm_push_error?: string | null
          current_status?: string | null
          disqualification_reason?: string | null
          disqualified?: boolean | null
          email?: string | null
          father_name?: string | null
          id?: string
          interested_field?: string | null
          last_called_at?: string | null
          lead_source?: string | null
          lead_stage?: string | null
          lead_stage_extracted?: string | null
          lead_status?: string | null
          ls_ingested_at?: string | null
          ls_prospect_id?: string
          ls_prospect_stage?: string | null
          main_lead_stage?: string | null
          name?: string | null
          parent_phone?: string | null
          persona?: string | null
          phone?: string
          preferred_campus?: string | null
          pushed_to_crm?: boolean | null
          state?: string | null
          stream?: string | null
          total_attempts?: number | null
          total_connects?: number | null
          twelfth_score?: number | null
          twelfth_year?: number | null
          ugnet_registered?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      upgrad_archived_leads: {
        Row: {
          archive_reason: string
          archived_at: string
          callback_booked: boolean | null
          callback_datetime: string | null
          campaign_id: string | null
          city: string | null
          connects_meaningful: number | null
          created_at: string | null
          crm_push_at: string | null
          crm_push_error: string | null
          current_status: string | null
          disqualification_reason: string | null
          disqualified: boolean | null
          email: string | null
          father_name: string | null
          id: string
          interested_field: string | null
          last_called_at: string | null
          lead_source: string | null
          lead_stage: string | null
          lead_stage_extracted: string | null
          lead_status: string | null
          ls_ingested_at: string | null
          ls_prospect_id: string
          ls_prospect_stage: string | null
          main_lead_stage: string | null
          name: string | null
          parent_phone: string | null
          persona: string | null
          phone: string | null
          preferred_campus: string | null
          pushed_to_crm: boolean | null
          state: string | null
          stream: string | null
          total_attempts: number | null
          total_connects: number | null
          twelfth_score: number | null
          twelfth_year: number | null
          ugnet_registered: boolean | null
          updated_at: string | null
        }
        Insert: {
          archive_reason: string
          archived_at?: string
          callback_booked?: boolean | null
          callback_datetime?: string | null
          campaign_id?: string | null
          city?: string | null
          connects_meaningful?: number | null
          created_at?: string | null
          crm_push_at?: string | null
          crm_push_error?: string | null
          current_status?: string | null
          disqualification_reason?: string | null
          disqualified?: boolean | null
          email?: string | null
          father_name?: string | null
          id: string
          interested_field?: string | null
          last_called_at?: string | null
          lead_source?: string | null
          lead_stage?: string | null
          lead_stage_extracted?: string | null
          lead_status?: string | null
          ls_ingested_at?: string | null
          ls_prospect_id: string
          ls_prospect_stage?: string | null
          main_lead_stage?: string | null
          name?: string | null
          parent_phone?: string | null
          persona?: string | null
          phone?: string | null
          preferred_campus?: string | null
          pushed_to_crm?: boolean | null
          state?: string | null
          stream?: string | null
          total_attempts?: number | null
          total_connects?: number | null
          twelfth_score?: number | null
          twelfth_year?: number | null
          ugnet_registered?: boolean | null
          updated_at?: string | null
        }
        Update: {
          archive_reason?: string
          archived_at?: string
          callback_booked?: boolean | null
          callback_datetime?: string | null
          campaign_id?: string | null
          city?: string | null
          connects_meaningful?: number | null
          created_at?: string | null
          crm_push_at?: string | null
          crm_push_error?: string | null
          current_status?: string | null
          disqualification_reason?: string | null
          disqualified?: boolean | null
          email?: string | null
          father_name?: string | null
          id?: string
          interested_field?: string | null
          last_called_at?: string | null
          lead_source?: string | null
          lead_stage?: string | null
          lead_stage_extracted?: string | null
          lead_status?: string | null
          ls_ingested_at?: string | null
          ls_prospect_id?: string
          ls_prospect_stage?: string | null
          main_lead_stage?: string | null
          name?: string | null
          parent_phone?: string | null
          persona?: string | null
          phone?: string | null
          preferred_campus?: string | null
          pushed_to_crm?: boolean | null
          state?: string | null
          stream?: string | null
          total_attempts?: number | null
          total_connects?: number | null
          twelfth_score?: number | null
          twelfth_year?: number | null
          ugnet_registered?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      upgrad_call_logs: {
        Row: {
          agent_id: string | null
          agent_malfunction: boolean | null
          agent_malfunction_details: string | null
          asked_brochure: boolean | null
          asked_payment_link: boolean | null
          attempt_date: string | null
          attempt_time: string | null
          call_duration_quality: string | null
          call_end: string | null
          call_end_reason: string | null
          call_flagged: boolean | null
          call_id: string
          call_outcome: string | null
          call_start: string | null
          call_status: string | null
          call_success: boolean | null
          callback_at: string | null
          callback_booked: boolean | null
          callback_datetime: string | null
          caller_city: string | null
          caller_college_status: string | null
          caller_language: string | null
          caller_priority: string | null
          caller_state: string | null
          caller_twelfth_year: string | null
          caller_type: string | null
          campaign_id: string | null
          colleges_considering: string | null
          conversation_depth: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          disqualification_reason: string | null
          disqualified: boolean | null
          dnd: boolean | null
          duration_seconds: number | null
          enquiry_classification: string | null
          extracted_status: string | null
          flagged_at: string | null
          flagged_by: string | null
          flagged_reason: string | null
          flagged_source: string | null
          id: number
          interested_field: string | null
          interested_lead: boolean | null
          jee_status: string | null
          lead_id: string
          lead_source: string | null
          ls_call_activity_id: string | null
          objections_raised: string | null
          payment_concern: boolean | null
          phone: string | null
          phone_id: string | null
          platform: string | null
          preferred_campus: string | null
          push_to_client: boolean | null
          recording_url: string | null
          retry_required: boolean | null
          ring_duration_seconds: number | null
          sentiment: string | null
          transcript: string | null
          transcript_search: unknown
          transcript_summary: string | null
          twelfth_stream: string | null
          ugnet_registered: boolean | null
          wa_template_sent: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_malfunction?: boolean | null
          agent_malfunction_details?: string | null
          asked_brochure?: boolean | null
          asked_payment_link?: boolean | null
          attempt_date?: string | null
          attempt_time?: string | null
          call_duration_quality?: string | null
          call_end?: string | null
          call_end_reason?: string | null
          call_flagged?: boolean | null
          call_id: string
          call_outcome?: string | null
          call_start?: string | null
          call_status?: string | null
          call_success?: boolean | null
          callback_at?: string | null
          callback_booked?: boolean | null
          callback_datetime?: string | null
          caller_city?: string | null
          caller_college_status?: string | null
          caller_language?: string | null
          caller_priority?: string | null
          caller_state?: string | null
          caller_twelfth_year?: string | null
          caller_type?: string | null
          campaign_id?: string | null
          colleges_considering?: string | null
          conversation_depth?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          disqualification_reason?: string | null
          disqualified?: boolean | null
          dnd?: boolean | null
          duration_seconds?: number | null
          enquiry_classification?: string | null
          extracted_status?: string | null
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          flagged_source?: string | null
          id?: number
          interested_field?: string | null
          interested_lead?: boolean | null
          jee_status?: string | null
          lead_id: string
          lead_source?: string | null
          ls_call_activity_id?: string | null
          objections_raised?: string | null
          payment_concern?: boolean | null
          phone?: string | null
          phone_id?: string | null
          platform?: string | null
          preferred_campus?: string | null
          push_to_client?: boolean | null
          recording_url?: string | null
          retry_required?: boolean | null
          ring_duration_seconds?: number | null
          sentiment?: string | null
          transcript?: string | null
          transcript_search?: unknown
          transcript_summary?: string | null
          twelfth_stream?: string | null
          ugnet_registered?: boolean | null
          wa_template_sent?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_malfunction?: boolean | null
          agent_malfunction_details?: string | null
          asked_brochure?: boolean | null
          asked_payment_link?: boolean | null
          attempt_date?: string | null
          attempt_time?: string | null
          call_duration_quality?: string | null
          call_end?: string | null
          call_end_reason?: string | null
          call_flagged?: boolean | null
          call_id?: string
          call_outcome?: string | null
          call_start?: string | null
          call_status?: string | null
          call_success?: boolean | null
          callback_at?: string | null
          callback_booked?: boolean | null
          callback_datetime?: string | null
          caller_city?: string | null
          caller_college_status?: string | null
          caller_language?: string | null
          caller_priority?: string | null
          caller_state?: string | null
          caller_twelfth_year?: string | null
          caller_type?: string | null
          campaign_id?: string | null
          colleges_considering?: string | null
          conversation_depth?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          disqualification_reason?: string | null
          disqualified?: boolean | null
          dnd?: boolean | null
          duration_seconds?: number | null
          enquiry_classification?: string | null
          extracted_status?: string | null
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          flagged_source?: string | null
          id?: number
          interested_field?: string | null
          interested_lead?: boolean | null
          jee_status?: string | null
          lead_id?: string
          lead_source?: string | null
          ls_call_activity_id?: string | null
          objections_raised?: string | null
          payment_concern?: boolean | null
          phone?: string | null
          phone_id?: string | null
          platform?: string | null
          preferred_campus?: string | null
          push_to_client?: boolean | null
          recording_url?: string | null
          retry_required?: boolean | null
          ring_duration_seconds?: number | null
          sentiment?: string | null
          transcript?: string | null
          transcript_search?: unknown
          transcript_summary?: string | null
          twelfth_stream?: string | null
          ugnet_registered?: boolean | null
          wa_template_sent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upgrad_call_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "pending_crm_push"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "upgrad_call_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "upgrad_active_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      upgrad_call_queue: {
        Row: {
          agent_id: string | null
          attempt_number: number | null
          call_id: string | null
          campaign_id: string | null
          completed_at: string | null
          customer_id: string
          dispatched_at: string | null
          error_message: string | null
          id: number
          lead_id: string | null
          name: string | null
          next_attempt_at: string | null
          phone: string | null
          phone_id: string | null
          platform: string | null
          queued_at: string | null
          status: string | null
        }
        Insert: {
          agent_id?: string | null
          attempt_number?: number | null
          call_id?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          customer_id: string
          dispatched_at?: string | null
          error_message?: string | null
          id?: number
          lead_id?: string | null
          name?: string | null
          next_attempt_at?: string | null
          phone?: string | null
          phone_id?: string | null
          platform?: string | null
          queued_at?: string | null
          status?: string | null
        }
        Update: {
          agent_id?: string | null
          attempt_number?: number | null
          call_id?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          customer_id?: string
          dispatched_at?: string | null
          error_message?: string | null
          id?: number
          lead_id?: string | null
          name?: string | null
          next_attempt_at?: string | null
          phone?: string | null
          phone_id?: string | null
          platform?: string | null
          queued_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upgrad_call_queue_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "pending_crm_push"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "upgrad_call_queue_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "upgrad_active_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      upgrad_campaign_config: {
        Row: {
          agent_id: string
          agent_name: string | null
          aisensy_api_key: string | null
          campaign_id: string
          campaign_name: string | null
          created_at: string | null
          id: number
          is_active: boolean | null
          max_attempts: number | null
          max_daily_calls: number | null
          platform: string | null
          priority_callback: number | null
          priority_new: number | null
          priority_retry: number | null
          retry_gap_hours: number | null
          ugnet_deadline: string | null
          updated_at: string | null
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          agent_id: string
          agent_name?: string | null
          aisensy_api_key?: string | null
          campaign_id: string
          campaign_name?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          max_attempts?: number | null
          max_daily_calls?: number | null
          platform?: string | null
          priority_callback?: number | null
          priority_new?: number | null
          priority_retry?: number | null
          retry_gap_hours?: number | null
          ugnet_deadline?: string | null
          updated_at?: string | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          agent_id?: string
          agent_name?: string | null
          aisensy_api_key?: string | null
          campaign_id?: string
          campaign_name?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          max_attempts?: number | null
          max_daily_calls?: number | null
          platform?: string | null
          priority_callback?: number | null
          priority_new?: number | null
          priority_retry?: number | null
          retry_gap_hours?: number | null
          ugnet_deadline?: string | null
          updated_at?: string | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: []
      }
      upgrad_campaign_phones: {
        Row: {
          campaign_id: string
          id: number
          is_active: boolean | null
          phone_number_id: string
        }
        Insert: {
          campaign_id: string
          id?: number
          is_active?: boolean | null
          phone_number_id: string
        }
        Update: {
          campaign_id?: string
          id?: number
          is_active?: boolean | null
          phone_number_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upgrad_campaign_phones_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "upgrad_campaign_config"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "upgrad_campaign_phones_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "upgrad_phone_numbers"
            referencedColumns: ["phone_number_id"]
          },
        ]
      }
      upgrad_ls_sync_log: {
        Row: {
          action: string
          attempt_number: number | null
          call_id: string | null
          created_at: string | null
          customer_id: string | null
          error_message: string | null
          id: string
          ls_prospect_id: string | null
          request_payload: Json | null
          response_body: string | null
          response_status: number | null
          success: boolean | null
        }
        Insert: {
          action: string
          attempt_number?: number | null
          call_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          id?: string
          ls_prospect_id?: string | null
          request_payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
        }
        Update: {
          action?: string
          attempt_number?: number | null
          call_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          id?: string
          ls_prospect_id?: string | null
          request_payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "upgrad_ls_sync_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "pending_crm_push"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "upgrad_ls_sync_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "upgrad_active_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      upgrad_phone_numbers: {
        Row: {
          created_at: string | null
          id: number
          is_active: boolean | null
          label: string | null
          last_assigned_at: string | null
          phone_number: string | null
          phone_number_id: string
          platform: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          label?: string | null
          last_assigned_at?: string | null
          phone_number?: string | null
          phone_number_id: string
          platform?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          label?: string | null
          last_assigned_at?: string | null
          phone_number?: string | null
          phone_number_id?: string
          platform?: string | null
        }
        Relationships: []
      }
      upgrad_wa_config: {
        Row: {
          active: boolean | null
          aisensy_campaign: string | null
          conditions: Json
          created_at: string | null
          id: number
          params: string[]
          phone_field: string | null
          priority: number
          template_key: string
        }
        Insert: {
          active?: boolean | null
          aisensy_campaign?: string | null
          conditions: Json
          created_at?: string | null
          id?: number
          params: string[]
          phone_field?: string | null
          priority: number
          template_key: string
        }
        Update: {
          active?: boolean | null
          aisensy_campaign?: string | null
          conditions?: Json
          created_at?: string | null
          id?: number
          params?: string[]
          phone_field?: string | null
          priority?: number
          template_key?: string
        }
        Relationships: []
      }
      upgrad_wa_log: {
        Row: {
          aisensy_campaign: string | null
          aisensy_response: Json | null
          call_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          params_sent: Json | null
          phone: string | null
          sent_at: string | null
          status: string | null
          template_key: string | null
        }
        Insert: {
          aisensy_campaign?: string | null
          aisensy_response?: Json | null
          call_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          params_sent?: Json | null
          phone?: string | null
          sent_at?: string | null
          status?: string | null
          template_key?: string | null
        }
        Update: {
          aisensy_campaign?: string | null
          aisensy_response?: Json | null
          call_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          params_sent?: Json | null
          phone?: string | null
          sent_at?: string | null
          status?: string | null
          template_key?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      pending_crm_push: {
        Row: {
          asked_brochure: boolean | null
          asked_payment_link: boolean | null
          call_end: string | null
          call_id: string | null
          call_start: string | null
          call_status: string | null
          callback_booked: boolean | null
          callback_datetime: string | null
          caller_language: string | null
          caller_type: string | null
          campaign_id: string | null
          crm_push_at: string | null
          customer_id: string | null
          disqualification_reason: string | null
          disqualified: boolean | null
          duration_seconds: number | null
          interested_field: string | null
          lead_stage: string | null
          lead_stage_extracted: string | null
          ls_call_activity_id: string | null
          ls_prospect_id: string | null
          name: string | null
          objections_raised: string | null
          payment_concern: boolean | null
          phone: string | null
          phone_id: string | null
          preferred_campus: string | null
          source_number: string | null
          transcript_summary: string | null
          ugnet_registered: boolean | null
        }
        Relationships: []
      }
      v_admin_call_logs: {
        Row: {
          agent_malfunction: boolean | null
          agent_malfunction_details: string | null
          call_end: string | null
          call_flagged: boolean | null
          call_id: string | null
          call_start: string | null
          call_status: string | null
          caller_language: string | null
          caller_type: string | null
          campaign_id: string | null
          disqualification_reason: string | null
          dnd: boolean | null
          duration_seconds: number | null
          enquiry_classification: string | null
          extracted_status: string | null
          flagged_at: string | null
          flagged_by: string | null
          flagged_reason: string | null
          flagged_source: string | null
          id: number | null
          lead_name: string | null
          lead_phone: string | null
          lead_stage: string | null
          ls_call_activity_id: string | null
          ls_prospect_id: string | null
          objections_raised: string | null
          recording_url: string | null
          total_attempts: number | null
          transcript: string | null
          transcript_summary: string | null
        }
        Relationships: []
      }
      v_admin_ls_health: {
        Row: {
          action: string | null
          failed: number | null
          hour: string | null
          succeeded: number | null
          success_pct: number | null
          total: number | null
        }
        Relationships: []
      }
      v_admin_perf_by_attempt: {
        Row: {
          attempt_number: number | null
          avg_duration_sec: number | null
          connects: number | null
          day: string | null
          dnd_flagged: number | null
          meaningful_connects: number | null
          qualified: number | null
          total_calls: number | null
        }
        Relationships: []
      }
      v_admin_pipeline_now: {
        Row: {
          awaiting_push: number | null
          due_now: number | null
          flagged_24h: number | null
          in_flight: number | null
          malfunctions_24h: number | null
          scheduled_future: number | null
          stale_unpushed: number | null
          stuck_pending: number | null
        }
        Relationships: []
      }
      v_admin_voice_minutes: {
        Row: {
          billable_minutes: number | null
          connected_calls: number | null
          day_ist: string | null
          minutes_used: number | null
          total_calls: number | null
        }
        Relationships: []
      }
      v_client_call_summaries: {
        Row: {
          attempt_date: string | null
          attempt_time: string | null
          call_end_reason: string | null
          call_id: string | null
          call_start: string | null
          call_status: string | null
          callback_booked: boolean | null
          callback_datetime: string | null
          campaign_id: string | null
          duration_seconds: number | null
          enquiry_classification: string | null
          lead_id: string | null
          lead_source: string | null
          transcript_summary: string | null
        }
        Insert: {
          attempt_date?: string | null
          attempt_time?: string | null
          call_end_reason?: string | null
          call_id?: string | null
          call_start?: string | null
          call_status?: string | null
          callback_booked?: boolean | null
          callback_datetime?: string | null
          campaign_id?: string | null
          duration_seconds?: number | null
          enquiry_classification?: string | null
          lead_id?: string | null
          lead_source?: string | null
          transcript_summary?: string | null
        }
        Update: {
          attempt_date?: string | null
          attempt_time?: string | null
          call_end_reason?: string | null
          call_id?: string | null
          call_start?: string | null
          call_status?: string | null
          callback_booked?: boolean | null
          callback_datetime?: string | null
          campaign_id?: string | null
          duration_seconds?: number | null
          enquiry_classification?: string | null
          lead_id?: string | null
          lead_source?: string | null
          transcript_summary?: string | null
        }
        Relationships: []
      }
      v_client_connectivity: {
        Row: {
          attempt_number: number | null
          connect_rate_pct: number | null
          connected: number | null
          total: number | null
        }
        Relationships: []
      }
      v_client_daily_volume: {
        Row: {
          calls_made: number | null
          connected: number | null
          day: string | null
          qualified: number | null
        }
        Relationships: []
      }
      v_client_dispositions: {
        Row: {
          lead_count: number | null
          lead_stage: string | null
        }
        Relationships: []
      }
      v_client_funnel: {
        Row: {
          attempted: number | null
          callback_pending: number | null
          connected: number | null
          hot: number | null
          qualified: number | null
          total_leads: number | null
          warm: number | null
        }
        Relationships: []
      }
      v_client_hot_warm_leads: {
        Row: {
          callback_booked: boolean | null
          callback_datetime: string | null
          city: string | null
          first_name: string | null
          interested_field: string | null
          last_called_at: string | null
          lead_stage: string | null
          lead_uid: string | null
          ls_prospect_id: string | null
          phone: string | null
          preferred_campus: string | null
          state: string | null
        }
        Insert: {
          callback_booked?: boolean | null
          callback_datetime?: string | null
          city?: string | null
          first_name?: never
          interested_field?: string | null
          last_called_at?: string | null
          lead_stage?: string | null
          lead_uid?: never
          ls_prospect_id?: string | null
          phone?: string | null
          preferred_campus?: string | null
          state?: never
        }
        Update: {
          callback_booked?: boolean | null
          callback_datetime?: string | null
          city?: string | null
          first_name?: never
          interested_field?: string | null
          last_called_at?: string | null
          lead_stage?: string | null
          lead_uid?: never
          ls_prospect_id?: string | null
          phone?: string | null
          preferred_campus?: string | null
          state?: never
        }
        Relationships: []
      }
      v_client_leads_by_stage: {
        Row: {
          callback_booked: boolean | null
          callback_datetime: string | null
          city: string | null
          connected_on_attempt: number | null
          first_name: string | null
          interested_field: string | null
          is_archived: boolean | null
          last_called_at: string | null
          lead_source: string | null
          lead_stage: string | null
          lead_uid: string | null
          ls_ingested_at: string | null
          ls_prospect_id: string | null
          phone: string | null
          preferred_campus: string | null
          state: string | null
          total_attempts: number | null
          total_connects: number | null
        }
        Relationships: []
      }
      v_client_minutes_summary: {
        Row: {
          allocated_minutes: number | null
          allocation_month: string | null
          campaign_id: string | null
          minutes_remaining: number | null
          minutes_used: number | null
          utilization_pct: number | null
        }
        Relationships: []
      }
      v_client_source_performance: {
        Row: {
          attempted: number | null
          connect_rate_pct: number | null
          connected: number | null
          hot: number | null
          qualification_rate_pct: number | null
          source: string | null
          total_leads: number | null
          ugnet_registrations: number | null
          warm: number | null
        }
        Relationships: []
      }
      v_client_state_performance: {
        Row: {
          attempted: number | null
          connected: number | null
          hot: number | null
          qualification_rate_pct: number | null
          state: string | null
          total_leads: number | null
          ugnet_registrations: number | null
          warm: number | null
        }
        Relationships: []
      }
      v_super_campaign_summary: {
        Row: {
          avg_call_duration_sec: number | null
          campaign_id: string | null
          campaign_name: string | null
          cb_later: number | null
          connected_calls: number | null
          high_intent_rate_pct: number | null
          hot: number | null
          hot_per_minute: number | null
          is_active: boolean | null
          leads_attempted: number | null
          leads_connected: number | null
          minutes_used: number | null
          qualification_rate_pct: number | null
          qualified_per_minute: number | null
          total_calls: number | null
          total_leads: number | null
          ugnet_conversion_rate_pct: number | null
          ugnet_registrations: number | null
          warm: number | null
        }
        Relationships: []
      }
      v_super_conversions_monthly: {
        Row: {
          campaign_id: string | null
          cb_later: number | null
          cold: number | null
          dnp: number | null
          high_intent_rate_pct: number | null
          hot: number | null
          leads_classified: number | null
          month_label: string | null
          month_start: string | null
          not_eligible: number | null
          not_interested: number | null
          qualification_rate_pct: number | null
          sent_brochure: number | null
          sent_payment_link: number | null
          ugnet_conversion_rate_pct: number | null
          ugnet_registrations: number | null
          warm: number | null
        }
        Relationships: []
      }
      v_super_flagged_calls: {
        Row: {
          agent_malfunction: boolean | null
          call_id: string | null
          call_start: string | null
          call_status: string | null
          duration_seconds: number | null
          enquiry_classification: string | null
          flagged_at: string | null
          flagged_by_email: string | null
          flagged_reason: string | null
          flagged_source: string | null
          id: number | null
          lead_name: string | null
          lead_stage: string | null
          ls_prospect_id: string | null
          masked_phone: string | null
          transcript_summary: string | null
        }
        Relationships: []
      }
      v_super_lead_allocations: {
        Row: {
          attempt_rate_pct: number | null
          campaign_id: string | null
          connect_rate_pct: number | null
          leads_attempted: number | null
          leads_connected: number | null
          leads_ingested: number | null
          month_label: string | null
          month_start: string | null
        }
        Relationships: []
      }
      v_super_minutes_monthly: {
        Row: {
          allocated_minutes: number | null
          avg_duration_sec: number | null
          billable_minutes: number | null
          campaign_id: string | null
          connected_calls: number | null
          minutes_used: number | null
          month_label: string | null
          month_start: string | null
          total_calls: number | null
          utilization_pct: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      archive_lead: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      build_daily_queue: { Args: never; Returns: number }
      current_user_role: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      normalize_phone: { Args: { raw: string }; Returns: string }
      queue_reattempt: {
        Args: {
          p_attempt: number
          p_callback_time?: string
          p_campaign_id: string
          p_customer_id: string
          p_is_callback?: boolean
          p_lead_id: string
          p_name: string
          p_phone: string
        }
        Returns: undefined
      }
      resolve_lead_stage: {
        Args: {
          asked_brochure?: boolean
          asked_payment?: boolean
          classification: string
          is_callback?: boolean
          is_dnd?: boolean
        }
        Returns: {
          lead_stage: string
          lead_stage_extracted: string
        }[]
      }
      search_call_transcripts: {
        Args: { p_lead_stage?: string; p_limit?: number; p_query: string }
        Returns: {
          call_id: string
          call_start: string
          enquiry_classification: string
          lead_name: string
          lead_stage: string
          rank: number
          transcript_summary: string
        }[]
      }
      to_ls_datetime: { Args: { ts: string }; Returns: string }
      top_objections: {
        Args: { p_limit?: number }
        Returns: {
          frequency: number
          objection: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
