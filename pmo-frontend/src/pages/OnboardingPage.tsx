import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sprout, Tractor, User, MapPin, Building2, MoreHorizontal, Search, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import Map, { Marker, GeolocateControl, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { toast } from 'react-toastify';

import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { ESRI_SATELLITE_STYLE } from '../components/Map/mapStyles';
import { podeCriarPropriedade } from '../utils/limitesCultivo';

const STEPS = {
  PROFILE: 1,
  CROPS: 2,
  MODALITY: 3,
  LOCATION: 4,
};

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, allPropriedades, refreshProfile } = useAuth();
  
  const [step, setStep] = useState(STEPS.PROFILE);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [selectedModality, setSelectedModality] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  const desktopMapRef = useRef<MapRef>(null);
  const mobileMapRef = useRef<MapRef>(null);
  const isMapStep = step === STEPS.LOCATION;

  // Intercept ?token=XYZ
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (token) {
      console.log('Token de onboarding detectado, configurando sessão efêmera...');
      supabase.auth.setSession({ access_token: token, refresh_token: '' })
        .then(({ error }) => {
          if (error) {
            console.error('Erro ao configurar sessão via token:', error);
            toast.error('Token de acesso inválido ou expirado.');
          } else {
            toast.info('Sessão segura iniciada.');
          }
        });
      
      // Limpa a URL para não deixar o token visível
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Security Check
  useEffect(() => {
    if (allPropriedades.length > 0) {
      const { can, message } = podeCriarPropriedade(profile, allPropriedades.length);
      if (!can) {
        toast.info(message, { icon: <span>🌱</span> });
        navigate('/hub', { replace: true });
      }
    }
  }, [allPropriedades, profile, navigate]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    
    // 1. Verifica coordenadas diretas
    const coordMatch = query.match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        desktopMapRef.current?.flyTo({ center: [lon, lat], zoom: 15, duration: 2000 });
        mobileMapRef.current?.flyTo({ center: [lon, lat], zoom: 15, duration: 2000 });
        setSelectedLocation({ lat, lng: lon });
        setSearchQuery("");
        return;
      }
    }

    // 2. Google Maps Link
    const gmapsMatch = query.match(/@([-+]?\d{1,2}\.\d+),([-+]?\d{1,3}\.\d+)/);
    if (gmapsMatch) {
      const lat = parseFloat(gmapsMatch[1]);
      const lon = parseFloat(gmapsMatch[2]);
      desktopMapRef.current?.flyTo({ center: [lon, lat], zoom: 15, duration: 2000 });
      mobileMapRef.current?.flyTo({ center: [lon, lat], zoom: 15, duration: 2000 });
      setSelectedLocation({ lat, lng: lon });
      setSearchQuery("");
      return;
    }

    // 3. Fallback Nominatim
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        desktopMapRef.current?.flyTo({ center: [lon, lat], zoom: 12, duration: 2000 });
        mobileMapRef.current?.flyTo({ center: [lon, lat], zoom: 12, duration: 2000 });
      } else {
        toast.error("Local não encontrado.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro na busca.");
    } finally {
      setIsSearching(false);
    }
  };

  const crops = [
    { id: 'horta', label: 'Hortaliças', icon: '🥬' },
    { id: 'frutiferas', label: 'Frutíferas', icon: '🍎' },
    { id: 'madeira', label: 'Madeira/Eucalipto', icon: '🌲' },
    { id: 'graos', label: 'Grãos', icon: '🌾' },
    { id: 'saf', label: 'Sistemas Agroflorestais', icon: '🌳' }
  ];

  const profiles_list = [
    { id: 'familiar', label: 'Produtor Rural / Fazenda Familiar', desc: 'Cultivo minha terra.', icon: <Sprout className="w-6 h-6" /> },
    { id: 'comercial', label: 'Fazenda Comercial', desc: 'Trabalho em uma fazenda comercial.', icon: <Tractor className="w-6 h-6" /> },
    { id: 'empresa', label: 'Empresa do Agronegócio', desc: 'Trabalho em uma empresa agrícola.', icon: <Building2 className="w-6 h-6" /> },
    { id: 'consultor', label: 'Agrônomo / Consultor', desc: 'Aconselho produtores rurais.', icon: <User className="w-6 h-6" /> },
    { id: 'outro', label: 'Outro', desc: 'Estudante, hobbyista, jardineiro ou paisagista.', icon: <MoreHorizontal className="w-6 h-6" /> }
  ];

  const modalities = [
    { id: 'organico', label: 'Orgânico', desc: 'Produção 100% orgânica certificada.' },
    { id: 'conversao', label: 'Em Conversão', desc: 'Em transição monitorada.' },
    { id: 'convencional', label: 'Não Orgânico', desc: 'Uso de químicos ou sem certificação.' },
    { id: 'nao_sei', label: 'Ainda não sei', desc: 'Estou apenas conhecendo a plataforma.' }
  ];

  const toggleCrop = (id: string) => {
    if (selectedCrops.includes(id)) {
      setSelectedCrops(selectedCrops.filter(c => c !== id));
    } else {
      setSelectedCrops([...selectedCrops, id]);
    }
  };

  const isNextDisabled = () => {
    if (step === STEPS.PROFILE) return !selectedRole;
    if (step === STEPS.CROPS) return selectedCrops.length === 0;
    if (step === STEPS.MODALITY) return !selectedModality;
    if (step === STEPS.LOCATION) return !selectedLocation;
    return false;
  };

  const handleNext = async () => {
    if (step < Object.keys(STEPS).length) {
      setStep(step + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Sessão não encontrada ou expirada. Use o link mais recente enviado pelo bot.");

      // 1. Atualizar Profile
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          tipo_perfil: selectedRole,
          culturas_interesse: selectedCrops
        })
        .eq('id', currentUser.id);

      if (profileErr) throw new Error("Falha ao salvar perfil: " + profileErr.message);

      // 2. Inserir Propriedade
      const { data: prop, error: propErr } = await supabase
        .from('propriedades')
        .insert({
          nome: 'Sítio / Fazenda',
          latitude: selectedLocation?.lat,
          longitude: selectedLocation?.lng,
          user_id: currentUser.id
        })
        .select()
        .single();
        
      if (propErr) throw new Error("Falha ao criar propriedade: " + propErr.message);

      // 3. Atualizar Propriedade Ativa
      await supabase
        .from('profiles')
        .update({ propriedade_ativa_id: prop.id })
        .eq('id', currentUser.id);

      // 4. Inserir Talhão Default
      const modalidadeEnum = selectedModality === 'organico' ? 'ORGANICO' : 
                             selectedModality === 'conversao' ? 'EM_CONVERSAO' : 'CONVENCIONAL';
                             
      const { error: talhaoErr } = await supabase
        .from('talhoes')
        .insert({
          nome: 'Sede',
          propriedade_id: prop.id,
          user_id: currentUser.id,
          modalidade_producao: modalidadeEnum,
          area_ha: 0 // Valor placeholder
        });
        
      if (talhaoErr) throw new Error("Falha ao criar talhão inicial: " + talhaoErr.message);

      toast.success("Tudo certo! Redirecionando para seu painel...");
      await refreshProfile();
      navigate('/home');

    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Ocorreu um erro inesperado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* Lado Esquerdo - Visual/Fotografia/Mapa */}
      <div className={clsx(
        "hidden lg:flex relative bg-slate-900 overflow-hidden transition-all duration-700 ease-in-out",
        isMapStep ? "w-[70%]" : "w-[60%]"
      )}>
        {/* Imagens de fundo */}
        <div 
          className={clsx(
            "absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out z-0",
            isMapStep ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
          style={{ 
            backgroundImage: step === STEPS.PROFILE 
              ? 'url(https://images.pexels.com/photos/2165688/pexels-photo-2165688.jpeg?auto=compress&cs=tinysrgb&w=2000)' 
              : step === STEPS.CROPS
              ? 'url(https://images.pexels.com/photos/440731/pexels-photo-440731.jpeg?auto=compress&cs=tinysrgb&w=2000)'
              : 'url(https://images.pexels.com/photos/259280/pexels-photo-259280.jpeg?auto=compress&cs=tinysrgb&w=2000)'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/60 to-slate-900/10" />
        </div>

        {/* Desktop Map */}
        <div className={clsx(
          "absolute inset-0 z-10 transition-opacity duration-1000 delay-300",
          isMapStep ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          {isMapStep && (
            <Map
              ref={desktopMapRef}
              initialViewState={{ longitude: -50.0, latitude: -15.0, zoom: 3 }}
              mapStyle={ESRI_SATELLITE_STYLE as any}
              onClick={(e) => setSelectedLocation({ lng: e.lngLat.lng, lat: e.lngLat.lat })}
              cursor="crosshair"
            >
              <GeolocateControl position="bottom-right" trackUserLocation={false} />
              {selectedLocation && (
                <Marker longitude={selectedLocation.lng} latitude={selectedLocation.lat} anchor="bottom">
                  <div className="text-emerald-600 drop-shadow-md relative -top-2">
                    <MapPin className="w-12 h-12 fill-white stroke-emerald-700" strokeWidth={2} />
                  </div>
                </Marker>
              )}
            </Map>
          )}
        </div>
        
        <div className={clsx(
          "absolute bottom-12 left-12 text-white max-w-lg z-20 transition-opacity duration-500",
          isMapStep ? "opacity-0 pointer-events-none" : "opacity-100 animate-in fade-in slide-in-from-bottom-4"
        )}>
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            {step === STEPS.PROFILE && "Bem-vindo ao Manejo Digital."}
            {step === STEPS.CROPS && "O que você cultiva?"}
            {step === STEPS.MODALITY && "Como você maneja?"}
          </h2>
          <p className="text-lg text-slate-200 font-medium">
            {step === STEPS.PROFILE && "Junte-se a milhares de produtores que usam dados para colher mais com menos esforço."}
            {step === STEPS.CROPS && "Nossa IA se adapta ao seu tipo de manejo para entregar os melhores insights agronômicos."}
            {step === STEPS.MODALITY && "Orgânico ou convencional, o importante é ter controle. Configurações detalhadas podem ser ajustadas depois por talhão."}
          </p>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className={clsx(
        "w-full flex flex-col items-center justify-center p-8 sm:p-12 relative bg-white transition-all duration-700 ease-in-out",
        isMapStep ? "lg:w-[30%] shadow-2xl z-20" : "lg:w-[40%]"
      )}>
        
        <div className="absolute top-8 w-full px-12 flex items-center justify-between">
          <div className="text-sm font-bold tracking-tight text-emerald-700">
            manejoORG
          </div>
          <div className="text-xs font-semibold text-slate-400 tracking-wider">
            PASSO {step} DE {Object.keys(STEPS).length}
          </div>
        </div>

        <div className="w-full max-w-md mt-16">
          
          {/* STEP 1: PERFIL */}
          {step === STEPS.PROFILE && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h1 className="text-3xl font-bold tracking-tight mb-2">Como podemos te ajudar?</h1>
              <p className="text-slate-500 mb-8">Selecione o perfil que melhor descreve você.</p>
              
              <div className="space-y-3">
                {profiles_list.map((prof) => (
                  <button 
                    key={prof.id}
                    onClick={() => setSelectedRole(prof.id)}
                    className={clsx(
                      "w-full text-left p-4 rounded-[8px] border transition-all duration-200 flex items-center gap-4 group",
                      selectedRole === prof.id 
                        ? "border-emerald-600 bg-emerald-50 shadow-sm" 
                        : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                    )}
                  >
                    <div className={clsx(
                      "p-3 rounded-[6px] transition-colors flex-shrink-0",
                      selectedRole === prof.id ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 group-hover:text-emerald-600 group-hover:bg-emerald-100"
                    )}>
                      {prof.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-base">{prof.label}</h3>
                      <p className="text-sm text-slate-500 mt-0.5">{prof.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: CROPS */}
          {step === STEPS.CROPS && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h1 className="text-3xl font-bold tracking-tight mb-2">O que você maneja?</h1>
              <p className="text-slate-500 mb-8">Personalizaremos a plataforma para as suas culturas.</p>
              
              <div className="grid grid-cols-2 gap-4">
                {crops.map((crop) => (
                  <button
                    key={crop.id}
                    onClick={() => toggleCrop(crop.id)}
                    className={clsx(
                      "p-4 rounded-[8px] border transition-all duration-200 flex flex-col items-center justify-center gap-2 text-center",
                      selectedCrops.includes(crop.id)
                        ? "border-emerald-600 bg-emerald-50 shadow-sm text-emerald-900"
                        : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <span className="text-3xl mb-1 block">{crop.icon}</span>
                    <span className="font-medium text-sm">{crop.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: MODALITY */}
          {step === STEPS.MODALITY && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h1 className="text-3xl font-bold tracking-tight mb-2">Sua Preferência</h1>
              <p className="text-slate-500 mb-8">Como é a sua produção hoje? Você definirá o status oficial na criação de cada talhão mais tarde.</p>
              
              <div className="space-y-3">
                {modalities.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => setSelectedModality(mod.id)}
                    className={clsx(
                      "w-full text-left p-4 rounded-[8px] border transition-all duration-200 flex flex-col",
                      selectedModality === mod.id
                        ? "border-emerald-600 bg-emerald-50 shadow-sm"
                        : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                    )}
                  >
                    <span className={clsx(
                      "font-semibold text-base mb-1",
                      selectedModality === mod.id ? "text-emerald-900" : "text-slate-900"
                    )}>
                      {mod.label}
                    </span>
                    <span className={clsx(
                      "text-sm",
                      selectedModality === mod.id ? "text-emerald-700" : "text-slate-500"
                    )}>
                      {mod.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: LOCATION */}
          {step === STEPS.LOCATION && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 w-full">
              <div className="w-16 h-16 bg-emerald-100 rounded-[8px] flex items-center justify-center mb-6">
                <MapPin className="w-8 h-8 text-emerald-700" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Onde fica a propriedade?</h1>
              <p className="text-slate-500 mb-6">Busque pela sua cidade ou arraste o mapa e clique para marcar a localização da propriedade.</p>
              
              <div className="w-full mb-6">
                <form onSubmit={handleSearch} className="relative flex items-center">
                    <input 
                      type="text" 
                      placeholder="Cidade, coordenadas ou link do Maps..."
                      className="w-full pl-4 pr-10 py-3 rounded-[8px] border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-700 bg-slate-50 transition-colors"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  <button 
                    type="submit" 
                    className="absolute right-2 p-2 text-slate-400 hover:text-emerald-700 transition-colors"
                    disabled={isSearching}
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </form>
              </div>

              {/* Mapa Mobile (Oculto no Desktop) */}
              <div className="lg:hidden w-full h-64 sm:h-72 bg-slate-100 rounded-[8px] overflow-hidden border-2 border-slate-200 relative mb-6">
                <Map
                  ref={mobileMapRef}
                  initialViewState={{ longitude: -50.0, latitude: -15.0, zoom: 3 }}
                  mapStyle={ESRI_SATELLITE_STYLE as any}
                  onClick={(e) => setSelectedLocation({ lng: e.lngLat.lng, lat: e.lngLat.lat })}
                  cursor="crosshair"
                >
                  <GeolocateControl position="top-right" trackUserLocation={false} />
                  {selectedLocation && (
                    <Marker longitude={selectedLocation.lng} latitude={selectedLocation.lat} anchor="bottom">
                      <div className="text-emerald-600 drop-shadow-md relative -top-2">
                        <MapPin className="w-10 h-10 fill-white stroke-emerald-700" strokeWidth={2} />
                      </div>
                    </Marker>
                  )}
                </Map>
              </div>
              {selectedLocation && (
                <div className="mt-4 p-3 bg-emerald-50 text-emerald-800 rounded text-sm font-medium animate-in fade-in duration-300">
                  Localização capturada: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                </div>
              )}
            </div>
          )}

          {/* NAVIGATION FOOTER */}
          <div className="mt-12 flex items-center justify-between pt-6 border-t border-slate-100">
            <button
              onClick={handleBack}
              disabled={isLoading}
              className={clsx(
                "px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors",
                step === 1 || isLoading ? "opacity-0 pointer-events-none" : ""
              )}
            >
              Voltar
            </button>
            
            <button
              onClick={handleNext}
              disabled={isNextDisabled() || isLoading}
              className={clsx(
                "px-8 py-3 rounded-[6px] font-semibold flex items-center gap-2 transition-all",
                isNextDisabled()
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-emerald-700 text-white hover:bg-emerald-800 shadow-[0_4px_14px_0_rgba(21,128,61,0.2)]"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : step === Object.keys(STEPS).length ? (
                "Concluir"
              ) : (
                <>
                  Continuar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
