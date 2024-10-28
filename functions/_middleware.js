import { CONFIG } from '../config.js';

export async function onRequest({ request, next }) {
  try {
    const url = new URL(request.url);
    let path = url.pathname;
    
    const targetUrl = `${CONFIG.baseUrl}${path}${url.search}`;

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

    const wpResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Cloudflare Workers)'
      },
      redirect: 'follow'
    });

    if (!wpResponse.ok) {
      return next();
    }

    const html = await wpResponse.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let pageTitle = '';
    let featuredImage = '';

    // Galeri kontrolü
    const isGalleryPath = path.split('/').filter(Boolean).length > 1;
    if (isGalleryPath) {
      // Galeri başlığını al
      pageTitle = doc.querySelector('h1.entry-title, .post-title, #galleryContent #image a')?.textContent?.trim() ||
                 doc.querySelector('#galleryContent #image a')?.getAttribute('title')?.trim();

      // Galeri resmini al
      const currentImage = doc.querySelector('#galleryContent #image img.attachment-full') || 
                         doc.querySelector('#galleryContent #image a img');
      
      if (currentImage) {
        featuredImage = currentImage.getAttribute('data-src') || 
                       currentImage.getAttribute('data-lazy-src') || 
                       currentImage.getAttribute('srcset')?.split(',')[0]?.split(' ')[0] ||
                       currentImage.getAttribute('src');
      }
    } else {
      // Normal sayfa için title selectors
      const titleSelectors = [
        'h1.post-title',
        'article .post-header h1.post-title',
        'h1.entry-title',
        '.post-title',
        '.entry-header h1',
        'h1.title',
        '.article-title',
        'g1-mega',
        'h1.single_post_title_main',
        '.wpb_wrapper h1',
        '.post-header h1',
        '.entry-title h1'
      ];

      // Normal sayfa için image selectors
      const imageSelectors = [
        '.thumb .safirthumb .thumbnail .center img',
        '#galleryContent .attachment-full',
        '#galleryContent #image a img',
        '.center img',
        '.thumb img',
        '.safirthumb img',
        '.thumbnail img',
        'article img.wp-post-image',
        '.featured-image img',
        '.thumbnail .center img',
        '.post-feature-media-wrapper img',
        '.entry-content img:first-of-type',
        '.g1-frame img',
        '.g1-frame-inner img',
        '.image-post-thumb img',
        '.wpb_wrapper img:first-of-type',
        'img.attachment-full',
        'img.size-full',
        'img.wp-post-image'
      ];

      // Title'ı bul
      for (const selector of titleSelectors) {
        const titleElement = doc.querySelector(selector);
        if (titleElement) {
          pageTitle = titleElement.textContent.trim();
          break;
        }
      }

      // Featured image'ı bul
      for (const selector of imageSelectors) {
        const imgElement = doc.querySelector(selector);
        if (imgElement) {
          const src = imgElement.getAttribute('data-src') || 
                     imgElement.getAttribute('data-lazy-src') || 
                     imgElement.getAttribute('data-original') || 
                     imgElement.getAttribute('src');
          
          if (src && 
              !src.includes('noimage.svg') &&
              !src.includes('data:image') && 
              !src.includes('blank.gif')) {
            featuredImage = src;
            break;
          }
        }
      }
    }

    // Fallback değerleri
    pageTitle = pageTitle || CONFIG.defaultTitle;
    featuredImage = featuredImage || CONFIG.defaultImage;

    const response = await next();
    const responseHtml = await response.text();

    // Meta tag'leri güncelle
    const updatedHtml = responseHtml
      .replace(/<title>[^<]*<\/title>/, `<title>${pageTitle}</title>`)
      .replace(
        /<meta[^>]*property="og:title"[^>]*>/,
        `<meta property="og:title" content="${pageTitle}">`
      )
      .replace(
        /<meta[^>]*property="og:description"[^>]*>/,
        `<meta property="og:description" content="${pageTitle}">`
      )
      .replace(
        /<meta[^>]*property="og:image"[^>]*>/,
        `<meta property="og:image" content="${featuredImage}">`
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
