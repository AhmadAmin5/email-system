import mongoose, { Schema } from "mongoose";

const mailSchema = new mongoose.Schema(
    {
        from: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },

        to: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        subject: {
            type: String,
            required: true
        },
        body: {
            type: String,
            required: true
        },

        read: {
            type: Boolean,
            default: false
        },

        deleted: {
            type: Boolean,
            default: false
        },
    },
    {
        timestamps: true
    }
);



const Mail = mongoose.model("Mail", mailSchema);

export default Mail;
