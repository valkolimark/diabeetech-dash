# Diabeetech Admin Dashboard

A comprehensive administrative interface for managing the multi-tenant Nightscout platform.

## Overview

The Diabeetech Admin Dashboard provides superadministrators with complete control over:
- 🏢 **Tenant Management** - Create, update, suspend, and monitor tenants
- 👥 **User Management** - Manage users across all tenants
- 📊 **System Analytics** - Monitor system health and usage
- 📝 **Audit Logging** - Track all administrative actions
- 🔐 **Security Controls** - Manage access and permissions

## Technology Stack

- **Frontend**: React 17 + Material-UI 5
- **State Management**: React Hooks + Context API
- **Routing**: React Router 6
- **HTTP Client**: Axios
- **Build Tool**: Webpack 5
- **Styling**: Material-UI + Emotion

## Project Structure

```
admin-dashboard/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── Layout/       # App layout components
│   │   ├── Common/       # Shared components
│   │   └── Dialogs/      # Modal dialogs
│   ├── pages/            # Page components
│   │   ├── Dashboard/    # Overview dashboard
│   │   ├── Tenants/      # Tenant management
│   │   ├── Users/        # User management
│   │   └── Login/        # Authentication
│   ├── services/         # API services
│   │   ├── api.js        # Axios configuration
│   │   ├── auth.js       # Authentication service
│   │   └── config.js     # App configuration
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   └── App.js            # Main app component
├── dist/                 # Build output
├── webpack.config.js     # Webpack configuration
└── package.json          # Dependencies
```

## Development

### Prerequisites
- Node.js 14-20
- npm 6+

### Setup
```bash
# From the nightscout root directory
cd admin-dashboard

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

### Environment Variables
Configure in the main Nightscout app:
```bash
FEATURE_ADMIN_DASHBOARD=true
FEATURE_USER_MGMT=true
FEATURE_TENANT_MGMT=true
```

## Features

### 🏠 Dashboard
- System overview with key metrics
- Real-time statistics
- Quick access to common tasks
- System health monitoring

### 🏢 Tenant Management
- Create new tenants with custom settings
- Edit tenant configuration
- Suspend/activate tenants
- Monitor tenant usage
- Bulk operations support

### 👥 User Management
- View users across all tenants
- Create users with role assignment
- Password reset functionality
- Disable two-factor authentication
- User activity tracking

### 📊 Analytics (Coming Soon)
- Usage trends and patterns
- Growth metrics
- Performance analytics
- Custom reports

### 🔍 Audit Logging
- Comprehensive action tracking
- Searchable audit trail
- Export capabilities
- Compliance reporting

## API Integration

The dashboard communicates with the backend through RESTful APIs:

### Authentication
```javascript
POST   /api/v1/admin/auth/login
GET    /api/v1/admin/auth/user
POST   /api/v1/admin/auth/logout
```

### Tenants
```javascript
GET    /api/v1/admin/tenants
GET    /api/v1/admin/tenants/:id
POST   /api/v1/admin/tenants
PUT    /api/v1/admin/tenants/:id
DELETE /api/v1/admin/tenants/:id
```

### Users
```javascript
GET    /api/v1/admin/users
GET    /api/v1/admin/users/:id
POST   /api/v1/admin/users
PUT    /api/v1/admin/users/:id
DELETE /api/v1/admin/users/:id
```

## Security

- JWT-based authentication
- Secure cookie storage
- HTTPS-only in production
- Role-based access control
- Audit logging of all actions

## Building for Production

The production build is handled by the main Nightscout build process:

```bash
# From nightscout root
npm run build:admin
```

This will:
1. Build the React app
2. Generate optimized bundles
3. Create the HTML entry point
4. Copy assets to the correct locations

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Ensure tests pass
4. Submit a pull request

### Code Style
- Use ESLint configuration
- Follow Material-UI best practices
- Keep components small and focused
- Write meaningful commit messages

## Troubleshooting

### Common Issues

**Build fails with module errors**
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

**Changes not reflecting**
- Clear browser cache
- Ensure webpack dev server is running
- Check for build errors

**API calls failing**
- Verify backend is running
- Check authentication token
- Inspect network requests

## Documentation

- [Complete Admin Guide](../docs/ADMIN-DASHBOARD-GUIDE.md)
- [Quick Start Guide](../docs/ADMIN-QUICK-START.md)
- [API Reference](../docs/admin-api-reference.md)
- [Next Steps & Roadmap](../docs/ADMIN-DASHBOARD-NEXT-STEPS.md)

## License

This project is part of the Nightscout project and follows the same license terms.

## Support

For issues or questions:
- Check the documentation
- Review existing issues
- Contact the development team

---

Built with ❤️ for the Diabeetech community