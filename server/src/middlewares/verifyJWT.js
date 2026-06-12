import jwt from "jsonwebtoken";

/**
 * Middleware function that checks the incoming request for a valid JWT Access Token
 * inside the HTTP 'Authorization' header.
 * 
 * Sets req.userId upon successful validation and calls next().
 * Returns 401 (Unauthorized) if header is missing, or 403 (Forbidden) if token is expired/invalid.
 */
export const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  // Verify header prefix is 'Bearer '
  if (!authHeader?.startsWith("Bearer ")) {
    return res.sendStatus(401);
  }

  const accessToken = authHeader.split(" ")[1];

  // Verify token signature and expiration
  jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      // Access token is either invalid, tampered with, or expired (needs refresh)
      return res.sendStatus(403); 
    }
    
    // Bind authenticated userId to req object for controllers downstream
    req.userId = decoded.userId;
    next();
  });
};