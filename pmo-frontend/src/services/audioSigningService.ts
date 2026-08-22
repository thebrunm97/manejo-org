import { supabase } from '../supabaseClient';

/**
 * Emissão de URLs assinadas para os áudios do caderno de campo.
 *
 * Contexto (P1-5): a coluna `caderno_campo.audio_url` guardava URLs públicas
 * (`/object/public/...`). Ao fechar o bucket — que estava exposto a qualquer um
 * com o link — essas URLs passaram a retornar 400 e os players quebraram.
 *
 * A troca por URL assinada resolve mais do que os players: guardar URL pública
 * em coluna de banco significa que vazar a tabela vaza também o acesso ao áudio,
 * permanentemente e sem expiração. A URL assinada tem prazo curto e só é emitida
 * para quem a política de storage autoriza.
 */

/** Bucket legado, com caminhos no formato `pmo_<id>/<data>/<arquivo>.ogg`. */
const BUCKET_LEGADO = 'audios_audit';

/**
 * Validade da assinatura.
 *
 * Curta de propósito: a URL é gerada no momento de tocar, então não precisa
 * sobreviver à sessão. Uma janela longa recriaria — em escala menor — o próprio
 * problema que o fechamento do bucket corrigiu, já que uma URL assinada
 * vazada é acessível sem autenticação enquanto durar.
 */
const VALIDADE_SEGUNDOS = 300;

/**
 * Extrai o caminho do objeto a partir do que está gravado na coluna.
 *
 * Tolera os dois formatos de propósito: as linhas históricas guardam a URL
 * pública inteira, e gravações novas guardam apenas o caminho. Exigir um
 * formato só obrigaria a migrar todo o histórico antes de os players voltarem
 * a funcionar — e a migração é um passo separado, que não precisa bloquear a
 * correção.
 */
export const extrairCaminhoDoStorage = (valor: string): string | null => {
    if (!valor) return null;

    const limpo = valor.trim();

    // Caminho puro (formato novo): não é URL.
    if (!limpo.startsWith('http')) {
        return limpo.replace(/^\/+/, '') || null;
    }

    // URL pública ou assinada: o caminho vem após o nome do bucket.
    const marcadores = [
        `/object/public/${BUCKET_LEGADO}/`,
        `/object/sign/${BUCKET_LEGADO}/`,
        `/object/${BUCKET_LEGADO}/`,
    ];

    for (const marcador of marcadores) {
        const idx = limpo.indexOf(marcador);
        if (idx !== -1) {
            const caminho = limpo.slice(idx + marcador.length).split('?')[0];
            // O caminho vem percent-encoded na URL (o `@` dos IDs do WhatsApp,
            // por exemplo). A API de storage espera o valor decodificado.
            try {
                return decodeURIComponent(caminho) || null;
            } catch {
                return caminho || null;
            }
        }
    }

    return null;
};

/**
 * Gera uma URL assinada de curta duração para o áudio.
 *
 * Retorna `null` em vez de lançar: um áudio que não pode ser tocado é uma
 * degradação da tela, não um erro que deva derrubar a renderização do registro
 * inteiro do caderno de campo.
 */
export const gerarUrlAssinadaDeAudio = async (
    valorDaColuna: string | null | undefined,
): Promise<string | null> => {
    if (!valorDaColuna) return null;

    const caminho = extrairCaminhoDoStorage(valorDaColuna);
    if (!caminho) {
        console.warn('[audioSigning] Não foi possível extrair o caminho de:', valorDaColuna);
        return null;
    }

    const { data, error } = await supabase.storage
        .from(BUCKET_LEGADO)
        .createSignedUrl(caminho, VALIDADE_SEGUNDOS);

    if (error) {
        // Erro esperado e legítimo quando o usuário não é dono do áudio: a
        // política de storage recusa a assinatura. Não é falha do frontend.
        console.warn('[audioSigning] Falha ao assinar áudio:', error.message);
        return null;
    }

    return data?.signedUrl ?? null;
};
