const axios = require('axios');
const mongoose = require('mongoose');
const Question = require("../models/questionModel");

const generateQuestions = async (req, res) => {
    try {
        const { category, subCategories, playModes, difficulty, question_length, name } = req.body;

        if (!category || !subCategories || !difficulty || !question_length) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        const model = "gemini-flash-latest";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const prompt = `Generate ${question_length} ${difficulty} level multiple choice questions for category "${category}" and sub-category "${subCategories}".
The play mode is "${playModes}".
Return the response ONLY as a JSON array of objects with the following structure:
[{
  "question": "string",
  "options": { "a": "string", "b": "string", "c": "string", "d": "string" },
  "answer": "string (key from options, e.g., 'a')"
}]
Important: Do not include any markdown formatting, backticks, or "json" label. Just the raw JSON array.`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: prompt }
                    ]
                }
            ]
        };

        const result = await axios.post(url, requestBody);

        if (!result.data || !result.data.candidates || !result.data.candidates[0].content) {
            throw new Error("Invalid response from Gemini API");
        }

        let text = result.data.candidates[0].content.parts[0].text;

        // Clean up response if it contains markdown code blocks
        text = text.replace(/```json|```/g, "").trim();

        let questions;
        try {
            questions = JSON.parse(text);
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError, "Response Text:", text);
            return res.status(500).json({ message: "Error parsing AI response", error: parseError.message });
        }

        const newQuestionGroup = new Question({
            name: name || `${category} - ${subCategories}`,
            questions_ans: questions,
            user_question_select_type: {
                category,
                subCategories,
                playModes,
                difficulty,
                question_length
            }
        });

        await newQuestionGroup.save();

        res.status(201).json({
            message: "Questions generated successfully",
            data: newQuestionGroup
        });

    } catch (error) {
        console.error("Generation Error:", error.response ? error.response.data : error.message);
        res.status(500).json({
            message: "Failed to generate questions",
            error: error.response ? error.response.data : error.message
        });
    }
};

const getQuestionByGroupId = async (req, res) => {
    try {
        const { group_id } = req.query;

        if (!group_id) {
            return res.status(400).json({ message: "group_id is required" });
        }

        if (!mongoose.Types.ObjectId.isValid(group_id)) {
            return res.status(400).json({ message: "Invalid group_id format" });
        }

        const questionGroup = await Question.findById(group_id);

        if (!questionGroup) {
            return res.status(404).json({ message: "Question group not found" });
        }

        res.status(200).json({
            message: "Question group fetched successfully",
            data: questionGroup
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch question group",
            error: error.message
        });
    }
};

const getUsersByGroupScore = async (req, res) => {
    try {
        const { group_id } = req.query;

        if (!group_id) {
            return res.status(400).json({ message: "group_id is required" });
        }

        if (!mongoose.Types.ObjectId.isValid(group_id)) {
            return res.status(400).json({ message: "Invalid group_id format" });
        }

        const UserAnswer = require("../models/userAnswerModel");

        const usersWithScores = await UserAnswer.aggregate([
            { $match: { group_id: new mongoose.Types.ObjectId(group_id) } },
            { $group: { _id: "$userid", totalScore: { $sum: "$score" } } },
            { $sort: { totalScore: -1 } },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            {
                $project: {
                    user: {
                        _id: 1,
                        name: 1,
                        email: 1
                    },
                    totalScore: 1
                }
            }
        ]);

        res.status(200).json({
            message: "Users fetched successfully",
            data: usersWithScores
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch users",
            error: error.message
        });
    }
};

const getRecentGroupsWithUserCount = async (req, res) => {
    try {
        const UserAnswer = require("../models/userAnswerModel");

        const recentGroups = await UserAnswer.aggregate([
            {
                $group: {
                    _id: "$group_id",
                    userCount: { $addToSet: "$userid" }
                }
            },
            {
                $addFields: {
                    userCount: { $size: "$userCount" }
                }
            },
            {
                $lookup: {
                    from: "questions",
                    localField: "_id",
                    foreignField: "_id",
                    as: "group"
                }
            },
            { $unwind: "$group" },
            { $sort: { "group.createdAt": -1 } },
            { $limit: 10 },
            {
                $project: {
                    group: {
                        _id: 1,
                        name: 1,
                        createdAt: 1
                    },
                    userCount: 1
                }
            }
        ]);

        res.status(200).json({
            message: "Recent groups fetched successfully",
            data: recentGroups
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch recent groups",
            error: error.message
        });
    }
};

module.exports = {
    generateQuestions,
    getQuestionByGroupId,
    getUsersByGroupScore,
    getRecentGroupsWithUserCount,
};
