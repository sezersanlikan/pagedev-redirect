import { CONFIG } from '../config.js';

export async function onRequest({ request, next }) {
  try {
    const url = new URL(request.url);
    let path = url.pathname;
    
    const userAgent = request.headers.get('user-agent') || '';
    if (userAgent.toLowerCase().includes('bot') || 
        userAgent.toLowerCase().includes('crawler')) {
      return next();
    }

    if (path.match(/\.(js|css|jpg|jpeg|png|gif|ico|webp|xml|txt)$/) ||
        path.includes('/wp-') ||
        path.includes('/assets/') ||
        path.includes('/images/')) {
      return next();
    }

    if (!path.endsWith('/') && !path.includes('.')) {
      path = `${path}/`;
    }

    const targetUrl = `${CONFIG.baseUrl}${path}${url.search}`;

    const wpResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Cloudflare Workers)'
      },
      redirect: 'follow'
    });

    if (!wpResponse.ok) {
      return next();
    }

    let pageTitle = '';
    let featuredImage = '';

    const rewriter = new HTMLRewriter()
      .on('meta[property="og:image"]', {
        element(element) {
          if (!featuredImage) {
            const content = element.getAttribute('content');
            if (content && !content.includes('noimage') && !content.includes('blank.gif')) {
              featuredImage = content;
              console.log('Featured image OG\'dan ayarlandı:', featuredImage);
            }
          }
        }
      })
      .on('img', {
        element(element) {
          if (featuredImage) return;
          
          const src = element.getAttribute('data-src') || 
                     element.getAttribute('data-lazy-src') || 
                     element.getAttribute('data-original') || 
                     element.getAttribute('src');
          
          if (!src || 
              src.includes('noimage.svg') ||
              src.includes('data:image') || 
              src.includes('blank.gif')) {
            return;
          }

          // İlk geçerli resmi al
          if (!featuredImage) {
            featuredImage = src;
            console.log('Featured image ilk resimden ayarlandı:', featuredImage);
          }
        }
      })
      .on('h1', {
        text(text) {
          if (!pageTitle) {
            pageTitle = text.text.trim();
          }
        }
      });

    const transformedResponse = await rewriter.transform(wpResponse);
    const transformedHtml = await transformedResponse.text();

    // Eğer hala featured image bulunamadıysa, manuel olarak ara
    if (!featuredImage) {
      const imgMatch = transformedHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/);
      if (imgMatch && imgMatch[1]) {
        featuredImage = imgMatch[1];
        console.log('Featured image manuel olarak bulundu:', featuredImage);
      }
    }

    pageTitle = pageTitle || CONFIG.defaultTitle;
    featuredImage = featuredImage || CONFIG.defaultImage;
    
    console.log('Final featured image:', featuredImage);

    const response = await next();
    const responseHtml = await response.text();

    // Meta tag'lerini güncelle
    const updatedHtml = responseHtml
      .replace(
        /<meta[^>]*property="og:image"[^>]*>/g,
        `<meta property="og:image" content="${featuredImage}">`
      )
      .replace(
        /<meta[^>]*property="og:title"[^>]*>/g,
        `<meta property="og:title" content="${pageTitle}">`
      )
      .replace(
        /<meta[^>]*property="og:description"[^>]*>/,
        `<meta property="og:description" content="${pageTitle}">`
      )
      .replace(
        /<meta[^>]*property="og:image:width"[^>]*>/,
        `<meta property="og:image:width" content="1200">`
      )
      .replace(
        /<meta[^>]*property="og:image:height"[^>]*>/,
        `<meta property="og:image:height" content="630">`
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
        `<meta name="description" content="${pageTitle}">`
      )
      .replace(
        /<img[^>]*id="featured-image"[^>]*>/,
        `<a href="${CONFIG.baseUrl}${path}${url.search}">
          <img id="featured-image" src="${featuredImage}" alt="${pageTitle}">
        </a>`
      );

    return new Response(updatedHtml, {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
        'cache-control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      },
    });

  } catch (error) {
    console.error('Middleware error:', error);
    return next();
  }
}
