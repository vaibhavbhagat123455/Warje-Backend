import { supabase } from "./supabase.js";

async function cleanupExpiredTempUsers(req, res) {

    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ message: 'Unauthorized: Invalid cron secret.' });
    }

    try {
        const nowUTC = new Date().toISOString();

        const { count, error } = await supabase
            .from("temp_users")
            .delete()
            .lt("expiry_time", nowUTC) // 'lt' stands for "less than"
            .select("*", { count: "exact" });
            
        if (error) {
            console.error("Supabase Cleanup Error:", error);
            // Return 500 status on database failure
            return res.status(500).json({ 
                message: "Cleanup failed due to database error.", 
                error: error.message 
            });
        }

        console.log(`Successfully cleaned up ${count} expired temp_users entries.`);

        // Return a successful 200 response with the result
        return res.status(200).json({ 
            message: "OTP cleanup complete.", 
            deleted_count: count 
        });

    } catch (error) {
        console.error("Cleanup function failed:", error);
        return res.status(500).json({ message: "Internal server error during cleanup." });
    }
}

export default cleanupExpiredTempUsers;