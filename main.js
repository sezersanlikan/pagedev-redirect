// Ayarlar
const CONFIG = {
    mobileRedirectUrl: 'https://www.sabancesur.com',
    desktopUrl: 'https://www.sabancesur.com',
};

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

document.body.style.visibility = 'hidden';

document.addEventListener('DOMContentLoaded', async () => {
    const path = window.location.pathname;
    const queryString = window.location.search;

    if (isMobile()) {
        window.location.href = `${CONFIG.mobileRedirectUrl}${path}${queryString}`;
        return;
    }

    const targetUrl = `${CONFIG.desktopUrl}${path}${queryString}`;

    try {
        const response = await fetch(targetUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const featuredImage = doc.querySelector('.featured-image img');
        if (featuredImage) {
            const imageUrl = featuredImage.src;
            const imgElement = document.getElementById('featured-image');
            imgElement.src = imageUrl;
            imgElement.style.display = 'none';
            imgElement.onload = () => {
                imgElement.style.display = 'block';
            };
            document.getElementById('og-image').content = imageUrl;
            document.querySelector('meta[property="og:image"]').content = imageUrl;
        }

        const articleTitle = doc.querySelector('article .post-header h1.post-title');
        if (articleTitle) {
            const titleText = articleTitle.textContent.trim();
            
            document.title = titleText;
            
            const h1Element = document.querySelector('h1');
            if (h1Element) {
                h1Element.textContent = titleText;
                h1Element.style.visibility = 'visible';
            }
            
            const ogTitleMeta = document.querySelector('meta[property="og:title"]');
            if (ogTitleMeta) {
                ogTitleMeta.content = titleText;
            }
        }

        const ogUrlMeta = document.querySelector('meta[property="og:url"]');
        if (ogUrlMeta) {
            const currentUrl = window.location.href;
            ogUrlMeta.content = currentUrl;
        }

        const links = document.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const href = this.getAttribute('href');
                const targetUrl = new URL(href, CONFIG.desktopUrl);
                window.location.href = targetUrl.href;
            });
        });

        document.body.style.visibility = 'visible';

    } catch (error) {
        console.error('İçerik yüklenirken hata oluştu:', error);
        document.body.style.visibility = 'visible';
    }
});