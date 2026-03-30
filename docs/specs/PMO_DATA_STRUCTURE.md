# 📑 Documentação de Estrutura de Dados - AgroVivo PMO

## 📌 Visão Geral

Este documento define a estrutura canônica do campo `form_data` (JSONB) na tabela `pmos` do Supabase. Serve como contrato entre backend (Python/Flask) e frontend (React/MUI).

**Versão:** 1.0  
**Última atualização:** 21/12/2024  
**Responsável:** Equipe AgroVivo

---

## 🏗️ Arquitetura de Sincronização

### Fluxo de Dados
```
WhatsApp → Whisper (transcrição) → Llama 3.3 (extração) → Python (validação) 
→ Supabase (persistência) → React (exibição)
```

### Tabelas Principais
- **`pmos`**: Planos de Manejo Orgânico
  - `id` (bigint, PK)
  - `nome_identificador` (text)
  - `form_data` (jsonb) ← **Estrutura documentada aqui**
  - `status` (text: RASCUNHO/CONCLUÍDO)
  - `user_id` (uuid)
  - `created_at`, `updated_at` (timestamptz)

- **`caderno_campo`**: Registros de auditoria das sincronizações
  - `id` (uuid, PK)
  - `pmo_id` (bigint, FK)
  - `tipo_registro` (text)
  - `dados_ia` (jsonb)
  - `created_at` (timestamptz)

---

## 📋 Estrutura Completa do `form_data`

```json
{
  "secao_1_descricao_propriedade": { /* Seção 1 */ },
  "secao_2_atividades_produtivas_organicas": { /* Seção 2 */ },
  "secao_3_atividades_produtivas_nao_organicas": { /* Seção 3 */ },
  "secao_4_animais_servico_subsistencia_companhia": { /* Seção 4 */ },
  "secao_5_producao_terceirizada": { /* Seção 5 */ },
  "secao_6_aspectos_ambientais": { /* Seção 6 */ },
  "secao_7_aspectos_sociais": { /* Seção 7 */ },
  "secao_8_insumos_equipamentos": { /* Seção 8 */ },
  "insumos_melhorar_fertilidade": [ /* Array no nível raiz - CRÍTICO */ ],
  "secao_9_propagacao_vegetal": { /* Seção 9 */ },
  "secao_10_fitossanidade": { /* Seção 10 */ },
  "secao_11_colheita": { /* Seção 11 */ },
  "secao_12_pos_colheita": { /* Seção 12 */ },
  "secao_13_producao_animal": { /* Seção 13 */ },
  "secao_14_comercializacao": { /* Seção 14 */ },
  "secao_15_rastreabilidade": { /* Seção 15 */ },
  "secao_16_sac": { /* Seção 16 */ },
  "secao_17_opiniao": { /* Seção 17 */ },
  "secao_18_anexos": { /* Seção 18 */ },
  "secao_avaliacao_plano_manejo": { /* Avaliação OAC */ }
}
```

---

## 🎯 Seções Detalhadas

### 📍 Seção 8: Insumos e Fertilidade

#### ⚠️ **ATENÇÃO CRÍTICA**
Existe uma estrutura **duplicada** por razões históricas:

1. **Nível Raiz** (usado pelo frontend):
   ```
   form_data.insumos_melhorar_fertilidade
   ```

2. **Dentro da Seção 8** (legado, vazio):
   ```
   form_data.secao_8_insumos_equipamentos.insumos_melhorar_fertilidade
   ```

**Regra de Ouro:** O backend Python **DEVE** salvar em ambos os lugares para compatibilidade total.

#### Estrutura da Seção 8

```json
{
  "secao_8_insumos_equipamentos": {
    "lista_insumos": [
      {
        "id": "uuid-v4",
        "produto": "Nome do produto",
        "onde_cultura": "Talhão/Canteiro",
        "quando": "2024-12-21",
        "origem": "Externa|Própria",
        "composicao": "Descrição química",
        "marca": "Nome comercial",
        "dosagem": "2 kg/ha",
        "finalidade": "Nutrição|Proteção",
        "autorizacao": "Sim|Não"
      }
    ],
    "insumos_melhorar_fertilidade": [],  // ⚠️ Deixar vazio (legado)
    "insumos_producao_nao_organica": {
      "insumos_producao_nao_organica": ""
    },
    "controle_insumos_producao_paralela": {
      "controle_insumos_producao_paralela": ""
    }
  }
}
```

#### Array `insumos_melhorar_fertilidade` (Nível Raiz)

**Localização:** `form_data.insumos_melhorar_fertilidade`

