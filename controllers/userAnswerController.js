const mongoose = require('mongoose');
const Question = require('../models/questionModel');
const UserAnswer = require('../models/userAnswerModel');

const storeUserAnswer = async (req, res) => {
    try {
        const { group_id, user_answers, score } = req.body;

        if (!group_id) {
            return res.status(400).json({ message: 'group_id is required' });
        }

        if (!mongoose.Types.ObjectId.isValid(group_id)) {
            return res.status(400).json({ message: 'Invalid group_id format' });
        }

        if (user_answers === undefined || user_answers === null) {
            return res.status(400).json({ message: 'user_answers is required' });
        }

        const questionGroup = await Question.findById(group_id).select('_id');
        if (!questionGroup) {
            return res.status(404).json({ message: 'Question group not found' });
        }

        const numericScore = Number(score);
        const safeScore = Number.isFinite(numericScore) ? numericScore : 0;

        // Keep one answer document per user per question group.
        const savedAnswer = await UserAnswer.findOneAndUpdate(
            { userid: req.user._id, group_id },
            {
                userid: req.user._id,
                group_id,
                user_answers,
                score: safeScore,
                updatedAt: Date.now(),
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        return res.status(201).json({
            message: 'User answer stored successfully',
            data: savedAnswer,
        });
    } catch (error) {
        console.error('storeUserAnswer error:', error);
        return res.status(500).json({
            message: 'Failed to store user answer',
            error: error.message,
        });
    }
};

module.exports = {
    storeUserAnswer,
};
