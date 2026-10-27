import { connectDB } from "./db.js";
import { app } from "./app.js";
import mongoose from "mongoose";
try {
  if (
    process.env.NODE_ENV === "production" &&
    !/^https:\/\//.test(process.env.APP_ORIGIN || "")
  )
    throw new Error("APP_ORIGIN must be your production HTTPS URL.");
  await connectDB();
  const server = app.listen(process.env.PORT || 4000, "0.0.0.0", () =>
    console.log(`CampusSlot listening on port ${process.env.PORT || 4000}`),
  );
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
} catch (error) {
  console.error("Startup failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
}
