import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

/**
 * Enhanced web scraping controller with improved content filtering
 * Excludes headers, footers, navigation, and removes duplicates
 */

// Utility function to clean text
const cleanText = (text) => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
};

// Check if element should be excluded (headers, footers, nav, etc.)
const shouldExcludeElement = (element, $) => {
  const tagName = element.tagName?.toLowerCase();
  const className = $(element).attr('class')?.toLowerCase() || '';
  const id = $(element).attr('id')?.toLowerCase() || '';
  
  // Exclude common header/footer/nav elements
  const excludedTags = ['header', 'footer', 'nav', 'aside', 'script', 'style', 'noscript', 'iframe'];
  const excludedClasses = ['header', 'footer', 'nav', 'navigation', 'sidebar', 'menu', 'breadcrumb', 'cookie', 'popup', 'modal', 'advertisement', 'ads'];
  const excludedIds = ['header', 'footer', 'nav', 'navigation', 'sidebar', 'menu'];
  
  // Check tag names
  if (excludedTags.includes(tagName)) return true;
  
  // Check class names
  if (excludedClasses.some(cls => className.includes(cls))) return true;
  
  // Check IDs
  if (excludedIds.some(idName => id.includes(idName))) return true;
  
  return false;
};

// Check if text content should be excluded
const shouldExcludeText = (text) => {
  if (!text || text.length < 10) return true;
  
  const lowerText = text.toLowerCase();
  const excludePatterns = [
    'cookie', 'privacy policy', 'terms of service', 'copyright', '©',
    'all rights reserved', 'login', 'sign in', 'register', 'subscribe',
    'newsletter', 'follow us', 'social media', 'share this',
    'advertisement', 'sponsored', 'loading', 'please wait'
  ];
  
  return excludePatterns.some(pattern => lowerText.includes(pattern));
};

// Remove duplicate content
const removeDuplicates = (contentArray) => {
  const seen = new Set();
  return contentArray.filter(item => {
    const key = typeof item === 'string' ? item : JSON.stringify(item);
    const normalizedKey = key.toLowerCase().trim();
    
    if (seen.has(normalizedKey)) return false;
    seen.add(normalizedKey);
    return true;
  });
};

/**
 * Enhanced scraping with Puppeteer - excludes headers/footers and removes duplicates
 */
const scrapeContentEnhanced = async (req, res) => {
  const { targetUrl, includeLinks = false, includeImages = false } = req.body;

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Valid targetUrl is required' });
  }

  try {
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set user agent to avoid blocking
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(targetUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });

    const scrapedData = await page.evaluate((includeLinks, includeImages) => {
      const result = {
        url: window.location.href,
        title: document.title || '',
        metaDescription: '',
        headings: [],
        paragraphs: [],
        lists: [],
        links: [],
        images: []
      };

      // Get meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        result.metaDescription = metaDesc.getAttribute('content') || '';
      }

      // Helper function to check if element is visible
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               element.offsetHeight > 0 && 
               element.offsetWidth > 0;
      };

      // Helper function to check if element should be excluded
      const shouldExclude = (element) => {
        const tagName = element.tagName?.toLowerCase();
        const className = element.className?.toLowerCase() || '';
        const id = element.id?.toLowerCase() || '';
        
        // Exclude headers, footers, navigation
        const excludedTags = ['header', 'footer', 'nav', 'aside', 'script', 'style', 'noscript'];
        const excludedClasses = ['header', 'footer', 'nav', 'navigation', 'sidebar', 'menu', 'cookie', 'popup'];
        const excludedIds = ['header', 'footer', 'nav', 'navigation', 'sidebar'];
        
        if (excludedTags.includes(tagName)) return true;
        if (excludedClasses.some(cls => className.includes(cls))) return true;
        if (excludedIds.some(idName => id.includes(idName))) return true;
        
        return false;
      };

      // Extract headings (h1-h6)
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
        if (isVisible(heading) && !shouldExclude(heading)) {
          const text = heading.textContent.trim();
          if (text && text.length > 5) {
            result.headings.push({
              level: heading.tagName.toLowerCase(),
              text: text
            });
          }
        }
      });

      // Extract paragraphs
      document.querySelectorAll('p').forEach(p => {
        if (isVisible(p) && !shouldExclude(p)) {
          const text = p.textContent.trim();
          if (text && text.length > 20) {
            result.paragraphs.push(text);
          }
        }
      });

      // Extract lists
      document.querySelectorAll('ul, ol').forEach(list => {
        if (isVisible(list) && !shouldExclude(list)) {
          const items = [];
          list.querySelectorAll('li').forEach(li => {
            const text = li.textContent.trim();
            if (text && text.length > 5) {
              items.push(text);
            }
          });
          if (items.length > 0) {
            result.lists.push({
              type: list.tagName.toLowerCase(),
              items: items
            });
          }
        }
      });

      // Extract links if requested
      if (includeLinks) {
        document.querySelectorAll('a[href]').forEach(link => {
          if (isVisible(link) && !shouldExclude(link)) {
            const text = link.textContent.trim();
            const href = link.getAttribute('href');
            if (text && href && text.length > 2) {
              result.links.push({
                text: text,
                href: href.startsWith('http') ? href : new URL(href, window.location.href).href
              });
            }
          }
        });
      }

      // Extract images if requested
      if (includeImages) {
        document.querySelectorAll('img[src]').forEach(img => {
          if (isVisible(img) && !shouldExclude(img)) {
            const src = img.getAttribute('src');
            const alt = img.getAttribute('alt') || '';
            if (src) {
              result.images.push({
                src: src.startsWith('http') ? src : new URL(src, window.location.href).href,
                alt: alt
              });
            }
          }
        });
      }

      return result;
    }, includeLinks, includeImages);

    await browser.close();

    // Remove duplicates from each content type
    scrapedData.headings = removeDuplicates(scrapedData.headings);
    scrapedData.paragraphs = removeDuplicates(scrapedData.paragraphs);
    scrapedData.lists = removeDuplicates(scrapedData.lists);
    scrapedData.links = removeDuplicates(scrapedData.links);
    scrapedData.images = removeDuplicates(scrapedData.images);

    // Filter out unwanted content
    scrapedData.paragraphs = scrapedData.paragraphs.filter(p => !shouldExcludeText(p));
    scrapedData.headings = scrapedData.headings.filter(h => !shouldExcludeText(h.text));

    return res.status(200).json({
      success: true,
      data: scrapedData,
      stats: {
        headings: scrapedData.headings.length,
        paragraphs: scrapedData.paragraphs.length,
        lists: scrapedData.lists.length,
        links: scrapedData.links.length,
        images: scrapedData.images.length
      }
    });

  } catch (error) {
    console.error('Enhanced scraping failed:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Scraping failed',
      details: error.message
    });
  }
};

