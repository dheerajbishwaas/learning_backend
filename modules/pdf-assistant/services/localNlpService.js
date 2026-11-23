// d:\NODEJS\tutohub\learning_backend\modules\pdf-assistant\services\localNlpService.js
'use strict';

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can\'t', 'cannot', 'could',
  'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s',
  'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m',
  'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t',
  'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t',
  'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
  'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t',
  'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s',
  'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself',
  'yourselves'
]);

class LocalNlpService {
  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w));
  }

  splitIntoSentences(text) {
    if (!text) return [];
    // Sentence splitting avoiding periods inside acronyms or decimals
    const raw = text.split(/(?<=[.?!])\s+(?=[A-Z0-9])/);
    return raw
      .map(s => s.trim())
      .filter(s => s.length >= 25 && s.length <= 400 && s.split(/\s+/).length >= 5);
  }

  computeTfIdf(sentences) {
    const docCount = sentences.length;
    if (docCount === 0) return [];

    const tfMap = [];
    const dfMap = {};

    sentences.forEach((sent, idx) => {
      const tokens = this.tokenize(sent);
      const counts = {};
      const uniqueTokens = new Set(tokens);
      
      tokens.forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
      });
      tfMap.push({ counts, total: tokens.length });

      uniqueTokens.forEach(t => {
        dfMap[t] = (dfMap[t] || 0) + 1;
      });
    });

    const scores = sentences.map((sent, idx) => {
      const tf = tfMap[idx];
      if (tf.total === 0) return 0;
      let score = 0;
      for (const [token, count] of Object.entries(tf.counts)) {
        const idf = Math.log((docCount + 1) / (dfMap[token] + 1)) + 1;
        score += (count / tf.total) * idf;
      }
      return score;
    });

    return scores;
  }

  extractKeyTopics(pages, topN = 5) {
    const wordFreq = {};
    pages.forEach(p => {
      const tokens = this.tokenize(p.text);
      tokens.forEach(t => {
        wordFreq[t] = (wordFreq[t] || 0) + 1;
      });
    });

    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word]) => word);
  }

  // Generate structured summary (Concise vs Detailed)
  generateSummary(pages, mode = 'concise') {
    const allSentencesWithPage = [];
    pages.forEach(p => {
      const sents = this.splitIntoSentences(p.text);
      sents.forEach(s => {
        allSentencesWithPage.push({ text: s, page: p.pageNumber });
      });
    });

    if (allSentencesWithPage.length === 0) {
      return {
        mode,
        overview: 'No readable text content extracted from document.',
        keyPoints: [],
        sections: [],
        definitions: [],
        topics: [],
        stats: { sentenceCount: 0, wordCount: 0, compressionRatio: 0 }
      };
    }

    const sentences = allSentencesWithPage.map(s => s.text);
    const scores = this.computeTfIdf(sentences);

    // Rank sentences
    const ranked = allSentencesWithPage
      .map((item, idx) => ({ ...item, score: scores[idx] }))
      .sort((a, b) => b.score - a.score);

    const targetCount = mode === 'concise' ? Math.min(5, ranked.length) : Math.min(12, ranked.length);
    const topSentences = ranked.slice(0, targetCount).sort((a, b) => a.page - b.page);

    const overview = topSentences.slice(0, Math.min(3, topSentences.length)).map(s => s.text).join(' ');
    const keyPoints = topSentences.map(s => ({ text: s.text, page: s.page }));

    // Extract Definitions pattern: "X is defined as...", "X refers to..."
    const definitions = [];
    allSentencesWithPage.forEach(item => {
      const match = item.text.match(/^([A-Z][a-zA-Z\s]{2,30})\s+(is defined as|refers to|is a|means)\s+(.+)$/i);
      if (match && definitions.length < 6) {
        definitions.push({
          term: match[1].trim(),
          definition: match[3].trim(),
          page: item.page
        });
      }
    });

    // Chunk sections by page blocks
    const sections = [];
    const pageSize = Math.max(1, Math.ceil(pages.length / 4));
    for (let i = 0; i < pages.length; i += pageSize) {
      const pageSlice = pages.slice(i, i + pageSize);
      const startP = pageSlice[0].pageNumber;
      const endP = pageSlice[pageSlice.length - 1].pageNumber;
      const secSents = allSentencesWithPage.filter(s => s.page >= startP && s.page <= endP);
      const topSec = secSents.sort((a, b) => (scores[sentences.indexOf(b.text)] || 0) - (scores[sentences.indexOf(a.text)] || 0))[0];
      
      if (topSec) {
        sections.push({
          title: `Section (Pages ${startP}–${endP})`,
          pageStart: startP,
          pageEnd: endP,
          summary: topSec.text,
          keyPoints: [{ text: topSec.text, page: topSec.page }]
        });
      }
    }

    const topics = this.extractKeyTopics(pages, 6).map((term, i) => ({ term, weight: Number((1 - (i * 0.1)).toFixed(2)) }));

    return {
      mode,
      overview,
      keyPoints,
      sections,
      definitions,
      topics,
      stats: {
        sentenceCount: sentences.length,
        wordCount: overview.split(/\s+/).length,
        compressionRatio: Number((topSentences.length / (sentences.length || 1)).toFixed(3))
      }
    };
  }

  // Generate structured Notes
  generateNotes(pages, style = 'structured') {
    const summary = this.generateSummary(pages, 'detailed');
    
    const sections = summary.sections.map((sec, idx) => ({
      heading: sec.title,
      pageStart: sec.pageStart,
      pageEnd: sec.pageEnd,
      points: sec.keyPoints,
      subsections: [
        {
          heading: 'Core Concept',
          points: [{ text: sec.summary, page: sec.pageStart }]
        }
      ]
    }));

    const revisionPoints = summary.keyPoints.slice(0, 8);

    let markdown = `# Document Notes\n\n## Overview\n${summary.overview}\n\n`;
    sections.forEach(s => {
      markdown += `### ${s.heading}\n`;
      s.points.forEach(p => {
        markdown += `- ${p.text} *(Page ${p.page})*\n`;
      });
      markdown += '\n';
    });
    if (summary.definitions.length > 0) {
      markdown += `## Key Definitions\n`;
      summary.definitions.forEach(d => {
        markdown += `- **${d.term}**: ${d.definition} *(Page ${d.page})*\n`;
      });
      markdown += '\n';
    }
    markdown += `## Quick Revision Points\n`;
    revisionPoints.forEach((r, idx) => {
      markdown += `${idx + 1}. ${r.text} *(Page ${r.page})*\n`;
    });

    return {
      title: 'Structured Document Notes',
      sections,
      definitions: summary.definitions,
      revision: revisionPoints,
      markdown
    };
  }

  // Generate Quiz & MCQs
  generateQuiz(pages, options = {}) {
    const count = Math.min(options.count || 5, 20);
    const difficulty = options.difficulty || 'medium';
    const allSentencesWithPage = [];

    pages.forEach(p => {
      const sents = this.splitIntoSentences(p.text);
      sents.forEach(s => {
        allSentencesWithPage.push({ text: s, page: p.pageNumber });
      });
    });

    const questions = [];
    const usedPages = new Set();

    for (let i = 0; i < allSentencesWithPage.length && questions.length < count; i++) {
      const item = allSentencesWithPage[i];
      const words = item.text.split(/\s+/);
      if (words.length < 8) continue;

      // Extract a key noun/token to form a fill-in/MCQ
      const tokens = this.tokenize(item.text);
      if (tokens.length < 3) continue;
      const keyToken = tokens[0];

      const questionPrompt = item.text.replace(new RegExp(`\\b${keyToken}\\b`, 'i'), '_______');
      if (questionPrompt === item.text) continue;

      const distractorPool = ['system', 'process', 'protocol', 'function', 'variable', 'structure', 'element', 'module', 'data', 'network'];
      const filteredDistractors = distractorPool.filter(d => d.toLowerCase() !== keyToken.toLowerCase()).slice(0, 3);
      const optionsArray = [keyToken, ...filteredDistractors].sort(() => Math.random() - 0.5);
      const answerIndex = optionsArray.indexOf(keyToken);

      questions.push({
        id: `q_${questions.length + 1}`,
        type: 'mcq',
        difficulty,
        question: `According to the document: "${questionPrompt}" - What completes the blank?`,
        options: optionsArray,
        answerIndex,
        answer: keyToken,
        explanation: `As stated on page ${item.page}: "${item.text}"`,
        pages: [item.page]
      });
    }

    return {
      difficulty,
      questions
    };
  }

  // BM25 Retrieval for local Q&A without AI
  searchPassages(pages, query, topK = 4) {
    const qTokens = this.tokenize(query);
    if (qTokens.length === 0) return [];

    const passages = [];
    pages.forEach(p => {
      const sents = this.splitIntoSentences(p.text);
      sents.forEach(s => {
        passages.push({ text: s, page: p.pageNumber });
      });
    });

    const scored = passages.map(pass => {
      const passTokens = this.tokenize(pass.text);
      let matchCount = 0;
      qTokens.forEach(qt => {
        if (passTokens.includes(qt)) matchCount += 2;
        else if (pass.text.toLowerCase().includes(qt)) matchCount += 1;
      });
      return { ...pass, score: matchCount };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

module.exports = new LocalNlpService();
