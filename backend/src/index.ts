import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/status', (req: Request, res: Response) => {
  res.json({ message: 'Backend is fully operational!' });
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});