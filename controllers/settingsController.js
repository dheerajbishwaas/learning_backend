const Settings = require('../models/settingsModel');

// Helper function to get or create settings (singleton pattern)
const getOrCreateSettings = async () => {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = new Settings({
            siteName: 'My Website',
            contactEmail: 'contact@example.com',
            supportPhone: '+1234567890',
            maintenanceMode: false,
            geminiApiKey: ''
        });
        await settings.save();
    }
    return settings;
};

// Get Settings
const getSettings = async (req, res) => {
    try {
        const settings = await getOrCreateSettings();
        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        console.error('Error in getSettings:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Update Settings
const updateSettings = async (req, res) => {
    try {
        const { siteName, contactEmail, supportPhone, maintenanceMode, geminiApiKey } = req.body;
        const settings = await getOrCreateSettings();

        if (siteName !== undefined) settings.siteName = siteName;
        if (contactEmail !== undefined) settings.contactEmail = contactEmail;
        if (supportPhone !== undefined) settings.supportPhone = supportPhone;
        if (maintenanceMode !== undefined) settings.maintenanceMode = maintenanceMode;
        if (geminiApiKey !== undefined) settings.geminiApiKey = geminiApiKey;

        await settings.save();
        res.status(200).json({ message: 'Settings updated successfully', data: settings });
    } catch (error) {
        console.error('Error in updateSettings:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    getSettings,
    updateSettings
};
