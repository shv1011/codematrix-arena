-- Create Admin User for CodeWars 2.0
-- Run this script in Supabase SQL Editor after creating the user in Auth

-- First, you need to create a user in Supabase Auth Dashboard or through signup
-- Then run this script to assign admin role

-- Replace 'admin@example.com' with the actual admin email
-- Replace the UUID with the actual user ID from auth.users table

-- Method 1: If you know the user's email, use this function
SELECT public.assign_user_role('admin@example.com', 'admin');

-- Method 2: If you know the user's UUID, insert directly
-- Replace 'your-user-uuid-here' with actual UUID from auth.users
-- INSERT INTO public.user_roles (user_id, role) VALUES 
-- ('your-user-uuid-here', 'admin')
-- ON CONFLICT (user_id, role) DO NOTHING;

-- Method 3: Create multiple admin users at once
-- Replace emails with actual admin emails
/*
SELECT public.assign_user_role('admin1@example.com', 'admin');
SELECT public.assign_user_role('admin2@example.com', 'admin');
SELECT public.assign_user_role('supervisor1@example.com', 'supervisor');
*/

-- Verify admin users were created
SELECT 
    u.email,
    ur.role,
    ur.id as role_id
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.role IN ('admin', 'supervisor')
ORDER BY ur.role, u.email;

-- Check if the assign_user_role function exists
SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'assign_user_role' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
) as function_exists;