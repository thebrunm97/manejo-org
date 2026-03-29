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
        version: "0.13.0",
        date: "28 de Março de 2026",
        title: "Tudo Salvo Sem Perigo de Erro",
        description: "Demos um trato no coração do aplicativo pra garantir que tudo que você anota vá pro lugar certinho, sem perder uma folha caduca sequer.",
        sections: [
            {
                type: "New",
                items: [
                    "Caderno Mais Esperto: Agora, ao falar dos seus talhões ou compras, o sistema liga os pontos sozinho lá no fundo da gaveta dele sem dar nó cego.",
                    "Anotou, Tá Guardado: Mudamos a engrenagem do sistema. Agora ou ele salva tudo bonitinho de uma vez, ou nem começa, evitando rascunho furado na hora da auditoria."
                ]
            }
        ]
    },
    {
        version: "0.12.0",
        date: "27 de Março de 2026",
        title: "Um Assistente Que Sabe das Coisas",
        description: "O WhatsApp ficou bem mais ligeiro. É como se a gente puxasse dois peões novos: um de olho no manual pra te ajudar com as pragas e outro só na lida do preenchimento da safra.",
        sections: [
            {
                type: "New",
                items: [
                    "Mestre de Obras no Zap: O assistente separa rapidinho quem quer tirar dúvida da norma orgânica de quem tá ali só pra dar a baixa no plantio do dia, atendendo cada um na medida certa.",
                    "Texto Mais Ajeitado: As mensagens que a gente manda no Zap do celular ficaram muito mais amigáveis e fáceis de ler.",
                    "Sem Bater a Cabeça: Colocamos uma mola nova no motor pro assistente não ficar travando ou rodando em círculo na hora de te responder."
                ]
            }
        ]
    },
    {
        version: "0.9.0",
        date: "26 de Março de 2026",
        title: "Mapa da Fazenda na Palma da Mão",
        description: "Agora você é o dono do seu mapa! Desenhe suas roças e talhões do jeito que eles realmente são e use as cores que preferir para organizar cada plantio.",
        sections: [
            {
                type: "New",
                items: [
                    "Desenho de Talhões do Seu Jeito: Uma ferramenta fácil pra você riscar os limites da sua terra, igualzinho como é na vida real.",
                    "Cores para Organizar a Roça: Pinte cada talhão de uma cor diferente pra bater o olho e já saber onde está cada plantio.",
                    "O Assistente Lê Seus Manuais: Sabe aquela cartilha em PDF? Mande pro assistente no WhatsApp e ele lê pra tirar suas dúvidas na hora!"
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Pintou no Painel, Apareceu no Mapa: Mudou a cor do talhão? Na mesma hora o mapa já mostra a cor nova, sem complicação.",
                    "Assistente Mais Ligeiro: Demos uma recauchutada no motor do assistente pra ele nunca te deixar na mão quando você mandar um áudio da roça.",
                    "Transição Suave no Mapa: Melhoramos a troca entre a tela de ver o mapa e a tela de desenhar, ficando bem mais fácil de usar."
                ]
            }
        ]
    },
    {
        version: "0.8.0",
        date: "20 de Março de 2026",
        title: "Segurança de Cofre e Registros Mais Rápidos",
        description: "Deixamos o sistema blindado pra proteger seus dados e arrumamos a casa pra facilitar a sua vida na hora de anotar o manejo.",
        sections: [
            {
                type: "New",
                items: [
                    "Anotações pelo Zap: Agora dá pra avisar o assistente sobre as limpezas no galpão ou o uso de sementes só mandando um áudio.",
                    "Caderno Mais Arrumado: Separamos o caderno do computador em abas (Plantio, Manejo, Colheita). Ficou limpo e gostoso de usar.",
                    "Aviso de Esquecimento: Se você for fechar o aplicativo sem salvar, a gente te avisa pra não perder o trabalho feito."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Dados Trancados a Chave: As informações da sua colheita agora têm segurança de primeira, exclusiva pra sua conta.",
                    "O Assistente Agora é Polvo: O bot do WhatsApp consegue atender vários produtores ao mesmo tempo sem embolar a conversa."
                ]
            }
        ]
    },
    {
        version: "0.7.0",
        date: "10 de Março de 2026",
        title: "Um Assistente que Lembra das Coisas",
        description: "Seu Parceiro Orgânico ficou mais sabido. Agora ele tem boa memória e sabe perguntar o que falta pra não errar no registro.",
        sections: [
            {
                type: "New",
                items: [
                    "Memória Boa: Começou a anotar um plantio e teve que parar pra acudir a roça? Quando voltar, ele lembra de onde a conversa parou.",
                    "Conversa de Compadre: Se você esquecer de falar a quantidade de adubo, o assistente pergunta de forma educada pra completar a anotação.",
                    "Doutor das Cartilhas: O assistente consulta os manuais técnicos na hora pra te dar a resposta certa sobre pragas e adubos naturais."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Ouvido Afinado: O assistente agora entende melhor o sotaque e o jeito que a gente fala no nosso dia a dia no campo."
                ]
            }
        ]
    },
    {
        version: "0.6.1",
        date: "26 de Fevereiro de 2026",
        title: "O Doutor Agrônomo Chegou",
        description: "O assistente leu as regras orgânicas pra te ajudar melhor. Além disso, o sistema no celular tá voando baixo!",
        sections: [
            {
                type: "New",
                items: [
                    "Conselheiro de Ouro: Ensinamos o assistente a consultar as normas orgânicas e do MAPA pra tirar suas dúvidas com segurança.",
                    "Biblioteca da Fazenda: Um cantinho novo no painel pra você ver de onde o assistente tá tirando as informações dele.",
                    "Luzinha de Funcionamento: Uma luz nova que te fala na hora se o sistema do WhatsApp está ligado e pronto pra te atender."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Painel Mais Rápido: Trocar de página no sistema agora tá rápido como um raio, sem ficar recarregando à toa.",
                    "Entrada Direta: Evitamos aquele problema da tela de carregamento que não destravava de jeito nenhum."
                ]
            }
        ]
    },
    {
        version: "0.6.0",
        date: "25 de Fevereiro de 2026",
        title: "A Revolução do Caderno de Campo",
        description: "O maior salto que já demos! Rastreio de ponta a ponta e um sistema novinho que não pesa nada no seu celular.",
        sections: [
            {
                type: "New",
                items: [
                    "O Mapa da Mina: Um painel digital pra você desenhar e organizar todos os canteiros e talhões da propriedade de forma fácil.",
                    "Doutor do Solo: Uma calculadora que pega o tipo da sua terra e já receita o que precisa pra melhorar a saúde dela.",
                    "Rastreio Garantido: Agora você sabe certinho de onde veio cada produto da sua colheita, passo a passo.",
                    "Sempre em Dia (IMA): O sistema já se ajeita pras regras dos fiscais, permitindo escolher várias culturas de uma vez e acertar as datas."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Leve Igual Pluma: O aplicativo foi feito de novo pra rodar liso no celular, mesmo na roça sem muita internet.",
                    "Leitura Clara: As planilhas grandes viraram cartõezinhos que cabem inteiros na telinha do celular.",
                    "Dúvidas Bem Respondidas: O WhatsApp agora entende as necessidades de safra mais pesadas de responder.",
                    "Caderno Sem Trava: Tiramos aqueles engasgos na hora de preencher os formulários gigantes do plano de manejo.",
                    "Na Fita Métrica: Agora o sistema deixa colocar as medidas bem em cima do esperado (largura e comprimento) do canteiro."
                ]
            }
        ]
    },
    {
        version: "0.5.1",
        date: "20 de Fevereiro de 2026",
        title: "O Companheiro Mais Ligeiro da Roça",
        description: "Roupa nova e um sistema mais esperto, que te ajuda a preencher o caderno num instante, mesmo com internet caindo.",
        sections: [
            {
                type: "New",
                items: [
                    "Tela Limpa ao Sol: Melhoramos as cores pra você conseguir ler direitinho no celular até naquele sol de rachar mamona.",
                    "Caderno Inteligente: Os formulários agora se lembram das respostas que cruzam dados, cortando aquele tanto de digitação chata."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Rápido no 3G: O sistema tá no jeito pra não te deixar na mão se a internet oscilar lá na ponta do pasto.",
                    "Caminho Simples: Matar os 19 relatórios do Plano de Manejo agora é focado e mais limpo.",
                    "Diário na Mão: Lançar os insumos e atividades não tem mais barreira; é direto no foco.",
                    "Avisos Mais Mansos: Aqueles alertas grandões das regras orgânicas só saltam do lado se você quiser, liberando tela.",
                    "A Cadeira do Patrão: Tela inicial limpa com botões e quadrinhos pro que mais pede a sua atenção primeiro."
                ]
            }
        ]
    },
    {
        version: "0.5.0",
        date: "28 de Janeiro de 2026",
        title: "Zap Inteligente e Confiança no Trabalho",
        description: "Seu assistente de vendas e manejos no Zap ganhou força nova. É papo reto e muita ajuda, a qualquer hora.",
        sections: [
            {
                type: "New",
                items: [
                    "Mais Esperteza: A inteligência dobrou a aposta; tira dúvida pesada e ainda te ajuda nas voltas do uso do sistema.",
                    "Dúvidas Separadas: Sabe se organizar quando é recado pra registrar amanhã ou planejamento longo pro ano, entregando a saída boa pra cada lado.",
                    "Vitrine do Saber: Quadro pras informações sobre ser Manejo Orgânico, daquelas boas pra apresentar o modelo para os parceiros na rede."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "A Roda Não Para: A máquina da zap zap tá mais pesada de fundação agora, não sofre as caídas e as mensagens longas e de áudios chegam de sopetão.",
                    "Fim das Fatiadas: Lista comprida e textão das respostas da Inteligência agora vai inteiro, nada de quebrar."
                ]
            }
        ]
    },
    {
        version: "0.4.0",
        date: "23 de Janeiro de 2026",
        title: "Mão Firme na Trilha da Colheita",
        description: "Uma ajudinha extra e organizada com rastreabilidade pra você chegar do corte às feiras ou lojas só no sossego.",
        sections: [
            {
                type: "New",
                items: [
                    "Olho no Lote: A tecnologia nova que segue cada leva pra você ter na ponta o acompanhamento forte dos orgânicos nas prateleiras.",
                    "Preenchimento Mágica: Horários que grudam automaticamente pros trabalhos poucando dedo doendo na hora na pausa pra água gela.",
                    "Quadro de Bom Dia: Cantão próprio das dicas certas do aplicativo onde chegam as lições novas numa boa pros olhos passear."
                ]
            }
        ]
    },
    {
        version: "0.3.0",
        date: "7 de Janeiro de 2026",
        title: "O Seu Terreiro Na Palma da Mão",
        description: "Cuidado e anotações dos chãos, pedacinhos e pastos virou mapa inteligente com conta que a máquina mesmo faz.",
        sections: [
            {
                type: "New",
                items: [
                    "Pincel Mágico: Uma tela de traçados do 'Croqui Digital' focada no que tem o que debaixo de cada centímetro medido e alinhado dos seus talhões e piquetes.",
                    "Cem Linhas Num Piscar: Botões pros criadores de fileiras, espalhando os canteiros de punhado no clique invés de picotar.",
                    "Medidor do Solo: Uma conta sabida que faz de bate o estalo do trato de terra de primeira baseado só pelo cisco e a cor do chão ali presente apontando direto os adubos bons."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Sem Dedo Torto: Formatos maiores da tela pros dedão não sair esbarrando noutro na tela pequena.",
                    "Mesa de Bar Lado a Lado: Tudo visível mais aberto sem precisar se embrenhar, abrindo o mato pros atalhos essenciais."
                ]
            }
        ]
    },
    {
        version: "0.2.0",
        date: "21 de Dezembro de 2025",
        title: "O Seu Caderninho de Sol",
        description: "Dizendo adeus as folhas manchadas e úmidas preenchidas da pressa. Ganhou muito mais alívio ao repassar horas à canseira sob as nuvens ou limpos céus.",
        sections: [
            {
                type: "Improvements",
                items: [
                    "Pulo de Sapo: Foi direito na biqueira das horas e braçais as opções limpas sem perder conversa pra lançar quem e que horas botou na roça os insumos.",
                    "Visual Tranquilo: Cada registro batido ali ganharam espaço graúdo pro povo reler."
                ]
            }
        ]
    },
    {
        version: "0.1.0",
        date: "6 de Outubro de 2025",
        title: "De Semente Em Broto",
        description: "Começou de supetão esse canto plantado só para quem e das águas ao solo mexe no limpo, visando dar descanso pras cabeças produtoras.",
        sections: [
            {
                type: "New",
                items: [
                    "Cerca Forte Virtual: Tijolos erguidos com proteção gigante digital pra só teus olhos na tua lavoura pousar.",
                    "Do Papel à Vida: Da sujeira das pastas pra os vidros dos computadores e telemóveis do povo sem papel da cooperativa, tudo agora de bolso a bolso no prumo do dia a dia."
                ]
            }
        ]
    }
];
