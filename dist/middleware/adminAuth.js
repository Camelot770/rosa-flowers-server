"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuth = adminAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function adminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token required' });
        return;
    }
    const token = authHeader.slice(7);
    try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            res.status(500).json({ error: 'Server auth not configured' });
            return;
        }
        const payload = jsonwebtoken_1.default.verify(token, jwtSecret);
        req.adminId = payload.adminId;
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}
//# sourceMappingURL=adminAuth.js.map