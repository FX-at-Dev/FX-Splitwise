const ActivityLog = require('../models/ActivityLog');

const getActivityLogs = async (req, res) => {
  try {
    const activityLogs = await ActivityLog.find({ actor: req.user._id }).sort({ createdAt: -1 }).limit(20);
    return res.status(200).json({ activityLogs });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch activity logs', error: error.message });
  }
};

module.exports = {
  getActivityLogs,
};