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

async function getActiveCaseCount(req, res) {
    const officerId = req.params.user_id;

    if (!officerId) {
        return res.status(400).json({ error: "Missing user_id parameter" });
    }
    try {
        const { data, count, error } = await supabase
            .from('case_users')
            .select(
                `
                case_id,
                cases!inner (
                status
                )
                `,
                { count: 'exact' }
            )
            .eq('user_id', officerId)
            .eq('cases.status', 'Pending');

        if (error) return error;

        return res.status(200).json({ ActiveCaseCount: count || 0 });
    }
    catch (error) {
        console.log("Get Active error: ", error);
        return res.status(500).json({ error: "Internal server error during data processing" })
    }
}

async function getCompletedCaseCount(req, res) {
    const officerId = req.params.user_id;

    if (!officerId) {
        return res.status(400).json({ error: "Missing user_id parameter" });
    }
    try {
        const { data, count, error } = await supabase
            .from('case_users')
            .select(
                `
                case_id,
                cases!inner (
                status
                )
                `,
                { count: 'exact' }
            )
            .eq('user_id', officerId)
            .eq('cases.status', 'Completed');

        if (error) return error;

        return res.status(200).json({ CompletedCaseCount: count || 0 });
    }
    catch (error) {
        console.log("Get Completed error: ", error);
        return res.status(500).json({ error: "Internal server error during data processing" })
    }
}

function formatDate(dateString) {
    if (!dateString) return null;

    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // +1 because months are 0-indexed
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
}

async function getCaseById(req, res) {
    const officerId = req.params.user_id;

    // 1. Validate input
    if (!officerId) {
        return res.status(400).json({ error: "Missing user_id parameter" });
    }

    try {
        // 2. Define the Supabase query
        const selectString = "cases(case_number, title, status, priority, created_at, deadline, section_under_ipc)";

        // 3. Fetch data from Supabase
        const { data, error } = await supabase
            .from('case_users')
            .select(selectString)
            .eq('user_id', officerId);

        if (error) throw error;

        if (data) {
            const processedData = data.map(item => {
                if (item.cases) {
                    item.cases.created_at_yyyymmdd = formatDate(item.cases.created_at);
                }
                return item;
            });

            return res.status(200).json({ caseInfo: processedData }); _
        }

    }
    catch (error) {
        console.error("Get case error: ", error);
        return res.status(500).json({ error: "Internal server error during data processing." });
    }
}

async function getCaseByEmailId(req, res) {
    const { email_id } = req.body

    if (!email_id) {
        return res.status(400).json({ error: "Missing Email Id" });
    }

    try {
        const { data, error } = await supabase
            .from('case_users')
            .select(`
                    cases(
                    case_id, 
                    title, 
                    status, 
                    deadline, 
                    priority, 
                    created_at, 
                    case_number, 
                    section_under_ipc
                    ),             
                    users!inner(email_id) 
                `)
            .eq('users.email_id', email_id);

        if (error) throw error;

        if (data && data.length > 0) {
            
            const caseList = data.map(item => item.cases);

            const processedCaseList = caseList.map(caseItem => {
                if (caseItem) {
                    caseItem.created_at_yyyymmdd = formatDate(caseItem.created_at);
                }
                return caseItem;
            });

            return res.status(200).json({ caseInfo: processedCaseList });

        } else {
            return res.status(200).json({ caseInfo: [] });
        }

    }
    catch (error) {
        console.error("Get case error: ", error);
        return res.status(500).json({ error: "Internal server error during data processing." });
    }
}

async function updateCase(req, res) {
    try {
        // Retrieve sanitized data from the interceptor
        const case_id = req.validCaseId;
        const updates = req.validCaseUpdates;

        const { data: updatedCase, error } = await supabase
            .from("cases")
            .update(updates)
            .eq("case_id", case_id)
            .select("case_number, title, status, priority, deadline, section_under_ipc") 
            .single();

        if (error) throw error;

        // 2. Handle Not Found
        if (!updatedCase) {
            return res.status(404).json({ error: "Case not found." });
        }

        // 3. Success
        res.status(200).json({ 
            message: "Case updated successfully", 
            case: updatedCase 
        });

    } catch (error) {
        console.error("Update Case Error:", error);
        res.status(500).json({ error: "Internal server error during case update." });
    }
}

async function deleteCase(req, res) {
    try {
        const case_id = req.validCaseId; 

        // 1. Perform Delete
        const { error } = await supabase
            .from("cases")
            .delete()
            .eq("case_id", case_id);

        if (error) throw error;

        // 2. Success Response
        res.status(200).json({ message: "Case deleted successfully" });

    } catch (error) {
        console.error("Delete Case Error:", error);
        if (error.code === '23503') {
            return res.status(409).json({ 
                error: "Cannot delete case because it has related records (evidence, officers). Please clear them first." 
            });
        }
        res.status(500).json({ error: "Internal server error during case deletion." });
    }
}

export default {
    createNewCase,
    getTotalCaseCount,
    getOfficersCaseCount,
    getActiveCaseCount,
    getCompletedCaseCount,
    getCaseById,
    getCaseByEmailId,
    updateCase,
    deleteCase
}