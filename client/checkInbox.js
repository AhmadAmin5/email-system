import net from 'net';
import chalk from 'chalk';
import { ask, printHeader, holdScreen } from './input.js';

const checkInbox = async (user) => {
    return new Promise((resolveMain) => {
        const socket = net.createConnection(parseInt(process.env.POP3_PORT), process.env.POP3_HOST);
        
        let responseHandler = null;

        socket.on('data', (data) => {
            if (responseHandler) responseHandler(data);
        });

        socket.on('error', (err) => {
            console.error(chalk.red("\nConnection error:"), err.message);
            resolveMain();
        });

        socket.on('close', () => {
            resolveMain();
        });

        const sendRequest = (command, multiLine = false) => {
            return new Promise((resolve) => {
                let buffer = '';
                responseHandler = (data) => {
                    buffer += data.toString();
                    const isComplete = multiLine 
                        ? buffer.includes('\r\n.\r\n') 
                        : buffer.includes('\r\n');
                    
                    if (isComplete) {
                        responseHandler = null; 
                        resolve(buffer);
                    }
                };
                if (command) socket.write(command + '\r\n');
            });
        };
        
        const waitForGreeting = () => {
             return new Promise((resolve) => {
                let buffer = '';
                responseHandler = (data) => {
                    buffer += data.toString();
                    if (buffer.includes('\r\n')) {
                        responseHandler = null;
                        resolve(buffer);
                    }
                };
             });
        };

        const run = async () => {
            try {
                // Connection sequence
                const greeting = await waitForGreeting();
                if (!greeting.startsWith('+OK')) throw new Error('Server not ready: ' + greeting);
                await sendRequest(`USER ${user.email}`);
                await sendRequest(`PASS ${user.password}`);

                // Inbox Loop
                while (true) {
                    printHeader(`Inbox: ${user.email}`);
                    
                    const listRaw = await sendRequest('LIST', true);
                    const lines = listRaw.split('\r\n').filter(l => l.trim() !== '' && l.trim() !== '.');
                    
                    if (lines[0].startsWith('+OK')) {
                        const msgs = lines.slice(1);
                        if (msgs.length === 0) {
                            console.log(chalk.gray("   (Inbox is empty)"));
                        } else {
                            // Table Header
                            console.log(chalk.bold.yellow(pad("ID", 6) + pad("Sender", 35) + "Date"));
                            console.log(chalk.dim(pad("-", 6, '-') + pad("-", 35, '-') + "-----------------------"));
                            
                            msgs.forEach(m => {
                                const parts = m.split('|');
                                if (parts.length >= 3) {
                                    const id = parts[0];
                                    const sender = parts[1];
                                    const date = new Date(parts[2]).toLocaleString();
                                    console.log(pad(id, 6) + pad(sender, 35) + date);
                                }
                            });
                        }
                    }

                    console.log(chalk.dim("\n------------------------------------------------"));
                    console.log(chalk.white("Commands: ") + 
                                chalk.green("[ID]") + " read, " + 
                                chalk.red("[d ID]") + " delete, " + 
                                chalk.yellow("[b]") + " back");
                    
                    const choice = await ask(chalk.blue("Action: "));
                    const parts = choice.trim().split(' ');
                    const cmd = parts[0].toLowerCase();
                    const arg = parts[1];

                    if (cmd === 'b' || cmd === 'back') {
                        await sendRequest('QUIT');
                        socket.end();
                        break;
                    } 
                    else if (cmd === 'd' && arg) {
                        const res = await sendRequest(`DELE ${arg}`);
                        console.log(chalk.red("\n" + res.trim()));
                        await holdScreen();
                    }
                    else {
                        const id = parseInt(cmd);
                        if (!isNaN(id)) {
                            const retrRaw = await sendRequest(`RETR ${id}`, true);
                            if (retrRaw.startsWith('+OK')) {
                                printHeader(`Reading Message #${id}`);
                                
                                const content = retrRaw
                                    .replace(/^\+OK.*\r\n/, '')
                                    .replace(/\r\n\.\r\n$/, '');
                                
                                const bodyLines = content.split('\n');
                                bodyLines.forEach(line => {
                                    // Check if line is a header we want to align
                                    if(line.startsWith('From:') || line.startsWith('To:') || line.startsWith('Subject:')) {
                                        const firstColon = line.indexOf(':');
                                        const key = line.substring(0, firstColon + 1);
                                        const val = line.substring(firstColon + 1).trim();

                                        // Pad the key to 12 characters for alignment
                                        console.log(chalk.cyan.bold(key.padEnd(12, ' ')) + val);
                                    } else {
                                        console.log(line);
                                    }
                                });
                            } else {
                                console.log(chalk.red("\nError: " + retrRaw.trim()));
                            }
                            await holdScreen();
                        }
                    }
                }
            } catch (e) {
                console.error(chalk.red("\nError in Inbox:"), e.message);
                await holdScreen();
                socket.end();
                resolveMain();
            }
        };

        run();
    });
};

function pad(str, len, char = ' ') {
    str = str.toString();
    if (str.length >= len) return str.substring(0, len - 1) + ' ';
    return str + char.repeat(len - str.length);
}

export default checkInbox;