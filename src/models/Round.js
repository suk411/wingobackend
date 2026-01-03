import mongoose from "mongoose";

const RoundSchema = new mongoose.Schema({
  roundId: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ["BETTING", "CLOSED", "REVEALED", "SETTLED"],
    required: true,
  },
  result: { type: Object }, // number, color, size, includesViolet, payout
  bets: { type: Array }, // optional: store bets snapshot
  exposures: { type: Object }, // optional: exposure simulation
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Round", RoundSchema);
