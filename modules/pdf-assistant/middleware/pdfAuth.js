// d:\NODEJS\tutohub\learning_backend\modules\pdf-assistant\middleware\pdfAuth.js
'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../../models/userModel');
const { PdfUserPref } = require('../models');
const usageService = require('../services/usageService');

const GUEST_TOKEN_SECRET = process.env.JWT_SECRET || 'tutohub_guest_secret';

const resolveActor = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const guestHeader = req.headers['x-guest-token'];

  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 1. Check Bearer Token (Registered User)
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_INVALID', message: 'User account no longer exists' }
        });
      }
      if (user.status !== 1) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_INACTIVE', message: 'Account has been deactivated' }
        });
      }

      const prefs = await PdfUserPref.findOne({ userId: user._id });

      req.actor = {
        type: 'user',
        id: String(user._id),
        user,
        isAdmin: String(user.role) === '1',
        ownerKey: `u:${user._id}`,
        preferences: prefs || { retentionDays: 30, aiConsent: false }
      };

      req.plan = await usageService.resolvePlan(req.actor.ownerKey, user._id);
      return next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_INVALID', message: 'Session token has expired or is invalid' }
      });
    }
  }

  // 2. Check Guest Token
  if (guestHeader) {
    try {
      const decoded = jwt.verify(guestHeader, GUEST_TOKEN_SECRET);
      if (decoded.type === 'guest' && decoded.guestId) {
        req.actor = {
          type: 'guest',
          id: decoded.guestId,
          guestId: decoded.guestId,
          isAdmin: false,
          ownerKey: `g:${decoded.guestId}`,
          preferences: null
        };
        req.plan = await usageService.resolvePlan(req.actor.ownerKey, null);
        return next();
      }
    } catch (err) {
      // Invalid guest token, will require session creation
    }
  }

  // Unauthenticated actor
  req.actor = null;
  req.plan = null;
  next();
};

const requireActor = (req, res, next) => {
  if (!req.actor) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Authentication or Guest session required' }
    });
  }
  next();
};

const requireUser = (req, res, next) => {
  if (!req.actor || req.actor.type !== 'user') {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'This action requires a registered TutoHub account' }
    });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.actor || req.actor.type !== 'user' || !req.actor.isAdmin) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Administrator privileges required' }
    });
  }
  next();
};

module.exports = {
  resolveActor,
  requireActor,
  requireUser,
  requireAdmin,
  GUEST_TOKEN_SECRET
};
