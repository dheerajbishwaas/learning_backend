const axios = require('axios');
require('dotenv').config();

async function checkApiKey() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error("No API key found in .env");
        return;
    }

    console.log(`Using API Key: ${apiKey.substring(0, 5)}...`);

    try {
        // Try to list models directly via REST API
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        console.log("Available Models from REST API:");
        response.data.models.forEach(m => {
            console.log(`${m.name} (Methods: ${m.supportedGenerationMethods.join(', ')})`);
        });
    } catch (error) {
        if (error.response) {
            console.error("REST API Error:", error.response.status, error.response.statusText);
            console.error("Error Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Error:", error.message);
        }
    }
}

checkApiKey();
