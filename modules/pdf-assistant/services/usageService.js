// d:\NODEJS\tutohub\learning_backend\modules\pdf-assistant\services\usageService.js
'use strict';

const { PdfUsageCounter, PdfSubscription, PdfDocument } = require('../models');
const { getPlan } = require('../config/plans');

class UsageService {
  getTodayPeriod() {
    return new Date().toISOString().slice(0, 10);
  }

  async resolvePlan(ownerKey, userId) {
    if (ownerKey.startsWith('g:')) {
      return getPlan('guest');
    }
    if (userId) {
      const sub = await PdfSubscription.findOne({ userId, status: 'active' });
      if (sub && sub.plan === 'premium') {
        if (!sub.currentPeriodEnd || sub.currentPeriodEnd > new Date()) {
          return getPlan('premium');
        }
      }
    }
    return getPlan('free');
  }

  async getUsage(ownerKey) {
    const period = this.getTodayPeriod();
    const counter = await PdfUsageCounter.findOne({ ownerKey, period });
    return {
      period,
      uploads: counter?.uploads || 0,
      aiRequests: counter?.aiRequests || 0,
      ocrPages: counter?.ocrPages || 0
    };
  }

  async checkAndIncrement(ownerKey, metric, amount = 1, plan) {
    const period = this.getTodayPeriod();
    const limitMap = {
      uploads: plan.limits.uploadsPerDay,
      aiRequests: plan.limits.aiRequestsPerDay,
      ocrPages: plan.limits.ocrPagesPerDay
    };
    const maxLimit = limitMap[metric] !== undefined ? limitMap[metric] : 0;

    const currentUsage = await this.getUsage(ownerKey);
    const used = currentUsage[metric];

    if (used + amount > maxLimit) {
      const resetAt = new Date();
      resetAt.setHours(24, 0, 0, 0);
      throw {
        code: 'QUOTA_EXCEEDED',
        message: `Daily quota of ${maxLimit} ${metric} exceeded for plan ${plan.label}.`,
        details: { metric, limit: maxLimit, used, resetAt: resetAt.toISOString() }
      };
    }

    await PdfUsageCounter.findOneAndUpdate(
      { ownerKey, period },
      { $inc: { [metric]: amount } },
      { upsert: true, new: true }
    );
  }

  async getStorageStats(ownerKey) {
    const docs = await PdfDocument.find({ ownerKey });
    let usedBytes = 0;
    docs.forEach(d => {
      usedBytes += (d.sizeBytes || 0);
    });
    return {
      documentCount: docs.length,
      usedBytes,
      usedMb: Number((usedBytes / (1024 * 1024)).toFixed(2))
    };
  }

  async checkStorageQuota(ownerKey, additionalBytes, plan) {
    const storageStats = await this.getStorageStats(ownerKey);
    const maxBytes = plan.limits.storageMb * 1024 * 1024;

    if (storageStats.usedBytes + additionalBytes > maxBytes) {
      throw {
        code: 'STORAGE_QUOTA_EXCEEDED',
        message: `Storage quota of ${plan.limits.storageMb} MB exceeded.`,
        details: { limitBytes: maxBytes, usedBytes: storageStats.usedBytes }
      };
    }
  }
}

module.exports = new UsageService();
