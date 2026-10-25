import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import lessonRoutes from './routes/lessonRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
// Progress route ko bara body chahiye (code drafts), is liye uska apna parser global parser se pehle lagta hai
app.use('/api/progress', express.json({ limit: '64kb' }), progressRoutes);
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/languages', lessonRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/search', searchRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
