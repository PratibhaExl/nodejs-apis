import express from 'express';
import {
  scrapeUrl,
  GetScrapping,
  scrapeFullPageContent,
  scrapeRelevantContent,
  
} from '../controllers/ScrappingController.js';

const router = express.Router();

router.post('/scrape-urls', scrapeUrl);
router.post('/scrape-domain', GetScrapping);
// router.post('/scrape-relevant', scrapeRelevantContent);
router.post('/scrape-relevant', scrapeRelevantContent);


router.post('/scrape-full', scrapeFullPageContent);

//export link 
// router.post('/download', scrapeRelevantContentWithDownload);

export default router;