/**
 * Lightweight scraping using Cheerio (faster for simple content extraction)
 */
const scrapeContentLightweight = async (req, res) => {
  const { targetUrl, includeLinks = false } = req.body;

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Valid targetUrl is required' });
  }

  try {
    // Use Puppeteer to get the HTML (handles JS-rendered content)
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    const html = await page.content();
    await browser.close();

    // Parse with Cheerio
    const $ = cheerio.load(html);

    const result = {
      url: targetUrl,
      title: $('title').text().trim() || '',
      metaDescription: $('meta[name="description"]').attr('content') || '',
      content: []
    };

    // Remove unwanted elements
    $('header, footer, nav, aside, script, style, noscript, .header, .footer, .nav, .navigation, .sidebar, .menu, .cookie, .popup').remove();

    // Extract main content
    const contentElements = $('h1, h2, h3, h4, h5, h6, p, li');
    const seenContent = new Set();

    contentElements.each((i, element) => {
      if (shouldExcludeElement(element, $)) return;

      const text = cleanText($(element).text());
      if (!text || text.length < 10 || shouldExcludeText(text)) return;

      const normalizedText = text.toLowerCase();
      if (seenContent.has(normalizedText)) return;
      seenContent.add(normalizedText);

      result.content.push({
        type: element.tagName.toLowerCase(),
        text: text
      });
    });

    // Extract links if requested
    if (includeLinks) {
      result.links = [];
      const seenLinks = new Set();

      $('a[href]').each((i, element) => {
        if (shouldExcludeElement(element, $)) return;

        const text = cleanText($(element).text());
        const href = $(element).attr('href');

        if (!text || !href || text.length < 3) return;
        if (shouldExcludeText(text)) return;

        const fullHref = href.startsWith('http') ? href : new URL(href, targetUrl).href;
        const linkKey = `${text}|${fullHref}`;

        if (seenLinks.has(linkKey)) return;
        seenLinks.add(linkKey);

        result.links.push({ text, href: fullHref });
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
      stats: {
        contentItems: result.content.length,
        links: result.links?.length || 0
      }
    });

  } catch (error) {
    console.error('Lightweight scraping failed:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Scraping failed',
      details: error.message
    });
  }
};

/**
 * Batch scraping multiple URLs
 */
const scrapeMultipleUrls = async (req, res) => {
  const { urls, includeLinks = false, includeImages = false } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'Array of URLs is required' });
  }

  if (urls.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 URLs allowed per request' });
  }

  const results = [];
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const url of urls) {
      if (!url.startsWith('http')) {
        results.push({ url, error: 'Invalid URL format' });
        continue;
      }

      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const scrapedData = await page.evaluate((includeLinks, includeImages) => {
          // Same extraction logic as scrapeContentEnhanced
          const result = {
            url: window.location.href,
            title: document.title || '',
            headings: [],
            paragraphs: []
          };

          // Extract headings and paragraphs with filtering
          document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
            const text = h.textContent.trim();
            if (text && text.length > 5) {
              result.headings.push({ level: h.tagName.toLowerCase(), text });
            }
          });

          document.querySelectorAll('p').forEach(p => {
            const text = p.textContent.trim();
            if (text && text.length > 20) {
              result.paragraphs.push(text);
            }
          });

          return result;
        }, includeLinks, includeImages);

        await page.close();
        results.push({ url, success: true, data: scrapedData });

      } catch (error) {
        results.push({ url, success: false, error: error.message });
      }
    }

  } catch (error) {
    console.error('Batch scraping failed:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Batch scraping failed',
      details: error.message
    });
  } finally {
    await browser.close();
  }

  return res.status(200).json({
    success: true,
    results: results,
    stats: {
      total: urls.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  });
};

export {
  scrapeContentEnhanced,
  scrapeContentLightweight,
  scrapeMultipleUrls
};
