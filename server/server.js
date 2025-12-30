import dotenv from "dotenv";
import chalk from "chalk";
import connectDB from "./db/index.js";
import smtpServer from "./SMTP.js"
import pop3Server from "./POP3.js"
import authServer from "./AuthServer.js"

dotenv.config();
console.clear();
console.log(chalk.bold.cyan("<-----   Mail Server System   ----->\n\n"))
await connectDB();

// Default ports if not in .env
const SMTP_PORT = process.env.SMTP_PORT || 25;
const POP3_PORT = process.env.POP3_PORT || 110;
const AUTH_PORT = process.env.AUTH_PORT || 3333; 

smtpServer.listen(parseInt(SMTP_PORT), () => {
    console.log(chalk.yellow(`SMTP server running on port ${SMTP_PORT}`));
});

pop3Server.listen(parseInt(POP3_PORT), () => {
    console.log(chalk.yellow(`POP3 server running on port ${POP3_PORT}`));
});

authServer.listen(parseInt(AUTH_PORT), () => {
    console.log(chalk.yellow(`Auth server running on port ${AUTH_PORT}`));
});