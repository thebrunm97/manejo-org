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
        version: "0.5.0",
        date: "Fevereiro 2026",
        title: "IA e Facilidade no WhatsApp",
        description: "Melhoramos a conversa com a Inteligência Artificial e o seu painel.",
        sections: [
            {
                type: "New",
                items: [
                    "Painel inicial com dicas automáticas sobre o seu manejo.",
                    "Assistente de boas-vindas e suporte direto pelo WhatsApp.",
                    "Ferramenta para ajustar os Planos de Manejo sugeridos pela IA."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "As respostas da IA estão mais rápidas e diretas.",
                    "O sistema entende melhor datas e áudios enviados no WhatsApp."
                ]
            }
        ]
    },
    {
        version: "0.4.0",
        date: "Janeiro 2026",
        title: "Rastreabilidade e Organização",
        description: "Agora você pode controlar melhor a origem dos seus produtos.",
        sections: [
            {
                type: "New",
                items: [
                    "Novo módulo para rastrear lotes e colheitas.",
                    "Possibilidade de gerenciar tudo pelo chat, sem abrir o computador.",
                    "Segurança reforçada para guardar seus comprovantes e fotos."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Ficou mais fácil registrar atividades manuais do dia a dia.",
                    "As telas do sistema carregam mais rápido no celular."
                ]
            }
        ]
    },
    {
        version: "0.3.0",
        date: "Dezembro 2025",
        title: "Novo Visual",
        description: "Uma cara nova para facilitar o seu trabalho.",
        sections: [
            {
                type: "New",
                items: [
                    "Visual renovado, mais limpo e fácil de ler no sol.",
                    "Menu lateral organizado para achar as funções mais rápido.",
                    "Cadastro da propriedade simplificado (menos cliques)."
                ]
            }
        ]
    },
    {
        version: "0.2.0",
        date: "Novembro 2025",
        title: "Estabilidade e Segurança",
        description: "Ajustes para o sistema crescer com segurança.",
        sections: [
            {
                type: "Improvements",
                items: [
                    "O sistema está mais estável e não cai durante o uso.",
                    "Correção de pequenos erros na criação de planos duplicados.",
                    "Melhoria na visualização em celulares pequenos."
                ]
            }
        ]
    },
    {
        version: "0.1.0",
        date: "Outubro 2025",
        title: "O Início",
        description: "Lançamento do Manejo Orgânico.",
        sections: [
            {
                type: "New",
                items: [
                    "Lançamento oficial da plataforma.",
                    "Caderno de Campo Digital (adeus papel!).",
                    "Primeira versão da Inteligência Artificial auxiliar."
                ]
            }
        ]
    }
];
