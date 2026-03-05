const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listModels() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];

        for (const modelName of models) {
            try {
                console.log(`Testing ${modelName}...`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Return 'Hello World' if you can read this.");
                const response = await result.response;
                console.log(`SUCCESS with ${modelName}: ${response.text()}`);
                return;
            } catch (e) {
                console.log(`FAILED with ${modelName}: ${e.message}`);
            }
        }
    } catch (error) {
        console.error("Error testing models:", error);
    }
}

listModels();
