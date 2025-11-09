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
                error: "Missing required fields.",
                details: "Required fields: case_number, title, priority, section_under_ipc, and assigned_officer_emails (must be an array)."
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

            if (lookupError) throw lookupError;

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
            throw error;
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
                throw joinError;
            }
        }

        res.status(201).json({ message: "New case created and officers assigned successfully.", });

    } catch (error) {
        console.error("New Case Error: ", error)
        return res.status(500).json({ error: "Internal server error during data processing" });
    }
}

async function getTotalCaseCount(req, res) {
    try {
        const officerId = req.params.user_id;

        // query to count specific user case
        const { count, error } = await supabase
            .from('case_users')
            .select('user_id', { count: 'exact', head: true }) 
            .eq('user_id', officerId);


        if (error) throw error;

        res.status(200).json({ total_cases_assigned: count || 0 });
    }
    catch (error) {
        console.error("Get total cases count error:", error);
        res.status(500).json({ error: "Internal server error during data processing" });
    }
}

async function getOfficersCaseCount(req, res) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('name, case_users!inner(count)');

        if (error) throw error;

        const cleanerData = data.map(user => ({
            name: user.name,
            count: user.case_users?.[0]?.count || 0 
        }));

        return res.status(200).json({ data: cleanerData });
    }
    catch (error) {
        console.error("Get Users case count error: ", error);
        return res.status(500).json({ error: "Internal server error during data processing" });
    }
}

export default {
    createNewCase,
    getTotalCaseCount,
    getOfficersCaseCount
}