import { Client } from 'ssh2';
import net from 'net';
import chalk from 'chalk';

/**
 * Creates a local server that forwards traffic to a remote host via SSH.
 * @param {Object} sshConfig - { host, port, username, password }
 * @param {String} targetHost - The internal IP on the server side (usually 'localhost' relative to the server)
 * @param {Number} targetPort - The actual port of the service (SMTP: 25, POP3: 110)
 * @returns {Promise<Object>} - Returns the local port to connect to
 */
export const createTunnel = (sshConfig, targetHost, targetPort) => {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        
        // Create a local TCP server
        const localProxy = net.createServer((socket) => {
            // When our Client App connects to this proxy...
            // Ask SSH server to open a connection to the target (SMTP/POP3)
            conn.forwardOut(
                '127.0.0.1', socket.remotePort, // Source (us)
                targetHost, targetPort,         // Destination (remote service)
                (err, stream) => {
                    if (err) {
                        console.error(chalk.red('SSH Forward Error:'), err.message);
                        socket.end();
                        return;
                    }
                    // Pipe data: Local Client <-> SSH Tunnel <-> Remote Server
                    socket.pipe(stream);
                    stream.pipe(socket);
                }
            );
        });

        conn.on('ready', () => {
            // SSH Connected! Now start the local proxy server.
            // Listen on port 0 means "assign me any random available port"
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

        // Connect to the SSH Server
        conn.connect(sshConfig);
    });
};