import express from 'express';
import {
  scrapeUrl,
  GetScrapping,
  scrapeFullPageContent,
  scrapeRelevantContent,
  
} from '../controllers/ScrappingController.js';
import {startCrawl} from '../controllers/cr_link_content.js';
import { GetLinks } from '../controllers/cr_link_only.js';
import { GetLinksFlatWithTopics } from '../controllers/cr_link_flat.js';
import { scrapePageContentWithCardsListing } from '../controllers/scrape-relevant-cards-breadcrumbs-list.js';
import { scrapePageContentWithCardsListingWithSection } from '../controllers/scrape-relevant-cards-breadcrumbs-list-content.js';
import { mainScrapePageContentWithCardsListing } from '../controllers/main-scrape_page_content_cards_breadcrumbs_listing.js';

const router = express.Router();

router.post('/scrape-urls', scrapeUrl);
router.post('/scrape-domain', GetScrapping);

router.post('/scrape-relevant', scrapeRelevantContent); // version v1 shared json 
router.post('/scrape-full', scrapeFullPageContent);

router.post('/getlinkscon',startCrawl) // content + links 
router.post('/getlinks',GetLinks) // links with children only
router.post('/getlinks_flat',GetLinksFlatWithTopics) // links with children only

router.post('/scrape-relevant-cards-breadcrumbs-list',scrapePageContentWithCardsListing) 
router.post('/scrape-relevant-cards-breadcrumbs-list-content',scrapePageContentWithCardsListingWithSection) 


router.post('/main-scrape-cards-breadcrumbs-list-content',mainScrapePageContentWithCardsListing); // page content with cards array , breadcrumbs array


//export link 
// router.post('/download', scrapeRelevantContentWithDownload);

export default router;