```json
{
  "insumos_melhorar_fertilidade": [
    {
      "id": "92421b47-32ff-4559-93de-941ae2694e53",
      "produto_ou_manejo": "Calda Bordalesa",
      "onde": "Tomateiros no Canteiro 2",
      "quando": "2025-12-21",
      "procedencia": "Externa",
      "composicao": "CuSO4 + Ca(OH)2",
      "marca": "Diversas",
      "dosagem": "5.0 Litros"
    }
  ]
}
```

#### Mapeamento de Campos (Python → React)

| Campo da IA (Python) | Chave no JSON | Tipo | Obrigatório | Exemplo |
|---------------------|---------------|------|-------------|---------|
| `produto` | `produto_ou_manejo` | string | ✅ Sim | "Calda Bordalesa" |
| `talhao_canteiro` | `onde` | string | ✅ Sim | "Canteiro 2" |
| `data_registro` | `quando` | date (YYYY-MM-DD) | ❌ Não | "2024-12-21" |
| `procedencia` | `procedencia` | string | ❌ Não | "Externa" |
| `composicao` | `composicao` | string | ❌ Não | "CuSO4" |
| `marca` | `marca` | string | ❌ Não | "Diversas" |
| `quantidade_valor` + `quantidade_unidade` | `dosagem` | string | ❌ Não | "5.0 Litros" |
| Auto-gerado | `id` | uuid | ✅ Sim | uuid.uuid4() |

#### Função Python de Sincronização

```python
def sincronizar_secao_8(pmo_id, dados_ia):
    """
    Sincroniza dados de insumos de fertilidade
    
    Args:
        pmo_id (int): ID do PMO no Supabase
        dados_ia (dict): Dados extraídos pelo Llama 3.3
    
    Returns:
        bool: True se sucesso
    """
    # 1. Validar campos obrigatórios
    if not dados_ia.get('produto') or not dados_ia.get('talhao_canteiro'):
        print("❌ Campos obrigatórios ausentes")
        return False
    
    # 2. Buscar form_data atual
    resp = supabase.table('pmos').select('form_data').eq('id', pmo_id).execute()
    form_data = resp.data[0].get('form_data') or {}
    
    # 3. Garantir estrutura
    if 'insumos_melhorar_fertilidade' not in form_data:
        form_data['insumos_melhorar_fertilidade'] = []
    
    # 4. Criar novo item
    novo_item = {
        "id": str(uuid.uuid4()),
        "produto_ou_manejo": dados_ia.get('produto', ''),
        "onde": dados_ia.get('talhao_canteiro', ''),
        "quando": dados_ia.get('data_registro', datetime.now().strftime('%Y-%m-%d')),
        "procedencia": dados_ia.get('procedencia', 'Externa'),
        "composicao": dados_ia.get('composicao', 'Não informada'),
        "marca": dados_ia.get('marca', 'Própria'),
        "dosagem": f"{dados_ia.get('quantidade_valor', '')} {dados_ia.get('quantidade_unidade', '')}".strip()
    }
    
    # 5. Adicionar ao array
    form_data['insumos_melhorar_fertilidade'].append(novo_item)
    
    # 6. Atualizar no Supabase
    supabase.table('pmos').update({'form_data': form_data}).eq('id', pmo_id).execute()
    
    return True
```

#### Componente React (Seção 8)

```jsx
function Secao8MUI({ data, formData, onSectionChange }) {
  // ✅ Buscar do nível raiz
  const insumosFertilidade = formData?.insumos_melhorar_fertilidade || [];
  
  return (
    <TabelaDinamicaMUI
      columns={[
        { header: 'Produto ou Manejo', key: 'produto_ou_manejo' },
        { header: 'Onde (em que cultura)', key: 'onde' },
        { header: 'Quando?', key: 'quando' },
        { header: 'Procedência', key: 'procedencia' },
        { header: 'Composição', key: 'composicao' },
        { header: 'Marca', key: 'marca' },
        { header: 'Dosagem', key: 'dosagem' }
      ]}
      data={insumosFertilidade}
      onDataChange={(newData) => onSectionChange({ 
        ...data, 
        insumos_melhorar_fertilidade: newData 
      })}
    />
  );
}
```

---

### 🌾 Seção 2: Produção Vegetal Orgânica

#### Localização
```
form_data.secao_2_atividades_produtivas_organicas.producao_primaria_vegetal.produtos_primaria_vegetal
```

#### Estrutura

```json
{
  "secao_2_atividades_produtivas_organicas": {
    "producao_primaria_vegetal": {
      "produtos_primaria_vegetal": [
        {
          "id": "new_1750536254819",
          "produto": "BETERRABA",
          "talhoes_canteiros": "10",
          "area_plantada": 0.5,
          "area_plantada_unidade": "ha",
          "producao_esperada_ano": 20,
          "producao_unidade": "ton"
        }
      ]
    },
    "producao_primaria_animal": {
      "animais_primaria_animal": []
    },
    "processamento_produtos_origem_vegetal": {
      "produtos_processamento_vegetal": []
    },
    "processamento_produtos_origem_animal": {
      "produtos_processamento_animal": []
    }
  }
}
```

