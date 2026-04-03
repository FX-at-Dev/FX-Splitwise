const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getProfile } = require('../controllers/authController');
const { getDashboardSummary } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/profile', protect, getProfile);
router.get('/profile/summary', protect, getDashboardSummary);

module.exports = router;