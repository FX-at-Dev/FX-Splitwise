const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getNotifications } = require('../controllers/notificationController');

const router = express.Router();

router.get('/notifications', protect, getNotifications);

module.exports = router;