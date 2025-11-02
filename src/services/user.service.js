import { supabase } from '../../supabase.js';

export class UserService {
  static async findByEmail(email_id) {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email_id", email_id)
      .single();
    
    if (error) throw error;
    return user;
  }

  static async create(userData) {
    const { data, error } = await supabase
      .from("users")
      .insert([userData])
      .select();
    
    if (error) throw error;
    return data[0];
  }
}