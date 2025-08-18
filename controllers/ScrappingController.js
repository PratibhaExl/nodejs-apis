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









//------------------------15 August ----------------------------------

// async function scrapeBreadcrumbsAndContent(page, url, visited, counter, level = 1) {
//   if (visited.has(url)) return null;
//   visited.add(url);

//   console.log(`Scraping Level ${level}, Page ${counter.current}: ${url}`);
//   await page.goto(url, { waitUntil: 'networkidle2' });

//   // --- SCRAPE BREADCRUMBS ---
//   const breadcrumbs = await page.evaluate((pageNum) => {
//     const seen = new Set();
//     const crumbs = [];
//     const nav = document.querySelector('nav[aria-label="Secondary Navigation"]');
//     if (nav) {
//       const homeLink = nav.querySelector('.secondary-nav-home-link-box a');
//       if (homeLink) {
//         const text = homeLink.textContent.trim();
//         const href = homeLink.href;
//         const key = text + href;
//         if (!seen.has(key)) {
//           seen.add(key);
//           crumbs.push({ text, href, page: pageNum });
//         }
//       }
//       const subLinks = nav.querySelectorAll('.secondary-nav-list .navigation-link');
//       subLinks.forEach((link) => {
//         const text = link.textContent.trim();
//         const href = link.href;
//         const key = text + href;
//         if (!seen.has(key)) {
//           seen.add(key);
//           crumbs.push({ text, href, page: pageNum + 1 }); // temp, updated in recursion
//         }
//       });
//     }
//     return crumbs;
//   }, counter.current);

//   // --- SCRAPE SECTIONS / TABS ---
//   const sections = await page.evaluate(() => {
//     const collected = [];
//     const seenHeadings = new Set();

//     // Main visible section headings
//     document.querySelectorAll('.horizontaltab-section-title').forEach((card) => {
//       const text = card.textContent.trim();
//       if (!seenHeadings.has(text.toLowerCase())) {
//         seenHeadings.add(text.toLowerCase());
//         collected.push({ heading: text, content: [] });
//       }
//     });

//     // Tab navigation links
//     document.querySelectorAll('.horizontaltab-nav-link').forEach((tab) => {
//       const title = tab.textContent.trim();
//       const link = tab.href || null;
//       if (!seenHeadings.has(title.toLowerCase())) {
//         seenHeadings.add(title.toLowerCase());
//         collected.push({ heading: title, href: link, content: [] });
//       }
//     });

//     return collected;
//   });

//   const pageData = { url, pageNumber: counter.current, breadcrumbs, sections };

//   // --- RECURSE INTO BREADCRUMB PAGES ---
//   for (let crumb of breadcrumbs) {
//     if (crumb.href && !visited.has(crumb.href)) {
//       counter.current++;
//       crumb.page = counter.current; // assign real page number
//       const childData = await scrapeBreadcrumbsAndContent(page, crumb.href, visited, counter, level + 1);
//       if (childData) {
//         pageData[`breadcrumb_page_${crumb.page}`] = childData;
//       }
//     }
//   }

//   // --- RECURSE INTO TAB PAGES ---
//   for (let [index, section] of sections.entries()) {
//     if (section.href && !visited.has(section.href)) {
//       counter.current++;
//       section.page = counter.current;
//       const tabData = await scrapeBreadcrumbsAndContent(page, section.href, visited, counter, level + 1);
//       if (tabData) {
//         pageData.sections[index].childPage = tabData;
//       }
//     }
//   }

//   return pageData;
// }


// async function startScraping(startUrl) {
//   const browser = await puppeteer.launch({ headless: true });
//   const page = await browser.newPage();
//   const visited = new Set();
//   const counter = { current: 1 };

//   const finalData = await scrapeBreadcrumbsAndContent(page, startUrl, visited, counter);

//   await browser.close();
//   return finalData;
// }


// // --- MAIN EXECUTION ---
// const scrapeRelevantContentt = async (req, res) => {
//   const url = req.body.targetUrl; // read from body
//   if (!url) {
//     return res.status(400).json({ error: 'targetUrl is required in body' });
//   }
//   try {
//     const data = await startScraping(url);
//     res.json(data);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Scraping failed' });
//   }
// };



