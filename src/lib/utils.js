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

    static errorSync(...args) {
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

storage.watch('local:loggerEnabled', (newValue) => {
    Logger.enabled = !!newValue;
});

Logger.refreshEnabled().catch(() => {});

/**
 * Calculates a human-readable "time ago" string from a date.
 * @param {string} dateString - Date string (ISO format or "YYYY-MM-DD HH:mm:ss")
 * @returns {string|null} Formatted time ago string or null on error
 */
function getTimeAgo(dateString) {
    try {
        let localDate;

        // Check if the string already has 'T' and 'Z' (ISO format)
        if (dateString.includes('T') && dateString.endsWith('Z')) {
            localDate = new Date(dateString);
        } else {
            // Convert server format "YYYY-MM-DD HH:mm:ss" to ISO format
            const isoString = dateString.replace(' ', 'T') + 'Z';
            localDate = new Date(isoString);
        }

        // Check if the date is valid
        if (isNaN(localDate.getTime())) {
            Logger.errorSync(`Error parsing date. dateString: ${dateString}. localDate: ${localDate}`);
            return null;
        }

        const now = new Date();
        const diffMs = now - localDate;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 60) {
            return `${diffMinutes} min`;
        } else if (diffHours < 24) {
            return `${diffHours} hr${diffHours === 1 ? '' : 's'}`;
        } else {
            return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
        }
    } catch (error) {
        Logger.errorSync(`Error parsing date. dateString: ${dateString}. Error: ${error}`);
        return null;
    }
}

export { Logger, getTimeAgo };
