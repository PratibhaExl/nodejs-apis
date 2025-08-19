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

const scrapeRelevantContent12Agust = async (req, res) => {
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

      //check exiting text or duplicate removal.
      const existsInSections = (sections, text) => {
        const cleanText = text.toLowerCase();
        return sections.some(sec =>
          sec.heading.toLowerCase() === cleanText ||
          (sec.content && sec.content.some(c => c.toLowerCase() === cleanText))
        );
      };



      document.querySelectorAll('h1,h2,p').forEach(h => {
        if (!isVis(h)) return;
        const text = clean(h.textContent);
        if (shouldSkip(text)) return;
        const next = Array.from(h.nextElementSibling ? [h.nextElementSibling] : []);
        let paragraph = next.find(el => ['P', 'DIV', 'SPAN'].includes(el.tagName) && isVis(el));
        const content = paragraph ? [clean(paragraph.textContent)] : [];
        //sections.push({ heading: text, content });
        if (text && !existsInSections(sections, text) && (content.length > 0 || text.length > 0)) {
          sections.push({ heading: text, content });
        }
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
            return title && title.length > 2 ? (href ? `${title} href:(${href})` : title) : '';

            //const title_href = {"title":title && title.length > 2 ? title : '', "href":href?href:''}
            //return title_href;
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

const scrapeRelevantContent14 = async (req, res) => {
  const { targetUrl } = req.body;

  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const data = await page.evaluate(() => {
      const clean = txt => (txt || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

      const sections = [];

      const isVis = el => {
        const s = window.getComputedStyle(el);
        return s && s.display !== 'none' && s.visibility !== 'hidden' &&
          el.offsetHeight > 0 && el.offsetWidth > 0;
      };

      const shouldSkip = txt => {
        const lc = txt.toLowerCase();
        return !txt || txt.length < 20 ||
          lc.includes('cookie') || lc.includes('embed') ||
          txt.trim().toLowerCase() === 'get to know us better';
      };

      //Check duplicates in sections
      const existsInSections = (sections, text) => {
        const cleanText = text.toLowerCase();
        return sections.some(sec =>
          sec.heading.toLowerCase() === cleanText ||
          (sec.content && sec.content.some(c =>
            typeof c === 'string'
              ? c.toLowerCase() === cleanText
              : (c.text && c.text.toLowerCase() === cleanText)
          ))
        );
      };

      // -------- 1. Normal text sections --------
      document.querySelectorAll('h1,h2,p').forEach(h => {
        if (!isVis(h)) return;
        const text = clean(h.textContent);
        if (shouldSkip(text)) return;

        const next = Array.from(h.nextElementSibling ? [h.nextElementSibling] : []);
        let paragraph = next.find(el => ['P', 'DIV', 'SPAN'].includes(el.tagName) && isVis(el));
        const content = paragraph ? [clean(paragraph.textContent)] : [];

        if (text && !existsInSections(sections, text) && (content.length > 0 || text.length > 0)) {
          sections.push({ heading: text, content });
        }
      });

      // -------- 2. Other standalone card sections --------
      document.querySelectorAll('.horizontaltab-main-section').forEach(section => {
        const tabNameEl = Array.from(section.querySelectorAll('.horizontaltab-nav-link'));
        const tabname = tabNameEl ? clean(tabNameEl.textContent) : '';

        const headingEl = section.querySelector('h2, h3');
        const heading = headingEl ? clean(headingEl.textContent) : tabname || 'Untitled';

        const cards = Array.from(section.querySelectorAll('a'))
          .map(card => {
            const title = clean(card.querySelector('h3, h4, p')?.textContent);
            const href = card.getAttribute('href') || '';
            return title && title.length > 2
              ? { tabname, text: title, href }
              : null;
          })
          .filter(Boolean);

        if (cards.length && heading && !existsInSections(sections, heading)) {
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


const scrapeRelevantContent_today = async (req, res) => {
  const { targetUrl } = req.body;

  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const data = await page.evaluate(() => {
      const clean = txt => (txt || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

      const isVis = el => {
        if (!el) return false;
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden'
          && el.offsetHeight > 0 && el.offsetWidth > 0;
      };

      const shouldExclude = (text) => {
        const lower = text.toLowerCase();
        return (
          !text ||
          text.length < 30 ||
          lower.includes('cookie') ||
          lower.includes('privacy') ||
          lower.includes('login') ||
          lower.includes('©') ||
          lower.includes('audio') ||
          lower.includes('wrong email') ||
          lower.includes('item 1 of 1') ||
          lower.includes('share this') ||
          lower.includes('select all') ||
          lower.includes('transcript') ||
          lower.includes('download') ||
          lower.includes('embed link') ||
          lower.includes('email address') ||
          /corine adams/i.test(text) ||
          /^0:\d{2}/.test(text) ||
          /item \d+ of \d+/i.test(text) ||
          /tcs' expertise/i.test(lower) ||
          /made them the perfect partner/i.test(lower)
        );
      };

      // Store merged results in a map
      const sectionMap = new Map();

      const addSection = (heading, subcategory, content) => {
        const key = heading + '||' + (subcategory || '');
        if (!sectionMap.has(key)) {
          sectionMap.set(key, { heading, subcategory, content: [...content] });
        } else {
          const existing = sectionMap.get(key);
          existing.content.push(...content);
          existing.content = [...new Set(existing.content)]; // remove duplicate cards
        }
      };

      // -------- 1. Normal text headings (only visible) --------
      document.querySelectorAll('h2,span,p').forEach(h => {
        if (!isVis(h) || !isVis(h.closest('section, div'))) return;
        const text = clean(h.textContent);
        if (shouldExclude(text)) return;

        const next = Array.from(h.nextElementSibling ? [h.nextElementSibling] : []);
        let paragraph = next.find(el => ['P', 'DIV', 'SPAN'].includes(el.tagName) && isVis(el));
        const content = paragraph ? [clean(paragraph.textContent)] : [];

        addSection(text, null, content);
      });

      // -------- 2. Loop through each horizontal tab section (active + inactive) --------
      document.querySelectorAll('.horizontaltab-main-section').forEach(sectionEl => {
        const mainCategory = clean(sectionEl.querySelector('.horizontaltab-section-title')?.textContent);

        // Get all subcategory tabs
        const subTabs = Array.from(sectionEl.querySelectorAll('.horizontaltab-nav-link'));

        subTabs.forEach(tab => {
          const subCategory = clean(tab.textContent);
          const panelId = tab.getAttribute('href');
          if (!panelId) return;

          const panel = sectionEl.querySelector(panelId);
          if (!panel) return; // remove visibility check to allow inactive content

          const cards = Array.from(panel.querySelectorAll('a'))
            .map(card => {
              const title = clean(card.querySelector('h3, h4, p')?.textContent);
              const href = card.getAttribute('href') || '';
              return title ? (href ? `${title} (${href})` : title) : '';
            })
            .filter(Boolean);

          if (cards.length) {
            addSection(mainCategory, subCategory, cards);
          }
        });
      });

      // -------- 3. Other standalone visible card sections --------
      document.querySelectorAll('section').forEach(section => {
        if (section.closest('.horizontaltab-section') || !isVis(section)) return;

        const headingEl = section.querySelector('h2, h3');
        if (!headingEl || !isVis(headingEl)) return;

        const heading = clean(headingEl.textContent);
        const cards = Array.from(section.querySelectorAll('a'))
          .filter(card => isVis(card))
          .map(card => {
            const title = clean(card.querySelector('h3, h4, p')?.textContent);
            const href = card.getAttribute('href') || '';
            return title && title.length > 2 ? (href ? `${title} (${href})` : title) : '';
          })
          .filter(Boolean);

        if (cards.length && heading) {
          addSection(heading, null, cards);
        }
      });

      // Convert map back to array
      const sections = Array.from(sectionMap.values());

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
          
      // Meta description
      let metaDescription = null;
      const metaTag = document.querySelector('meta[name="description"]');
      if (metaTag) metaDescription = metaTag.getAttribute('content') || '';

      const sections = [];

      
      //--------------------------------------------------------------------------------------------------
      const clean = txt => (txt || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      const isVis = el => {
        if (!el) return false;
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden'
          && el.offsetHeight > 0 && el.offsetWidth > 0;
      };
      //--------------------------------------------------------------------------------------------------



 //---------- breadcrumb trail ---------------------------------------------------------------------------------------
      // Extract breadcrumbs from Secondary Navigation
// Breadcrumb extraction with deduplication
const seen = new Set();
const breadcrumbEls = document.querySelectorAll(
  'nav[aria-label="Secondary Navigation"] a'
);

const breadcrumbs = [];
breadcrumbEls.forEach((link, index) => {
  const text = clean(link.textContent);
  const href = link.href || '';
  const key = text.toLowerCase() + '|' + href.toLowerCase();

  if (text && href && !seen.has(key)) {
    seen.add(key);
    breadcrumbs.push({
      text,
      href,
      page: index + 1 // hierarchy level starts at 1
    });
  }
});

 //---------- END breadcrumb trail ---------------------------------------------------------------------------------------







      //------------------------ NORMAL TEXT--------------------------------------------------------------------------
      const shouldSkip = txt => {
        const lc = txt.toLowerCase();
        return !txt || txt.length < 20 ||
          lc.includes('cookie') || lc.includes('embed') ||
          txt.trim().toLowerCase() === 'get to know us better';
      };
      //Check duplicates in sections
      const existsInSections = (sections, text) => {
        const cleanText = text.toLowerCase();
        return sections.some(sec =>
          sec.heading.toLowerCase() === cleanText ||
          (sec.content && sec.content.some(c =>
            typeof c === 'string'
              ? c.toLowerCase() === cleanText
              : (c.text && c.text.toLowerCase() === cleanText)
          ))
        );
      };

      // -------- 1. Normal text sections --------
      document.querySelectorAll('h1,h2,p').forEach(h => {
        if (!isVis(h)) return;
        const text = clean(h.textContent);
        if (shouldSkip(text)) return;

        const next = Array.from(h.nextElementSibling ? [h.nextElementSibling] : []);
        let paragraph = next.find(el => ['P', 'DIV', 'SPAN'].includes(el.tagName) && isVis(el));
        const content = paragraph ? [clean(paragraph.textContent)] : [];

        if (text && !existsInSections(sections, text) && (content.length > 0 || text.length > 0)) {
          sections.push({ heading: text, content });
        }
      });

      //-------------------------- END NORMAL TEXT------------------------------------------------------------------------






      //--------------------CARDS-------------------------------------------------------------------------------
      const tabShouldExclude = text => {
        if (!text) return true;
        const lower = text.toLowerCase();
        return (
          text.length < 2 ||
          lower.includes('cookie') ||
          lower.includes('privacy') ||
          lower.includes('login') ||
          lower.includes('©')
        );
      };
      // Store sections uniquely
      const sectionMap = new Map();
      const addTabCard = (heading, tabname, tabcards) => {
        if (!heading || !tabname || !tabcards.length) return;

        if (!sectionMap.has(heading)) {
          sectionMap.set(heading, { heading, tabs: [] });
        }
        const section = sectionMap.get(heading);

        // Check if tab already exists
        let tabObj = section.tabs.find(t => t.tabname === tabname);
        if (!tabObj) {
          tabObj = { tabname, tabcards: [] };
          section.tabs.push(tabObj);
        }

        // Push unique tab cards
        tabcards.forEach(c => {
          if (!tabObj.tabcards.some(tc => tc.text === c.text && tc.href === c.href)) {
            tabObj.tabcards.push(c);
          }
        });
      };
      // -------- Loop through each horizontal tab section --------
      document.querySelectorAll('.horizontaltab-main-section').forEach(sectionEl => {
        const mainHeading = clean(sectionEl.querySelector('.horizontaltab-section-title')?.textContent);
        if (!mainHeading || tabShouldExclude(mainHeading)) return;

        const tabs = Array.from(sectionEl.querySelectorAll('.horizontaltab-nav-link'));

        tabs.forEach(tab => {
          const tabname = clean(tab.textContent);
          const panelId = tab.getAttribute('href');
          if (!panelId) return;

          const panel = sectionEl.querySelector(panelId);
          if (!panel) return; // Include even inactive

          const tabcards = Array.from(panel.querySelectorAll('a'))
            .map(card => {
              const text = clean(card.querySelector('h3, h4, p')?.textContent);
              const href = card.getAttribute('href') || '';
              return text && !tabShouldExclude(text) ? { text, href } : null;
            })
            .filter(Boolean);

          addTabCard(mainHeading, tabname, tabcards);
        });
      });
      //--------------------END CARDS-------------------------------------------------------------------------------



      const cardSections = Array.from(sectionMap.values());
      sections.push({ cards: cardSections });
      return {
        url: window.location.href,
        title: clean(document.title),
        metaDescription: metaDescription,
        breadcrumbs,
        page: sections,
      };
    });


    await browser.close();
    res.json(data);

  } catch (err) {
    console.error('Scraping failed:', err);
    res.status(500).json({ message: 'Error scraping content' });
  }
};





//************************* */

const scrapeMainPage = async (req, res) => {
  const { targetUrl } = req.body;
  try {
    const data = await scrapeCombineResult(targetUrl);
    res.json(data);
  } catch (err) {
    console.error("Scraping failed:", err);
    res.status(500).json({ message: "Error scraping content" });
  }
};

async function scrapeRelevantContent(targetUrl) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

  const data = await page.evaluate(() => {
    const clean = txt => (txt || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const isVis = el => {
      if (!el) return false;
      const s = window.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' &&
        el.offsetHeight > 0 && el.offsetWidth > 0;
    };


    function scrapePageContent(url) {
      // if same-domain and you can fetch synchronously/async, use fetch + DOMParser
      // Here just returning titles as example from current page
      return Array.from(document.querySelectorAll('h2, h3')).map(el => clean(el.textContent));
    }

    // --- scrape breadcrumbs ---
    async function scrapeBreadcrumbsAndContent() {
      const breadcrumbs = [];
      const seen = new Set();

      document.querySelectorAll('nav[aria-label="Secondary Navigation"] a').forEach((a, index) => {
        const text = clean(a.textContent);
        const href = a.getAttribute('href');
        if (text && href) {
          const key = `${text}|${href}`;
          if (!seen.has(key)) {
            seen.add(key);
            breadcrumbs.push({
              text,
              href,
              page: index + 1,
              content: scrapePageContent(href) // scrape content for that breadcrumb page
            });
          }
        }
      });
// Call main scraper for each breadcrumb href
  for (let bc of breadcrumbs) {
    const fullUrl = new URL(bc.href, window.location.origin).href;
    bc.content = await scrapeRelevantContent(fullUrl); // mainScraper is your existing page scraping method
  }
      return breadcrumbs;
    }

    // Meta description
    let metaDescription = null;
    const metaTag = document.querySelector('meta[name="description"]');
    if (metaTag) metaDescription = metaTag.getAttribute('content') || '';

    const sections = [];
    const sectionMap = new Map();

    // ---------------- Breadcrumbs ----------------
    const breadcrumbs = scrapeBreadcrumbsAndContent();


    // ---------------- Normal text sections ----------------
    const shouldSkip = txt => {
      const lc = txt.toLowerCase();
      return !txt || txt.length < 20 ||
        lc.includes('cookie') || lc.includes('embed') ||
        txt.trim().toLowerCase() === 'get to know us better';
    };
    const existsInSections = (sections, text) => {
      const cleanText = text.toLowerCase();
      return sections.some(sec =>
        sec.heading?.toLowerCase() === cleanText ||
        (sec.content && sec.content.some(c =>
          typeof c === 'string'
            ? c.toLowerCase() === cleanText
            : (c.text && c.text.toLowerCase() === cleanText)
        ))
      );
    };

    document.querySelectorAll('h1,h2,p').forEach(h => {
      if (!isVis(h)) return;
      const text = clean(h.textContent);
      if (shouldSkip(text)) return;
      const next = Array.from(h.nextElementSibling ? [h.nextElementSibling] : []);
      let paragraph = next.find(el => ['P', 'DIV', 'SPAN'].includes(el.tagName) && isVis(el));
      const content = paragraph ? [clean(paragraph.textContent)] : [];
      if (text && !existsInSections(sections, text) && (content.length > 0 || text.length > 0)) {
        sections.push({ heading: text, content });
      }
    });

    // ---------------- Cards + Tabs ----------------
    const tabShouldExclude = text => {
      if (!text) return true;
      const lower = text.toLowerCase();
      return (
        text.length < 2 ||
        lower.includes('cookie') ||
        lower.includes('privacy') ||
        lower.includes('login') ||
        lower.includes('©')
      );
    };
    const addTabCard = (heading, tabname, tabcards) => {
      if (!heading || !tabname || !tabcards.length) return;
      if (!sectionMap.has(heading)) {
        sectionMap.set(heading, { heading, tabs: [] });
      }
      const section = sectionMap.get(heading);
      let tabObj = section.tabs.find(t => t.tabname === tabname);
      if (!tabObj) {
        tabObj = { tabname, tabcards: [] };
        section.tabs.push(tabObj);
      }
      tabcards.forEach(c => {
        if (!tabObj.tabcards.some(tc => tc.text === c.text && tc.href === c.href)) {
          tabObj.tabcards.push(c);
        }
      });
    };

    document.querySelectorAll('.horizontaltab-main-section').forEach(sectionEl => {
      const mainHeading = clean(sectionEl.querySelector('.horizontaltab-section-title')?.textContent);
      if (!mainHeading || tabShouldExclude(mainHeading)) return;

      const tabs = Array.from(sectionEl.querySelectorAll('.horizontaltab-nav-link'));
      tabs.forEach(tab => {
        const tabname = clean(tab.textContent);
        const panelId = tab.getAttribute('href');
        if (!panelId) return;
        const panel = sectionEl.querySelector(panelId);
        if (!panel) return;
        const tabcards = Array.from(panel.querySelectorAll('a'))
          .map(card => {
            const text = clean(card.querySelector('h3, h4, p')?.textContent);
            const href = card.getAttribute('href') || '';
            return text && !tabShouldExclude(text) ? { text, href } : null;
          })
          .filter(Boolean);
        addTabCard(mainHeading, tabname, tabcards);
      });
    });

    const cardSections = Array.from(sectionMap.values());
    if (cardSections.length) sections.push({ cards: cardSections });

    return {
      url: window.location.href,
      title: clean(document.title),
      metaDescription,
      breadcrumbs,
      sections,

    };
  });

  await browser.close();
  return data;
}


async function scrapeCombineResult(targetUrl) {
  return await scrapeRelevantContent(targetUrl);
}


//********************************** */



//--16-------------
const scrapeRelevantContent = async (req, res) => {
  const { targetUrl, maxDepth = 4 } = req.body;
  try {
    const data = await scrapeCombineResult(targetUrl, maxDepth);
    res.json(data);
  } catch (err) {
    console.error("Scraping failed:", err);
    res.status(500).json({ message: "Error scraping content" });
  }
};

async function startScraping(targetUrl, maxDepth, currentDepth = 0, visited = new Set()) {
  if (currentDepth > maxDepth) return null;
  if (visited.has(targetUrl)) return null;
  visited.add(targetUrl);

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

    const data = await page.evaluate(
      async ({ targetUrl, currentDepth, maxDepth, origin }) => {
        const clean = (txt) =>
          (txt || "").replace(/\n/g, " ").replace(/\s+/g, " ").trim();

        const isVis = (el) => {
          if (!el) return false;
          const s = window.getComputedStyle(el);
          return (
            s.display !== "none" &&
            s.visibility !== "hidden" &&
            el.offsetHeight > 0 &&
            el.offsetWidth > 0
          );
        };

        // ------------ scrape content ------------
        function scrapePageContent() {
          return Array.from(document.querySelectorAll("h2, h3")).map((el) =>
            clean(el.textContent)
          );
        }

        // ------------ breadcrumbs ------------
        const breadcrumbs = [];
        const seen = new Set();

        document
          .querySelectorAll('nav[aria-label="Secondary Navigation"] a')
          .forEach((a, index) => {
            const text = clean(a.textContent);
            const href = a.getAttribute("href");
            if (text && href) {
              const absHref = new URL(href, window.location.origin).href;
              const key = `${text}|${absHref}`;
              if (
                !seen.has(key) &&
                absHref !== targetUrl // skip same as target
              ) {
                seen.add(key);
                breadcrumbs.push({
                  text,
                  href: absHref,
                  page: index + 1,
                  depth: currentDepth + 1,
                  pagedata: [], // will be filled outside
                });
              }
            }
          });

        // ------------ meta ------------
        let metaDescription = null;
        const metaTag = document.querySelector('meta[name="description"]');
        if (metaTag) metaDescription = metaTag.getAttribute("content") || "";

        const sections = [];
        const sectionMap = new Map();

        // ------------ main content ------------
        const shouldSkip = (txt) => {
          const lc = txt.toLowerCase();
          return (
            !txt ||
            txt.length < 20 ||
            lc.includes("cookie") ||
            lc.includes("embed") ||
            txt.trim().toLowerCase() === "get to know us better"
          );
        };

        const existsInSections = (sections, text) => {
          const cleanText = text.toLowerCase();
          return sections.some(
            (sec) =>
              sec.heading?.toLowerCase() === cleanText ||
              (sec.content &&
                sec.content.some((c) =>
                  typeof c === "string"
                    ? c.toLowerCase() === cleanText
                    : c.text && c.text.toLowerCase() === cleanText
                ))
          );
        };

        document.querySelectorAll("h1,h2,p").forEach((h) => {
          if (!isVis(h)) return;
          const text = clean(h.textContent);
          if (shouldSkip(text)) return;
          const next = Array.from(
            h.nextElementSibling ? [h.nextElementSibling] : []
          );
          let paragraph = next.find(
            (el) => ["P", "DIV", "SPAN"].includes(el.tagName) && isVis(el)
          );
          const content = paragraph ? [clean(paragraph.textContent)] : [];
          if (
            text &&
            !existsInSections(sections, text) &&
            (content.length > 0 || text.length > 0)
          ) {
            sections.push({ heading: text, content });
          }
        });

        // ------------ tabs/cards ------------
        const tabShouldExclude = (text) => {
          if (!text) return true;
          const lower = text.toLowerCase();
          return (
            text.length < 2 ||
            lower.includes("cookie") ||
            lower.includes("privacy") ||
            lower.includes("login") ||
            lower.includes("©")
          );
        };

        const addTabCard = (heading, tabname, tabcards) => {
          if (!heading || !tabname || !tabcards.length) return;
          if (!sectionMap.has(heading)) {
            sectionMap.set(heading, { heading, tabs: [] });
          }
          const section = sectionMap.get(heading);
          let tabObj = section.tabs.find((t) => t.tabname === tabname);
          if (!tabObj) {
            tabObj = { tabname, tabcards: [] };
            section.tabs.push(tabObj);
          }
          tabcards.forEach((c) => {
            if (
              !tabObj.tabcards.some(
                (tc) => tc.text === c.text && tc.href === c.href
              )
            ) {
              tabObj.tabcards.push(c);
            }
          });
        };

        document
          .querySelectorAll(".horizontaltab-main-section")
          .forEach((sectionEl) => {
            const mainHeading = clean(
              sectionEl.querySelector(".horizontaltab-section-title")
                ?.textContent
            );
            if (!mainHeading || tabShouldExclude(mainHeading)) return;

            const tabs = Array.from(
              sectionEl.querySelectorAll(".horizontaltab-nav-link")
            );
            tabs.forEach((tab) => {
              const tabname = clean(tab.textContent);
              const panelId = tab.getAttribute("href");
              if (!panelId) return;
              const panel = sectionEl.querySelector(panelId);
              if (!panel) return;
              const tabcards = Array.from(panel.querySelectorAll("a"))
                .map((card) => {
                  const text = clean(
                    card.querySelector("h3, h4, p")?.textContent
                  );
                  const href = card.getAttribute("href") || "";
                  return text && !tabShouldExclude(text)
                    ? { text, href }
                    : null;
                })
                .filter(Boolean);
              addTabCard(mainHeading, tabname, tabcards);
            });
          });

        const cardSections = Array.from(sectionMap.values());
        if (cardSections.length) sections.push({ cards: cardSections });

        return {
          url: window.location.href,
          title: clean(document.title),
          metaDescription,
          breadcrumbs,
          sections,
          depth: currentDepth,
        };
      },
      { targetUrl, currentDepth, maxDepth, origin: new URL(targetUrl).origin }
    );

    // ------------ handle recursive scrape ------------
    for (let bc of data.breadcrumbs) {
      const urlObj = new URL(bc.href, targetUrl);

      // rule 1: outside domain -> scrape only at depth 0
      if (urlObj.origin !== new URL(targetUrl).origin && currentDepth > 0) {
        continue;
      }

      // rule 2: within depth
      if (currentDepth + 1 <= maxDepth) {
        console.log(`Scraping depth ${currentDepth + 1}: ${bc.href}`);
        bc.pagedata = await startScraping(
          bc.href,
          maxDepth,
          currentDepth + 1,
          visited
        );
      }
    }

    return data;
  } finally {
    await browser.close();
  }
}

async function scrapeCombineResult(targetUrl, maxDepth = 4) {
  return await startScraping(targetUrl, maxDepth, 0);
}




export { scrapeUrl, GetScrapping, scrapeFullPageContent, scrapeRelevantContent };