const { INDICES, getUniqueUniverse } = require('../config/marketUniverse');

const getUniverse = async (req, res) => {
  try {
    const list = getUniqueUniverse();
    return res.json({ success: true, data: { indices: INDICES, universe: list } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load universe' });
  }
};

module.exports = { getUniverse };
