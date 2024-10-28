export async function onRequest({ request, next }) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const queryString = url.search;
    const targetUrl = `https://www.sabancesur.com${path}${queryString}`;

    const wpResponse = await fetch(targetUrl);
    const wpHtml = await wpResponse.text();
    const parser = new DOMParser();
    const wpDoc = parser.parseFromString(wpHtml, 'text/html');

    const pageTitle = wpDoc.querySelector('article .post-header h1.post-title')?.textContent.trim() || 'Saban Cesur';
    const featuredImage = wpDoc.querySelector('.featured-image img')?.src || 'https://www.sabancesur.com/wp-content/uploads/IMG_4431-752x440-1.jpeg';
    const pageContent = wpDoc.querySelector('article .entry-content')?.textContent.trim() || 'Saban Cesur';
    const pageDescription = pageContent.substring(0, 160);

    const response = await next();
    const html = await response.text();

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
        `<meta property="og:image" content="${featuredImage}">`
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
