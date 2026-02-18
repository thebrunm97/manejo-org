// src/pages/PmoParaImpressao.tsx

import React from 'react';

interface DadosCadastrais {
    nome_produtor?: string;
    cpf?: string;
    endereco_propriedade_base_fisica_produtiva?: string;
}

interface FormData {
    secao_1_descricao_propriedade?: {
        dados_cadastrais?: DadosCadastrais;
    };
}

interface PmoData {
    nome_identificador: string;
    form_data?: FormData;
}

interface PmoParaImpressaoProps {
    pmoData?: PmoData | null;
}

const PmoParaImpressao: React.FC<PmoParaImpressaoProps> = ({ pmoData }) => {
    if (!pmoData) return null;

    const dadosCadastrais = pmoData.form_data?.secao_1_descricao_propriedade?.dados_cadastrais || {};

    return (
        <div className="only-print">
            <style>
                {`
                    @media print {
                        @page { size: A4; margin: 20mm; }
                        body { font-family: 'Times New Roman', serif; color: #000; }
                        .no-print { display: none !important; }
                        .only-print { display: block !important; }
                        h1 { font-size: 18pt; text-transform: uppercase; text-align: center; margin-bottom: 5mm; }
                        h2 { font-size: 14pt; text-align: center; margin-bottom: 10mm; font-weight: normal; }
                        h3 { font-size: 12pt; border-bottom: 1px solid #000; margin-top: 10mm; padding-bottom: 2mm; }
                        p, li { font-size: 11pt; line-height: 1.5; text-align: justify; }
                        .footer {
                            position: fixed;
                            bottom: 0;
                            left: 0;
                            right: 0;
                            text-align: center;
                            font-size: 9pt;
                            color: #666;
                            border-top: 1px solid #ccc;
                            padding-top: 2mm;
                        }
                        .viral-seal {
                            font-weight: bold;
                            color: #2e7d32;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 5px;
                        }
                    }
                `}
            </style>

            <header>
                <h1>Plano de Manejo Orgânico</h1>
                <h2>{pmoData.nome_identificador}</h2>
            </header>

            <main>
                <section>
                    <h3>1. Identificação do Produtor e da Propriedade</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10mm' }}>
                        <div>
                            <p><strong>Nome:</strong> {dadosCadastrais.nome_produtor || '_______________________'}</p>
                            <p><strong>CPF:</strong> {dadosCadastrais.cpf || '_______________________'}</p>
                        </div>
                        <div>
                            <p><strong>Endereço:</strong> {dadosCadastrais.endereco_propriedade_base_fisica_produtiva || '_______________________'}</p>
                        </div>
                    </div>
                </section>

                {/* Placeholder para outras seções - Expansão Futura */}
                <section>
                    <p><em>... Demais seções do PMO conforme Lei 10.831 ...</em></p>
                </section>
            </main>

            <footer className="footer">
                <div className="viral-seal">
                    <span>🌿 Tecnologia ManejoORG</span>
                </div>
                <p>Gerado em: {new Date().toLocaleDateString('pt-BR')} • Página 1/1</p>
            </footer>
        </div>
    );
};

export default PmoParaImpressao;
