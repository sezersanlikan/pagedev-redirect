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
        element(element) {
          if (pageTitle) return;
          
          const classes = element.getAttribute('class') || '';
          const parentClasses = element.getAttribute('parent-classes') || '';
          
          // title seçicilerini kontrol et
          for (const selector of titleSelectors) {
            if (selector.includes(classes) || 
                selector.includes(element.tagName) || 
                selector.includes(parentClasses)) {
              
              // text içeriğini almak için text handler ekleyelim
              element.text = '';
              element.onText = (text) => {
                element.text = (element.text || '') + text.text;
              };
              
              element.onEndTag = () => {
                if (!pageTitle && element.text) {
                  pageTitle = element.text.trim();
                }
              };
              
              break;
            }
          }
        },
        text(text) {
          if (!pageTitle && text.element?.text !== undefined) {
            text.element.text = (text.element.text || '') + text.text;
          }
        }
      })
      .on('img', {
        element(element) {
          if (featuredImage) return;

          const classes = element.getAttribute('class') || '';
          const parentClasses = element.getAttribute('parent-classes') || '';
          
          // image seçicilerini kontrol et
          for (const selector of imageSelectors) {
            if (selector.includes(classes) || 
                selector.includes('img') || 
                selector.includes(parentClasses)) {
              
              const src = element.getAttribute('src') || element.getAttribute('data-src');
              const srcset = element.getAttribute('srcset');

              if (src && 
                  !src.includes('data:image') && 
                  !src.includes('blank.gif') &&
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
              }
              break;
            }
          }
        }
      });

    const transformedResponse = await rewriter.transform(wpResponse).text();

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
