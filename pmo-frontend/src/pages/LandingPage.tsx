import React from 'react';
import { Button } from '@mui/material';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ChatIcon from '@mui/icons-material/Chat';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import SpeedIcon from '@mui/icons-material/Speed';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import heroIllustration from '../assets/illustrations/hero-illustration.svg';
import complianceIllustration from '../assets/illustrations/compliance-illustration.svg';
import productivityIllustration from '../assets/illustrations/productivity-illustration.svg';

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 relative overflow-x-hidden font-sans text-slate-900">
            {/* Background Atmosphere (Absolute Blobs) */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-green-200/40 rounded-full blur-[100px] mix-blend-multiply opacity-70 animate-blob"></div>
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-200/40 rounded-full blur-[100px] mix-blend-multiply opacity-70 animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-[-20%] left-[20%] w-[600px] h-[600px] bg-green-100/40 rounded-full blur-[120px] mix-blend-multiply opacity-70 animate-blob animation-delay-4000"></div>
            </div>

            {/* AppBar (Glassmorphism) */}
            <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-white/20 shadow-sm transition-all duration-300">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3 group cursor-pointer transition-transform duration-300 hover:scale-[1.02]">
                        <div className="p-2 bg-gradient-to-br from-green-600 to-green-700 rounded-xl shadow-lg shadow-green-600/20 text-white">
                            <AgricultureIcon fontSize="medium" />
                        </div>
                        <span className="text-xl font-extrabold tracking-tight text-slate-900 group-hover:text-green-800 transition-colors">
                            Manejo Orgânico
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        {user ? (
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => navigate('/dashboard')}
                                className="!rounded-full !px-6 !py-2 !shadow-lg !shadow-green-500/30 !hover:shadow-green-500/50 !transition-all !duration-300 !transform !hover:-translate-y-0.5"
                            >
                                Dashboard
                            </Button>
                        ) : (
                            <>
                                <Button
                                    color="inherit"
                                    onClick={() => navigate('/login')}
                                    className="!font-medium !text-slate-600 !hover:text-slate-900 !rounded-full !px-5"
                                >
                                    Login
                                </Button>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => navigate('/cadastro')}
                                    className="!rounded-full !px-6 !py-2.5 !bg-gradient-to-r !from-green-600 !to-green-700 !shadow-lg !shadow-green-600/30 !hover:shadow-green-600/50 !transition-all !duration-300 !transform !hover:-translate-y-0.5"
                                >
                                    Começar Grátis
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative z-10 pt-20 pb-24 md:pt-32 md:pb-32 overflow-hidden">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-100 text-green-700 text-sm font-semibold mb-8 animate-fade-in-up">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                Solução Completa para Produtores Orgânicos
                            </div>

                            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight text-slate-900">
                                Gestão Agrícola <br />
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-600 via-green-500 to-green-700">
                                    Simples e Orgânica
                                </span>
                            </h1>

                            <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed max-w-lg">
                                Centralize sua produção, garanta conformidade legal e tome decisões inteligentes. Tudo integrado ao seu WhatsApp.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-5">
                                {user ? (
                                    <Button
                                        variant="contained"
                                        size="large"
                                        onClick={() => navigate('/dashboard')}
                                        className="!rounded-full !px-10 !py-4 !text-lg !font-bold !bg-green-600 !shadow-xl !shadow-green-600/30 !hover:shadow-green-600/50 !hover:-translate-y-1 !transition-all"
                                    >
                                        Acessar Meu Painel
                                    </Button>
                                ) : (
                                    <Button
                                        variant="contained"
                                        size="large"
                                        onClick={() => navigate('/cadastro')}
                                        className="!rounded-full !px-10 !py-4 !text-lg !font-bold !bg-green-600 !shadow-xl !shadow-green-600/30 !hover:shadow-green-600/50 !hover:-translate-y-1 !transition-all"
                                    >
                                        Criar Conta Grátis
                                    </Button>
                                )}
                                <Button
                                    variant="outlined"
                                    size="large"
                                    onClick={() => navigate('/login')}
                                    className="!rounded-full !px-10 !py-4 !text-lg !font-bold !border-2 !border-slate-200 !text-slate-700 !hover:border-slate-300 !hover:bg-slate-50 !transition-all"
                                >
                                    {user ? 'Sair' : 'Ver Demo'}
                                </Button>
                            </div>

                            <div className="mt-12 flex items-center gap-4 text-sm text-slate-500 font-medium">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200" />
                                    ))}
                                </div>
                                <div>
                                    <span className="text-slate-900 font-bold">+500</span> produtores confiam
                                </div>
                            </div>
                        </div>

                        <div className="relative hidden lg:flex justify-center items-center">
                            <div className="absolute inset-0 bg-gradient-to-tr from-green-200/30 to-blue-200/30 rounded-full blur-3xl transform rotate-12 scale-90"></div>
                            <img
                                src={heroIllustration}
                                alt="Dashboard Agrícola"
                                className="relative z-10 w-full max-w-xl h-auto object-contain drop-shadow-2xl animate-float-slow transition-transform hover:scale-105 duration-700"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section (Cards with High-End Hover) */}
            <section className="py-24 relative z-10 bg-white/50 backdrop-blur-sm">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16 max-w-2xl mx-auto">
                        <span className="text-green-600 font-bold tracking-wider uppercase text-sm mb-3 block">Recursos Principais</span>
                        <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
                            Tudo o que você precisa para crescer
                        </h2>
                        <p className="text-lg text-slate-600">
                            Ferramentas poderosas desenhadas especificamente para a realidade da agricultura familiar e orgânica.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 cursor-default">
                        {/* Card 1 */}
                        <div className="group relative bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-2 hover:border-green-500/30 transition-all duration-300">
                            <div className="absolute inset-0 bg-green-50/50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-100 group-hover:scale-110 transition-all duration-300">
                                    <ChatIcon className="text-blue-600 text-3xl" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-green-700 transition-colors">Bot Inteligente</h3>
                                <p className="text-slate-600 leading-relaxed text-sm md:text-base">
                                    Registre atividades conversando no WhatsApp como se falasse com um agrônomo. Simples, rápido e sem instalar apps extras.
                                </p>
                            </div>
                        </div>

                        {/* Card 2 */}
                        <div className="group relative bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-2 hover:border-green-500/30 transition-all duration-300">
                            <div className="absolute inset-0 bg-green-50/50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-green-100 group-hover:scale-110 transition-all duration-300">
                                    <DashboardIcon className="text-green-600 text-3xl" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-green-700 transition-colors">Painel de Controle</h3>
                                <p className="text-slate-600 leading-relaxed text-sm md:text-base">
                                    Visualize sua produção em tempo real. Gráficos de colheita, custos e insumos gerados automaticamente pelo sistema.
                                </p>
                            </div>
                        </div>

                        {/* Card 3 */}
                        <div className="group relative bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-2 hover:border-green-500/30 transition-all duration-300">
                            <div className="absolute inset-0 bg-green-50/50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-100 group-hover:scale-110 transition-all duration-300">
                                    <VerifiedUserIcon className="text-purple-600 text-3xl" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-green-700 transition-colors">100% Auditável</h3>
                                <p className="text-slate-600 leading-relaxed text-sm md:text-base">
                                    Esteja sempre pronto para auditorias. Relatórios de rastreabilidade e conformidade com a Lei 10.831 em um clique.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits 1 */}
            <section className="py-24 relative z-10 bg-white">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
                        <div className="w-full lg:w-1/2">
                            <div className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold tracking-wide uppercase mb-4">
                                Conformidade Legal
                            </div>
                            <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight leading-tight">
                                Durma tranquilo com sua <span className="text-green-600">Certificação</span>
                            </h2>
                            <p className="text-lg text-slate-600 leading-relaxed mb-6">
                                Sabemos que a papelada é a parte mais chata da produção orgânica. Automatizamos a documentação de rastreabilidade para você não perder tempo.
                            </p>
                            <ul className="space-y-4 mb-8">
                                {[
                                    'Histórico completo de manejo por canteiro',
                                    'Rastreabilidade total do insumo à colheita',
                                    'Relatórios prontos para OCS ou Auditoria'
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-slate-700 font-medium">
                                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                            <VerifiedUserIcon sx={{ fontSize: 16 }} />
                                        </div>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="w-full lg:w-1/2 flex justify-center transform hover:scale-[1.02] transition-transform duration-500">
                            <img src={complianceIllustration} alt="Conformidade Legal" className="w-full max-w-md h-auto object-contain drop-shadow-2xl" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits 2 */}
            <section className="py-24 relative z-10 bg-slate-50">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col lg:flex-row-reverse items-center gap-16 lg:gap-24">
                        <div className="w-full lg:w-1/2">
                            <div className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold tracking-wide uppercase mb-4">
                                Produtividade
                            </div>
                            <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight leading-tight">
                                Mais tempo no campo, <br /> menos no escritório
                            </h2>
                            <p className="text-lg text-slate-600 leading-relaxed mb-8">
                                Produtores que usam o Manejo Orgânico economizam em média 20 horas por mês em tarefas administrativas.
                            </p>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                                    <span className="block text-4xl font-extrabold text-green-600 mb-2">+40%</span>
                                    <span className="text-slate-500 font-medium text-sm">Eficiência Operacional</span>
                                </div>
                                <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                                    <span className="block text-4xl font-extrabold text-blue-600 mb-2">-20h</span>
                                    <span className="text-slate-500 font-medium text-sm">Tempo Admin/Mês</span>
                                </div>
                            </div>
                        </div>
                        <div className="w-full lg:w-1/2 flex justify-center transform hover:scale-[1.02] transition-transform duration-500">
                            <img src={productivityIllustration} alt="Produtividade" className="w-full max-w-md h-auto object-contain drop-shadow-2xl" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 text-white py-16 relative z-10 border-t border-slate-800">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
                        <div className="col-span-1 md:col-span-1">
                            <div className="flex items-center gap-2 mb-6">
                                <AgricultureIcon className="text-green-500" fontSize="large" />
                                <span className="text-xl font-bold tracking-tight">Manejo Orgânico</span>
                            </div>
                            <p className="text-slate-400 text-sm leading-relaxed mb-6">
                                Fortalecendo a agricultura orgânica com tecnologia acessível e inteligente.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold mb-6 text-white tracking-wide">Produto</h4>
                            <ul className="space-y-3 text-sm text-slate-400">
                                <li className="hover:text-green-400 cursor-pointer transition-colors block w-fit">Recursos</li>
                                <li className="hover:text-green-400 cursor-pointer transition-colors block w-fit">Preços</li>
                                <li className="hover:text-green-400 cursor-pointer transition-colors block w-fit">Depoimentos</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold mb-6 text-white tracking-wide">Segurança</h4>
                            <ul className="space-y-3 text-sm text-slate-400">
                                <li className="hover:text-green-400 cursor-pointer transition-colors block w-fit">Termos de Uso</li>
                                <li className="hover:text-green-400 cursor-pointer transition-colors block w-fit">Privacidade</li>
                                <li className="hover:text-green-400 cursor-pointer transition-colors block w-fit">LGPD</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold mb-6 text-white tracking-wide">Contato</h4>
                            <ul className="space-y-3 text-sm text-slate-400">
                                <li className="hover:text-green-400 cursor-pointer transition-colors block w-fit">Suporte WhatsApp</li>
                                <li className="hover:text-green-400 cursor-pointer transition-colors block w-fit">Email</li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-slate-800 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-slate-500">
                        <p>© {new Date().getFullYear()} Manejo Orgânico App. Todos os direitos reservados.</p>
                        <div className="flex gap-4 mt-4 md:mt-0">
                            {/* Social Icons Placeholders */}
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
