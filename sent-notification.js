import { supabase } from "../supabase.js"

export default async function handler(req, res) {
    try {
        const { data: notificationsDue, error: rpcError } = await supabase
            .rpc('check_and_send_notifications');

        if (rpcError) throw rpcError;

        if (!notificationsDue || notificationsDue.length === 0) {
            return res.status(200).json({ message: 'No new notifications due.' });
        }

        const logEntries = [];
        
        console.log(`Found ${notificationsDue.length} notifications due. Starting dispatch...`);

        for (const item of notificationsDue) {
            let message = '';
            
            // Core Business Logic: Determine notification message based on the day group
            if (item.due_day >= 10 && item.due_day <= 14) {
                // Includes days 10, 11, 12, 13, 14
                message = `Action required: Case ${item.case_number} (${item.title}) is in its initial review period (Days 10-14).`;
            } else if (item.due_day >= 15 && item.due_day <= 19) {
                // Includes days 15 through 19
                message = `URGENT FOLLOW-UP: Case ${item.case_number} has reached the mid-term review stage (Days 15-19).`;
            } else if (item.due_day >= 20 && item.due_day <= 24) {
                // Includes days 20 through 24
                message = `CRITICAL ACTION WINDOW: Case ${item.case_number} is in the 20-24 day phase. Finalize actions.`;
            } else if (item.due_day >= 25 && item.due_day <= 27) {
                // Includes days 25 through 27
                 message = `FINAL WARNING: Case ${item.case_number} is approaching the 28-day expiration threshold.`;
            } else {
                 message = `Case ${item.case_number} is due for a Day ${item.due_day} check.`;
            }

            // =========================================================
            // **TODO: INTEGRATE YOUR ACTUAL NOTIFICATION SENDER HERE**
            // You would call your email, push, or SMS service here.
            // Example: 
            // await sendEmail(item.user_id, item.title, message);
            // =========================================================
            
            console.log(`Dispatched Day ${item.due_day} notification for Case: ${item.case_id} to User: ${item.user_id}`);
            
            // Collect entries for batch logging
            logEntries.push({
                case_id: item.case_id,
                notification_day: item.due_day,
            });
        }
        
        // --- 4. LOG SENT NOTIFICATIONS (Deduplication) ---
        // Logs the actions to the notification_log table to prevent re-sending
        const { error: logError } = await supabase
            .from('notification_log')
            .insert(logEntries);

        if (logError) throw logError;

        return res.status(200).json({ 
            message: `Batch processed successfully. Sent ${notificationsDue.length} notifications.`,
            count: notificationsDue.length
        });

    } catch (error) {
        console.error('Sent Application Error:', error);
        return res.status(500).json({ error: "Internal server error during processing" });
    }
}