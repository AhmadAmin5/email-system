import net from "net";
import chalk from "chalk";
import { ask, askHidden, askWithValidation, printHeader, holdScreen } from './input.js';
import { isValidEmail, isValidPassword } from './validations.js';

const login = async () => {
    while (true) {
        printHeader("Welcome to Email System");

        console.log(chalk.green("Please identify yourself:\n"));
        console.log(chalk.white(" 1) ") + chalk.bold("Login"));
        console.log(chalk.white(" 2) ") + chalk.bold("Register"));
        console.log("");

        const option = await ask(chalk.blue("Choose your option: "));

        if (option == "1") {
            try {
                const user = await loginPOP3();
                return user;
            } catch (err) {
                // Error handled in loginPOP3
            }
        } else if (option == "2") {
            try {
                const user = await registerPOP3();
                console.log(chalk.green("\n✔ Registration successful! Please login."));
                await holdScreen();
            } catch (err) {
                console.log(chalk.red("\n✖ Registration failed."));
                await holdScreen();
            }
        } else {
            console.log(chalk.red("\n  ✖ Invalid option."));
            await new Promise(r => setTimeout(r, 1000));
        }
    }
};

const loginPOP3 = async () => {
    printHeader("Login");
    
    const email = await askWithValidation(
        chalk.green("Enter email:    "), 
        isValidEmail, 
        "Please enter a valid email address (e.g., user@example.com)"
    );
    
    // For login, we don't strictly validate password complexity client-side (security best practice), 
    // but we ensure it's not empty.
    const password = await askHidden(chalk.green("Enter password: "));

    return new Promise((resolve, reject) => {
        const socket = net.createConnection(parseInt(process.env.POP3_PORT), process.env.POP3_HOST);

        let step = 0;

        socket.on("data", (data) => {
            const msg = data.toString().trim();

            if (msg.startsWith("-ERR") && step > 0) {
                console.log(chalk.red(`\nLogin failed: ${msg.substring(5)}`));
                socket.end();
                setTimeout(() => reject(new Error(msg)), 1500); 
                return;
            }

            switch (step) {
                case 0:
                    socket.write(`USER ${email}\r\n`);
                    step++;
                    break;
                case 1:
                    socket.write(`PASS ${password}\r\n`);
                    step++;
                    break;
                case 2:
                    if (msg.startsWith("+OK")) {
                        socket.end();
                        resolve({ email, password });
                    } else {
                        console.log(chalk.red("\n✖ Invalid credentials"));
                        socket.end();
                        setTimeout(() => reject(new Error("Invalid credentials")), 1500);
                    }
                    break;
                default:
                    break;
            }
        });

        socket.on("error", (err) => reject(err));
    });
};

const registerPOP3 = async () => {
    printHeader("Register New Account");

    const email = await askWithValidation(
        "Enter new email: ",
        isValidEmail,
        "Invalid email format."
    );

    // Validate password strength (e.g. min 4 chars)
    let password = "";
    while(true) {
        password = await askHidden("Enter password:  ");
        if(isValidPassword(password)) break;
        console.log(chalk.red("  ✖ Password must be at least 4 characters long.\n"));
    }

    return new Promise((resolve, reject) => {
        const socket = net.createConnection(parseInt(process.env.POP3_PORT), process.env.POP3_HOST);

        let step = 0;

        socket.on("data", (data) => {
            const msg = data.toString().trim();

            if (msg.startsWith("-ERR") && step > 0) {
                console.error(chalk.red(`\nError: ${msg.substring(5)}`));
                socket.end();
                reject(new Error(msg));
                return;
            }

            switch (step) {
                case 0:
                    socket.write(`REGISTER ${email} ${password}\r\n`);
                    step++;
                    break;
                case 1:
                    if (msg.startsWith("+OK")) {
                        socket.end();
                        resolve({ email, password });
                    } else {
                        console.error(chalk.red(`\nRegistration failed: ${msg}`));
                        socket.end();
                        reject(new Error(msg));
                    }
                    socket.end();
                    break;
                default:
                    break;
            }
        });

        socket.on("error", (err) => reject(err));
    });
};

export default login;