import puppeteer from 'puppeteer';

const scrapeUrl = async (req, res) => {
  const { targetUrl } = req.body;

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Valid targetUrl is required' });
  }

  try {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36'
    );

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const title = await page.title();
    const html = await page.content();

    await browser.close();

    res.status(200).json({ url: targetUrl, title, html });
  } catch (err) {
    console.error('scrapeUrl failed:', err.message);
    res.status(500).json({ error: 'Scrape failed', details: err.message });
  }
};

async function extractStructuredContent(page) {
  return await page.evaluate(() => {
    const results = [];
    const skip = ['SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER', 'NOSCRIPT', 'ASIDE'];
    const visit = (node) => {
      if (!node || skip.includes(node.tagName)) return;
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        let content = null;
        if (/^h[1-6]$/.test(tag) || ['p', 'span', 'strong', 'b', 'li'].includes(tag)) {
          content = node.innerText.trim();
        } else if (tag === 'a') {
          content = { text: node.innerText.trim(), href: node.href };
        }
        if (content && typeof content === 'string' && content.length > 20) {
          results.push({ tag, content });
        }
      }
      Array.from(node.childNodes).forEach(visit);
    };
    visit(document.body);
    return { title: document.title, sequence: results };
  });
}

async function scrapePage(browser, targetUrl, rootDomain) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36');

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    const { title, sequence } = await extractStructuredContent(page);
    const links = await page.evaluate((root) =>
      Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href)
        .filter(h => h.startsWith(root) && !h.includes('#'))
    , rootDomain);
    await page.close();
    return { url: targetUrl, title, sequence, found: links };
  } catch (err) {
    console.error('scrapePage failed:', err.message);
    await page.close();
    return null;
  }
}

const crawlAndScrape = async (startUrl, maxPages = 10) => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const visited = new Set();
  const toVisit = [startUrl];
  const results = [];

  while (toVisit.length > 0 && results.length < maxPages) {
    const url = toVisit.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);
    const result = await scrapePage(browser, url, new URL(startUrl).origin);
    if (result) {
      results.push(result);
      result.found.forEach(link => {
        if (!visited.has(link)) toVisit.push(link);
      });
    }
  }

  await browser.close();
  return results;
};

const GetScrapping = async (req, res) => {
  const { domain } = req.body;
  if (!domain || !domain.startsWith('http')) {
    return res.status(400).json({ error: 'Valid domain required' });
  }

  try {
    const data = await crawlAndScrape(domain);
    return res.status(200).json(data);
  } catch (e) {
    console.error('GetScrapping failed:', e.message);
    return res.status(500).json({ error: 'Scraping failed', details: e.message });
  }
};

const scrapeRelevantContent = async (req, res) => {
  const { targetUrl } = req.body;

  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const data = await page.evaluate(() => {
  const webPageInfo = {
    url: window.location.href,
    title: document.title || '',
    description: '',
    sections: []
  };

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    webPageInfo.description = metaDesc.getAttribute('content') || '';
  }

  const allElements = Array.from(document.body.querySelectorAll('h1, h2, h3, p, div'));
  let currentHeading = 'Introduction';
  let sectionMap = new Map();

  for (const el of allElements) {
    const tag = el.tagName.toLowerCase();
    let text = el.textContent?.trim();

    if (!text || text.replace(/\s/g, '').length < 20) continue;

    if (['h1', 'h2', 'h3'].includes(tag)) {
      currentHeading = text;
      if (!sectionMap.has(currentHeading)) {
        sectionMap.set(currentHeading, []);
      }
    } else if (['p', 'div'].includes(tag)) {
      if (!/cookie|accept|privacy|login|terms|©/i.test(text)) {
        const existing = sectionMap.get(currentHeading) || [];
        const cleanedText = text.replace(/\s+/g, ' ').trim();
        if (!existing.includes(cleanedText)) {
          existing.push(cleanedText);
          sectionMap.set(currentHeading, existing);
        }
      }
    }
  }

  // Special logic to extract “In Focus” categories
  const inFocusSection = document.querySelector('section[id*="in-focus"]') || document.querySelector('section[class*="in-focus"]');
  if (inFocusSection) {
    const cards = inFocusSection.querySelectorAll('div[class*="card"], article');
    const focusMap = new Map();

    cards.forEach(card => {
      const category = card.querySelector('span, .eyebrow, .category')?.textContent?.trim();
      const headline = card.querySelector('h3, h4, .headline')?.textContent?.trim();
      const summary = card.querySelector('p, .summary')?.textContent?.trim();

      if (category && headline) {
        const fullContent = `${headline}${summary ? ' - ' + summary : ''}`;
        if (!focusMap.has(category)) {
          focusMap.set(category, []);
        }
        const existing = focusMap.get(category);
        if (!existing.includes(fullContent)) {
          existing.push(fullContent);
          focusMap.set(category, existing);
        }
      }
    });

    // Merge In Focus into webPageInfo.sections
    for (const [category, content] of focusMap.entries()) {
      webPageInfo.sections.push({ heading: `In Focus: ${category}`, content });
    }
  }

  // Add general content
  webPageInfo.sections.push(
    ...Array.from(sectionMap.entries()).map(([heading, content]) => ({
      heading,
      content,
    }))
  );

  return webPageInfo;
});


    await browser.close();
    return res.json(data);
  } catch (err) {
    console.error('Scraping failed:', err);
    return res.status(500).json({ message: 'Error scraping content' });
  }
};


const scrapeFullPageContent = async (req, res) => {
  const { targetUrl } = req.body;

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Valid targetUrl is required' });
  }

  try {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36'
    );

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const result = await page.evaluate(() => {
      const webPageInfo = {
        title: document.title || '',
        metaDescription: '',
        h1: '',
      };

      // Meta description
      const metaTag = document.querySelector('meta[name="description"]');
      if (metaTag) webPageInfo.metaDescription = metaTag.getAttribute('content') || '';

      // First H1 tag
      const h1 = document.querySelector('h1');
      if (h1) webPageInfo.h1 = h1.textContent?.trim() || '';

      // Tags to exclude
      const excludedTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'IMG', 'NAV', 'ASIDE', 'FOOTER'];

    const contentSet = new Set();
      const allElements = Array.from(document.body.querySelectorAll('*'));

      for (const el of allElements) {
        if (excludedTags.includes(el.tagName)) continue;

        const text = el.textContent?.trim();
        if (text && text.length > 30 && !contentSet.has(text)) {
          contentSet.add(text);
        }
      }

      const content = Array.from(contentSet);

      return { webPageInfo, content };
    });

    await browser.close();
    return res.status(200).json(result);

  } catch (error) {
    console.error('scrapeFullPageContent error:', error.message);
    return res.status(500).json({
      error: 'Failed to scrape full page content',
      details: error.message,
    });
  }
};



export { scrapeUrl, GetScrapping, scrapeRelevantContent,scrapeFullPageContent };
