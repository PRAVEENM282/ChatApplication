import User from "../models/User.js";
import { catchAsync, AppError } from "../middlewares/errorHandler.js";

export const searchUsers = catchAsync(async (req, res, next) => {
  const originalQuery = req.query.q;
  if (!originalQuery) {
    return next(new AppError("A search query is required", 400));
  }

  // Sanitize input to remove characters that could be used for injection
  const sanitizedQuery = originalQuery.replace(/[$}{]/g, '');

  if (!sanitizedQuery.trim()) {
    return res.status(200).json([]); // Return empty if query is only special chars
  }

  const currentUserId = req.userId;
  const searchRegex = new RegExp(sanitizedQuery, "i");
  
  const users = await User.find({
    _id: { $ne: currentUserId },
    $or: [
      { username: { $regex: searchRegex } },
      { email: { $regex: searchRegex } },
    ],
  })
  .limit(10)
  .select("-password -refreshToken")
  .exec();

  res.status(200).json(users);
});

export const getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select("-password -refreshToken");
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  res.status(200).json(user);
});

export const updateUser = catchAsync(async (req, res, next) => {
  const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select("-password -refreshToken");
  if (!updated) {
    return next(new AppError("User not found", 404));
  }
  res.status(200).json(updated);
});