import net from 'net';
import chalk from 'chalk';
import { validateUser, doesUserExist } from './controllers/user.controller.js';
import { saveMail } from './controllers/mail.controller.js';

const SMTP_PORT = process.env.SMTP_PORT || 25;

export default net.createServer(socket => {
    console.log(chalk.green.bold(`\n\n========================\nSMTP client connected from ${socket.remoteAddress}:${socket.remotePort}\n`));

    // Helper to send response and log it
    const send = (code, msg) => {
        const payload = `${code} ${msg}`;
        console.log(chalk.blue.bold('SMTP Server: ') + payload);
        socket.write(payload + '\r\n');
    };

    // Session State
    const session = {
        state: 'Gw', // 'Gw' (Greeting Wait), 'Cm' (Command), 'Au' (Auth), 'Dt' (Data)
        helo: null,
        user: null, 
        envelope: {
            from: null,
            to: [],
            data: ''
        },
        authStep: 0,
        tempAuth: {}
    };

    // Initial Greeting
    send(220, 'NodeJS SMTP Server Ready');
    session.state = 'Cm';

    socket.on('data', async (chunk) => {
        const raw = chunk.toString();
        
        // Split by newline to handle buffered commands
        const rawLines = raw.split(/\r?\n/);

        for (const line of rawLines) {
            // Skip empty lines in command mode (but keep them in DATA mode)
            if (line.trim() === '' && session.state !== 'Dt') continue;

            if (session.state !== 'Dt') {
                console.log(chalk.green('SMTP Client: ') + line.trim());
            }

            // --- DATA MODE ---
            if (session.state === 'Dt') {
                // Log the data line being received
                console.log(chalk.green('SMTP Client (Data): ') + line);

                if (line.trim() === '.') {
                    // End of DATA
                    try {
                        // 1. Parse content to separate headers from body
                        const fullContent = session.envelope.data;
                        
                        // Normalize newlines
                        const normalized = fullContent.replace(/\r\n/g, '\n');
                        const headerEndIndex = normalized.indexOf('\n\n');

                        let bodyOnly = "";
                        let subject = "(No Subject)";

                        if (headerEndIndex !== -1) {
                            const headerPart = normalized.substring(0, headerEndIndex);
                            bodyOnly = normalized.substring(headerEndIndex + 2); // Skip the \n\n
                            
                            // Extract Subject
                            const subjectMatch = headerPart.match(/^Subject:\s*(.+)$/im);
                            if (subjectMatch) subject = subjectMatch[1].trim();
                        } else {
                            // No headers found
                            bodyOnly = normalized;
                        }

                        await saveMail({
                            from: session.envelope.from,
                            to: session.envelope.to[0], // Simplified for lab
                            subject: subject,
                            body: bodyOnly
                        });
                        send(250, 'OK Message queued');
                    } catch (err) {
                        console.error(chalk.red('Save Error:'), err);
                        send(451, 'Local error in processing');
                    }
                    // Reset Envelope
                    resetEnvelope();
                    session.state = 'Cm';
                } else {
                    // Append line to envelope data
                    session.envelope.data += line + '\n';
                }
                continue;
            }

            // --- AUTH MODE ---
            if (session.state === 'Au') {
                await handleAuth(line.trim());
                continue;
            }

            // --- COMMAND MODE ---
            const parts = line.trim().split(' ');
            const cmd = parts[0].toUpperCase();
            const args = parts.slice(1).join(' ');

            try {
                switch (cmd) {
                    case 'HELO':
                    case 'EHLO':
                        session.helo = args;
                        resetEnvelope();
                        send(250, `Hello ${args}, pleased to meet you`);
                        break;

                    case 'AUTH':
                        if (session.user) {
                            send(503, 'Already authenticated');
                        } else if (args.toUpperCase() === 'LOGIN') {
                            session.state = 'Au';
                            session.authStep = 1;
                            send(334, Buffer.from('Username:').toString('base64'));
                        } else {
                            send(504, 'Unrecognized authentication type');
                        }
                        break;

                    case 'MAIL':
                        if (!session.user) return send(530, 'Authentication required');
                        if (session.envelope.from) return send(503, 'Sender already specified');
                        
                        const fromMatch = args.match(/FROM:\s*<([^>]+)>/i);
                        if (!fromMatch) return send(501, 'Syntax error');
                        
                        const fromEmail = fromMatch[1];
                        if (fromEmail.toLowerCase() !== session.user.toLowerCase()) {
                            return send(553, `Sender mismatch`);
                        }

                        session.envelope.from = fromEmail;
                        send(250, 'OK');
                        break;

                    case 'RCPT':
                        if (!session.envelope.from) return send(503, 'Need MAIL first');
                        
                        const toMatch = args.match(/TO:\s*<([^>]+)>/i);
                        if (!toMatch) return send(501, 'Syntax error');

                        const toEmail = toMatch[1];
                        if (!await doesUserExist(toEmail)) {
                            return send(550, 'No such user here');
                        }

                        session.envelope.to.push(toEmail);
                        send(250, 'OK');
                        break;

                    case 'DATA':
                        if (!session.envelope.from || session.envelope.to.length === 0) {
                            return send(503, 'Need MAIL and RCPT first');
                        }
                        session.state = 'Dt';
                        send(354, 'Start mail input; end with <CRLF>.<CRLF>');
                        break;

                    case 'RSET':
                        resetEnvelope();
                        send(250, 'Flushed');
                        break;

                    case 'NOOP':
                        send(250, 'OK');
                        break;

                    case 'QUIT':
                        send(221, 'Bye');
                        socket.end();
                        break;

                    default:
                        if (cmd.length > 0) send(500, 'Command not recognized');
                }
            } catch (error) {
                console.error(chalk.red('Command Error:'), error);
                send(500, 'Internal server error');
            }
        }
    });

    socket.on('error', () => console.log(chalk.red.bold('\nSMTP client disconnected unexpectedly\n========================')));

    socket.on('close', () => console.log(chalk.yellow.bold('\nSMTP client closed connection\n========================')));


    // Helpers
    function resetEnvelope() {
        session.envelope = { from: null, to: [], data: '' };
    }

    async function handleAuth(line) {
        try {
            const decoded = Buffer.from(line, 'base64').toString('utf-8');
            
            if (session.authStep === 1) {
                session.tempAuth.username = decoded;
                session.authStep = 2;
                send(334, Buffer.from('Password:').toString('base64'));
            } else if (session.authStep === 2) {
                session.tempAuth.password = decoded;
                const isValid = await validateUser(session.tempAuth.username, session.tempAuth.password);
                
                if (isValid) {
                    session.user = session.tempAuth.username;
                    session.state = 'Cm';
                    send(235, 'Authentication successful');
                } else {
                    session.state = 'Cm';
                    send(535, 'Authentication failed');
                }
                session.authStep = 0;
                session.tempAuth = {};
            }
        } catch (e) {
            session.state = 'Cm';
            send(501, 'Invalid Base64');
        }
    }
});