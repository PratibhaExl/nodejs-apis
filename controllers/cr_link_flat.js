import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import urlModule from 'url';
import fs from 'fs';
import axios from 'axios';



async function scrapeLinksAndTopic(page, targetUrl, rootDomain) {
  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Extract topic (prefer H1, fallback to title)
    const topic = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      if (h1 && h1.innerText.trim()) return h1.innerText.trim();
      return document.title || "";
    });

    // Collect links excluding unwanted
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

    return { topic, links: Array.from(new Set(links)) };
  } catch (err) {
    console.error("scrapeLinksAndTopic failed:", targetUrl, err.message);
    return { topic: "", links: [] };
  }
}

async function crawlFlat(startUrl, maxPages = 50) {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const visited = new Set();
  const results = [];
  const rootDomain = new URL(startUrl).origin;

  async function crawlNode(url, level = 0) {
    if (visited.has(url) || visited.size >= maxPages) return;
    visited.add(url);

    const page = await browser.newPage();
    const { topic, links } = await scrapeLinksAndTopic(page, url, rootDomain);
    await page.close();

    // push current page with topic
    results.push({ url, level, topic });

    // recurse children
    for (const link of links) {
      if (!visited.has(link)) {
        await crawlNode(link, level + 1);
      }
    }
  }

  await crawlNode(startUrl, 0);
  await browser.close();
  return results;
}

// Express controller
const GetLinksFlatWithTopics = async (req, res) => {
  const { domain } = req.body;
  if (!domain || !domain.startsWith("http")) {
    return res.status(400).json({ error: "Valid domain required" });
  }

  try {
    const flatTree = await crawlFlat(domain, 100); // limit 100 pages
    return res.status(200).json(flatTree);
  } catch (e) {
    console.error("GetLinksFlatWithTopics failed:", e.message);
    return res.status(500).json({ error: "Scraping failed", details: e.message });
  }
};

export {GetLinksFlatWithTopics} ;