import mongoose from "mongoose";

/**
 * Safely percent-encodes the username and password in a MongoDB URI to handle special characters.
 */
const encodeMongoUri = (uri) => {
  if (!uri) return uri;
  const match = uri.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/);
  if (!match) return uri;

  const protocol = match[1];
  const rest = match[2];

  const pathIndex = rest.indexOf('/');
  const queryIndex = rest.indexOf('?');
  let authEnd = rest.length;
  if (pathIndex !== -1) {
    authEnd = pathIndex;
  } else if (queryIndex !== -1) {
    authEnd = queryIndex;
  }

  const authority = rest.substring(0, authEnd);
  const remainder = rest.substring(authEnd);

  const atIndex = authority.lastIndexOf('@');
  if (atIndex === -1) {
    return uri;
  }

  const userinfo = authority.substring(0, atIndex);
  const hosts = authority.substring(atIndex + 1);

  const colonIndex = userinfo.indexOf(':');
  let username = userinfo;
  let password = '';
  if (colonIndex !== -1) {
    username = userinfo.substring(0, colonIndex);
    password = userinfo.substring(colonIndex + 1);
  }

  const encodedUser = encodeURIComponent(username);
  const encodedPass = encodeURIComponent(password);

  return `${protocol}${encodedUser}:${encodedPass}@${hosts}${remainder}`;
};

/**
 * Connects to the MongoDB database using the MONGODB_URI environment variable.
 * Logs connection status or terminates the process upon critical failure.
 */
const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...");
    
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is missing or empty.");
    }
    const connectionUri = encodeMongoUri(process.env.MONGODB_URI);
    await mongoose.connect(connectionUri);
    console.log("MongoDB connected successfully");
  } catch (err) {
    if (err instanceof Error) {
      console.error("MongoDB connection failed:", err.message);
    } else {
      console.error("MongoDB connection failed:", err);
    }
    process.exit(1);
  }
};

export default connectDB;
