import { Client } from 'ssh2';
import net from 'net';
import chalk from 'chalk';

export const createTunnel = (sshConfig, targetHost, targetPort) => {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        
        const localProxy = net.createServer((socket) => {
            conn.forwardOut(
                '127.0.0.1', socket.remotePort, // Source (us)
                targetHost, targetPort,         // Destination (remote service)
                (err, stream) => {
                    if (err) {
                        console.error(chalk.red('SSH Forward Error:'), err.message);
                        socket.end();
                        return;
                    }
                    socket.pipe(stream);
                    stream.pipe(socket);
                }
            );
        });

        conn.on('ready', () => {
            localProxy.listen(0, '127.0.0.1', () => {
                const assignedPort = localProxy.address().port;
                console.log(chalk.blue(`✔ SSH Tunnel established: localhost:${assignedPort} -> ${targetHost}:${targetPort}`));
                resolve({ 
                    localPort: assignedPort,
                    close: () => conn.end() 
                });
            });
        });

        conn.on('error', (err) => {
            reject(err);
        });

        conn.connect(sshConfig);
    });
};