import net from 'net';
import 'dotenv/config';
import chalk from 'chalk';
import login from './auth.js';
import sendEmail from './sendEmail.js';
import checkInbox from './checkInbox.js';
import { ask, printHeader, holdScreen } from "./input.js";
import { createTunnel } from './sshTunnel.js';

const main = (async () => {
    
    // Check if we should use SSH or Local Mode
    const useSSH = process.env.USE_SSH === 'true';

    // Default Auth Port if not set in .env
    const REMOTE_AUTH_PORT = process.env.REMOTE_AUTH_PORT || 3333;

    if (useSSH) {
        printHeader("Secure Client Startup (SSH)");
        console.log(chalk.yellow("Initializing SSH Tunnels..."));

        const sshConfig = {
            host: process.env.SSH_HOST,
            port: parseInt(process.env.SSH_PORT || 22),
            username: process.env.SSH_USER,
            password: process.env.SSH_PASS
        };

        try {
            // 1. Tunnel for SMTP
            const smtpTunnel = await createTunnel(sshConfig, '127.0.0.1', parseInt(process.env.REMOTE_SMTP_PORT));
            
            // 2. Tunnel for POP3
            const pop3Tunnel = await createTunnel(sshConfig, '127.0.0.1', parseInt(process.env.REMOTE_POP3_PORT));

            // 3. Tunnel for Auth Server
            const authTunnel = await createTunnel(sshConfig, '127.0.0.1', parseInt(REMOTE_AUTH_PORT));

            console.log(chalk.green.bold("\n✔ Secure Connection Established!\n"));
            
            // Override env to use the Tunnels
            process.env.SMTP_HOST = '127.0.0.1';
            process.env.SMTP_PORT = smtpTunnel.localPort;
            
            process.env.POP3_HOST = '127.0.0.1';
            process.env.POP3_PORT = pop3Tunnel.localPort;

            process.env.AUTH_HOST = '127.0.0.1';
            process.env.AUTH_PORT = authTunnel.localPort;

            await holdScreen();

        } catch (err) {
            console.error(chalk.red.bold("\n✖ Failed to establish SSH Tunnel."));
            console.error("Details:", err.message);
            process.exit(1);
        }
    } else {
        // --- LOCAL DEVELOPMENT MODE ---
        printHeader("Local Client Startup");
        console.log(chalk.blue("Running in Local Development Mode (No SSH)"));
        
        process.env.SMTP_HOST = '127.0.0.1';
        process.env.SMTP_PORT = process.env.REMOTE_SMTP_PORT || 25;
        
        process.env.POP3_HOST = '127.0.0.1';
        process.env.POP3_PORT = process.env.REMOTE_POP3_PORT || 110;

        process.env.AUTH_HOST = '127.0.0.1';
        process.env.AUTH_PORT = REMOTE_AUTH_PORT;
        
        await new Promise(r => setTimeout(r, 1000));
    }

    // --- Main Application Loop ---
    while (true) {
        try {
            const user = await login();
            if(!user) break;
            var option = 0
            
            // Loop until user chooses to Log out (Option 4)
            while (option != 4) {
                printHeader(`Dashboard: ${user.email}`);

                console.log(chalk.yellow("Select an action:\n"));
                console.log(chalk.white(" 1) ") + chalk.bold("Compose"));
                console.log(chalk.white(" 2) ") + chalk.bold("Check inbox"));
                console.log(chalk.white(" 3) ") + chalk.bold("Sent emails"));
                console.log(chalk.white(" 4) ") + chalk.redBright("Log out\n"));

                option = await ask(chalk.blue("Choose your option: "));
                
                if (option == 1) {
                    await sendEmail(user);
                } else if (option == 2) {
                    // Pass 'INBOX' type
                    await checkInbox(user, 'INBOX');
                } else if (option == 3) {
                    // Pass 'SENT' type
                    await checkInbox(user, 'SENT');
                }
            }

        } catch (err) {
            console.error(chalk.bgRed.white(" Error "), err.message);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
});

main();