import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import urlModule from 'url';
import fs from 'fs';
import axios from 'axios';



// const visited = new Set();
// let pageCount = 0;

// const MAX_CONCURRENT = 10;
// let active = 0;
// let queue = [];

// function validateLink(href, baseUrl) {
//   if (!href) return false;
//   if (
//     href.startsWith("#") ||
//     href.startsWith("mailto:") ||
//     href.startsWith("tel:") ||
//     href.toLowerCase().includes("javascript:void") ||
//     href.includes("?utm") ||
//     href.includes("?ref")
//   ) return false;
//   if (!href.startsWith(baseUrl)) return false;
//   return true;
// }

// async function fetchPage(url, baseUrl, maxPages) {
//   if (visited.has(url) || pageCount >= maxPages) return;

//   visited.add(url);
//   pageCount++;

//   try {
//     const { data } = await axios.get(url, {
//       timeout: 15000,
//       headers: {
//         "User-Agent":
//           "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
//       },
//     });

//     const $ = cheerio.load(data);
//     const links = $("a[href]")
//       .map((_, a) => $(a).attr("href"))
//       .get()
//       .map((l) => new URL(l, baseUrl).href);

//     for (const link of links) {
//       if (validateLink(link, baseUrl) && !visited.has(link)) {
//         enqueue(() => fetchPage(link, baseUrl, maxPages));
//       }
//     }
//   } catch (err) {
//     console.error(`❌ Failed to fetch ${url}: ${err.message}`);
//   }
// }

// function enqueue(task) {
//   return new Promise((resolve) => {
//     queue.push({ task, resolve });
//     processQueue();
//   });
// }

// async function processQueue() {
//   if (active >= MAX_CONCURRENT || queue.length === 0) return;

//   const { task, resolve } = queue.shift();
//   active++;
//   try {
//     const result = await task();
//     resolve(result);
//   } catch (err) {
//     resolve(null);
//   } finally {
//     active--;
//     processQueue();
//   }
// }

//  async function startCrawl(req, res) {
//   const { targetUrl, maxPages = "all" } = req.body;

//   if (!targetUrl) return res.status(400).json({ error: "targetUrl is required" });

//   const baseUrl = new URL(targetUrl).origin;
//   const limit = maxPages === "all" ? Infinity : Number(maxPages);

//   try {
//     await enqueue(() => fetchPage(targetUrl, baseUrl, limit));

//     // Wait until queue finishes
//     while (active > 0 || queue.length > 0) {
//       await new Promise((r) => setTimeout(r, 200));
//     }

//     // Save flat link list
//     const allLinks = [...visited];
//     fs.writeFileSync("flat_links.json", JSON.stringify(allLinks, null, 2));

//     res.json({ success: true, total: allLinks.length, links: allLinks });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// }



//===========================

// ------------------ Extract Content (Excludes Header/Footer/Nav) ------------------
async function extractStructuredContent(page) {
  return await page.evaluate(() => {
    const results = [];
    const skip = ['SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER', 'NOSCRIPT', 'ASIDE'];

    const visit = (node) => {
      // Ignore invalid nodes or nodes we don't want
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

      if (skip.includes(node.tagName)) return;

      const tag = node.tagName.toLowerCase();
      let content = null;

      if (/^h[1-6]$/.test(tag) || ['p', 'span', 'strong', 'b', 'li'].includes(tag)) {
        content = node.innerText ? node.innerText.trim() : null;
      } else if (tag === 'a') {
        // Extra safety: ensure node has href
        const href = node.getAttribute('href') || '';
        content = { text: (node.innerText || '').trim(), href };
      }

      if (content) {
        if (typeof content === 'string' && content.length > 20) {
          results.push({ tag, content });
        } else if (typeof content === 'object' && content.text) {
          results.push({ tag, ...content });
        }
      }

      // Visit children safely
      Array.from(node.childNodes).forEach(visit);
    };

    visit(document.body);
    return { title: document.title, sequence: results };
  });
}

// ------------------ Scrape One Page ------------------
async function scrapePage(browser, targetUrl, rootDomain) {
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36'
  );

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const { title, sequence } = await extractStructuredContent(page);

    const links = await page.evaluate((root) => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => {
          try {
            // Ensure valid element
            if (!(a instanceof Element)) return null;

            const href = a.getAttribute('href');
            if (!href) return null;

            // Exclude unwanted link types
            if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
              return null;
            }

            const absHref = a.href;

            // Only keep same-domain links
            if (!absHref.startsWith(root)) return null;

            // Exclude anchors
            if (absHref.includes('#')) return null;

            // Skip links inside nav/header/footer/aside
            if (typeof a.closest === 'function' && a.closest('header, footer, nav, aside')) {
              return null;
            }

            // Require meaningful text
            if (!a.innerText || a.innerText.trim().length < 2) return null;

            return absHref;
          } catch (err) {
            return null; // Safe fallback
          }
        })
        .filter(Boolean); // remove nulls
    }, rootDomain);

    await page.close();

    return {
      url: targetUrl,
      title,
      sequence,
      found: [...new Set(links)] // deduplicated
    };
  } catch (err) {
    console.error('scrapePage failed:', err.message);
    await page.close();
    return null;
  }
}
// ------------------ Crawl & Scrape Whole Site ------------------
const crawlAndScrape = async (startUrl, maxPages = 50) => {
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

// ------------------ Controller ------------------
const startCrawl = async (req, res) => {
  const { domain } = req.body;
  if (!domain || !domain.startsWith('http')) {
    return res.status(400).json({ error: 'Valid domain required' });
  }

  try {
    const data = await crawlAndScrape(domain, 30); // max 30 pages
    return res.status(200).json(data);
  } catch (e) {
    console.error('GetScrapping failed:', e.message);
    return res.status(500).json({ error: 'Scraping failed', details: e.message });
  }
};

export {startCrawl} ;