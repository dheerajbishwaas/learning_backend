// d:\NODEJS\tutohub\learning_backend\modules\pdf-assistant\config\plans.js
'use strict';

const PLANS = {
  guest: {
    id: 'guest',
    label: 'Guest',
    priceDisplay: 'Free',
    available: true,
    highlights: [
      '2 PDF uploads per day',
      'Max 10 MB file size',
      'Up to 50 pages per document',
      'Local extractive summarizer & notes',
      'Document search',
      'Temporary 24h retention'
    ],
    limits: {
      uploadsPerDay: 2,
      maxFileSizeMb: 10,
      maxPages: 50,
      storageMb: 50,
      retentionDays: 1, // 24 hours
      aiRequestsPerDay: 0,
      ocrPagesPerDay: 0,
      quizMaxQuestions: 5,
      maxChatMessagesPerConversation: 10
    },
    features: {
      aiChat: false,
      aiSummary: false,
      aiNotes: false,
      aiQuiz: false,
      ocr: false,
      crossDocumentSearch: false,
      documentHistory: false,
      exportMarkdown: true,
      exportDocx: false,
      compare: false,
      savedConversations: false
    }
  },
  free: {
    id: 'free',
    label: 'Free',
    priceDisplay: '₹0 / mo',
    available: true,
    highlights: [
      '5 PDF uploads per day',
      'Max 25 MB file size',
      'Up to 150 pages per document',
      '200 MB storage & 30-day history',
      'Local summaries, notes & quizzes',
      '10 AI Q&A requests per day',
      'Basic OCR up to 10 pages/day',
      'Cross-document full text search'
    ],
    limits: {
      uploadsPerDay: 5,
      maxFileSizeMb: 25,
      maxPages: 150,
      storageMb: 200,
      retentionDays: 30,
      aiRequestsPerDay: 10,
      ocrPagesPerDay: 10,
      quizMaxQuestions: 10,
      maxChatMessagesPerConversation: 30
    },
    features: {
      aiChat: true,
      aiSummary: false,
      aiNotes: false,
      aiQuiz: false,
      ocr: true,
      crossDocumentSearch: true,
      documentHistory: true,
      exportMarkdown: true,
      exportDocx: false,
      compare: false,
      savedConversations: true
    }
  },
  premium: {
    id: 'premium',
    label: 'Pro Premium',
    priceDisplay: '₹499 / mo',
    priceMonthlyInr: 499,
    priceYearlyInr: 4990,
    available: false, // Waitlist mode until billing activated
    highlights: [
      'Unlimited daily uploads (fair use 50/day)',
      'Max 100 MB file size',
      'Up to 1,000 pages per document',
      '5 GB secure cloud storage',
      'Unlimited retention & permanent history',
      '150 AI Requests per day with Gemini Flash',
      'AI-powered structured summaries & chapter breakdown',
      'Advanced AI notes with key definitions & revision mode',
      'AI Quiz & MCQ generator with explanations',
      'Full OCR on scanned documents (100 pages/day)',
      'Multi-document comparison (coming soon)',
      'Priority queue processing'
    ],
    limits: {
      uploadsPerDay: 50,
      maxFileSizeMb: 100,
      maxPages: 1000,
      storageMb: 5000,
      retentionDays: 3650, // 10 years
      aiRequestsPerDay: 150,
      ocrPagesPerDay: 100,
      quizMaxQuestions: 30,
      maxChatMessagesPerConversation: 100
    },
    features: {
      aiChat: true,
      aiSummary: true,
      aiNotes: true,
      aiQuiz: true,
      ocr: true,
      crossDocumentSearch: true,
      documentHistory: true,
      exportMarkdown: true,
      exportDocx: true,
      compare: true,
      savedConversations: true
    }
  }
};

function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

function getAllPlans() {
  return Object.values(PLANS);
}

module.exports = {
  PLANS,
  getPlan,
  getAllPlans
};
