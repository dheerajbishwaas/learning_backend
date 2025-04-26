const User = require('../models/userModel');

// Sample controller function
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();

    res.status(200).json({'msg':'Hello it wor '});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getAllUsers };