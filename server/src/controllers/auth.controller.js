import User from "../models/User.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt, { decode } from "jsonwebtoken";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";

dotenv.config();
export const register = async (req, res) => {
  const { username, email, password, publicKey } = req.body;

  if (!username || !email || !password || !publicKey) {
    return res.status(400).json({
      message: "Username, email, password, and public key are required",
    });
  }

  try {
    const duplicate = await User.findOne({
      $or: [{ email: email }, { username: username }],
    })
      .lean()
      .exec();

    if (duplicate) {
      return res
        .status(409)
        .json({ message: "Username or email is already taken" });
    }

    const hashPwd = await bcrypt.hash(password, 10);
    const newUserId = new mongoose.Types.ObjectId();
    const accessToken = jwt.sign(
      { userId: newUserId },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { userId: newUserId },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    await User.create({
      _id: newUserId,
      username,
      email,
      password: hashPwd,
      publicKey,
      refreshToken,
    });
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({
      message: `New user ${username} created`,
      accessToken: accessToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const foundUser = await User.findOne({ email: email }).select("+password");

    if (!foundUser || !foundUser.password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, foundUser.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = jwt.sign(
      { userId: foundUser._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
      { userId: foundUser._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    foundUser.refreshToken = refreshToken;
    await foundUser.save();
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: `${foundUser.username} welcome back`,
      accessToken: accessToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = async (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) {
    return res.sendStatus(204);
  }
  const refreshToken = cookies.jwt;

  res.clearCookie("jwt", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
  });

  try {
    const foundUser = await User.findOne({ refreshToken: refreshToken });
    if (!foundUser) {
      return res.sendStatus(204);
    }

    foundUser.refreshToken = "";
    await foundUser.save();

    return res.sendStatus(204);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const refresh = async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) {
    return res.sendStatus(401);
  }
  const refreshToken = cookies.jwt;
  try {
    const foundUser = await User.findOne({ refreshToken: refreshToken }).exec();
    if (!foundUser) {
      return res.status(404).json({ message: "unauthorized access" });
    }
    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      async (err, decoded) => {
        if (err || foundUser._id.toString() !== decoded.userId) {
          return res.sendStatus(403);
        }

        const accessToken = jwt.sign(
          { userId: foundUser._id },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "15m" }
        );
        const newRefreshToken = jwt.sign(
          { userId: foundUser._id },
          process.env.REFRESH_TOKEN_SECRET,
          { expiresIn: "7d" }
        );

        foundUser.refreshToken = newRefreshToken;
        await foundUser.save();

        res.cookie("jwt", newRefreshToken, {
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({ accessToken });
      }
    );
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "internal server error" });
  }
};