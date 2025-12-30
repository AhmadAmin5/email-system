import net from 'net';
import chalk from 'chalk';
import { validateUser, doesUserExist } from './controllers/user.controller.js';
// - Updated imports to include listSentMails
import { listMails, listSentMails, deleteMail } from './controllers/mail.controller.js';

export default net.createServer(socket => {
    console.log(chalk.green.bold(`\n\n========================\nPOP3 client connected from ${socket.remoteAddress}:${socket.remotePort}\n`));

    // Log Server writing
    const originalWrite = socket.write.bind(socket);
    socket.write = (data, encoding, callback) => {
        console.log(chalk.blue.bold('POP3 Server:'), data.toString().trim());
        return originalWrite(data, encoding, callback);
    };

    socket.write('+OK NodeJS POP3 Server ready\r\n');
    
    let authenticatedUser = null;
    let currentMode = 'INBOX'; // State to track if user is viewing INBOX or SENT

    socket.on('data', async data => {
        console.log(chalk.green.bold('POP3 Client:'), data.toString().trim());

        const message = data.toString().trim();
        const parts = message.split(' ');
        const cmd = parts[0].toUpperCase();

        try {
            switch (cmd) {

                case 'USER':
                    if (!await doesUserExist(parts[1])) {
                        socket.write('-ERR no such user\r\n');
                    } else {
                        authenticatedUser = parts[1];
                        socket.write('+OK user accepted\r\n');
                    }
                    break;

                case 'PASS':
                    if (!authenticatedUser) return socket.write('-ERR send USER first\r\n');
                    if (!await validateUser(authenticatedUser, parts[1])) {
                        authenticatedUser = null;
                        socket.write('-ERR invalid password\r\n');
                    } else {
                        socket.write('+OK logged in\r\n');
                    }
                    break;

                case 'LIST':
                    if (!authenticatedUser) return socket.write('-ERR not authenticated\r\n');
                    
                    // Switch mode to INBOX
                    currentMode = 'INBOX';
                    
                    const inboxMails = await listMails(authenticatedUser);
                    let listResponse = `+OK ${inboxMails.length} messages\r\n`;
                    inboxMails.forEach((m, index) => {
                        listResponse += `${index + 1}|${m.from}|${m.createdAt}\r\n`;
                    });
                    listResponse += '.\r\n';
                    socket.write(listResponse);
                    break;

                case 'LIST_SENT':
                    if (!authenticatedUser) return socket.write('-ERR not authenticated\r\n');
                    
                    // Switch mode to SENT
                    currentMode = 'SENT';
                    
                    const sentMails = await listSentMails(authenticatedUser);
                    let sentResponse = `+OK ${sentMails.length} messages\r\n`;
                    sentMails.forEach((m, index) => {
                        // For Sent mails, we typically want to see who it was sent TO
                        sentResponse += `${index + 1}|${m.to}|${m.createdAt}\r\n`;
                    });
                    sentResponse += '.\r\n';
                    socket.write(sentResponse);
                    break;

                case 'RETR':
                    if (!authenticatedUser) return socket.write('-ERR not authenticated\r\n');
                    
                    // FIXED: Corrected the variable name from 'constOX' to 'msgIdx'
                    const msgIdx = parseInt(parts[1]);
                    if(isNaN(msgIdx)) return socket.write('-ERR invalid argument\r\n');
                    
                    const arrayIndex = msgIdx - 1;
                    
                    // Fetch from the correct list based on currentMode
                    let mailList = [];
                    if (currentMode === 'SENT') {
                        mailList = await listSentMails(authenticatedUser);
                    } else {
                        mailList = await listMails(authenticatedUser);
                    }
                    
                    if (!mailList[arrayIndex]) return socket.write('-ERR no such message\r\n');
                    
                    const mail = mailList[arrayIndex];
                    
                    // Only mark as read if it's an inbox message
                    if (currentMode === 'INBOX' && !mail.read) {
                        // Assuming readMail or direct save handles 'read' status
                        // For now we just update in memory if needed or rely on the controller
                        // You might want to call a controller method here to persist the read status
                    }
                    
                    socket.write(`+OK ${mail.body.length} octets\r\n`);
                    socket.write(`From: ${mail.from}\r\n`);
                    socket.write(`To: ${mail.to}\r\n`);
                    socket.write(`Subject: ${mail.subject}\r\n`);
                    socket.write(`${mail.body}\r\n.\r\n`);
                    break;

                case 'DELE':
                    if (!authenticatedUser) return socket.write('-ERR not authenticated\r\n');
                    const delArg = parseInt(parts[1]);
                    if(isNaN(delArg)) return socket.write('-ERR invalid argument\r\n');

                    const delIndex = delArg - 1;
                    
                    // Use correct list
                    let mailsToDelete = [];
                    if (currentMode === 'SENT') {
                        mailsToDelete = await listSentMails(authenticatedUser);
                    } else {
                        mailsToDelete = await listMails(authenticatedUser);
                    }

                    if (!mailsToDelete[delIndex]) return socket.write('-ERR no such message\r\n');
                    
                    await deleteMail(mailsToDelete[delIndex]._id);
                    socket.write('+OK message deleted\r\n');
                    break;

                case 'QUIT':
                    socket.write('+OK goodbye\r\n');
                    socket.end();
                    break;

                default:
                    socket.write('-ERR unknown command\r\n');
            }
        } catch (err) {
            console.error('POP3 Error:', err);
            socket.write('-ERR internal server error\r\n');
        }
    });

    socket.on('error', () => console.log(chalk.red.bold(`\nPOP3 client ${socket.remotePort} disconnected unexpectedly\n========================`)));
    socket.on('close', () => console.log(chalk.yellow.bold(`\nPOP3 client ${socket.remotePort} closed connection\n========================`)));
});