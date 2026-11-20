import { once } from 'node:events';
import mongoose from 'mongoose';
import Language from '../models/Language.js';
import User from '../models/User.js';
import Video from '../models/Video.js';
import VideoChunk from '../models/VideoChunk.js';
import { env } from '../config/env.js';
import {
  CHUNK_SIZE,
  MB,
  chunkCountFor,
  expectedChunkLength,
  looksLikeVideo,
  parseRange,
  parseYouTubeId,
  streamPath,
  verifyStreamLink,
} from '../utils/video.js';

const SLUG = /^[a-z0-9-]{1,50}$/;
const PAGE_SIZE = 12;
const STALE_UPLOAD_MS = 60 * 60 * 1000;
const isStaff = (role) => role === 'teacher' || role === 'admin';
const notFound = (res) => res.status(404).json({ message: 'Video not found' });
const VISIBLE = { $in: ['pending', 'approved', 'rejected'] }; // "My videos" mein rejected bhi, taake student ko wajah nazar aaye

// Browser ko sirf wohi fields milti hain jo zaroori hain
export const shape = (v, user) => ({
  id: String(v._id),
  title: v.title,
  description: v.description,
  languageSlug: v.languageSlug,
  source: v.source,
  youtubeId: v.youtubeId ?? null,
  streamUrl: v.source === 'upload' ? streamPath(String(v._id), env.jwtAccessSecret) : null,
  status: v.status,
  rejectReason: v.status === 'rejected' ? (v.rejectReason ?? '') : '',
  uploaderName: v.uploaderName,
  createdAt: v.createdAt,
  canDelete: isStaff(user.role) || Boolean(v.uploadedBy && String(v.uploadedBy) === user.id),
});

export const getConfig = (req, res) => res.json({ uploadEnabled: true, maxMb: env.maxUploadMb, canReview: isStaff(req.user.role) });

export async function listVideos(req, res) {
  const filter = { status: 'approved' };
  const { language } = req.query;
  if (typeof language === 'string' && language) {
    if (!SLUG.test(language)) return res.status(400).json({ message: 'Invalid language' });
    filter.languageSlug = language;
  }
  const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 1000);

  const [rows, total] = await Promise.all([
    Video.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Video.countDocuments(filter),
  ]);
  res.json({ videos: rows.map((v) => shape(v, req.user)), page, pages: Math.max(Math.ceil(total / PAGE_SIZE), 1), total });
}

export async function listMine(req, res) {
  const rows = await Video.find({ uploadedBy: req.user.id, status: VISIBLE }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ videos: rows.map((v) => shape(v, req.user)) });
}

export async function listPending(req, res) {
  const rows = await Video.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(100).lean();
  res.json({ videos: rows.map((v) => shape(v, req.user)) });
}

async function languageExists(slug) {
  return !slug || Boolean(await Language.exists({ slug }));
}

async function authorName(userId) {
  const author = await User.findById(userId).select('name').lean();
  return author?.name ?? 'User';
}

export async function createVideo(req, res) {
  const { title, description, languageSlug, youtubeUrl } = req.body;
  if (!(await languageExists(languageSlug))) return res.status(400).json({ message: 'Unknown language' });

  try {
    const video = await Video.create({
      title,
      description,
      languageSlug,
      source: 'youtube',
      youtubeId: parseYouTubeId(youtubeUrl),
      uploadedBy: req.user.id,
      uploaderName: await authorName(req.user.id),
      status: isStaff(req.user.role) ? 'approved' : 'pending',
    });
    res.status(201).json({ video: shape(video.toObject(), req.user) });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ message: 'This YouTube video is already on Shorts Study' });
    throw err;
  }
}

// ---------- File upload (tukdon mein) ----------

// Adhoori chhor di gayi uploads (1 ghante se purani) saaf kar do, taake database na bhare
async function removeStaleUploads() {
  const stale = await Video.find({ status: 'uploading', createdAt: { $lt: new Date(Date.now() - STALE_UPLOAD_MS) } }).select('_id').lean();
  if (!stale.length) return;
  const ids = stale.map((v) => v._id);
  await VideoChunk.deleteMany({ video: { $in: ids } });
  await Video.deleteMany({ _id: { $in: ids } });
}

