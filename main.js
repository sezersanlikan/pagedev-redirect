// Ayarlar
const CONFIG = {
    baseUrl: 'https://www.sabancesur.com',
    showContent: true,
    enableHref: true,
    loadingTimeout: 5000
};

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

async function fetchWithTimeout(url, timeout) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function loadContent() {
    const path = window.location.pathname;
    const queryString = window.location.search;
    const targetUrl = `${CONFIG.baseUrl}${path}${queryString}`;

    if (isMobile()) {
        window.location.href = targetUrl;
        return;
    }

    document.getElementById('loading').style.display = 'block';
    document.querySelector('.wrap').style.display = 'none';

    try {
        const response = await fetchWithTimeout(targetUrl, CONFIG.loadingTimeout);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        updateMetadata(doc);
        updateContent(doc);

        if (CONFIG.showContent) {
            document.querySelector('.wrap').style.display = 'block';
        }
        document.getElementById('loading').style.display = 'none';

    } catch (error) {
        console.error('İçerik yüklenirken hata oluştu:', error);
        document.getElementById('loading').textContent = 'İçerik yüklenemedi. Lütfen daha sonra tekrar deneyin.';
    }
}

function updateMetadata(doc) {
    const title = doc.querySelector('title')?.textContent || '';
    const description = doc.querySelector('meta[name="description"]')?.content || '';
    const canonicalUrl = doc.querySelector('link[rel="canonical"]')?.href || window.location.href;
    const ogImage = doc.querySelector('meta[property="og:image"]')?.content || '';

    document.title = title;
    document.querySelector('meta[name="description"]').content = description;
    document.querySelector('link[rel="canonical"]').href = canonicalUrl;
    document.querySelector('meta[property="og:title"]').content = title;
    document.querySelector('meta[property="og:description"]').content = description;
    document.querySelector('meta[property="og:url"]').content = canonicalUrl;
    document.getElementById('og-image').content = ogImage;
}

function updateContent(doc) {
    const pageTitle = doc.querySelector('article .post-header h1.post-title')?.textContent.trim() || '';
    const featuredImage = doc.querySelector('.featured-image img')?.src || '';
    const pageContent = doc.querySelector('article .entry-content')?.innerHTML || '';

    document.getElementById('page-title').textContent = pageTitle;
    document.getElementById('page-title').style.visibility = 'visible';
    const imgElement = document.getElementById('featured-image');
    imgElement.src = featuredImage;
    imgElement.alt = pageTitle;
    document.getElementById('page-content').innerHTML = pageContent;
}

function setupEventListeners() {
    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function(e) {
            if (!CONFIG.enableHref) {
                e.preventDefault();
                return;
            }
            
            const href = this.getAttribute('href');
            if (href.startsWith('http') && !href.includes(CONFIG.baseUrl)) {
                return;
            }
            
            e.preventDefault();
            
            let newPath = href;
            if (href.startsWith('/')) {
                newPath = href.slice(1);
            }
            const targetUrl = `${CONFIG.baseUrl}/${newPath}${window.location.search}`;
            
            history.pushState(null, '', targetUrl);
            loadContent();
        });
    });

    window.addEventListener('popstate', loadContent);
}

document.addEventListener('DOMContentLoaded', () => {
    loadContent();
    setupEventListeners();
});
