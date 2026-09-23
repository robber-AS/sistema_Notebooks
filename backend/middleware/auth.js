const jwt = require('jsonwebtoken');

// Middleware que valida o token JWT
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token não informado.' });
  }

  const token = header.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Sessão expirada ou inválida. Faça login novamente.' });
  }
}

module.exports = { authenticate };