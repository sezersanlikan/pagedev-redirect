export async function onRequest({ request, next }) {
  try {
    const url = new URL(request.url);
    let path = url.pathname;
    const queryString = url.search;

    // URL sonunda / yoksa ekle (redirect'i önlemek için)
    if (!path.endsWith('/') && !path.includes('.')) {
      path = `${path}/`;
    }

    const targetUrl = `https://www.sabancesur.com${path}${queryString}`;

    let pageTitle = '';
    let pageContent = '';
    let featuredImage = '';

    // WordPress'ten içeriği çek
    const wpResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Cloudflare Workers)'
      },
      redirect: 'follow' // redirectleri otomatik takip et
    });

    // HTML'i parse et
    const rewriter = new HTMLRewriter()
      .on('article .post-header h1.post-title', {
        text(text) {
          pageTitle += text.text;
        }
      })
      .on('.featured-image img', {
        element(element) {
          const src = element.getAttribute('src');
          if (src) featuredImage = src;
        }
      })
      .on('article .entry-content', {
        text(text) {
          pageContent += text.text;
        }
      });

    const transformedResponse = rewriter.transform(wpResponse);
    await transformedResponse.text();

    // Varsayılan değerleri kontrol et
    pageTitle = pageTitle.trim() || 'Saban Cesur';
    pageContent = pageContent.trim();
    const pageDescription = pageContent.substring(0, 160) || 'Saban Cesur';
    featuredImage = featuredImage || 'https://www.sabancesur.com/wp-content/uploads/IMG_4431-752x440-1.jpeg';

    // Debug için
    console.log({
      pageTitle,
      pageDescription,
      featuredImage,
      targetUrl
    });

    // Orijinal yanıtı al
    const response = await next();
    const html = await response.text();

    // Meta etiketlerini güncelle
    const updatedHtml = html
      .replace(
        /<title>[^<]*<\/title>/,
        `<title>${pageTitle}</title>`
      )
      .replace(
        /<meta[^>]*property="og:title"[^>]*>/,
        `<meta property="og:title" content="${pageTitle}">`
      )
      .replace(
        /<meta[^>]*property="og:description"[^>]*>/,
        `<meta property="og:description" content="${pageDescription}">`
      )
      .replace(
        /<meta[^>]*property="og:image"[^>]*>/,
        `<meta property="og:image" content="${featuredImage}">`
      )
      .replace(
        /<meta[^>]*property="og:url"[^>]*>/,
        `<meta property="og:url" content="${url.origin}${path}">`
      )
      .replace(
        /<meta[^>]*property="og:image:alt"[^>]*>/,
        `<meta property="og:image:alt" content="${pageTitle}">`
      )
      .replace(
        /<meta[^>]*name="description"[^>]*>/,
        `<meta name="description" content="${pageDescription}">`
      );

    return new Response(updatedHtml, {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
        'cache-control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Middleware error:', error);
    return next();
  }
}
