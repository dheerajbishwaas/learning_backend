// d:\NODEJS\tutohub\learning_backend\modules\pdf-assistant\services\cleanupService.js
'use strict';

const { PdfDocument, PdfDocumentPage, PdfArtifact, PdfChatMessage, PdfConversation, PdfJob } = require('../models');
const storageService = require('./storageService');

class CleanupService {
  async runDailyCleanup() {
    const now = new Date();
    console.log(`[PdfCleanupService] Starting cleanup of expired documents at ${now.toISOString()}`);

    try {
      // Exclude documents that are currently in queued or processing status
      const expiredDocs = await PdfDocument.find({
        expiresAt: { $ne: null, $lt: now },
        status: { $nin: ['queued', 'processing'] }
      });

      console.log(`[PdfCleanupService] Found ${expiredDocs.length} expired documents eligible for cleanup.`);

      for (const doc of expiredDocs) {
        // Double-check no active background job is running or queued for this document
        const activeJob = await PdfJob.findOne({
          documentId: doc._id,
          status: { $in: ['queued', 'running'] }
        });
        if (activeJob) {
          console.log(`[PdfCleanupService] Skipping ${doc._id} - has active job (${activeJob.status})`);
          continue;
        }

        // Verify no other document references this storageKey before unlinking disk file
        const otherRef = await PdfDocument.findOne({
          _id: { $ne: doc._id },
          storageKey: doc.storageKey
        });
        if (!otherRef) {
          await storageService.deleteFile(doc.storageKey);
        }

        await PdfDocumentPage.deleteMany({ documentId: doc._id });
        await PdfArtifact.deleteMany({ documentId: doc._id });
        await PdfChatMessage.deleteMany({ documentId: doc._id });
        await PdfConversation.deleteMany({ documentId: doc._id });
        await PdfJob.deleteMany({ documentId: doc._id });
        await PdfDocument.findByIdAndDelete(doc._id);
      }
      console.log(`[PdfCleanupService] Successfully finished cleanup cycle.`);
    } catch (err) {
      console.error('[PdfCleanupService] Cleanup error:', err);
    }
  }

  startScheduler(intervalMs = 60 * 60 * 1000) { // Check hourly
    setInterval(() => {
      this.runDailyCleanup();
    }, intervalMs);
    // Initial run on boot
    this.runDailyCleanup();
  }
}

module.exports = new CleanupService();
