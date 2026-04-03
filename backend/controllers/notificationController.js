const Notification = require('../models/Notification');

const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id }).sort({ date: -1 });

    return res.status(200).json({ notifications });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
  }
};

module.exports = {
  getNotifications,
};