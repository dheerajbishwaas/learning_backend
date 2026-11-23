// d:\NODEJS\tutohub\learning_backend\modules\pdf-assistant\services\ocrService.js
'use strict';

const tesseract = require('tesseract.js');

class OcrService {
  async recognizeBuffer(imageBuffer) {
    try {
      const { data: { text } } = await tesseract.recognize(imageBuffer, 'eng', {
        logger: () => {} // silent
      });
      return text ? text.replace(/\s+/g, ' ').trim() : '';
    } catch (err) {
      console.error('Tesseract OCR error:', err.message);
      return '';
    }
  }
}

module.exports = new OcrService();
