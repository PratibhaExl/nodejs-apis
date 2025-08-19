import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

import urlModule from 'url';
import fs from 'fs';
import axios from 'axios';



//plain content
// const scrapePageContentWithCardsListingWithSection = async (req, res) => {
//   const { targetUrl } = req.body;

//   try {
//     const browser = await puppeteer.launch({ headless: 'new' });
//     const page = await browser.newPage();
//     await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

//     // Extract top-level content (breadcrumbs, sections, cards list)
//     const data = await page.evaluate(() => {
//       //--------------------------------------------------------------------------------------------------
//       const clean = txt => (txt || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
//       const isVis = el => {
//         if (!el) return false;
//         const s = window.getComputedStyle(el);
//         return s.display !== 'none' && s.visibility !== 'hidden'
//           && el.offsetHeight > 0 && el.offsetWidth > 0;
//       };
//       //--------------------------------------------------------------------------------------------------

//       // ---------------- BREADCRUMBS ----------------
//       const breadcrumbSections = [];
//       document.querySelectorAll('nav[aria-label="Secondary Navigation"]').forEach((nav, navIndex) => {
//         const seen = new Set();
//         const breadcrumbs = [];
//         nav.querySelectorAll('a[href]').forEach(link => {
//           const text = clean(link.textContent);
//           const href = link.href || '';
//           const key = text.toLowerCase() + '|' + href.toLowerCase();
//           if (text && href && !seen.has(key)) {
//             seen.add(key);
//             breadcrumbs.push({ text, href });
//           }
//         });
//         if (breadcrumbs.length) {
//           breadcrumbSections.push({ trail: navIndex + 1, breadcrumbs });
//         }
//       });

//       // ---------------- NORMAL TEXT ----------------
//       const sections = [];
//       const shouldSkip = txt => {
//         const lc = txt.toLowerCase();
//         return !txt || txt.length < 20 ||
//           lc.includes('cookie') || lc.includes('embed') ||
//           txt.trim().toLowerCase() === 'get to know us better';
//       };
//       const existsInSections = (sections, text) => {
//         const cleanText = text.toLowerCase();
//         return sections.some(sec =>
//           sec.heading.toLowerCase() === cleanText ||
//           (sec.content && sec.content.some(c =>
//             typeof c === 'string'
//               ? c.toLowerCase() === cleanText
//               : (c.text && c.text.toLowerCase() === cleanText)
//           ))
//         );
//       };
//       document.querySelectorAll('h1,h2,p').forEach(h => {
//         if (!isVis(h)) return;
//         const text = clean(h.textContent);
//         if (shouldSkip(text)) return;
//         const next = Array.from(h.nextElementSibling ? [h.nextElementSibling] : []);
//         let paragraph = next.find(el => ['P', 'DIV', 'SPAN'].includes(el.tagName) && isVis(el));
//         const content = paragraph ? [clean(paragraph.textContent)] : [];
//         if (text && !existsInSections(sections, text) && (content.length > 0 || text.length > 0)) {
//           sections.push({ heading: text, content });
//         }
//       });

//       // ---------------- CARDS ----------------
//       const tabShouldExclude = text => {
//         if (!text) return true;
//         const lower = text.toLowerCase();
//         return (text.length < 2 || lower.includes('cookie') || lower.includes('privacy') || lower.includes('login') || lower.includes('©'));
//       };
//       const sectionMap = new Map();
//       const addTabCard = (heading, tabname, tabcards) => {
//         if (!heading || !tabname || !tabcards.length) return;
//         if (!sectionMap.has(heading)) sectionMap.set(heading, { heading, tabs: [] });
//         const section = sectionMap.get(heading);
//         let tabObj = section.tabs.find(t => t.tabname === tabname);
//         if (!tabObj) {
//           tabObj = { tabname, tabcards: [] };
//           section.tabs.push(tabObj);
//         }
//         tabcards.forEach(c => {
//           if (!tabObj.tabcards.some(tc => tc.text === c.text && tc.href === c.href)) {
//             tabObj.tabcards.push(c);
//           }
//         });
//       };
//       document.querySelectorAll('.horizontaltab-main-section').forEach(sectionEl => {
//         const mainHeading = clean(sectionEl.querySelector('.horizontaltab-section-title')?.textContent);
//         if (!mainHeading || tabShouldExclude(mainHeading)) return;
//         const tabs = Array.from(sectionEl.querySelectorAll('.horizontaltab-nav-link'));
//         tabs.forEach(tab => {
//           const tabname = clean(tab.textContent);
//           const panelId = tab.getAttribute('href');
//           if (!panelId) return;
//           const panel = sectionEl.querySelector(panelId);
//           if (!panel) return;
//           const tabcards = Array.from(panel.querySelectorAll('a[href]'))
//             .map(card => {
//               const text = clean(
//                 card.querySelector('h1, h2, h3, h4, h5, h6, p, span')?.textContent ||
//                 card.textContent
//               );
//               const href = card.getAttribute('href') || '';
//               return text && href && !tabShouldExclude(text) ? { text, href } : null;
//             })
//             .filter(Boolean);
//           addTabCard(mainHeading, tabname, tabcards);
//         });
//       });
//       const cardSections = Array.from(sectionMap.values());

