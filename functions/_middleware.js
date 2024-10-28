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

    const titleSelectors = [
      'article .post-header h1.post-title',
      'h1.entry-title',
      '.post-title',
      '.entry-header h1',
      'h1.title',
      'h1.post-title',
      '.article-title',
      'g1-mega',
      'h1.single_post_title_main',
      '.wpb_wrapper h1',
      '.post-header h1',
      '.entry-title h1'
    ];

    const imageSelectors = [
      '.thumb .safirthumb .thumbnail .center img',
      '#galleryContent #image img',
      '#galleryContent .attachment-full',
      '.featured-image img',
      '.thumbnail img',
      '.post-feature-media-wrapper img',
      '.g1-frame img',
      '.image-post-thumb img',
      'article img.wp-post-image',
      '.entry-content img:first-of-type',
      '.center img',
      '.g1-frame-inner img',
      '.wpb_wrapper img:first-of-type',
      'img.attachment-full',
      'img.size-full',
      'img.wp-post-image'
    ];

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
      });

    // Title selector'ları için
    titleSelectors.forEach(selector => {
      rewriter.on(selector, {
        text(text) {
          if (!pageTitle) {
            pageTitle = text.text.trim();
            console.log('Title bulundu:', pageTitle);
          }
        }
      });
    });

    // Image selector'ları için
    imageSelectors.forEach(selector => {
      rewriter.on(selector, {
        element(element) {
          if (featuredImage) return;

          const src = element.getAttribute('data-src') || 
                     element.getAttribute('data-lazy-src') || 
                     element.getAttribute('data-original') || 
                     element.getAttribute('src');

          if (src && !src.includes('noimage') && !src.includes('blank.gif') && !src.includes('data:image')) {
            featuredImage = src;
            console.log('Featured image selector\'dan bulundu:', featuredImage);
          }
        }
      });
    });

    const transformedResponse = await rewriter.transform(wpResponse);
    const transformedHtml = await transformedResponse.text();

    // Fallback değerleri
    pageTitle = pageTitle || CONFIG.defaultTitle;
    featuredImage = featuredImage || CONFIG.defaultImage;

    console.log('Final değerler:', {
      title: pageTitle,
      image: featuredImage
    });

    const response = await next();
    const responseHtml = await response.text();

    // Meta tag'leri güncelle
    let updatedHtml = responseHtml
      .replace(/<meta[^>]*property="og:[^"]*"[^>]*>/g, '')
      .replace(/<meta[^>]*name="description"[^>]*>/g, '');

    updatedHtml = updatedHtml.replace(
      /<head>/i,
      `<head>
        <meta property="og:image" content="${featuredImage}" />
        <meta property="og:title" content="${pageTitle}" />
        <meta property="og:description" content="${pageTitle}" />
        <meta property="og:url" content="${url.origin}${path}" />
        <meta property="og:type" content="article" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="${pageTitle}" />
        <meta name="description" content="${pageTitle}" />`
    );

    // Featured image güncelle
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
