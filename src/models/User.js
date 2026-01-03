import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // ✅ use bcryptjs for Windows stability

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

// Hash password before save
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password
UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model("User1", UserSchema);
