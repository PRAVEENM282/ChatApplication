import mongoose from "mongoose";
import User from "./User.js";

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
    participantPair: {
      type: String,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
    groupname: {
      type: String,
      trim: true,
    },
    groupicon: {
      type: String,
    },
    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
  },
  { timestamps: true }
);
chatRoomSchema.index(
  { participantPair: 1 },
  { 
    unique: true,
    sparse: true
  }
);

chatRoomSchema.pre('save', function(next) {
  if (this.type === 'one_to_one' && this.participants && this.participants.length === 2) {
    const sortedParticipants = this.participants
      .map(p => p.toString())
      .sort((a, b) => a.localeCompare(b))
      .map(id => new mongoose.Types.ObjectId(id));
    this.participants = sortedParticipants;
    this.participantPair = sortedParticipants.map(p => p.toString()).join('-');
  } else {
    this.participantPair = undefined;
  }
  next();
});

export default mongoose.model("Chatroom", chatRoomSchema);