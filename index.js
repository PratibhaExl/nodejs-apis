
import express, { response } from 'express';
import AuthRoutes from './routes/AuthRoutes.js';
import ProdRoutes from './routes/ProductRoutes.js';
import ProfileRoutes from './routes/ProfileRoutes.js';
import ChangePassRoutes from './routes/PasswordRoutes.js';

import dbconnection from './db_connection.js';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';



// Create __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 6677;
const app = express();
dbconnection();
app.use(express.json());//parse all body request 
app.use(express.static('assets'));
app.use(cors());

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//http://localhost:6677/api/v1/auth/signin
app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/products", ProdRoutes);
app.use("/api/v1/profile", ProfileRoutes);
app.use("/api/v1/profile", ChangePassRoutes);





import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio'
//const puppeteer = require('puppeteer');
//const cheerio = require('cheerio');

//synchromous response
app.get('/getData_v1', async (req, res) => {
    //const targetUrl = 'https://www.tcs.com/who-we-are/newsroom/press-release/tcs-financial-results-q1-fy-2026';//req.query.url;
    // const targetUrl = req.query.url;
    const requestURL = req.body.url;
    const targetUrl = requestURL;

    if (!targetUrl) return res.status(400).send({ error: 'URL is required' });

    //   try {
    //     const browser = await puppeteer.launch({ headless: true });
    //     const page = await browser.newPage();
    //     await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 0 });

    //     const content = await page.content();
    //     const $ = cheerio.load(content);

    //     const title = $('head > title').text();
    //     const header = $('h1').first().text();
    //     const description = $('meta[name="description"]').attr('content') || '';

    //     const categories = [];
    //     $('a, div, span').each((i, el) => {
    //       const text = $(el).text().toLowerCase();
    //       if (text.includes('category')) categories.push(text.trim());
    //     });

    //     await browser.close();

    //     res.json({ title, header, description, categories });
    //   }
    // 

    // try {
    //     const browser = await puppeteer.launch({ headless: true });
    //     const page = await browser.newPage();
    //     await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 0 });

    //     const content = await page.content();
    //     const $ = cheerio.load(content);

    //     const title = $('head > title').text();
    //     const metaDescription = $('meta[name="description"]').attr('content') || '';

    //     const headings = {};
    //     ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
    //       headings[tag] = [];
    //       $(tag).each((_, el) => {
    //         headings[tag].push($(el).text().trim());
    //       });
    //     });

    //     const boldTexts = [];
    //     $('b, strong').each((_, el) => {
    //       boldTexts.push($(el).text().trim());
    //     });

    //     const paragraphs = [];
    //     $('p').each((_, el) => {
    //       const text = $(el).text().trim();
    //       if (text) paragraphs.push(text);
    //     });

    //     const links = [];
    //     $('a').each((_, el) => {
    //       const linkText = $(el).text().trim();
    //       const href = $(el).attr('href');
    //       if (href && linkText) {
    //         links.push({ text: linkText, href });
    //       }
    //     });

    //     await browser.close();

    //     res.json({
    //       title,
    //       metaDescription,
    //       headings,
    //       boldTexts,
    //       paragraphs,
    //       links,
    //     });
    //   }

    //keep
    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 0 });

        const html = await page.content(); // Full HTML
        const $ = cheerio.load(html);

        const title = $('head > title').text();
        const metaTags = {};
        $('meta').each((_, el) => {
            const name = $(el).attr('name') || $(el).attr('property');
            const content = $(el).attr('content');
            if (name && content) {
                metaTags[name] = content;
            }
        });

        const headings = {};
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
            headings[tag] = [];
            $(tag).each((_, el) => {
                headings[tag].push($(el).text().trim());
            });
        });

        const boldTexts = [];
        $('b, strong').each((_, el) => {
            boldTexts.push($(el).text().trim());
        });

        const paragraphs = [];
        $('p').each((_, el) => {
            const text = $(el).text().trim();
            if (text) paragraphs.push(text);
        });

        const links = [];
        $('a').each((_, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href');
            if (href) links.push({ text, href });
        });

        const lists = [];
        $('ul, ol').each((_, el) => {
            const items = [];
            $(el).find('li').each((_, li) => {
                items.push($(li).text().trim());
            });
            lists.push(items);
        });

        const tables = [];
        $('table').each((_, table) => {
            const rows = [];
            $(table).find('tr').each((_, row) => {
                const cols = [];
                $(row).find('th, td').each((_, cell) => {
                    cols.push($(cell).text().trim());
                });
                rows.push(cols);
            });
            tables.push(rows);
        });

        const images = [];
        $('img').each((_, img) => {
            const src = $(img).attr('src');
            const alt = $(img).attr('alt') || '';
            if (src) images.push({ src, alt });
        });

        await browser.close();

        res.json({
            title,
            metaTags,
            headings,
            boldTexts,
            paragraphs,
            links,
            lists,
            tables,
            images,
            fullHtml: html
        });
    }

    catch (error) {
        res.status(500).send({ error: error.message });
    }
});

