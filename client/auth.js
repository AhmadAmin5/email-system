import net from "net";
import chalk from "chalk";
import { ask, askHidden, askWithValidation, printHeader, holdScreen } from './input.js';
import { isValidEmail, isValidPassword } from './validations.js';

const login = async () => {
    var option = 0;

    while (option != 3) {
        printHeader("Welcome to Email System");

        console.log(chalk.green("Please identify yourself:\n"));
        console.log(chalk.white(" 1) ") + chalk.bold("Login"));
        console.log(chalk.white(" 2) ") + chalk.bold("Register"));
        console.log(chalk.white(" 3) ") + chalk.redBright("Exit"));
        console.log("");

        option = await ask(chalk.blue("Choose your option: "));

        if (option == "1") {
            try {
                const user = await performAuthAction('LOGIN');
                return user;
            } catch (err) {
                // Wait for user to read the error before clearing screen
                await holdScreen();
            }
        } else if (option == "2") {
            try {
                const user = await performAuthAction('REGISTER');
                console.log(chalk.green("\n✔ Registration successful! Please login."));
                await holdScreen();
            } catch (err) {
                await holdScreen();
            }
        } else if (option == "3") {
            return null;
        } else {
            console.log(chalk.red("\n  ✖ Invalid option."));
            await new Promise(r => setTimeout(r, 1000));
        }
    }
};

const performAuthAction = async (actionType) => {
    printHeader(actionType === 'LOGIN' ? "Login" : "Register New Account");
    
    const email = await askWithValidation(
        chalk.green("Enter email:    "), 
        isValidEmail, 
        "Please enter a valid email address."
    );
    
    let password = "";
    if (actionType === 'REGISTER') {
        while(true) {
            password = await askHidden(chalk.green("Enter password: "));
            if(isValidPassword(password)) break;
            console.log(chalk.red("  ✖ Password must be at least 4 characters long.\n"));
        }
    } else {
        password = await askHidden(chalk.green("Enter password: "));
    }

    return new Promise((resolve, reject) => {
        const socket = net.createConnection(parseInt(process.env.AUTH_PORT), process.env.AUTH_HOST);

        socket.on("connect", () => {
            socket.write(`${actionType} ${email} ${password}\r\n`);
        });

        socket.on("data", (data) => {
            const msg = data.toString().trim();
            socket.end();

            if (msg.startsWith("+OK")) {
                resolve({ email, password });
            } else {
                const errorMsg = msg.substring(5) || "Authentication failed";
                console.log(chalk.red(`\n✖ ${errorMsg}`));
                reject(new Error(errorMsg));
            }
        });

        socket.on("error", (err) => {
            console.log(chalk.red(`\n✖ Connection Error: ${err.message}`));
            console.log(chalk.gray(`(Check if server is running on ${process.env.AUTH_HOST}:${process.env.AUTH_PORT})`));
            reject(err);
        });
    });
};

export default login;