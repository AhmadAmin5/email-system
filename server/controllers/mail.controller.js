import Mail from "../models/mail.model.js"

// Save a new mail
export const saveMail = async ({ from, to, subject, body }) => {
    try {
        const mail = new Mail({
            from,
            to,
            subject,
            body
        });
        await mail.save();
        return { success: true, mail };
    } catch (err) {
        console.error('saveMail error:', err);
        return { success: false, message: err.message };
    }
};

// List mails for a user (not deleted)
export const listMails = async (email) => {
    try {
        const mails = await Mail.find({ to: email, deleted: false }).sort({ createdAt: -1 });
        return mails;
    } catch (err) {
        console.error('listMails error:', err);
        return [];
    }
};

// Read a single mail by ID
export const readMail = async (id) => {
    try {
        const mail = await Mail.findById(_id);
        if (!mail) return null;

        // mark as read
        mail.read = true;
        await mail.save();

        return mail;
    } catch (err) {
        console.error('readMail error:', err);
        return null;
    }
};

// Delete mail (soft delete)
export const deleteMail = async (id) => {
    try {
        const mail = await Mail.findById(id);
        if (!mail) return { success: false, message: 'Mail not found' };

        mail.deleted = true;
        await mail.save();

        return { success: true };
    } catch (err) {
        console.error('deleteMail error:', err);
        return { success: false, message: err.message };
    }
};
