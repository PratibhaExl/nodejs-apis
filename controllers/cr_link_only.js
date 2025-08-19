import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import urlModule from 'url';
import fs from 'fs';
import axios from 'axios';


async function scrapeLinks(page, targetUrl, rootDomain) {
  try {
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // Collect links, excluding header/footer/nav/menu, mailto, tel, javascript
    const links = await page.evaluate((root) => {
      const skipSelectors = ["header a", "footer a", "nav a", "aside a"];
      const skipped = new Set(
        skipSelectors
          .flatMap(sel => Array.from(document.querySelectorAll(sel)))
          .map(el => el.href)
      );

      return Array.from(document.querySelectorAll("a[href]"))
        .map(a => a.href.trim())
        .filter(href =>
          href.startsWith(root) &&
          !href.includes("#") &&
          !href.startsWith("mailto:") &&
          !href.startsWith("tel:") &&
          !href.toLowerCase().startsWith("javascript:") &&
          !skipped.has(href)
        );
    }, rootDomain);

    return Array.from(new Set(links)); // unique
  } catch (err) {
    console.error("scrapeLinks failed:", targetUrl, err.message);
    return [];
  }
}

async function crawlTree(startUrl, maxPages = 50) {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const visited = new Set();
  const rootDomain = new URL(startUrl).origin;

  async function crawlNode(url, depth = 0) {
    if (visited.has(url) || visited.size >= maxPages) return null;
    visited.add(url);

    const page = await browser.newPage();
    const children = await scrapeLinks(page, url, rootDomain);
    await page.close();

    const childNodes = [];
    for (const link of children) {
      if (!visited.has(link)) {
        const childNode = await crawlNode(link, depth + 1);
        if (childNode) childNodes.push(childNode);
      }
    }

    return { url, children: childNodes };
  }

  const tree = await crawlNode(startUrl);
  await browser.close();
  return tree;
}

// Express handler
const GetLinks = async (req, res) => {
  const { domain } = req.body;
  if (!domain || !domain.startsWith("http")) {
    return res.status(400).json({ error: "Valid domain required" });
  }

  try {
    const tree = await crawlTree(domain, 100); // crawl up to 100 pages
    return res.status(200).json(tree);
  } catch (e) {
    console.error("GetScrapping failed:", e.message);
    return res.status(500).json({ error: "Scraping failed", details: e.message });
  }
};
export {GetLinks} ;