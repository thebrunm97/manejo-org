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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analises_solo: {
        Row: {
          areia: number | null
          argila: number | null
          calcio: number | null
          classificacao_textural: string | null
          created_at: string | null
          data_analise: string | null
          fosforo: number | null
          id: string
          iqs: number | null
          laboratorio: string | null
          magnesio: number | null
          materia_organica: number | null
          ph_agua: number | null
          potassio: number | null
          saturacao_bases: number | null
          silte: number | null
          talhao_id: number | null
        }
        Insert: {
          areia?: number | null
          argila?: number | null
          calcio?: number | null
          classificacao_textural?: string | null
          created_at?: string | null
          data_analise?: string | null
          fosforo?: number | null
          id?: string
          iqs?: number | null
          laboratorio?: string | null
          magnesio?: number | null
          materia_organica?: number | null
          ph_agua?: number | null
          potassio?: number | null
          saturacao_bases?: number | null
          silte?: number | null
          talhao_id?: number | null
        }
        Update: {
          areia?: number | null
          argila?: number | null
          calcio?: number | null
          classificacao_textural?: string | null
          created_at?: string | null
          data_analise?: string | null
          fosforo?: number | null
          id?: string
          iqs?: number | null
          laboratorio?: string | null
          magnesio?: number | null
          materia_organica?: number | null
          ph_agua?: number | null
          potassio?: number | null
          saturacao_bases?: number | null
          silte?: number | null
          talhao_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analises_solo_talhao_id_fkey"
            columns: ["talhao_id"]
            isOneToOne: false
            referencedRelation: "talhoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_status: {
        Row: {
          details: Json | null
          id: string
          last_heartbeat: string | null
          phone_connected: string | null
          session_name: string
          status: string
        }
        Insert: {
          details?: Json | null
          id?: string
          last_heartbeat?: string | null
          phone_connected?: string | null
          session_name?: string
          status?: string
        }
        Update: {
          details?: Json | null
          id?: string
          last_heartbeat?: string | null
          phone_connected?: string | null
          session_name?: string
          status?: string
        }
        Relationships: []
      }
      caderno_campo: {
        Row: {
          atividades: Json | null
          audio_url: string | null
          canteiro_ids: string[] | null
          classificacao: string | null
          criado_em: string | null
          data: string | null
          data_registro: string | null
          destino: string | null
          detalhes_tecnicos: Json | null
          equipamentos: string[] | null
          fornecedor: string | null
          houve_descartes: boolean | null
          id: string
          lote: string | null
          modalidade_aplicada:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          nota_fiscal: string | null
          observacao_original: string | null
          origem: string | null
          pmo_id: number | null
          produto: string | null
          propriedade_id: number | null
          qtd_descartes: number | null
          quantidade_unidade: string | null
          quantidade_valor: number | null
          raw_payload_id: string | null
          responsavel: string | null
          secao_origem: string | null
          sistema: string | null
          status: string | null
          talhao_canteiro: string | null
          talhao_id: number | null
          tipo_atividade: string
          tipo_operacao: string | null
          unidade_descartes: string | null
          user_id: string | null
          valor_total: number | null
        }
        Insert: {
          atividades?: Json | null
          audio_url?: string | null
          canteiro_ids?: string[] | null
          classificacao?: string | null
          criado_em?: string | null
          data?: string | null
          data_registro?: string | null
          destino?: string | null
          detalhes_tecnicos?: Json | null
          equipamentos?: string[] | null
          fornecedor?: string | null
          houve_descartes?: boolean | null
          id?: string
          lote?: string | null
          modalidade_aplicada?:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          nota_fiscal?: string | null
          observacao_original?: string | null
          origem?: string | null
          pmo_id?: number | null
          produto?: string | null
          propriedade_id?: number | null
          qtd_descartes?: number | null
          quantidade_unidade?: string | null
          quantidade_valor?: number | null
          raw_payload_id?: string | null
          responsavel?: string | null
          secao_origem?: string | null
          sistema?: string | null
          status?: string | null
          talhao_canteiro?: string | null
          talhao_id?: number | null
          tipo_atividade: string
          tipo_operacao?: string | null
          unidade_descartes?: string | null
          user_id?: string | null
          valor_total?: number | null
        }
        Update: {
          atividades?: Json | null
          audio_url?: string | null
          canteiro_ids?: string[] | null
          classificacao?: string | null
          criado_em?: string | null
          data?: string | null
          data_registro?: string | null
          destino?: string | null
          detalhes_tecnicos?: Json | null
          equipamentos?: string[] | null
          fornecedor?: string | null
          houve_descartes?: boolean | null
          id?: string
          lote?: string | null
          modalidade_aplicada?:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          nota_fiscal?: string | null
          observacao_original?: string | null
          origem?: string | null
          pmo_id?: number | null
          produto?: string | null
          propriedade_id?: number | null
          qtd_descartes?: number | null
          quantidade_unidade?: string | null
          quantidade_valor?: number | null
          raw_payload_id?: string | null
          responsavel?: string | null
          secao_origem?: string | null
          sistema?: string | null
          status?: string | null
          talhao_canteiro?: string | null
          talhao_id?: number | null
          tipo_atividade?: string
          tipo_operacao?: string | null
          unidade_descartes?: string | null
          user_id?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "caderno_campo_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caderno_campo_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caderno_campo_raw_payload_id_fkey"
            columns: ["raw_payload_id"]
            isOneToOne: false
            referencedRelation: "raw_payloads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caderno_campo_talhao_id_fkey"
            columns: ["talhao_id"]
            isOneToOne: false
            referencedRelation: "talhoes"
            referencedColumns: ["id"]
          },
        ]
      }
      caderno_campo_canteiros: {
        Row: {
          caderno_campo_id: string
          canteiro_id: string
          created_at: string
          id: number
        }
        Insert: {
          caderno_campo_id: string
          canteiro_id: string
          created_at?: string
          id?: number
        }
        Update: {
          caderno_campo_id?: string
          canteiro_id?: string
          created_at?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_caderno"
            columns: ["caderno_campo_id"]
            isOneToOne: false
            referencedRelation: "caderno_campo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_canteiro"
            columns: ["canteiro_id"]
            isOneToOne: false
            referencedRelation: "canteiros"
            referencedColumns: ["id"]
          },
        ]
      }
      canteiros: {
        Row: {
          area_total_m2: number | null
          comprimento_metros: number | null
          created_at: string | null
          grid_x: number | null
          grid_y: number | null
          id: string
          largura_metros: number | null
          nome: string
          profundidade_metros: number | null
          quantidade: number | null
          status: string | null
          talhao_id: number | null
          tipo: string | null
          tipo_estrutura: string | null
          volume_m3: number | null
        }
        Insert: {
          area_total_m2?: number | null
          comprimento_metros?: number | null
          created_at?: string | null
          grid_x?: number | null
          grid_y?: number | null
          id?: string
          largura_metros?: number | null
          nome: string
          profundidade_metros?: number | null
          quantidade?: number | null
          status?: string | null
          talhao_id?: number | null
          tipo?: string | null
          tipo_estrutura?: string | null
          volume_m3?: number | null
        }
        Update: {
          area_total_m2?: number | null
          comprimento_metros?: number | null
          created_at?: string | null
          grid_x?: number | null
          grid_y?: number | null
          id?: string
          largura_metros?: number | null
          nome?: string
          profundidade_metros?: number | null
          quantidade?: number | null
          status?: string | null
          talhao_id?: number | null
          tipo?: string | null
          tipo_estrutura?: string | null
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "canteiros_talhao_id_fkey"
            columns: ["talhao_id"]
            isOneToOne: false
            referencedRelation: "talhoes"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          pmo_id: number | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          pmo_id?: number | null
          tipo: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          pmo_id?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
        ]
      }
      ciclos_cultivo: {
        Row: {
          ativo: boolean | null
          canteiro_id: string | null
          created_at: string | null
          data_colheita_prevista: string | null
          data_encerramento: string | null
          data_plantio: string | null
          id: string
          pmo_id: number | null
          produto: string
          variedade: string | null
        }
        Insert: {
          ativo?: boolean | null
          canteiro_id?: string | null
          created_at?: string | null
          data_colheita_prevista?: string | null
          data_encerramento?: string | null
          data_plantio?: string | null
          id?: string
          pmo_id?: number | null
          produto: string
          variedade?: string | null
        }
        Update: {
          ativo?: boolean | null
          canteiro_id?: string | null
          created_at?: string | null
          data_colheita_prevista?: string | null
          data_encerramento?: string | null
          data_plantio?: string | null
          id?: string
          pmo_id?: number | null
          produto?: string
          variedade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ciclos_cultivo_canteiro_id_fkey"
            columns: ["canteiro_id"]
            isOneToOne: false
            referencedRelation: "canteiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ciclos_cultivo_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
        ]
      }
      cotas_produtores: {
        Row: {
          created_at: string | null
          demanda_id: string
          id: string
          observacao: string | null
          propriedade_id: number
          quantidade_assumida: number
          quantidade_entregue: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          demanda_id: string
          id?: string
          observacao?: string | null
          propriedade_id: number
          quantidade_assumida: number
          quantidade_entregue?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          demanda_id?: string
          id?: string
          observacao?: string | null
          propriedade_id?: number
          quantidade_assumida?: number
          quantidade_entregue?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotas_produtores_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas_coletivas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotas_produtores_profiles_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotas_produtores_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_plantio: {
        Row: {
          alerta_enviado: boolean | null
          ciclo_dias_estimado: number | null
          cota_id: string
          created_at: string | null
          data_alerta_whatsapp: string | null
          data_plantio_recomendada: string | null
          id: string
          observacao_ia: string | null
        }
        Insert: {
          alerta_enviado?: boolean | null
          ciclo_dias_estimado?: number | null
          cota_id: string
          created_at?: string | null
          data_alerta_whatsapp?: string | null
          data_plantio_recomendada?: string | null
          id?: string
          observacao_ia?: string | null
        }
        Update: {
          alerta_enviado?: boolean | null
          ciclo_dias_estimado?: number | null
          cota_id?: string
          created_at?: string | null
          data_alerta_whatsapp?: string | null
          data_plantio_recomendada?: string | null
          id?: string
          observacao_ia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_plantio_cota_id_fkey"
            columns: ["cota_id"]
            isOneToOne: true
            referencedRelation: "cotas_produtores"
            referencedColumns: ["id"]
          },
        ]
      }
      culturas_anuais: {
        Row: {
          ano_safra: string | null
          area_ha: number | null
          created_at: string | null
          cultura: string | null
          id: number
          pmo_id: number
        }
        Insert: {
          ano_safra?: string | null
          area_ha?: number | null
          created_at?: string | null
          cultura?: string | null
          id?: number
          pmo_id: number
        }
        Update: {
          ano_safra?: string | null
          area_ha?: number | null
          created_at?: string | null
          cultura?: string | null
          id?: number
          pmo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "culturas_anuais_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas_coletivas: {
        Row: {
          cooperativa_id: number
          created_at: string | null
          criado_por: string | null
          cultura: string
          cultura_id: string | null
          data_entrega: string
          data_limite_entrega: string | null
          descricao: string | null
          id: string
          modalidade_exigida:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          organizacao_id: number | null
          preco_referencia: number | null
          quantidade_assumida: number | null
          quantidade_total: number
          status: string | null
          titulo: string
          unidade: string
          unidade_medida: string | null
          volume_necessario: number | null
        }
        Insert: {
          cooperativa_id: number
          created_at?: string | null
          criado_por?: string | null
          cultura: string
          cultura_id?: string | null
          data_entrega: string
          data_limite_entrega?: string | null
          descricao?: string | null
          id?: string
          modalidade_exigida?:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          organizacao_id?: number | null
          preco_referencia?: number | null
          quantidade_assumida?: number | null
          quantidade_total: number
          status?: string | null
          titulo: string
          unidade: string
          unidade_medida?: string | null
          volume_necessario?: number | null
        }
        Update: {
          cooperativa_id?: number
          created_at?: string | null
          criado_por?: string | null
          cultura?: string
          cultura_id?: string | null
          data_entrega?: string
          data_limite_entrega?: string | null
          descricao?: string | null
          id?: string
          modalidade_exigida?:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          organizacao_id?: number | null
          preco_referencia?: number | null
          quantidade_assumida?: number | null
          quantidade_total?: number
          status?: string | null
          titulo?: string
          unidade?: string
          unidade_medida?: string | null
          volume_necessario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "demandas_coletivas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_demandas_organizacao"
            columns: ["cooperativa_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas_intencoes: {
        Row: {
          created_at: string | null
          demanda_id: string
          id: string
          propriedade_id: number
          status_intencao: string | null
          user_id: string
          volume_ofertado: number
        }
        Insert: {
          created_at?: string | null
          demanda_id: string
          id?: string
          propriedade_id: number
          status_intencao?: string | null
          user_id: string
          volume_ofertado: number
        }
        Update: {
          created_at?: string | null
          demanda_id?: string
          id?: string
          propriedade_id?: number
          status_intencao?: string | null
          user_id?: string
          volume_ofertado?: number
        }
        Relationships: [
          {
            foreignKeyName: "demandas_intencoes_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas_coletivas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_intencoes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      event_destinations: {
        Row: {
          createdAt: string
          destination: Json
          id: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          destination: Json
          id: string
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          destination?: Json
          id?: string
          updatedAt?: string
        }
        Relationships: []
      }
      execution_annotation_tags: {
        Row: {
          annotationId: number
          tagId: string
        }
        Insert: {
          annotationId: number
          tagId: string
        }
        Update: {
          annotationId?: number
          tagId?: string
        }
        Relationships: [
          {
            foreignKeyName: "FK_c1519757391996eb06064f0e7c8"
            columns: ["annotationId"]
            isOneToOne: false
            referencedRelation: "execution_annotations"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_annotations: {
        Row: {
          createdAt: string
          executionId: number
          id: number
          note: string | null
          updatedAt: string
          vote: string | null
        }
        Insert: {
          createdAt?: string
          executionId: number
          id?: number
          note?: string | null
          updatedAt?: string
          vote?: string | null
        }
        Update: {
          createdAt?: string
          executionId?: number
          id?: number
          note?: string | null
          updatedAt?: string
          vote?: string | null
        }
        Relationships: []
      }
      execution_metadata: {
        Row: {
          executionId: number
          id: number
          key: string
          value: string
        }
        Insert: {
          executionId: number
          id?: number
          key: string
          value: string
        }
        Update: {
          executionId?: number
          id?: number
          key?: string
          value?: string
        }
        Relationships: []
      }
      farm_documents: {
        Row: {
          chunk_hash: string | null
          chunk_index: number | null
          content: string
          document_name: string
          embedding: string | null
          embedding_1024: string | null
          id: number
          pmo_id: number | null
          source_document_id: string | null
        }
        Insert: {
          chunk_hash?: string | null
          chunk_index?: number | null
          content: string
          document_name: string
          embedding?: string | null
          embedding_1024?: string | null
          id?: number
          pmo_id?: number | null
          source_document_id?: string | null
        }
        Update: {
          chunk_hash?: string | null
          chunk_index?: number | null
          content?: string
          document_name?: string
          embedding?: string | null
          embedding_1024?: string | null
          id?: number
          pmo_id?: number | null
          source_document_id?: string | null
        }
        Relationships: []
      }
      guardrail_events: {
        Row: {
          blocked: boolean
          created_at: string
          filter_name: string
          id: string
          job_id: string | null
          layer: string
          metadata: Json
          phone: string | null
          reason: string | null
          risk_score: number
          violations: Json
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          filter_name: string
          id?: string
          job_id?: string | null
          layer: string
          metadata?: Json
          phone?: string | null
          reason?: string | null
          risk_score?: number
          violations?: Json
        }
        Update: {
          blocked?: boolean
          created_at?: string
          filter_name?: string
          id?: string
          job_id?: string | null
          layer?: string
          metadata?: Json
          phone?: string | null
          reason?: string | null
          risk_score?: number
          violations?: Json
        }
        Relationships: [
          {
            foreignKeyName: "guardrail_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "message_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardrail_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "message_queue_dead_letter"
            referencedColumns: ["id"]
          },
        ]
      }
      hitl_pending: {
        Row: {
          action_label: string
          created_at: string
          expires_at: string
          from_phone: string
          id: string
          job_id: string | null
          pmo_id: number | null
          status: string
          tool_args: Json
          tool_name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action_label: string
          created_at?: string
          expires_at?: string
          from_phone: string
          id?: string
          job_id?: string | null
          pmo_id?: number | null
          status?: string
          tool_args: Json
          tool_name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action_label?: string
          created_at?: string
          expires_at?: string
          from_phone?: string
          id?: string
          job_id?: string | null
          pmo_id?: number | null
          status?: string
          tool_args?: Json
          tool_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hitl_pending_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "message_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hitl_pending_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "message_queue_dead_letter"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_jobs: {
        Row: {
          attempt_count: number
          created_at: string
          document_id: string
          error_log: string | null
          finished_at: string | null
          id: string
          progress_pct: number | null
          started_at: string | null
          status: string
          step: string | null
          version_id: string | null
          worker_id: string | null
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          document_id: string
          error_log?: string | null
          finished_at?: string | null
          id?: string
          progress_pct?: number | null
          started_at?: string | null
          status?: string
          step?: string | null
          version_id?: string | null
          worker_id?: string | null
        }
        Update: {
          attempt_count?: number
          created_at?: string
          document_id?: string
          error_log?: string | null
          finished_at?: string | null
          id?: string
          progress_pct?: number | null
          started_at?: string | null
          status?: string
          step?: string | null
          version_id?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_jobs_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "knowledge_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      installed_nodes: {
        Row: {
          latestVersion: number
          name: string
          package: string
          type: string
        }
        Insert: {
          latestVersion?: number
          name: string
          package: string
          type: string
        }
        Update: {
          latestVersion?: number
          name?: string
          package?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "FK_73f857fc5dce682cef8a99c11dbddbc969618951"
            columns: ["package"]
            isOneToOne: false
            referencedRelation: "installed_packages"
            referencedColumns: ["packageName"]
          },
        ]
      }
      installed_packages: {
        Row: {
          authorEmail: string | null
          authorName: string | null
          createdAt: string
          installedVersion: string
          packageName: string
          updatedAt: string
        }
        Insert: {
          authorEmail?: string | null
          authorName?: string | null
          createdAt?: string
          installedVersion: string
          packageName: string
          updatedAt?: string
        }
        Update: {
          authorEmail?: string | null
          authorName?: string | null
          createdAt?: string
          installedVersion?: string
          packageName?: string
          updatedAt?: string
        }
        Relationships: []
      }
      instances: {
        Row: {
          always_online: boolean | null
          client_name: string | null
          connected: boolean | null
          created_at: string | null
          disconnect_reason: string | null
          events: string | null
          expiration: number | null
          id: string
          ignore_groups: boolean | null
          ignore_status: boolean | null
          jid: string | null
          msg_reject_call: string | null
          name: string | null
          nats_enable: string | null
          os_name: string | null
          proxy: string | null
          qrcode: string | null
          rabbitmq_enable: string | null
          read_messages: boolean | null
          reject_call: boolean | null
          token: string | null
          web_socket_enable: string | null
          webhook: string | null
        }
        Insert: {
          always_online?: boolean | null
          client_name?: string | null
          connected?: boolean | null
          created_at?: string | null
          disconnect_reason?: string | null
          events?: string | null
          expiration?: number | null
          id: string
          ignore_groups?: boolean | null
          ignore_status?: boolean | null
          jid?: string | null
          msg_reject_call?: string | null
          name?: string | null
          nats_enable?: string | null
          os_name?: string | null
          proxy?: string | null
          qrcode?: string | null
          rabbitmq_enable?: string | null
          read_messages?: boolean | null
          reject_call?: boolean | null
          token?: string | null
          web_socket_enable?: string | null
          webhook?: string | null
        }
        Update: {
          always_online?: boolean | null
          client_name?: string | null
          connected?: boolean | null
          created_at?: string | null
          disconnect_reason?: string | null
          events?: string | null
          expiration?: number | null
          id?: string
          ignore_groups?: boolean | null
          ignore_status?: boolean | null
          jid?: string | null
          msg_reject_call?: string | null
          name?: string | null
          nats_enable?: string | null
          os_name?: string | null
          proxy?: string | null
          qrcode?: string | null
          rabbitmq_enable?: string | null
          read_messages?: boolean | null
          reject_call?: boolean | null
          token?: string | null
          web_socket_enable?: string | null
          webhook?: string | null
        }
        Relationships: []
      }
      insumos_proibidos: {
        Row: {
          created_at: string | null
          id: number
          nome: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          nome: string
        }
        Update: {
          created_at?: string | null
          id?: number
          nome?: string
        }
        Relationships: []
      }
      invalid_auth_token: {
        Row: {
          expiresAt: string
          token: string
        }
        Insert: {
          expiresAt: string
          token: string
        }
        Update: {
          expiresAt?: string
          token?: string
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          document_name: string
          embedding: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          chunk_index: number
          content: string
          document_name: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          chunk_index?: number
          content?: string
          document_name?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          created_at: string
          created_by: string | null
          current_live_version_id: string | null
          id: string
          metadata: Json | null
          mime_type: string | null
          source_type: string
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_live_version_id?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          source_type: string
          storage_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_live_version_id?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          source_type?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_current_live_version"
            columns: ["current_live_version_id"]
            isOneToOne: false
            referencedRelation: "knowledge_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content: string | null
          content_format: string
          created_at: string
          created_by: string | null
          document_id: string
          id: string
          published_at: string | null
          published_by: string | null
          status: string
          supersedes_version_id: string | null
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string | null
          content_format?: string
          created_at?: string
          created_by?: string | null
          document_id: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          supersedes_version_id?: string | null
          version_number?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string | null
          content_format?: string
          created_at?: string
          created_by?: string | null
          document_id?: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          supersedes_version_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_versions_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: false
            referencedRelation: "knowledge_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          id: string
          instance_id: string | null
          label_color: string | null
          label_id: string | null
          label_name: string | null
          predefined_id: string | null
        }
        Insert: {
          id: string
          instance_id?: string | null
          label_color?: string | null
          label_id?: string | null
          label_name?: string | null
          predefined_id?: string | null
        }
        Update: {
          id?: string
          instance_id?: string | null
          label_color?: string | null
          label_id?: string | null
          label_name?: string | null
          predefined_id?: string | null
        }
        Relationships: []
      }
      lid_mappings: {
        Row: {
          created_at: string | null
          id: string
          lid_id: string
          phone_number: string
          registered_by: string | null
          updated_at: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lid_id: string
          phone_number: string
          registered_by?: string | null
          updated_at?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lid_id?: string
          phone_number?: string
          registered_by?: string | null
          updated_at?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      limites_seguranca: {
        Row: {
          created_at: string
          limite_manejo: number
          limite_transacao: number
          pmo_id: number
          propriedade_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          limite_manejo?: number
          limite_transacao?: number
          pmo_id: number
          propriedade_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          limite_manejo?: number
          limite_transacao?: number
          pmo_id?: number
          propriedade_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "limites_seguranca_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "limites_seguranca_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_consumo: {
        Row: {
          acao: string | null
          created_at: string | null
          custo_estimado: number | null
          duracao_ms: number | null
          id: string
          meta: Json | null
          modelo_ia: string | null
          request_id: string | null
          status: string | null
          tokens_completion: number | null
          tokens_prompt: number | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          acao?: string | null
          created_at?: string | null
          custo_estimado?: number | null
          duracao_ms?: number | null
          id?: string
          meta?: Json | null
          modelo_ia?: string | null
          request_id?: string | null
          status?: string | null
          tokens_completion?: number | null
          tokens_prompt?: number | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          acao?: string | null
          created_at?: string | null
          custo_estimado?: number | null
          duracao_ms?: number | null
          id?: string
          meta?: Json | null
          modelo_ia?: string | null
          request_id?: string | null
          status?: string | null
          tokens_completion?: number | null
          tokens_prompt?: number | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      logs_processamento: {
        Row: {
          created_at: string | null
          id: string
          intencao: string | null
          mensagem_usuario: string | null
          modelo_ia: string | null
          pmo_id: number | null
          resposta_bot: string | null
          tokens_completion: number | null
          tokens_prompt: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          intencao?: string | null
          mensagem_usuario?: string | null
          modelo_ia?: string | null
          pmo_id?: number | null
          resposta_bot?: string | null
          tokens_completion?: number | null
          tokens_prompt?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          intencao?: string | null
          mensagem_usuario?: string | null
          modelo_ia?: string | null
          pmo_id?: number | null
          resposta_bot?: string | null
          tokens_completion?: number | null
          tokens_prompt?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_processamento_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_treinamento: {
        Row: {
          created_at: string
          criado_em: string | null
          foi_editado: boolean | null
          id: string
          json_corrigido: Json | null
          json_extraido: Json | null
          modelo_ia: string | null
          pmo_id: number | null
          processado: boolean | null
          status_validacao: string | null
          texto_usuario: string | null
          tipo_atividade: string | null
          user_id: string | null
          validado: boolean | null
        }
        Insert: {
          created_at?: string
          criado_em?: string | null
          foi_editado?: boolean | null
          id?: string
          json_corrigido?: Json | null
          json_extraido?: Json | null
          modelo_ia?: string | null
          pmo_id?: number | null
          processado?: boolean | null
          status_validacao?: string | null
          texto_usuario?: string | null
          tipo_atividade?: string | null
          user_id?: string | null
          validado?: boolean | null
        }
        Update: {
          created_at?: string
          criado_em?: string | null
          foi_editado?: boolean | null
          id?: string
          json_corrigido?: Json | null
          json_extraido?: Json | null
          modelo_ia?: string | null
          pmo_id?: number | null
          processado?: boolean | null
          status_validacao?: string | null
          texto_usuario?: string | null
          tipo_atividade?: string | null
          user_id?: string | null
          validado?: boolean | null
        }
        Relationships: []
      }
      lotes_rastreabilidade: {
        Row: {
          caderno_campo_id: string | null
          codigo_lote: string
          created_at: string | null
          cultura: string
          data_colheita: string
          id: string
          propriedade_id: number | null
          qr_code_url: string | null
          quantidade: number
          user_id: string | null
        }
        Insert: {
          caderno_campo_id?: string | null
          codigo_lote: string
          created_at?: string | null
          cultura: string
          data_colheita: string
          id?: string
          propriedade_id?: number | null
          qr_code_url?: string | null
          quantidade: number
          user_id?: string | null
        }
        Update: {
          caderno_campo_id?: string | null
          codigo_lote?: string
          created_at?: string | null
          cultura?: string
          data_colheita?: string
          id?: string
          propriedade_id?: number | null
          qr_code_url?: string | null
          quantidade?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_rastreabilidade_caderno_campo_id_fkey"
            columns: ["caderno_campo_id"]
            isOneToOne: false
            referencedRelation: "caderno_campo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_rastreabilidade_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      message_queue: {
        Row: {
          attempt_count: number
          body_text: string | null
          claimed_at: string | null
          created_at: string
          error_msg: string | null
          from_phone: string
          id: string
          max_attempts: number
          msg_id: string
          next_retry_at: string
          processed_at: string | null
          raw_payload: Json
          respond_audio: boolean
          status: string
        }
        Insert: {
          attempt_count?: number
          body_text?: string | null
          claimed_at?: string | null
          created_at?: string
          error_msg?: string | null
          from_phone: string
          id?: string
          max_attempts?: number
          msg_id: string
          next_retry_at?: string
          processed_at?: string | null
          raw_payload: Json
          respond_audio?: boolean
          status?: string
        }
        Update: {
          attempt_count?: number
          body_text?: string | null
          claimed_at?: string | null
          created_at?: string
          error_msg?: string | null
          from_phone?: string
          id?: string
          max_attempts?: number
          msg_id?: string
          next_retry_at?: string
          processed_at?: string | null
          raw_payload?: Json
          respond_audio?: boolean
          status?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          id: string
          message_id: string | null
          phone: string | null
          role: string | null
          source: string | null
          status: string | null
          timestamp: string | null
        }
        Insert: {
          content?: string | null
          id?: string
          message_id?: string | null
          phone?: string | null
          role?: string | null
          source?: string | null
          status?: string | null
          timestamp?: string | null
        }
        Update: {
          content?: string | null
          id?: string
          message_id?: string | null
          phone?: string | null
          role?: string | null
          source?: string | null
          status?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      migrations: {
        Row: {
          id: number
          name: string
          timestamp: number
        }
        Insert: {
          id?: number
          name: string
          timestamp: number
        }
        Update: {
          id?: number
          name?: string
          timestamp?: number
        }
        Relationships: []
      }
      organizacao_membros: {
        Row: {
          data_filiacao: string | null
          organizacao_id: number
          propriedade_id: number
          role: string | null
        }
        Insert: {
          data_filiacao?: string | null
          organizacao_id: number
          propriedade_id: number
          role?: string | null
        }
        Update: {
          data_filiacao?: string | null
          organizacao_id?: number
          propriedade_id?: number
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizacao_membros_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizacao_membros_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      organizacoes: {
        Row: {
          cnpj: string | null
          created_at: string | null
          id: number
          nome: string
          slug: string | null
          tipo: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          id?: number
          nome: string
          slug?: string | null
          tipo?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          id?: number
          nome?: string
          slug?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      pending_lids: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          lid_id: string
          sender_name: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          lid_id: string
          sender_name?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          lid_id?: string
          sender_name?: string | null
          status?: string | null
        }
        Relationships: []
      }
      pmo_clima: {
        Row: {
          condicao_icone: string | null
          condicao_texto: string | null
          created_at: string
          id: string
          pmo_id: number
          previsao_dias: Json | null
          propriedade_id: number | null
          temperatura_c: number | null
          umidade: number | null
          vento_kph: number | null
        }
        Insert: {
          condicao_icone?: string | null
          condicao_texto?: string | null
          created_at?: string
          id?: string
          pmo_id: number
          previsao_dias?: Json | null
          propriedade_id?: number | null
          temperatura_c?: number | null
          umidade?: number | null
          vento_kph?: number | null
        }
        Update: {
          condicao_icone?: string | null
          condicao_texto?: string | null
          created_at?: string
          id?: string
          pmo_id?: number
          previsao_dias?: Json | null
          propriedade_id?: number | null
          temperatura_c?: number | null
          umidade?: number | null
          vento_kph?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pmo_clima_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pmo_clima_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      pmo_culturas: {
        Row: {
          area_plantada: string | null
          ciclo: string | null
          created_at: string
          data_plantio: string | null
          estimativa_colheita: string | null
          id: string
          localizacao: Json | null
          pmo_id: number
          producao_unidade: string | null
          produto: string | null
          status: string | null
          variedade: string | null
        }
        Insert: {
          area_plantada?: string | null
          ciclo?: string | null
          created_at?: string
          data_plantio?: string | null
          estimativa_colheita?: string | null
          id?: string
          localizacao?: Json | null
          pmo_id: number
          producao_unidade?: string | null
          produto?: string | null
          status?: string | null
          variedade?: string | null
        }
        Update: {
          area_plantada?: string | null
          ciclo?: string | null
          created_at?: string
          data_plantio?: string | null
          estimativa_colheita?: string | null
          id?: string
          localizacao?: Json | null
          pmo_id?: number
          producao_unidade?: string | null
          produto?: string | null
          status?: string | null
          variedade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pmo_culturas_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
        ]
      }
      pmo_equipamentos: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          pmo_id: number | null
          status_limpeza: string | null
          tipo_uso: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          pmo_id?: number | null
          status_limpeza?: string | null
          tipo_uso?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          pmo_id?: number | null
          status_limpeza?: string | null
          tipo_uso?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pmo_equipamentos_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
        ]
      }
      pmo_insumos: {
        Row: {
          composicao: string | null
          created_at: string
          cultura_destino: string | null
          dosagem: string | null
          epoca_frequencia: string | null
          id: string
          marca: string | null
          pmo_id: number
          procedencia: string | null
          produto_manejo: string | null
          propriedade_id: number | null
        }
        Insert: {
          composicao?: string | null
          created_at?: string
          cultura_destino?: string | null
          dosagem?: string | null
          epoca_frequencia?: string | null
          id?: string
          marca?: string | null
          pmo_id: number
          procedencia?: string | null
          produto_manejo?: string | null
          propriedade_id?: number | null
        }
        Update: {
          composicao?: string | null
          created_at?: string
          cultura_destino?: string | null
          dosagem?: string | null
          epoca_frequencia?: string | null
          id?: string
          marca?: string | null
          pmo_id?: number
          procedencia?: string | null
          produto_manejo?: string | null
          propriedade_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pmo_insumos_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pmo_insumos_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      pmo_limpeza: {
        Row: {
          created_at: string | null
          data_limpeza: string
          dosagem: string | null
          id: string
          item_area: string
          observacao: string | null
          pmo_id: number
          produto_utilizado: string | null
          propriedade_id: number | null
          responsavel: string
          tipo_limpeza: string
        }
        Insert: {
          created_at?: string | null
          data_limpeza?: string
          dosagem?: string | null
          id?: string
          item_area: string
          observacao?: string | null
          pmo_id: number
          produto_utilizado?: string | null
          propriedade_id?: number | null
          responsavel: string
          tipo_limpeza: string
        }
        Update: {
          created_at?: string | null
          data_limpeza?: string
          dosagem?: string | null
          id?: string
          item_area?: string
          observacao?: string | null
          pmo_id?: number
          produto_utilizado?: string | null
          propriedade_id?: number | null
          responsavel?: string
          tipo_limpeza?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pmo_limpeza_pmo"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pmo_limpeza_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      pmo_manejo: {
        Row: {
          created_at: string
          data_aplicacao: string | null
          fonte: string | null
          id: string
          insumo: string | null
          metodo_aplicacao: string | null
          modalidade_aplicada:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          pmo_id: number
          quantidade: string | null
          talhoes_aplicados: Json | null
        }
        Insert: {
          created_at?: string
          data_aplicacao?: string | null
          fonte?: string | null
          id?: string
          insumo?: string | null
          metodo_aplicacao?: string | null
          modalidade_aplicada?:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          pmo_id: number
          quantidade?: string | null
          talhoes_aplicados?: Json | null
        }
        Update: {
          created_at?: string
          data_aplicacao?: string | null
          fonte?: string | null
          id?: string
          insumo?: string | null
          metodo_aplicacao?: string | null
          modalidade_aplicada?:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          pmo_id?: number
          quantidade?: string | null
          talhoes_aplicados?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pmo_manejo_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
        ]
      }
      pmo_pragas: {
        Row: {
          id: string
          ingrediente_ativo: string | null
          pmo_id: number
          praga_alvo: string | null
          produto_controle: string | null
        }
        Insert: {
          id?: string
          ingrediente_ativo?: string | null
          pmo_id: number
          praga_alvo?: string | null
          produto_controle?: string | null
        }
        Update: {
          id?: string
          ingrediente_ativo?: string | null
          pmo_id?: number
          praga_alvo?: string | null
          produto_controle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pmo_pragas_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
        ]
      }
      pmo_propagacao: {
        Row: {
          created_at: string
          data_compra: string | null
          especies: string | null
          id: string
          origem: string | null
          pmo_id: number
          propriedade_id: number | null
          quantidade: string | null
          sistema_organico: boolean | null
          tipo: string | null
        }
        Insert: {
          created_at?: string
          data_compra?: string | null
          especies?: string | null
          id?: string
          origem?: string | null
          pmo_id: number
          propriedade_id?: number | null
          quantidade?: string | null
          sistema_organico?: boolean | null
          tipo?: string | null
        }
        Update: {
          created_at?: string
          data_compra?: string | null
          especies?: string | null
          id?: string
          origem?: string | null
          pmo_id?: number
          propriedade_id?: number | null
          quantidade?: string | null
          sistema_organico?: boolean | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pmo_propagacao_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pmo_propagacao_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      pmos: {
        Row: {
          created_at: string
          form_data: Json | null
          id: number
          nome_identificador: string | null
          propriedade_id: number | null
          status: string | null
          user_id: string | null
          version: number | null
        }
        Insert: {
          created_at?: string
          form_data?: Json | null
          id?: number
          nome_identificador?: string | null
          propriedade_id?: number | null
          status?: string | null
          user_id?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string
          form_data?: Json | null
          id?: number
          nome_identificador?: string | null
          propriedade_id?: number | null
          status?: string | null
          user_id?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pmos_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          company_id: string
          id: string
          instance_id: string
          poll_chat_jid: string
          poll_message_id: string
          received_at: string
          selected_options: string[]
          vote_message_id: string
          voted_at: string
          voter_jid: string
          voter_name: string | null
          voter_phone: string | null
        }
        Insert: {
          company_id: string
          id: string
          instance_id: string
          poll_chat_jid: string
          poll_message_id: string
          received_at?: string
          selected_options?: string[]
          vote_message_id: string
          voted_at?: string
          voter_jid: string
          voter_name?: string | null
          voter_phone?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          instance_id?: string
          poll_chat_jid?: string
          poll_message_id?: string
          received_at?: string
          selected_options?: string[]
          vote_message_id?: string
          voted_at?: string
          voter_jid?: string
          voter_name?: string | null
          voter_phone?: string | null
        }
        Relationships: []
      }
      processed_webhooks: {
        Row: {
          created_at: string
          event_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bonus_credits: number
          bonus_expires_at: string | null
          codigo_vinculo: string | null
          daily_request_count: number | null
          id: string
          last_usage_date: string | null
          nome: string | null
          plan_tier: string | null
          pmo_ativo_id: number | null
          propriedade_ativa_id: number | null
          role: string | null
          telefone: string | null
          total_tokens_used: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bonus_credits?: number
          bonus_expires_at?: string | null
          codigo_vinculo?: string | null
          daily_request_count?: number | null
          id: string
          last_usage_date?: string | null
          nome?: string | null
          plan_tier?: string | null
          pmo_ativo_id?: number | null
          propriedade_ativa_id?: number | null
          role?: string | null
          telefone?: string | null
          total_tokens_used?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bonus_credits?: number
          bonus_expires_at?: string | null
          codigo_vinculo?: string | null
          daily_request_count?: number | null
          id?: string
          last_usage_date?: string | null
          nome?: string | null
          plan_tier?: string | null
          pmo_ativo_id?: number | null
          propriedade_ativa_id?: number | null
          role?: string | null
          telefone?: string | null
          total_tokens_used?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_pmo_ativo_id_fkey"
            columns: ["pmo_ativo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_propriedade_ativa_id_fkey"
            columns: ["propriedade_ativa_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      propriedades: {
        Row: {
          area_total_ha: number | null
          car: string | null
          cidade: string | null
          created_at: string
          endereco_cadastral: string | null
          id: number
          inscricao_estadual: string | null
          matricula: string | null
          modalidade_predominante:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          nome: string
          tem_producao_paralela: boolean | null
          uf: string | null
          user_id: string
        }
        Insert: {
          area_total_ha?: number | null
          car?: string | null
          cidade?: string | null
          created_at?: string
          endereco_cadastral?: string | null
          id?: number
          inscricao_estadual?: string | null
          matricula?: string | null
          modalidade_predominante?:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          nome: string
          tem_producao_paralela?: boolean | null
          uf?: string | null
          user_id: string
        }
        Update: {
          area_total_ha?: number | null
          car?: string | null
          cidade?: string | null
          created_at?: string
          endereco_cadastral?: string | null
          id?: number
          inscricao_estadual?: string | null
          matricula?: string | null
          modalidade_predominante?:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          nome?: string
          tem_producao_paralela?: boolean | null
          uf?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rag_experiment_runs: {
        Row: {
          actual_model_name: string | null
          created_at: string
          error_type: string | null
          estimated_cost_usd: number | null
          execution_mode: string | null
          experiment_id: string
          human_rating: number | null
          id: string
          latency_ms: number | null
          max_tokens: number | null
          prompt_hash: string | null
          prompt_version: string | null
          provider_name: string | null
          requested_model_name: string
          response_text: string | null
          status: string
          temperature: number | null
          tokens_used_completion: number | null
          tokens_used_prompt: number | null
          top_p: number | null
        }
        Insert: {
          actual_model_name?: string | null
          created_at?: string
          error_type?: string | null
          estimated_cost_usd?: number | null
          execution_mode?: string | null
          experiment_id: string
          human_rating?: number | null
          id?: string
          latency_ms?: number | null
          max_tokens?: number | null
          prompt_hash?: string | null
          prompt_version?: string | null
          provider_name?: string | null
          requested_model_name: string
          response_text?: string | null
          status: string
          temperature?: number | null
          tokens_used_completion?: number | null
          tokens_used_prompt?: number | null
          top_p?: number | null
        }
        Update: {
          actual_model_name?: string | null
          created_at?: string
          error_type?: string | null
          estimated_cost_usd?: number | null
          execution_mode?: string | null
          experiment_id?: string
          human_rating?: number | null
          id?: string
          latency_ms?: number | null
          max_tokens?: number | null
          prompt_hash?: string | null
          prompt_version?: string | null
          provider_name?: string | null
          requested_model_name?: string
          response_text?: string | null
          status?: string
          temperature?: number | null
          tokens_used_completion?: number | null
          tokens_used_prompt?: number | null
          top_p?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_experiment_runs_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "rag_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_experiments: {
        Row: {
          created_at: string
          id: string
          pmo_id: number
          query_normalized: string | null
          query_text: string
          retrieval_strategy: string
          retrieval_version: string | null
          retrieved_chunks_snapshot: Json
          top_k: number
        }
        Insert: {
          created_at?: string
          id?: string
          pmo_id: number
          query_normalized?: string | null
          query_text: string
          retrieval_strategy: string
          retrieval_version?: string | null
          retrieved_chunks_snapshot: Json
          top_k: number
        }
        Update: {
          created_at?: string
          id?: string
          pmo_id?: number
          query_normalized?: string | null
          query_text?: string
          retrieval_strategy?: string
          retrieval_version?: string | null
          retrieved_chunks_snapshot?: Json
          top_k?: number
        }
        Relationships: []
      }
      rag_feedback: {
        Row: {
          comment: string | null
          created_at: string
          feedback_type: string | null
          id: string
          is_positive: boolean | null
          log_id: string
          review_status: string | null
          reviewed_by: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          feedback_type?: string | null
          id?: string
          is_positive?: boolean | null
          log_id: string
          review_status?: string | null
          reviewed_by?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          feedback_type?: string | null
          id?: string
          is_positive?: boolean | null
          log_id?: string
          review_status?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_feedback_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "rag_query_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_query_logs: {
        Row: {
          answer_status: string | null
          created_at: string
          fallback_used: boolean | null
          id: string
          knowledge_version_ids: string[] | null
          latency_ms_generation: number | null
          latency_ms_retrieval: number | null
          latency_ms_total: number | null
          prompt_version: string | null
          query_hash: string | null
          retrieval_k: number | null
          retrieved_chunk_ids: number[] | null
          route: string | null
          session_id: string | null
        }
        Insert: {
          answer_status?: string | null
          created_at?: string
          fallback_used?: boolean | null
          id?: string
          knowledge_version_ids?: string[] | null
          latency_ms_generation?: number | null
          latency_ms_retrieval?: number | null
          latency_ms_total?: number | null
          prompt_version?: string | null
          query_hash?: string | null
          retrieval_k?: number | null
          retrieved_chunk_ids?: number[] | null
          route?: string | null
          session_id?: string | null
        }
        Update: {
          answer_status?: string | null
          created_at?: string
          fallback_used?: boolean | null
          id?: string
          knowledge_version_ids?: string[] | null
          latency_ms_generation?: number | null
          latency_ms_retrieval?: number | null
          latency_ms_total?: number | null
          prompt_version?: string | null
          query_hash?: string | null
          retrieval_k?: number | null
          retrieved_chunk_ids?: number[] | null
          route?: string | null
          session_id?: string | null
        }
        Relationships: []
      }
      raw_payloads: {
        Row: {
          created_at: string
          id: string
          message_id: string
          payload_data: Json
          processing_error: string | null
          processing_status: string
          source: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          payload_data: Json
          processing_error?: string | null
          processing_status?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          payload_data?: Json
          processing_error?: string | null
          processing_status?: string
          source?: string | null
        }
        Relationships: []
      }
      ref_adubos_organicos: {
        Row: {
          ativo: boolean | null
          base_seca: boolean | null
          created_at: string | null
          fonte_referencia: string | null
          id: number
          k2o_total_percentual: number
          n_total_percentual: number
          nome: string
          p2o5_total_percentual: number
          taxa_liberacao_k_ciclo1: number
          taxa_liberacao_n_ciclo1: number
          taxa_liberacao_p_ciclo1: number
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          base_seca?: boolean | null
          created_at?: string | null
          fonte_referencia?: string | null
          id?: number
          k2o_total_percentual: number
          n_total_percentual: number
          nome: string
          p2o5_total_percentual: number
          taxa_liberacao_k_ciclo1: number
          taxa_liberacao_n_ciclo1: number
          taxa_liberacao_p_ciclo1: number
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          base_seca?: boolean | null
          created_at?: string | null
          fonte_referencia?: string | null
          id?: number
          k2o_total_percentual?: number
          n_total_percentual?: number
          nome?: string
          p2o5_total_percentual?: number
          taxa_liberacao_k_ciclo1?: number
          taxa_liberacao_n_ciclo1?: number
          taxa_liberacao_p_ciclo1?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      ref_cultura_extracao: {
        Row: {
          ano_referencia: number | null
          ativo: boolean | null
          created_at: string | null
          cultura: string
          extracao_k2o_kg_t: number
          extracao_n_kg_t: number
          extracao_p2o5_kg_t: number
          fonte_referencia: string | null
          id: number
          produtividade_referencia_t_ha: number
          updated_at: string | null
        }
        Insert: {
          ano_referencia?: number | null
          ativo?: boolean | null
          created_at?: string | null
          cultura: string
          extracao_k2o_kg_t: number
          extracao_n_kg_t: number
          extracao_p2o5_kg_t: number
          fonte_referencia?: string | null
          id?: number
          produtividade_referencia_t_ha: number
          updated_at?: string | null
        }
        Update: {
          ano_referencia?: number | null
          ativo?: boolean | null
          created_at?: string | null
          cultura?: string
          extracao_k2o_kg_t?: number
          extracao_n_kg_t?: number
          extracao_p2o5_kg_t?: number
          fonte_referencia?: string | null
          id?: number
          produtividade_referencia_t_ha?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      referencia_agronomica: {
        Row: {
          cultura: string
          produtividade_kg_ha: number
        }
        Insert: {
          cultura: string
          produtividade_kg_ha: number
        }
        Update: {
          cultura?: string
          produtividade_kg_ha?: number
        }
        Relationships: []
      }
      runtime_configs: {
        Row: {
          created_at: string | null
          id: number
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: number
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          loadOnStartup: boolean
          value: string
        }
        Insert: {
          key: string
          loadOnStartup?: boolean
          value: string
        }
        Update: {
          key?: string
          loadOnStartup?: boolean
          value?: string
        }
        Relationships: []
      }
      talhoes: {
        Row: {
          active: boolean | null
          area_ha: number | null
          area_total_m2: number | null
          areia: number | null
          border_color: string | null
          cor: string | null
          cor_identificacao: string | null
          created_at: string
          cultura: string | null
          fill_color: string | null
          fosforo: number | null
          geometry: Json | null
          id: number
          materia_organica: number | null
          modalidade_producao:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          nome: string
          ph_agua: number | null
          ph_solo: number | null
          pmo_id: number | null
          potassio: number | null
          propriedade_id: number | null
          silte: number | null
          status_certificacao: string | null
          teor_argila: number | null
          tipo: string | null
          user_id: string | null
          v_percent: number | null
        }
        Insert: {
          active?: boolean | null
          area_ha?: number | null
          area_total_m2?: number | null
          areia?: number | null
          border_color?: string | null
          cor?: string | null
          cor_identificacao?: string | null
          created_at?: string
          cultura?: string | null
          fill_color?: string | null
          fosforo?: number | null
          geometry?: Json | null
          id?: number
          materia_organica?: number | null
          modalidade_producao?:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          nome: string
          ph_agua?: number | null
          ph_solo?: number | null
          pmo_id?: number | null
          potassio?: number | null
          propriedade_id?: number | null
          silte?: number | null
          status_certificacao?: string | null
          teor_argila?: number | null
          tipo?: string | null
          user_id?: string | null
          v_percent?: number | null
        }
        Update: {
          active?: boolean | null
          area_ha?: number | null
          area_total_m2?: number | null
          areia?: number | null
          border_color?: string | null
          cor?: string | null
          cor_identificacao?: string | null
          created_at?: string
          cultura?: string | null
          fill_color?: string | null
          fosforo?: number | null
          geometry?: Json | null
          id?: number
          materia_organica?: number | null
          modalidade_producao?:
            | Database["public"]["Enums"]["modalidade_producao_enum"]
            | null
          nome?: string
          ph_agua?: number | null
          ph_solo?: number | null
          pmo_id?: number | null
          potassio?: number | null
          propriedade_id?: number | null
          silte?: number | null
          status_certificacao?: string | null
          teor_argila?: number | null
          tipo?: string | null
          user_id?: string | null
          v_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "propriedade_talhoes_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talhoes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      transacao_alocacoes: {
        Row: {
          caderno_campo_id: string | null
          created_at: string | null
          id: string
          percentual_alocado: number | null
          talhao_id: number | null
          transacao_id: string
          valor_alocado: number
        }
        Insert: {
          caderno_campo_id?: string | null
          created_at?: string | null
          id?: string
          percentual_alocado?: number | null
          talhao_id?: number | null
          transacao_id: string
          valor_alocado?: number
        }
        Update: {
          caderno_campo_id?: string | null
          created_at?: string | null
          id?: string
          percentual_alocado?: number | null
          talhao_id?: number | null
          transacao_id?: string
          valor_alocado?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacao_alocacoes_caderno_campo_id_fkey"
            columns: ["caderno_campo_id"]
            isOneToOne: false
            referencedRelation: "caderno_campo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacao_alocacoes_talhao_id_fkey"
            columns: ["talhao_id"]
            isOneToOne: false
            referencedRelation: "talhoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacao_alocacoes_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      transacoes_financeiras: {
        Row: {
          categoria_id: string | null
          created_at: string | null
          data_competencia: string
          data_transacao: string | null
          fornecedor: string | null
          fornecedor_cliente: string | null
          id: string
          nota_fiscal: string | null
          observacao: string | null
          pmo_id: number | null
          propriedade_id: number
          raw_payload_id: string | null
          status_pagamento: string | null
          tipo: string
          user_id: string
          valor_total: number
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string | null
          data_competencia?: string
          data_transacao?: string | null
          fornecedor?: string | null
          fornecedor_cliente?: string | null
          id?: string
          nota_fiscal?: string | null
          observacao?: string | null
          pmo_id?: number | null
          propriedade_id: number
          raw_payload_id?: string | null
          status_pagamento?: string | null
          tipo: string
          user_id?: string
          valor_total?: number
        }
        Update: {
          categoria_id?: string | null
          created_at?: string | null
          data_competencia?: string
          data_transacao?: string | null
          fornecedor?: string | null
          fornecedor_cliente?: string | null
          id?: string
          nota_fiscal?: string | null
          observacao?: string | null
          pmo_id?: number | null
          propriedade_id?: number
          raw_payload_id?: string | null
          status_pagamento?: string | null
          tipo?: string
          user_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_financeiras_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_pmo_id_fkey"
            columns: ["pmo_id"]
            isOneToOne: false
            referencedRelation: "pmos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_raw_payload_id_fkey"
            columns: ["raw_payload_id"]
            isOneToOne: false
            referencedRelation: "raw_payloads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_api_keys: {
        Row: {
          apiKey: string
          createdAt: string
          id: string
          label: string
          scopes: Json | null
          updatedAt: string
          userId: string
        }
        Insert: {
          apiKey: string
          createdAt?: string
          id: string
          label: string
          scopes?: Json | null
          updatedAt?: string
          userId: string
        }
        Update: {
          apiKey?: string
          createdAt?: string
          id?: string
          label?: string
          scopes?: Json | null
          updatedAt?: string
          userId?: string
        }
        Relationships: []
      }
      whatsmeow_app_state_sync_keys: {
        Row: {
          fingerprint: string
          jid: string
          key_data: string
          key_id: string
          timestamp: number
        }
        Insert: {
          fingerprint: string
          jid: string
          key_data: string
          key_id: string
          timestamp: number
        }
        Update: {
          fingerprint?: string
          jid?: string
          key_data?: string
          key_id?: string
          timestamp?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsmeow_app_state_sync_keys_jid_fkey"
            columns: ["jid"]
            isOneToOne: false
            referencedRelation: "whatsmeow_device"
            referencedColumns: ["jid"]
          },
        ]
      }
      whatsmeow_app_state_version: {
        Row: {
          hash: string
          jid: string
          name: string
          version: number
        }
        Insert: {
          hash: string
          jid: string
          name: string
          version: number
        }
        Update: {
          hash?: string
          jid?: string
          name?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsmeow_app_state_version_jid_fkey"
            columns: ["jid"]
            isOneToOne: false
            referencedRelation: "whatsmeow_device"
            referencedColumns: ["jid"]
          },
        ]
      }
      whatsmeow_chat_settings: {
        Row: {
          archived: boolean
          chat_jid: string
          muted_until: number
          our_jid: string
          pinned: boolean
        }
        Insert: {
          archived?: boolean
          chat_jid: string
          muted_until?: number
          our_jid: string
          pinned?: boolean
        }
        Update: {
          archived?: boolean
          chat_jid?: string
          muted_until?: number
          our_jid?: string
          pinned?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "whatsmeow_chat_settings_our_jid_fkey"
            columns: ["our_jid"]
            isOneToOne: false
            referencedRelation: "whatsmeow_device"
            referencedColumns: ["jid"]
          },
        ]
      }
      whatsmeow_contacts: {
        Row: {
          business_name: string | null
          first_name: string | null
          full_name: string | null
          our_jid: string
          push_name: string | null
          redacted_phone: string | null
          their_jid: string
        }
        Insert: {
          business_name?: string | null
          first_name?: string | null
          full_name?: string | null
          our_jid: string
          push_name?: string | null
          redacted_phone?: string | null
          their_jid: string
        }
        Update: {
          business_name?: string | null
          first_name?: string | null
          full_name?: string | null
          our_jid?: string
          push_name?: string | null
          redacted_phone?: string | null
          their_jid?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsmeow_contacts_our_jid_fkey"
            columns: ["our_jid"]
            isOneToOne: false
            referencedRelation: "whatsmeow_device"
            referencedColumns: ["jid"]
          },
        ]
      }
      whatsmeow_device: {
        Row: {
          adv_account_sig: string
          adv_account_sig_key: string
          adv_details: string
          adv_device_sig: string
          adv_key: string
          business_name: string
          facebook_uuid: string | null
          identity_key: string
          jid: string
          lid: string | null
          lid_migration_ts: number
          noise_key: string
          platform: string
          push_name: string
          registration_id: number
          signed_pre_key: string
          signed_pre_key_id: number
          signed_pre_key_sig: string
        }
        Insert: {
          adv_account_sig: string
          adv_account_sig_key: string
          adv_details: string
          adv_device_sig: string
          adv_key: string
          business_name?: string
          facebook_uuid?: string | null
          identity_key: string
          jid: string
          lid?: string | null
          lid_migration_ts?: number
          noise_key: string
          platform?: string
          push_name?: string
          registration_id: number
          signed_pre_key: string
          signed_pre_key_id: number
          signed_pre_key_sig: string
        }
        Update: {
          adv_account_sig?: string
          adv_account_sig_key?: string
          adv_details?: string
          adv_device_sig?: string
          adv_key?: string
          business_name?: string
          facebook_uuid?: string | null
          identity_key?: string
          jid?: string
          lid?: string | null
          lid_migration_ts?: number
          noise_key?: string
          platform?: string
          push_name?: string
          registration_id?: number
          signed_pre_key?: string
          signed_pre_key_id?: number
          signed_pre_key_sig?: string
        }
        Relationships: []
      }
      whatsmeow_identity_keys: {
        Row: {
          identity: string
          our_jid: string
          their_id: string
        }
        Insert: {
          identity: string
          our_jid: string
          their_id: string
        }
        Update: {
          identity?: string
          our_jid?: string
          their_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsmeow_identity_keys_our_jid_fkey"
            columns: ["our_jid"]
            isOneToOne: false
            referencedRelation: "whatsmeow_device"
            referencedColumns: ["jid"]
          },
        ]
      }
      whatsmeow_lid_map: {
        Row: {
          lid: string
          pn: string
        }
        Insert: {
          lid: string
          pn: string
        }
        Update: {
          lid?: string
          pn?: string
        }
        Relationships: []
      }
      whatsmeow_message_secrets: {
        Row: {
          chat_jid: string
          key: string
          message_id: string
          our_jid: string
          sender_jid: string
        }
        Insert: {
          chat_jid: string
          key: string
          message_id: string
          our_jid: string
          sender_jid: string
        }
        Update: {
          chat_jid?: string
          key?: string
          message_id?: string
          our_jid?: string
          sender_jid?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsmeow_message_secrets_our_jid_fkey"
            columns: ["our_jid"]
            isOneToOne: false
            referencedRelation: "whatsmeow_device"
            referencedColumns: ["jid"]
          },
        ]
      }
      whatsmeow_pre_keys: {
        Row: {
          jid: string
          key: string
          key_id: number
          uploaded: boolean
        }
        Insert: {
          jid: string
          key: string
          key_id: number
          uploaded: boolean
        }
        Update: {
          jid?: string
          key?: string
          key_id?: number
          uploaded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "whatsmeow_pre_keys_jid_fkey"
            columns: ["jid"]
            isOneToOne: false
            referencedRelation: "whatsmeow_device"
            referencedColumns: ["jid"]
          },
        ]
      }
      whatsmeow_privacy_tokens: {
        Row: {
          our_jid: string
          sender_timestamp: number | null
          their_jid: string
          timestamp: number
          token: string
        }
        Insert: {
          our_jid: string
          sender_timestamp?: number | null
          their_jid: string
          timestamp: number
          token: string
        }
        Update: {
          our_jid?: string
          sender_timestamp?: number | null
          their_jid?: string
          timestamp?: number
          token?: string
        }
        Relationships: []
      }
      whatsmeow_sender_keys: {
        Row: {
          chat_id: string
          our_jid: string
          sender_id: string
          sender_key: string
        }
        Insert: {
          chat_id: string
          our_jid: string
          sender_id: string
          sender_key: string
        }
        Update: {
          chat_id?: string
          our_jid?: string
          sender_id?: string
          sender_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsmeow_sender_keys_our_jid_fkey"
            columns: ["our_jid"]
            isOneToOne: false
            referencedRelation: "whatsmeow_device"
            referencedColumns: ["jid"]
          },
        ]
      }
      whatsmeow_sessions: {
        Row: {
          our_jid: string
          session: string | null
          their_id: string
        }
        Insert: {
          our_jid: string
          session?: string | null
          their_id: string
        }
        Update: {
          our_jid?: string
          session?: string | null
          their_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsmeow_sessions_our_jid_fkey"
            columns: ["our_jid"]
            isOneToOne: false
            referencedRelation: "whatsmeow_device"
            referencedColumns: ["jid"]
          },
        ]
      }
      whatsmeow_version: {
        Row: {
          compat: number | null
          version: number
        }
        Insert: {
          compat?: number | null
          version: number
        }
        Update: {
          compat?: number | null
          version?: number
        }
        Relationships: []
      }
      workflow_history: {
        Row: {
          authors: string
          connections: Json
          createdAt: string
          nodes: Json
          updatedAt: string
          versionId: string
          workflowId: string
        }
        Insert: {
          authors: string
          connections: Json
          createdAt?: string
          nodes: Json
          updatedAt?: string
          versionId: string
          workflowId: string
        }
        Update: {
          authors?: string
          connections?: Json
          createdAt?: string
          nodes?: Json
          updatedAt?: string
          versionId?: string
          workflowId?: string
        }
        Relationships: []
      }
    }
    Views: {
      guardrail_kpi_hourly: {
        Row: {
          avg_risk_score: number | null
          block_rate_pct: number | null
          blocked_count: number | null
          filter_name: string | null
          hour_bucket: string | null
          layer: string | null
          total_events: number | null
        }
        Relationships: []
      }
      guardrail_recent_blocks: {
        Row: {
          created_at: string | null
          filter_name: string | null
          id: string | null
          job_id: string | null
          layer: string | null
          phone: string | null
          reason: string | null
          risk_score: number | null
          violations: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "guardrail_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "message_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardrail_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "message_queue_dead_letter"
            referencedColumns: ["id"]
          },
        ]
      }
      hitl_audit_summary: {
        Row: {
          approved: number | null
          day: string | null
          expired: number | null
          rejected: number | null
          total: number | null
        }
        Relationships: []
      }
      hitl_pending_view: {
        Row: {
          action_label: string | null
          created_at: string | null
          expires_at: string | null
          from_phone: string | null
          id: string | null
          seconds_until_expiry: number | null
          status: string | null
          tool_name: string | null
        }
        Insert: {
          action_label?: string | null
          created_at?: string | null
          expires_at?: string | null
          from_phone?: string | null
          id?: string | null
          seconds_until_expiry?: never
          status?: string | null
          tool_name?: string | null
        }
        Update: {
          action_label?: string | null
          created_at?: string | null
          expires_at?: string | null
          from_phone?: string | null
          id?: string | null
          seconds_until_expiry?: never
          status?: string | null
          tool_name?: string | null
        }
        Relationships: []
      }
      message_queue_dead_letter: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          error_msg: string | null
          from_phone: string | null
          id: string | null
          max_attempts: number | null
          message_preview: string | null
          msg_id: string | null
          processed_at: string | null
          processing_seconds: number | null
          status: string | null
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          error_msg?: string | null
          from_phone?: string | null
          id?: string | null
          max_attempts?: number | null
          message_preview?: never
          msg_id?: string | null
          processed_at?: string | null
          processing_seconds?: never
          status?: string | null
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          error_msg?: string | null
          from_phone?: string | null
          id?: string | null
          max_attempts?: number | null
          message_preview?: never
          msg_id?: string | null
          processed_at?: string | null
          processing_seconds?: never
          status?: string | null
        }
        Relationships: []
      }
      message_queue_monitor: {
        Row: {
          avg_attempts: number | null
          newest_job: string | null
          oldest_job: string | null
          status: string | null
          total: number | null
        }
        Relationships: []
      }
      view_conversas_recentes: {
        Row: {
          id: string | null
          last_message: string | null
          last_message_role: string | null
          last_message_status: string | null
          last_message_timestamp: string | null
          phone: string | null
          profile_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calcular_balanco_nutricional: {
        Args: { p_adubo_nome: string; p_cultura: string; p_meta_t_ha: number }
        Returns: Json
      }
      claim_next_ingestion_job: {
        Args: { p_worker_id: string }
        Returns: {
          attempt_count: number
          created_at: string
          document_id: string
          error_log: string | null
          finished_at: string | null
          id: string
          progress_pct: number | null
          started_at: string | null
          status: string
          step: string | null
          version_id: string | null
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ingestion_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_next_message_job: {
        Args: {
          p_from_status: string
          p_target_status: string
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          body_text: string | null
          claimed_at: string | null
          created_at: string
          error_msg: string | null
          from_phone: string
          id: string
          max_attempts: number
          msg_id: string
          next_retry_at: string
          processed_at: string | null
          raw_payload: Json
          respond_audio: boolean
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "message_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_guardrail_events: { Args: never; Returns: number }
      cleanup_message_queue: { Args: never; Returns: number }
      criar_infraestrutura_pmo:
        | {
            Args: {
              p_area_ha?: number
              p_canteiros?: Json
              p_nome_talhao?: string
              p_pmo_id: number
              p_propriedade_id?: number
              p_talhao_id?: number
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_area_ha?: number
              p_canteiros?: Json
              p_nome_talhao: string
              p_pmo_id: number
              p_propriedade_id?: number
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_area_ha?: number
              p_canteiros?: Json
              p_nome_talhao: string
              p_pmo_id: number
              p_propriedade_id: number
              p_user_id: string
            }
            Returns: Json
          }
      delete_propriedade_cascade: {
        Args: { p_propriedade_id: number }
        Returns: undefined
      }
      expire_hitl_pending: { Args: never; Returns: number }
      get_admin_user_details: {
        Args: { target_user_id: string }
        Returns: {
          email: string
          nome: string
          plan_tier: string
          role: string
        }[]
      }
      get_coop_dashboard_stats: {
        Args: { p_organizacao_id: number }
        Returns: Json
      }
      get_dashboard_stats: { Args: never; Returns: Json }
      get_dre_mensal: {
        Args: { p_ano: number; p_propriedade_id: number }
        Returns: {
          despesas: number
          lucro: number
          mes: string
          receitas: number
        }[]
      }
      get_knowledge_role: { Args: never; Returns: string }
      get_lucro_por_talhao: {
        Args: { p_ano: number; p_propriedade_id: number }
        Returns: {
          cor: string
          despesas: number
          lucro: number
          receitas: number
          talhao_id: number
          talhao_nome: string
        }[]
      }
      get_propriedade_metrics: {
        Args: { p_propriedade_id: number }
        Returns: Json
      }
      get_recent_bot_activities: {
        Args: never
        Returns: {
          created_at: string
          descricao: string
          id: string
          tipo: string
        }[]
      }
      get_traceability_data: { Args: { p_codigo_lote: string }; Returns: Json }
      increment_usage_stats: {
        Args: { p_credits_cost: number; p_tokens: number; p_user_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_chemical_input: { Args: { produto_nome: string }; Returns: boolean }
      match_chunks:
        | {
            Args: {
              match_count: number
              match_threshold: number
              query_embedding: unknown
            }
            Returns: {
              content: string
              id: string
              similarity: number
            }[]
          }
        | {
            Args: { match_count?: number; query_embedding: string }
            Returns: {
              content: string
              document_name: string
              id: string
              metadata: Json
              similarity: number
            }[]
          }
        | {
            Args: {
              match_count: number
              match_threshold: number
              pmo_id_filter: number
              query_embedding: string
            }
            Returns: {
              content: string
              document_name: string
              id: string
              metadata: Json
              similarity: number
            }[]
          }
      match_documents_with_context: {
        Args: {
          match_count: number
          match_pmo_id: number
          match_threshold: number
          query_embedding: string
          window_size?: number
        }
        Returns: {
          chunk_index: number
          content: string
          document_name: string
          id: number
          is_global: boolean
          metadata: Json
          pmo_id: number
          similarity: number
          source_document_id: string
        }[]
      }
      match_documents_with_context_1024: {
        Args: {
          match_count: number
          match_pmo_id: number
          match_threshold: number
          query_embedding: string
          window_size?: number
        }
        Returns: {
          chunk_index: number
          content: string
          document_name: string
          id: number
          is_global: boolean
          metadata: Json
          pmo_id: number
          similarity: number
          source_document_id: string
        }[]
      }
      match_farm_documents: {
        Args: {
          match_count?: number
          match_pmo_id: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          document_name: string
          id: number
          is_global: boolean
          metadata: Json
          similarity: number
        }[]
      }
      normalize_phone: { Args: { phone_str: string }; Returns: string }
      publish_knowledge_version: {
        Args: { p_version_id: string }
        Returns: undefined
      }
      registrar_atividade_pmo: {
        Args: {
          atividade_arg: string
          canteiros_arg: string[]
          data_arg: string
          detalhes_arg?: Json
          fornecedor_arg?: string
          insumo_aplicado_arg?: string
          nota_fiscal_arg?: string
          pmo_id_arg: number
          produto_arg: string
          quantidade_unidade_arg: string
          quantidade_valor_arg: number
          talhao_nome_arg: string
          user_id_arg: string
        }
        Returns: Json
      }
      rpc_get_balanco_ia: {
        Args: { p_ano: number; p_mes?: number; p_propriedade_id: number }
        Returns: Json
      }
      rpc_registrar_compra_insumo:
        | {
            Args: {
              alocacoes_talhoes_arg?: Json
              categoria_nome_arg?: string
              composicao_arg?: string
              data_compra_arg?: string
              fornecedor_arg?: string
              marca_arg?: string
              nota_fiscal_arg?: string
              pmo_id_arg: number
              procedencia_arg?: string
              produto_arg: string
              propriedade_id_arg: number
              quantidade_unidade_arg: string
              quantidade_valor_arg: number
              user_id_arg: string
              valor_total_arg?: number
            }
            Returns: Json
          }
        | {
            Args: {
              alocacoes_talhoes_arg?: Json
              categoria_nome_arg?: string
              composicao_arg?: string
              data_compra_arg?: string
              fornecedor_arg?: string
              marca_arg?: string
              nota_fiscal_arg?: string
              pmo_id_arg: number
              procedencia_arg?: string
              produto_arg: string
              propriedade_id_arg: number
              quantidade_unidade_arg: string
              quantidade_valor_arg: number
              raw_payload_id_arg?: string
              user_id_arg: string
              valor_total_arg?: number
            }
            Returns: Json
          }
      rpc_registrar_operacao_campo:
        | {
            Args: {
              data_arg?: string
              payload_arg: Json
              pmo_id_arg: number
              propriedade_id_arg: number
              tipo_arg: string
              user_id_arg: string
            }
            Returns: Json
          }
        | {
            Args: {
              payload_arg: Json
              pmo_id_arg: number
              tipo_arg: string
              user_id_arg: string
            }
            Returns: Json
          }
      rpc_registrar_transacao_com_rateio: {
        Args: { payload: Json }
        Returns: Json
      }
      setup_initial_profile: {
        Args: {
          p_area_ha: number
          p_nome: string
          p_propriedade_nome: string
          p_talhao_nome: string
          p_user_id: string
        }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
      validate_file_extension: {
        Args: { allowed_extensions: string[]; name: string }
        Returns: boolean
      }
    }
    Enums: {
      ingestion_job_status: "pending" | "processing" | "completed" | "failed"
      modalidade_producao_enum: "ORGANICO" | "CONVENCIONAL" | "TRANSICAO"
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
    Enums: {
      ingestion_job_status: ["pending", "processing", "completed", "failed"],
      modalidade_producao_enum: ["ORGANICO", "CONVENCIONAL", "TRANSICAO"],
    },
  },
} as const
