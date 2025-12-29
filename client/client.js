import net from 'net';
import 'dotenv/config';
import chalk from 'chalk';
import login from './auth.js';
import sendEmail from './sendEmail.js';
import checkInbox from './checkInbox.js';
import { ask, printHeader, holdScreen } from "./input.js";
import { createTunnel } from './sshTunnel.js';

const main = (async () => {
    
    printHeader("Secure Client Startup");
    console.log(chalk.yellow("Initializing SSH Tunnels..."));

    // SSH Configuration from .env
    const sshConfig = {
        host: process.env.SSH_HOST,
        port: parseInt(process.env.SSH_PORT || 22),
        username: process.env.SSH_USER,
        password: process.env.SSH_PASS
    };

    try {
        // 1. Create Tunnel for SMTP
        const smtpTunnel = await createTunnel(
            sshConfig, 
            '127.0.0.1', // The server should forward to itself
            parseInt(process.env.REMOTE_SMTP_PORT)
        );

        // 2. Create Tunnel for POP3
        const pop3Tunnel = await createTunnel(
            sshConfig, 
            '127.0.0.1', 
            parseInt(process.env.REMOTE_POP3_PORT)
        );

        console.log(chalk.green.bold("\n✔ Secure Connection Established!\n"));
        
        // 3. OVERRIDE environment variables
        // The rest of the app thinks it's connecting to these hosts, 
        // but it's actually connecting to our local secure tunnel.
        process.env.SMTP_HOST = '127.0.0.1';
        process.env.SMTP_PORT = smtpTunnel.localPort;
        
        process.env.POP3_HOST = '127.0.0.1';
        process.env.POP3_PORT = pop3Tunnel.localPort;

        await holdScreen();

        // 4. Run Main Application Loop
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
                await new Promise(r => setTimeout(r, 2000));
            }
        }

    } catch (err) {
        console.error(chalk.red.bold("\n✖ Failed to establish SSH Tunnel."));
        console.error(chalk.yellow("Check if OpenSSH Server is enabled on the target laptop."));
        console.error("Details:", err.message);
        process.exit(1);
    }
});

main();