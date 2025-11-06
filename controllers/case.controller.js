import { supabase } from "../supabase.js"

async function createNewCase(req, res) {
    try {
        const {
            case_number,
            title,
            priority,
            deadline,
            section_under_ipc,
            assigned_officer_email 
        } = req.body;

        let assigned_officer_id = null; 

        // Look up the officer's UUID using the email
        if (assigned_officer_email) {
            const { data: officer, error: lookupError } = await supabase
                .from("users")
                .select("user_id")
                .eq("email_id", assigned_officer_email.toLowerCase().trim())
                .single();

            // Check for Supabase error where 0 rows were found (no officer with that email)
            if (lookupError && lookupError.code === 'PGRST116') {
                return res.status(404).json({ 
                    message: `Officer with email ${assigned_officer_email} not found in the database.` 
                });
            }
            
            // Check for other unexpected database errors during lookup
            if (lookupError) { 
                throw lookupError; 
            }

            // Assign the found UUID
            assigned_officer_id = officer.user_id;
        }

        // Construct the data payload using the resolved UUID
        const newCaseData = {
            case_number: case_number.trim(),
            title: title.trim(),
            priority,
            ...(deadline && { deadline }),
            ...(section_under_ipc && { section_under_ipc }),
            assigned_officer_id, 
        };

        //Execute the insert query
        const { data: insertedCase, error: insertError } = await supabase
            .from("cases")
            .insert([newCaseData])
            .select('case_id, case_number, title, status, created_at, assigned_officer_id')
            .single();

        if (insertError) {
            // Handle unique constraint violation (case_number already exists)
            if (insertError.code === '23505') { 
                return res.status(409).json({ message: "Case Number already exists." });
            }
            throw insertError; 
        }

        res.status(201).json({
            message: "New case created successfully.",
        });

    } catch (error) {
        console.error("Error creating new case:", error);
        res.status(500).json({ 
            message: "Failed to create new case. An internal server error occurred." 
        });
    }
}

async function getTotalCasesAssigned(req, res) {
    try {
        const officerId = req.params.id; 

        // Supabase Query to Count Cases
        const { data, count, error } = await supabase
            .from('cases')
            .select('*', { count: 'exact' }) // Set count: 'exact' here
            .eq('assigned_officer_id', officerId);
            

        if (error) {
            console.error("Error:", error);
            return res.status(500).json({ 
                message: "Failed to fetch case count due to database error." 
            });
        }
        
        res.status(200).json({
            officer_id: officerId,
            total_cases_assigned: count
        });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ 
            message: "Internal server error while retrieving case count." 
        });
    }
}

export default {
    createNewCase,
    getTotalCasesAssigned
}