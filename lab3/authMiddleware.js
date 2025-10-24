const jwt = require('jsonwebtoken');

const a = (req, res, next) => {
  const token = req.cookies.access_token;

  if (!token) {
    return res.sendStatus(401);
  }

  try {
    const data = jwt.verify(token, '123123');
    req.userId = data.id;
    return next();
  } catch {
    return res.sendStatus(401);
  }
};

module.exports = a;
