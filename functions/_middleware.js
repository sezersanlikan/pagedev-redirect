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

    let pageTitle = '';
    let featuredImage = '';

    const rewriter = new HTMLRewriter()
      .on('h1', {
        text(text) {
          if (pageTitle) return;
          
          const element = text.element;
          const className = element.getAttribute('class') || '';
          
          for (const selector of titleSelectors) {
            if (selector.includes(className) || selector.includes('h1')) {
              pageTitle = text.text.trim();
              break;
            }
          }
        }
      })
      .on('img', {
        element(element) {
          if (featuredImage) return;
          
          const className = element.getAttribute('class') || '';
          const src = element.getAttribute('data-src') || 
                     element.getAttribute('data-lazy-src') || 
                     element.getAttribute('data-original') || 
                     element.getAttribute('src');
          
          const srcset = element.getAttribute('data-srcset') || 
                        element.getAttribute('data-lazy-srcset') || 
                        element.getAttribute('srcset');
          
          for (const selector of imageSelectors) {
            if (selector.includes(className) || selector.includes('img')) {
              if (src && 
                  !src.includes('noimage') &&
                  !src.includes('data:image') && 
                  !src.includes('blank.gif') &&
                  !src.includes('lazy') &&
                  (src.includes('.jpg') || 
                   src.includes('.jpeg') || 
                   src.includes('.png') || 
                   src.includes('.webp'))) {
                
                if (srcset) {
                  const sources = srcset.split(',')
                    .map(s => {
                      const [url, width] = s.trim().split(' ');
                      return { url, width: parseInt(width) || 0 };
                    })
                    .sort((a, b) => b.width - a.width);
                  
                  featuredImage = sources[0]?.url || src;
                } else {
                  featuredImage = src;
                }
                break;
              }
            }
          }
        }
      })
      .on('meta[property="og:image"]', {
        element(element) {
          if (!featuredImage) {
            featuredImage = element.getAttribute('content');
          }
        }
      })
      .on('title', {
        text(text) {
          if (!pageTitle) {
            pageTitle = text.text.trim();
          }
        }
      });

    await rewriter.transform(wpResponse).text();

    pageTitle = pageTitle || CONFIG.defaultTitle;
    featuredImage = featuredImage || CONFIG.defaultImage;

    const response = await next();
    const responseHtml = await response.text();

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