export async function startUpload(req, res) {
  const { title, description, languageSlug, size, mimeType } = req.body;
  if (size > env.maxUploadMb * MB) return res.status(413).json({ message: `Video must be ${env.maxUploadMb} MB or smaller` });
  if (!(await languageExists(languageSlug))) return res.status(400).json({ message: 'Unknown language' });

  await removeStaleUploads();
  const [used] = await Video.aggregate([{ $match: { source: 'upload' } }, { $group: { _id: null, bytes: { $sum: '$fileSize' } } }]);
  if ((used?.bytes ?? 0) + size > env.maxTotalUploadMb * MB) {
    return res.status(507).json({ message: 'The video library is full. Please ask a teacher to delete old videos.' });
  }

  const video = await Video.create({
    title,
    description,
    languageSlug,
    source: 'upload',
    fileSize: size,
    mimeType,
    chunkCount: chunkCountFor(size),
    status: 'uploading',
    uploadedBy: req.user.id,
    uploaderName: await authorName(req.user.id),
  });
  res.status(201).json({ id: String(video._id), chunkSize: CHUNK_SIZE, chunkCount: video.chunkCount });
}

// Sirf apni, abhi "uploading" wali video par kaam ki ijazat hai
async function ownUpload(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res), null;
  const video = await Video.findById(req.params.id);
  if (!video || video.source !== 'upload' || video.status !== 'uploading' || String(video.uploadedBy) !== req.user.id) {
    notFound(res);
    return null;
  }
  return video;
}

export async function putChunk(req, res) {
  const video = await ownUpload(req, res);
  if (!video) return;
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= video.chunkCount) return res.status(400).json({ message: 'Invalid part number' });

  const data = req.body;
  if (!Buffer.isBuffer(data) || data.length !== expectedChunkLength(video.fileSize, index)) {
    return res.status(400).json({ message: 'Invalid part size' });
  }
  if (index === 0 && !looksLikeVideo(data)) return res.status(400).json({ message: 'This file is not a valid MP4, MOV or WebM video' });

  await VideoChunk.updateOne({ video: video._id, index }, { $set: { data } }, { upsert: true });
  res.status(204).end();
}

export async function completeUpload(req, res) {
  const video = await ownUpload(req, res);
  if (!video) return;
  const have = await VideoChunk.countDocuments({ video: video._id });
  if (have !== video.chunkCount) return res.status(400).json({ message: `Upload incomplete (${have} of ${video.chunkCount} parts)` });

  video.status = isStaff(req.user.role) ? 'approved' : 'pending';
  await video.save();
  res.json({ video: shape(video.toObject(), req.user) });
}

// Signed link wala stream: Range support ke saath (video seek ke liye zaroori)
export async function streamVideo(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id) || !verifyStreamLink(id, req.query.exp, req.query.sig, env.jwtAccessSecret)) return notFound(res);
  const video = await Video.findById(id).select('source status fileSize mimeType').lean();
  if (!video || video.source !== 'upload' || video.status === 'uploading') return notFound(res);

  const range = parseRange(req.headers.range, video.fileSize);
  if (range === 'invalid') return res.status(416).set('Content-Range', `bytes */${video.fileSize}`).end();
  const { start, end } = range ?? { start: 0, end: video.fileSize - 1 };

  res.status(range ? 206 : 200);
  res.set({
    'Content-Type': video.mimeType,
    'Accept-Ranges': 'bytes',
    'Content-Length': String(end - start + 1),
    'Cache-Control': 'private, max-age=3600',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  if (range) res.set('Content-Range', `bytes ${start}-${end}/${video.fileSize}`);

  try {
    const first = Math.floor(start / CHUNK_SIZE);
    const last = Math.floor(end / CHUNK_SIZE);
    for (let i = first; i <= last; i++) {
      const chunk = await VideoChunk.findOne({ video: id, index: i }).select('data');
      if (!chunk) throw new Error(`missing part ${i}`);
      const from = i === first ? start - i * CHUNK_SIZE : 0;
      const to = i === last ? end - i * CHUNK_SIZE + 1 : chunk.data.length;
      if (!res.write(chunk.data.subarray(from, to))) await Promise.race([once(res, 'drain'), once(res, 'close')]);
      if (res.destroyed) return;
    }
    res.end();
  } catch (err) {
    console.error('Video stream failed:', err.message);
    res.destroy(err); // headers ja chuke hain, is liye connection tod do
  }
}

export async function approveVideo(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const video = await Video.findOneAndUpdate({ _id: req.params.id, status: 'pending' }, { $set: { status: 'approved' } }, { returnDocument: 'after' }).lean();
  if (!video) return notFound(res);
  res.json({ video: shape(video, req.user) });
}

export async function removeVideo(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const video = await Video.findById(req.params.id);
  if (!video) return notFound(res);
  const owner = video.uploadedBy && String(video.uploadedBy) === req.user.id;
  if (!owner && !isStaff(req.user.role)) return res.status(403).json({ message: 'Forbidden' });

  if (video.source === 'upload') await VideoChunk.deleteMany({ video: video._id });
  await video.deleteOne();
  res.status(204).end();
}
