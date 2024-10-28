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

    // Önce head tag'ini bul
    const headMatch = responseHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    if (!headMatch) {
      return new Response(responseHtml, {
        headers: response.headers
      });
    }

    const headContent = headMatch[1];
    const updatedHead = headContent
      // Önce mevcut og:image tag'lerini temizle
      .replace(/<meta[^>]*property="og:image"[^>]*>/g, '')
      .replace(/<meta[^>]*property="og:title"[^>]*>/g, '')
      .replace(/<meta[^>]*property="og:description"[^>]*>/g, '')
      .replace(/<meta[^>]*property="og:url"[^>]*>/g, '')
      .replace(/<meta[^>]*property="og:image:alt"[^>]*>/g, '')
      .replace(/<meta[^>]*name="description"[^>]*>/g, '');

    // Yeni meta tag'leri ekle
    const newMetaTags = `
      <meta property="og:image" content="${featuredImage}">
      <meta property="og:title" content="${pageTitle}">
      <meta property="og:description" content="${pageTitle}">
      <meta property="og:url" content="${url.origin}${path}">
      <meta property="og:image:width" content="1200">
      <meta property="og:image:height" content="630">
      <meta property="og:image:alt" content="${pageTitle}">
      <meta name="description" content="${pageTitle}">
    `;

    // Head tag'ini güncelle
    const updatedHtml = responseHtml.replace(
      /<head[^>]*>([\s\S]*?)<\/head>/i,
      `<head>${updatedHead}${newMetaTags}</head>`
    );

    // Featured image'ı güncelle
    const finalHtml = updatedHtml.replace(
      /<img[^>]*id="featured-image"[^>]*>/,
      `<a href="${CONFIG.baseUrl}${path}${url.search}">
        <img id="featured-image" src="${featuredImage}" alt="${pageTitle}">
      </a>`
    );

    return new Response(finalHtml, {
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
