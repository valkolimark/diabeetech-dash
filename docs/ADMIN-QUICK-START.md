# Diabeetech Admin Dashboard - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Access the Dashboard
1. Navigate to: `https://btech-d038118b5224.herokuapp.com/admin`
2. Login with SuperAdmin credentials:
   - Email: `superadmin@diabeetech.net`
   - Password: `Db#SuperAdmin2025!Secure`

### Step 2: Dashboard Overview
Once logged in, you'll see:
- **System Stats**: Total tenants, users, and active users
- **System Health**: Memory usage and uptime
- **Quick Actions**: Links to manage tenants and users

## 🎯 Common Tasks

### Managing Tenants

#### View All Tenants
1. Click "Tenants" in the sidebar
2. Use search box to find specific tenants
3. Click on any tenant for detailed view

#### Create New Tenant
1. Click "Tenants" → "Add Tenant" button
2. Fill in required fields:
   - Tenant Name
   - Subdomain (unique identifier)
   - Contact Email
   - Settings (units, time format)
3. Click "Create Tenant"

#### Suspend a Tenant
1. Find the tenant in the list
2. Click the menu (⋮) → "Suspend"
3. Enter reason for suspension
4. Confirm action

### Managing Users

#### View All Users
1. Click "Users" in the sidebar
2. Filter by tenant or role if needed
3. Search by name, email, or username

#### Create New User
1. Click "Users" → "Add User" button
2. Fill in required fields:
   - Email Address
   - Full Name
   - Password
   - Role (admin/user)
   - Tenant Assignment
3. Click "Create User"

#### Reset User Password
1. Find the user in the list
2. Click the menu (⋮) → "Reset Password"
3. Enter new password
4. User will be required to change on next login

### Viewing Audit Logs
1. Click "Audit Logs" in the sidebar
2. Filter by:
   - Date range
   - User performing action
   - Action type
   - Affected resource
3. Export logs if needed

## ⚡ Keyboard Shortcuts

- `Ctrl/Cmd + K` - Quick search
- `Ctrl/Cmd + N` - New tenant/user (context-aware)
- `Esc` - Close dialogs
- `?` - Show keyboard shortcuts

## 📊 Understanding the Metrics

### Tenant Health Indicators
- 🟢 **Active**: Tenant is operational
- 🟡 **Warning**: High resource usage or pending issues
- 🔴 **Suspended**: Tenant access is disabled
- ⚫ **Inactive**: No activity for 30+ days

### User Status
- **Active**: Can login normally
- **Pending**: Awaiting email verification
- **Suspended**: Temporarily disabled
- **Inactive**: No login for 30+ days

## 🔍 Search Tips

### Global Search
- Use quotes for exact matches: `"John Doe"`
- Search by email domain: `@clinic.com`
- Filter by status: `status:active`
- Combine filters: `clinic status:active`

### Advanced Filters
1. Click the filter icon (🔽)
2. Select multiple criteria
3. Save frequent filters for quick access

## ⚠️ Important Actions

### Before Deleting a Tenant
1. Check active users count
2. Review recent activity
3. Consider suspension instead
4. Export data if needed
5. Confirm deletion (irreversible!)

### Before Deleting a User
1. Check tenant assignment
2. Review user's recent activity
3. Consider deactivation instead
4. Transfer ownership if needed

## 🛟 Getting Help

### In-App Help
- Click the help icon (?) in the top bar
- Hover over any field for tooltips
- Check the status bar for hints

### Common Issues

**Can't see certain features?**
- Some features may be disabled by feature flags
- Contact system administrator to enable

**Actions failing?**
- Check your internet connection
- Refresh the page
- Check if your session expired

**Data not updating?**
- Click the refresh button
- Check filters aren't hiding results
- Wait a moment for real-time updates

## 📱 Mobile Access

The admin dashboard is responsive and works on mobile devices:
1. Use the hamburger menu (☰) to access navigation
2. Swipe left/right on tables to see all columns
3. Long-press for context menus

## 🔐 Security Best Practices

1. **Logout when done** - Don't leave sessions open
2. **Use strong passwords** - Change default passwords
3. **Monitor audit logs** - Check for unusual activity
4. **Limit admin access** - Only give to trusted users
5. **Regular reviews** - Audit user access monthly

## 💡 Pro Tips

1. **Bulk Operations**: Select multiple items with checkboxes
2. **Export Data**: Use the export button for reports
3. **Saved Views**: Save frequently used filters
4. **Quick Actions**: Right-click for context menus
5. **Real-time Updates**: Keep dashboard open for live data

## 📞 Need More Help?

- **Documentation**: `/docs/ADMIN-DASHBOARD-GUIDE.md`
- **API Reference**: Available in the help menu
- **Support Email**: support@diabeetech.net
- **Emergency**: Check system status page

---

**Remember**: With great power comes great responsibility. Always double-check before making system-wide changes!