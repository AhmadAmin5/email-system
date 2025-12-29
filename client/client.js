import net from 'net';
import 'dotenv/config';
import chalk from 'chalk';
import login from './auth.js';
import sendEmail from './sendEmail.js';
import checkInbox from './checkInbox.js';
import { ask, printHeader } from "./input.js";

const main = (async () => {
    while (true) {
        try {
            const user = await login();
            var option = 0
            while (option != 3) {
                printHeader(`Dashboard: ${user.email}`);

                console.log(chalk.yellow("Select an action:\n"));
                console.log(chalk.white(" 1) ") + chalk.bold("Compose an email"));
                console.log(chalk.white(" 2) ") + chalk.bold("Check Inbox"));
                console.log(chalk.white(" 3) ") + chalk.red("Log out"));
                console.log(""); 

                option = await ask(chalk.blue("Choose your option: "));
                
                if (option == 1) {
                    await sendEmail(user);
                } else if (option == 2) {
                    await checkInbox(user);
                }
            }

        } catch (err) {
            console.error(chalk.bgRed.white(" Error "), err.message);
            // small delay to read error before clearing
            await new Promise(r => setTimeout(r, 2000));
        }
    }
});

main();