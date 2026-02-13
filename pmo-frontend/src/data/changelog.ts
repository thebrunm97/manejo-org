export interface ChangelogEntry {
    version: string;
    date: string;
    title: string;
    description: string;
    sections: {
        type: 'Improvements' | 'Fixes' | 'Patches' | 'New';
        items: string[];
    }[];
}

export const changelogData: ChangelogEntry[] = [
    {
        version: "0.6.0-dev",
        date: "12 de Fevereiro, 2026",
        title: "Precisão e Inteligência de Campo",
        description: "Grandes melhorias na inteligência do Assistente WhatsApp e na visualização de dados no Painel.",
        sections: [
            {
                type: "New",
                items: [
                    "Suporte a múltiplos locais simultâneos no WhatsApp (ex: \"Canteiros 1 e 2\").",
                    "Ícones e cores dinâmicas no Dashboard para Plantio, Manejo e Colheita.",
                    "Histórico completo da conversa salvo nos detalhes do registro."
                ]
            },
            {
                type: "Fixes",
                items: [
                    "Correção na distinção entre quantidade (50 mudas) e local (Canteiro 5).",
                    "Bloqueio de mensagens antigas (spam) ao reconectar o servidor."
                ]
            }
        ]
    },
    {
        version: "0.5.0",
        date: "26 de Janeiro, 2026",
        title: "IA e Experiência do Usuário — MVP Release Candidate",
        description: "Foco total em melhorar sua interação com nossa Inteligência Artificial e o painel de controle.",
        sections: [
            {
                type: "New",
                items: [
                    "Painel inteligente com sugestões automáticas e detalhes aprofundados.",
                    "Novo assistente de boas-vindas e suporte a dúvidas via WhatsApp.",
                    "Ferramenta de refinamento para ajustar os Planos de Manejo sugeridos.",
                    "Histórico de estimativas agronômicas e uso do sistema."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Respostas da Inteligência Artificial mais rápidas e precisas.",
                    "Melhorias na visualização de registros e logs."
                ]
            },
            {
                type: "Fixes",
                items: [
                    "Ajustes na estabilidade da conexão com WhatsApp.",
                    "Correções na validação de mensagens e comandos."
                ]
            }
        ]
    },
    {
        version: "0.4.0",
        date: "23 de Janeiro, 2026",
        title: "Rastreabilidade e Integração",
        description: "Expansão das capacidades de gestão e conexão completa com o WhatsApp.",
        sections: [
            {
                type: "New",
                items: [
                    "Integração completa com WhatsApp: gerencie tudo pelo chat.",
                    "Novo módulo de Rastreabilidade de Lotes e unidades complexas.",
                    "IA aprimorada para entender datas e contextos específicos nas conversas.",
                    "Maior segurança no armazenamento de comprovantes e documentos."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Janelas e diálogos do sistema modernizados para facilitar o uso.",
                    "Registro manual de atividades simplificado e mais intuitivo.",
                    "Carregamento mais rápido das informações da propriedade."
                ]
            },
            {
                type: "Fixes",
                items: [
                    "Correção na criação de planos duplicados.",
                    "Ajustes visuais na barra lateral e menus de navegação."
                ]
            }
        ]
    },
    {
        version: "0.3.0",
        date: "19 de Janeiro, 2026",
        title: "Bases da Rastreabilidade",
        description: "Atualizações fundamentais para suportar o novo crescimento da plataforma.",
        sections: [
            {
                type: "Improvements",
                items: [
                    "Otimizações de segurança e estabilidade geral do sistema.",
                    "Preparo da infraestrutura para o novo módulo de rastreio."
                ]
            }
        ]
    },
    {
        version: "0.2.0",
        date: "13 de Janeiro, 2026",
        title: "Nova Identidade Visual",
        description: "Uma interface renovada para tornar seu trabalho mais agradável e eficiente.",
        sections: [
            {
                type: "New",
                items: [
                    "Interface completamente renovada e mais limpa.",
                    "Gestão de Propriedade reorganizada para facilitar o cadastro.",
                    "Navegação mais fluida entre as telas com novo menu lateral."
                ]
            },
            {
                type: "Fixes",
                items: [
                    "Ajustes gerais de layout em dispositivos móveis.",
                    "Correções no carregamento inicial da aplicação."
                ]
            }
        ]
    },
    {
        version: "0.1.0",
        date: "06 de Outubro, 2025",
        title: "Lançamento Oficial",
        description: "O início da jornada do Manejo Orgânico.",
        sections: [
            {
                type: "New",
                items: [
                    "Lançamento da plataforma de gestão para produtores orgânicos.",
                    "Caderno de Campo Digital integrado.",
                    "Primeira versão do assistente de IA."
                ]
            }
        ]
    }
];
