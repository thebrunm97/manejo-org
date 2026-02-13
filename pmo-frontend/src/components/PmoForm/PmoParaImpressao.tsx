// src/components/PmoForm/PmoParaImpressao.tsx

import React from 'react';
import { Box, Button } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';

import { formatSmartTotal } from '../../utils/formatters';

// Types
interface DadosCadastrais {
    nome_produtor?: string;
    cpf_cnpj?: string;
    nome_propriedade?: string;
    logradouro?: string;
    municipio?: string;
    uf?: string;
    email?: string;
    telefone?: string;
}

interface ProdutoVegetal {
    produto?: string;
    producao_esperada_ano?: string | number;
    producao_unidade?: string;
    area_plantada?: string | number;
    area_plantada_unidade?: string;
    talhoes_canteiros?: any;
    localizacao?: any;
}

interface Animal {
    especie?: string;
    n_de_animais?: number;
    sistema_producao?: string;
    producao_esperada_ano?: string | number;
    producao_unidade?: string;
}

interface Insumo {
    insumo?: string;
    origem?: string;
    finalidade_uso?: string;
}

interface DadosPmo {
    secao_1_descricao_propriedade?: {
        dados_cadastrais?: DadosCadastrais;
    };
    secao_2_atividades_produtivas_organicas?: {
        producao_primaria_vegetal?: {
            produtos_primaria_vegetal?: ProdutoVegetal[];
        };
        producao_primaria_animal?: {
            animais_primaria_animal?: Animal[];
        };
    };
    secao_8_insumos_equipamentos?: {
        insumos_materiais?: {
            lista_insumos?: Insumo[];
        };
    };
}

interface PmoParaImpressaoProps {
    dadosPmo: DadosPmo | null;
    onClose?: () => void;
}

interface SimpleTableProps {
    title?: string;
    headers: string[];
    rows: (string | number | undefined)[][];
}

interface FieldValueProps {
    label: string;
    value?: string | number | null;
}

interface GroupedVegetal {
    displayName: string;
    producao: Record<string, number>;
    area: Record<string, number>;
    locaisAgrupados: Record<string, number>;
}

// Estilos Globais de Impressão
const PrintStyles: React.FC = () => (
    <style>{`
    @media print {
      @page {
        size: A4;
        margin: 10mm;
      }
      
      body * {
        visibility: hidden;
      }
      
      #area-impressao, #area-impressao * {
        visibility: visible;
      }
      
      #area-impressao {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        margin: 0;
        padding: 0;
        background: white;
        color: black;
        box-shadow: none !important;
      }

      .no-print {
        display: none !important;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 11px;
        font-family: 'Arial', sans-serif;
      }

      th, td {
        border: 1px solid #000;
        padding: 6px 8px;
        text-align: left;
        vertical-align: top;
      }

      th {
        background-color: #f0f0f0 !important;
        font-weight: bold;
        text-transform: uppercase;
        -webkit-print-color-adjust: exact;
      }

      h1, h2, h3, h4, h5, h6 {
        color: #000;
        margin-bottom: 10px;
        page-break-after: avoid;
      }

      .page-break {
        page-break-before: always;
      }
      
      .section-block {
        break-inside: avoid;
        margin-bottom: 25px;
      }
    }

    .print-preview-container {
      background-color: #525659;
      min-height: 100vh;
      padding: 40px 0;
      display: flex;
      justify-content: center;
    }

    .a4-page {
      background: white;
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      margin: 0 auto;
      box-sizing: border-box;
      position: relative;
    }
  `}</style>
);

