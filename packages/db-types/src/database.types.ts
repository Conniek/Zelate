export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      member_specialties: {
        Row: {
          member_id: string;
          specialty_code: string;
        };
        Insert: {
          member_id: string;
          specialty_code: string;
        };
        Update: {
          member_id?: string;
          specialty_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'member_specialties_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'public_stylists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'member_specialties_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'salon_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'member_specialties_specialty_code_fkey';
            columns: ['specialty_code'];
            isOneToOne: false;
            referencedRelation: 'specialties';
            referencedColumns: ['code'];
          },
        ];
      };
      notifications: {
        Row: {
          attempts: number;
          channel: Database['public']['Enums']['notification_channel'];
          cost_cents: number | null;
          created_at: string;
          dedupe_key: string;
          id: string;
          last_error: string | null;
          params: Json;
          provider_message_id: string | null;
          recipient_member_id: string | null;
          recipient_profile_id: string | null;
          requires_consent: boolean;
          salon_id: string;
          scheduled_at: string;
          sent_at: string | null;
          skip_reason: string | null;
          status: Database['public']['Enums']['notification_status'];
          template: Database['public']['Enums']['notification_template'];
          ticket_id: string | null;
        };
        Insert: {
          attempts?: number;
          channel: Database['public']['Enums']['notification_channel'];
          cost_cents?: number | null;
          created_at?: string;
          dedupe_key: string;
          id?: string;
          last_error?: string | null;
          params?: Json;
          provider_message_id?: string | null;
          recipient_member_id?: string | null;
          recipient_profile_id?: string | null;
          requires_consent?: boolean;
          salon_id: string;
          scheduled_at?: string;
          sent_at?: string | null;
          skip_reason?: string | null;
          status?: Database['public']['Enums']['notification_status'];
          template: Database['public']['Enums']['notification_template'];
          ticket_id?: string | null;
        };
        Update: {
          attempts?: number;
          channel?: Database['public']['Enums']['notification_channel'];
          cost_cents?: number | null;
          created_at?: string;
          dedupe_key?: string;
          id?: string;
          last_error?: string | null;
          params?: Json;
          provider_message_id?: string | null;
          recipient_member_id?: string | null;
          recipient_profile_id?: string | null;
          requires_consent?: boolean;
          salon_id?: string;
          scheduled_at?: string;
          sent_at?: string | null;
          skip_reason?: string | null;
          status?: Database['public']['Enums']['notification_status'];
          template?: Database['public']['Enums']['notification_template'];
          ticket_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_recipient_member_id_fkey';
            columns: ['recipient_member_id'];
            isOneToOne: false;
            referencedRelation: 'public_stylists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_recipient_member_id_fkey';
            columns: ['recipient_member_id'];
            isOneToOne: false;
            referencedRelation: 'salon_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_recipient_profile_id_fkey';
            columns: ['recipient_profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'public_salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: false;
            referencedRelation: 'tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      opening_hours: {
        Row: {
          closes_at: string;
          created_at: string;
          id: string;
          opens_at: string;
          salon_id: string;
          updated_at: string;
          weekday: number;
        };
        Insert: {
          closes_at: string;
          created_at?: string;
          id?: string;
          opens_at: string;
          salon_id: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          closes_at?: string;
          created_at?: string;
          id?: string;
          opens_at?: string;
          salon_id?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'opening_hours_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'public_salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'opening_hours_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'salons';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          first_name: string;
          id: string;
          is_guest: boolean;
          last_name: string | null;
          marketing_consent_at: string | null;
          tracking_consent_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          first_name: string;
          id: string;
          is_guest?: boolean;
          last_name?: string | null;
          marketing_consent_at?: string | null;
          tracking_consent_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          first_name?: string;
          id?: string;
          is_guest?: boolean;
          last_name?: string | null;
          marketing_consent_at?: string | null;
          tracking_consent_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth_secret: string;
          created_at: string;
          endpoint: string;
          expired_at: string | null;
          id: string;
          last_success_at: string | null;
          member_id: string | null;
          p256dh: string;
          profile_id: string | null;
          ticket_id: string | null;
          user_agent: string | null;
        };
        Insert: {
          auth_secret: string;
          created_at?: string;
          endpoint: string;
          expired_at?: string | null;
          id?: string;
          last_success_at?: string | null;
          member_id?: string | null;
          p256dh: string;
          profile_id?: string | null;
          ticket_id?: string | null;
          user_agent?: string | null;
        };
        Update: {
          auth_secret?: string;
          created_at?: string;
          endpoint?: string;
          expired_at?: string | null;
          id?: string;
          last_success_at?: string | null;
          member_id?: string | null;
          p256dh?: string;
          profile_id?: string | null;
          ticket_id?: string | null;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'public_stylists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_subscriptions_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'salon_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_subscriptions_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_subscriptions_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: false;
            referencedRelation: 'tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      salon_closures: {
        Row: {
          created_at: string;
          ends_on: string;
          id: string;
          reason: string | null;
          salon_id: string;
          starts_on: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          ends_on: string;
          id?: string;
          reason?: string | null;
          salon_id: string;
          starts_on: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_on?: string;
          id?: string;
          reason?: string | null;
          salon_id?: string;
          starts_on?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'salon_closures_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'public_salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'salon_closures_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'salons';
            referencedColumns: ['id'];
          },
        ];
      };
      salon_events: {
        Row: {
          actor_member_id: string | null;
          actor_profile_id: string | null;
          actor_type: Database['public']['Enums']['actor_type'];
          after: Json | null;
          before: Json | null;
          command_id: string | null;
          created_at: string;
          id: number;
          reason_code: string | null;
          salon_id: string;
          subject_member_id: string | null;
          ticket_id: string | null;
          type: Database['public']['Enums']['salon_event_type'];
        };
        Insert: {
          actor_member_id?: string | null;
          actor_profile_id?: string | null;
          actor_type: Database['public']['Enums']['actor_type'];
          after?: Json | null;
          before?: Json | null;
          command_id?: string | null;
          created_at?: string;
          id?: never;
          reason_code?: string | null;
          salon_id: string;
          subject_member_id?: string | null;
          ticket_id?: string | null;
          type: Database['public']['Enums']['salon_event_type'];
        };
        Update: {
          actor_member_id?: string | null;
          actor_profile_id?: string | null;
          actor_type?: Database['public']['Enums']['actor_type'];
          after?: Json | null;
          before?: Json | null;
          command_id?: string | null;
          created_at?: string;
          id?: never;
          reason_code?: string | null;
          salon_id?: string;
          subject_member_id?: string | null;
          ticket_id?: string | null;
          type?: Database['public']['Enums']['salon_event_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'salon_events_actor_member_id_fkey';
            columns: ['actor_member_id'];
            isOneToOne: false;
            referencedRelation: 'public_stylists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'salon_events_actor_member_id_fkey';
            columns: ['actor_member_id'];
            isOneToOne: false;
            referencedRelation: 'salon_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'salon_events_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'public_salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'salon_events_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'salon_events_subject_member_id_fkey';
            columns: ['subject_member_id'];
            isOneToOne: false;
            referencedRelation: 'public_stylists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'salon_events_subject_member_id_fkey';
            columns: ['subject_member_id'];
            isOneToOne: false;
            referencedRelation: 'salon_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'salon_events_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: false;
            referencedRelation: 'tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      salon_members: {
        Row: {
          created_at: string;
          email: string;
          first_name: string;
          id: string;
          is_hairdressing: boolean;
          last_name: string;
          photo_path: string | null;
          profile_id: string | null;
          role: Database['public']['Enums']['member_role'];
          salon_id: string;
          served_today_count: number;
          status: Database['public']['Enums']['member_status'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          first_name: string;
          id?: string;
          is_hairdressing?: boolean;
          last_name: string;
          photo_path?: string | null;
          profile_id?: string | null;
          role: Database['public']['Enums']['member_role'];
          salon_id: string;
          served_today_count?: number;
          status?: Database['public']['Enums']['member_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          first_name?: string;
          id?: string;
          is_hairdressing?: boolean;
          last_name?: string;
          photo_path?: string | null;
          profile_id?: string | null;
          role?: Database['public']['Enums']['member_role'];
          salon_id?: string;
          served_today_count?: number;
          status?: Database['public']['Enums']['member_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'salon_members_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'salon_members_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'public_salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'salon_members_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'salons';
            referencedColumns: ['id'];
          },
        ];
      };
      salon_verifications: {
        Row: {
          checked_at: string;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision: Database['public']['Enums']['verification_decision'];
          decision_reason: string | null;
          id: string;
          salon_id: string;
          siret_check_payload: Json | null;
          siret_check_result: Database['public']['Enums']['siret_check_result'];
        };
        Insert: {
          checked_at: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision?: Database['public']['Enums']['verification_decision'];
          decision_reason?: string | null;
          id?: string;
          salon_id: string;
          siret_check_payload?: Json | null;
          siret_check_result: Database['public']['Enums']['siret_check_result'];
        };
        Update: {
          checked_at?: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision?: Database['public']['Enums']['verification_decision'];
          decision_reason?: string | null;
          id?: string;
          salon_id?: string;
          siret_check_payload?: Json | null;
          siret_check_result?: Database['public']['Enums']['siret_check_result'];
        };
        Relationships: [
          {
            foreignKeyName: 'salon_verifications_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'platform_admins';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'salon_verifications_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'public_salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'salon_verifications_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'salons';
            referencedColumns: ['id'];
          },
        ];
      };
      salons: {
        Row: {
          address_line: string;
          auto_release_after_minutes: number;
          city: string;
          city_code: string | null;
          closing_grace_minutes: number;
          created_at: string;
          created_by: string;
          current_wait_minutes: number | null;
          draft_expires_at: string | null;
          end_of_day_warning_minutes: number;
          estimate_updated_at: string | null;
          id: string;
          is_full: boolean;
          location: unknown;
          naf_code: string | null;
          name: string;
          next_free_slots: Json;
          phone: string;
          photo_paths: string[];
          postal_code: string;
          published_at: string | null;
          qr_token: string;
          queue_status: Database['public']['Enums']['queue_status'];
          queue_version: number;
          reminder_after_minutes: number;
          setup_test_passed_at: string | null;
          siret: string;
          slug: string;
          status: Database['public']['Enums']['salon_status'];
          updated_at: string;
          waiting_count: number;
          welcome_message: string | null;
        };
        Insert: {
          address_line: string;
          auto_release_after_minutes?: number;
          city: string;
          city_code?: string | null;
          closing_grace_minutes?: number;
          created_at?: string;
          created_by: string;
          current_wait_minutes?: number | null;
          draft_expires_at?: string | null;
          end_of_day_warning_minutes?: number;
          estimate_updated_at?: string | null;
          id?: string;
          is_full?: boolean;
          location: unknown;
          naf_code?: string | null;
          name: string;
          next_free_slots?: Json;
          phone: string;
          photo_paths?: string[];
          postal_code: string;
          published_at?: string | null;
          qr_token?: string;
          queue_status?: Database['public']['Enums']['queue_status'];
          queue_version?: number;
          reminder_after_minutes?: number;
          setup_test_passed_at?: string | null;
          siret: string;
          slug: string;
          status?: Database['public']['Enums']['salon_status'];
          updated_at?: string;
          waiting_count?: number;
          welcome_message?: string | null;
        };
        Update: {
          address_line?: string;
          auto_release_after_minutes?: number;
          city?: string;
          city_code?: string | null;
          closing_grace_minutes?: number;
          created_at?: string;
          created_by?: string;
          current_wait_minutes?: number | null;
          draft_expires_at?: string | null;
          end_of_day_warning_minutes?: number;
          estimate_updated_at?: string | null;
          id?: string;
          is_full?: boolean;
          location?: unknown;
          naf_code?: string | null;
          name?: string;
          next_free_slots?: Json;
          phone?: string;
          photo_paths?: string[];
          postal_code?: string;
          published_at?: string | null;
          qr_token?: string;
          queue_status?: Database['public']['Enums']['queue_status'];
          queue_version?: number;
          reminder_after_minutes?: number;
          setup_test_passed_at?: string | null;
          siret?: string;
          slug?: string;
          status?: Database['public']['Enums']['salon_status'];
          updated_at?: string;
          waiting_count?: number;
          welcome_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'salons_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      services: {
        Row: {
          created_at: string;
          duration_minutes: number;
          id: string;
          is_active: boolean;
          name: string;
          price_cents: number;
          required_specialty_code: string | null;
          salon_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          duration_minutes: number;
          id?: string;
          is_active?: boolean;
          name: string;
          price_cents: number;
          required_specialty_code?: string | null;
          salon_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          is_active?: boolean;
          name?: string;
          price_cents?: number;
          required_specialty_code?: string | null;
          salon_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'services_required_specialty_code_fkey';
            columns: ['required_specialty_code'];
            isOneToOne: false;
            referencedRelation: 'specialties';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'services_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'public_salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'services_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'salons';
            referencedColumns: ['id'];
          },
        ];
      };
      specialties: {
        Row: {
          code: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          sort_order: number;
        };
        Update: {
          code?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      stylist_presence: {
        Row: {
          break_type: Database['public']['Enums']['break_type'] | null;
          created_at: string;
          expected_back_at: string | null;
          id: string;
          member_id: string;
          salon_id: string;
          service_date: string;
          shift_end_at: string | null;
          status: Database['public']['Enums']['presence_status'];
          status_since: string;
          updated_at: string;
          updated_by_member_id: string | null;
        };
        Insert: {
          break_type?: Database['public']['Enums']['break_type'] | null;
          created_at?: string;
          expected_back_at?: string | null;
          id?: string;
          member_id: string;
          salon_id: string;
          service_date: string;
          shift_end_at?: string | null;
          status?: Database['public']['Enums']['presence_status'];
          status_since: string;
          updated_at?: string;
          updated_by_member_id?: string | null;
        };
        Update: {
          break_type?: Database['public']['Enums']['break_type'] | null;
          created_at?: string;
          expected_back_at?: string | null;
          id?: string;
          member_id?: string;
          salon_id?: string;
          service_date?: string;
          shift_end_at?: string | null;
          status?: Database['public']['Enums']['presence_status'];
          status_since?: string;
          updated_at?: string;
          updated_by_member_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'stylist_presence_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'public_stylists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stylist_presence_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'salon_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stylist_presence_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'public_salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stylist_presence_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stylist_presence_updated_by_member_id_fkey';
            columns: ['updated_by_member_id'];
            isOneToOne: false;
            referencedRelation: 'public_stylists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stylist_presence_updated_by_member_id_fkey';
            columns: ['updated_by_member_id'];
            isOneToOne: false;
            referencedRelation: 'salon_members';
            referencedColumns: ['id'];
          },
        ];
      };
      ticket_events: {
        Row: {
          actor_member_id: string | null;
          actor_profile_id: string | null;
          actor_type: Database['public']['Enums']['actor_type'];
          after: Json | null;
          before: Json | null;
          command_id: string | null;
          created_at: string;
          id: number;
          reason_code: string | null;
          salon_id: string;
          ticket_id: string;
          type: Database['public']['Enums']['ticket_event_type'];
        };
        Insert: {
          actor_member_id?: string | null;
          actor_profile_id?: string | null;
          actor_type: Database['public']['Enums']['actor_type'];
          after?: Json | null;
          before?: Json | null;
          command_id?: string | null;
          created_at?: string;
          id?: never;
          reason_code?: string | null;
          salon_id: string;
          ticket_id: string;
          type: Database['public']['Enums']['ticket_event_type'];
        };
        Update: {
          actor_member_id?: string | null;
          actor_profile_id?: string | null;
          actor_type?: Database['public']['Enums']['actor_type'];
          after?: Json | null;
          before?: Json | null;
          command_id?: string | null;
          created_at?: string;
          id?: never;
          reason_code?: string | null;
          salon_id?: string;
          ticket_id?: string;
          type?: Database['public']['Enums']['ticket_event_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'ticket_events_actor_member_id_fkey';
            columns: ['actor_member_id'];
            isOneToOne: false;
            referencedRelation: 'public_stylists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ticket_events_actor_member_id_fkey';
            columns: ['actor_member_id'];
            isOneToOne: false;
            referencedRelation: 'salon_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ticket_events_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'public_salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ticket_events_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ticket_events_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: false;
            referencedRelation: 'tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      tickets: {
        Row: {
          actual_duration_minutes: number | null;
          appointment_delay_warned_steps: number;
          appointment_source:
            Database['public']['Enums']['appointment_source'] | null;
          arrived_at: string | null;
          assigned_member_id: string | null;
          call_count: number;
          called_at: string | null;
          cancel_reason: Database['public']['Enums']['cancel_reason'] | null;
          cancelled_at: string | null;
          channel: Database['public']['Enums']['ticket_channel'];
          client_id: string | null;
          closing_decision:
            Database['public']['Enums']['closing_decision'] | null;
          completed_at: string | null;
          confirmation_reminder_sent_at: string | null;
          confirmed_at: string | null;
          confirmed_by_member_id: string | null;
          created_at: string;
          created_by_member_id: string | null;
          declared_arrival_at: string | null;
          declared_delay_minutes: number | null;
          display_name: string;
          end_of_day_choice:
            Database['public']['Enums']['end_of_day_choice'] | null;
          end_of_day_warned_at: string | null;
          estimate_version: number;
          estimated_member_id: string | null;
          estimated_start_at: string | null;
          eta_response: Database['public']['Enums']['eta_response'] | null;
          get_ready_sent_at: string | null;
          id: string;
          initial_estimated_start_at: string | null;
          is_test: boolean;
          kind: Database['public']['Enums']['ticket_kind'];
          last_notified_start_at: string | null;
          no_show_at: string | null;
          notifications_consent_at: string | null;
          planned_duration_minutes: number;
          postpone_count: number;
          priority_since: string | null;
          queue_rank: number;
          reassignment_member_id: string | null;
          reassignment_proposed_start_at: string | null;
          reassignment_requested_at: string | null;
          release_due_at: string | null;
          reminder_sent_at: string | null;
          removal_note: string | null;
          removal_reason: Database['public']['Enums']['removal_reason'] | null;
          requested_member_id: string | null;
          salon_id: string;
          scheduled_at: string | null;
          service_date: string;
          service_id: string | null;
          short_code: string;
          started_at: string | null;
          status: Database['public']['Enums']['ticket_status'];
          stylist_change_pending_since: string | null;
          t30_estimated_start_at: string | null;
          tracking_short_code: string;
          tracking_token: string;
          turn_approaching_sent_at: string | null;
          updated_at: string;
        };
        Insert: {
          actual_duration_minutes?: number | null;
          appointment_delay_warned_steps?: number;
          appointment_source?:
            Database['public']['Enums']['appointment_source'] | null;
          arrived_at?: string | null;
          assigned_member_id?: string | null;
          call_count?: number;
          called_at?: string | null;
          cancel_reason?: Database['public']['Enums']['cancel_reason'] | null;
          cancelled_at?: string | null;
          channel: Database['public']['Enums']['ticket_channel'];
          client_id?: string | null;
          closing_decision?:
            Database['public']['Enums']['closing_decision'] | null;
          completed_at?: string | null;
          confirmation_reminder_sent_at?: string | null;
          confirmed_at?: string | null;
          confirmed_by_member_id?: string | null;
          created_at?: string;
          created_by_member_id?: string | null;
          declared_arrival_at?: string | null;
          declared_delay_minutes?: number | null;
          display_name: string;
          end_of_day_choice?:
            Database['public']['Enums']['end_of_day_choice'] | null;
          end_of_day_warned_at?: string | null;
          estimate_version?: number;
          estimated_member_id?: string | null;
          estimated_start_at?: string | null;
          eta_response?: Database['public']['Enums']['eta_response'] | null;
          get_ready_sent_at?: string | null;
          id?: string;
          initial_estimated_start_at?: string | null;
          is_test?: boolean;
          kind?: Database['public']['Enums']['ticket_kind'];
          last_notified_start_at?: string | null;
          no_show_at?: string | null;
          notifications_consent_at?: string | null;
          planned_duration_minutes: number;
          postpone_count?: number;
          priority_since?: string | null;
          queue_rank: number;
          reassignment_member_id?: string | null;
          reassignment_proposed_start_at?: string | null;
          reassignment_requested_at?: string | null;
          release_due_at?: string | null;
          reminder_sent_at?: string | null;
          removal_note?: string | null;
          removal_reason?: Database['public']['Enums']['removal_reason'] | null;
          requested_member_id?: string | null;
          salon_id: string;
          scheduled_at?: string | null;
          service_date: string;
          service_id?: string | null;
          short_code: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['ticket_status'];
          stylist_change_pending_since?: string | null;
          t30_estimated_start_at?: string | null;
          tracking_short_code: string;
          tracking_token: string;
          turn_approaching_sent_at?: string | null;
          updated_at?: string;
        };
        Update: {
          actual_duration_minutes?: number | null;
          appointment_delay_warned_steps?: number;
          appointment_source?:
            Database['public']['Enums']['appointment_source'] | null;
          arrived_at?: string | null;
          assigned_member_id?: string | null;
          call_count?: number;
          called_at?: string | null;
          cancel_reason?: Database['public']['Enums']['cancel_reason'] | null;
          cancelled_at?: string | null;
          channel?: Database['public']['Enums']['ticket_channel'];
          client_id?: string | null;
          closing_decision?:
            Database['public']['Enums']['closing_decision'] | null;
          completed_at?: string | null;
          confirmation_reminder_sent_at?: string | null;
          confirmed_at?: string | null;
          confirmed_by_member_id?: string | null;
          created_at?: string;
          created_by_member_id?: string | null;
          declared_arrival_at?: string | null;
          declared_delay_minutes?: number | null;
          display_name?: string;
          end_of_day_choice?:
            Database['public']['Enums']['end_of_day_choice'] | null;
          end_of_day_warned_at?: string | null;
          estimate_version?: number;
          estimated_member_id?: string | null;
          estimated_start_at?: string | null;
          eta_response?: Database['public']['Enums']['eta_response'] | null;
          get_ready_sent_at?: string | null;
          id?: string;
          initial_estimated_start_at?: string | null;
          is_test?: boolean;
          kind?: Database['public']['Enums']['ticket_kind'];
          last_notified_start_at?: string | null;
          no_show_at?: string | null;
          notifications_consent_at?: string | null;
          planned_duration_minutes?: number;
          postpone_count?: number;
          priority_since?: string | null;
          queue_rank?: number;
          reassignment_member_id?: string | null;
          reassignment_proposed_start_at?: string | null;
          reassignment_requested_at?: string | null;
          release_due_at?: string | null;
          reminder_sent_at?: string | null;
          removal_note?: string | null;
          removal_reason?: Database['public']['Enums']['removal_reason'] | null;
          requested_member_id?: string | null;
          salon_id?: string;
          scheduled_at?: string | null;
          service_date?: string;
          service_id?: string | null;
          short_code?: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['ticket_status'];
          stylist_change_pending_since?: string | null;
          t30_estimated_start_at?: string | null;
          tracking_short_code?: string;
          tracking_token?: string;
          turn_approaching_sent_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tickets_assigned_member_id_fkey';
            columns: ['assigned_member_id'];
            isOneToOne: false;
            referencedRelation: 'public_stylists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_assigned_member_id_fkey';
            columns: ['assigned_member_id'];
            isOneToOne: false;
            referencedRelation: 'salon_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_confirmed_by_member_id_fkey';
            columns: ['confirmed_by_member_id'];
            isOneToOne: false;
            referencedRelation: 'public_stylists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_confirmed_by_member_id_fkey';
            columns: ['confirmed_by_member_id'];
            isOneToOne: false;
            referencedRelation: 'salon_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_created_by_member_id_fkey';
            columns: ['created_by_member_id'];
            isOneToOne: false;
            referencedRelation: 'public_stylists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_created_by_member_id_fkey';
            columns: ['created_by_member_id'];
            isOneToOne: false;
            referencedRelation: 'salon_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_estimated_member_id_fkey';
            columns: ['estimated_member_id'];
            isOneToOne: false;
            referencedRelation: 'public_stylists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_estimated_member_id_fkey';
            columns: ['estimated_member_id'];
            isOneToOne: false;
            referencedRelation: 'salon_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_reassignment_member_id_fkey';
            columns: ['reassignment_member_id'];
            isOneToOne: false;
            referencedRelation: 'public_stylists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_reassignment_member_id_fkey';
            columns: ['reassignment_member_id'];
            isOneToOne: false;
            referencedRelation: 'salon_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_requested_member_id_fkey';
            columns: ['requested_member_id'];
            isOneToOne: false;
            referencedRelation: 'public_stylists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_requested_member_id_fkey';
            columns: ['requested_member_id'];
            isOneToOne: false;
            referencedRelation: 'salon_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'public_salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      public_salons: {
        Row: {
          address_line: string | null;
          city: string | null;
          city_code: string | null;
          current_wait_minutes: number | null;
          estimate_updated_at: string | null;
          id: string | null;
          is_full: boolean | null;
          location: unknown;
          name: string | null;
          next_free_slots: Json | null;
          phone: string | null;
          photo_paths: string[] | null;
          postal_code: string | null;
          queue_status: Database['public']['Enums']['queue_status'] | null;
          slug: string | null;
          waiting_count: number | null;
          welcome_message: string | null;
        };
        Insert: {
          address_line?: string | null;
          city?: string | null;
          city_code?: string | null;
          current_wait_minutes?: number | null;
          estimate_updated_at?: string | null;
          id?: string | null;
          is_full?: boolean | null;
          location?: unknown;
          name?: string | null;
          next_free_slots?: Json | null;
          phone?: string | null;
          photo_paths?: string[] | null;
          postal_code?: string | null;
          queue_status?: Database['public']['Enums']['queue_status'] | null;
          slug?: string | null;
          waiting_count?: number | null;
          welcome_message?: string | null;
        };
        Update: {
          address_line?: string | null;
          city?: string | null;
          city_code?: string | null;
          current_wait_minutes?: number | null;
          estimate_updated_at?: string | null;
          id?: string | null;
          is_full?: boolean | null;
          location?: unknown;
          name?: string | null;
          next_free_slots?: Json | null;
          phone?: string | null;
          photo_paths?: string[] | null;
          postal_code?: string | null;
          queue_status?: Database['public']['Enums']['queue_status'] | null;
          slug?: string | null;
          waiting_count?: number | null;
          welcome_message?: string | null;
        };
        Relationships: [];
      };
      public_stylists: {
        Row: {
          first_name: string | null;
          id: string | null;
          photo_path: string | null;
          presence: string | null;
          salon_id: string | null;
          specialties: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'salon_members_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'public_salons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'salon_members_salon_id_fkey';
            columns: ['salon_id'];
            isOneToOne: false;
            referencedRelation: 'salons';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      admin_access: {
        Args: never;
        Returns: string;
      };
      consume_rate_limit: {
        Args: {
          p_bucket: string;
          p_key: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      ensure_profile: {
        Args: { p_first_name: string };
        Returns: Database['public']['Tables']['profiles']['Row'];
      };
      get_audit_log: {
        Args: {
          cursor?: Json;
          from?: string;
          member_id?: string;
          salon_id?: string;
          to?: string;
          type?: string;
        };
        Returns: Json;
      };
      get_day_summary: {
        Args: { member_id?: string; salon_id: string; service_date: string };
        Returns: Json;
      };
      get_salon_board: { Args: { salon_id: string }; Returns: Json };
      get_salon_public: { Args: { slug: string }; Returns: Json };
      get_stylist_queue: { Args: never; Returns: Json };
      my_active_ticket: { Args: never; Returns: Json };
      resolve_qr_token: { Args: { qr_token: string }; Returns: string };
      is_rate_limited: {
        Args: {
          p_bucket: string;
          p_key: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      search_salons: {
        Args: { lat: number; lng: number; query?: string; radius_m?: number };
        Returns: {
          address_line: string;
          city: string;
          current_wait_minutes: number;
          distance_m: number;
          estimate_updated_at: string;
          id: string;
          is_full: boolean;
          name: string;
          next_free_slots: Json;
          photo_paths: string[];
          postal_code: string;
          queue_status: Database['public']['Enums']['queue_status'];
          slug: string;
          waiting_count: number;
        }[];
      };
    };
    Enums: {
      actor_type: 'client' | 'stylist' | 'manager' | 'system' | 'admin';
      appointment_source: 'salon_entry' | 'client_check_in';
      break_type: 'meal' | 'short' | 'unexpected';
      cancel_reason:
        | 'client_cancelled'
        | 'removed_by_salon'
        | 'stylist_unavailable'
        | 'end_of_day'
        | 'appointment_rejected'
        | 'merged';
      closing_decision: 'serve' | 'cancel';
      end_of_day_choice: 'stay' | 'cancel';
      estimate_change_reason:
        | 'service_longer'
        | 'service_shorter'
        | 'client_ahead_left'
        | 'client_ahead_late'
        | 'client_postponed'
        | 'client_late'
        | 'stylist_break'
        | 'stylist_break_ended'
        | 'stylist_late'
        | 'stylist_unavailable'
        | 'stylist_available'
        | 'hairdressing_toggled'
        | 'reassigned'
        | 'stylist_choice'
        | 'appointment_ahead'
        | 'appointment_changed'
        | 'your_appointment_changed';
      eta_response: 'on_time' | 'late';
      member_role: 'manager' | 'stylist';
      member_status: 'invited' | 'active' | 'deactivated';
      notification_channel: 'push' | 'sms' | 'email';
      notification_status: 'pending' | 'sent' | 'failed' | 'skipped';
      notification_template:
        | 'ticket_created'
        | 'turn_approaching'
        | 'get_ready'
        | 'your_turn'
        | 'arrival_reminder'
        | 'released_no_show'
        | 'estimate_changed'
        | 'postponed'
        | 'stylist_change_required'
        | 'end_of_day_risk'
        | 'cancelled_by_salon'
        | 'appointment_confirmed'
        | 'appointment_rejected'
        | 'appointment_delay'
        | 'reassignment_request'
        | 'no_show_warning'
        | 'appointment_checked_in'
        | 'member_invitation'
        | 'salon_decision'
        | 'daily_summary';
      presence_status:
        | 'offline'
        | 'available'
        | 'in_service'
        | 'on_break'
        | 'late'
        | 'absent'
        | 'off_duty';
      queue_status: 'closed' | 'open' | 'paused';
      reassignment_choice: 'accepted' | 'refused' | 'expired';
      removal_reason:
        | 'emergency'
        | 'client_request'
        | 'duplicate'
        | 'inappropriate_behaviour'
        | 'other';
      salon_event_type:
        | 'submitted'
        | 'approved'
        | 'rejected'
        | 'published'
        | 'suspended'
        | 'queue_opened'
        | 'queue_paused'
        | 'queue_closed'
        | 'closing_resolved'
        | 'presence_changed'
        | 'hairdressing_toggled'
        | 'member_invited'
        | 'member_activated'
        | 'member_deactivated'
        | 'member_sessions_revoked'
        | 'qr_regenerated'
        | 'settings_updated'
        | 'admin_viewed_client_data';
      salon_status:
        | 'draft'
        | 'pending_review'
        | 'approved'
        | 'published'
        | 'rejected'
        | 'suspended';
      siret_check_result:
        'valid' | 'naf_mismatch' | 'inactive' | 'not_found' | 'error';
      ticket_channel: 'app' | 'qr' | 'front_desk';
      ticket_event_type:
        | 'created'
        | 'assigned'
        | 'reassigned'
        | 'estimate_changed'
        | 'eta_responded'
        | 'postponed'
        | 'stylist_change_requested'
        | 'stylist_change_resolved'
        | 'arrival_confirmed'
        | 'called'
        | 'service_started'
        | 'duration_adjusted'
        | 'completed'
        | 'cancelled'
        | 'no_show'
        | 'end_of_day_warned'
        | 'end_of_day_responded'
        | 'appointment_checked_in'
        | 'appointment_confirmed'
        | 'appointment_rejected'
        | 'appointment_merged'
        | 'appointment_updated'
        | 'appointment_delay_warned'
        | 'reassignment_requested'
        | 'reassignment_resolved';
      ticket_kind: 'queue' | 'appointment';
      ticket_status:
        | 'pending_confirmation'
        | 'waiting'
        | 'called'
        | 'in_service'
        | 'completed'
        | 'cancelled'
        | 'no_show';
      verification_decision: 'pending' | 'approved' | 'rejected';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      actor_type: ['client', 'stylist', 'manager', 'system', 'admin'],
      appointment_source: ['salon_entry', 'client_check_in'],
      break_type: ['meal', 'short', 'unexpected'],
      cancel_reason: [
        'client_cancelled',
        'removed_by_salon',
        'stylist_unavailable',
        'end_of_day',
        'appointment_rejected',
        'merged',
      ],
      closing_decision: ['serve', 'cancel'],
      end_of_day_choice: ['stay', 'cancel'],
      estimate_change_reason: [
        'service_longer',
        'service_shorter',
        'client_ahead_left',
        'client_ahead_late',
        'client_postponed',
        'client_late',
        'stylist_break',
        'stylist_break_ended',
        'stylist_late',
        'stylist_unavailable',
        'stylist_available',
        'hairdressing_toggled',
        'reassigned',
        'stylist_choice',
        'appointment_ahead',
        'appointment_changed',
        'your_appointment_changed',
      ],
      eta_response: ['on_time', 'late'],
      member_role: ['manager', 'stylist'],
      member_status: ['invited', 'active', 'deactivated'],
      notification_channel: ['push', 'sms', 'email'],
      notification_status: ['pending', 'sent', 'failed', 'skipped'],
      notification_template: [
        'ticket_created',
        'turn_approaching',
        'get_ready',
        'your_turn',
        'arrival_reminder',
        'released_no_show',
        'estimate_changed',
        'postponed',
        'stylist_change_required',
        'end_of_day_risk',
        'cancelled_by_salon',
        'appointment_confirmed',
        'appointment_rejected',
        'appointment_delay',
        'reassignment_request',
        'no_show_warning',
        'appointment_checked_in',
        'member_invitation',
        'salon_decision',
        'daily_summary',
      ],
      presence_status: [
        'offline',
        'available',
        'in_service',
        'on_break',
        'late',
        'absent',
        'off_duty',
      ],
      queue_status: ['closed', 'open', 'paused'],
      reassignment_choice: ['accepted', 'refused', 'expired'],
      removal_reason: [
        'emergency',
        'client_request',
        'duplicate',
        'inappropriate_behaviour',
        'other',
      ],
      salon_event_type: [
        'submitted',
        'approved',
        'rejected',
        'published',
        'suspended',
        'queue_opened',
        'queue_paused',
        'queue_closed',
        'closing_resolved',
        'presence_changed',
        'hairdressing_toggled',
        'member_invited',
        'member_activated',
        'member_deactivated',
        'member_sessions_revoked',
        'qr_regenerated',
        'settings_updated',
        'admin_viewed_client_data',
      ],
      salon_status: [
        'draft',
        'pending_review',
        'approved',
        'published',
        'rejected',
        'suspended',
      ],
      siret_check_result: [
        'valid',
        'naf_mismatch',
        'inactive',
        'not_found',
        'error',
      ],
      ticket_channel: ['app', 'qr', 'front_desk'],
      ticket_event_type: [
        'created',
        'assigned',
        'reassigned',
        'estimate_changed',
        'eta_responded',
        'postponed',
        'stylist_change_requested',
        'stylist_change_resolved',
        'arrival_confirmed',
        'called',
        'service_started',
        'duration_adjusted',
        'completed',
        'cancelled',
        'no_show',
        'end_of_day_warned',
        'end_of_day_responded',
        'appointment_checked_in',
        'appointment_confirmed',
        'appointment_rejected',
        'appointment_merged',
        'appointment_updated',
        'appointment_delay_warned',
        'reassignment_requested',
        'reassignment_resolved',
      ],
      ticket_kind: ['queue', 'appointment'],
      ticket_status: [
        'pending_confirmation',
        'waiting',
        'called',
        'in_service',
        'completed',
        'cancelled',
        'no_show',
      ],
      verification_decision: ['pending', 'approved', 'rejected'],
    },
  },
} as const;
