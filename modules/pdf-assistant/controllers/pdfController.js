// d:\NODEJS\tutohub\learning_backend\modules\pdf-assistant\controllers\pdfController.js
'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  PdfDocument,
  PdfDocumentPage,
  PdfArtifact,
  PdfConversation,
  PdfChatMessage,
  PdfUserPref,
  PdfBillingInterest,
  PdfSubscription,
  PdfJob,
  PdfUsageLog
} = require('../models');
const { getAllPlans } = require('../config/plans');
const storageService = require('../services/storageService');
const queueService = require('../services/queueService');
const usageService = require('../services/usageService');
const localNlpService = require('../services/localNlpService');
const aiService = require('../services/aiService');
const { GUEST_TOKEN_SECRET } = require('../middleware/pdfAuth');

class PdfController {
  // GET /config
  async getConfig(req, res) {
    res.json({
      success: true,
      data: {
        plans: getAllPlans(),
        ai: {
          available: aiService.isConfigured(),
          provider: 'Google Gemini 2.0 Flash'
        },
        billing: {
          enabled: false
        },
        upload: {
          maxFileSizeMb: 25,
          acceptedTypes: ['application/pdf']
        },
        guest: {
          enabled: true,
          retentionHours: 24
        }
      }
    });
  }

  // POST /guest/session
  async createGuestSession(req, res) {
    const guestId = crypto.randomBytes(12).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    const guestToken = jwt.sign(
      { type: 'guest', guestId },
      GUEST_TOKEN_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        guestToken,
        guestId,
        expiresAt: expiresAt.toISOString()
      }
    });
  }

  // GET /me
  async getMe(req, res) {
    const actor = req.actor;
    const plan = req.plan;
    const usage = await usageService.getUsage(actor.ownerKey);
    const storage = await usageService.getStorageStats(actor.ownerKey);

    const resetAt = new Date();
    resetAt.setHours(24, 0, 0, 0);

    res.json({
      success: true,
      data: {
        actor: {
          type: actor.type,
          id: actor.id,
          name: actor.type === 'user' ? actor.user.name : 'Guest User',
          email: actor.type === 'user' ? actor.user.email : null,
          isAdmin: actor.isAdmin
        },
        plan,
        usage: {
          period: usage.period,
          resetAt: resetAt.toISOString(),
          uploads: usage.uploads,
          aiRequests: usage.aiRequests,
          ocrPages: usage.ocrPages
        },
        storage: {
          usedBytes: storage.usedBytes,
          usedMb: storage.usedMb,
          limitBytes: plan.limits.storageMb * 1024 * 1024,
          documentCount: storage.documentCount
        },
        preferences: actor.preferences,
        ai: {
          available: aiService.isConfigured()
        },
        billing: {
          enabled: false
        }
      }
    });
  }

  // PUT /me/preferences
  async updatePreferences(req, res) {
    const { retentionDays, aiConsent } = req.body;
    const userId = req.actor.id;

    let prefs = await PdfUserPref.findOne({ userId });
    if (!prefs) {
      prefs = new PdfUserPref({ userId });
    }

    if (retentionDays !== undefined) {
      const maxRetention = req.plan.limits.retentionDays;
      prefs.retentionDays = Math.min(Math.max(1, Number(retentionDays)), maxRetention);
    }
    if (aiConsent !== undefined) {
      prefs.aiConsent = Boolean(aiConsent);
    }

    await prefs.save();

    res.json({
      success: true,
      data: {
        preferences: prefs
      }
    });
  }

  // POST /documents (Upload)
  async uploadDocument(req, res) {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'FILE_REQUIRED', message: 'No PDF file was uploaded' }
      });
    }

    const { buffer, originalname, size, mimetype } = req.file;

    // Validate magic bytes (%PDF-) and file type
    const isPdfExt = originalname.toLowerCase().endsWith('.pdf');
    const hasMagicBytes = buffer.length >= 5 && buffer.toString('utf8', 0, 4) === '%PDF';
    if (!hasMagicBytes || (!isPdfExt && mimetype !== 'application/pdf')) {
      return res.status(415).json({
        success: false,
        error: { code: 'INVALID_FILE_TYPE', message: 'The uploaded file does not match a valid PDF file signature' }
      });
    }

    // Check size limit for plan
    const maxBytes = req.plan.limits.maxFileSizeMb * 1024 * 1024;
    if (size > maxBytes) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size exceeds the plan limit of ${req.plan.limits.maxFileSizeMb} MB`,
          details: { maxBytes }
        }
      });
    }

    // Quota and storage checks
    await usageService.checkAndIncrement(req.actor.ownerKey, 'uploads', 1, req.plan);
    await usageService.checkStorageQuota(req.actor.ownerKey, size, req.plan);

    // Compute SHA-256
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Deduplication check: if duplicate exists for this owner, return existing
    const existingDoc = await PdfDocument.findOne({
      ownerKey: req.actor.ownerKey,
      fileHash,
      status: { $in: ['ready', 'processing', 'queued'] }
    });

    if (existingDoc) {
      return res.status(200).json({
        success: true,
        meta: { duplicate: true },
        data: { document: existingDoc }
      });
    }

    // Save encrypted file
    const storageKey = await storageService.saveFile(buffer, req.actor.ownerKey, originalname);

    // Expiry calculation
    const retentionDays = req.actor.preferences?.retentionDays || req.plan.limits.retentionDays;
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    const title = originalname.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

    const newDoc = await PdfDocument.create({
      ownerKey: req.actor.ownerKey,
      userId: req.actor.type === 'user' ? req.actor.id : null,
      guestId: req.actor.type === 'guest' ? req.actor.id : null,
      title,
      originalName: originalname,
      fileHash,
      storageKey,
      sizeBytes: size,
      status: 'queued',
      stage: 'queued',
      progress: 0,
      expiresAt
    });

    // Enqueue extraction job
    await queueService.enqueueDocumentExtraction(newDoc._id, req.actor.ownerKey, req.plan.limits.maxPages);

    res.status(201).json({
      success: true,
      data: { document: newDoc }
    });
  }

  // GET /documents
  async listDocuments(req, res) {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const status = req.query.status;
    const q = req.query.q;
    const sort = req.query.sort || 'newest';

    const filter = { ownerKey: req.actor.ownerKey };
    if (status) filter.status = status;
    if (q) filter.title = { $regex: q, $options: 'i' };

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name: { title: 1 },
      size: { sizeBytes: -1 }
    };

    const [items, total] = await Promise.all([
      PdfDocument.find(filter)
        .sort(sortMap[sort] || sortMap.newest)
        .skip((page - 1) * limit)
        .limit(limit),
      PdfDocument.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  }

  // GET /documents/:id
  async getDocument(req, res) {
    const doc = await PdfDocument.findOne({ _id: req.params.id, ownerKey: req.actor.ownerKey });
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      });
    }
    res.json({
      success: true,
      data: { document: doc }
    });
  }

  // GET /documents/:id/status
  async getDocumentStatus(req, res) {
    const doc = await PdfDocument.findOne({ _id: req.params.id, ownerKey: req.actor.ownerKey });
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      });
    }
    res.json({
      success: true,
      data: {
        id: doc._id,
        status: doc.status,
        stage: doc.stage,
        progress: doc.progress,
        error: doc.error,
        pageCount: doc.pageCount
      }
    });
  }

  // DELETE /documents/:id
  async deleteDocument(req, res) {
    const doc = await PdfDocument.findOne({ _id: req.params.id, ownerKey: req.actor.ownerKey });
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      });
    }

    await storageService.deleteFile(doc.storageKey);
    await PdfDocumentPage.deleteMany({ documentId: doc._id });
    await PdfArtifact.deleteMany({ documentId: doc._id });
    await PdfChatMessage.deleteMany({ documentId: doc._id });
    await PdfConversation.deleteMany({ documentId: doc._id });
    await PdfJob.deleteMany({ documentId: doc._id });
    await PdfDocument.findByIdAndDelete(doc._id);

    res.json({
      success: true,
      data: { deleted: true }
    });
  }

  // DELETE /documents (Delete all for user)
  async deleteAllDocuments(req, res) {
    if (req.body.confirm !== 'DELETE_ALL') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Confirmation must match DELETE_ALL' }
      });
    }

    const docs = await PdfDocument.find({ ownerKey: req.actor.ownerKey });
    for (const doc of docs) {
      await storageService.deleteFile(doc.storageKey);
      await PdfDocumentPage.deleteMany({ documentId: doc._id });
      await PdfArtifact.deleteMany({ documentId: doc._id });
      await PdfChatMessage.deleteMany({ documentId: doc._id });
      await PdfConversation.deleteMany({ documentId: doc._id });
    }
    const result = await PdfDocument.deleteMany({ ownerKey: req.actor.ownerKey });

    res.json({
      success: true,
      data: { deletedCount: result.deletedCount }
    });
  }

  // POST /documents/claim (Transfer guest documents to logged-in user)
  async claimGuestDocuments(req, res) {
    const { guestToken } = req.body;
    if (!guestToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'guestToken is required' }
      });
    }

    try {
      const decoded = jwt.verify(guestToken, GUEST_TOKEN_SECRET);
      const guestOwnerKey = `g:${decoded.guestId}`;

      const updated = await PdfDocument.updateMany(
        { ownerKey: guestOwnerKey },
        {
          $set: {
            ownerKey: req.actor.ownerKey,
            userId: req.actor.id,
            guestId: null,
            expiresAt: new Date(Date.now() + req.plan.limits.retentionDays * 24 * 60 * 60 * 1000)
          }
        }
      );

      await PdfDocumentPage.updateMany({ ownerKey: guestOwnerKey }, { $set: { ownerKey: req.actor.ownerKey } });
      await PdfArtifact.updateMany({ ownerKey: guestOwnerKey }, { $set: { ownerKey: req.actor.ownerKey } });
      await PdfConversation.updateMany({ ownerKey: guestOwnerKey }, { $set: { ownerKey: req.actor.ownerKey } });
      await PdfChatMessage.updateMany({ ownerKey: guestOwnerKey }, { $set: { ownerKey: req.actor.ownerKey } });
      await PdfJob.updateMany({ ownerKey: guestOwnerKey }, { $set: { ownerKey: req.actor.ownerKey } });

      res.json({
        success: true,
        data: { claimedCount: updated.nModified !== undefined ? updated.nModified : (updated.modifiedCount || updated.n || 0) }
      });
    } catch (e) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired guest token' }
      });
    }
  }

  // POST /documents/:id/retry
  async retryDocument(req, res) {
    const doc = await PdfDocument.findOne({ _id: req.params.id, ownerKey: req.actor.ownerKey });
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      });
    }

    doc.status = 'queued';
    doc.stage = 'queued';
    doc.progress = 0;
    doc.error = null;
    await doc.save();

    await queueService.enqueueDocumentExtraction(doc._id, req.actor.ownerKey, req.plan.limits.maxPages);

    res.status(202).json({
      success: true,
      data: { document: doc }
    });
  }

  // GET /documents/:id/file
  async streamFile(req, res) {
    let authorized = false;

    // Check token query param for download links
    if (req.query.token) {
      try {
        const decoded = jwt.verify(req.query.token, GUEST_TOKEN_SECRET);
        if (decoded.docId === req.params.id) {
          const targetDoc = await PdfDocument.findById(req.params.id);
          if (targetDoc && targetDoc.ownerKey === decoded.ownerKey) {
            authorized = true;
          }
        }
      } catch (e) {}
    }

    if (!authorized && req.actor) {
      const doc = await PdfDocument.findOne({ _id: req.params.id, ownerKey: req.actor.ownerKey });
      if (doc) authorized = true;
    }

    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Unauthorized access to document file' }
      });
    }

    const doc = await PdfDocument.findById(req.params.id);
    if (!doc) return res.status(404).end();

    const isDownload = req.query.download === '1';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, no-store');
    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalName)}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName)}"`);
    }

    const stream = await storageService.getFileStream(doc.storageKey);
    stream.pipe(res);
  }

  // POST /documents/:id/download-link
  async createDownloadLink(req, res) {
    const doc = await PdfDocument.findOne({ _id: req.params.id, ownerKey: req.actor.ownerKey });
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      });
    }

    const downloadToken = jwt.sign(
      { docId: String(doc._id), ownerKey: req.actor.ownerKey },
      GUEST_TOKEN_SECRET,
      { expiresIn: '120s' }
    );

    const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/api/pdf/documents/${doc._id}/file?token=${downloadToken}&download=1`;
    const expiresAt = new Date(Date.now() + 120000);

    res.json({
      success: true,
      data: { url, downloadToken, expiresAt: expiresAt.toISOString() }
    });
  }

  // GET /documents/:id/pages
  async getPages(req, res) {
    const doc = await PdfDocument.findOne({ _id: req.params.id, ownerKey: req.actor.ownerKey });
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      });
    }

    const from = Math.max(1, parseInt(req.query.from) || 1);
    const to = Math.min(doc.pageCount, parseInt(req.query.to) || from + 19);

    const pages = await PdfDocumentPage.find({
      documentId: doc._id,
      pageNumber: { $gte: from, $lte: to }
    }).sort({ pageNumber: 1 });

    res.json({
      success: true,
      data: {
        pages,
        pageCount: doc.pageCount
      }
    });
  }

  // GET /documents/:id/search
  async searchDocument(req, res) {
    const doc = await PdfDocument.findOne({ _id: req.params.id, ownerKey: req.actor.ownerKey });
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      });
    }

    const query = (req.query.q || '').trim();
    if (!query) {
      return res.json({ success: true, data: { query: '', total: 0, results: [] } });
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'gi');

    const pages = await PdfDocumentPage.find({
      documentId: doc._id,
      text: { $regex: regex }
    }).sort({ pageNumber: 1 });

    const results = [];
    let totalMatches = 0;

    for (const page of pages) {
      const text = page.text;
      const matches = [...text.matchAll(regex)];
      if (matches.length === 0) continue;

      totalMatches += matches.length;
      const snippets = [];

      matches.slice(0, 3).forEach(m => {
        const index = m.index;
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + query.length + 50);
        const snippetText = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
        
        // Highlight positions inside snippet
        const highlightStart = start > 0 ? index - start + 3 : index;
        const highlightEnd = highlightStart + query.length;

        snippets.push({
          text: snippetText,
          highlights: [[highlightStart, highlightEnd]]
        });
      });

      results.push({
        pageNumber: page.pageNumber,
        matchCount: matches.length,
        snippets
      });
    }

    res.json({
      success: true,
      data: {
        query,
        total: totalMatches,
        results
      }
    });
  }

  // GET /search (Cross-document search)
  async crossDocumentSearch(req, res) {
    const query = (req.query.q || '').trim();
    if (!query) {
      return res.json({ success: true, data: { results: [] } });
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'gi');

    const matchingPages = await PdfDocumentPage.find({
      ownerKey: req.actor.ownerKey,
      text: { $regex: regex }
    }).limit(20);

    const docIds = [...new Set(matchingPages.map(p => String(p.documentId)))];
    const docs = await PdfDocument.find({ _id: { $in: docIds } });
    const docMap = new Map(docs.map(d => [String(d._id), d]));

    const results = [];
    matchingPages.forEach(p => {
      const doc = docMap.get(String(p.documentId));
      if (!doc) return;

      const m = p.text.match(regex);
      const index = p.text.search(regex);
      const start = Math.max(0, index - 40);
      const end = Math.min(p.text.length, index + query.length + 40);
      const snippetText = (start > 0 ? '...' : '') + p.text.substring(start, end) + (end < p.text.length ? '...' : '');

      results.push({
        documentId: doc._id,
        title: doc.title,
        pageNumber: p.pageNumber,
        snippet: {
          text: snippetText,
          highlights: [[start > 0 ? index - start + 3 : index, (start > 0 ? index - start + 3 : index) + query.length]]
        }
      });
    });

    res.json({
      success: true,
      data: { results }
    });
  }

  // POST /documents/:id/artifacts
  async createArtifact(req, res) {
    const doc = await PdfDocument.findOne({ _id: req.params.id, ownerKey: req.actor.ownerKey });
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      });
    }

    if (doc.status !== 'ready') {
      return res.status(409).json({
        success: false,
        error: { code: 'DOCUMENT_NOT_READY', message: 'Document is still processing' }
      });
    }

    const { kind, engine = 'local', options = {}, aiConsent } = req.body;
    if (!['summary', 'notes', 'quiz'].includes(kind)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid artifact kind' }
      });
    }

    // Feature gating check
    if (engine === 'ai') {
      const featureMap = {
        summary: 'aiSummary',
        notes: 'aiNotes',
        quiz: 'aiQuiz'
      };
      if (!req.plan.features[featureMap[kind]]) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FEATURE_NOT_IN_PLAN',
            message: `AI-powered ${kind} is available on Pro Premium. Try the high-quality Local engine for free!`,
            details: { feature: featureMap[kind], requiredPlan: 'premium' }
          }
        });
      }

      if (!aiConsent && !req.actor.preferences?.aiConsent) {
        return res.status(403).json({
          success: false,
          error: { code: 'AI_CONSENT_REQUIRED', message: 'User consent required for AI analysis' }
        });
      }

      await usageService.checkAndIncrement(req.actor.ownerKey, 'aiRequests', 1, req.plan);
    }

    const optionsHash = crypto.createHash('md5').update(JSON.stringify({ kind, engine, options })).digest('hex');

    // Check existing cached artifact
    const cached = await PdfArtifact.findOne({
      documentId: doc._id,
      kind,
      optionsHash,
      status: 'ready'
    });

    if (cached) {
      return res.status(200).json({
        success: true,
        data: {
          artifact: { ...cached.toObject(), cached: true }
        }
      });
    }

    // Create pending artifact and job
    const artifact = await PdfArtifact.create({
      documentId: doc._id,
      ownerKey: req.actor.ownerKey,
      kind,
      engine,
      optionsHash,
      options,
      status: 'pending'
    });

    await queueService.enqueueArtifactGeneration(doc._id, artifact._id, kind, engine, options, req.actor.ownerKey);

    res.status(202).json({
      success: true,
      data: { artifact }
    });
  }

  // GET /documents/:id/artifacts
  async listArtifacts(req, res) {
    const filter = { documentId: req.params.id, ownerKey: req.actor.ownerKey };
    if (req.query.kind) filter.kind = req.query.kind;

    const items = await PdfArtifact.find(filter)
      .select('-content')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { items }
    });
  }

  // GET /artifacts/:artifactId
  async getArtifact(req, res) {
    const artifact = await PdfArtifact.findOne({ _id: req.params.artifactId, ownerKey: req.actor.ownerKey });
    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Artifact not found' }
      });
    }

    res.json({
      success: true,
      data: { artifact }
    });
  }

  // DELETE /artifacts/:artifactId
  async deleteArtifact(req, res) {
    const result = await PdfArtifact.findOneAndDelete({ _id: req.params.artifactId, ownerKey: req.actor.ownerKey });
    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Artifact not found' }
      });
    }

    res.json({
      success: true,
      data: { deleted: true }
    });
  }

  // GET /artifacts/:artifactId/export
  async exportArtifact(req, res) {
    let authorized = false;

    if (req.query.token) {
      try {
        const decoded = jwt.verify(req.query.token, GUEST_TOKEN_SECRET);
        if (decoded.artId === req.params.artifactId) authorized = true;
      } catch (e) {}
    }

    if (!authorized && req.actor) {
      const art = await PdfArtifact.findOne({ _id: req.params.artifactId, ownerKey: req.actor.ownerKey });
      if (art) authorized = true;
    }

    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Unauthorized access to artifact export' }
      });
    }

    const artifact = await PdfArtifact.findById(req.params.artifactId);
    if (!artifact || artifact.status !== 'ready') {
      return res.status(404).send('Artifact content not found');
    }

    const format = req.query.format === 'txt' ? 'txt' : 'md';
    let output = '';

    if (artifact.kind === 'summary') {
      output = `# Summary\n\n${artifact.content.overview}\n\n## Key Takeaways\n`;
      artifact.content.keyPoints?.forEach(p => {
        output += `- ${p.text} (Page ${p.page})\n`;
      });
    } else if (artifact.kind === 'notes') {
      output = artifact.content.markdown || JSON.stringify(artifact.content, null, 2);
    } else if (artifact.kind === 'quiz') {
      output = `# Document Quiz (${artifact.content.difficulty})\n\n`;
      artifact.content.questions?.forEach((q, idx) => {
        output += `### Q${idx + 1}: ${q.question}\n`;
        q.options?.forEach((opt, oIdx) => {
          output += `   ${String.fromCharCode(65 + oIdx)}) ${opt}\n`;
        });
        output += `\n**Answer:** ${q.answer}\n**Explanation:** ${q.explanation} (Page ${q.pages?.join(', ')})\n\n`;
      });
    }

    res.setHeader('Content-Type', format === 'md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${artifact.kind}_export.${format}"`);
    res.send(output);
  }

  // POST /artifacts/:artifactId/download-link
  async createArtifactDownloadLink(req, res) {
    const artifact = await PdfArtifact.findOne({ _id: req.params.artifactId, ownerKey: req.actor.ownerKey });
    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Artifact not found' }
      });
    }

    const token = jwt.sign(
      { artId: String(artifact._id) },
      GUEST_TOKEN_SECRET,
      { expiresIn: '120s' }
    );

    const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
    const format = req.query.format || 'md';
    const url = `${baseUrl}/api/pdf/artifacts/${artifact._id}/export?format=${format}&token=${token}`;

    res.json({
      success: true,
      data: { url, expiresAt: new Date(Date.now() + 120000).toISOString() }
    });
  }

  // POST /documents/:id/chat
  async chatWithDocument(req, res) {
    const doc = await PdfDocument.findOne({ _id: req.params.id, ownerKey: req.actor.ownerKey });
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      });
    }

    if (doc.status !== 'ready') {
      return res.status(409).json({
        success: false,
        error: { code: 'DOCUMENT_NOT_READY', message: 'Document is still being processed' }
      });
    }

    const { message, conversationId, engine = 'local', aiConsent } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Message cannot be empty' }
      });
    }

    // Conversation management
    let conversation = null;
    if (conversationId) {
      conversation = await PdfConversation.findOne({ _id: conversationId, documentId: doc._id });
    }
    if (!conversation) {
      conversation = await PdfConversation.create({
        documentId: doc._id,
        ownerKey: req.actor.ownerKey,
        title: message.trim().slice(0, 30)
      });
    }

    // Retrieve relevant passages via local BM25 first
    const pages = await PdfDocumentPage.find({ documentId: doc._id }).sort({ pageNumber: 1 });
    const topPassages = localNlpService.searchPassages(pages, message, 4);

    let assistantText = '';
    let citations = [];
    let found = true;
    let actualEngine = engine;

    if (topPassages.length === 0) {
      found = false;
      assistantText = 'This information does not appear to be present in the uploaded document.';
    } else if (engine === 'ai') {
      if (!req.plan.features.aiChat) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FEATURE_NOT_IN_PLAN',
            message: 'AI chat requires a free registered account or Pro plan',
            details: { feature: 'aiChat', requiredPlan: 'free' }
          }
        });
      }

      if (!aiConsent && !req.actor.preferences?.aiConsent) {
        return res.status(403).json({
          success: false,
          error: { code: 'AI_CONSENT_REQUIRED', message: 'AI consent required' }
        });
      }

      await usageService.checkAndIncrement(req.actor.ownerKey, 'aiRequests', 1, req.plan);

      try {
        const aiResult = await aiService.askDocument(message, topPassages, req.actor.ownerKey);
        assistantText = aiResult.answer;
        citations = aiResult.citations;
        found = aiResult.found;
      } catch (err) {
        // Fallback to local passage quote if AI fails
        actualEngine = 'local';
        assistantText = `[AI response unavailable. Direct document excerpt]:\n\n"${topPassages[0].text}"`;
        citations = [{ page: topPassages[0].page, excerpt: topPassages[0].text }];
      }
    } else {
      // Local engine: structured excerpt quoting
      assistantText = `Found the following relevant content in the document:\n\n"${topPassages[0].text}"`;
      citations = topPassages.map(p => ({ page: p.page, excerpt: p.text }));
    }

    const userMsg = await PdfChatMessage.create({
      conversationId: conversation._id,
      documentId: doc._id,
      ownerKey: req.actor.ownerKey,
      role: 'user',
      content: message.trim()
    });

    const assistantMsg = await PdfChatMessage.create({
      conversationId: conversation._id,
      documentId: doc._id,
      ownerKey: req.actor.ownerKey,
      role: 'assistant',
      content: assistantText,
      citations,
      found,
      engine: actualEngine
    });

    conversation.messageCount += 2;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const currentUsage = await usageService.getUsage(req.actor.ownerKey);

    res.json({
      success: true,
      data: {
        conversationId: conversation._id,
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        usage: {
          aiRequests: currentUsage.aiRequests,
          aiRequestsLimit: req.plan.limits.aiRequestsPerDay
        }
      }
    });
  }

  // GET /documents/:id/conversations
  async getConversations(req, res) {
    const items = await PdfConversation.find({
      documentId: req.params.id,
      ownerKey: req.actor.ownerKey
    }).sort({ lastMessageAt: -1 });

    res.json({
      success: true,
      data: { items }
    });
  }

  // GET /conversations/:cid/messages
  async getMessages(req, res) {
    const items = await PdfChatMessage.find({
      conversationId: req.params.cid,
      ownerKey: req.actor.ownerKey
    }).sort({ createdAt: 1 });

    res.json({
      success: true,
      data: { items }
    });
  }

  // DELETE /conversations/:cid
  async deleteConversation(req, res) {
    await PdfChatMessage.deleteMany({ conversationId: req.params.cid, ownerKey: req.actor.ownerKey });
    await PdfConversation.findOneAndDelete({ _id: req.params.cid, ownerKey: req.actor.ownerKey });

    res.json({
      success: true,
      data: { deleted: true }
    });
  }

  // GET /billing/plans
  async getBillingPlans(req, res) {
    res.json({
      success: true,
      data: {
        plans: getAllPlans(),
        enabled: false
      }
    });
  }

  // GET /billing/subscription
  async getSubscription(req, res) {
    const sub = await PdfSubscription.findOne({ userId: req.actor.id });
    const interest = await PdfBillingInterest.findOne({ userId: req.actor.id });

    res.json({
      success: true,
      data: {
        plan: req.plan,
        subscription: sub,
        interestRegistered: Boolean(interest)
      }
    });
  }

  // POST /billing/interest (Waitlist)
  async registerInterest(req, res) {
    const { plan = 'premium', billingCycle = 'monthly', note = '' } = req.body;

    await PdfBillingInterest.findOneAndUpdate(
      { userId: req.actor.id },
      {
        email: req.actor.user.email,
        plan,
        billingCycle,
        note: String(note).slice(0, 500)
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      data: { registered: true }
    });
  }

  // POST /billing/checkout
  async checkout(req, res) {
    res.status(503).json({
      success: false,
      error: {
        code: 'BILLING_DISABLED',
        message: 'Paid subscription billing is currently in pre-launch waitlist mode. Join the waitlist to receive early access discounts!'
      }
    });
  }

  // Admin Analytics: GET /admin/analytics
  async getAdminAnalytics(req, res) {
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalDocs, readyDocs, failedDocs, activeUsers, waitlistCount] = await Promise.all([
      PdfDocument.countDocuments({ createdAt: { $gte: since } }),
      PdfDocument.countDocuments({ createdAt: { $gte: since }, status: 'ready' }),
      PdfDocument.countDocuments({ createdAt: { $gte: since }, status: 'failed' }),
      PdfUsageLog.distinct('ownerKey', { createdAt: { $gte: since } }),
      PdfBillingInterest.countDocuments()
    ]);

    const logs = await PdfUsageLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          totalAiCost: { $sum: '$costUsd' },
          totalTokensIn: { $sum: '$tokensIn' },
          totalTokensOut: { $sum: '$tokensOut' },
          totalAiRequests: {
            $sum: { $cond: [{ $eq: ['$engine', 'ai'] }, 1, 0] }
          }
        }
      }
    ]);

    const featureStats = await PdfUsageLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$action', count: { $sum: 1 } } }
    ]);

    const dailyStats = await PdfDocument.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          uploads: { $sum: 1 },
          processedOk: { $sum: { $cond: [{ $eq: ['$status', 'ready'] }, 1, 0] } },
          processedFailed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        range: { from: since.toISOString(), to: new Date().toISOString(), days },
        totals: {
          uploads: totalDocs,
          processedOk: readyDocs,
          processedFailed: failedDocs,
          successRate: totalDocs > 0 ? Number(((readyDocs / totalDocs) * 100).toFixed(1)) : 100,
          aiCostUsd: Number((logs[0]?.totalAiCost || 0).toFixed(4)),
          aiRequests: logs[0]?.totalAiRequests || 0,
          aiTokensIn: logs[0]?.totalTokensIn || 0,
          aiTokensOut: logs[0]?.totalTokensOut || 0,
          activeUsers: activeUsers.length,
          waitlistCount
        },
        features: featureStats.map(f => ({ feature: f._id, count: f.count })),
        daily: dailyStats.map(d => ({
          date: d._id,
          uploads: d.uploads,
          processedOk: d.processedOk,
          processedFailed: d.processedFailed
        }))
      }
    });
  }

  // Admin Queue: GET /admin/queue
  async getAdminQueue(req, res) {
    const [queued, running, completed, failed] = await Promise.all([
      PdfJob.countDocuments({ status: 'queued' }),
      PdfJob.countDocuments({ status: 'running' }),
      PdfJob.countDocuments({ status: 'completed' }),
      PdfJob.countDocuments({ status: 'failed' })
    ]);

    const recentFailures = await PdfJob.find({ status: 'failed' })
      .sort({ updatedAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        counts: { queued, running, completed, failed },
        recentFailures
      }
    });
  }

  // Admin Grant/Revoke Pro: POST /admin/subscriptions
  async adminUpdateSubscription(req, res) {
    const { email, plan = 'premium', days = 30 } = req.body;
    const User = require('../../../models/userModel');
    const targetUser = await User.findOne({ email });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User with this email not found' }
      });
    }

    const currentPeriodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const sub = await PdfSubscription.findOneAndUpdate(
      { userId: targetUser._id },
      {
        plan,
        status: 'active',
        currentPeriodEnd,
        provider: 'manual'
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      data: { subscription: sub }
    });
  }
}

module.exports = new PdfController();
