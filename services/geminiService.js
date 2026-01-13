const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent';

const generateBlogPost = async (topic, apiKey) => {
  try {
    const promptTemplatePath = path.join(__dirname, 'blogPrompt.txt');
    let prompt = fs.readFileSync(promptTemplatePath, 'utf8');

    prompt = prompt.replace('{{topic}}', topic);

    // Add current date dynamically
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    prompt = prompt.replace(
      "Current date like 'Oct 24, 2025'",
      currentDate
    );

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${apiKey}`,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      }
    );

    const generatedText =
      response.data.candidates[0].content.parts[0].text;

    // Clean markdown if model returns ```json
    const cleanJson = generatedText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    return JSON.parse(cleanJson);

  } catch (error) {
    console.error(
      'Error generating blog post:',
      error.response ? error.response.data : error.message
    );

    const apiError =
      error.response?.data?.error?.message || error.message;

    throw new Error(`AI Generation Failed: ${apiError}`);
  }
};

module.exports = {
  generateBlogPost
};
