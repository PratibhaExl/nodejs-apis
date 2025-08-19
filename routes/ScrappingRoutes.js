import express from 'express';
import {
  scrapeUrl,
  GetScrapping,
  scrapeFullPageContent,
  scrapeRelevantContent,
  
} from '../controllers/ScrappingController.js';
import {startCrawl} from '../controllers/ScrappingCrawlingController.js';

const router = express.Router();

router.post('/scrape-urls', scrapeUrl);
router.post('/scrape-domain', GetScrapping);

router.post('/scrape-relevant', scrapeRelevantContent); // version v1 shared json 
router.post('/scrape-full', scrapeFullPageContent);

router.post('/getlinks',startCrawl) // version v2 

//export link 
// router.post('/download', scrapeRelevantContentWithDownload);

export default router;