import React, { useEffect, useState } from 'react';
import { gerarUrlAssinadaDeAudio } from '../../services/audioSigningService';

interface SignedAudioPlayerProps {
    /** Valor cru da coluna `audio_url` — URL pública legada ou caminho novo. */
    source: string | null | undefined;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Player que assina a URL do áudio sob demanda (P1-5).
 *
 * Existe como componente, e não como um trecho repetido nos três pontos que
 * tocam áudio, porque assinar é assíncrono: cada lugar precisaria do mesmo
 * `useEffect`, dos mesmos estados de carregando/erro e do mesmo cuidado com
 * desmontagem. Três cópias disso divergiriam na primeira manutenção.
 *
 * A assinatura acontece no momento de renderizar, e não é persistida: a URL
 * expira em minutos, então guardá-la em qualquer lugar só criaria links mortos.
 */
export const SignedAudioPlayer: React.FC<SignedAudioPlayerProps> = ({ source, className, style }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [estado, setEstado] = useState<'carregando' | 'pronto' | 'indisponivel'>('carregando');

    useEffect(() => {
        // Guarda contra atualização após desmontagem: a assinatura é uma
        // chamada de rede e o usuário pode fechar o diálogo antes dela voltar.
        let ativo = true;

        if (!source) {
            setEstado('indisponivel');
            return;
        }

        setEstado('carregando');

        gerarUrlAssinadaDeAudio(source)
            .then((assinada) => {
                if (!ativo) return;
                if (assinada) {
                    setUrl(assinada);
                    setEstado('pronto');
                } else {
                    setEstado('indisponivel');
                }
            })
            .catch(() => {
                if (ativo) setEstado('indisponivel');
            });

        return () => {
            ativo = false;
        };
    }, [source]);

    if (estado === 'carregando') {
        return (
            <span className="text-xs text-gray-400 italic" style={style}>
                Carregando áudio…
            </span>
        );
    }

    if (estado === 'indisponivel' || !url) {
        // Mensagem explícita em vez de player quebrado: o motivo mais provável
        // é falta de permissão sobre a gravação, e um <audio> mudo não
        // comunicaria isso a ninguém.
        return (
            <span className="text-xs text-gray-400 italic" style={style}>
                Áudio indisponível
            </span>
        );
    }

    return <audio controls src={url} preload="metadata" className={className} style={style} />;
};
