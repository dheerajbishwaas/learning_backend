// d:\NODEJS\tutohub\learning_backend\modules\pdf-assistant\routes\pdfRoutes.js
'use strict';

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const pdfController = require('../controllers/pdfController');
const { resolveActor, requireActor, requireUser, requireAdmin } = require('../middleware/pdfAuth');

const router = express.Router();

// Helper to catch async errors in Express 4 and forward to error middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Multer memory storage for incoming PDF uploads (max 100MB buffer limit, plan-specific limit enforced in controller)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

// Actor-aware key generator: use stable authenticated user ID or guest ID, with safe IP fallback
const getActorKey = (req) => {
  if (req.actor && req.actor.ownerKey) {
    return req.actor.ownerKey;
  }
  return req.ip;
};

// Rate limiters
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: getActorKey,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many upload attempts. Please wait a minute.' } }
});

const guestSessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.ip,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many guest sessions requested.' } }
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: getActorKey,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Chat rate limit reached. Please slow down.' } }
});

// Public endpoints
router.get('/config', asyncHandler((req, res) => pdfController.getConfig(req, res)));
router.post('/guest/session', guestSessionLimiter, asyncHandler((req, res) => pdfController.createGuestSession(req, res)));
router.get('/documents/:id/file', (req, res, next) => resolveActor(req, res, next), asyncHandler((req, res) => pdfController.streamFile(req, res)));
router.get('/artifacts/:artifactId/export', (req, res, next) => resolveActor(req, res, next), asyncHandler((req, res) => pdfController.exportArtifact(req, res)));

// Authenticated / Guest endpoints
router.use(resolveActor);

router.get('/me', requireActor, asyncHandler((req, res) => pdfController.getMe(req, res)));
router.put('/me/preferences', requireUser, asyncHandler((req, res) => pdfController.updatePreferences(req, res)));

// Document Management
router.post('/documents', requireActor, uploadLimiter, upload.single('file'), asyncHandler((req, res) => pdfController.uploadDocument(req, res)));
router.get('/documents', requireActor, asyncHandler((req, res) => pdfController.listDocuments(req, res)));
router.delete('/documents', requireUser, asyncHandler((req, res) => pdfController.deleteAllDocuments(req, res)));
router.post('/documents/claim', requireUser, asyncHandler((req, res) => pdfController.claimGuestDocuments(req, res)));

router.get('/documents/:id', requireActor, asyncHandler((req, res) => pdfController.getDocument(req, res)));
router.get('/documents/:id/status', requireActor, asyncHandler((req, res) => pdfController.getDocumentStatus(req, res)));
router.delete('/documents/:id', requireActor, asyncHandler((req, res) => pdfController.deleteDocument(req, res)));
router.post('/documents/:id/retry', requireActor, asyncHandler((req, res) => pdfController.retryDocument(req, res)));
router.post('/documents/:id/download-link', requireActor, asyncHandler((req, res) => pdfController.createDownloadLink(req, res)));
router.get('/documents/:id/pages', requireActor, asyncHandler((req, res) => pdfController.getPages(req, res)));
router.get('/documents/:id/search', requireActor, asyncHandler((req, res) => pdfController.searchDocument(req, res)));

// Cross-document search
router.get('/search', requireActor, asyncHandler((req, res) => pdfController.crossDocumentSearch(req, res)));

// Artifacts (Summary / Notes / Quiz)
router.post('/documents/:id/artifacts', requireActor, asyncHandler((req, res) => pdfController.createArtifact(req, res)));
router.get('/documents/:id/artifacts', requireActor, asyncHandler((req, res) => pdfController.listArtifacts(req, res)));
router.get('/artifacts/:artifactId', requireActor, asyncHandler((req, res) => pdfController.getArtifact(req, res)));
router.delete('/artifacts/:artifactId', requireActor, asyncHandler((req, res) => pdfController.deleteArtifact(req, res)));
router.post('/artifacts/:artifactId/download-link', requireActor, asyncHandler((req, res) => pdfController.createArtifactDownloadLink(req, res)));

// Chat Q&A
router.post('/documents/:id/chat', requireActor, chatLimiter, asyncHandler((req, res) => pdfController.chatWithDocument(req, res)));
router.get('/documents/:id/conversations', requireActor, asyncHandler((req, res) => pdfController.getConversations(req, res)));
router.get('/conversations/:cid/messages', requireActor, asyncHandler((req, res) => pdfController.getMessages(req, res)));
router.delete('/conversations/:cid', requireActor, asyncHandler((req, res) => pdfController.deleteConversation(req, res)));

// Billing & Waitlist
router.get('/billing/plans', asyncHandler((req, res) => pdfController.getBillingPlans(req, res)));
router.get('/billing/subscription', requireUser, asyncHandler((req, res) => pdfController.getSubscription(req, res)));
router.post('/billing/interest', requireUser, asyncHandler((req, res) => pdfController.registerInterest(req, res)));
router.post('/billing/checkout', requireUser, asyncHandler((req, res) => pdfController.checkout(req, res)));

// Admin Endpoints
router.get('/admin/analytics', requireAdmin, asyncHandler((req, res) => pdfController.getAdminAnalytics(req, res)));
router.get('/admin/queue', requireAdmin, asyncHandler((req, res) => pdfController.getAdminQueue(req, res)));
router.post('/admin/subscriptions', requireAdmin, asyncHandler((req, res) => pdfController.adminUpdateSubscription(req, res)));

// Centralized PDF error handling middleware
router.use((err, req, res, next) => {
  const status = err.status || (
    err.code === 'QUOTA_EXCEEDED' || err.code === 'STORAGE_QUOTA_EXCEEDED' ? 429 :
    err.code === 'FILE_TOO_LARGE' ? 413 :
    err.code === 'INVALID_FILE_TYPE' ? 415 :
    err.code === 'PDF_ENCRYPTED' || err.code === 'PDF_CORRUPTED' || err.code === 'PDF_TOO_MANY_PAGES' || err.code === 'PDF_EMPTY' ? 422 :
    err.code === 'AI_BUDGET_EXCEEDED' || err.code === 'AI_UNAVAILABLE' ? 503 :
    500
  );

  res.status(status).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An error occurred during request processing',
      details: err.details || null
    }
  });
});

module.exports = router;
