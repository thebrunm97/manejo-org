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
            <header style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h1>Plano de Manejo Orgânico</h1>
                <h2>{pmoData.nome_identificador}</h2>
            </header>
            <section>
                <h3>1. Descrição da Propriedade</h3>
                <hr />
                <h4>1.1 Dados Cadastrais</h4>
                <p><strong>Nome do Produtor:</strong> {dadosCadastrais.nome_produtor}</p>
                <p><strong>CPF:</strong> {dadosCadastrais.cpf}</p>
                <p><strong>Endereço:</strong> {dadosCadastrais.endereco_propriedade_base_fisica_produtiva}</p>
            </section>
            <footer style={{ position: 'fixed', bottom: 0, width: '100%', textAlign: 'center', fontSize: '12px' }}>
                <p>Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
            </footer>
        </div>
    );
};

export default PmoParaImpressao;
