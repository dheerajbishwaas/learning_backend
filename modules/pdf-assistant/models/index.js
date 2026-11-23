// d:\NODEJS\tutohub\learning_backend\modules\pdf-assistant\models\index.js
'use strict';

const mongoose = require('mongoose');

// 1. PDF Document Schema
const pdfDocumentSchema = new mongoose.Schema({
  ownerKey: { type: String, required: true, index: true }, // 'u:<userId>' or 'g:<guestId>'
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  guestId: { type: String, default: null, index: true },
  title: { type: String, required: true },
  originalName: { type: String, required: true },
  fileHash: { type: String, required: true, index: true }, // SHA-256
  storageKey: { type: String, required: true }, // path or S3 key
  sizeBytes: { type: Number, required: true },
  pageCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['queued', 'processing', 'ready', 'failed'],
    default: 'queued',
    index: true
  },
  stage: {
    type: String,
    enum: ['queued', 'extracting', 'ocr', 'indexing', 'done', 'failed'],
    default: 'queued'
  },
  progress: { type: Number, default: 0 }, // 0 - 100
  error: {
    code: { type: String, default: null },
    message: { type: String, default: null }
  },
  isScanned: { type: Boolean, default: false },
  ocrApplied: { type: Boolean, default: false },
  ocrPages: { type: Number, default: 0 },
  metadata: {
    title: { type: String, default: '' },
    author: { type: String, default: '' },
    subject: { type: String, default: '' },
    keywords: { type: String, default: '' },
    creator: { type: String, default: '' },
    producer: { type: String, default: '' },
    creationDate: { type: Date, default: null },
    modDate: { type: Date, default: null },
    pdfVersion: { type: String, default: '1.7' }
  },
  outline: [{
    title: { type: String },
    page: { type: Number },
    level: { type: Number, default: 0 }
  }],
  stats: {
    wordCount: { type: Number, default: 0 },
    charCount: { type: Number, default: 0 },
    readingMinutes: { type: Number, default: 0 },
    emptyPages: { type: Number, default: 0 }
  },
  topics: [{ type: String }],
  securityFlags: [{ type: String }], // 'javascript', 'embedded_files', etc.
  expiresAt: { type: Date, default: null, index: true },
  processedAt: { type: Date, default: null }
}, {
  timestamps: true,
  collection: 'pdf_documents'
});

pdfDocumentSchema.index({ ownerKey: 1, createdAt: -1 });

// 2. PDF Document Page Schema
const pdfDocumentPageSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PdfDocument', required: true, index: true },
  ownerKey: { type: String, required: true, index: true },
  pageNumber: { type: Number, required: true },
  text: { type: String, default: '' },
  charCount: { type: Number, default: 0 },
  wordCount: { type: Number, default: 0 },
  hasOcr: { type: Boolean, default: false }
}, {
  collection: 'pdf_document_pages'
});

pdfDocumentPageSchema.index({ documentId: 1, pageNumber: 1 }, { unique: true });
pdfDocumentPageSchema.index({ ownerKey: 1, text: 'text' });

// 3. Processing Job Schema (MongoDB-backed queue with atomic leasing)
const pdfJobSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['document_extract', 'artifact_generate'],
    required: true,
    index: true
  },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PdfDocument', required: true, index: true },
  ownerKey: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'failed', 'dead'],
    default: 'queued',
    index: true
  },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  lockedAt: { type: Date, default: null },
  lockedBy: { type: String, default: null },
  lockExpiresAt: { type: Date, default: null, index: true },
  lastError: { type: String, default: null },
  idempotencyKey: { type: String, unique: true, sparse: true }
}, {
  timestamps: true,
  collection: 'pdf_processing_jobs'
});

pdfJobSchema.index({ status: 1, lockExpiresAt: 1, createdAt: 1 });

// 4. PDF Artifacts (Summary, Notes, Quiz)
const pdfArtifactSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PdfDocument', required: true, index: true },
  ownerKey: { type: String, required: true, index: true },
  kind: {
    type: String,
    enum: ['summary', 'notes', 'quiz'],
    required: true,
    index: true
  },
  engine: {
    type: String,
    enum: ['local', 'ai'],
    required: true
  },
  optionsHash: { type: String, required: true, index: true },
  options: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: {
    type: String,
    enum: ['pending', 'processing', 'ready', 'failed'],
    default: 'pending',
    index: true
  },
  error: { type: String, default: null },
  content: { type: mongoose.Schema.Types.Mixed, default: null }
}, {
  timestamps: true,
  collection: 'pdf_artifacts'
});

pdfArtifactSchema.index({ documentId: 1, kind: 1, optionsHash: 1 });

