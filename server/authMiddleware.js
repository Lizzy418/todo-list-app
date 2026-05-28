const jwt = require('jsonwebtoken');

const createAuthMiddleware = (db, jwtSecret) => async (req, res, next) => {
  const authHeader = req.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await db.findUserById(payload.sub);

    if (!user) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    req.user = {
      id: user.id,
      email: user.email
    };

    return next();
  } catch {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }
};

module.exports = {
  createAuthMiddleware
};
