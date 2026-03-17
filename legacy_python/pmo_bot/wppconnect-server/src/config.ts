// O uso de [key: string]: any diz ao TypeScript para aceitar qualquer propriedade
export const config: { [key: string]: any } = {
    port: 5000,
    apiKey: process.env.SECRET_KEY || 'GlobalApiKey',
    secretKey: process.env.SECRET_KEY || 'GlobalApiKey',
    host: 'http://localhost',
    tokenStoreType: 'file',
    customUserDataDir: './userDataDir/',
    webhook: {
        url: process.env.WEBHOOK_URL || 'http://pmo-bot-go:8080/webhook/wppconnect',
        enabled: true,
        readMessage: true,
        allEvents: true,
        autoDownload: true,
        uploadS3: false,
        allUnreadOnStart: false,
        listenAcks: true,
        onPresenceChanged: true,
        onParticipantsChanged: true,
        ignore: []
    },
    archive: {
        enable: false,
        waitTime: 10,
        daysToArchive: 30
    },
    mapper: {
        enable: false,
        prefix: 'wpp'
    },
    log: {
        level: 'error',
        logger: ['console']
    },
    createOptions: {
        autoClose: 0,
        browserArgs: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ]
    }
};

export default config;