import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import urlModule from 'url';
import fs from 'fs';
import axios from 'axios';


//====first href complete node till the end
// async function scrapeLinksAndTopic(page, targetUrl, rootDomain) {
//   try {
//     await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

//     // Extract topic (prefer H1, fallback to title)
//     const topic = await page.evaluate(() => {
//       const h1 = document.querySelector("h1");
//       if (h1 && h1.innerText.trim()) return h1.innerText.trim();
//       return document.title || "";
//     });

//     // Collect links excluding unwanted
//     const links = await page.evaluate((root) => {
//       const skipSelectors = ["header a", "footer a", "nav a", "aside a"];
//       const skipped = new Set(
//         skipSelectors
//           .flatMap(sel => Array.from(document.querySelectorAll(sel)))
//           .map(el => el.href)
//       );

//       return Array.from(document.querySelectorAll("a[href]"))
//         .map(a => a.href.trim())
//         .filter(href =>
//           href.startsWith(root) &&
//           !href.includes("#") &&
//           !href.startsWith("mailto:") &&
//           !href.startsWith("tel:") &&
//           !href.toLowerCase().startsWith("javascript:") &&
//           !skipped.has(href)
//         );
//     }, rootDomain);

//     return { topic, links: Array.from(new Set(links)) };
//   } catch (err) {
//     console.error("scrapeLinksAndTopic failed:", targetUrl, err.message);
//     return { topic: "", links: [] };
//   }
// }

// async function crawlFlat(startUrl, maxPages = 50) {
//   const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
//   const visited = new Set();
//   const results = [];
//   const rootDomain = new URL(startUrl).origin;

//   async function crawlNode(url, level = 0) {
//     if (visited.has(url) || visited.size >= maxPages) return;
//     visited.add(url);

//     const page = await browser.newPage();
//     const { topic, links } = await scrapeLinksAndTopic(page, url, rootDomain);
//     await page.close();

//     // push current page with topic
//     results.push({ url, level, topic });

//     // recurse children
//     for (const link of links) {
//       if (!visited.has(link)) {
//         await crawlNode(link, level + 1);
//       }
//     }
//   }

//   await crawlNode(startUrl, 0);
//   await browser.close();
//   return results;
// }

// // Express controller
// const GetLinksFlatWithTopics = async (req, res) => {
//   const { domain } = req.body;
//   if (!domain || !domain.startsWith("http")) {
//     return res.status(400).json({ error: "Valid domain required" });
//   }

//   try {
//     const flatTree = await crawlFlat(domain, 100); // limit 100 pages
//     return res.status(200).json(flatTree);
//   } catch (e) {
//     console.error("GetLinksFlatWithTopics failed:", e.message);
//     return res.status(500).json({ error: "Scraping failed", details: e.message });
//   }
// };
//=================

// Utility to clean topic text
function cleanTopic(text) {
  if (!text) return 'Untitled';
  return text
    .replace(/\s+/g, ' ')           // collapse spaces
    .replace(/[^a-zA-Z0-9 ]/g, '')  // remove special characters
    .trim();
}

async function extractLinks(page, rootDomain) {
  return await page.evaluate((root) => {
    const excludeSelectors = ['header', 'footer', 'nav', 'aside'];
    const isInsideExcluded = (el) =>
      excludeSelectors.some((sel) => el.closest && el.closest(sel));

    // Get breadcrumbs text if available
    let breadcrumbText = '';
    const breadcrumbEl =
      document.querySelector('.breadcrumb') ||
      document.querySelector('[aria-label*="breadcrumb"]');
    if (breadcrumbEl) {
      breadcrumbText = breadcrumbEl.innerText.replace(/\s+/g, ' ').trim();
    }

    return Array.from(document.querySelectorAll('a[href]'))
      .map((a) => {
        const href = a.href.trim();
        const rawTopic = (a.innerText || a.getAttribute('title') || '').trim();
        return {
          href,
          topic: rawTopic,
          breadcrumb: breadcrumbText,
          selectorOk: a.closest ? !isInsideExcluded(a) : true,
        };
      })
      .filter(
        ({ href, selectorOk }) =>
          selectorOk &&
          href.startsWith(root) &&
          !href.includes('#') &&
          !href.startsWith('mailto:') &&
          !href.startsWith('tel:')
      );
  }, rootDomain);
}

async function scrapePage(browser, url, rootDomain, level, visited) {
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36'
  );

  try {
    console.log(`[VISIT] ${url} at level ${level}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const links = await extractLinks(page, rootDomain);
    console.log(`[FOUND] ${links.length} links on ${url}`);

    await page.close();

    return links.map((l) => ({
      url: l.href,
      topic: cleanTopic(l.topic) || 'Untitled',
      breadcrumb: cleanTopic(l.breadcrumb),
      level,
    }));
  } catch (err) {
    console.error(`[ERROR] Failed ${url}: ${err.message}`);
    await page.close();
    return [];
  }
}
async function withRetry(fn, retries = 3, delay = 3000) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`[RETRY] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }
  throw lastError;
}
async function crawlSite(startUrl, maxPages = 1000) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const rootDomain = new URL(startUrl).origin;
  const visited = new Set();
  const toVisit = [{ url: startUrl, level: 0, topic: 'Root', breadcrumb: '' }];
  const results = [];

 while (toVisit.length > 0 && results.length < maxPages) {
  const { url, level, topic, breadcrumb } = toVisit.shift();
  if (visited.has(url)) {
    console.log(`[SKIP] Already visited ${url}`);
    continue;
  }
  visited.add(url);

  try {
    console.log(`[VISIT] ${url} at level ${level}`);

    await withRetry(async () => {
      await page.goto(url, {
        waitUntil: ['load', 'domcontentloaded', 'networkidle2'],
        timeout: 60000,   // smaller than retry cycle
      });
    }, 3, 5000);

    const links = await withRetry(async () => {
      return await extractLinks(page, rootDomain);
    }, 2, 2000);

    console.log(`[FOUND] ${links.length} links on ${url}`);
    results.push({ url, topic, breadcrumb, level });

    links.forEach((link) => {
      if (!visited.has(link.href)) {
        toVisit.push({
          url: link.href,
          topic: cleanTopic(link.topic),
          breadcrumb: cleanTopic(link.breadcrumb),
          level: level + 1,
        });
      }
    });
  } catch (err) {
    console.error(`[ERROR] ${url}: ${err.message}`);
    continue;
  }
}

  await browser.close();
  return results;
}

// Example API controller
const GetLinksFlatWithTopics = async (req, res) => {
  const { domain } = req.body;
  if (!domain || !domain.startsWith('http')) {
    return res.status(400).json({ error: 'Valid domain required' });
  }

  try {
    console.log(`[START] Crawling ${domain}`);
    const data = await crawlSite(domain, 300); // limit max pages
    console.log(`[DONE] Crawled ${data.length} pages`);
    return res.status(200).json(data);
  } catch (e) {
    console.error(`[FAILED] ${e.message}`);
    return res.status(500).json({ error: 'Scraping failed', details: e.message });
  }
};


export {GetLinksFlatWithTopics} ;