import React from 'react';
import { useQuery } from 'react-query';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  Business,
  People,
  Storage,
  Speed,
  TrendingUp,
  CheckCircle,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { adminApi } from '../services/api';

// Stat card component
function StatCard({ title, value, icon, color = 'primary', subtitle }) {
  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}.light`,
              borderRadius: '50%',
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {React.cloneElement(icon, { 
              sx: { fontSize: 30, color: `${color}.main` } 
            })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// System health indicator
function SystemHealth({ health }) {
  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'unhealthy': return 'error';
      default: return 'default';
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        System Health
      </Typography>
      <Box sx={{ mt: 2 }}>
        {Object.entries(health.checks || {}).map(([key, value]) => (
          <Box key={key} sx={{ mb: 2 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Typography>
              <CheckCircle 
                color={getHealthColor(value.status)} 
                fontSize="small" 
              />
            </Box>
            {value.usage && (
              <Box sx={{ mt: 1 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={parseFloat(value.usage.percent)} 
                  color={parseFloat(value.usage.percent) > 80 ? 'warning' : 'primary'}
                />
                <Typography variant="caption" color="textSecondary">
                  {value.usage.percent}% used
                </Typography>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

function Dashboard() {
  // Fetch overview data
  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery(
    'overview',
    () => adminApi.getOverview().then(res => res.data),
    { refetchInterval: 60000 } // Refresh every minute
  );

  // Fetch system health
  const { data: health, isLoading: healthLoading } = useQuery(
    'health',
    () => adminApi.getSystemHealth().then(res => res.data),
    { refetchInterval: 30000 } // Refresh every 30 seconds
  );

  // Fetch analytics overview
  const { data: analytics, isLoading: analyticsLoading } = useQuery(
    'analytics-overview',
    () => adminApi.getAnalyticsOverview({ days: 7 }).then(res => res.data),
    { refetchInterval: 300000 } // Refresh every 5 minutes
  );

  if (overviewLoading || healthLoading || analyticsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (overviewError) {
    return (
      <Alert severity="error">
        Failed to load dashboard data. Please try refreshing the page.
      </Alert>
    );
  }

  const stats = overview?.data?.overview || {};
  const systemInfo = overview?.data?.system || {};
  const healthData = health?.data || { status: 'unknown', checks: {} };
  const analyticsData = analytics?.data || {};

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Admin Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Tenants"
            value={stats.totalTenants || 0}
            icon={<Business />}
            color="primary"
            subtitle={`${analyticsData.activeTenants || 0} active`}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Users"
            value={stats.totalUsers || 0}
            icon={<People />}
            color="secondary"
            subtitle={`${stats.activeUsers30Days || 0} active (30d)`}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Data Entries"
            value={analyticsData.totalEntries ? 
              (analyticsData.totalEntries / 1000000).toFixed(1) + 'M' : '0'}
            icon={<Storage />}
            color="success"
            subtitle={analyticsData.storageUsedFormatted || '0 MB'}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="System Uptime"
            value={Math.floor(stats.systemUptime / 3600) + 'h'}
            icon={<Speed />}
            color="info"
            subtitle={`Since ${format(new Date(Date.now() - stats.systemUptime * 1000), 'MMM dd')}`}
          />
        </Grid>

        {/* System Health */}
        <Grid item xs={12} md={4}>
          <SystemHealth health={healthData} />
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Activity Overview
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Tenant Activity Rate
                  </Typography>
                  <Typography variant="h6">
                    {analyticsData.rates?.tenantActivity || 0}%
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    User Activity Rate
                  </Typography>
                  <Typography variant="h6">
                    {analyticsData.rates?.userActivity || 0}%
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            
            {/* Growth indicators */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                7-Day Growth
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box display="flex" alignItems="center">
                    <TrendingUp color="success" fontSize="small" />
                    <Typography variant="body2" sx={{ ml: 1 }}>
                      {analyticsData.growth?.tenants?.length || 0} new tenants
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box display="flex" alignItems="center">
                    <TrendingUp color="success" fontSize="small" />
                    <Typography variant="body2" sx={{ ml: 1 }}>
                      {analyticsData.growth?.users?.length || 0} new users
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>

        {/* System Info */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Version
                </Typography>
                <Typography variant="body1">
                  {systemInfo.version || 'Unknown'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Node Version
                </Typography>
                <Typography variant="body1">
                  {systemInfo.nodeVersion || 'Unknown'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Environment
                </Typography>
                <Typography variant="body1">
                  {systemInfo.environment || 'Unknown'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Memory Usage
                </Typography>
                <Typography variant="body1">
                  {systemInfo.memory?.heapUsed ? 
                    `${Math.round(systemInfo.memory.heapUsed / 1024 / 1024)} MB` : 
                    'Unknown'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;