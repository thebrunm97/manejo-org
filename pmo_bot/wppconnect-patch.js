/**
 * Patch WPPConnect - Ignora status broadcasts e injeta configurações dinâmicas
 * Aplicado em runtime antes do servidor iniciar
 */

console.log('🔧 [PATCH] Carregando patch para WPPConnect...');

function applyPatch() {
    try {
        const Module = require('module');
        const originalRequire = Module.prototype.require;

        Module.prototype.require = function (id) {
            const module = originalRequire.apply(this, arguments);

            // 1. Interceptar CONFIG (injetar webhook do env)
            if (id === './config' || id.endsWith('/config.js') || id.endsWith('/config')) {
                const configObj = module.default || module;
                if (configObj && configObj.webhook) {
                    console.log('✅ [PATCH] Injetando configuração de webhook via patch...');
                    
                    configObj.webhook.url = process.env.WEBHOOK_URL || configObj.webhook.url;
                    configObj.webhook.readMessage = true;
                    configObj.webhook.listenAcks = true;
                    
                    if (process.env.SECRET_KEY) {
                        configObj.secretKey = process.env.SECRET_KEY;
                    }

                    console.log('✅ [PATCH] Webhook URL injetada:', configObj.webhook.url);
                }
            }

            // 2. Interceptar wa-js (filtro de broadcast)
            if (id === '@wppconnect/wa-js' || id.includes('wa-js')) {
                if (module.WPP && module.WPP.chat) {
                    console.log('✅ [PATCH] Módulo wa-js detectado, aplicando override...');
                    const originalMarkIsRead = module.WPP.chat.markIsRead;

                    module.WPP.chat.markIsRead = function (chatId) {
                        const chatIdStr = String(chatId?._serialized || chatId || '');
                        if (chatIdStr.includes('status') || chatIdStr.includes('broadcast') || chatIdStr === 'status@broadcast') {
                            return Promise.resolve({ status: 'ignored', reason: 'status_broadcast' });
                        }
                        return originalMarkIsRead.call(this, chatId);
                    };
                }
            }

            return module;
        };

        console.log('✅ [PATCH] Module.require interceptado (Config & wa-js)');

    } catch (error) {
        console.error('❌ [PATCH] Erro ao aplicar patch:', error);
    }
}

applyPatch();
console.log('✅ [PATCH] Patch carregado com sucesso!');
