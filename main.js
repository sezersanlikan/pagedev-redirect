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
    const ogImageAlt = doc.querySelector('meta[property="og:image:alt"]')?.content || '';

    document.title = title;
    document.querySelector('meta[name="description"]').content = description;
    document.querySelector('link[rel="canonical"]').href = canonicalUrl;
    
    document.querySelector('meta[property="og:title"]').content = title;
    document.querySelector('meta[property="og:description"]').content = description;
    document.querySelector('meta[property="og:url"]').content = canonicalUrl;
    
    const ogImageElement = document.querySelector('meta[property="og:image"]');
    if (ogImageElement) {
        ogImageElement.content = ogImage;
    } else {
        const newOgImage = document.createElement('meta');
        newOgImage.setAttribute('property', 'og:image');
        newOgImage.setAttribute('content', ogImage);
        document.head.appendChild(newOgImage);
    }

    const ogImageAltElement = document.querySelector('meta[property="og:image:alt"]');
    if (ogImageAltElement) {
        ogImageAltElement.content = ogImageAlt || title;
    } else {
        const newOgImageAlt = document.createElement('meta');
        newOgImageAlt.setAttribute('property', 'og:image:alt');
        newOgImageAlt.setAttribute('content', ogImageAlt || title);
        document.head.appendChild(newOgImageAlt);
    }
}

function updateContent(doc) {
    const pageTitle = doc.querySelector('article .post-header h1.post-title')?.textContent.trim() || '';
    const featuredImage = doc.querySelector('.featured-image img')?.src || '';
    const pageContent = doc.querySelector('article .entry-content')?.innerHTML || '';

    const pageTitleElement = document.getElementById('page-title');
    pageTitleElement.textContent = pageTitle;
    pageTitleElement.style.visibility = 'visible';
    pageTitleElement.dataset.href = `${CONFIG.baseUrl}${window.location.pathname}${window.location.search}`;

    const imgElement = document.getElementById('featured-image');
    imgElement.src = featuredImage;
    imgElement.alt = pageTitle;
    imgElement.dataset.href = `${CONFIG.baseUrl}${window.location.pathname}${window.location.search}`;

    document.getElementById('page-content').innerHTML = pageContent;

    // Meta etiketlerini güncelle
    updateMetaTag('og:image', featuredImage);
    updateMetaTag('og:title', pageTitle);
    updateMetaTag('og:description', pageContent.substring(0, 160));
}

// Yardımcı fonksiyon
function updateMetaTag(property, content) {
    let element = document.querySelector(`meta[property="${property}"]`);
    if (element) {
        element.content = content;
    } else {
        element = document.createElement('meta');
        element.setAttribute('property', property);
        element.setAttribute('content', content);
        document.head.appendChild(element);
    }
}

function setupEventListeners() {
    const homeLink = document.getElementById('home-link');
    homeLink.addEventListener('click', function(e) {
        e.preventDefault();
        const targetUrl = `${CONFIG.baseUrl}${window.location.search}`;
        history.pushState(null, '', targetUrl);
        loadContent();
    });

    document.querySelectorAll('a:not(#home-link)').forEach(link => {
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

    document.getElementById('page-title').addEventListener('click', function() {
        if (CONFIG.enableHref) {
            window.location.href = this.dataset.href;
        }
    });

    document.getElementById('featured-image').addEventListener('click', function() {
        if (CONFIG.enableHref) {
            window.location.href = this.dataset.href;
        }
    });

    window.addEventListener('popstate', loadContent);
}

document.addEventListener('DOMContentLoaded', () => {
    loadContent();
    setupEventListeners();
});
