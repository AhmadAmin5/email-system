import readline from "readline";
import chalk from "chalk";

export const ask = (question) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question(chalk.bold(question), answer => {
        rl.close();
        resolve(answer);
    }));
};

export const askHidden = (question) => {
    return new Promise((resolve) => {
        const stdin = process.stdin;
        const stdout = process.stdout;

        stdout.write(chalk.bold(question));

        stdin.resume();
        stdin.setRawMode(true);
        let password = '';

        const onData = (char) => {
            char = char + '';
            switch (char) {
                case '\r':
                case '\n':
                case '\u0004':
                    stdout.write('\n');
                    stdin.setRawMode(false);
                    stdin.removeListener('data', onData);
                    resolve(password);
                    break;
                case '\u0003':
                    process.exit();
                    break;
                default:
                    stdout.write('*');
                    password += char;
                    break;
            }
        };

        stdin.on('data', onData);
    });
};

export const askWithValidation = async (question, validationFn, errorMessage) => {
    while (true) {
        const answer = await ask(question);
        if (validationFn(answer)) {
            return answer;
        }
        console.log(chalk.red(`  ✖ ${errorMessage}\n`));
    }
};

export const holdScreen = () => {
    return new Promise(resolve => {
        console.log(chalk.gray("\nPress any key to continue..."));
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', data => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            resolve(data.toString());
        });
    });
};

export const printHeader = (title) => {
    console.clear();
    const width = 60;
    const line = '='.repeat(width);
    const padding = Math.max(0, Math.floor((width - title.length) / 2));
    const titleLine = ' '.repeat(padding) + title.toUpperCase();
    
    console.log(chalk.cyan.bold(line));
    console.log(chalk.cyan.bold(titleLine));
    console.log(chalk.cyan.bold(line));
    console.log('\n');
};