//----nested --------


// working breadcrumbs till depth 2 
// const scrapeRelevantContent = async (req, res) => {
//   const { targetUrl, depth = 4 } = req.body;
//   try {
//     console.log(`[SCRAPER] Start scraping root URL: ${targetUrl}, MaxDepth=${depth}`);
//     const data = await scrapeCombineResult(targetUrl, depth);
//     console.log(`[SCRAPER] Completed scraping for ${targetUrl}`);
//     res.json(data);
//   } catch (err) {
//     console.error("Scraping failed:", err);
//     res.status(500).json({ message: "Error scraping content" });
//   }
// };

// async function scrapeCombineResult(targetUrl, maxDepth) {
//   return await startScraping(targetUrl, 0, maxDepth, new Set(), new URL(targetUrl).origin);
// }

// async function startScraping(targetUrl, currentDepth, maxDepth, visited, rootDomain) {
//   if (currentDepth > maxDepth) return null;
//   if (visited.has(targetUrl)) return null;
//   visited.add(targetUrl);

//   console.log(`[SCRAPER][Depth=${currentDepth}] Navigating: ${targetUrl}`);

//   const browser = await puppeteer.launch({ headless: "new" });
//   const page = await browser.newPage();
//   await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

//   const data = await page.evaluate(() => {
//     const clean = (txt) => (txt || "").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
//     const isVis = (el) => {
//       if (!el) return false;
//       const s = window.getComputedStyle(el);
//       return s.display !== "none" && s.visibility !== "hidden" &&
//         el.offsetHeight > 0 && el.offsetWidth > 0;
//     };

//     // Sections collection
//     const sections = [];
//     const sectionMap = new Map();

//     // Meta description
//     let metaDescription = null;
//     const metaTag = document.querySelector('meta[name="description"]');
//     if (metaTag) metaDescription = metaTag.getAttribute("content") || "";

//     // Headings & paragraphs
//     const shouldSkip = (txt) => {
//       const lc = txt.toLowerCase();
//       return !txt || txt.length < 20 ||
//         lc.includes("cookie") || lc.includes("embed") ||
//         txt.trim().toLowerCase() === "get to know us better";
//     };
//     const existsInSections = (sections, text) => {
//       const cleanText = text.toLowerCase();
//       return sections.some(sec =>
//         sec.heading?.toLowerCase() === cleanText ||
//         (sec.content && sec.content.some(c =>
//           typeof c === "string"
//             ? c.toLowerCase() === cleanText
//             : (c.text && c.text.toLowerCase() === cleanText)
//         ))
//       );
//     };

//     document.querySelectorAll("h1,h2,p").forEach(h => {
//       if (!isVis(h)) return;
//       const text = clean(h.textContent);
//       if (shouldSkip(text)) return;
//       const next = Array.from(h.nextElementSibling ? [h.nextElementSibling] : []);
//       let paragraph = next.find(el => ["P", "DIV", "SPAN"].includes(el.tagName) && isVis(el));
//       const content = paragraph ? [clean(paragraph.textContent)] : [];
//       if (text && !existsInSections(sections, text) && (content.length > 0 || text.length > 0)) {
//         sections.push({ heading: text, content });
//       }
//     });

//     // Tabs & Cards
//     const tabShouldExclude = (text) => {
//       if (!text) return true;
//       const lower = text.toLowerCase();
//       return (text.length < 2 || lower.includes("cookie") || lower.includes("privacy") || lower.includes("login") || lower.includes("©"));
//     };
//     const addTabCard = (heading, tabname, tabcards) => {
//       if (!heading || !tabname || !tabcards.length) return;
//       if (!sectionMap.has(heading)) {
//         sectionMap.set(heading, { heading, tabs: [] });
//       }
//       const section = sectionMap.get(heading);
//       let tabObj = section.tabs.find(t => t.tabname === tabname);
//       if (!tabObj) {
//         tabObj = { tabname, tabcards: [] };
//         section.tabs.push(tabObj);
//       }
//       tabcards.forEach(c => {
//         if (!tabObj.tabcards.some(tc => tc.text === c.text && tc.href === c.href)) {
//           tabObj.tabcards.push(c);
//         }
//       });
//     };

