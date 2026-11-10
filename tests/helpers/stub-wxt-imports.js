// Lets node --test load modules that import WXT's virtual '#imports' module
// (storage, browser), which only exists inside a WXT build.
import { registerHooks } from 'node:module';

const STUB_SOURCE = `
export const storage = {
    getItem: async () => null,
    setItem: async () => {},
    watch: () => () => {},
};
export const browser = {};
`;
const STUB_URL = `data:text/javascript,${encodeURIComponent(STUB_SOURCE)}`;

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === '#imports') {
            return { url: STUB_URL, shortCircuit: true };
        }
        return nextResolve(specifier, context);
    },
});
