import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  await mongoose.connect(env.mongoUri, {
    // Serverless (Vercel) par har function instance apna pool kholta hai; Atlas free (M0) ki hadd 500 connections hai.
    // Chhota pool + jaldi fail hona: database band ho to request 30 second latak kar nahi, 5 second mein saaf error deti hai.
    maxPoolSize: env.mongoPoolSize,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 20000,
  });
  console.log('MongoDB connected');
}
