import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { 
    MessageSquare, 
    ArrowLeft, 
    User, 
    Cpu, 
    Radio, 
    Clock, 
    Search,
    RefreshCw
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { formatarDataRelativa } from '../../utils/formatters';

// --- Interfaces ---
interface Message {
    id: string;
    message_id: string;
    phone: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: string;
    status: string;
    source?: string;
}

interface Conversation {
    id: string;
    phone: string;
    last_message: string;
    last_message_role: 'user' | 'assistant';
    last_message_timestamp: string;
    last_message_status: string;
    profile_name: string | null;
}

export const LiveChatMonitor: React.FC = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingConversations, setLoadingConversations] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [realtimeConnected, setRealtimeConnected] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Formatar número de telefone para exibição (ex: 553498256825 -> +55 (34) 98256-8255)
    const formatPhone = (phoneStr: string): string => {
        const clean = phoneStr.replace(/\D/g, '');
        if (clean.startsWith('55') && clean.length >= 12) {
            const ddd = clean.slice(2, 4);
            const part1 = clean.slice(4, clean.length - 4);
            const part2 = clean.slice(clean.length - 4);
            return `+55 (${ddd}) ${part1}-${part2}`;
        }
        return `+${clean}`;
    };

    // Buscar lista de conversas recentes da View view_conversas_recentes
    const fetchConversations = async () => {
        setLoadingConversations(true);
        try {
            const { data, error } = await supabase
                .from('view_conversas_recentes')
                .select('*')
                .order('last_message_timestamp', { ascending: false });

            if (error) {
                console.error('[LiveChatMonitor] Error fetching conversations:', error);
            } else if (data) {
                const mapped: Conversation[] = data.map((item: any) => ({
                    id: item.id,
                    phone: item.phone,
                    last_message: item.last_message,
                    last_message_role: item.last_message_role,
                    last_message_timestamp: item.last_message_timestamp,
                    last_message_status: item.last_message_status,
                    profile_name: item.profile_name
                }));
                setConversations(mapped);
            }
        } catch (err) {
            console.error('[LiveChatMonitor] Unexpected conversations error:', err);
        } finally {
            setLoadingConversations(false);
        }
    };

    // Buscar histórico de mensagens de um telefone específico
    const fetchMessages = async (phone: string) => {
        setLoadingMessages(true);
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('phone', phone)
                .order('timestamp', { ascending: true });

            if (error) {
                console.error('[LiveChatMonitor] Error fetching messages:', error);
            } else if (data) {
                setMessages(data as Message[]);
            }
        } catch (err) {
            console.error('[LiveChatMonitor] Unexpected messages error:', err);
        } finally {
            setLoadingMessages(false);
        }
    };

    // Carregar conversas ao montar o componente
    useEffect(() => {
        fetchConversations();
    }, []);

    // Buscar histórico sempre que selecionar uma nova conversa
    useEffect(() => {
        if (selectedPhone) {
            fetchMessages(selectedPhone);
        } else {
            setMessages([]);
        }
    }, [selectedPhone]);

    // Rolar até o final do histórico de mensagens ao carregar novas mensagens
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Inscrever-se no canal em tempo real do Supabase
    useEffect(() => {
        const channel = supabase
            .channel('custom-all-channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                async (payload) => {
                    const newMessage = payload.new as Message;
                    if (!newMessage.phone) return;

                    // 1. Atualizar mensagens da conversa selecionada instantaneamente
                    if (newMessage.phone === selectedPhone) {
                        setMessages((prev) => {
                            if (prev.some((m) => m.id === newMessage.id)) return prev;
                            return [...prev, newMessage];
                        });
                    }

                    // 2. Atualizar a lista de conversas de forma reativa
                    setConversations((prev) => {
                        const existingIdx = prev.findIndex((c) => c.phone === newMessage.phone);
                        
                        // Atualizar com a nova última mensagem
                        const updatedItem: Conversation = {
                            id: newMessage.id,
                            phone: newMessage.phone,
                            last_message: newMessage.content || newMessage.content || '',
                            last_message_role: newMessage.role || 'user',
                            last_message_timestamp: newMessage.timestamp || new Date().toISOString(),
                            last_message_status: newMessage.status || '',
                            profile_name: existingIdx !== -1 ? prev[existingIdx].profile_name : null
                        };

                        // Se o contato ainda não tinha o nome carregado no estado, tentar buscar do banco
                        if (existingIdx === -1) {
                            // Buscar nome de perfil assincronamente para não travar a UI
                            supabase
                                .from('profiles')
                                .select('nome')
                                .eq('telefone', newMessage.phone)
                                .maybeSingle()
                                .then(({ data }) => {
                                    if (data?.nome) {
                                        setConversations((current) => 
                                            current.map((c) => 
                                                c.phone === newMessage.phone 
                                                    ? { ...c, profile_name: data.nome } 
                                                    : c
                                            )
                                        );
                                    }
                                });
                        }

                        const cleanList = [...prev];
                        if (existingIdx !== -1) {
                            cleanList.splice(existingIdx, 1);
                        }
                        
                        return [updatedItem, ...cleanList];
                    });
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setRealtimeConnected(true);
                } else {
                    setRealtimeConnected(false);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedPhone]);

    // Filtrar a lista de conversas com base na barra de pesquisa
    const filteredConversations = conversations.filter(c => {
        const term = searchTerm.toLowerCase();
        const phoneMatch = c.phone.includes(term);
        const nameMatch = c.profile_name?.toLowerCase().includes(term);
        const msgMatch = c.last_message?.toLowerCase().includes(term);
        return phoneMatch || nameMatch || msgMatch;
    });

    const activeConversation = conversations.find(c => c.phone === selectedPhone);

    return (
        <div className="p-4 md:p-8 bg-agro-creme bg-grain min-h-[calc(100vh-4rem)] md:min-h-screen font-sans flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0 animate-in fade-in slide-in-from-top-4 duration-500">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 rounded-full bg-agro-floresta text-white text-[9px] font-black uppercase tracking-[0.2em] shadow-sm">
                            Administração
                        </span>
                        
                        {/* Live Realtime Indicator */}
                        <div className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                            realtimeConnected 
                                ? "bg-emerald-50 text-emerald-600 border-emerald-200" 
                                : "bg-amber-50 text-amber-600 border-amber-200"
                        )}>
                            <span className="relative flex h-2 w-2">
                                <span className={cn(
                                    "absolute inline-flex h-full w-full rounded-full opacity-75",
                                    realtimeConnected ? "animate-ping bg-emerald-400" : "bg-amber-400"
                                )}></span>
                                <span className={cn(
                                    "relative inline-flex rounded-full h-2 w-2",
                                    realtimeConnected ? "bg-emerald-500" : "bg-amber-500"
                                )}></span>
                            </span>
                            {realtimeConnected ? 'Monitor Ativo' : 'Reconectando...'}
                        </div>
                    </div>
                    
                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-agro-floresta tracking-tighter uppercase">
                        Monitor de Atendimento
                    </h1>
                </div>

                <button
                    onClick={() => {
                        fetchConversations();
                        if (selectedPhone) fetchMessages(selectedPhone);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-agro-ouro/20 hover:border-agro-ouro/50 text-agro-floresta font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95"
                >
                    <RefreshCw size={14} className="text-agro-ouro" />
                    Atualizar Dados
                </button>
            </div>

            {/* Split View Container */}
            <div className="flex-1 bg-white rounded-3xl border border-agro-ouro/10 shadow-soft overflow-hidden flex min-h-[500px]">
                {/* 1. Left Column: Conversations List */}
                <div className={cn(
                    "w-full md:w-80 lg:w-96 border-r border-agro-ouro/10 flex flex-col shrink-0 bg-agro-creme/20",
                    selectedPhone !== null ? "hidden md:flex" : "flex"
                )}>
                    {/* Search */}
                    <div className="p-4 border-b border-agro-ouro/10 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-agro-floresta/30" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar produtor ou telefone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-agro-ouro/10 rounded-xl text-xs font-bold text-agro-floresta placeholder:text-agro-floresta/30 focus:outline-none focus:ring-1 focus:ring-agro-ouro/30 focus:border-agro-ouro/50 transition-all"
                            />
                        </div>
                    </div>

                    {/* Conversations List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-agro-ouro/5">
                        {loadingConversations && conversations.length === 0 ? (
                            <div className="p-8 text-center text-agro-floresta/40 text-sm font-medium italic">
                                Carregando conversas...
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="p-8 text-center text-agro-floresta/40 text-sm font-medium italic">
                                {searchTerm ? 'Nenhuma conversa corresponde à busca.' : 'Sem conversas registradas.'}
                            </div>
                        ) : (
                            filteredConversations.map((c) => {
                                const isActive = selectedPhone === c.phone;
                                return (
                                    <button
                                        key={c.phone}
                                        onClick={() => setSelectedPhone(c.phone)}
                                        className={cn(
                                            "w-full text-left p-4 transition-all flex items-start gap-3 border-l-4 outline-none",
                                            isActive
                                                ? "bg-white border-l-agro-ouro bg-agro-creme/40 shadow-inner"
                                                : "border-l-transparent hover:bg-white/50"
                                        )}
                                    >
                                        {/* Avatar */}
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border",
                                            isActive 
                                                ? "bg-agro-ouro/25 text-agro-floresta border-agro-ouro/30" 
                                                : "bg-agro-floresta/5 text-agro-floresta/80 border-agro-floresta/10"
                                        )}>
                                            {c.profile_name ? c.profile_name.charAt(0).toUpperCase() : <User size={16} />}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <h3 className="text-xs font-black text-agro-floresta truncate uppercase tracking-wide">
                                                    {c.profile_name || formatPhone(c.phone)}
                                                </h3>
                                                <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                                                    {formatarDataRelativa(c.last_message_timestamp)}
                                                </span>
                                            </div>
                                            
                                            {c.profile_name && (
                                                <p className="text-[9px] font-black text-slate-400 mb-1 leading-none">
                                                    {formatPhone(c.phone)}
                                                </p>
                                            )}

                                            <div className="flex items-center gap-1.5 mt-1">
                                                {c.last_message_role === 'assistant' ? (
                                                    <Cpu size={11} className="text-agro-ouro shrink-0" />
                                                ) : (
                                                    <User size={11} className="text-slate-400 shrink-0" />
                                                )}
                                                <p className="text-xs text-slate-500 truncate leading-tight">
                                                    {(c.last_message || '').replace(/\\n/g, ' ')}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 2. Right Column: Chat History */}
                <div className={cn(
                    "flex-1 flex flex-col bg-slate-50/50",
                    selectedPhone === null ? "hidden md:flex" : "flex"
                )}>
                    {selectedPhone ? (
                        <>
                            {/* Chat Header */}
                            <div className="bg-white border-b border-agro-ouro/10 px-6 py-4 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => setSelectedPhone(null)}
                                        className="p-1 text-agro-floresta hover:bg-slate-100 rounded-lg md:hidden transition-colors"
                                        aria-label="Voltar para a lista"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    
                                    <div className="w-10 h-10 rounded-xl bg-agro-floresta text-agro-creme flex items-center justify-center font-bold text-sm border border-white/10 shadow-sm uppercase">
                                        {activeConversation?.profile_name ? activeConversation.profile_name.charAt(0) : <User size={16} />}
                                    </div>
                                    
                                    <div>
                                        <h2 className="text-sm font-black text-agro-floresta uppercase tracking-wide">
                                            {activeConversation?.profile_name || 'Produtor Sem Cadastro'}
                                        </h2>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-0.5">
                                            {formatPhone(selectedPhone)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Radio size={14} className="text-agro-ouro animate-pulse" />
                                    <span className="text-[10px] font-black uppercase text-agro-floresta/40 tracking-wider">Histórico Sincronizado</span>
                                </div>
                            </div>

                            {/* Messages Grid */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {loadingMessages && messages.length === 0 ? (
                                    <div className="flex justify-center items-center h-full text-sm text-agro-floresta/40 italic">
                                        Carregando histórico...
                                    </div>
                               ) : messages.length === 0 ? (
                                    <div className="flex justify-center items-center h-full text-sm text-agro-floresta/40 italic">
                                        Nenhuma mensagem registrada.
                                    </div>
                               ) : (
                                    messages.map((msg) => {
                                        const isBot = msg.role === 'assistant';
                                        return (
                                            <div
                                                key={msg.id}
                                                className={cn(
                                                    "flex flex-col max-w-[80%] md:max-w-[70%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                                                    isBot ? "mr-auto items-start" : "ml-auto items-end"
                                                )}
                                            >
                                                {/* Meta Info */}
                                                <div className="flex items-center gap-1.5 mb-1 px-1.5">
                                                    {isBot ? (
                                                        <>
                                                            <Cpu size={10} className="text-agro-ouro" />
                                                            <span className="text-[9px] font-black text-agro-ouro uppercase tracking-wider">ASSISTENTE</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">PRODUTOR</span>
                                                        </>
                                                    )}
                                                    <span className="text-[9px] text-slate-400 font-bold flex items-center gap-0.5">
                                                        <Clock size={8} />
                                                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                {/* Message Bubble */}
                                                <div className={cn(
                                                    "px-5 py-3.5 rounded-2xl shadow-sm border text-xs font-semibold leading-relaxed whitespace-pre-wrap",
                                                    isBot 
                                                        ? "bg-agro-floresta text-white border-white/5 rounded-tl-none font-sans" 
                                                        : "bg-white text-slate-800 border-agro-ouro/10 rounded-tr-none font-sans"
                                                )}>
                                                    {(msg.content || msg.source || '').replace(/\\n/g, '\n')}
                                                </div>
                                            </div>
                                        );
                                    })
                               )}
                                <div ref={messagesEndRef} />
                            </div>
                        </>
                    ) : (
                        /* Empty State */
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-agro-creme/10 animate-in fade-in duration-700">
                            <div className="w-16 h-16 bg-agro-floresta/5 text-agro-floresta rounded-3xl flex items-center justify-center mb-4 border border-agro-ouro/10 shadow-sm">
                                <MessageSquare size={28} className="text-agro-ouro" />
                            </div>
                            <h2 className="text-xl font-serif font-black text-agro-floresta uppercase tracking-tight">Nenhuma Conversa Selecionada</h2>
                            <p className="text-xs text-agro-floresta/40 mt-1 max-w-xs leading-relaxed font-medium">
                                Selecione um contato na barra lateral para monitorar a interação do assistente inteligente em tempo real.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveChatMonitor;
