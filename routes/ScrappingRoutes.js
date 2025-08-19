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

const router = express.Router();

router.post('/scrape-urls', scrapeUrl);
router.post('/scrape-domain', GetScrapping);

router.post('/scrape-relevant', scrapeRelevantContent); // version v1 shared json 
router.post('/scrape-full', scrapeFullPageContent);

router.post('/getlinkscon',startCrawl) // content + links 
router.post('/getlinks',GetLinks) // links with children only
router.post('/getlinks_flat',GetLinksFlatWithTopics) // links with children only



//export link 
// router.post('/download', scrapeRelevantContentWithDownload);

export default router;