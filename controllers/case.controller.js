import { supabase } from "../supabase.js"

async function createNewCase(req, res) {
    try {
        const {
            case_number,
            title,
            priority,
            deadline,
            section_under_ipc,
            assigned_officer_emails
        } = req.body;

        if (!case_number || !title || !priority || !Array.isArray(assigned_officer_emails) || !section_under_ipc) {
            return res.status(400).json({
                message: "Missing required fields: case_number, title, priority, Sections, or assigned_officer_emails array."
            });
        }

        let officerIds = [];

        if (assigned_officer_emails && assigned_officer_emails.length > 0) {
            // Standardize emails (lowercase and trim) for accurate database lookup
            const cleanEmails = assigned_officer_emails.map(email => email.toLowerCase().trim());

            const { data: officers, error: lookupError } = await supabase
                .from("users")
                .select("user_id, email_id")
                .in("email_id", cleanEmails);

            if (lookupError) {
                return res.status(500).json({ error: "Internal server error" });
            }

            // If the number of found officers doesn't match the number of emails provided, some are missing.
            if (!officers || officers.length !== cleanEmails.length) {

                // Identify which emails were not found in the 'users' table
                const foundVerifiedEmails = new Set(officers.map(o => o.email_id));
                const missingOrUnverifiedEmails = cleanEmails.filter(email => !foundVerifiedEmails.has(email));

                return res.status(404).json({
                    message: "One or more assigned officers not found or are not verified.",
                    missing_or_unverified_officers: missingOrUnverifiedEmails
                });
            }

            // Extract the user_ids from the found officer objects
            officerIds = officers.map(officer => officer.user_id);
        }
        const newCaseData = {
            case_number: case_number.trim(),
            title: title.trim(),
            priority,
            // Conditionally include deadline if it was provided
            ...(deadline && { deadline }),
            ...(section_under_ipc && { section_under_ipc }),
        };

        const { data: insertedCase, error: insertError } = await supabase
            .from("cases")
            .insert([newCaseData])
            .select('case_id')
            .single();

        if (insertError) {
            if (insertError.code === '23505') {
                return res.status(409).json({ message: "Case Number already exists." });
            }
            throw insertError;
        }

        const newCaseId = insertedCase.case_id;

        if (officerIds.length > 0) {
            const joinRecords = officerIds.map(userId => ({
                case_id: newCaseId,
                user_id: userId,
            }));

            // Batch insert the assignment records
            const { error: joinError } = await supabase
                .from("case_users")
                .insert(joinRecords);

            if (joinError) {
                console.error("Error creating join records:", joinError);
                return res.status(500).json({ message: "Case created but failed to assign officers." });
            }
        }

        res.status(201).json({ message: "New case created and officers assigned successfully.", });

    } catch (error) {
        console.log("New Case Error: ", error)
        return res.status(500).json({ error: "Internal server error" });
    }
}

async function getTotalCaseCount(req, res) {
    try {
        const officerId = req.params.id;

        // Supabase Query to Count Cases
        const { count, error } = await supabase
            .from('case_users')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', officerId);

        if (error) {
            return res.status(500).json({
                message: "Failed to fetch case count due to database error."
            });
        }

        res.status(200).json({ total_cases_assigned: count });

    } 
    catch (error) {
        console.error("Get total cases count error:", error);
        res.status(500).json({ error: "Internal server error." });
    }
}

async function getVerifiedUserCasesCount(req, res) {
    try {
        const { data: verifiedUsersWithCaseCount, error } = await supabase
            .from("users")
            .select(
                `
                name,
                case_users(count)
                `
            )
            .eq('is_verified', true)
            .order('name', { ascending: true });

        if (error) {
            console.error("Supabase Error fetching verified users:", error);
            return res.status(500).json({ success: false, message: "Database query failed." });
        }

        if (!verifiedUsersWithCaseCount || verifiedUsersWithCaseCount.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        const finalData = verifiedUsersWithCaseCount.map(user => ({
            name: user.name,
            case_count: user.case_users[0]?.count || 0
        }));

        return res.status(200).json({
            success: true,
            data: finalData
        });
    }
    catch (error) {
        console.error("Internal Server Error: ", error);
        return res.status(500).json({ success: false, message: "An unexpected internal server error occurred." });
    }
}

export default {
    createNewCase,
    getTotalCaseCount,
    getVerifiedUserCasesCount

}