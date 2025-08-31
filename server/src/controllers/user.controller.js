import User from "../models/User.js";
export const searchUsers = async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ message: "A search query is required" });
  }

  try {
    const currentUserId = req.userId;
    const searchRegex = new RegExp(query, "i");
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password -refreshToken");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: "Error retrieving user" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select("-password -refreshToken");
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: "Error updating user" });
  }
};