//asynchronous response
app.get('/getData_v2', async (req, res) => {
    //const targetUrl = 'https://www.tcs.com/who-we-are/newsroom/press-release/tcs-financial-results-q1-fy-2026';//req.query.url;
    // const targetUrl = req.query.url;
    const requestURL = req.body.url;
    const targetUrl = requestURL;

    if (!targetUrl) return res.status(400).send({ error: 'URL is required' });

    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 0 });

        const html = await page.content();
        const $ = cheerio.load(html);

        const title = $('head > title').text();
        const metaTags = {};
        $('meta').each((_, el) => {
            const name = $(el).attr('name') || $(el).attr('property');
            const content = $(el).attr('content');
            if (name && content) {
                metaTags[name] = content;
            }
        });

        // 🌐 Main content list (in visual order)
        const contentSequence = [];

        $('body').children().each(function (_, el) {
            const tag = $(el).prop('tagName')?.toLowerCase();

            if (!tag) return;

            switch (tag) {
                case 'h1':
                case 'h2':
                case 'h3':
                case 'h4':
                case 'h5':
                case 'h6':
                    contentSequence.push({ type: 'heading', tag, text: $(el).text().trim() });
                    break;

                case 'p':
                    contentSequence.push({ type: 'paragraph', text: $(el).text().trim() });
                    break;

                case 'strong':
                case 'b':
                    contentSequence.push({ type: 'bold', text: $(el).text().trim() });
                    break;

                case 'ul':
                case 'ol':
                    const items = [];
                    $(el).find('li').each((_, li) => items.push($(li).text().trim()));
                    contentSequence.push({ type: 'list', tag, items });
                    break;

                case 'a':
                    contentSequence.push({
                        type: 'link',
                        text: $(el).text().trim(),
                        href: $(el).attr('href') || ''
                    });
                    break;

                case 'img':
                    contentSequence.push({
                        type: 'image',
                        src: $(el).attr('src') || '',
                        alt: $(el).attr('alt') || ''
                    });
                    break;

                case 'table':
                    const table = {
                        type: 'table',
                        thead: [],
                        tbody: []
                    };

                    const $thead = $(el).find('thead');
                    if ($thead.length) {
                        $thead.find('tr').each((_, tr) => {
                            const row = [];
                            $(tr).find('th').each((_, th) => row.push($(th).text().trim()));
                            if (row.length) table.thead.push(row);
                        });
                    }

                    const $tbody = $(el).find('tbody');
                    if ($tbody.length) {
                        $tbody.find('tr').each((_, tr) => {
                            const row = [];
                            $(tr).find('td').each((_, td) => row.push($(td).text().trim()));
                            if (row.length) table.tbody.push(row);
                        });
                    } else {
                        // if no <tbody>, parse all <tr> inside <table>
                        $(el).find('tr').each((_, tr) => {
                            const row = [];
                            $(tr).find('td, th').each((_, cell) => row.push($(cell).text().trim()));
                            if (row.length) table.tbody.push(row);
                        });
                    }

                    contentSequence.push(table);
                    break;

                default:
                    // Optional: capture any unknown tag as raw block
                    const blockText = $(el).text().trim();
                    if (blockText)
                        contentSequence.push({ type: 'block', tag, text: blockText });
            }
        });

        await browser.close();

        res.json({
            title,
            metaTags,
            contentSequence,
            fullHtml: html
        });
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
});


// stable
app.get('/getData_v3', async (req, res) => {
    //const targetUrl = 'https://www.tcs.com/who-we-are/newsroom/press-release/tcs-financial-results-q1-fy-2026';//req.query.url;
    // const targetUrl = req.query.url;
    const requestURL = req.body.url;
    const targetUrl = requestURL;

    if (!targetUrl) return res.status(400).send({ error: 'URL is required' });

    try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });

    // Wait for a key content element to ensure page has rendered
    await page.waitForFunction(() => {
      return document.querySelectorAll('h1').length > 0;
    }, { timeout: 15000 }).catch(() => { /* optional fallback */ });

    // Extract full document HTML including dynamic content
    const fullHtml = await page.evaluate(() => document.documentElement.outerHTML);

    await browser.close();

    // Now load into Cheerio for structured parsing
    const $ = cheerio.load(fullHtml);
    const title = $('head > title').text();
    const metaTags = {};
    $('meta').each((_, el) => {
      const name = $(el).attr('name') || $(el).attr('property');
      const content = $(el).attr('content');
      if (name && content) metaTags[name] = content;
    });

    const headings = [];
    const boldTexts = [];
    const paragraphs = [];
    const links = [];
    const lists = [];
    const tables = [];
    const images = [];

    $('h1,h2,h3,h4,h5,h6').each((_, el) => headings.push($(el).text().trim()));
    $('b, strong').each((_, el) => boldTexts.push($(el).text().trim()));
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text) paragraphs.push(text);
    });
    $('a[href]').each((_, el) => {
      links.push({ text: $(el).text().trim(), href: $(el).attr('href') });
    });
    $('ul, ol').each((_, el) => {
      const items = [];
      $(el).find('li').each((_, li) => items.push($(li).text().trim()));
      if (items.length) lists.push(items);
    });
    $('table').each((_, el) => {
      const table = { thead: [], tbody: [] };
      $(el).find('thead tr').each((_, tr) => {
        const row = [];
        $(tr).find('th').each((_, th) => row.push($(th).text().trim()));
        if (row.length) table.thead.push(row);
      });
      const body = $(el).find('tbody');
      const rows = body.length ? body.find('tr') : $(el).find('tr');
      rows.each((_, tr) => {
        const row = [];
        $(tr).find('td, th').each((_, cell) => row.push($(cell).text().trim()));
        if (row.length) table.tbody.push(row);
      });
      tables.push(table);
    });
    $('img').each((_, el) => {
      images.push({ src: $(el).attr('src') || '', alt: $(el).attr('alt') || '' });
    });

    res.json({ title, metaTags, headings, boldTexts, paragraphs, links, lists, tables, images, fullHtml });
  }

    catch (error) {
        res.status(500).send({ error: error.message });
    }
});





app.use((req, res) => {
    res.status(404).json({ "msg": "Not Found" })
})
app.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`Server work on ${PORT}`)
})