#### Mapeamento de Campos (Python → React)

| Campo da IA | Chave no JSON | Tipo | Obrigatório | Validação |
|------------|---------------|------|-------------|-----------|
| `produto` | `produto` | string | ✅ Sim | Uppercase |
| `talhao` | `talhoes_canteiros` | string | ✅ Sim | - |
| `area` | `area_plantada` | float | ✅ Sim | > 0 |
| `unidade_area` | `area_plantada_unidade` | string | ✅ Sim | "ha", "m²", "alqueire" |
| `producao_anual` | `producao_esperada_ano` | float | ❌ Não | ≥ 0 |
| `unidade_producao` | `producao_unidade` | string | ❌ Não | "ton", "kg", "sc" |
| Auto-gerado | `id` | string | ✅ Sim | `new_{timestamp}` |

#### Função Python de Sincronização

```python
def sincronizar_secao_2_vegetal(pmo_id, dados_ia):
    """
    Sincroniza dados de produção vegetal orgânica
    
    Args:
        pmo_id (int): ID do PMO
        dados_ia (dict): Dados da IA com estrutura:
            {
                "produto": "TOMATE",
                "talhao": "Canteiro 5",
                "area": "100",
                "unidade_area": "m²",
                "producao_anual": "500",
                "unidade_producao": "kg"
            }
    """
    # Validação
    campos_obrigatorios = ['produto', 'talhao', 'area', 'unidade_area']
    if not all(dados_ia.get(campo) for campo in campos_obrigatorios):
        print("❌ Campos obrigatórios ausentes")
        return False
    
    # Buscar form_data
    resp = supabase.table('pmos').select('form_data').eq('id', pmo_id).execute()
    form_data = resp.data[0].get('form_data') or {}
    
    # Garantir estrutura aninhada
    if 'secao_2_atividades_produtivas_organicas' not in form_data:
        form_data['secao_2_atividades_produtivas_organicas'] = {}
    
    secao2 = form_data['secao_2_atividades_produtivas_organicas']
    
    if 'producao_primaria_vegetal' not in secao2:
        secao2['producao_primaria_vegetal'] = {}
    
    if 'produtos_primaria_vegetal' not in secao2['producao_primaria_vegetal']:
        secao2['producao_primaria_vegetal']['produtos_primaria_vegetal'] = []
    
    lista = secao2['producao_primaria_vegetal']['produtos_primaria_vegetal']
    
    # Criar novo produto
    novo_produto = {
        "id": f"new_{int(time.time() * 1000)}",
        "produto": dados_ia.get('produto', '').upper(),
        "talhoes_canteiros": dados_ia.get('talhao', ''),
        "area_plantada": float(dados_ia.get('area', 0)),
        "area_plantada_unidade": dados_ia.get('unidade_area', 'ha'),
        "producao_esperada_ano": float(dados_ia.get('producao_anual', 0)),
        "producao_unidade": dados_ia.get('unidade_producao', 'kg')
    }
    
    lista.append(novo_produto)
    
    # Atualizar no Supabase
    supabase.table('pmos').update({'form_data': form_data}).eq('id', pmo_id).execute()
    
    return True
```

---

## 🛠️ Log de Resoluções Críticas

### Bug #001: Dados Invisíveis na Seção 8
**Data:** 21/12/2024  
**Severidade:** 🔴 Crítica

**Sintoma:**  
Dados salvos com sucesso no backend não apareciam no frontend (tabela vazia).

**Causa Raiz:**  
- Backend Python salvava em: `form_data.insumos_melhorar_fertilidade` (raiz)
- Frontend React buscava em: `data.insumos_melhorar_fertilidade` onde `data = formData.secao_8_insumos_equipamentos` (vazio)

**Solução:**
1. **Backend:** Mantida a lógica de salvar na raiz (estrutura correta)
2. **Frontend:** Modificado `PmoFormPage.jsx` para passar prop `formData={formData}` completo
3. **Frontend:** Ajustado `Secao8_MUI.jsx` para buscar de `formData.insumos_melhorar_fertilidade`

**Arquivos Modificados:**
- `backend/sincronizar_secao_8.py` (validação)
- `frontend/src/pages/PmoFormPage.jsx` (linha 276)
- `frontend/src/components/PmoForm/Secao8_MUI.jsx` (linha 11, 47)

**Prevenção Futura:**
- ✅ Documentar estrutura esperada em ambos os lados
- ✅ Criar testes de integração backend → frontend
- ✅ Adicionar validação de estrutura no Python antes de salvar

