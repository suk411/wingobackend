// File: src/models/User.js
// User model for Supabase (Player accounts)

import { supabaseAdmin } from '../config/supabase.js';

export class User {
  static async create(adminId, username, passwordHash) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert([
        {
          admin_id: adminId,
          username,
          password_hash: passwordHash,
          status: 'ACTIVE'
        }
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async findByUsername(adminId, username) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('admin_id', adminId)
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message); // PGRST116 = no rows
    return data || null;
  }

  static async findById(userId) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data || null;
  }

  static async findByAdminId(adminId, page = 0, limit = 20) {
    const from = page * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })
      .eq('admin_id', adminId)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return { data, count };
  }

  static async updateStatus(userId, status) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ status })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async updateLastLogin(userId) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ last_login: new Date() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async delete(userId) {
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw new Error(error.message);
    return true;
  }

  static async count(adminId) {
    const { count, error } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact' })
      .eq('admin_id', adminId);

    if (error) throw new Error(error.message);
    return count;
  }
}

export default User;
