import net from 'net';
import chalk from 'chalk';
import { askWithValidation, printHeader, holdScreen } from './input.js';
import { isValidEmail, isNotEmpty } from './validations.js';
import { Buffer } from 'buffer';

const sendEmail = async (user) => {
    printHeader("Compose Email");

    console.log(chalk.gray("Fill in the details below:\n"));

    const to = await askWithValidation(
        chalk.green("To:      "),
        isValidEmail,
        "Please enter a valid recipient email address."
    );

    const subject = await askWithValidation(
        chalk.green("Subject: "),
        isNotEmpty,
        "Subject cannot be empty."
    );

    const body = await askWithValidation(
        chalk.green("Body:    "),
        isNotEmpty,
        "Email body cannot be empty."
    );

    console.log(chalk.yellow("\nConnecting to SMTP server..."));

    try {
        await sendEmailSMTP(
            user.email,
            user.password,
            to,
            subject,
            body
        );
        console.log(chalk.bold.green("\n✔ Email sent successfully."));
    } catch (err) {
        console.error(chalk.bold.red("\n✖ Failed to send email:"), err.message);
    }
    await holdScreen();
};

function sendEmailSMTP(from, password, to, subject, bodyText) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection(process.env.SMTP_PORT, process.env.SMTP_HOST);
        
        // Minimal data payload
        // We do NOT send "From:", "To:", or "Date:".
        // "Subject:" is sent because it needs to be parsed from the body/headers section
        const emailData = [
            `Subject: ${subject}`,
            ``, // Empty line separating headers from body
            bodyText,
            `.` // End of data marker
        ].join('\r\n');

        let step = 0;

        socket.on('data', async data => {
            const msg = data.toString().trim();
            
            try {
                // Basic Error Checking (Fail fast if 4xx or 5xx)
                const code = parseInt(msg.substring(0, 3));
                if (code >= 400) {
                   throw new Error(`Server responded with error: ${msg}`);
                }

                switch (step) {
                    case 0: // Greeting (220)
                        socket.write(`HELO localhost\r\n`);
                        step++;
                        break;
                    case 1: // HELO response (250)
                        socket.write(`AUTH LOGIN\r\n`);
                        step++;
                        break;
                    case 2: // AUTH LOGIN response (334)
                        socket.write(Buffer.from(from).toString('base64') + '\r\n');
                        step++;
                        break;
                    case 3: // User response (334)
                        socket.write(Buffer.from(password).toString('base64') + '\r\n');
                        step++;
                        break;
                    case 4: // Pass response (235)
                        socket.write(`MAIL FROM:<${from}>\r\n`);
                        step++;
                        break;
                    case 5: // MAIL FROM response (250)
                        socket.write(`RCPT TO:<${to}>\r\n`);
                        step++;
                        break;
                    case 6: // RCPT TO response (250)
                        socket.write(`DATA\r\n`);
                        step++;
                        break;
                    case 7: // DATA response (354)
                        socket.write(`${emailData}\r\n`);
                        step++;
                        break;
                    case 8: // End Data response (250)
                        socket.write(`QUIT\r\n`);
                        socket.end();
                        resolve();
                        break;
                    default:
                        break;
                }
            } catch (err) {
                socket.end();
                reject(err);
            }
        });

        socket.on('error', err => {
            reject(new Error("Socket error: " + err.message));
        });
    });
}

export default sendEmail;