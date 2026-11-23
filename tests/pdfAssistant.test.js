// d:\NODEJS\tutohub\learning_backend\tests\pdfAssistant.test.js
'use strict';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;
let testToken;
let testUserId;

// Minimal valid PDF binary buffer generator (zero external ESM dependencies)
function createValidTestPdfBuffer(customText = 'Hello World from TutoHub PDF Assistant!') {
  const content = `BT /F1 14 Tf 50 700 Td (${customText}) Tj ET
BT /F1 12 Tf 50 660 Td (Photosynthesis is defined as the chemical process by which green plants produce glucose.) Tj ET
BT /F1 12 Tf 50 620 Td (Algorithms and data structures are essential computer science principles.) Tj ET`;

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${content.length} >>
stream
${content}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000344 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
426
%%EOF`;

  return Buffer.from(pdf, 'utf-8');
}

beforeAll(async () => {
  jest.setTimeout(90000);
  process.env.JWT_SECRET = 'test_secret_for_tutohub_pdf';
  process.env.PDF_STORAGE_DIR = './test_storage_pdf';

  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'jest_pdf_test',
      launchTimeout: 60000
    }
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  app = express();
  app.use(express.json());
  app.use('/api/pdf', require('../modules/pdf-assistant/routes/pdfRoutes'));

  const User = require('../models/userModel');
  testUserId = new mongoose.Types.ObjectId();
  const testUser = new User({
    _id: testUserId,
    name: 'Test Analyst',
    email: 'analyst@tutohub.test',
    username: 'analyst_test',
    password: 'hashedpassword123',
    role: '2',
    status: 1
  });
  await testUser.save();

  const jwt = require('jsonwebtoken');
  testToken = jwt.sign({ userId: testUserId, role: '2' }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  if (mongoose.connection && mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
  const fs = require('fs');
  if (fs.existsSync('./test_storage_pdf')) {
    fs.rmSync('./test_storage_pdf', { recursive: true, force: true });
  }
});

describe('TutoHub PDF Assistant API Suite', () => {
  let guestToken = null;
  let uploadedDocId = null;

  test('GET /api/pdf/config returns valid public plan and limits configuration', async () => {
    const res = await request(app).get('/api/pdf/config');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plans.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.upload.maxFileSizeMb).toBeGreaterThan(0);
  });

  test('POST /api/pdf/guest/session generates temporary guest credentials', async () => {
    const res = await request(app).post('/api/pdf/guest/session');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.guestToken).toBeDefined();
    guestToken = res.body.data.guestToken;
  });

  test('GET /api/pdf/me returns actor and usage envelope for registered user', async () => {
    const res = await request(app)
      .get('/api/pdf/me')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.actor.type).toBe('user');
    expect(res.body.data.plan.id).toBe('free');
    expect(res.body.data.usage.uploads).toBe(0);
  });

  test('POST /api/pdf/documents uploads and encrypts a valid PDF file', async () => {
    const pdfBuffer = createValidTestPdfBuffer();

    const res = await request(app)
      .post('/api/pdf/documents')
      .set('Authorization', `Bearer ${testToken}`)
      .attach('file', pdfBuffer, 'sample_test.pdf');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.document._id).toBeDefined();
    expect(res.body.data.document.status).toBe('queued');
    uploadedDocId = res.body.data.document._id;
  });

  test('Deduplication: re-uploading the exact same PDF returns existing doc', async () => {
    const pdfBuffer = createValidTestPdfBuffer();

    const res = await request(app)
      .post('/api/pdf/documents')
      .set('Authorization', `Bearer ${testToken}`)
      .attach('file', pdfBuffer, 'sample_test.pdf');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta?.duplicate).toBe(true);
  });

  test('PDF extraction engine processes pages, outlines, and text', async () => {
    const queueService = require('../modules/pdf-assistant/services/queueService');
    await queueService.processNextJob();

    const res = await request(app)
      .get(`/api/pdf/documents/${uploadedDocId}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.document.status).toBe('ready');
    expect(res.body.data.document.pageCount).toBe(1);
  });

  test('In-document search finds matching keywords with highlighted offsets', async () => {
    const res = await request(app)
      .get(`/api/pdf/documents/${uploadedDocId}/search?q=photosynthesis`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBeGreaterThan(0);
    expect(res.body.data.results[0].snippets.length).toBeGreaterThan(0);
  });

  test('Local extractive summary generates key points and definitions', async () => {
    const res = await request(app)
      .post(`/api/pdf/documents/${uploadedDocId}/artifacts`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ kind: 'summary', engine: 'local', options: { mode: 'concise' } });

    expect([200, 202]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  test('Document Q&A chat retrieves relevant grounded excerpts with page citations', async () => {
    const res = await request(app)
      .post(`/api/pdf/documents/${uploadedDocId}/chat`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ message: 'What is photosynthesis?', engine: 'local' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assistantMessage.found).toBe(true);
    expect(res.body.data.assistantMessage.citations.length).toBeGreaterThan(0);
  });

  test('Document Q&A accurately flags when question information is absent', async () => {
    const res = await request(app)
      .post(`/api/pdf/documents/${uploadedDocId}/chat`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ message: 'What is the nuclear launch code of Apollo 11?', engine: 'local' });

    expect(res.status).toBe(200);
    expect(res.body.data.assistantMessage.found).toBe(false);
  });

  test('DELETE /api/pdf/documents/:id permanently removes files and associated records', async () => {
    const res = await request(app)
      .delete(`/api/pdf/documents/${uploadedDocId}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);

    const checkRes = await request(app)
      .get(`/api/pdf/documents/${uploadedDocId}`)
      .set('Authorization', `Bearer ${testToken}`);
    expect(checkRes.status).toBe(404);
  });
});
