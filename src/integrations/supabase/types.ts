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
      balance_movements: {
        Row: {
          actor_id: string | null
          amount: number
          created_at: string
          id: string
          player_id: string
          reason: string
          ticket_id: string | null
        }
        Insert: {
          actor_id?: string | null
          amount: number
          created_at?: string
          id?: string
          player_id: string
          reason: string
          ticket_id?: string | null
        }
        Update: {
          actor_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          player_id?: string
          reason?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balance_movements_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_movements_archive: {
        Row: {
          archivado_at: string | null
          carrera_id: string | null
          created_at: string | null
          descripcion: string | null
          id_original: string | null
          monto: number | null
          tipo: string | null
          user_id: string | null
        }
        Insert: {
          archivado_at?: string | null
          carrera_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          id_original?: string | null
          monto?: number | null
          tipo?: string | null
          user_id?: string | null
        }
        Update: {
          archivado_at?: string | null
          carrera_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          id_original?: string | null
          monto?: number | null
          tipo?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      depositos: {
        Row: {
          amount: number
          banco_destino: string
          banco_origen: string
          banquero_id: string
          cedula_destino: string
          comentario_banquero: string | null
          created_at: string
          id: string
          player_id: string
          referencia: string
          status: string | null
          telefono_destino: string
          telefono_origen: string
        }
        Insert: {
          amount: number
          banco_destino: string
          banco_origen: string
          banquero_id: string
          cedula_destino: string
          comentario_banquero?: string | null
          created_at?: string
          id?: string
          player_id: string
          referencia: string
          status?: string | null
          telefono_destino: string
          telefono_origen: string
        }
        Update: {
          amount?: number
          banco_destino?: string
          banco_origen?: string
          banquero_id?: string
          cedula_destino?: string
          comentario_banquero?: string | null
          created_at?: string
          id?: string
          player_id?: string
          referencia?: string
          status?: string | null
          telefono_destino?: string
          telefono_origen?: string
        }
        Relationships: []
      }
      detprog: {
        Row: {
          bloquea_ok: boolean | null
          carrera: number | null
          created_at: string
          divgan: number | null
          divgand: number | null
          divplace: number | null
          divplaced: number | null
          divshow: number | null
          fecha: string | null
          id: number
          idhip: string | null
          idprog: number | null
          nombreeje: string | null
          nro_valida: number | null
          nroejem: string | null
          puntos_especiales: number | null
          ret_ok: boolean | null
          updated_at: string
          valida_nro: number | null
          valida_polla: boolean | null
        }
        Insert: {
          bloquea_ok?: boolean | null
          carrera?: number | null
          created_at?: string
          divgan?: number | null
          divgand?: number | null
          divplace?: number | null
          divplaced?: number | null
          divshow?: number | null
          fecha?: string | null
          id?: number
          idhip?: string | null
          idprog?: number | null
          nombreeje?: string | null
          nro_valida?: number | null
          nroejem?: string | null
          puntos_especiales?: number | null
          ret_ok?: boolean | null
          updated_at?: string
          valida_nro?: number | null
          valida_polla?: boolean | null
        }
        Update: {
          bloquea_ok?: boolean | null
          carrera?: number | null
          created_at?: string
          divgan?: number | null
          divgand?: number | null
          divplace?: number | null
          divplaced?: number | null
          divshow?: number | null
          fecha?: string | null
          id?: number
          idhip?: string | null
          idprog?: number | null
          nombreeje?: string | null
          nro_valida?: number | null
          nroejem?: string | null
          puntos_especiales?: number | null
          ret_ok?: boolean | null
          updated_at?: string
          valida_nro?: number | null
          valida_polla?: boolean | null
        }
        Relationships: []
      }
      hipodromos: {
        Row: {
          activo: boolean | null
          activo_ok: boolean | null
          acumulado: number | null
          cos_bol: number | null
          created_at: string
          divmax: number | null
          empate: number | null
          idhip: string
          nomhip: string
          nrocaballos: number | null
          nrocarreras: number | null
          porc_acumulado: number | null
          porc_primer_lugar: number | null
          porc_retener: number | null
          porc_segundo_lugar: number | null
          porc_tercer_lugar: number | null
          tipo: number | null
          updated_at: string
          venxcar: number | null
        }
        Insert: {
          activo?: boolean | null
          activo_ok?: boolean | null
          acumulado?: number | null
          cos_bol?: number | null
          created_at?: string
          divmax?: number | null
          empate?: number | null
          idhip: string
          nomhip: string
          nrocaballos?: number | null
          nrocarreras?: number | null
          porc_acumulado?: number | null
          porc_primer_lugar?: number | null
          porc_retener?: number | null
          porc_segundo_lugar?: number | null
          porc_tercer_lugar?: number | null
          tipo?: number | null
          updated_at?: string
          venxcar?: number | null
        }
        Update: {
          activo?: boolean | null
          activo_ok?: boolean | null
          acumulado?: number | null
          cos_bol?: number | null
          created_at?: string
          divmax?: number | null
          empate?: number | null
          idhip?: string
          nomhip?: string
          nrocaballos?: number | null
          nrocarreras?: number | null
          porc_acumulado?: number | null
          porc_primer_lugar?: number | null
          porc_retener?: number | null
          porc_segundo_lugar?: number | null
          porc_tercer_lugar?: number | null
          tipo?: number | null
          updated_at?: string
          venxcar?: number | null
        }
        Relationships: []
      }
      horses: {
        Row: {
          blocked: boolean
          created_at: string
          id: string
          multiplier: number
          name: string
          number: number
          race_id: string
          retired: boolean
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          id?: string
          multiplier?: number
          name: string
          number: number
          race_id: string
          retired?: boolean
        }
        Update: {
          blocked?: boolean
          created_at?: string
          id?: string
          multiplier?: number
          name?: string
          number?: number
          race_id?: string
          retired?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "horses_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos: {
        Row: {
          banquero_id: string | null
          created_at: string
          descripcion: string
          estado: Database["public"]["Enums"]["estado_movimiento"]
          id: string
          monto: number
          player_id: string
          referencia_id: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Insert: {
          banquero_id?: string | null
          created_at?: string
          descripcion: string
          estado?: Database["public"]["Enums"]["estado_movimiento"]
          id?: string
          monto: number
          player_id: string
          referencia_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Update: {
          banquero_id?: string | null
          created_at?: string
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_movimiento"]
          id?: string
          monto?: number
          player_id?: string
          referencia_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_id: string | null
          balance: number
          banquero_id: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          invite_code: string | null
          max_tablas: number | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          balance?: number
          banquero_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          invite_code?: string | null
          max_tablas?: number | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          balance?: number
          banquero_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          invite_code?: string | null
          max_tablas?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      programa: {
        Row: {
          bloquea_ok: boolean | null
          cabgan: string | null
          cabpla: number | null
          cabpla2: number | null
          cabshow3: number | null
          carrera: number
          conf_ok: boolean | null
          created_at: string
          divgan: number | null
          divgand: number | null
          divpla: number | null
          divpla2: number | null
          divplad: number | null
          divplad2: number | null
          divshow: number | null
          divshow2: number | null
          divshow3: number | null
          divshowd: number | null
          divshowd2: number | null
          divshowd3: number | null
          empate: boolean | null
          fecha: string
          hora: string | null
          idhip: string
          idprog: number
          nro_valida: number | null
          nrocab: number | null
          updated_at: string
          valida_nro: number | null
          valida_polla: boolean | null
        }
        Insert: {
          bloquea_ok?: boolean | null
          cabgan?: string | null
          cabpla?: number | null
          cabpla2?: number | null
          cabshow3?: number | null
          carrera: number
          conf_ok?: boolean | null
          created_at?: string
          divgan?: number | null
          divgand?: number | null
          divpla?: number | null
          divpla2?: number | null
          divplad?: number | null
          divplad2?: number | null
          divshow?: number | null
          divshow2?: number | null
          divshow3?: number | null
          divshowd?: number | null
          divshowd2?: number | null
          divshowd3?: number | null
          empate?: boolean | null
          fecha: string
          hora?: string | null
          idhip: string
          idprog?: number
          nro_valida?: number | null
          nrocab?: number | null
          updated_at?: string
          valida_nro?: number | null
          valida_polla?: boolean | null
        }
        Update: {
          bloquea_ok?: boolean | null
          cabgan?: string | null
          cabpla?: number | null
          cabpla2?: number | null
          cabshow3?: number | null
          carrera?: number
          conf_ok?: boolean | null
          created_at?: string
          divgan?: number | null
          divgand?: number | null
          divpla?: number | null
          divpla2?: number | null
          divplad?: number | null
          divplad2?: number | null
          divshow?: number | null
          divshow2?: number | null
          divshow3?: number | null
          divshowd?: number | null
          divshowd2?: number | null
          divshowd3?: number | null
          empate?: boolean | null
          fecha?: string
          hora?: string | null
          idhip?: string
          idprog?: number
          nro_valida?: number | null
          nrocab?: number | null
          updated_at?: string
          valida_nro?: number | null
          valida_polla?: boolean | null
        }
        Relationships: []
      }
      races: {
        Row: {
          close_at: string | null
          created_at: string
          id: string
          lock_time: string | null
          owner_id: string
          premio_tabla: number | null
          race_date: string
          race_number: number
          status: string
          track: string
          winner_horse_id: string | null
        }
        Insert: {
          close_at?: string | null
          created_at?: string
          id?: string
          lock_time?: string | null
          owner_id: string
          premio_tabla?: number | null
          race_date?: string
          race_number: number
          status?: string
          track: string
          winner_horse_id?: string | null
        }
        Update: {
          close_at?: string | null
          created_at?: string
          id?: string
          lock_time?: string | null
          owner_id?: string
          premio_tabla?: number | null
          race_date?: string
          race_number?: number
          status?: string
          track?: string
          winner_horse_id?: string | null
        }
        Relationships: []
      }
      retiros: {
        Row: {
          amount: number
          banco: string
          banquero_id: string
          cedula: string
          comentario_banquero: string | null
          created_at: string
          id: string
          player_id: string
          status: string | null
          telefono: string
        }
        Insert: {
          amount: number
          banco: string
          banquero_id: string
          cedula: string
          comentario_banquero?: string | null
          created_at?: string
          id?: string
          player_id: string
          status?: string | null
          telefono: string
        }
        Update: {
          amount?: number
          banco?: string
          banquero_id?: string
          cedula?: string
          comentario_banquero?: string | null
          created_at?: string
          id?: string
          player_id?: string
          status?: string | null
          telefono?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          amount: number
          banquero_id: string | null
          code: string
          created_at: string
          horse_id: string
          id: string
          multiplier: number
          payout: number
          player_id: string | null
          player_name: string
          race_id: string
          status: string
        }
        Insert: {
          amount: number
          banquero_id?: string | null
          code: string
          created_at?: string
          horse_id: string
          id?: string
          multiplier: number
          payout?: number
          player_id?: string | null
          player_name: string
          race_id: string
          status?: string
        }
        Update: {
          amount?: number
          banquero_id?: string | null
          code?: string
          created_at?: string
          horse_id?: string
          id?: string
          multiplier?: number
          payout?: number
          player_id?: string | null
          player_name?: string
          race_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
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
      admin_delete_race: { Args: { _race_id: string }; Returns: undefined }
      admin_set_banquero: {
        Args: { _enable: boolean; _user_id: string }
        Returns: undefined
      }
      admin_set_banquero_con_limite: {
        Args: { _enable: boolean; _max_tablas: number; _user_id: string }
        Returns: undefined
      }
      admin_set_max_tablas: {
        Args: { _max_tablas: number; _user_id: string }
        Returns: undefined
      }
      auto_close_races: { Args: never; Returns: undefined }
      can_view_race: { Args: { _race_id: string }; Returns: boolean }
      cerrar_carreras_automatico: { Args: never; Returns: undefined }
      cerrar_carrerast_vencidas: { Args: never; Returns: undefined }
      declarar_ganador_carrera: {
        Args: { _race_id: string; _winner_horse_id: string }
        Returns: undefined
      }
      eliminar_carrera_con_respaldo: {
        Args: { _carrera_id: string }
        Returns: undefined
      }
      gen_invite_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_my_banquero: { Args: { _banquero: string }; Returns: boolean }
      is_my_player: { Args: { _player: string }; Returns: boolean }
      link_to_banquero: { Args: { _code: string }; Returns: string }
      my_admin_id: { Args: never; Returns: string }
      owns_race: { Args: { _race_id: string }; Returns: boolean }
      retirar_caballo_y_abonar: {
        Args: { p_horse_id: string }
        Returns: undefined
      }
      set_player_balance: {
        Args: { _delta: number; _player: string; _reason?: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "banquero" | "jugador" | "superadmin"
      estado_movimiento:
        | "pending"
        | "approved"
        | "rejected"
        | "won"
        | "lost"
        | "cancelled"
      tipo_movimiento: "deposito" | "retiro" | "jugada"
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
      app_role: ["admin", "banquero", "jugador", "superadmin"],
      estado_movimiento: [
        "pending",
        "approved",
        "rejected",
        "won",
        "lost",
        "cancelled",
      ],
      tipo_movimiento: ["deposito", "retiro", "jugada"],
    },
  },
} as const
