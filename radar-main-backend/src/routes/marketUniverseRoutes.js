const express = require('express');
const router = express.Router();
const { getUniverse } = require('../controllers/marketUniverseController');

router.get('/', getUniverse);

module.exports = router;
