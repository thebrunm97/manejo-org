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
        version: "0.17.0",
        date: "2026-04-14",
        title: "Mais Segurança nos Seus Dados e Respostas da IA Mais Inteligentes 🛡️",
        description: "Nesta atualização, focamos em garantir que cada anotação sua seja salva com perfeição e que o assistente do WhatsApp seja ainda mais confiável e preciso.",
        sections: [
            {
                type: "Fixes",
                items: [
                    "Segurança Reforçada: Corrigimos uma falha que impedia o salvamento de dados em algumas propriedades, garantindo que suas informações estejam sempre seguras.",
                    "Histórico de Dúvidas: Agora o sistema registra com detalhes como a IA ajudou a tirar suas dúvidas técnicos, facilitando sua conferência.",
                    "Confirmações Reais: O assistente do WhatsApp agora só confirma o sucesso de uma tarefa após a conclusão real, eliminando mensagens confusas."
                ]
            }
        ]
    },
    {
        version: "0.16.0",
        date: "2026-04-09",
        title: "Atendimento Ininterrupto com Inteligência de Reserva 🧬",
        description: "Preparamos o sistema para que você nunca fique na mão, mesmo que um dos nossos provedores de tecnologia passe por instabilidade momentânea.",
        sections: [
            {
                type: "New",
                items: [
                    "Estabilidade Garantida: O seu assistente inteligente agora possui sistemas de reserva automáticos para nunca o deixar sem resposta. Se uma tecnologia falhar, a outra assume na hora.",
                    "Raciocínio Aprimorado: Melhoramos a capacidade da IA de entender contextos rurais complexos e históricos de conversas longas."
                ]
            }
        ]
    },
    {
        version: "0.15.0",
        date: "2026-04-08",
        title: "Cérebro IA Mais Potente e Preciso 🧠",
        description: "Fizemos uma grande atualização interna para que os cálculos agronômicos e as interpretações de texto sejam feitos com precisão absoluta.",
        sections: [
            {
                type: "Improvements",
                items: [
                    "Cálculos de Campo Blindados: Fórmulas internas atualizadas para que a interpretação de quantidades e volumes seja 100% precisa.",
                    "Memória de Trabalho: O robô agora guarda melhor o contexto da conversa, facilitando registros detalhados feitos em várias mensagens."
                ]
            }
        ]
    },
    {
        version: "0.14.0",
        date: "2026-04-04",
        title: "A Era da Gestão Analítica e Consultoria IA 📈",
        description: "Nesta atualização, transformamos o ManejoORG na sua maior ferramenta para alavancar vendas, garantir lucro real e receber consultoria técnica especializada direto no campo.",
        sections: [
            {
                type: "New",
                items: [
                    "🤝 Mural de Oportunidades B2B2C: Veja com clareza o que as maiores cooperativas estão buscando no mercado hoje e oferte sua safra num clique.",
                    "💰 Raio-X Financeiro da Lavoura: Chega de cálculos no papel! O novo painel financeiro DRE revela o lucro/prejuízo preciso, talhão por talhão.",
                    "👨‍🌾 Motor Agronômico Inteligente (IA): Nosso consultor pelo WhatsApp agora entrega cálculos matemáticos de adubação (NPK real!) poupando seu dinheiro com gastos excessivos de insumos."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "⚡ Diário de Campo a Jato: Desmontamos a base dos formulários e dividimos os registros. Agora salvar seus manejos e infraestruturas não trava mais o seu celular, mesmo nas piores redes 3G rurais.",
                    "🔒 Estabilidade e Velocidade Blindada: O coração dos servidores foi reotimizado (novos índices espaciais). Pesquisas rápidas anti-travamento para que você se foque 100% no trabalho no campo."
                ]
            }
        ]
    },
    {
        version: "0.13.2",
        date: "29 de Março de 2026",
        title: "Mapa de volta à velocidade da luz",
        description: "Consertamos o problema que impedia tocar nos talhões pelo celular e web. Agora o mapa está 100% interativo e inteligente novamente.",
        sections: [
            {
                type: "Fixes",
                items: [
                    "Conserto de Toques no Mapa: Resolvemos o erro que 'prendia' o clique do usuário, impedindo a abertura dos detalhes do talhão no mobile.",
                    "Arquitetura Plan G: Refatoramos a base do mapa para garantir que ele responda instantaneamente em qualquer dispositivo, protegendo a experiência contra interferências visuais."
                ]
            }
        ]
    },
    {
        version: "0.13.1",
        date: "29 de Março de 2026",
        title: "Previsão do Tempo Integrada e Novo Painel",
        description: "Adicionamos uma estação meteorológica virtual direto no seu painel para alertar sobre ventos e chuvas. Além disso, a tela inicial ganhou um visual muito mais moderno.",
        sections: [
            {
                type: "New",
                items: [
                    "Estação Meteorológica Autônoma: O robô agora monitora o clima da sua localidade automaticamente e te avisa no painel se a condição do vento está ideal para pulverização.",
                    "Painel Mais Moderno e Inteligente: A tela principal (Dashboard) foi redesenhada. Está muito mais fácil ler os dados da safra e navegar no dia a dia."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Motor de Alta Performance: A engenharia que busca os dados de clima foi otimizada para lidar tranquilamente com milhares de fazendas simultâneas, processando em blocos seguros sem travamentos (Worker Pool)."
                ]
            }
        ]
    },
    {
        version: "0.13.0",
        date: "28 de Março de 2026",
        title: "Salvamento Rápido e Sem Erros",
        description: "Atualizamos o coração do sistema para garantir que todas as suas anotações sejam salvas no banco de maneira íntegra, sem o risco de se perder folha na hora H da certificação.",
        sections: [
            {
                type: "New",
                items: [
                    "Caderno Mais Elegante e Inteligente: Ao registrar suas infraestruturas ou compras, o sistema liga os pontos automaticamente no banco de dados, organizando tudo com as amarras perfeitamente corretas.",
                    "Transações Seguras e Completas: Evoluímos as engrenagens de gravação. Agora ou ele salva as informações corretas de uma vez só da ponta ao fim, ou evita criar registros esburacados para que sua auditoria passe lisa."
                ]
            }
        ]
    },
    {
        version: "0.12.0",
        date: "27 de Março de 2026",
        title: "Assistente de WhatsApp Mais Esperto",
        description: "O WhatsApp ficou extremamente mais ligeiro e estável. É como se tivéssemos inserido dois analistas juntos online: um cuidando do manual de pragas para focar no conteúdo técnico, e outro guiando só no preenchimento firme da safra do mês.",
        sections: [
            {
                type: "New",
                items: [
                    "Atendimento Direto no Zap: A IA separa em uma fração de segundo quem quer conversar daquelas anotações normais de roça, agilizando absurdamente a triagem.",
                    "Textos e Gramática: As mensagens devolvidas e enviadas pelo WhatsApp foram totalmente limpas; estão altamente amigáveis, fáceis de ler nas capinhas do celular e pontuais.",
                    "Sem Travamentos: Nós estabilizamos de vez toda a engenharia pesada para prevenir os pequenos loops esquisitões onde o assistente rodava de ré e se perdia pra trás em conversas complexas demais."
                ]
            }
        ]
    },
    {
        version: "0.9.0",
        date: "26 de Março de 2026",
        title: "O Seu Polígono e Área na Mão",
        description: "Assuma de vez o desenho do seu mapa interativo! Cerque, marque e pontue os perímetros da propriedade como eles realmente são em loco e use cores incríveis para organizar de cara os setores de plantou.",
        sections: [
            {
                type: "New",
                items: [
                    "Sua Planta na Sua Cor: Um criador visual em escala perfeito que entrega uma forma suave de marcar limites visíveis diretos com as marcações de satélite em pano de fundo.",
                    "Tintas Para Organizar a Lida: Escolha atalhos ou crie suas próprias linhas de cor, marcando do vermelho perigo ao verdão alface as suas zonas num clique.",
                    "A I.A. que Estuda e Ajuda: Faça o anexo de qualquer PDF oficial longo enviando no próprio app, e o assistente o engole na biblioteca para responder na mosca as tuas dúvidas!"
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Atualização Ao Vivo pelo Croqui: Se você trocou o rótulo de uma cor do talhão em uma subárea, instantaneamente, a alteração se reflete na pintura cartográfica central da propriedade.",
                    "Mais Inteligência por Falas (Áudio): A gente elevou o motor base da I.A. para ele entender sotaques misturados com termos do campo rural.",
                    "Transições Muito Suaves: Removemos os socos no visual quando você entra na camada de Desenho contrapondo com a camada da visualização da tela grande."
                ]
            }
        ]
    },
    {
        version: "0.8.0",
        date: "20 de Março de 2026",
        title: "Alta Segurança com Painéis Específicos",
        description: "Revisamos todas as engrenagens de infraestrutura para que sua plataforma atinja máxima segurança perante terceiros e segmentamos a visibilidade do caderno principal do plano por janelas bem divididas.",
        sections: [
            {
                type: "New",
                items: [
                    "Comandos Por Fala Pura no WhatsApp: Agora seu encarregado no campo joga uma mensagem rápida limpa, de áudio, para atividades menores sem precisar tocar teclado quebrado durante as limpezas brabas das câmaras e trato dos depósitos de composteira.",
                    "As Novas Abas Segmentadas do App-Web: Para não criar longos blocos sem fôlego, distribuímos a documentação dos planos com abamento focado. Manejo, Fertilizantes e Doenças agora descansam separados uns dos outros visivelmente.",
                    "O Botão Salval Vidas: Na correria com a ferramenta, fomos criativos implementando salvaguarda para notificar caso exista qualquer atividade com alterações ativas onde ocorra cliques sem intenção, pra evitar de ir embora perdendo digitados complexos recém construídos."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Cofre a sete chaves: Refizemos de vez os modelos em tempo de banco de dados e criptografia fechando o portão pra manter toda a auditorias com barreiras e selo único inviolável que blindam a exclusividade na conta acessada.",
                    "Conversa Organizada Paralelamente Multitarefas: Nossa arquitetura no WPP agora processa N-usuários se escorando para os servidores atenderem no ritmo correto, para impedir filas travadas das mensagens de resposta demoradas na concorrência da época."
                ]
            }
        ]
    },
    {
        version: "0.7.0",
        date: "10 de Março de 2026",
        title: "O Padrão Ouro de Memória Contextual",
        description: "Elevamos a retenção temporal de toda as lembranças do contato virtual com a roça para um nível mais produtivo e linear. Interrompendo ou retomando, tudo fica amarradinho com conversas amigáveis.",
        sections: [
            {
                type: "New",
                items: [
                    "Lembranças de Curto Prazo Eficazes na Retenção: O dia começou no canavial sem pegar sinal ou por urgência travada do mancal, parou o chat. E no retorno amanhã na conversa interrompida, ele continua certinho dali esperando pela mesma anotação.",
                    "Inteligência de Entrevista em Campo Livre: Você se esqueceu e mandou logo as planilhas completas pra auditoria e faltou os insumos das linhas? Relaxa, a ferramenta faz contato com perguntinhas pontuais, claras, desatando aquele bloqueio burocrático de que seria bloqueado via robôs frios.",
                    "Ofícios e Documentos Consultáveis via RAG Dinâmico: A inteligência usa a base de dados em profundidade contra referências oficiais embasando assertivamente os apontamentos e insumos adequados recomendados pelo protocolo."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Sintonia Fina de Expressões Nativas de Plantio: Ajustou bastante os módulos com um novo parser interpretador para dar match inteligente em descrições soltas nativas e vocabulários das macrorregiões sobre a terra na escrita do produtor."
                ]
            }
        ]
    },
    {
        version: "0.6.1",
        date: "26 de Fevereiro de 2026",
        title: "Velocidade na Plataforma e Conhecimento Técnico",
        description: "Melhorias substanciais e reações das trocas de interfaces em prol de uma resposta estúpida de rápida e com referências a normativas de qualidade de produção rural.",
        sections: [
            {
                type: "New",
                items: [
                    "Selo MAPA Embalsamado em Nossos Chips: A equipe conectou e instruiu ativamente o sistema a utilizar somente embasamentos lógicos com chancela do regulatório do Brasil focado pra desburocratizar seu compliance natural e oficial.",
                    "Repositório Físico Central no Frontend: Construímos o local nativo, chamado internamente de RAG, disponível on-demand na central para te providenciar acesso físico aos documentos com informações exatas consultáveis por I.A.",
                    "Ping Seguro da Automação de WhatsApp: No painel agora injetamos em tempo o sensor ao vivo (A luz online verde da máquina das conversas), trazendo segurança de conexão a base da retaguarda e indicando clareza máxima que está lá operável 24/7."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Tempos e Engates Otimizados (Turbo Loader): Ao transitar nas etapas o carregamento pesado em background foi encurtado, operando com micro cortes limpos para sumir com qualquer sensação que seja o painel estava pesado esperando no 3g/wifi rural.",
                    "Prevenindo Encalhe de Login: Eliminação cabalística e preventiva a bugs brancos que trancavam um infinito em alguns momentos o rodopio das interações web da página inicial e destravamos com limpezas ativas."
                ]
            }
        ]
    },
    {
        version: "0.6.0",
        date: "25 de Fevereiro de 2026",
        title: "A Revolução Total da Cadeia de Valor Mobile e PWA Focado",
        description: "Passamos o pente fino da cabeça pra o esquadro recriando todas as funcionalidades essenciais como aplicações puras feitas de zero pros moldes móveis com totalidade no chão das linhas orgânicas e um sistema novíssimo.",
        sections: [
            {
                type: "New",
                items: [
                    "Painel Cartográfico Limpo e Responsível do Zero: Tela redesenhada sem emaranhados operacionais na qual se entrega interações e demarcações fáceis para delimitar com elegância e prumo perfeitamente o loteamento real mapeado no GPS local e satélites do lote orgânico e cadernos a traço direto.",
                    "Sinalizador Físico e Calculadora Agronômica com Precisões da Área: Um sistema engenhoso engatilhado para ler a matriz das extensões calculando o tamanho total sem esbarrar por chutes de olhos as quantidades ou as misturas indicadas à precisão técnica do plano de solos focado na melhora da terra e pragas.",
                    "O Elo Perdido Desenhado do Ciclo de Plantios: Engatilhamos uma ferramenta focada à documentar desde o corte originário dos leitos até e as remessões rastreáveis pra se fechar na prateleirinha final do comércio ou feira. Total Rastreabilidade.",
                    "Auto-Auditoria Sem Percalços para Certificações OCSs e SPG IMA Padrão Nacional: Refinamos todos os engates das regras que habilitam registrar uma série interligadas dos insumos, as mudas para com várias linhagens nos plantios das fileiras para facilitar auditorias dos fiscais com planilhas coerentes perante com datas do ciclo produtivo natural."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "A Aplicação Web Móvel Extremamente Leve com Peso de Pena: Fizemos as cirurgias no fundo da interface para baixar absurdamente pra centenas de kbs que nem balançariam num wifi e de brinde habilitando carregamentos lisos.",
                    "Cartões da Interface Adaptados à Mão Livre e Legiveis (Mobile-First UI Revisions): Descartou se os velhos e compridos quadros burocratas cheios das colunas, repassados todos pra um belo sistema em Cards que rolam naturalmente o bloco inteiro nos celulares perfeitamente com legibilidades em sol claro ou sol a pino de fora em sombra não ideal.",
                    "WhatsApp Sem Restrições Onerosas Relato e Desempenho (RAG Upgrades e AI Processing): Incrementou se e capacitou bastante todos os recursos vitais os LLMs atrás da telinha para absorverem de vez requalificar perguntas da vida ou densos relatos com safra com clareza focados dos campos rústicos do manejos na digitação.",
                    "Tirando Areia das Engrenagens Dos Formulários Lentos Racionais do OCS-SPG Opcionais e Exigidos: Revisita das arquiteturas de cada caixinha no input central removidas a totalidade os travamentos lógicos chatos preenchendo grandes planilhões massacrantes pesadíssimos.",
                    "Alinhamento dos Extremos - Medidores Nativos no Software e Calibrações Canteiros e Linhas Espaciais Precisos Físico: Incluiu métricas na plataforma digital garantindo que vai dar encaixei sem improvisar os alinhamentos fixos larguras para comprimento de prumos por metros em cada parcela na medida e do plantio real."
                ]
            }
        ]
    },
    {
        version: "0.5.1",
        date: "20 de Fevereiro de 2026",
        title: "Mais Leveza e Velocidade no Campo",
        description: "Reestruturação visual focada em facilitar a navegação e melhorar o uso em áreas com internet instável, reduzindo o tempo de digitação.",
        sections: [
            {
                type: "New",
                items: [
                    "Modo Alto Contraste: Ajustamos a paleta de cores para garantir a leitura perfeita da tela do celular mesmo debaixo de sol forte no pasto.",
                    "Preenchimento Inteligente: Ao usar o sistema continuamente, ele passa a preencher automaticamente informações repetitivas para poupar o seu tempo."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Otimização para Redes 3G/4G: Todo o tráfego de dados foi otimizado para não travar mesmo com sinal de operadora fraco na zona rural.",
                    "Relatórios Mais Limpos: A tela dos 19 relatórios essenciais do Plano de Manejo foi limpa, removendo distrações e focando apenas no que importa.",
                    "Atalhos Diretos: Inserimos botões de ação rápida para você registrar atividades diárias em um só clique, sem passar por vários menus.",
                    "Alertas Discretos: Substituímos bloqueios gigantes na tela por notificações menores no canto, liberando mais espaço visual na hora de preencher os formulários.",
                    "Painel Repaginado: A tela inicial (Overview) foi reorganizada para destacar as métricas que você mais usa no dia a dia da fazenda."
                ]
            }
        ]
    },
    {
        version: "0.5.0",
        date: "28 de Janeiro de 2026",
        title: "Assistência e Confiança Plena no WhatsApp",
        description: "Melhorias estruturais no assistente integrado para garantir respostas rápidas, fluidas e seguras no seu dia a dia.",
        sections: [
            {
                type: "New",
                items: [
                    "Orquestrador de Inteligência: O robô agora tem capacidade para tirar dúvidas complexas consultando diretamente os manuais orgânicos em uma fração de segundos.",
                    "Classificação Automática: A IA identifica automaticamente se a sua mensagem no Zap é para agendar uma tarefa corriqueira ou se é uma dúvida mais longa, redirecionando o fluxo rapidamente.",
                    "Ponto de Sustentabilidade: Criamos um módulo para ajudar a plataforma a comprovar as boas práticas orgânicas, reforçando o selo transparente da sua colheita."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Infraestrutura Blindada (24/7): Refizemos toda a tecnologia por trás do envio de mensagens pesadas (textos longos e áudios), garantindo suporte ininterrupto mesmo nas conexões mais rurais do Brasil.",
                    "Fim das Mensagens Quebradas: Respostas do robô que antes chegavam fatiadas pelo WhatsApp agora vêm formatadas em um único e limpo bloco de texto."
                ]
            }
        ]
    },
    {
        version: "0.4.0",
        date: "23 de Janeiro de 2026",
        title: "Rastreabilidade Ponto a Ponto e Dicas Rápidas",
        description: "Organização digital de ponta para acompanhar o trajeto da sua colheita do momento do corte até a banca da feira sem estresse.",
        sections: [
            {
                type: "New",
                items: [
                    "Visão Completa dos Lotes (Supply Chain): Tecnologia transparente para rastrear para onde foi direcionado cada lote das suas safras, viabilizando o controle total exigido nas auditorias SPG e OCS.",
                    "Autocompletar de Horários: Facilidade que preenche instantaneamente o calendário com cronometrias nas rotinas diárias, reduzindo os toques na tela e a fadiga braçal.",
                    "Dicas de Usabilidade (Onboard): Pequenos cartões na interface que oferecem guias rápidos para acelerar a curva de aprendizado de quem acabou de chegar na plataforma."
                ]
            }
        ]
    },
    {
        version: "0.3.0",
        date: "7 de Janeiro de 2026",
        title: "Mapeamento Espacial e Ferramentas Inteligentes",
        description: "Mapeamento dinâmico de topografias em alinhamento com sistemas de adubação e cálculo de roça para desburocratizar a planta da terra.",
        sections: [
            {
                type: "New",
                items: [
                    "Desenhista Digital do Terreno: Plataforma integrada focada em permitir traçar propriedades, piquetes e canteiros sobre a visão do satélite de forma prática e limpa.",
                    "Duplicador Ágil de Linhas: Para quem lida em escalas, um clique resolve a replicação de linhas plantadas inteiras sem depender de criar micro lotes um por um.",
                    "Calculadoras Agronômicas: O sistema cruza os adubos preenchidos e faz relatórios de cálculos úteis e embasados, entregando uma orientação valiosa para a fertilização."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Botões Ampliados (Mobile-First): Ajuste ergonômico em todos os teclados, abas e envios do sistema móvel, impedindo cliques errados mesmo quando operando o celular da boleia do trator.",
                    "Guias Superiores Simplificadas: Desatarraxamos labirintos antigos nos menus, concentrando a navegação inicial apenas no que realmente importa na visão frontal."
                ]
            }
        ]
    },
    {
        version: "0.2.0",
        date: "21 de Dezembro de 2025",
        title: "O Seu Caderno Digital Original",
        description: "Transformando o caos das pastas de papel no primeiro ambiente digital leve o suficiente para fazer apontamentos rápidos em pleno sol do meio-dia.",
        sections: [
            {
                type: "Improvements",
                items: [
                    "Lançamentos Dinâmicos: Menos telas entre abrir o diário agrícola e digitar quando foi que você inseriu tal insumo em tal lote, simplificando radicalmente os ciclos na roça.",
                    "Leitura Limpa Focada no Auditor (SPG/OCS): Reajuste nos cards e caixas de texto com amplitudes confortáveis, de forma que produtores cansados leiam tudo de noite na cama revisando as anotações do log digital sem forçar as vistas."
                ]
            }
        ]
    },
    {
        version: "0.1.0",
        date: "6 de Outubro de 2025",
        title: "A Semente do Manejo Org APP",
        description: "O lançamento primordial da ferramenta que modernizou e colocou no bolso das produtoras orgânicas o cadernão burocrático, dando a elas tempo para focarem no prumo do seu verdadeiro negócio: a terra viva.",
        sections: [
            {
                type: "New",
                items: [
                    "Fundação Confidencial a Sete Chaves: O banco central de dados nasce altamente blindado, cada fazenda se isola criptografada, de ponta a ponta.",
                    "Do Papel à Vida: Transformação das planilhas das burocracias SPG e associações cooperativas em sistemas limpos com relatórios automáticos de manejo."
                ]
            }
        ]
    }
];
