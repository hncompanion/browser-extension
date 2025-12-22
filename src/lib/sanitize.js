import createDOMPurify from 'dompurify';

const ALLOWED_TAGS = [
    'p',
    'br',
    'strong',
    'em',
    'b',
    'i',
    'a',
    'code',
    'pre',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'blockquote',
    'hr',
    'img'
];

const ALLOWED_ATTR = [
    'href',
    'src',
    'alt',
    'title',
    'target',
    'rel',
    'data-comment-link',
    'data-comment-id'
];

const domPurify = createDOMPurify(window);

export function sanitizeHtml(html, config = {}) {
    return domPurify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ...config
    });
}

export function sanitizeHtmlToFragment(html, config = {}) {
    return domPurify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        RETURN_DOM_FRAGMENT: true,
        ...config
    });
}

export function enforceSafeLinks(container) {
    container.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        if (!href) {
            return;
        }

        if (href.startsWith('#')) {
            return;
        }

        let parsedUrl;
        try {
            parsedUrl = new URL(href, window.location.href);
        } catch {
            link.removeAttribute('href');
            link.removeAttribute('target');
            return;
        }

        const protocol = parsedUrl.protocol;
        const isSafe = protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:';
        if (!isSafe) {
            link.removeAttribute('href');
            link.removeAttribute('target');
            return;
        }

        if (link.target === '_blank') {
            link.setAttribute('rel', 'noopener noreferrer');
        }
    });
}
