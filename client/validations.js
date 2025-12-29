export const isValidEmail = (email) => {
    // Basic regex for email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const isValidPassword = (password) => {
    // Password must be at least 4 characters
    return password && password.length >= 4;
};

export const isNotEmpty = (str) => {
    return str && str.trim().length > 0;
};