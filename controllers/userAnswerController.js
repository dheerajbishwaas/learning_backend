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

const getCurrentWeekRange = () => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay(); // 0 (Sun) - 6 (Sat)
    const diffToMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diffToMonday);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return { start, end };
};

const getWeeklyTopLeaderboard = async (req, res) => {
    try {
        const { start, end } = getCurrentWeekRange();

        const weeklyGrouped = await UserAnswer.aggregate([
            { $match: { createdAt: { $gte: start, $lt: end } } },
            {
                $group: {
                    _id: "$userid",
                    totalScore: { $sum: "$score" },
                    lastPlayedAt: { $max: "$createdAt" },
                }
            },
            { $sort: { totalScore: -1, lastPlayedAt: 1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user",
                }
            },
            { $unwind: "$user" },
            {
                $project: {
                    _id: 0,
                    userId: "$user._id",
                    name: "$user.name",
                    username: "$user.username",
                    score: "$totalScore",
                    lastPlayedAt: 1,
                }
            }
        ]);

        const leaderboard = weeklyGrouped.map((item, index) => ({
            rank: index + 1,
            ...item,
        }));

        let currentUserRank = null;

        if (req.user?._id) {
            const currentUserGrouped = await UserAnswer.aggregate([
                { $match: { createdAt: { $gte: start, $lt: end }, userid: req.user._id } },
                {
                    $group: {
                        _id: "$userid",
                        totalScore: { $sum: "$score" },
                        lastPlayedAt: { $max: "$createdAt" },
                    }
                }
            ]);

            if (currentUserGrouped.length > 0) {
                const currentUserScore = currentUserGrouped[0].totalScore;

                const higherScoreCount = await UserAnswer.aggregate([
                    { $match: { createdAt: { $gte: start, $lt: end } } },
                    {
                        $group: {
                            _id: "$userid",
                            totalScore: { $sum: "$score" },
                        }
                    },
                    { $match: { totalScore: { $gt: currentUserScore } } },
                    { $count: "count" }
                ]);

                const count = higherScoreCount[0]?.count || 0;
                currentUserRank = {
                    userId: req.user._id,
                    name: req.user.name,
                    username: req.user.username,
                    score: currentUserScore,
                    rank: count + 1,
                };
            }
        }

        return res.status(200).json({
            message: "Weekly leaderboard fetched successfully",
            weekRange: { start, end },
            top5: leaderboard,
            currentUser: currentUserRank,
        });
    } catch (error) {
        console.error("getWeeklyTopLeaderboard error:", error);
        return res.status(500).json({
            message: "Failed to fetch weekly leaderboard",
            error: error.message,
        });
    }
};

const getRecentBattles = async (req, res) => {
    try {
        const recentBattles = await UserAnswer.aggregate([
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "users",
                    localField: "userid",
                    foreignField: "_id",
                    as: "user",
                }
            },
            { $unwind: "$user" },
            {
                $lookup: {
                    from: "questions",
                    localField: "group_id",
                    foreignField: "_id",
                    as: "group",
                }
            },
            { $unwind: "$group" },
            {
                $project: {
                    _id: 0,
                    battleId: "$_id",
                    groupId: "$group._id",
                    groupName: "$group.name",
                    userId: "$user._id",
                    userName: "$user.name",
                    username: "$user.username",
                    score: 1,
                    playedAt: "$createdAt",
                }
            }
        ]);

        return res.status(200).json({
            message: "Recent battles fetched successfully",
            data: recentBattles,
        });
    } catch (error) {
        console.error("getRecentBattles error:", error);
        return res.status(500).json({
            message: "Failed to fetch recent battles",
            error: error.message,
        });
    }
};

module.exports = {
    storeUserAnswer,
    getWeeklyTopLeaderboard,
    getRecentBattles,
};
