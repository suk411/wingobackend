import mongoose from "mongoose";

const LedgerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    roundId: { type: String, index: true },
    type: { type: String, enum: ["DEBIT", "CREDIT", "FEE"], index: true },
    amount: Number,
    balanceAfter: Number,
    meta: Object,
  },
  { timestamps: true }
);

export default mongoose.model("Ledger", LedgerSchema);
