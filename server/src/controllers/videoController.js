import mongoose from 'mongoose';
import Language from '../models/Language.js';
import User from '../models/User.js';
import Video from '../models/Video.js';
import { env } from '../config/env.js';
import { buildUploadSignature, destroyUpload, isOwnUpload, parseYouTubeId, MAX_UPLOAD_MB } from '../utils/video.js';

const SLUG = /^[a-z0-9-]{1,50}$/;
const PAGE_SIZE = 12;
const isStaff = (role) => role === 'teacher' || role === 'admin';
const notFound = (res) => res.status(404).json({ message: 'Video not found' });

// Browser ko sirf wohi fields milti hain jo zaroori hain
const shape = (v, user) => ({
  id: String(v._id),
  title: v.title,
  description: v.description,
  languageSlug: v.languageSlug,
  source: v.source,
  youtubeId: v.youtubeId ?? null,
  fileUrl: v.fileUrl ?? null,
  status: v.status,
  uploaderName: v.uploaderName,
  createdAt: v.createdAt,
  canDelete: isStaff(user.role) || (v.uploadedBy && String(v.uploadedBy) === user.id),
});

export const getConfig = (req, res) =>
  res.json({ uploadEnabled: Boolean(env.cloudinary), maxMb: MAX_UPLOAD_MB, canReview: isStaff(req.user.role) });

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
  const rows = await Video.find({ uploadedBy: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ videos: rows.map((v) => shape(v, req.user)) });
}

export async function listPending(req, res) {
  const rows = await Video.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(100).lean();
  res.json({ videos: rows.map((v) => shape(v, req.user)) });
}

export async function createUploadSignature(req, res) {
  if (!env.cloudinary) return res.status(503).json({ message: 'File upload is not set up yet. Please add a YouTube link instead.' });
  res.json(buildUploadSignature(env.cloudinary));
}

export async function createVideo(req, res) {
  const body = req.body;
  const doc = {
    title: body.title,
    description: body.description,
    languageSlug: body.languageSlug,
    source: body.source,
    uploadedBy: req.user.id,
    status: isStaff(req.user.role) ? 'approved' : 'pending',
  };

  if (body.source === 'youtube') {
    doc.youtubeId = parseYouTubeId(body.youtubeUrl);
  } else {
    if (!env.cloudinary || !isOwnUpload(body, env.cloudinary.cloudName)) {
      return res.status(400).json({ message: 'Invalid uploaded file' });
    }
    doc.fileUrl = body.fileUrl;
    doc.publicId = body.publicId;
  }

  if (doc.languageSlug && !(await Language.exists({ slug: doc.languageSlug }))) {
    return res.status(400).json({ message: 'Unknown language' });
  }
  const author = await User.findById(req.user.id).select('name').lean();
  doc.uploaderName = author?.name ?? 'User';

  try {
    const video = await Video.create(doc);
    res.status(201).json({ video: shape(video.toObject(), req.user) });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ message: 'This YouTube video is already on Shorts Study' });
    throw err;
  }
}

export async function approveVideo(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const video = await Video.findByIdAndUpdate(req.params.id, { $set: { status: 'approved' } }, { returnDocument: 'after' }).lean();
  if (!video) return notFound(res);
  res.json({ video: shape(video, req.user) });
}

export async function removeVideo(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const video = await Video.findById(req.params.id);
  if (!video) return notFound(res);
  const owner = video.uploadedBy && String(video.uploadedBy) === req.user.id;
  if (!owner && !isStaff(req.user.role)) return res.status(403).json({ message: 'Forbidden' });

  await video.deleteOne();
  if (video.source === 'upload' && video.publicId && env.cloudinary) {
    destroyUpload(video.publicId, env.cloudinary).catch((err) => console.error('Cloudinary delete failed:', err.message));
  }
  res.status(204).end();
}
