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


// active / inactive both in response with additional text
const scrapeRelevantContent_Merge = async (req, res) => {
  const { targetUrl } = req.body;

  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const data = await page.evaluate(() => {
      const clean = txt => (txt || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

      const sections = [];


      //-------- normal text --------------

      const isVis = el => {
        const s = window.getComputedStyle(el);
        return s && s.display !== 'none' && s.visibility !== 'hidden'
          && el.offsetHeight > 0 && el.offsetWidth > 0;
      };

      const shouldSkip = txt => {
        const lc = txt.toLowerCase();
        return !txt || txt.length < 20
          || lc.includes('cookie') || lc.includes('embed')
          || txt.trim().toLowerCase() === 'get to know us better'; // Skip this heading entirely
      };


      document.querySelectorAll('h2').forEach(h => {
        if (!isVis(h)) return;
        const text = clean(h.textContent);
        if (shouldSkip(text)) return;
        const next = Array.from(h.nextElementSibling ? [h.nextElementSibling] : []);
        let paragraph = next.find(el => ['P', 'DIV', 'SPAN'].includes(el.tagName) && isVis(el));
        const content = paragraph ? [clean(paragraph.textContent)] : [];
        sections.push({ heading: text, content });
      });
      //-------- end normal text --------------


      // -------- 1. Loop through each horizontal tab section --------
      document.querySelectorAll('.horizontaltab-section').forEach(sectionEl => {
        const mainCategory = clean(sectionEl.querySelector('.horizontaltab-section-title')?.textContent);
        if (shouldSkip(mainCategory)) return;

        // Get all subcategory tabs
        const subTabs = Array.from(sectionEl.querySelectorAll('.horizontaltab-nav-link'));

        subTabs.forEach(tab => {
          const subCategory = clean(tab.textContent);
          const panelId = tab.getAttribute('href');
          if (!panelId) return;

          const panel = sectionEl.querySelector(panelId);
          if (!panel) return;

          // Extract cards inside each tab panel
          const cards = Array.from(panel.querySelectorAll('a'))
            .map(card => {
              const title = clean(card.querySelector('h3, h4, p')?.textContent);
              const href = card.getAttribute('href') || '';
              return title ? (href ? `${title} (${href})` : title) : '';
            })
            .filter(Boolean);

          if (cards.length) {
            sections.push({
              heading: mainCategory,
              subcategory: subCategory,
              content: cards
            });
          }
        });
      });

      // -------- 2. Other standalone card sections (not horizontal tabs) --------
      document.querySelectorAll('section').forEach(section => {
        // Skip if already part of a horiz tab section
        if (section.closest('.horizontaltab-section')) return;

        const headingEl = section.querySelector('h2, h3');
        if (!headingEl) return;

        const heading = clean(headingEl.textContent);
        const cards = Array.from(section.querySelectorAll('a'))
          .map(card => {
            const title = clean(card.querySelector('h3, h4, p')?.textContent);
            const href = card.getAttribute('href') || '';
            return title && title.length > 2 ? (href ? `${title} (${href})` : title) : '';
          })
          .filter(Boolean);

        if (cards.length && heading) {
          sections.push({ heading, content: cards });
        }
      });

      return {
        url: window.location.href,
        title: clean(document.title),
        description: '',
        sections
      };
    });

    await browser.close();
    res.json(data);

  } catch (err) {
    console.error('Scraping failed:', err);
    res.status(500).json({ message: 'Error scraping content' });
  }
};

const scrapeRelevantContent = async (req, res) => {
  const { targetUrl } = req.body;

  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const data = await page.evaluate(() => {
      const clean = txt => (txt || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

      const sections = [];


      //-------- normal text --------------

      const isVis = el => {
        const s = window.getComputedStyle(el);
        return s && s.display !== 'none' && s.visibility !== 'hidden'
          && el.offsetHeight > 0 && el.offsetWidth > 0;
      };

      const shouldSkip = txt => {
        const lc = txt.toLowerCase();
        return !txt || txt.length < 20
          || lc.includes('cookie') || lc.includes('embed')
          || txt.trim().toLowerCase() === 'get to know us better'; // Skip this heading entirely
      };


      document.querySelectorAll('h2').forEach(h => {
        if (!isVis(h)) return;
        const text = clean(h.textContent);
        if (shouldSkip(text)) return;
        const next = Array.from(h.nextElementSibling ? [h.nextElementSibling] : []);
        let paragraph = next.find(el => ['P', 'DIV', 'SPAN'].includes(el.tagName) && isVis(el));
        const content = paragraph ? [clean(paragraph.textContent)] : [];
        sections.push({ heading: text, content });
      });
      //-------- end normal text --------------


      // // -------- 1. Loop through each horizontal tab section --------
      // document.querySelectorAll('.horizontaltab-main-section').forEach(sectionEl => {
      //   const mainCategory = clean(sectionEl.querySelector('.horizontaltab-section-title')?.textContent);
      //   if (shouldSkip(mainCategory)) return;

      //   // Get all subcategory tabs
      //   const subTabs = Array.from(sectionEl.querySelectorAll('.horizontaltab-nav-link'));

      //   subTabs.forEach(tab => {
      //     const subCategory = clean(tab.textContent);
      //     const panelId = tab.getAttribute('href');
      //     if (!panelId) return;

      //     const panel = sectionEl.querySelector(panelId);
      //     if (!panel) return;

      //     // Extract cards inside each tab panel
      //     const cards = Array.from(panel.querySelectorAll('a'))
      //       .map(card => {
      //         const title = clean(card.querySelector('h3, h4, p')?.textContent);
      //         const href = card.getAttribute('href') || '';
      //         return title ? (href ? `${title} (${href})` : title) : '';
      //       })
      //       .filter(Boolean);

      //     if (cards.length) {
      //       sections.push({
      //         heading: mainCategory,
      //         subcategory: subCategory,
      //         content: cards
      //       });
      //     }
      //   });
      // });

      // -------- 2. Other standalone card sections (not horizontal tabs) --------
      document.querySelectorAll('section').forEach(section => {
        // Skip if already part of a horiz tab section
        if (section.closest('.horizontaltab-section')) return;

        const headingEl = section.querySelector('h2, h3');
        if (!headingEl) return;

        const heading = clean(headingEl.textContent);
        const cards = Array.from(section.querySelectorAll('a'))
          .map(card => {
            const title = clean(card.querySelector('h3, h4, p')?.textContent);
            const href = card.getAttribute('href') || '';
            // return title && title.length > 2 ? (href ? `${title} (${href})` : title) : '';
            return title && title.length > 2 ? (href ? `${title} (${href})` : title) : '';
          })
          .filter(Boolean);

        if (cards.length && heading) {
          // sections.push({ heading, content: cards });
          if (heading === "Get to know us better") {
            // nothing 
          } else {
            sections.push({ heading, content: cards });

          }
        }
      });

      return {
        url: window.location.href,
        title: clean(document.title),
        description: '',
        sections
      };
    });

    await browser.close();
    res.json(data);

  } catch (err) {
    console.error('Scraping failed:', err);
    res.status(500).json({ message: 'Error scraping content' });
  }
};











export { scrapeUrl, GetScrapping, scrapeFullPageContent, scrapeRelevantContent };