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
        version: "0.6.1",
        date: "26 de Fevereiro de 2026",
        title: "O Doutor Agrônomo e o Painel Mais Rápido",
        description: "Bem-vindo à v0.6.1! O bot ficou mais inteligente com leitura de cartilhas orgânicas, o painel voa ao trocar de abas e agora você sabe se o WhatsApp está conectado em tempo real.",
        sections: [
            {
                type: "New",
                items: [
                    "Bot Mais Inteligente (O Doutor Agrônomo): Ensinámos o nosso assistente a ler cartilhas orgânicas e normativas do MAPA para responder melhor às suas dúvidas.",
                    "Nova Aba \"Base de Conhecimento\": Adicionámos um painel para ver quais documentos o bot já leu e seus resumos.",
                    "Monitor de Saúde do Bot: Novo indicador em tempo real para saber se o bot do WhatsApp está online e conectado."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Painel Mais Rápido: Corrigimos o recarregamento visual ao trocar de abas. Agora o painel voa!",
                    "Carregamento do Painel de Administração corrigido — sem mais spinner infinito ao entrar na página."
                ]
            }
        ]
    },
    {
        version: "0.6.0",
        date: "25 de Fevereiro de 2026",
        title: "Gestão Total e Rastreabilidade",
        description: "O maior avanço do Manejo Orgânico. Rastreabilidade completa, conversas mais inteligentes no WhatsApp e um sistema redesenhado do zero para ser super rápido no seu celular.",
        sections: [
            {
                type: "New",
                items: [
                    "Novo Módulo de Gestão da Propriedade (Croqui Digital) para organizar talhões e canteiros.",
                    "Calculadora automática de textura e saúde do solo direto no painel.",
                    "Sistema de rastreabilidade passo a passo para a origem detalhada dos seus lotes.",
                    "Adequação automática às normas do IMA com nova seleção múltipla de culturas e flexibilidade de datas."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Sistema mais leve e rápido para celulares no campo (migração total de design).",
                    "Tabelas agora se transformam em cartões expansíveis para leitura fácil na tela do celular.",
                    "A inteligência artificial no WhatsApp entende melhor suas dúvidas técnicas e os planos de safra.",
                    "Correção de pequenos travamentos ao preencher os 19 formulários do Plano de Manejo.",
                    "Suporte no cadastro para informar as medidas exatas (largura e comprimento) dos canteiros."
                ]
            }
        ]
    },
    {
        version: "0.5.1",
        date: "20 de Fevereiro de 2026",
        title: "O Aplicativo Mais Rápido e Inteligente da Roça",
        description: "Novo visual, preenchimento de formulários incrivelmente rápido e sistema que se adapta perfeitamente a qualquer tamanho de celular, mesmo com a internet oscilando.",
        sections: [
            {
                type: "New",
                items: [
                    "Visual mais limpo e fácil de ler no celular mesmo debaixo de sol forte.",
                    "Formulários de Plano de Manejo mais inteligentes que se adaptam às suas respostas, diminuindo drasticamente a quantidade de cliques e digitação."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Sistema construído para ser muito mais leve e rápido, ideal para o uso do dia a dia no campo com internet 3G.",
                    "O preenchimento de todas as 19 seções do Plano de Manejo ficou mais ágil e focado na sua resposta direta.",
                    "Diário de Campo muito mais intuitivo para registrar insumos e atividades direto da roça.",
                    "Alertas de regras Orgânicas agora aparecem apenas quando você deseja, liberando o espaço valioso na tela do seu celular.",
                    "Painel inicial com novas caixinhas e botões, organizando e destacando o que realmente importa para a gestão da fazenda."
                ]
            }
        ]
    },
    {
        version: "0.5.0",
        date: "28 de Janeiro de 2026",
        title: "Inteligência e Agilidade no WhatsApp",
        description: "O seu assistente no WhatsApp ficou muito mais esperto, rápido e confiável para te dar suporte no meio da lida.",
        sections: [
            {
                type: "New",
                items: [
                    "Inteligência artificial fortalecida, capaz de entender dúvidas difíceis e te ajudar na instalação e uso da ferramenta.",
                    "A inteligência agora consegue separar se a sua dúvida é de planejamento de longo prazo da safra ou um aviso do dia a dia, te entregando a orientação exata.",
                    "Novo quadro de informações na internet para apresentar as vantagens do Manejo Orgânico de maneira rápida para outros produtores."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Nova fundação tecnológica garantindo segurança extra no WhatsApp; o sistema não cai mais e as respostas para seus áudios chegam de prontidão.",
                    "Resolvido o corte no envio das respostas mais compridas ou listas enviadas pela inteligência artificial."
                ]
            }
        ]
    },
    {
        version: "0.4.0",
        date: "23 de Janeiro de 2026",
        title: "Gestão Firme da Produção",
        description: "Mais organização e rastreamento da sua produção orgânica para ajudar você a fechar bons negócios com segurança.",
        sections: [
            {
                type: "New",
                items: [
                    "Sistema inteligente para rastrear cada lote de colheita, garantindo facilidade para registrar as unidades maiores de produção.",
                    "Novos botões de preenchimento automático que sugam o horário e as datas do seu celular para te poupar trabalho na hora do intervalo.",
                    "Acesso mais fácil para consultar avisos novos e dicas rápidas do sistema de maneira simples."
                ]
            }
        ]
    },
    {
        version: "0.3.0",
        date: "7 de Janeiro de 2026",
        title: "O Seu Croqui Digital",
        description: "Toda a organização da sua propriedade, dos canteiros soltos ao curral, cabe agora na palma da sua mão - e o sistema faz cálculos agrários por você.",
        sections: [
            {
                type: "New",
                items: [
                    "Painel inovador do 'Croqui Digital' desenhado para guardar informações de onde, qual tamanho e quanto há dentro dos talhões ou piquetes.",
                    "Botão que permite criar mais de 10, 50 ou 100 canteiros / linhas seguidas com apenas alguns poucos cliques rápidos.",
                    "Calculadora inteligente e automatizada para a saúde do solo, cruzando dados de textura da terra e apontando na hora a recomendação do plantio."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Caixinhas de opções mais agradáveis que dão menos problemas se o dedo clicar do lado sem querer.",
                    "Menus de navegação laterais e internos mais visíveis e limpos, tirando o medo de se perder no sistema."
                ]
            }
        ]
    },
    {
        version: "0.2.0",
        date: "21 de Dezembro de 2025",
        title: "Caderno de Campo Embutido",
        description: "Adeus ao preenchedor de papel debaixo do sol do meio dia. Os seus registros foram os mais beneficiados aqui.",
        sections: [
            {
                type: "Improvements",
                items: [
                    "Acesso no topo da tela do seu celular para pular o papo furado e ir certinho onde você registra as horas da mão de obra sem delongas.",
                    "As informações da produção registradas pelos seus trabalhadores estão muito mais legíveis e amplas nos detalhes técnicos."
                ]
            }
        ]
    },
    {
        version: "0.1.0",
        date: "6 de Outubro de 2025",
        title: "A Semente Virou Broto",
        description: "Demos a cavada inicial neste projeto feito por pessoas orgânicas a favor das terras orgânicas.",
        sections: [
            {
                type: "New",
                items: [
                    "Criação e construção da base de segurança super forte para dar total tranquilidade de que somente você tem acesso aos dados da propriedade.",
                    "As bases e as lógicas rascunhadas no papel ganham as telas seguras do celular para começar o fim das papeladas das cooperativas e prefeituras."
                ]
            }
        ]
    }
];
