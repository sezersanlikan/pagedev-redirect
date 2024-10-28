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

    const sourceHtml = await wpResponse.text();
    
    let pageTitle = '';
    for (const selector of titleSelectors) {
        const regex = new RegExp(`<${selector.replace(/\./g, ' class="')}[^>]*>([^<]+)<`, 'i');
        const match = sourceHtml.match(regex);
        if (match) {
            pageTitle = match[1].trim();
            break;
        }
    }

    let featuredImage = '';
    for (const selector of imageSelectors) {
        const regex = new RegExp(`<img[^>]*${selector.replace(/\./g, ' class="')}[^>]*src="([^"]+)"`, 'i');
        const match = sourceHtml.match(regex);
        if (match) {
            const src = match[1];
            if (src && 
                !src.includes('data:image') && 
                !src.includes('blank.gif') &&
                (src.includes('.jpg') || 
                 src.includes('.jpeg') || 
                 src.includes('.png') || 
                 src.includes('.webp'))) {
                
                const srcsetRegex = new RegExp(`<img[^>]*${selector.replace(/\./g, ' class="")}[^>]*srcset="([^"]+)"`, 'i');
                const srcsetMatch = sourceHtml.match(srcsetRegex);
                
                if (srcsetMatch) {
                    const srcset = srcsetMatch[1];
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
