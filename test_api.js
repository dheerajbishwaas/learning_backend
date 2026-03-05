const axios = require('axios');

async function testGenerate() {
    try {
        const response = await axios.post('http://127.0.0.1:5000/api/questions/generate', {
            category: "Aptitude & IQ",
            subCategories: "Pattern",
            playModes: "Solo",
            difficulty: "Beginner",
            question_length: 2,
            name: "Test IQ Quiz"
        });

        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        if (error.response) {
            console.error('Error Status:', error.response.status);
            console.error('Error Data:', error.response.data);
        } else {
            console.error('Error Message:', error.message);
        }
    }
}

testGenerate();
