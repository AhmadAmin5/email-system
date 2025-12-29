import net from 'net';
import chalk from 'chalk';
import { registerUser, validateUser, doesUserExist } from './controllers/user.controller.js';
import { saveMail, listMails, readMail, deleteMail } from './controllers/mail.controller.js';

export default net.createServer(socket => {
    console.log(chalk.green.bold(`\n\n========================\nPOP3 client connected from ${socket.remoteAddress}:${socket.remotePort}\n`));

    //Log Server writing
    const originalWrite = socket.write.bind(socket);
    socket.write = (data, encoding, callback) => {
        console.log(chalk.blue.bold('POP3 Server:'), data.toString().trim());
        return originalWrite(data, encoding, callback);
    };

    socket.write('+OK NodeJS POP3 Server ready\r\n');
    let authenticatedUser = null;

    socket.on('data', async data => {
        console.log(chalk.green.bold('POP3 Client:'), data.toString().trim());

        const message = data.toString().trim();
        const parts = message.split(' ');

        try {
            switch (parts[0].toUpperCase()) {

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

                case 'REGISTER':
                    const signupEmail = parts[1];
                    const signupPass = parts[2];
                    const exists = await doesUserExist(signupEmail);
                    if (exists) {
                        socket.write('-ERR User already exists\r\n');
                    } else {
                        await registerUser(signupEmail, signupPass);
                        socket.write('+OK User created\r\n');
                    }
                    break;

                case 'LIST':
                    if (!authenticatedUser) return socket.write('-ERR not authenticated\r\n');
                    const mails = await listMails(authenticatedUser);
                    let listResponse = `+OK ${mails.length} messages\r\n`;
                    mails.forEach((m, index) => {
                        // Modified to return: ID|Sender|Date
                        // We use '|' as a separator to avoid issues with spaces in the date string
                        listResponse += `${index + 1}|${m.from}|${m.createdAt}\r\n`;
                    });
                    listResponse += '.\r\n';
                    socket.write(listResponse);
                    break;

                case 'RETR':
                    if (!authenticatedUser) return socket.write('-ERR not authenticated\r\n');
                    const msgNum = parseInt(parts[1]) - 1;
                    const userMails = await listMails(authenticatedUser);
                    if (!userMails[msgNum]) return socket.write('-ERR no such message\r\n');
                    const mail = userMails[msgNum];
                    mail.read = true;
                    // Standard POP3 RETR format
                    socket.write(`+OK ${mail.body.length} octets\r\n`);
                    socket.write(`From: ${mail.from}\r\n`);
                    socket.write(`To: ${mail.to}\r\n`);
                    socket.write(`Subject: ${mail.subject}\r\n`);
                    socket.write(`${mail.body}\r\n.\r\n`);
                    break;

                case 'DELE':
                    if (!authenticatedUser) return socket.write('-ERR not authenticated\r\n');
                    const delNum = parseInt(parts[1]) - 1;
                    const userMailList = await listMails(authenticatedUser);
                    if (!userMailList[delNum]) return socket.write('-ERR no such message\r\n');
                    await deleteMail(userMailList[delNum]._id);
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

    socket.on('error', () => console.log(chalk.red.bold('\nPOP3 client disconnected unexpectedly\n========================')));

    socket.on('close', () => console.log(chalk.yellow.bold('\nPOP3 client closed connection safely\n========================')));
});