// Componente Auxiliar de Tabela Simples
const SimpleTable: React.FC<SimpleTableProps> = ({ title, headers, rows }) => {
    if (!rows || rows.length === 0) return null;
    return (
        <div className="section-block">
            {title && <h3 style={{ fontSize: '14px', borderBottom: '2px solid black', paddingBottom: '4px', marginTop: '0' }}>{title}</h3>}
            <table>
                <thead>
                    <tr>
                        {headers.map((h, i) => <th key={i}>{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => <td key={j}>{cell}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// Componente Auxiliar de Campo Valor
const FieldValue: React.FC<FieldValueProps> = ({ label, value }) => (
    <div style={{ marginBottom: '5px', fontSize: '12px' }}>
        <strong>{label}:</strong> <span>{value || '-'}</span>
    </div>
);

const PmoParaImpressao: React.FC<PmoParaImpressaoProps> = ({ dadosPmo, onClose }) => {
    const handlePrint = () => {
        window.print();
    };

    if (!dadosPmo) return null;

    // --- Extração de Dados ---

    // 1. Dados Básicos
    const dadosCadastrais = dadosPmo.secao_1_descricao_propriedade?.dados_cadastrais || {};
    const endereco = `${dadosCadastrais.logradouro || ''}, ${dadosCadastrais.municipio || ''} - ${dadosCadastrais.uf || ''}`;

    // 2. Culturas (Agrupamento Inteligente + Soma de Unidades)
    const rawVegetais = dadosPmo.secao_2_atividades_produtivas_organicas?.producao_primaria_vegetal?.produtos_primaria_vegetal || [];

    // Agrupamento
    const groupedVegetais = rawVegetais.reduce<Record<string, GroupedVegetal>>((acc, item) => {
        const nameKey = (item.produto || '').trim().toUpperCase();
        if (!nameKey) return acc;

        if (!acc[nameKey]) {
            acc[nameKey] = {
                displayName: (item.produto || '').toUpperCase(),
                producao: {},
                area: {},
                locaisAgrupados: {}
            };
        }

        // Processar Produção
        const prodQtd = parseFloat((item.producao_esperada_ano || '').toString().replace(',', '.')) || 0;
        const prodUnit = item.producao_unidade || 'kg';
        acc[nameKey].producao[prodUnit] = (acc[nameKey].producao[prodUnit] || 0) + prodQtd;

        // Processar Área
        const areaQtd = parseFloat((item.area_plantada || '').toString().replace(',', '.')) || 0;
        const areaUnit = item.area_plantada_unidade || 'm²';
        acc[nameKey].area[areaUnit] = (acc[nameKey].area[areaUnit] || 0) + areaQtd;

        // --- LÓGICA DE EXTRAÇÃO DE LOCAL (AGRUPADA) ---
        const rawLocal = item.talhoes_canteiros || item.localizacao;
        let parentName = 'ÁREA GERAL';

        if (typeof rawLocal === 'string') {
            parentName = rawLocal;
        } else if (rawLocal && typeof rawLocal === 'object') {
            parentName = rawLocal.descricao?.talhao_nome ||
                rawLocal.talhao_nome ||
                rawLocal.label ||
                'ÁREA GERAL';
        }

        const parentKey = parentName.trim().toUpperCase();
        if (parentKey) {
            acc[nameKey].locaisAgrupados[parentKey] = (acc[nameKey].locaisAgrupados[parentKey] || 0) + 1;
        }

        return acc;
    }, {});

    // Função Auxiliar de Formatação (Smart Format Local)
    const formatSmartTotals = (totalsMap: Record<string, number>, type: 'peso' | 'area'): string => {
        return Object.entries(totalsMap).map(([unit, value]) => {
            const unitLower = (unit || '').toLowerCase();

            if (type === 'peso' && (unitLower === 'kg' || unitLower === 'kilograma') && value >= 1000) {
                return `${(value / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} ton`;
            }

            if (type === 'area' && (unitLower === 'm²' || unitLower === 'm2') && value >= 100) {
                return `${(value / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 4 })} ha`;
            }

            return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${unit}`;
        }).join(' + ');
    };

    const linhasProdutos = Object.values(groupedVegetais).map(group => {
        const locais = Object.entries(group.locaisAgrupados)
            .map(([nome, qtd]) => `${nome} (${qtd})`)
            .join(', ');

        const areaTotal = formatSmartTotals(group.area, 'area');
        const producaoTotal = formatSmartTotals(group.producao, 'peso');

        return [group.displayName, locais, areaTotal, producaoTotal];
    });

    // 3. Animais
    const animais = dadosPmo.secao_2_atividades_produtivas_organicas?.producao_primaria_animal?.animais_primaria_animal || [];

    const linhasAnimais = animais.map(a => {
        const producao = formatSmartTotal([a], 'producao_esperada_ano', 'producao_unidade');
        return [
            a.especie,
            a.n_de_animais,
            a.sistema_producao,
            producao
        ];
    });

    // 4. Insumos (Seção 8)
    const insumos = dadosPmo.secao_8_insumos_equipamentos?.insumos_materiais?.lista_insumos || [];
    const linhasInsumos = insumos.map(i => [i.insumo, i.origem, i.finalidade_uso]);

    // Data atual
    const dataImpressao = new Date().toLocaleDateString('pt-BR');

    return (
        <Box className="print-preview-container">
            <PrintStyles />

            {/* Botões Flutuantes (Não Impressos) */}
            <Box sx={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', gap: 2 }} className="no-print">
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<PrintIcon />}
                    onClick={handlePrint}
                    sx={{ boxShadow: 4 }}
                >
                    Imprimir / Salvar PDF
                </Button>
                {onClose && (
                    <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<CloseIcon />}
                        onClick={onClose}
                        sx={{ boxShadow: 4 }}
                    >
                        Fechar
                    </Button>
                )}
            </Box>

            {/* Área da Folha A4 */}
            <div id="area-impressao" className="a4-page">
                {/* Cabeçalho */}
                <header style={{ borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', margin: 0, textTransform: 'uppercase' }}>Plano de Manejo Orgânico</h1>
                        <p style={{ margin: '5px 0 0 0', fontSize: '12px' }}>Relatório Técnico Completo</p>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '12px' }}>
                        <strong>Data de Emissão:</strong> {dataImpressao}<br />
                        <strong>Vigência:</strong> Indeterminada
                    </div>
                </header>

                {/* 1. Identificação */}
                <div className="section-block">
                    <h2 style={{ fontSize: '16px', backgroundColor: '#e0e0e0', padding: '5px', border: '1px solid black', margin: '0 0 10px 0' }}>1. IDENTIFICAÇÃO</h2>
                    <table style={{ width: '100%' }}>
                        <tbody>
                            <tr>
                                <td width="20%" style={{ background: '#f9f9f9' }}><strong>Produtor:</strong></td>
                                <td width="30%">{dadosCadastrais.nome_produtor || ''}</td>
                                <td width="20%" style={{ background: '#f9f9f9' }}><strong>CPF/CNPJ:</strong></td>
                                <td width="30%">{dadosCadastrais.cpf_cnpj || ''}</td>
                            </tr>
                            <tr>
                                <td style={{ background: '#f9f9f9' }}><strong>Propriedade:</strong></td>
                                <td>{dadosCadastrais.nome_propriedade || ''}</td>
                                <td style={{ background: '#f9f9f9' }}><strong>Localização:</strong></td>
                                <td>{endereco}</td>
                            </tr>
                            <tr>
                                <td style={{ background: '#f9f9f9' }}><strong>Email:</strong></td>
                                <td>{dadosCadastrais.email || ''}</td>
                                <td style={{ background: '#f9f9f9' }}><strong>Telefone:</strong></td>
                                <td>{dadosCadastrais.telefone || ''}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 2. Produtos Vegetais (Agrupado) */}
                {linhasProdutos.length > 0 && (
                    <div className="section-block">
                        <h2 style={{ fontSize: '16px', backgroundColor: '#e0e0e0', padding: '5px', border: '1px solid black', margin: '0 0 10px 0' }}>2. PRODUÇÃO VEGETAL ORGÂNICA</h2>
                        <SimpleTable
                            headers={['Cultura/Produto', 'Localização(ões)', 'Área Total', 'Est. Produção (Ano)']}
                            rows={linhasProdutos}
                        />
                    </div>
                )}

                {/* 3. Produção Animal */}
                {linhasAnimais.length > 0 && (
                    <div className="section-block">
                        <h2 style={{ fontSize: '16px', backgroundColor: '#e0e0e0', padding: '5px', border: '1px solid black', margin: '0 0 10px 0' }}>3. PRODUÇÃO ANIMAL ORGÂNICA</h2>
                        <SimpleTable
                            headers={['Espécie', 'Nº Animais', 'Sistema de Produção', 'Est. Produção (Ano)']}
                            rows={linhasAnimais}
                        />
                    </div>
                )}

                {/* 4. Insumos */}
                {linhasInsumos.length > 0 && (
                    <div className="section-block">
                        <h2 style={{ fontSize: '16px', backgroundColor: '#e0e0e0', padding: '5px', border: '1px solid black', margin: '0 0 10px 0' }}>4. INSUMOS EXTERNOS</h2>
                        <SimpleTable
                            headers={['Insumo', 'Origem', 'Finalidade']}
                            rows={linhasInsumos}
                        />
                    </div>
                )}

                {/* Rodapé do Relatório */}
                <div style={{ marginTop: '50px', borderTop: '1px solid black', paddingTop: '10px', fontSize: '10px', textAlign: 'center' }}>
                    <p>Este documento é parte integrante do Plano de Manejo Orgânico. Gerado via Sistema {import.meta.env.VITE_APP_NAME}.</p>
                </div>
            </div>
        </Box>
    );
};

export default PmoParaImpressao;
