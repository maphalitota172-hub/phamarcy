import mongoose from "mongoose";
import * as models from "../models/index.js";

let connected = false;

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  const database = process.env.MONGODB_DATABASE;
  if (!uri || !database) {
    throw new Error("MongoDB configuration is missing. Set MONGODB_URI and MONGODB_DATABASE in backend/.env.");
  }
  if (!/^mongodb(\+srv)?:\/\//i.test(uri)) {
    throw new Error("MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme.");
  }

  try {
    await mongoose.connect(uri, {
      dbName: database,
      serverSelectionTimeoutMS: 15000,
      autoIndex: true
    });
    await Promise.all(Object.values(models).map(model => model.init()));
    connected = true;
    console.log(`Connected to MongoDB database "${database}".`);
  } catch (error) {
    await mongoose.disconnect().catch(() => {});
    const type = error?.name || "ConnectionError";
    throw new Error(`MongoDB connection or index initialization failed (${type}). Check Atlas network access and database user settings.`);
  }
}

export function isDatabaseConnected() {
  return connected && mongoose.connection.readyState === 1;
}

export { mongoose };