//     document.querySelectorAll(".horizontaltab-main-section").forEach(sectionEl => {
//       const mainHeading = clean(sectionEl.querySelector(".horizontaltab-section-title")?.textContent);
//       if (!mainHeading || tabShouldExclude(mainHeading)) return;

//       const tabs = Array.from(sectionEl.querySelectorAll(".horizontaltab-nav-link"));
//       tabs.forEach(tab => {
//         const tabname = clean(tab.textContent);
//         const panelId = tab.getAttribute("href");
//         if (!panelId) return;
//         const panel = sectionEl.querySelector(panelId);
//         if (!panel) return;
//         const tabcards = Array.from(panel.querySelectorAll("a"))
//           .map(card => {
//             const text = clean(card.querySelector("h3, h4, p")?.textContent);
//             const href = card.getAttribute("href") || "";
//             return text && !tabShouldExclude(text) ? { text, href } : null;
//           })
//           .filter(Boolean);
//         addTabCard(mainHeading, tabname, tabcards);
//       });
//     });

//     const cardSections = Array.from(sectionMap.values());
//     if (cardSections.length) sections.push({ cards: cardSections });

//     // Breadcrumbs
//     const breadcrumbs = [];
//     const seen = new Set();
//     document.querySelectorAll('nav[aria-label="Secondary Navigation"] a').forEach((a, index) => {
//       const text = clean(a.textContent);
//       const href = a.getAttribute("href");
//       if (text && href) {
//         const key = `${text}|${href}`;
//         if (!seen.has(key)) {
//           seen.add(key);
//           breadcrumbs.push({ text, href });
//         }
//       }
//     });

//     return {
//       url: window.location.href,
//       title: clean(document.title),
//       metaDescription,
//       breadcrumbs,
//       sections
//     };
//   });

//   await browser.close();

//   // Attach depth & recursive scraping
//   data.depth = currentDepth;

//   // Dedup + filter breadcrumbs
//   const uniqueBreadcrumbs = [];
//   const seenBC = new Set();
//   for (let bc of data.breadcrumbs) {
//     const fullUrl = new URL(bc.href, data.url).href;
//     if (fullUrl === targetUrl) continue; // Skip self
//     if (seenBC.has(fullUrl)) continue;
//     seenBC.add(fullUrl);

//     const isSameDomain = fullUrl.startsWith(rootDomain);
//     if (!isSameDomain && currentDepth > 0) continue; // external only depth=0

//     let childSections = {};
//     if (isSameDomain && currentDepth < maxDepth) {
//       console.log(`[SCRAPER][Depth=${currentDepth}] -> Recursing into breadcrumb: ${fullUrl}`);
//       childSections = await startScraping(fullUrl, currentDepth + 1, maxDepth, visited, rootDomain);
//     }

//     uniqueBreadcrumbs.push({
//       text: bc.text,
//       href: fullUrl,
//       depth: currentDepth + 1,
//       sections: childSections || {}
//     });
//   }
//   data[`breadcrumbs_${currentDepth}`] = uniqueBreadcrumbs;
//   delete data.breadcrumbs;

//   // Same for tabcards recursion
//   if (data.sections) {
//     for (const section of data.sections) {
//       if (section.cards) {
//         for (const cardGroup of section.cards) {
//           for (const tab of cardGroup.tabs) {
//             for (const card of tab.tabcards) {
//               const fullUrl = new URL(card.href, data.url).href;
//               const isSameDomain = fullUrl.startsWith(rootDomain);
//               let childSections = {};
//               if (isSameDomain && currentDepth < maxDepth) {
//                 console.log(`[SCRAPER][Depth=${currentDepth}] -> Recursing into tabcard: ${fullUrl}`);
//                 childSections = await startScraping(fullUrl, currentDepth + 1, maxDepth, visited, rootDomain);
//               }
//               card.depth = currentDepth + 1;
//               card.sections = childSections || {};
//             }
//           }
//         }
//       }
//     }
//   }

//   console.log(`[SCRAPER][Depth=${currentDepth}] Completed scraping: ${targetUrl}`);
//   return data;
// }

// trying sections depth 
/* =========================
   SAFE HELPERS (Node side)
   ========================= */
