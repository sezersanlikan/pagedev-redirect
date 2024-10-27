document.addEventListener('DOMContentLoaded', async () => {
    const path = window.location.pathname.split('/').pop();
    const queryString = window.location.search;
    const targetUrl = `https://www.sabancesur.com/${path}${queryString}`; // HTTP yerine HTTPS kullanıyoruz

    try {
        const response = await fetch(targetUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Görüntü URL'sini güncelle
        const featuredImage = doc.querySelector('.featured-image img');
        if (featuredImage) {
            const imageUrl = featuredImage.src;
            document.getElementById('featured-image').src = imageUrl;
            document.getElementById('og-image').content = imageUrl;
            document.querySelector('meta[property="og:image"]').content = imageUrl;
        }

        // Makale başlığını al
        const articleTitle = doc.querySelector('article .post-header h1.post-title');
        if (articleTitle) {
            const titleText = articleTitle.textContent.trim();
            
            // Sayfa başlığını güncelle
            document.title = titleText;
            
            // h1 etiketini güncelle
            const h1Element = document.querySelector('h1');
            if (h1Element) {
                h1Element.textContent = titleText;
            }
            
            // og:title meta etiketini güncelle
            const ogTitleMeta = document.querySelector('meta[property="og:title"]');
            if (ogTitleMeta) {
                ogTitleMeta.content = titleText;
            }
        }

        // og:url meta etiketini güncelle
        const ogUrlMeta = document.querySelector('meta[property="og:url"]');
        if (ogUrlMeta) {
            const currentUrl = window.location.href;
            ogUrlMeta.content = currentUrl;
        }

        // page.dev kısmını güncelle
        const pageDev = window.location.hostname;
        const links = document.querySelectorAll('a');
        links.forEach(link => {
            if (link.href.includes('.pages.dev')) {
                link.href = link.href.replace(/https?:\/\/[^/]+/, `https://${pageDev}`);
            }
        });

    } catch (error) {
        console.error('İçerik yüklenirken hata oluştu:', error);
    }
});