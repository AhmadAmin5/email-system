import net from 'net';
import chalk from 'chalk';
import { registerUser, validateUser, doesUserExist } from './controllers/user.controller.js';

export default net.createServer(socket => {
    console.log(chalk.green.bold(`\n\n========================\nAuth Client connected from ${socket.remoteAddress}:${socket.remotePort}\n`));

    // Helper to log server responses
    const send = (msg) => {
        console.log(chalk.blue.bold('Auth Server:'), msg.trim());
        socket.write(msg + '\r\n');
    };

    socket.on('data', async data => {
        const message = data.toString().trim();
        console.log(chalk.green.bold('Auth Client:'), message);

        const parts = message.split(' ');
        const cmd = parts[0].toUpperCase();

        try {
            switch (cmd) {
                case 'LOGIN':
                    // Format: LOGIN <email> <password>
                    if (parts.length < 3) {
                        send('-ERR Usage: LOGIN <email> <password>');
                        return;
                    }
                    const loginEmail = parts[1];
                    const loginPass = parts[2];

                    if (await validateUser(loginEmail, loginPass)) {
                        send('+OK Login successful');
                    } else {
                        send('-ERR Invalid credentials');
                    }
                    break;

                case 'REGISTER':
                    // Format: REGISTER <email> <password>
                    if (parts.length < 3) {
                        send('-ERR Usage: REGISTER <email> <password>');
                        return;
                    }
                    const regEmail = parts[1];
                    const regPass = parts[2];

                    if (await doesUserExist(regEmail)) {
                        send('-ERR User already exists');
                    } else {
                        const result = await registerUser(regEmail, regPass);
                        if (result.success) {
                            send('+OK Registration successful');
                        } else {
                            send(`-ERR ${result.message}`);
                        }
                    }
                    break;

                default:
                    send('-ERR Unknown command');
                    break;
            }
        } catch (err) {
            console.error('Auth Server Error:', err);
            send('-ERR Internal server error');
        }
    });

    socket.on('error', (err) => {
        console.log(chalk.red.bold(`\nAuth client ${socket.remotePort} error: ${err.message}\n========================`));
    });

    socket.on('close', () => {
        console.log(chalk.yellow.bold(`\nAuth client ${socket.remotePort} closed connection\n========================`));
    });
});