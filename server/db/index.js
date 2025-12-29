import mongoose from "mongoose";
import chalk from "chalk";

const connectDB = async () => {
    try {
        console.info(chalk.yellow("Connecting Database..."));
        await mongoose.connect(`${process.env.MONGODB_URI}/${process.env.DB_NAME}`);
        console.info(chalk.green("Database Connected"));
    } catch (error) {
        console.error(chalk.red("Failed to connect Database"));
        throw error;
    }
};

export default connectDB;