//       return {
//         url: window.location.href,
//         title: clean(document.title),
//         metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
//         breadcrumbs: breadcrumbSections,
//         page: [...sections, { cards: cardSections }]
//       };
//     });

//     // ---------------- SCRAPE EACH CARD PAGE ----------------
//     for (const section of data.page.find(sec => sec.cards)?.cards || []) {
//       for (const tab of section.tabs) {
//         for (const card of tab.tabcards) {
//           try {
//             const subPage = await browser.newPage();
//             await subPage.goto(card.href, { waitUntil: 'networkidle2', timeout: 60000 });
//             const pagecontent = await subPage.evaluate(() => {
//               //--------------------------------------------------------------------------------------------------
//               const clean = txt => (txt || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
//               const isVis = el => {
//                 if (!el) return false;
//                 const s = window.getComputedStyle(el);
//                 return s.display !== 'none' && s.visibility !== 'hidden'
//                   && el.offsetHeight > 0 && el.offsetWidth > 0;
//               };
//               //--------------------------------------------------------------------------------------------------

//               const content = [];
//               document.querySelectorAll('h1, h2, p').forEach(el => {
//                 if (!isVis(el)) return;
//                 const txt = clean(el.textContent);
//                 if (txt && txt.length > 15) {
//                   content.push(txt);
//                 }
//               });
//               return {
//                 title: clean(document.title),
//                 metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
//                 content
//               };
//             });
//             await subPage.close();
//             card.pagecontent = pagecontent; // attach here
//           } catch (err) {
//             console.error('Failed to scrape card page:', card.href, err.message);
//             card.pagecontent = { error: 'Failed to load' };
//           }
//         }
//       }
//     }

//     await browser.close();
//     res.json(data);

//   } catch (err) {
//     console.error('Scraping failed:', err);
//     res.status(500).json({ message: 'Error scraping content' });
//   }
// };




const scrapePageContentWithCardsListingWithSection = async (req, res) => {
  const { targetUrl } = req.body;

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  const data = await page.evaluate(() => {
    const clean = txt => (txt || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const isVis = el => {
      if (!el) return false;
      const s = window.getComputedStyle(el);
      return s.display !== 'none' &&
             s.visibility !== 'hidden' &&
             el.offsetHeight > 0 &&
             el.offsetWidth > 0;
    };

    const data = { breadcrumbs: [], cards: [] };

    try {
      const breadcrumbEls = document.querySelectorAll(
        'nav.breadcrumbs a, nav[aria-label*="breadcrumb"] a'
      );
      data.breadcrumbs = Array.from(breadcrumbEls)
        .filter(isVis)
        .map(el => ({
          text: clean(el.innerText),
          href: el.href || null
        }));
    } catch (e) {
      console.warn("Breadcrumb scrape error", e);
    }

    try {
      const cardSections = document.querySelectorAll('.card-section, section.cards, .tcs-card');
      data.cards = Array.from(cardSections).map(section => {
        const heading = clean(section.querySelector('h2,h3,h4')?.innerText);

        const tabs = Array.from(section.querySelectorAll('.tabs, .tab-container')).map(tab => {
          const tabname = clean(tab.querySelector('.tab-title, .title, h3')?.innerText);

          const tabcards = Array.from(tab.querySelectorAll('.card, .tcs-card, li')).map(card => {
            const text = clean(card.querySelector('h3,h4,a,span')?.innerText);
            const href = card.querySelector('a')?.href || null;
            return { text, href };
          });

          return { tabname, tabcards };
        });

        return { heading, tabs };
      });
    } catch (e) {
      console.warn("Cards scrape error", e);
    }

    return data;
  });

  await browser.close();
  return data;
};


export { scrapePageContentWithCardsListingWithSection };
