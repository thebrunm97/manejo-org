// src/pages/DesignLab.tsx

import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Map as MapIcon,
    Sprout,
    ClipboardList,
    Settings,
    LogOut,
    Filter,
    Plus,
    Search,
    Globe,
    ZoomIn,
    ZoomOut,
    Crosshair,
    ArrowLeft,
    Loader2
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { cn } from '../utils/cn';

// Types
interface PropertyFormData {
    secao_1_descricao_propriedade?: {
        nome_propriedade?: string;
    };
}

interface Property {
    id: string;
    nome_identificador?: string;
    updated_at: string;
    form_data?: PropertyFormData;
}

interface SidebarItemProps {
    icon: React.ElementType;
    active?: boolean;
    label?: string;
}

// SidebarItem Component
const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, active, label }) => (
    <button
        title={label}
        className={cn(
            "p-3.5 rounded-2xl transition-all duration-200 mb-4 group relative",
            active
                ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.1)]"
                : "text-slate-400 hover:bg-white/10 hover:text-white"
        )}
    >
        <Icon size={24} strokeWidth={active ? 2.5 : 2} />
        {active && (
            <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-emerald-500 rounded-r-full" />
        )}
    </button>
);

const DesignLab: React.FC = () => {
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Responsive state manual control
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);

        const fetchProperties = async () => {
            try {
                const { data, error } = await supabase
                    .from('pmos')
                    .select('*')
                    .order('updated_at', { ascending: false });

                if (error) throw error;
                setProperties(data || []);
                if (window.innerWidth >= 768 && data && data.length > 0) setSelectedProperty(data[0]);
            } catch (error) {
                console.error('Erro LAB:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProperties();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleSelect = (item: Property) => {
        setSelectedProperty(item);
    };

    const handleBack = () => {
        setSelectedProperty(null);
    };

    const filteredProperties = properties.filter(p => {
        const nome = p.form_data?.secao_1_descricao_propriedade?.nome_propriedade || p.nome_identificador || "";
        return nome.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="fixed inset-0 overflow-hidden bg-slate-950 flex font-sans selection:bg-emerald-500/30">
            {/* Ambient Background Blocks */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-900/20 rounded-full blur-[120px] pointer-events-none" />

            {/* Sidebar (Desktop) */}
            {!isMobile && (
                <aside className="w-24 bg-slate-900/40 backdrop-blur-3xl border-r border-white/5 flex flex-col items-center py-8 z-20">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center font-black text-emerald-950 text-xl mb-12 shadow-lg shadow-emerald-500/20">
                        Ag
                    </div>
                    <nav className="flex-1 flex flex-col">
                        <SidebarItem icon={LayoutDashboard} label="Dashboard" />
                        <SidebarItem icon={MapIcon} label="Mapa" active />
                        <SidebarItem icon={Sprout} label="Culturas" />
                        <SidebarItem icon={ClipboardList} label="Cadernos" />
                        <SidebarItem icon={Settings} label="Configurações" />
                    </nav>
                    <button className="p-3.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-2xl transition-all">
                        <LogOut size={24} />
                    </button>
                </aside>
            )}

            {/* Property List / Drawer */}
            {(!isMobile || (isMobile && !selectedProperty)) && (
                <section className={cn(
                    "bg-slate-900/60 backdrop-blur-2xl flex flex-col p-6 z-10 border-r border-white/5 transition-all duration-300",
                    isMobile ? "w-full h-full" : "w-[380px]"
                )}>
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-xl font-black text-white tracking-tight">Minhas Propriedades</h2>
                        <div className="flex gap-2">
                            <button className="p-2.5 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/5">
                                <Filter size={18} />
                            </button>
                            <button className="p-2.5 bg-emerald-500 text-emerald-950 hover:bg-emerald-400 rounded-xl transition-all shadow-lg shadow-emerald-500/20">
                                <Plus size={18} strokeWidth={3} />
                            </button>
                        </div>
                    </div>

                    <div className="relative mb-8 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar propriedade..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-800/50 border border-white/5 hover:border-white/10 focus:border-emerald-500/50 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-slate-500 outline-none transition-all"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-3">
                                <Loader2 className="animate-spin text-emerald-500" size={32} />
                                <span className="text-sm font-bold uppercase tracking-widest opacity-50">Carregando...</span>
                            </div>
                        ) : filteredProperties.length === 0 ? (
                            <div className="text-center py-12 bg-white/5 rounded-3xl border border-dashed border-white/10">
                                <Sprout className="mx-auto text-slate-600 mb-4 opacity-30" size={48} />
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Nenhuma propriedade</p>
                            </div>
                        ) : (
                            filteredProperties.map((item) => {
                                const nome = item.form_data?.secao_1_descricao_propriedade?.nome_propriedade || item.nome_identificador || "Propriedade Sem Nome";
                                const isSelected = selectedProperty && String(selectedProperty.id) === String(item.id);

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSelect(item)}
                                        className={cn(
                                            "w-full text-left p-5 rounded-[2rem] transition-all flex justify-between items-center group",
                                            isSelected
                                                ? "bg-emerald-500/20 border-emerald-500/50 ring-1 ring-emerald-500/50"
                                                : "bg-white/5 border-transparent hover:bg-white/10 hover:translate-x-1"
                                        )}
                                    >
                                        <div className="flex flex-col">
                                            <span className={cn(
                                                "font-bold text-base tracking-tight transition-colors",
                                                isSelected ? "text-emerald-400" : "text-slate-200 group-hover:text-white"
                                            )}>
                                                {nome}
                                            </span>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                                                {new Date(item.updated_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {isSelected && (
                                            <span className="px-2.5 py-1 bg-emerald-500 text-emerald-950 text-[10px] font-black rounded-lg uppercase tracking-wider animate-in fade-in zoom-in duration-300">
                                                Visível
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </section>
            )}

            {/* Workspace / Map Area */}
            {(!isMobile || (isMobile && selectedProperty)) && (
                <main className="flex-1 relative overflow-hidden flex items-center justify-center bg-slate-900/30">
                    {isMobile && (
                        <button
                            onClick={handleBack}
                            className="absolute top-6 left-6 z-30 p-4 bg-white text-slate-900 rounded-[2rem] shadow-2xl active:scale-90 transition-transform flex items-center gap-2 font-bold text-sm"
                        >
                            <ArrowLeft size={20} strokeWidth={3} />
                            Voltar
                        </button>
                    )}

                    {selectedProperty ? (
                        <div className="text-center p-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-4xl md:text-5xl font-black text-white text-shadow-lg mb-4 tracking-tighter">
                                📍 {selectedProperty.form_data?.secao_1_descricao_propriedade?.nome_propriedade || selectedProperty.nome_identificador || 'Propriedade Selecionada'}
                            </h3>
                            <p className="text-emerald-400 font-mono text-sm tracking-widest uppercase mb-12">ID: {selectedProperty.id}</p>

                            <div className="p-10 md:p-16 border-2 border-dashed border-white/10 rounded-[3rem] bg-white/5 backdrop-blur-sm relative group hover:border-emerald-500/30 transition-all">
                                <Globe className="mx-auto text-white/20 mb-6 group-hover:text-emerald-500/40 transition-colors" size={96} strokeWidth={1} />
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] max-w-[200px] mx-auto leading-relaxed">
                                    Componente de Mapa (React Leaflet) será injetado aqui.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center opacity-20">
                            <Globe className="mx-auto text-white mb-8" size={160} strokeWidth={0.5} />
                            <h4 className="text-2xl font-black text-white uppercase tracking-[0.2em]">Selecione uma propriedade</h4>
                        </div>
                    )}

                    {/* Map Controls (Desktop) */}
                    {!isMobile && (
                        <div className="absolute bottom-10 right-10 flex flex-col gap-3">
                            {[
                                { icon: ZoomIn, label: 'Zoom In' },
                                { icon: ZoomOut, label: 'Zoom Out' },
                                { icon: Crosshair, label: 'My Location', active: true }
                            ].map((ctrl, i) => (
                                <button
                                    key={i}
                                    className={cn(
                                        "p-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 text-white hover:bg-white/20 shadow-xl transition-all active:scale-95",
                                        ctrl.active && "text-emerald-400 border-emerald-500/30"
                                    )}
                                >
                                    <ctrl.icon size={24} />
                                </button>
                            ))}
                        </div>
                    )}
                </main>
            )}
        </div>
    );
};

export default DesignLab;
