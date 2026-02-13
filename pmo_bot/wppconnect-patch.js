/**
 * Patch WPPConnect - Ignora status broadcasts
 * Aplicado em runtime antes do servidor iniciar
 */

console.log('🔧 [PATCH] Carregando patch para WPPConnect...');

// Função para aplicar patch
function applyPatch() {
    try {
        // Interceptar módulo wa-js antes de carregar
        const Module = require('module');
        const originalRequire = Module.prototype.require;

        Module.prototype.require = function (id) {
            const module = originalRequire.apply(this, arguments);

            // Interceptar @wppconnect/wa-js
            if (id === '@wppconnect/wa-js' || id.includes('wa-js')) {
                console.log('✅ [PATCH] Módulo wa-js detectado, aplicando override...');

                // Aguardar WPP estar disponível
                if (module.WPP && module.WPP.chat) {
                    const originalMarkIsRead = module.WPP.chat.markIsRead;

                    // Sobrescrever função markIsRead
                    module.WPP.chat.markIsRead = function (chatId) {
                        const chatIdStr = String(chatId?._serialized || chatId || '');

                        // Validar se é status broadcast
                        if (chatIdStr.includes('status') ||
                            chatIdStr.includes('broadcast') ||
                            chatIdStr === 'status@broadcast') {
                            console.log(`❌ [PATCH] Bloqueado markIsRead para: ${chatIdStr}`);
                            return Promise.resolve({
                                status: 'ignored',
                                reason: 'status_broadcast'
                            });
                        }

                        // Processar normalmente
                        console.log(`✅ [PATCH] Permitido markIsRead para: ${chatIdStr}`);
                        return originalMarkIsRead.call(this, chatId);
                    };

                    console.log('✅ [PATCH] Override aplicado em WPP.chat.markIsRead');
                }
            }

            return module;
        };

        console.log('✅ [PATCH] Module.require interceptado');

    } catch (error) {
        console.error('❌ [PATCH] Erro ao aplicar patch:', error);
    }
}

// Aplicar patch
applyPatch();

console.log('✅ [PATCH] Patch carregado com sucesso!');
