import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { catchAsync, AppError } from "../middlewares/errorHandler.js";

// --- More Robust Cookie Options ---
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  secure: IS_PRODUCTION, // Only use secure cookies in production (HTTPS)
  sameSite: IS_PRODUCTION ? 'None' : 'Lax', // 'None' for cross-site prod, 'Lax' for dev
};

export const register = catchAsync(async (req, res, next) => {
  const { username, email, password, publicKey } = req.body;

  const duplicate = await User.findOne({ $or: [{ email }, { username }] }).lean().exec();
  if (duplicate) {
    return next(new AppError("Username or email is already taken", 409));
  }

  const hashPwd = await bcrypt.hash(password, 10);
  const newUserId = new mongoose.Types.ObjectId();
  
  const accessToken = jwt.sign({ userId: newUserId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ userId: newUserId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "7d" });

  await User.create({
    _id: newUserId,
    username,
    email,
    password: hashPwd,
    publicKey,
    refreshToken,
  });

  res.cookie("jwt", refreshToken, cookieOptions);

  res.status(201).json({ message: `New user ${username} created`, accessToken, userId: newUserId, username });
});

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const foundUser = await User.findOne({ email }).select('+password').exec();
  
  if (!foundUser || !(await bcrypt.compare(password, foundUser.password))) {
    return next(new AppError("Invalid credentials", 401));
  }

  const accessToken = jwt.sign({ userId: foundUser._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ userId: foundUser._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "7d" });

  foundUser.refreshToken = refreshToken;
  await foundUser.save();

  res.cookie("jwt", refreshToken, cookieOptions);

  res.status(200).json({ 
    message: `${foundUser.username} welcome back`, 
    accessToken, 
    username: foundUser.username,
    userId: foundUser._id,
  });
});

export const logout = catchAsync(async (req, res) => {
  const { jwt: refreshToken } = req.cookies;
  if (!refreshToken) return res.sendStatus(204);
  
  res.clearCookie("jwt", cookieOptions);

  // Invalidate the token in the database
  const foundUser = await User.findOne({ refreshToken });
  if (foundUser) {
    foundUser.refreshToken = "";
    await foundUser.save();
  }
  
  res.sendStatus(204);
});

export const refresh = catchAsync(async (req, res, next) => {
  const { jwt: refreshToken } = req.cookies;
  if (!refreshToken) {
    return next(new AppError("Unauthorized", 401));
  }

  const foundUser = await User.findOne({ refreshToken }).exec();

  if (!foundUser) {
    // If the token is invalid, instruct the client to clear it.
    res.clearCookie("jwt", cookieOptions);
    return next(new AppError("Forbidden: Invalid Token", 403));
  }

  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
    async (err, decoded) => {
      if (err || foundUser._id.toString() !== decoded.userId) {
        return next(new AppError("Forbidden: Token Mismatch", 403));
      }

      const accessToken = jwt.sign(
        { userId: foundUser._id },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "15m" }
      );
      
      res.json({ accessToken });
    }
  );
});

