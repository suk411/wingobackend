import mongoose from "mongoose";

const BetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  roundId: { type: String, required: true },
  type: { type: String, enum: ["COLOR", "NUMBER", "SIZE"], required: true },
  option: { type: mongoose.Schema.Types.Mixed, required: true },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["PENDING", "WON", "LOST"],
    default: "PENDING",
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Bet", BetSchema);
