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
          if (featuredImage) {
            console.log('Featured image zaten ayarlı:', featuredImage);
            return;
          }
          
          const src = element.getAttribute('data-src') || 
                     element.getAttribute('data-lazy-src') || 
                     element.getAttribute('data-original') || 
                     element.getAttribute('src');
          
          console.log('Bulunan img src:', src);
          
          if (!src || 
              src.includes('noimage.svg') ||
              src.includes('data:image') || 
              src.includes('blank.gif')) {
            console.log('Geçersiz src, atlanıyor');
            return;
          }

          for (const selector of imageSelectors) {
            try {
              // Selector'u parçalara ayır ve her birini kontrol et
              const parts = selector.split(' ');
              let isMatch = true;
              let currentElement = element;

              for (let i = parts.length - 1; i >= 0; i--) {
                const part = parts[i];
                if (!currentElement) {
                  isMatch = false;
                  break;
                }

                const elementClass = currentElement.getAttribute('class') || '';
                const elementTag = currentElement.tagName?.toLowerCase() || '';

                if (part.startsWith('.') && !elementClass.includes(part.slice(1))) {
                  isMatch = false;
                  break;
                }

                if (!part.startsWith('.') && elementTag !== part) {
                  isMatch = false;
                  break;
                }

                currentElement = currentElement.parentElement;
              }

              if (isMatch) {
                featuredImage = src;
                console.log('Featured image img\'den ayarlandı:', featuredImage);
              }
            } catch (error) {
              continue;
            }

          }
        }
      })
      .on('meta[property="og:image"]', {
        element(element) {
          console.log('OG Image meta tag bulundu');
          if (!featuredImage) {
            const content = element.getAttribute('content');
            console.log('OG Image content:', content);
            if (content && !content.includes('noimage') && !content.includes('blank.gif')) {
              featuredImage = content;
              console.log('Featured image OG\'dan ayarlandı:', featuredImage);
            }
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

    const transformedHtml = await rewriter.transform(wpResponse).text();
    console.log('Transform sonrası featured image:', featuredImage);

    // HTML içinde og:image meta tag'ini manuel kontrol et
    const ogImageMatch = transformedHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/);
    console.log('Manuel og:image kontrolü:', ogImageMatch?.[1]);

    pageTitle = pageTitle || CONFIG.defaultTitle;
    featuredImage = featuredImage || CONFIG.defaultImage;
    
    console.log('Final featured image:', featuredImage);

    const response = await next();
    const responseHtml = await response.text();

    // Meta tag'lerini kontrol et
    const updatedHtml = responseHtml
      .replace(/<meta[^>]*property="og:image"[^>]*>/, (match) => {
        console.log('Değiştirilecek og:image tag:', match);
        const newTag = `<meta property="og:image" content="${featuredImage}">`;
        console.log('Yeni og:image tag:', newTag);
        return newTag;
      })
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
