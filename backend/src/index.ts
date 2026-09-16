import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'node:path';

const app = express();
const port = process.env.PORT || 3847;

app.use(cors());
app.use(express.json());

app.get('/api/status', (req: Request, res: Response) => {
   res.json({ message: 'Backend is fully operational!' });
});

const isProduction = process.env.NODE_ENV === 'production';

// API endpoints
app.get('/api/downloads/:filename', (req, res) => {
   const filePath = path.join(process.cwd(), 'internal-zips', req.params.filename);
   res.download(filePath);
});

// Only serve static Vite (frontend website) files in production
if (isProduction) {
   // Serve the static Vite frontend, basically transforms express into a classic http webserver (Static File Server).
   // Basically, given the subUrl of the http requests it receives, if it is equivalent to an endpoint defined above (like "/api/downloads/:filename"),
   // express returns the REST API http response, if not, it considers any subUrl as a relative path of the /frontend-dist folder
   // (inserted in / in production with docker) and return the file pointed by the path if present (if not the fallback defined below will be used).
   app.use(express.static(path.join(process.cwd(), 'frontend-dist')));

   // Fallback for every get endpoint that doesn't match the others defined above (including the ones derived from express.static) (SPA)
   app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'frontend-dist/index.html'));
   });
}

app.listen(port, () => {
   console.log(`Server is listening on port ${port}`);
});