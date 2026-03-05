const mongoose = require('mongoose');

const questionSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    questions_ans: {
        type: mongoose.Schema.Types.Mixed, // Can be string or JSON/Object
        required: true,
    },
    user_question_select_type: {
        type: mongoose.Schema.Types.Mixed, // JSON data type as requested
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: null,
    },
});

// Middleware to update the updatedAt field when document is updated
questionSchema.pre('save', function (next) {
    if (this.isModified()) {
        this.updatedAt = Date.now();
    }
    next();
});

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;
