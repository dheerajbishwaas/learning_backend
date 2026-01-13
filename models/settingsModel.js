const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    siteName: {
        type: String,
        required: true,
        default: 'My Website'
    },
    contactEmail: {
        type: String,
        required: true,
        default: 'contact@example.com'
    },
    supportPhone: {
        type: String,
        required: true,
        default: '+1234567890'
    },
    maintenanceMode: {
        type: Boolean,
        default: false
    },
    geminiApiKey: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