// 5. PDF Conversations & Messages (Q&A)
const pdfConversationSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PdfDocument', required: true, index: true },
  ownerKey: { type: String, required: true, index: true },
  title: { type: String, default: 'New Conversation' },
  messageCount: { type: Number, default: 0 },
  lastMessageAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'pdf_conversations'
});

const pdfChatMessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'PdfConversation', required: true, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PdfDocument', required: true, index: true },
  ownerKey: { type: String, required: true, index: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  citations: [{
    page: { type: Number },
    excerpt: { type: String }
  }],
  found: { type: Boolean, default: true },
  engine: { type: String, enum: ['local', 'ai'], default: 'local' },
  cached: { type: Boolean, default: false }
}, {
  timestamps: true,
  collection: 'pdf_chat_messages'
});

// 6. Usage & Quotas (Atomic daily counters)
const pdfUsageCounterSchema = new mongoose.Schema({
  ownerKey: { type: String, required: true },
  period: { type: String, required: true }, // 'YYYY-MM-DD'
  uploads: { type: Number, default: 0 },
  aiRequests: { type: Number, default: 0 },
  ocrPages: { type: Number, default: 0 }
}, {
  timestamps: true,
  collection: 'pdf_usage_counters'
});

pdfUsageCounterSchema.index({ ownerKey: 1, period: 1 }, { unique: true });

// 7. Usage & Cost Analytics Log (No sensitive text contents logged)
const pdfUsageLogSchema = new mongoose.Schema({
  ownerKey: { type: String, required: true, index: true },
  action: { type: String, required: true, index: true }, // 'upload', 'extract', 'summary', 'chat', 'quiz', 'notes'
  engine: { type: String, default: 'local' },
  tokensIn: { type: Number, default: 0 },
  tokensOut: { type: Number, default: 0 },
  costUsd: { type: Number, default: 0 },
  durationMs: { type: Number, default: 0 },
  success: { type: Boolean, default: true },
  errorCode: { type: String, default: null }
}, {
  timestamps: true,
  collection: 'pdf_usage_logs'
});

pdfUsageLogSchema.index({ createdAt: -1 });

// 8. User Preferences
const pdfUserPrefSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  retentionDays: { type: Number, default: 30 },
  aiConsent: { type: Boolean, default: false }
}, {
  timestamps: true,
  collection: 'pdf_user_prefs'
});

// 9. Billing Waitlist & Subscription
const pdfBillingInterestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  email: { type: String, required: true },
  plan: { type: String, default: 'premium' },
  billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  note: { type: String, default: '' }
}, {
  timestamps: true,
  collection: 'pdf_billing_interest'
});

const pdfSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  plan: { type: String, default: 'free' },
  status: { type: String, enum: ['active', 'canceled', 'expired', 'trialing'], default: 'active' },
  currentPeriodEnd: { type: Date, default: null },
  provider: { type: String, default: 'manual' }, // 'razorpay', 'manual'
  subscriptionId: { type: String, default: null }
}, {
  timestamps: true,
  collection: 'pdf_subscriptions'
});

const PdfDocument = mongoose.models.PdfDocument || mongoose.model('PdfDocument', pdfDocumentSchema);
const PdfDocumentPage = mongoose.models.PdfDocumentPage || mongoose.model('PdfDocumentPage', pdfDocumentPageSchema);
const PdfJob = mongoose.models.PdfJob || mongoose.model('PdfJob', pdfJobSchema);
const PdfArtifact = mongoose.models.PdfArtifact || mongoose.model('PdfArtifact', pdfArtifactSchema);
const PdfConversation = mongoose.models.PdfConversation || mongoose.model('PdfConversation', pdfConversationSchema);
const PdfChatMessage = mongoose.models.PdfChatMessage || mongoose.model('PdfChatMessage', pdfChatMessageSchema);
const PdfUsageCounter = mongoose.models.PdfUsageCounter || mongoose.model('PdfUsageCounter', pdfUsageCounterSchema);
const PdfUsageLog = mongoose.models.PdfUsageLog || mongoose.model('PdfUsageLog', pdfUsageLogSchema);
const PdfUserPref = mongoose.models.PdfUserPref || mongoose.model('PdfUserPref', pdfUserPrefSchema);
const PdfBillingInterest = mongoose.models.PdfBillingInterest || mongoose.model('PdfBillingInterest', pdfBillingInterestSchema);
const PdfSubscription = mongoose.models.PdfSubscription || mongoose.model('PdfSubscription', pdfSubscriptionSchema);

module.exports = {
  PdfDocument,
  PdfDocumentPage,
  PdfJob,
  PdfArtifact,
  PdfConversation,
  PdfChatMessage,
  PdfUsageCounter,
  PdfUsageLog,
  PdfUserPref,
  PdfBillingInterest,
  PdfSubscription
};
