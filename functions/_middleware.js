export async function onRequest({ request, next }) {
  try {
    const response = await next();
    const html = await response.text();
    const url = new URL(request.url);

    let pageTitle = '';
    let pageDescription = '';
    let pageImage = '';

    const doc = new HTMLRewriter()
      .on('#page-title', {
        text(text) {
          pageTitle += text.text;
        }
      })
      .on('#featured-image', {
        element(element) {
          const src = element.getAttribute('src');
          if (src) pageImage = src;
        }
      })
      .on('#page-content', {
        text(text) {
          if (pageDescription.length < 160) {
            pageDescription += text.text;
          }
        }
      })
      .transform(new Response(html));

    await doc.text();

    // Varsayılan değerler
    pageTitle = pageTitle || 'Saban Cesur';
    pageDescription = pageDescription.substring(0, 160) || "Saban Cesur";
    pageImage = pageImage || 'https://www.sabancesur.com/wp-content/uploads/IMG_4431-752x440-1.jpeg';

    // Meta etiketlerini güncelle
    const updatedHtml = html
      .replace(
        /<meta property="og:title"[^>]*>/,
        `<meta property="og:title" content="${pageTitle}">`
      )
      .replace(
        /<meta property="og:description"[^>]*>/,
        `<meta property="og:description" content="${pageDescription}">`
      )
      .replace(
        /<meta property="og:image"[^>]*>/,
        `<meta property="og:image" content="${pageImage}">`
      )
      .replace(
        /<meta property="og:url"[^>]*>/,
        `<meta property="og:url" content="${url.href}">`
      )
      .replace(
        /<meta property="og:image:alt"[^>]*>/,
        `<meta property="og:image:alt" content="${pageTitle}">`
      )
      .replace(
        /<title>[^<]*<\/title>/,
        `<title>${pageTitle}</title>`
      )
      .replace(
        /<meta name="description"[^>]*>/,
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
