import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Tractor,
    LayoutDashboard,
    MessageSquare,
    ShieldCheck,
    ArrowRight,
    TrendingUp,
    Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import heroIllustration from '../assets/illustrations/hero-illustration.svg';

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-agro-creme text-agro-floresta font-sans selection:bg-agro-ouro/30 selection:text-agro-floresta relative overflow-hidden bg-grain">
            {/* AppBar / Navigation */}
            <header className="sticky top-0 z-50 bg-agro-creme/80 backdrop-blur-md border-b border-agro-floresta/5">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                        <div className="p-2 bg-agro-floresta rounded-lg text-agro-creme transition-transform duration-500 group-hover:rotate-12">
                            < Tractor size={24} />
                        </div>
                        <span className="text-xl font-serif font-bold tracking-tight">
                            Manejo<span className="text-agro-ouro">Org</span>
                        </span>
                    </div>
                    
                    <nav className="flex items-center gap-8">
                        {user ? (
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="bg-agro-floresta text-agro-creme px-6 py-2 rounded-full font-semibold hover:shadow-xl hover:shadow-agro-floresta/20 transition-all duration-300"
                            >
                                Dashboard
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="text-agro-floresta/80 hover:text-agro-floresta font-medium transition-colors"
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => navigate('/cadastro')}
                                    className="bg-agro-floresta text-agro-creme px-6 py-2.5 rounded-full font-bold hover:shadow-xl hover:shadow-agro-floresta/20 -translate-y-0.5 transition-all duration-300"
                                >
                                    Começar Agora
                                </button>
                            </>
                        )}
                    </nav>
                </div>
            </header>

            {/* SECTION: HERO */}
            <section className="relative pt-20 pb-32 lg:pt-32 lg:pb-48">
                <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
                    <div className="max-w-3xl">
                        <span className="inline-block text-agro-ouro font-bold tracking-[0.2em] uppercase text-xs mb-6 px-4 py-1.5 border border-agro-ouro/20 rounded-full bg-agro-ouro/5 animate-reveal active">
                            ManejoOrg • Inteligência Agronômica
                        </span>
                        
                        <h1 className="text-5xl lg:text-8xl text-agro-floresta leading-[1.05] tracking-tight mb-8 animate-reveal active transition-delay-200">
                            Sustentabilidade Rural & <br />
                            <span className="italic font-normal">Futuro no Campo</span>
                        </h1>
                        
                        <p className="text-xl text-agro-floresta/70 mb-12 leading-relaxed max-w-xl animate-reveal active transition-delay-400">
                            A tecnologia ideal para gestão agroecológica, orgânica e convencional sustentável. Transforme seus dados em rentabilidade real.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-6 animate-reveal active transition-delay-600">
                            <button 
                                onClick={() => navigate('/cadastro')}
                                className="group bg-agro-floresta text-agro-creme px-10 py-5 rounded-full font-bold text-lg hover:shadow-2xl hover:shadow-agro-floresta/30 transition-all duration-500 flex items-center justify-center gap-3"
                            >
                                Iniciar Gestão Inteligente
                                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button 
                                onClick={() => navigate('/login')}
                                className="bg-transparent border border-agro-floresta/20 text-agro-floresta px-10 py-5 rounded-full font-bold text-lg hover:bg-agro-floresta/5 transition-all duration-500"
                            >
                                Ver Demonstração
                            </button>
                        </div>
                    </div>
                    
                    <div className="relative hidden lg:block animate-reveal active transition-delay-800">
                        <div className="absolute inset-0 bg-agro-ouro/10 rounded-full blur-[120px] -z-10 animate-pulse"></div>
                        <img 
                            src={heroIllustration} 
                            alt="ManejoOrg Dashboard" 
                            className="w-full drop-shadow-[0_32px_64px_rgba(26,60,52,0.15)] rounded-2xl grayscale-[0.2] hover:grayscale-0 transition-all duration-700"
                        />
                    </div>
                </div>
            </section>

            {/* SECTION: EFICIÊNCIA ECONÔMICA */}
            <section className="bg-white border-y border-agro-ouro/10 py-32 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-agro-creme/30 -skew-x-12 translate-x-1/2"></div>
                
                <div className="container mx-auto px-6 grid md:grid-cols-2 gap-24 items-center relative z-10">
                    <div>
                        <div className="flex items-center gap-3 text-agro-ouro mb-6">
                            <TrendingUp size={24} />
                            <span className="font-bold uppercase tracking-widest text-sm">Rentabilidade</span>
                        </div>
                        <h2 className="text-4xl lg:text-6xl text-agro-floresta mb-8 leading-tight">
                            Eficiência Econômica: <br /> 
                            <span className="font-normal italic">Resultado que fertiliza o lucro.</span>
                        </h2>
                        <p className="text-lg text-agro-floresta/70 leading-relaxed mb-10 max-w-lg">
                            A inteligência artificial do ManejoOrg não apenas monitora o campo, ela orquestra o custo de produção. Reduzimos o desperdício de insumos através de prescrições de alta precisão, provando que a sustentabilidade é o motor da margem líquida.
                        </p>
                        
                        <div className="grid grid-cols-2 gap-10">
                            <div className="border-l-4 border-agro-ouro pl-6 py-2">
                                <span className="block text-4xl font-serif text-agro-floresta font-bold mb-1">15%</span>
                                <span className="text-xs text-agro-floresta/50 uppercase tracking-[0.2em] font-bold">Redução de Custos</span>
                            </div>
                            <div className="border-l-4 border-agro-ouro pl-6 py-2">
                                <span className="block text-4xl font-serif text-agro-floresta font-bold mb-1">22%</span>
                                <span className="text-xs text-agro-floresta/50 uppercase tracking-[0.2em] font-bold">Aumento de Margem</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-agro-creme p-12 rounded-3xl border border-agro-ouro/10 shadow-[0_20px_50px_rgba(197,160,89,0.1)] group">
                        <div className="h-80 flex flex-col items-center justify-center border-2 border-dashed border-agro-ouro/20 rounded-2xl text-agro-floresta/30 italic group-hover:border-agro-ouro/40 transition-colors duration-500">
                            <Zap size={48} className="mb-4 text-agro-ouro/40 group-hover:scale-110 transition-transform duration-500" />
                            <span className="text-center px-12">Visualização Avançada de Retorno sobre Investimento (ROI) Integrado</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION: RECURSOS (EDITORIAL CARDS) */}
            <section className="py-32">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
                        <div className="max-w-xl">
                            <h2 className="text-4xl lg:text-5xl text-agro-floresta mb-6 tracking-tight">
                                Tecnologia desenhada para cada <span className="italic">hectare.</span>
                            </h2>
                        </div>
                        <div className="pb-2">
                            <p className="text-agro-floresta/60 max-w-xs text-right hidden md:block">
                                Desenvolvemos ferramentas que respeitam o ritmo da terra e as exigências do mercado global.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {[
                            {
                                icon: <MessageSquare size={32} />,
                                title: "Agente Inteligente",
                                desc: "Registre atividades conversando no WhatsApp. Uma ponte fluida entre o campo e os dados."
                            },
                            {
                                icon: <LayoutDashboard size={32} />,
                                title: "Editorial de Dados",
                                desc: "Visualize sua produção com clareza editorial. Gráficos que contam a história da sua safra."
                            },
                            {
                                icon: <ShieldCheck size={32} />,
                                title: "Rastreabilidade Pura",
                                desc: "Conformidade total e instantânea. Esteja sempre pronto para auditorias e certificações."
                            }
                        ].map((item, idx) => (
                            <div key={idx} className="group p-10 bg-white/50 border border-agro-floresta/5 hover:bg-white hover:border-agro-ouro/20 hover:shadow-2xl hover:shadow-agro-ouro/10 transition-all duration-500 rounded-2xl">
                                <div className="text-agro-ouro mb-8 group-hover:scale-110 transition-transform duration-500 origin-left">
                                    {item.icon}
                                </div>
                                <h3 className="text-2xl text-agro-floresta mb-4">{item.title}</h3>
                                <p className="text-agro-floresta/60 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-agro-floresta text-agro-creme pt-24 pb-12">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-20 mb-20">
                        <div className="col-span-1 md:col-span-1">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-1.5 bg-agro-creme rounded text-agro-floresta">
                                    <Tractor size={20} />
                                </div>
                                <span className="text-xl font-serif font-bold">Manejo<span className="text-agro-ouro">Org</span></span>
                            </div>
                            <p className="text-agro-creme/60 leading-relaxed text-sm">
                                Elevando o padrão da agricultura sustentável por meio da inteligência agronômica avançada.
                            </p>
                        </div>
                        
                        {["Negócios", "Transparência", "Suporte"].map((cat, i) => (
                            <div key={i}>
                                <h4 className="text-agro-ouro font-bold uppercase tracking-widest text-xs mb-8">{cat}</h4>
                                <ul className="space-y-4 text-sm text-agro-creme/50">
                                    <li className="hover:text-agro-creme cursor-pointer transition-colors">Funcionalidades</li>
                                    <li className="hover:text-agro-creme cursor-pointer transition-colors">Termos de Uso</li>
                                    <li className="hover:text-agro-creme cursor-pointer transition-colors">Privacidade</li>
                                </ul>
                            </div>
                        ))}
                    </div>
                    
                    <div className="pt-12 border-t border-agro-creme/5 flex flex-col md:flex-row justify-between items-center text-xs text-agro-creme/40 tracking-widest uppercase">
                        <p>© {new Date().getFullYear()} Manejo<span className="text-agro-ouro">Org</span>. Todos os direitos reservados.</p>
                        <p className="mt-4 md:mt-0 italic font-serif">Cultivando o agro sustentável.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
