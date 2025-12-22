import { storage } from '#imports';

class Logger {
    static enabled = false;
    static refreshInFlight = null;

    static async refreshEnabled() {
        if (Logger.refreshInFlight) {
            return Logger.refreshInFlight;
        }

        Logger.refreshInFlight = (async () => {
            try {
                const enabled = await storage.getItem('local:loggerEnabled');
                Logger.enabled = !!enabled;
            } finally {
                Logger.refreshInFlight = null;
            }
        })();

        return Logger.refreshInFlight;
    }

    static async isEnabled() {
        await Logger.refreshEnabled();
        return Logger.enabled;
    }

    static async info(...args) {
        if (await Logger.isEnabled()) {
            console.info('[INFO]', ...args);
        }
    }

    static infoSync(...args) {
        if (Logger.enabled) {
            console.info('[INFO]', ...args);
        }
    }

    static async debug(...args) {
        if (await Logger.isEnabled()) {
            console.debug('[DEBUG]', ...args);
        }
    }

    static debugSync(...args) {
        if (Logger.enabled) {
            console.debug('[DEBUG]', ...args);
        }
    }

    static async error(...args) {
        console.error('[ERROR]', ...args);
    }

    static enableLoggingSync() {
        Logger.enabled = true;
        storage.setItem('local:loggerEnabled', true).then(() => {
            Logger.infoSync('Logging enabled');
        });
    }

    static async disableLogging() {
        Logger.enabled = false;
        await storage.setItem('local:loggerEnabled', false);
    }
}

Logger.refreshEnabled().catch(() => {});

export { Logger };
