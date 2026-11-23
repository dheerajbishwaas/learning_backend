// d:\NODEJS\tutohub\learning_backend\modules\pdf-assistant\services\pdfExtractor.js
'use strict';

let cachedPdfJs = null;
async function getPdfJs() {
  if (!cachedPdfJs) {
    cachedPdfJs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return cachedPdfJs;
}

class PdfExtractor {
  async inspectAndExtract(buffer, options = {}) {
    const maxPages = options.maxPages || 500;
    
    // Validate magic bytes (%PDF-)
    if (buffer.length < 5 || buffer.toString('utf8', 0, 4) !== '%PDF') {
      throw { code: 'INVALID_FILE_TYPE', message: 'The uploaded file is not a valid PDF document.' };
    }

    // Check for high-risk PDF script patterns
    const rawString = buffer.toString('binary');
    const securityFlags = [];
    if (/(\/JavaScript|\/JS\b)/i.test(rawString)) securityFlags.push('javascript');
    if (/(\/EmbeddedFiles|\/EF\b)/i.test(rawString)) securityFlags.push('embedded_files');
    if (/(\/Launch\b)/i.test(rawString)) securityFlags.push('launch_action');
    if (/(\/OpenAction\b)/i.test(rawString)) securityFlags.push('open_action');

    const uint8Array = new Uint8Array(buffer);
    const pdfjsLib = await getPdfJs();
    let pdfDoc;

    try {
      const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        isEvalSupported: false,
        useSystemFonts: true
      });
      pdfDoc = await loadingTask.promise;
    } catch (err) {
      if (err.name === 'PasswordException' || /password|encrypt/i.test(err.message) || /(\/Encrypt\b)/i.test(rawString)) {
        throw { code: 'PDF_ENCRYPTED', message: 'This PDF is password-protected or encrypted. Please remove the password and re-upload.' };
      }
      throw { code: 'PDF_CORRUPTED', message: `Could not parse PDF: ${err.message || 'corrupted document'}` };
    }

    const totalPages = pdfDoc.numPages;
    if (totalPages === 0) {
      throw { code: 'PDF_EMPTY', message: 'The PDF has 0 pages.' };
    }
    if (totalPages > maxPages) {
      throw { 
        code: 'PDF_TOO_MANY_PAGES', 
        message: `Document has ${totalPages} pages, exceeding plan limit of ${maxPages} pages.`,
        details: { pageCount: totalPages, maxPages }
      };
    }

    // Extract metadata
    let metadataObj = {};
    try {
      const meta = await pdfDoc.getMetadata();
      const info = meta?.info || {};
      metadataObj = {
        title: info.Title || '',
        author: info.Author || '',
        subject: info.Subject || '',
        keywords: info.Keywords || '',
        creator: info.Creator || '',
        producer: info.Producer || '',
        creationDate: info.CreationDate ? new Date(info.CreationDate) : null,
        modDate: info.ModDate ? new Date(info.ModDate) : null,
        pdfVersion: meta?.version || '1.7'
      };
    } catch (e) {
      metadataObj = { pdfVersion: '1.7' };
    }

    // Extract outline / TOC
    let outlineList = [];
    try {
      const rawOutline = await pdfDoc.getOutline();
      if (Array.isArray(rawOutline)) {
        const processOutlineNode = async (nodes, level = 0) => {
          for (const node of nodes) {
            let pageNum = 1;
            if (node.dest) {
              try {
                let dest = node.dest;
                if (typeof dest === 'string') {
                  dest = await pdfDoc.getDestination(dest);
                }
                if (Array.isArray(dest) && dest[0]) {
                  const pageIndex = await pdfDoc.getPageIndex(dest[0]);
                  pageNum = pageIndex + 1;
                }
              } catch (destErr) {}
            }
            outlineList.push({
              title: node.title || 'Untitled Section',
              page: pageNum,
              level
            });
            if (node.items && node.items.length > 0) {
              await processOutlineNode(node.items, level + 1);
            }
          }
        };
        await processOutlineNode(rawOutline);
      }
    } catch (e) {}

    // Extract text per page
    const pages = [];
    let totalChars = 0;
    let totalWords = 0;
    let emptyPagesCount = 0;

    for (let p = 1; p <= totalPages; p++) {
      const page = await pdfDoc.getPage(p);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      const charCount = pageText.length;
      const words = pageText ? pageText.split(/\s+/).filter(Boolean) : [];
      const wordCount = words.length;

      if (charCount < 30) {
        emptyPagesCount++;
      }

      totalChars += charCount;
      totalWords += wordCount;

      pages.push({
        pageNumber: p,
        text: pageText,
        charCount,
        wordCount,
        hasOcr: false
      });
    }

    // If more than 60% of pages are essentially empty text, classify as Scanned
    const isScanned = (emptyPagesCount / totalPages) >= 0.6 && totalPages > 0;

    return {
      pageCount: totalPages,
      metadata: metadataObj,
      outline: outlineList,
      securityFlags,
      pages,
      isScanned,
      stats: {
        wordCount: totalWords,
        charCount: totalChars,
        readingMinutes: Math.ceil(totalWords / 200),
        emptyPages: emptyPagesCount
      }
    };
  }
}

module.exports = new PdfExtractor();
