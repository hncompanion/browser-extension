import { storage } from '#imports';

class Logger {
    static DEBUG_LOGGING_ENABLED = false;

    static async isEnabled() {
        // Use wxt storage to check if loggerEnabled is set to true
        const enabled = await storage.getItem('local:loggerEnabled');
        return !!enabled;
    }

    static async info(...args) {
        if (await Logger.isEnabled()) {
            console.info('[INFO]', ...args);
        }
    }

    static infoSync(...args) {
        Logger.isEnabled().then(() => {
            console.info('[INFO]', ...args);
        })
    }

    static async debug(...args) {
        if (await Logger.isEnabled()) {
            console.debug('[DEBUG]', ...args);
        }
    }

    static debugSync(...args) {
        if (Logger.DEBUG_LOGGING_ENABLED) {
            console.debug('[DEBUG]', ...args);
        }
    }

    static async error(...args) {
        if (await Logger.isEnabled()) {
            console.error('[ERROR]', ...args);
        }
    }

    static enableLoggingSync() {
        storage.setItem('local:loggerEnabled', true).then(() => {
            Logger.infoSync('Logging enabled');
        });
    }

    static async disableLogging() {
        await storage.setItem('local:loggerEnabled', false);
    }
}

export { Logger };
