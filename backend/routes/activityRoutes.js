const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getActivityLogs } = require('../controllers/activityController');

const router = express.Router();

router.get('/activity/logs', protect, getActivityLogs);

module.exports = router;