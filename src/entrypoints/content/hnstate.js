import {browser} from "wxt/browser";
import {storage} from '#imports';
import {Logger} from "../../lib/utils.js";

class HNState {
    static saveLastSeenPostId(postId) {
        storage.setItem('local:lastSeenPost', {
            lastSeenPost: {
                id: postId,
                timestamp: Date.now()
            }
        }).catch(_ => {
            Logger.infoSync('Error saving current post state:', _);
        });
    }

    static async getLastSeenPostId() {
        try {
            const data = await storage.getItem('local:lastSeenPost');
            // Return null if no state or if state is older than 15 minutes
            if (!data.lastSeenPost || Date.now() - data.lastSeenPost.timestamp > (15 * 60 * 1000)) {
                await this.clearLastSeenPost();
                return null;
            }
            return data.lastSeenPost.id;
        } catch (error) {
            await Logger.error('Error retrieving saved post state:', error);
            return null;
        }
    }

    static async clearLastSeenPost() {
        storage.removeItem('local:lastSeenPost').catch(_ => {
            Logger.infoSync('Error clearing lastSeenPost post state:', _);
        });
    }
}

export default HNState;