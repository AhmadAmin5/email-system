import User from '../models/user.model.js'
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10; // for hashing passwords

// Register a new user
export const registerUser = async (email, password) => {
    try {

        const exists = await User.findOne({ email });
        if (exists) return { success: false, message: 'User already exists' };

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const user = new User({ email, password: hashedPassword });
        await user.save();

        return { success: true, user };
    } catch (err) {
        console.error('registerUser error:', err);
        return { success: false, message: err.message };
    }
};

// Validate user credentials
export const validateUser = async (email, password) => {
    try {
        const user = await User.findOne({ email });
        if (!user) return false;

        const isMatch = await bcrypt.compare(password, user.password);
        return isMatch;
    } catch (err) {
        console.error('validateUser error:', err);
        return false;
    }
};

// Check if a user exists (boolean)
export const doesUserExist = async (email) => {
    try {
        const user = await User.findOne({ email });
        return !!user;
    } catch (err) {
        console.error('doesUserExist error:', err);
        return false;
    }
};
