import React from 'react';
import { Smartphone, Link, MessageCircle, Wifi, WifiOff, Loader2, Leaf, Wheat, DollarSign, ShoppingCart, PlusCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { BotStatus, getEffectiveStatus, fetchRecentBotActivities, BotActivity, formatRelativeTime } from '../../services/botStatusService';
import { formatarTelefone } from '../../utils/formatters';

interface WhatsappAssistantCardProps {
  telefone?: string;
  whatsappStatus: BotStatus | null;
  onConnect: () => void;
  onUnlink: () => void;
  isLoading?: boolean;
}

const WhatsappAssistantCard: React.FC<WhatsappAssistantCardProps> = ({
  telefone,
  whatsappStatus,
  onConnect,
  onUnlink,
  isLoading,
}) => {
  const [activities, setActivities] = React.useState<BotActivity[]>([]);
  const [isFeedLoading, setIsFeedLoading] = React.useState(false);

  const { status: effectiveStatus } = getEffectiveStatus(whatsappStatus);
  const isConnected = !!telefone;

  const loadActivities = React.useCallback(async () => {
    if (!isConnected || !telefone) return;
    setIsFeedLoading(true);
    const data = await fetchRecentBotActivities(telefone);
    setActivities(data);
    setIsFeedLoading(false);
  }, [isConnected, telefone]);

  React.useEffect(() => {
    loadActivities();
    const interval = setInterval(loadActivities, 60000); // 60s polling
    return () => clearInterval(interval);
  }, [loadActivities]);

  const getStatusConfig = () => {
    switch (effectiveStatus) {
      case 'CONNECTED':
        return {
          label: 'ONLINE',
          color: 'bg-emerald-100 text-emerald-700',
          dotColor: 'bg-emerald-500',
          icon: <Wifi size={14} />,
          ping: true,
        };
      case 'WAITING_QR':
        return {
          label: 'AGUARDANDO QR',
          color: 'bg-amber-100 text-amber-700',
          dotColor: 'bg-amber-500',
          icon: <Loader2 size={14} className="animate-spin" />,
          ping: false,
        };
      case 'DISCONNECTED':
      default:
        return {
          label: 'OFFLINE',
          color: 'bg-slate-200 text-slate-800',
          dotColor: 'bg-slate-500',
          icon: <WifiOff size={14} />,
          ping: false,
        };
    }
  };

  const getActivityConfig = (tipo: string) => {
    const t = tipo.toUpperCase();
    if (t === 'ASSISTANT' || t === 'ASSISTANTE' || t === 'BOT') {
      return { icon: <MessageCircle size={12} />, label: 'Assistente', color: 'text-emerald-500' };
    }
    if (t === 'USER' || t === 'USUARIO' || t === 'PRODUTOR' || t === 'VOCE' || t === 'VOCÊ') {
      return { icon: <MessageCircle size={12} />, label: 'Você', color: 'text-slate-400' };
    }
    if (t === 'PLANTIO') return { icon: <PlusCircle size={12} />, label: 'Plantio', color: 'text-emerald-500' };
    if (t === 'COLHEITA') return { icon: <Wheat size={12} />, label: 'Colheita', color: 'text-amber-600' };
    if (t === 'MANEJO') return { icon: <Leaf size={12} />, label: 'Manejo', color: 'text-green-600' };
    if (t === 'VENDA') return { icon: <DollarSign size={12} />, label: 'Venda', color: 'text-blue-600' };
    if (t === 'COMPRA') return { icon: <ShoppingCart size={12} />, label: 'Compra', color: 'text-purple-600' };
    if (t === 'DUVIDA') return { icon: <MessageCircle size={12} />, label: 'Dúvida', color: 'text-slate-600' };
    return { icon: <MessageCircle size={12} />, label: tipo, color: 'text-slate-400' };
  };

  const config = getStatusConfig();

  const handleSpeakWithAssistant = () => {
    const botNumber = import.meta.env.VITE_WHATSAPP_BOT_NUMBER || '553497202727';
    window.open(`https://wa.me/${botNumber}`, '_blank');
  };

  if (isLoading) {
    return <div className="h-full bg-white rounded-3xl animate-pulse border border-slate-200 shadow-sm" />;
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col h-full transition-all duration-300 hover:shadow-xl group">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div className={cn(
            "p-3 rounded-2xl transition-colors duration-300",
            isConnected ? "bg-green-50 text-green-600" : "bg-slate-50 text-slate-400"
          )}>
            <Smartphone size={24} />
          </div>
          
          <div className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300",
            config.color
          )}>
            <div className="relative flex items-center justify-center">
              <span className={cn("w-2 h-2 rounded-full", config.dotColor)} />
              {config.ping && (
                <span className={cn("absolute w-2 h-2 rounded-full animate-ping opacity-75", config.dotColor)} />
              )}
            </div>
            {config.label}
          </div>
        </div>

        <div>
          <h4 className="text-xl font-black text-slate-950 leading-tight">
            Assistente de I.A.
          </h4>
          <p className="text-sm font-bold text-slate-700 mt-1">
            {formatarTelefone(telefone) || "Vincule seu WhatsApp"}
          </p>
        </div>
      </div>

      {/* Mini-Feed de Atividades */}
      {isConnected && (
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Atividade Recente</span>
            {isFeedLoading && <Loader2 size={10} className="animate-spin text-slate-300" />}
          </div>
          
          <div className="flex flex-col gap-2.5">
            {(activities || []).length > 0 ? (
              (activities || []).map((act) => {
                const actConfig = getActivityConfig(act.tipo);
                return (
                  <div key={act.id} className="flex items-start gap-3 group/item">
                    <div className={cn("mt-1 p-1 rounded-md bg-slate-50 transition-colors group-hover/item:bg-white", actConfig.color)}>
                      {actConfig.icon}
                    </div>
                    <div className="flex-1 min-w-0 border-l border-slate-100 pl-3">
                      <p className="text-[11px] font-semibold text-slate-900 truncate">
                        {act.descricao}
                      </p>
                      <p className="text-[10px] font-bold text-slate-600">
                        {actConfig.label} • {formatRelativeTime(act.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-[11px] font-semibold text-slate-400 italic py-1">
                Aguardando sua primeira interação via WhatsApp.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action Section */}
      <div className="mt-auto pt-6">
        {!isConnected ? (
          <button
            onClick={onConnect}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold shadow-lg shadow-green-600/20 transition-all active:scale-95 group-hover:-translate-y-1"
          >
            <Link size={18} />
            Conectar WhatsApp
          </button>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleSpeakWithAssistant}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-lg shadow-slate-900/10 transition-all active:scale-95 group-hover:-translate-y-1"
            >
              <MessageCircle size={18} />
              Falar com Assistente
            </button>
            <button
              onClick={onUnlink}
              className="w-full py-2 text-[11px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
            >
              Desconectar Conta
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsappAssistantCard;
