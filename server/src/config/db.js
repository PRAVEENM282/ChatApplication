import mongoose from "mongoose";

/**
 * Connects to the MongoDB database using the MONGODB_URI environment variable.
 * Logs connection status or terminates the process upon critical failure.
 */
const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...");
    
    // Connect with Mongoose (configuration settings are picked from env)
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is missing or empty.");
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully");
  } catch (err) {
    if (err instanceof Error) {
      console.error("MongoDB connection failed:", err.message);
    } else {
      console.error("MongoDB connection failed:", err);
    }
    // Terminate process if DB connection fails
    process.exit(1);
  }
};

export default connectDB;
