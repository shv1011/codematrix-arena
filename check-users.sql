-- Check existing users and their roles
SELECT 'Current users in auth.users:' as info;

SELECT 
    u.id,
    u.email,
    u.created_at,
    ur.role
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.email;

-- Count users by role
SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE ur.role = 'admin') as admin_users,
    COUNT(*) FILTER (WHERE ur.role = 'supervisor') as supervisor_users,
    COUNT(*) FILTER (WHERE ur.role = 'user') as regular_users,
    COUNT(*) FILTER (WHERE ur.role IS NULL) as users_without_roles
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id;