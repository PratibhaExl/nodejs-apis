
import express, { response } from 'express';
import ScrappingRoutes from './routes/ScrappingRoutes.js';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 6677;
const app = express();

app.use(express.json());//parse all body request 
//app.use(express.static('assets'));
app.use(express.json());

// __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve downloads publicly
app.use('/downloads', express.static(path.join(__dirname, 'public/downloads')));


app.use(cors()); // Allow all origins
app.use("", ScrappingRoutes);

app.use((req, res) => {
    res.status(404).json({ "msg": "Not Found" })
})
app.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`Server work on ${PORT}`)
})

