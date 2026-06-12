import mongoose from "mongoose";

/**
 * Chatroom mongoose schema. Tracks conversation type, members (participants),
 * last-message preview snippet, and unread counters for participants.
 */
const chatRoomSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    type: {
      type: String,
      enum: ["one_to_one", "group"],
      default: "one_to_one",
    },
    name: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Composite unique index value to ensure duplicate chatrooms don't get created
    participantPair: {
      type: String,
      unique: true,
      sparse: true,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    // Map of userId -> unread count integer
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
    mutedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    archivedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    readReceiptsEnabledBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// Mongoose pre-validate hook to format the sorting-invariant participantPair string
chatRoomSchema.pre("validate", function (next) {
  if (this.type === "one_to_one" && this.participants.length === 2) {
    // Stringify, sort lexicographically, and join IDs to form a unique key
    this.participantPair = this.participants
      .map((p) => p.toString())
      .sort()
      .join("-");
  } else {
    this.participantPair = undefined;
  }
  next();
});

export default mongoose.model("ChatRoom", chatRoomSchema);
