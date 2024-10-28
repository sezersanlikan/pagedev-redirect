export async function onRequest({ request, next }) {
  try {
    const url = new URL(request.url);
    let path = url.pathname;
    const queryString = url.search;

    if (!path.endsWith('/') && !path.includes('.')) {
      path = `${path}/`;
    }

    const targetUrl = `${CONFIG.baseUrl}${path}${queryString}`;

    let pageTitle = '';
    let featuredImage = '';

    const wpResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Cloudflare Workers)'
      },
      redirect: 'follow'
    });

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

    const rewriter = new HTMLRewriter();

    titleSelectors.forEach(selector => {
      rewriter.on(selector, {
        text(text) {
          if (!pageTitle) {
            pageTitle += text.text;
          }
        }
      });
    });

    imageSelectors.forEach(selector => {
      rewriter.on(selector, {
        element(element) {
          if (!featuredImage) {
            const src = element.getAttribute('src') || element.getAttribute('data-src');
            
            if (src && 
                !src.includes('data:image') && 
                !src.includes('blank.gif') &&
                (src.includes('.jpg') || 
                 src.includes('.jpeg') || 
                 src.includes('.png') || 
                 src.includes('.webp'))) {
              
              const srcset = element.getAttribute('srcset');
              if (srcset) {
                const sources = srcset.split(',');
                const largestImage = sources
                  .map(s => {
                    const [url, width] = s.trim().split(' ');
                    return {
                      url,
                      width: parseInt(width) || 0
                    };
                  })
                  .sort((a, b) => b.width - a.width)[0];
                
                featuredImage = largestImage ? largestImage.url : src;
              } else {
                featuredImage = src;
              }
            }
          }
        }
      });
    });

    const transformedResponse = rewriter.transform(wpResponse);
    await transformedResponse.text();

    pageTitle = pageTitle.trim() || CONFIG.defaultTitle;
    featuredImage = featuredImage || CONFIG.defaultImage;

    const pageDescription = pageTitle;

    console.log({
      pageTitle,
      pageDescription,
      featuredImage,
      targetUrl
    });

    const response = await next();
    const html = await response.text();

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