---

## 📚 Convenções e Boas Práticas

### 1. Nomenclatura de Chaves

```javascript
// ✅ CORRETO
"produto_ou_manejo"       // Snake case, descritivo
"area_plantada_unidade"   // Sufixo indica tipo de dado

// ❌ EVITAR
"Produto"                 // PascalCase no JSON
"prod"                    // Abreviação ambígua
"area_unidade"            // Falta contexto (área de quê?)
```

### 2. Tipos de Dados

| Tipo | Formato | Exemplo | Validação |
|------|---------|---------|-----------|
| Data | `YYYY-MM-DD` | `"2024-12-21"` | ISO 8601 |
| Número | float/int | `12.5` ou `12` | Não usar strings |
| Booleano | `true`/`false` | `true` | Não usar `"true"` |
| Array vazio | `[]` | `[]` | Nunca `null` |
| UUID | v4 | `"550e8400-e29b-..."` | uuid.uuid4() |

### 3. Valores Padrão

```python
# ✅ BOM: Valores semânticos
procedencia = dados_ia.get('procedencia', 'Não informada')
marca = dados_ia.get('marca', 'Diversas')

# ❌ EVITAR: Strings vazias ou null
procedencia = dados_ia.get('procedencia', '')  # Frontend mostra vazio
```

### 4. IDs de Registro

```python
# Backend: UUID v4
import uuid
item_id = str(uuid.uuid4())  # "92421b47-32ff-4559-93de-941ae2694e53"

# Frontend: Timestamp
item_id = f"new_{int(time.time() * 1000)}"  # "new_1750536254819"
```

**Regra:** Backend gera UUIDs permanentes; Frontend gera IDs temporários com prefixo `new_`.

---

## 🧪 Testes de Validação

### Teste 1: Estrutura Básica

```python
def test_form_data_structure(form_data):
    """Valida estrutura mínima do form_data"""
    assert isinstance(form_data, dict)
    assert 'insumos_melhorar_fertilidade' in form_data
    assert isinstance(form_data['insumos_melhorar_fertilidade'], list)
    
    for item in form_data['insumos_melhorar_fertilidade']:
        assert 'id' in item
        assert 'produto_ou_manejo' in item
        assert 'onde' in item
```

### Teste 2: Sincronização Backend → Frontend

```python
def test_sincronizacao_secao_8():
    """Testa fluxo completo de sincronização"""
    dados_ia = {
        'produto': 'Adubo Verde',
        'talhao_canteiro': 'Talhão 3',
        'data_registro': '2024-12-21'
    }
    
    # Backend salva
    sucesso = sincronizar_secao_8(pmo_id=1, dados_ia=dados_ia)
    assert sucesso
    
    # Verificar no Supabase
    resp = supabase.table('pmos').select('form_data').eq('id', 1).execute()
    insumos = resp.data[0]['form_data']['insumos_melhorar_fertilidade']
    
    assert len(insumos) > 0
    assert insumos[-1]['produto_ou_manejo'] == 'Adubo Verde'
    assert insumos[-1]['onde'] == 'Talhão 3'
```

---

## 🔄 Migração de Dados (Se Necessário)

### Script de Migração: Mover Dados Aninhados para Raiz

```python
def migrar_insumos_para_raiz():
    """
    Move insumos de secao_8 para raiz do form_data
    Executar APENAS UMA VEZ
    """
    resp = supabase.table('pmos').select('id, form_data').execute()
    
    for pmo in resp.data:
        form_data = pmo['form_data']
        secao8 = form_data.get('secao_8_insumos_equipamentos', {})
        insumos_aninhados = secao8.get('insumos_melhorar_fertilidade', [])
        
        # Se existem dados aninhados e raiz está vazia
        if insumos_aninhados and not form_data.get('insumos_melhorar_fertilidade'):
            form_data['insumos_melhorar_fertilidade'] = insumos_aninhados
            
            # Atualizar
            supabase.table('pmos').update({
                'form_data': form_data
            }).eq('id', pmo['id']).execute()
            
            print(f"✅ Migrado PMO {pmo['id']}: {len(insumos_aninhados)} insumos")
```

---

## 📞 Suporte

**Dúvidas sobre estrutura de dados:**
- Consultar este documento primeiro
- Abrir issue no repositório com tag `[DATA-STRUCTURE]`
- Contatar equipe de backend/frontend conforme necessário

**Antes de modificar a estrutura:**
1. ⚠️ Discutir impacto com ambas as equipes (backend + frontend)
2. 📝 Atualizar este documento
3. 🧪 Criar testes de validação
4. 🔄 Planejar migração de dados existentes (se aplicável)

---

**Última revisão:** 21/12/2024  
**Próxima revisão:** A cada nova seção implementada