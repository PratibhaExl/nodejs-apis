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

// const scrapeRelevantContent = async (req, res) => {
//   const { targetUrl } = req.body;

//   try {
//     const browser = await puppeteer.launch({ headless: 'new' });
//     const page = await browser.newPage();
//     await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

//     const data = await page.evaluate(() => {
//   const isVisible = (el) => {
//     const style = window.getComputedStyle(el);
//     return (
//       style &&
//       style.display !== 'none' &&
//       style.visibility !== 'hidden' &&
//       el.offsetHeight > 0 &&
//       el.offsetWidth > 0
//     );
//   };

//   const webPageInfo = {
//     url: window.location.href,
//     title: document.title || '',
//     description: '',
//     sections: []
//   };

//   const metaDesc = document.querySelector('meta[name="description"]');
//   if (metaDesc) {
//     webPageInfo.description = metaDesc.getAttribute('content')?.trim() || '';
//   }

//   const allElements = Array.from(document.body.querySelectorAll('h1, h2, h3, p, div, span, video'));
//   let currentHeading = null;
//   const sectionMap = new Map();

//   const isValidText = (text) => {
//     if (!text || text.trim().length < 30) return false;
//     const lower = text.toLowerCase();
//     return ![
//       'cookie', 'accept', 'privacy', 'login', 'terms',
//       '©', 'audio', 'share this', 'wrong email', 'transcript', 'download',
//       'select all', 'cancel', 'embed size', 'message'
//     ].some(keyword => lower.includes(keyword));
//   };

//   for (const el of allElements) {
//     if (!isVisible(el)) continue;

//     const tag = el.tagName.toLowerCase();
//     let text = el.textContent?.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

//     if (!text) continue;

//     if (['h1', 'h2', 'h3'].includes(tag)) {
//       if (isValidText(text)) {
//         currentHeading = text;
//         if (!sectionMap.has(currentHeading)) {
//           sectionMap.set(currentHeading, []);
//         }
//       }
//     } else if (['p', 'div', 'span'].includes(tag)) {
//       if (isValidText(text) && currentHeading) {
//         const existing = sectionMap.get(currentHeading) || [];
//         if (!existing.includes(text)) {
//           existing.push(text);
//           sectionMap.set(currentHeading, existing);
//         }
//       }
//     } else if (tag === 'video') {
//       // Try to capture surrounding text as video description
//       const parent = el.closest('section') || el.parentElement;
//       if (parent) {
//         const captions = Array.from(parent.querySelectorAll('p, span, h4'))
//           .filter(isVisible)
//           .map(e => e.textContent?.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
//           .filter(t => t && isValidText(t));

//         if (captions.length > 0) {
//           const heading = "Video Highlights";
//           const existing = sectionMap.get(heading) || [];
//           captions.forEach(cap => {
//             if (!existing.includes(cap)) existing.push(cap);
//           });
//           sectionMap.set(heading, existing);
//         }
//       }
//     }
//   }

//   // Only return structured sections that have valid content
//   webPageInfo.sections = Array.from(sectionMap.entries())
//     .filter(([heading, content]) => heading && content.length > 0)
//     .map(([heading, content]) => ({
//       heading: heading.replace(/\n/g, ' ').trim(),
//       content
//     }));

//   return webPageInfo;
// });

// //     const data = await page.evaluate(() => {
// //   const webPageInfo = {
// //     url: window.location.href,
// //     title: document.title || '',
// //     description: '',
// //     sections: []
// //   };

// //   const metaDesc = document.querySelector('meta[name="description"]');
// //   if (metaDesc) {
// //     webPageInfo.description = metaDesc.getAttribute('content') || '';
// //   }

// //   const allElements = Array.from(document.body.querySelectorAll('h1, h2, h3, p, div'));
// //   let currentHeading = 'Introduction';
// //   let sectionMap = new Map();

// //   for (const el of allElements) {
// //     const tag = el.tagName.toLowerCase();
// //     let text = el.textContent?.trim();

// //     if (!text || text.replace(/\s/g, '').length < 20) continue;

// //     if (['h1', 'h2', 'h3'].includes(tag)) {
// //       currentHeading = text;
// //       if (!sectionMap.has(currentHeading)) {
// //         sectionMap.set(currentHeading, []);
// //       }
// //     } else if (['p', 'div'].includes(tag)) {
// //       if (!/cookie|accept|privacy|login|terms|©/i.test(text)) {
// //         const existing = sectionMap.get(currentHeading) || [];
// //         const cleanedText = text.replace(/\s+/g, ' ').trim();
// //         if (!existing.includes(cleanedText)) {
// //           existing.push(cleanedText);
// //           sectionMap.set(currentHeading, existing);
// //         }
// //       }
// //     }
// //   }

// //   // Special logic to extract “In Focus” categories
// //   const inFocusSection = document.querySelector('section[id*="in-focus"]') || document.querySelector('section[class*="in-focus"]');
// //   if (inFocusSection) {
// //     const cards = inFocusSection.querySelectorAll('div[class*="card"], article');
// //     const focusMap = new Map();

// //     cards.forEach(card => {
// //       const category = card.querySelector('span, .eyebrow, .category')?.textContent?.trim();
// //       const headline = card.querySelector('h3, h4, .headline')?.textContent?.trim();
// //       const summary = card.querySelector('p, .summary')?.textContent?.trim();

