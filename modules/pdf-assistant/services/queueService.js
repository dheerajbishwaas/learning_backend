// d:\NODEJS\tutohub\learning_backend\modules\pdf-assistant\services\queueService.js
'use strict';

const crypto = require('crypto');
const os = require('os');
const { PdfJob, PdfDocument, PdfDocumentPage, PdfArtifact } = require('../models');
const storageService = require('./storageService');
const pdfExtractor = require('./pdfExtractor');
const localNlpService = require('./localNlpService');
const aiService = require('./aiService');

const WORKER_ID = `${os.hostname()}_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
const LEASE_DURATION_MS = 60000; // 60s lease

class QueueService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
  }

  startWorker(pollIntervalMs = 2000) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[PdfQueueWorker] Started with ID: ${WORKER_ID}`);

    this.intervalId = setInterval(async () => {
      try {
        await this.processNextJob();
      } catch (err) {
        console.error('[PdfQueueWorker] Unhandled loop error:', err);
      }
    }, pollIntervalMs);
  }

  stopWorker() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log(`[PdfQueueWorker] Stopped`);
  }

  // Atomically claim next eligible job
  async acquireNextJob() {
    const now = new Date();
    const leaseExpiry = new Date(now.getTime() + LEASE_DURATION_MS);

    // Eligible if status is queued OR (status is running but lease expired), and attempts < maxAttempts
    const filter = {
      $or: [
        { status: 'queued' },
        { status: 'running', lockExpiresAt: { $lt: now } }
      ],
      $expr: { $lt: ['$attempts', '$maxAttempts'] }
    };

    const update = {
      $set: {
        status: 'running',
        lockedAt: now,
        lockedBy: WORKER_ID,
        lockExpiresAt: leaseExpiry
      },
      $inc: { attempts: 1 }
    };

    return PdfJob.findOneAndUpdate(filter, update, { sort: { createdAt: 1 }, new: true });
  }

  async processNextJob() {
    const job = await this.acquireNextJob();
    if (!job) return;

    try {
      if (job.type === 'document_extract') {
        await this.handleDocumentExtraction(job);
      } else if (job.type === 'artifact_generate') {
        await this.handleArtifactGeneration(job);
      }

      job.status = 'completed';
      job.lockExpiresAt = null;
      await job.save();
    } catch (err) {
      console.error(`[PdfQueueWorker] Job ${job._id} failed:`, err.message || err);
      const isPermanent = err.code === 'PDF_ENCRYPTED' || err.code === 'PDF_CORRUPTED' || err.code === 'PDF_TOO_MANY_PAGES' || err.code === 'PDF_EMPTY' || err.code === 'INVALID_FILE_TYPE';
      
      job.lastError = err.message || String(err);
      if (isPermanent || job.attempts >= job.maxAttempts) {
        job.status = 'failed';
      } else {
        job.status = 'queued'; // Will be retried
      }
      job.lockExpiresAt = null;
      await job.save();

      // Update document status if it was extraction
      if (job.type === 'document_extract') {
        await PdfDocument.findByIdAndUpdate(job.documentId, {
          status: 'failed',
          stage: 'failed',
          error: {
            code: err.code || 'PROCESSING_ERROR',
            message: err.message || 'Document extraction failed'
          }
        });
      }
    }
  }

  async handleDocumentExtraction(job) {
    const doc = await PdfDocument.findById(job.documentId);
    if (!doc) throw new Error('Document not found');

    doc.status = 'processing';
    doc.stage = 'extracting';
    doc.progress = 15;
    await doc.save();

    const fileBuffer = await storageService.getFileBuffer(doc.storageKey);
    const extractionResult = await pdfExtractor.inspectAndExtract(fileBuffer, { maxPages: job.payload?.maxPages || 500 });

    doc.pageCount = extractionResult.pageCount;
    doc.metadata = extractionResult.metadata;
    doc.outline = extractionResult.outline;
    doc.securityFlags = extractionResult.securityFlags;
    doc.isScanned = extractionResult.isScanned;
    doc.stats = extractionResult.stats;
    doc.topics = extractionResult.pages ? localNlpService.extractKeyTopics(extractionResult.pages, 5) : [];
    doc.progress = 60;
    doc.stage = 'indexing';
    await doc.save();

    // Store pages in DB
    await PdfDocumentPage.deleteMany({ documentId: doc._id });
    const pageDocs = extractionResult.pages.map(p => ({
      documentId: doc._id,
      ownerKey: doc.ownerKey,
      pageNumber: p.pageNumber,
      text: p.text,
      charCount: p.charCount,
      wordCount: p.wordCount,
      hasOcr: p.hasOcr
    }));

    if (pageDocs.length > 0) {
      await PdfDocumentPage.insertMany(pageDocs);
    }

    doc.status = 'ready';
    doc.stage = 'done';
    doc.progress = 100;
    doc.processedAt = new Date();
    await doc.save();
  }

  async handleArtifactGeneration(job) {
    const { artifactId, kind, engine, options, ownerKey } = job.payload;
    const artifact = await PdfArtifact.findById(artifactId);
    if (!artifact) throw new Error('Artifact not found');

    artifact.status = 'processing';
    await artifact.save();

    const pages = await PdfDocumentPage.find({ documentId: job.documentId }).sort({ pageNumber: 1 });
    let content = null;

    if (kind === 'summary') {
      if (engine === 'ai') {
        content = await aiService.generateAiSummary(pages, options?.mode || 'concise', ownerKey);
      } else {
        content = localNlpService.generateSummary(pages, options?.mode || 'concise');
      }
    } else if (kind === 'notes') {
      if (engine === 'ai') {
        content = await aiService.generateAiNotes(pages, options?.style || 'structured', ownerKey);
      } else {
        content = localNlpService.generateNotes(pages, options?.style || 'structured');
      }
    } else if (kind === 'quiz') {
      if (engine === 'ai') {
        content = await aiService.generateAiQuiz(pages, options || {}, ownerKey);
      } else {
        content = localNlpService.generateQuiz(pages, options || {});
      }
    }

    artifact.content = content;
    artifact.status = 'ready';
    await artifact.save();
  }

  async enqueueDocumentExtraction(documentId, ownerKey, maxPages) {
    return PdfJob.create({
      type: 'document_extract',
      documentId,
      ownerKey,
      payload: { maxPages },
      idempotencyKey: `extract_${documentId}`
    });
  }

  async enqueueArtifactGeneration(documentId, artifactId, kind, engine, options, ownerKey) {
    return PdfJob.create({
      type: 'artifact_generate',
      documentId,
      ownerKey,
      payload: { artifactId, kind, engine, options, ownerKey },
      idempotencyKey: `artifact_${artifactId}`
    });
  }
}

module.exports = new QueueService();
