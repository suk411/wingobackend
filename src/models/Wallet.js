import mongoose from "mongoose";

const WalletSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    available: { type: Number, default: 0 },
    locked: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Wallet", WalletSchema);