// //       if (category && headline) {
// //         const fullContent = `${headline}${summary ? ' - ' + summary : ''}`;
// //         if (!focusMap.has(category)) {
// //           focusMap.set(category, []);
// //         }
// //         const existing = focusMap.get(category);
// //         if (!existing.includes(fullContent)) {
// //           existing.push(fullContent);
// //           focusMap.set(category, existing);
// //         }
// //       }
// //     });

// //     // Merge In Focus into webPageInfo.sections
// //     for (const [category, content] of focusMap.entries()) {
// //       webPageInfo.sections.push({ heading: `In Focus: ${category}`, content });
// //     }
// //   }

// //   // Add general content
// //   webPageInfo.sections.push(
// //     ...Array.from(sectionMap.entries()).map(([heading, content]) => ({
// //       heading,
// //       content,
// //     }))
// //   );

// //   return webPageInfo;
// // });


//     await browser.close();
//     return res.json(data);
//   } catch (err) {
//     console.error('Scraping failed:', err);
//     return res.status(500).json({ message: 'Error scraping content' });
//   }
// };

const scrapeRelevantContent_ = async (req, res) => {
  const { targetUrl } = req.body;

  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const data = await page.evaluate(() => {
      const cleanText = (text) =>
        (text || '')
          .replace(/\\+/g, '') // Remove all backslashes
          .replace(/\n/g, ' ') // Remove newlines
          .replace(/\s+/g, ' ') // Normalize spacing
          .trim();

      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        return (
          style &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          el.offsetHeight > 0 &&
          el.offsetWidth > 0
        );
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
          /corine adams/i.test(text) || //  testimonial filter
          /^0:\d{2}/.test(text) || //  timecodes like 0:00
          /item \d+ of \d+/i.test(text) || //  carousel count
          /tcs' expertise/i.test(lower) || //  repeated quote text
          /made them the perfect partner/i.test(lower)
        );
      };


      const webPageInfo = {
        url: window.location.href,
        title: cleanText(document.title),
        description: '',
        sections: [],
        videos: []
      };

      // Description
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        webPageInfo.description = cleanText(metaDesc.getAttribute('content'));
      }

      const sectionMap = new Map();
      let currentHeading = null;

      const elements = Array.from(document.body.querySelectorAll('h1, h2, h3, p, div, span, section'));

      for (const el of elements) {
        if (!isVisible(el)) continue;

        const tag = el.tagName.toLowerCase();
        let text = cleanText(el.textContent);

        if (['h1', 'h2', 'h3'].includes(tag) && !shouldExclude(text)) {
          currentHeading = text;
          if (!sectionMap.has(currentHeading)) {
            sectionMap.set(currentHeading, []);
          }
        } else if (['p', 'div', 'span'].includes(tag)) {
          if (!shouldExclude(text) && currentHeading) {
            const existing = sectionMap.get(currentHeading) || [];
            if (!existing.includes(text)) {
              existing.push(text);
              sectionMap.set(currentHeading, existing);
            }
          }
        }

        // Handle video captions only if inside section or div
        if (el.querySelector('video')) {
          const captionElements = Array.from(el.querySelectorAll('h2, h3, p, span'))
            .filter((e) => isVisible(e))
            .map((e) => cleanText(e.textContent))
            .filter((t) => !shouldExclude(t));

          for (const caption of captionElements) {
            if (caption && !webPageInfo.videos.includes(caption)) {
              webPageInfo.videos.push(caption);
            }
          }
        }
      }

      webPageInfo.sections = Array.from(sectionMap.entries()).map(([heading, content]) => ({
        heading: cleanText(heading),
        content: content.map(cleanText)
      }));

      return webPageInfo;
    });

    await browser.close();
    return res.json(data);
  } catch (err) {
    console.error('Scraping failed:', err);
    return res.status(500).json({ message: 'Error scraping content' });
  }
};
//removed r
const scrapeRelevantContent = async (req, res) => {
  const { targetUrl } = req.body;

  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });


    const data = await page.evaluate(() => {
      const clean = txt => (txt || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      const isVis = el => {
        const s = window.getComputedStyle(el);
        return s && s.display !== 'none' && s.visibility !== 'hidden'
          && el.offsetHeight > 0 && el.offsetWidth > 0;
      };

      const shouldSkip = txt => {
        const lc = txt.toLowerCase();
        return !txt || txt.length < 20
          || lc.includes('cookie') || lc.includes('embed');
      };

      const sections = [];

      document.querySelectorAll('h2, h3').forEach(h => {
        if (!isVis(h)) return;
        const text = clean(h.textContent);
        if (shouldSkip(text)) return;
        const next = Array.from(h.nextElementSibling ? [h.nextElementSibling] : []);
        let paragraph = next.find(el => ['P', 'DIV', 'SPAN'].includes(el.tagName) && isVis(el));
        const content = paragraph ? [clean(paragraph.textContent)] : [];
        sections.push({ heading: text, content });
      });

      const focus = document.querySelector('section[class*="in‑focus"], div[class*="in‑focus"]');
      if (focus) {
        focus.querySelectorAll('a:not(.share)').forEach(card => {
          const category = clean(card.querySelector('.eyebrow, .card‑category')?.textContent);
          const title = clean(card.querySelector('h3, h4')?.textContent);
          if (category && title) {
            const heading = `In Focus: ${category}`;
            sections.push({ heading, content: [title] });
          }
        });
      }

      return { url: window.location.href, title: clean(document.title), description: '', sections };
    });



    await browser.close();
    return res.json(data);
  } catch (err) {
    console.error('Scraping failed:', err);
    return res.status(500).json({ message: 'Error scraping content' });
  }
};

export { scrapeUrl, GetScrapping, scrapeFullPageContent, scrapeRelevantContent };
