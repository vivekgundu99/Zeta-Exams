// middleware/auth.middleware.js - Authentication Middleware
import jwt from 'jsonwebtoken';

// User authentication middleware
export const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.userId;
    req.email = decoded.email;

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token'
    });
  }
};

// Admin authentication middleware
export const adminAuthMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if it's an admin token
    if (!decoded.adminId || !decoded.role) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    req.adminId = decoded.adminId;
    req.adminEmail = decoded.email;
    req.adminRole = decoded.role;

    next();
  } catch (error) {
    console.error('Admin Auth Middleware Error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token'
      });
  }
};

export default { authMiddleware, adminAuthMiddleware };