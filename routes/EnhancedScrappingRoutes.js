import express from 'express';
import {
  scrapeContentEnhanced,
  scrapeContentLightweight,
  scrapeMultipleUrls
} from '../controllers/EnhancedScrappingController.js';

const router = express.Router();

/**
 * Enhanced scraping routes with improved content filtering
 * All routes exclude headers, footers, navigation, and remove duplicates
 */

// Enhanced scraping with full content extraction
router.post('/scrape-enhanced', scrapeContentEnhanced);

// Lightweight scraping for faster performance
router.post('/scrape-lightweight', scrapeContentLightweight);

// Batch scraping multiple URLs
router.post('/scrape-batch', scrapeMultipleUrls);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Enhanced Scraping API is running',
    endpoints: [
      'POST /scrape-enhanced - Full content extraction with filtering',
      'POST /scrape-lightweight - Fast content extraction',
      'POST /scrape-batch - Scrape multiple URLs at once',
      'GET /health - Health check'
    ]
  });
});

export default router;
