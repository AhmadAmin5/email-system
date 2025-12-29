import dotenv from "dotenv";
import chalk from "chalk";
import connectDB from "./db/index.js";
import smtpServer from "./SMTP.js"
import pop3Server from "./POP3.js"
import { registerUser, validateUser, doesUserExist } from './controllers/user.controller.js';
import { saveMail, listMails, readMail, deleteMail } from './controllers/mail.controller.js';
import { Buffer } from 'buffer';

dotenv.config();
console.clear();
console.log("<-----   Mail Server   ----->\n\n")
await connectDB();


smtpServer.listen(parseInt(process.env.SMTP_PORT), () => {
    console.log(chalk.yellow(`SMTP server running on port ${process.env.SMTP_PORT}`));
});


pop3Server.listen(parseInt(process.env.POP3_PORT), () => {
    console.log(chalk.yellow(`POP3 server running on port ${process.env.POP3_PORT}`));
});
