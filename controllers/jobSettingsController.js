const JobSettings = require('../models/jobSettingsModel');

// Ensure only one settings document exists
const getOrCreateSettings = async () => {
    let settings = await JobSettings.findOne();
    if (!settings) {
        settings = new JobSettings({
            isEnabled: true,
            feeds: []
        });
        await settings.save();
    }
    return settings;
};

// Create or Init settings (If not exists)
const createJobSettings = async (req, res) => {
    try {
        const { isEnabled, feeds } = req.body;

        // Check if settings already exist
        const existingSettings = await JobSettings.findOne();
        if (existingSettings) {
            return res.status(400).json({ message: 'Job Settings already exist. Use update instead.' });
        }

        const newSettings = new JobSettings({
            isEnabled,
            feeds
        });

        await newSettings.save();
        res.status(201).json({ message: 'Job Settings created successfully', data: newSettings });

    } catch (error) {
        console.error('Error in createJobSettings:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get Settings
const getJobSettings = async (req, res) => {
    try {
        const settings = await getOrCreateSettings();
        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        console.error('Error in getJobSettings:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Update Settings (Global Switch or replace feeds)
const updateJobSettings = async (req, res) => {
    try {
        const { isEnabled, feeds } = req.body;
        const settings = await getOrCreateSettings();

        if (typeof isEnabled !== 'undefined') settings.isEnabled = isEnabled;
        if (feeds) settings.feeds = feeds;

        await settings.save();
        res.status(200).json({ message: 'Job Settings updated successfully', data: settings });
    } catch (error) {
        console.error('Error in updateJobSettings:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Add Feed
const addFeed = async (req, res) => {
    try {
        const { id, name, url, enabled } = req.body;
        if (!id || !name || !url) {
            return res.status(400).json({ message: 'ID, Name, and URL are required' });
        }

        const settings = await getOrCreateSettings();

        // Check for duplicate ID
        const feedExists = settings.feeds.find(f => f.id === id);
        if (feedExists) {
            return res.status(400).json({ message: 'Feed with this ID already exists' });
        }

        settings.feeds.push({ id, name, url, enabled: enabled !== undefined ? enabled : true });
        await settings.save();

        res.status(200).json({ message: 'Feed added successfully', data: settings });

    } catch (error) {
        console.error('Error in addFeed:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Update Feed
const updateFeed = async (req, res) => {
    try {
        const { feedId } = req.params;
        const { name, url, enabled } = req.body;

        const settings = await getOrCreateSettings();
        const feed = settings.feeds.find(f => f.id === feedId);

        if (!feed) {
            return res.status(404).json({ message: 'Feed not found' });
        }

        if (name) feed.name = name;
        if (url) feed.url = url;
        if (typeof enabled !== 'undefined') feed.enabled = enabled;

        await settings.save();
        res.status(200).json({ message: 'Feed updated successfully', data: settings });

    } catch (error) {
        console.error('Error in updateFeed:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Delete Feed
const deleteFeed = async (req, res) => {
    try {
        const { feedId } = req.params;
        const settings = await getOrCreateSettings();

        settings.feeds = settings.feeds.filter(f => f.id !== feedId);

        await settings.save();
        res.status(200).json({ message: 'Feed deleted successfully', data: settings });

    } catch (error) {
        console.error('Error in deleteFeed:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    createJobSettings,
    getJobSettings,
    updateJobSettings,
    addFeed,
    updateFeed,
    deleteFeed
};
