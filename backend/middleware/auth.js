const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'faceaura_super_secret_key_123';

function auth(req, res, next) {
  const authHeader = req.header('Authorization');
  
  if (!authHeader) {
    return res.status(401).json({ error: 'No token, authorization denied' });
  }

  // Expecting format: "Bearer <token>"
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Invalid token format, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id: userId, iat, exp }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
}

module.exports = { auth, JWT_SECRET };