function toAbsoluteUrl(raw, base) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s === "#" || s.startsWith("#")) return null;
  const lower = s.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  ) {
    return null;
  }
  try {
    return new URL(s, base).href;
  } catch {
    return null;
  }
}

function sameOriginSafely(a, b) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/* =======================================
   MAIN RECURSIVE SCRAPER USING ONE PAGE
   ======================================= */
async function scrapePages(page, targetUrl, visited, level = 0, maxDepth = 4, startOrigin = "") {
  if (!targetUrl) return null;
  if (visited.has(targetUrl)) {
    console.log(`[SKIP] Already visited: ${targetUrl}`);
    return null;
  }
  visited.add(targetUrl);

  console.log(`[GO] depth=${level} → ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

  // Evaluate in browser context and build a clean JSON (no circular refs)
  const pageData = await page.evaluate((currentUrl) => {
    // --- helpers inside the page context ---
    function clean(txt) {
      return txt ? txt.replace(/\s+/g, " ").trim() : "";
    }
    function toAbs(raw, base) {
      if (!raw || typeof raw !== "string") return null;
      const s = raw.trim();
      if (!s || s === "#" || s.startsWith("#")) return null;
      const lower = s.toLowerCase();
      if (
        lower.startsWith("javascript:") ||
        lower.startsWith("mailto:") ||
        lower.startsWith("tel:")
      ) {
        return null;
      }
      try {
        return new URL(s, base).href;
      } catch {
        return null;
      }
    }

    const sections = [];
    const sectionMap = new Map();

    // ---------- Normal text ----------
    const isVis = (el) => {
      if (!el) return false;
      const s = window.getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden" && el.offsetHeight > 0 && el.offsetWidth > 0;
    };
    const shouldSkip = (txt) => {
      if (!txt) return true;
      const t = txt.trim();
      const lc = t.toLowerCase();
      return (
        t.length < 20 ||
        lc.includes("cookie") ||
        lc.includes("embed") ||
        lc === "get to know us better"
      );
    };

    document.querySelectorAll("h1,h2,p").forEach((h) => {
      if (!isVis(h)) return;
      const text = clean(h.textContent);
      if (shouldSkip(text)) return;
      const next = h.nextElementSibling;
      let paragraph =
        next && ["P", "DIV", "SPAN"].includes(next.tagName) && isVis(next)
          ? clean(next.textContent)
          : "";
      sections.push({ heading: text, content: paragraph ? [paragraph] : [] });
    });

    // ---------- Tabs / cards ----------
    const tabShouldExclude = (text) => {
      if (!text) return true;
      const lc = text.toLowerCase();
      return text.length < 2 || lc.includes("cookie") || lc.includes("privacy") || lc.includes("login") || lc.includes("©");
    };

    document.querySelectorAll(".horizontaltab-main-section").forEach((sectionEl) => {
      const mainHeading = clean(sectionEl.querySelector(".horizontaltab-section-title")?.textContent);
      if (!mainHeading || tabShouldExclude(mainHeading)) return;

      const tabs = Array.from(sectionEl.querySelectorAll(".horizontaltab-nav-link"));
      tabs.forEach((tab) => {
        const tabname = clean(tab.textContent);
        const panelId = tab.getAttribute("href");
        if (!panelId) return;
        const panel = sectionEl.querySelector(panelId);
        if (!panel) return;

        const tabcards = Array.from(panel.querySelectorAll("a"))
          .map((a) => {
            const text = clean(a.querySelector("h3, h4, p")?.textContent);
            const href = toAbs(a.getAttribute("href") || "", currentUrl);
            return text && href ? { text, href } : null;
          })
          .filter(Boolean);

        if (!sectionMap.has(mainHeading)) {
          sectionMap.set(mainHeading, { heading: mainHeading, tabs: [] });
        }
        const sec = sectionMap.get(mainHeading);
        let t = sec.tabs.find((x) => x.tabname === tabname);
        if (!t) {
          t = { tabname, tabcards: [] };
          sec.tabs.push(t);
        }
        tabcards.forEach((c) => {
          if (!t.tabcards.some((e) => e.href === c.href && e.text === c.text)) {
            t.tabcards.push(c);
          }
        });
      });
    });

    const cardSections = Array.from(sectionMap.values());
    if (cardSections.length) sections.push({ cards: cardSections });

    // ---------- Breadcrumbs ----------
    const breadcrumbs = [];
    const seenBC = new Set();
    document.querySelectorAll('nav[aria-label="Secondary Navigation"] a').forEach((a, idx) => {
      const text = clean(a.textContent);
      const href = toAbs(a.getAttribute("href") || "", currentUrl);
      if (text && href) {
        const key = `${text}|${href}`;
        if (!seenBC.has(key)) {
          seenBC.add(key);
          breadcrumbs.push({ text, href, idx });
        }
      }
    });

    return {
      url: currentUrl,
      title: clean(document.title),
      sections,
      breadcrumbs
    };
  }, targetUrl);

  console.log(
    `[OK] depth=${level} got ${pageData.sections.length} section-block(s), ${pageData.breadcrumbs.length} breadcrumb(s)`
  );

  // ------- Recurse into breadcrumbs -------
  for (const bc of pageData.breadcrumbs) {
    // If matches current page, copy sections (no recursion)
    if (bc.href === targetUrl) {
      console.log(`[COPY] depth=${level} breadcrumb self-link → copy sections (${bc.href})`);
      bc.depth = level + 1;
      bc.sections = pageData.sections; // copy existing sections
      continue;
    }

    bc.depth = level + 1;

    // Only recurse if within maxDepth and same-origin
    if (level + 1 <= maxDepth && sameOriginSafely(bc.href, startOrigin)) {
      console.log(`[→] depth=${bc.depth} scraping breadcrumb ${bc.href}`);
      const child = await scrapePages(page, bc.href, visited, level + 1, maxDepth, startOrigin);
      bc.sections = child ? child.sections : {};
    } else {
      // Outside domain or too deep
      bc.sections = {};
      console.log(
        `[SKIP] breadcrumb depth=${bc.depth} ${bc.href} (too deep or cross-origin)`
      );
    }
  }

  // ------- Recurse into tab/section cards -------
  for (const sec of pageData.sections) {
    if (!sec.cards) continue;
    for (const group of sec.cards) {
      for (const tab of group.tabs) {
        for (const card of tab.tabcards) {
          card.depth = level + 1;
          if (card.href === targetUrl) {
            console.log(`[COPY] depth=${level} card self-link → copy sections (${card.href})`);
            card.sections = pageData.sections;
            continue;
          }
          if (level + 1 <= maxDepth && sameOriginSafely(card.href, startOrigin)) {
            console.log(`[→] depth=${card.depth} scraping card ${card.href}`);
            const child = await scrapePages(page, card.href, visited, level + 1, maxDepth, startOrigin);
            card.sections = child ? child.sections : {};
          } else {
            card.sections = {};
            console.log(
              `[SKIP] card depth=${card.depth} ${card.href} (too deep or cross-origin)`
            );
          }
        }
      }
    }
  }

  return pageData;
}

/* ===========================
   PUBLIC ENTRY FOR YOUR API
   =========================== */
async function scrapeTree(targetUrl, maxDepth = 4) {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  let startOrigin = "";
  try {
    startOrigin = new URL(targetUrl).origin;
  } catch {
    throw new Error(`Invalid start URL: ${targetUrl}`);
  }

  const visited = new Set();
  const data = await scrapePages(page, targetUrl, visited, 0, maxDepth, startOrigin);

  await browser.close();
  return data;
}

/* ===========================
   EXPRESS HANDLER (API)
   =========================== */
const scrapeRelevantContent = async (req, res) => {
  const { targetUrl, maxDepth = 4 } = req.body || {};
  if (!targetUrl) {
    return res.status(400).json({ message: "Missing targetUrl" });
  }
  console.log(`[INIT] target=${targetUrl} maxDepth=${maxDepth}`);

  try {
    const result = await scrapeTree(targetUrl, Number(maxDepth) || 4);
    // ensure it’s plain JSON (no circulars)
    return res.json(JSON.parse(JSON.stringify(result)));
  } catch (err) {
    console.error("[ERROR]", err);
    return res.status(500).json({ message: err.message || "Scrape failed" });
  }
};





export { scrapeUrl, GetScrapping, scrapeFullPageContent, scrapeRelevantContent };