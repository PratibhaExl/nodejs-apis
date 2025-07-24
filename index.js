
import express, { response } from 'express';
import ScrappingRoutes from './routes/ScrappingRoutes.js';
import cors from 'cors';
import path from 'path';


const PORT = 6677;
const app = express();

app.use(express.json());//parse all body request 
app.use(express.static('assets'));
//app.use(cors());
// app.use(cors({
//   origin: 'http://localhost:3000', //  app URL
//   methods: ['GET', 'POST'],
// }));

app.use(cors()); // Allow all origins
app.use("", ScrappingRoutes);

app.use((req, res) => {
    res.status(404).json({ "msg": "Not Found" })
})
app.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`Server work on ${PORT}`)
})

