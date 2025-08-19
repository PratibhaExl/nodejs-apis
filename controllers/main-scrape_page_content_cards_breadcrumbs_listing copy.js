import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import urlModule from 'url';
import fs from 'fs';
import axios from 'axios';




const mainScrapePageContentWithCardsListing = async (req, res) => {
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

      let sections = [];


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
      const shouldSkipElement = (el) => {
        if (!el) return false;
        const cls = el.getAttribute('class') || '';
        return (
          cls.includes('related-section-title') ||
          cls.includes('tcs-custom-container')
        );
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
      const seenSections = new Set();
      const seenHeadings = new Set();
      const seenContent = new Set();

      let current = { heading: "", content: [] };

      document.querySelectorAll("h1,h2,p,span.cs-section-title,li").forEach(h => {
        if (!isVis(h)) return;

        // 🚫 Skip "Related reading" cards
        if (h.closest(".tcs-custom-container")) return;

        const text = clean(h.textContent);
        if (!text) return;

        if (h.matches("h1,h2,span.cs-section-title")) {
          // finalize previous section
          if (current.heading || current.content.length) {
            let contentArr = [...current.content];

            // 🚫 If heading text exists in its own content, clear
            if (contentArr.some(c => c === current.heading)) {
              contentArr = [];
            }

            const key = current.heading + "::" + contentArr.join("|");

            if (!seenSections.has(key)) {
              if (!(seenHeadings.has(current.heading) && contentArr.length === 0)) {
                sections.push({ heading: current.heading, content: contentArr });
                seenSections.add(key);
                seenHeadings.add(current.heading);
              }
            }
          }

          // start fresh section
          current = { heading: text, content: [] };

        } else {
          // only add unique content
          if (!seenContent.has(text)) {
            current.content.push(text);
            seenContent.add(text);
          }
        }
      });

      // finalize last section
      if (current.heading || current.content.length) {
        let contentArr = [...current.content];
        if (contentArr.some(c => c === current.heading)) {
          contentArr = [];
        }

        const key = current.heading + "::" + contentArr.join("|");

        if (!seenSections.has(key)) {
          if (!(seenHeadings.has(current.heading) && contentArr.length === 0)) {
            sections.push({ heading: current.heading, content: contentArr });
            seenSections.add(key);
            seenHeadings.add(current.heading);
          }
        }
      }
      // 🔑 Final cleanup
      sections = sections.filter((sec, i, arr) => {
        const lowerHeading = sec.heading.toLowerCase();

        // 🚫 Remove cookies or cookie-related sections
        if (lowerHeading.includes("cookies")) return false;

        // 🚫 Remove if content matches heading
        if (arr.some(s => s.content.includes(sec.heading))) return false;

        // 🚫 Remove if duplicate heading and content is empty, while next one has content
        if (
          i < arr.length - 1 &&
          sec.heading === arr[i + 1].heading &&
          sec.content.length === 0
        ) {
          return false;
        }

        return true;
      });

      //-------------------------- END NORMAL TEXT------------------------------------------------------------------------






      //--------------------CARDS-------------------------------------------------------------------------------
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
        if (!heading || !tabcards.length) return;

        if (!sectionMap.has(heading)) {
          sectionMap.set(heading, { heading, tabs: [] });
        }
        const section = sectionMap.get(heading);

        // If no tabname, fallback to "default"
        const tabLabel = tabname || "default";
        let tabObj = section.tabs.find(t => t.tabname === tabLabel);
        if (!tabObj) {
          tabObj = { tabname: tabLabel, tabcards: [] };
          section.tabs.push(tabObj);
        }

        // Push unique tab cards
        tabcards.forEach(c => {
          if (!tabObj.tabcards.some(tc => tc.text === c.text && tc.href === c.href)) {
            tabObj.tabcards.push(c);
          }
        });
      };

      // -------- Case 1: Horizontal tabbed sections --------
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
              const text = clean(card.querySelector('h3,h4,p,span')?.textContent);
              const href = card.getAttribute('href') || '';
              return text && !tabShouldExclude(text) ? { text, href } : null;
            })
            .filter(Boolean);

          addTabCard(mainHeading, tabname, tabcards);
        });
      });

      // -------- Case 2: Offerings / Generic Card sections --------
      document.querySelectorAll('.solution-card-main-section').forEach(sectionEl => {
        // when adding to sectionMap
        const heading = clean(sectionEl.querySelector('h2,h3,h4')?.textContent);
        if (!heading || tabShouldExclude(heading)) return;

        // skip unwanted card groups
        if (heading.toLowerCase().includes("get to know us better")) return;



        const tabcards = Array.from(sectionEl.querySelectorAll('a'))
          .map(card => {
            const text = clean(card.querySelector('h3,h4,p,span,strong')?.textContent);
            const href = card.getAttribute('href') || '';
            return text && !tabShouldExclude(text) ? { text, href } : null;
          })
          .filter(Boolean);

        if (tabcards.length > 0) {
          addTabCard(heading, "default", tabcards);
        }
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


export { mainScrapePageContentWithCardsListing }