import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { executeOnboarding } from '../services/onboardingService';
import { Loader2, ArrowRight, CheckCircle2, Sprout, Tractor, User } from 'lucide-react';
import { toast } from 'react-toastify';
import { clsx } from 'clsx';
import { podeCriarPropriedade } from '../utils/limitesCultivo';

const STEPS = {
  WELCOME: 1,
  PROPERTY: 2,
  TALHAO: 3,
  FINISHING: 4,
};

const OnboardingPage: React.FC = () => {
  const { user, profile, allPropriedades, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  // Security Check: If user already has 1+ properties and is seed plan, block this page
  useEffect(() => {
    if (allPropriedades.length > 0) {
      const { can, message } = podeCriarPropriedade(profile, allPropriedades.length);
      if (!can) {
        toast.info(message, {
          icon: <span>🌱</span>
        });
        navigate('/hub', { replace: true });
      }
    }
  }, [allPropriedades, profile, navigate]);

  const [step, setStep] = useState(STEPS.WELCOME);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [fullName, setFullName] = useState('');
  const [propName, setPropName] = useState('');
  const [areaHa, setAreaHa] = useState<string>('');
  const [talhaoName, setTalhaoName] = useState('');

  // Auto-focus first input on step change
  useEffect(() => {
    const timer = setTimeout(() => {
      const input = document.querySelector('input:not([type="hidden"])') as HTMLInputElement;
      if (input) input.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, [step]);

  const handleNext = () => {
    if (step < STEPS.FINISHING) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > STEPS.WELCOME) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const result = await executeOnboarding({
        userId: user.id,
        fullName,
        propName,
        areaHa: parseFloat(areaHa),
        talhaoName,
      });

      if (result.success) {
        toast.success('Onboarding concluído com sucesso!');
        await refreshProfile(); // Force updating AuthContext
        navigate('/home');
      } else {
        toast.error(`Erro: ${result.error}`);
      }
    } catch (error) {
      console.error('Onboarding failed:', error);
      toast.error('Ocorreu um erro inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  const isNextDisabled = () => {
    if (step === STEPS.WELCOME) return !fullName.trim();
    if (step === STEPS.PROPERTY) return !propName.trim() || !areaHa || parseFloat(areaHa) <= 0;
    if (step === STEPS.TALHAO) return !talhaoName.trim();
    return false;
  };

  // Progress Bar Width
  const progress = (step / Object.keys(STEPS).length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Progress Indicator */}
      <div className="absolute top-0 left-0 h-1 bg-green-200 w-full">
        <div 
          className="h-full bg-green-600 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-auto max-w-2xl">
          
          {/* Step 1: Welcome */}
          {step === STEPS.WELCOME && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mb-8 shadow-sm">
                <User className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-4 sm:text-5xl">
                Bem-vindo ao Manejo Digital
              </h1>
              <p className="text-xl text-slate-500 mb-12 max-w-lg">
                Para começar, como você gostaria de ser chamado profissionalmente?
              </p>
              
              <div className="w-full max-w-md">
                <label className="block text-sm font-medium text-slate-700 mb-2 sr-only">
                  Nome Completo
                </label>
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isNextDisabled() && handleNext()}
                  className="w-full text-2xl py-4 px-0 bg-transparent border-b-2 border-slate-200 focus:border-green-600 outline-none transition-colors placeholder:text-slate-300"
                />
              </div>
            </div>
          )}

          {/* Step 2: Property */}
          {step === STEPS.PROPERTY && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mb-8 shadow-sm">
                <Tractor className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-4">
                Sua Fazenda
              </h1>
              <p className="text-xl text-slate-500 mb-12 max-w-lg">
                Dê um nome para sua propriedade e nos diga a área total aproximada.
              </p>
              
              <div className="w-full max-w-md space-y-8">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1 text-left uppercase tracking-wider">
                    Nome da Propriedade
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Fazenda Santa Fé"
                    value={propName}
                    onChange={(e) => setPropName(e.target.value)}
                    className="w-full text-2xl py-2 bg-transparent border-b-2 border-slate-200 focus:border-green-600 outline-none transition-colors placeholder:text-slate-300"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1 text-left uppercase tracking-wider">
                    Área Total (Hectares)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={areaHa}
                      onChange={(e) => setAreaHa(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !isNextDisabled() && handleNext()}
                      className="w-full text-2xl py-2 bg-transparent border-b-2 border-slate-200 focus:border-green-600 outline-none transition-colors placeholder:text-slate-300"
                    />
                    <span className="absolute right-0 bottom-2 text-slate-400 text-lg italic">ha</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Talhão */}
          {step === STEPS.TALHAO && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mb-8 shadow-sm">
                <Sprout className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-4">
                Primeiro Talhão
              </h1>
              <p className="text-xl text-slate-500 mb-12 max-w-md">
                Todo plantio começa por um talhão ou canteiro. Vamos dar um nome ao primeiro?
              </p>
              
              <div className="w-full max-w-md">
                <label className="block text-sm font-medium text-slate-700 mb-2 sr-only">
                  Nome do Talhão
                </label>
                <input
                  type="text"
                  placeholder="Ex: Horta 01, Setor Norte..."
                  value={talhaoName}
                  onChange={(e) => setTalhaoName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isNextDisabled() && handleSubmit()}
                  className="w-full text-2xl py-4 bg-transparent border-b-2 border-slate-200 focus:border-green-600 outline-none transition-colors placeholder:text-slate-300"
                />
              </div>
            </div>
          )}

          {/* Step 4: Finishing */}
          {step === STEPS.FINISHING && (
            <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center mb-8 shadow-lg">
                <CheckCircle2 className="w-14 h-14 text-white" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-4">
                Quase Pronto!
              </h1>
              <p className="text-xl text-slate-500 mb-12 max-w-sm">
                Estamos preparando seu ambiente. Vamos cultivar essa ideia?
              </p>
              
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className={clsx(
                  "w-full max-w-md py-4 rounded-xl text-lg font-bold shadow-md transition-all flex items-center justify-center gap-3",
                  isLoading 
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                    : "bg-green-600 text-white hover:bg-green-700 hover:-translate-y-1 active:scale-95 shadow-green-200"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  <>
                    Começar Produção
                    <ArrowRight className="w-6 h-6" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Navigation Controls */}
          {step < STEPS.FINISHING && (
            <div className="mt-20 flex items-center justify-between">
              <button
                onClick={handleBack}
                className={clsx(
                  "px-6 py-2 text-slate-400 font-medium hover:text-slate-600 transition-colors",
                  step === STEPS.WELCOME ? "invisible" : ""
                )}
              >
                Voltar
              </button>
              
              <button
                onClick={handleNext}
                disabled={isNextDisabled()}
                className={clsx(
                  "px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all",
                  isNextDisabled()
                    ? "text-slate-300 bg-slate-100 cursor-not-allowed"
                    : "text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100 scale-105"
                )}
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Footer Decoration */}
      <footer className="p-8 flex justify-center opacity-30 select-none pointer-events-none">
        <span className="text-sm font-medium tracking-widest uppercase text-slate-400">
          Manejo Digital &copy; 2026
        </span>
      </footer>
    </div>
  );
};

export default OnboardingPage;
