import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import urlModule from 'url';
import fs from 'fs';
import axios from 'axios';




const scrapePageContentWithCardsListing = async (req, res) => {
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


export { scrapePageContentWithCardsListing }