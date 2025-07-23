import React, { useState, useEffect } from 'react';
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
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Divider,
  useTheme,
  Fade,
  Grow,
  Zoom,
} from '@mui/material';
import {
  Business,
  People,
  Storage,
  Speed,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Info,
  Refresh,
  Add,
  ArrowForward,
  AccessTime,
  Person,
  Domain,
  Assignment,
  Notifications,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { adminApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import CountUp from 'react-countup';

// Enhanced stat card with animations and growth indicators
function StatCard({ title, value, previousValue, icon, color = 'primary', subtitle, loading, format: formatValue }) {
  const theme = useTheme();
  const growth = previousValue ? ((value - previousValue) / previousValue * 100).toFixed(1) : 0;
  const isPositiveGrowth = growth >= 0;
  
  return (
    <Grow in={!loading} timeout={600}>
      <Card 
        sx={{ 
          height: '100%',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme.shadows[8],
          }
        }}
      >
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box flex={1}>
              <Typography color="textSecondary" gutterBottom variant="body2">
                {title}
              </Typography>
              <Typography variant="h4" component="div" sx={{ mb: 1 }}>
                {loading ? (
                  <CircularProgress size={30} />
                ) : (
                  <CountUp
                    end={value}
                    duration={1.5}
                    separator=","
                    formattingFn={formatValue}
                  />
                )}
              </Typography>
              {subtitle && (
                <Typography variant="body2" color="textSecondary">
                  {subtitle}
                </Typography>
              )}
              {growth !== 0 && !loading && (
                <Box display="flex" alignItems="center" mt={1}>
                  {isPositiveGrowth ? (
                    <TrendingUp color="success" fontSize="small" />
                  ) : (
                    <TrendingDown color="error" fontSize="small" />
                  )}
                  <Typography
                    variant="body2"
                    color={isPositiveGrowth ? 'success.main' : 'error.main'}
                    sx={{ ml: 0.5 }}
                  >
                    {isPositiveGrowth ? '+' : ''}{growth}% from last month
                  </Typography>
                </Box>
              )}
            </Box>
            <Zoom in={!loading} timeout={800}>
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
            </Zoom>
          </Box>
        </CardContent>
      </Card>
    </Grow>
  );
}

// System health indicator with enhanced visuals
function SystemHealth({ health, loading }) {
  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'unhealthy': return 'error';
      default: return 'default';
    }
  };

  const getHealthIcon = (status) => {
    switch (status) {
      case 'healthy': return <CheckCircle />;
      case 'warning': return <Warning />;
      case 'unhealthy': return <ErrorIcon />;
      default: return <Info />;
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, height: '100%' }}>
        <CircularProgress />
      </Paper>
    );
  }

  return (
    <Fade in={!loading} timeout={1000}>
      <Paper sx={{ p: 3, height: '100%' }}>
        <Typography variant="h6" gutterBottom>
          System Health
        </Typography>
        <Box sx={{ mt: 2 }}>
          {Object.entries(health?.checks || {}).map(([key, value]) => (
            <Box key={key} sx={{ mb: 2 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="body2">
                  {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                </Typography>
                <Box display="flex" alignItems="center">
                  {getHealthIcon(value.status)}
                  <Chip
                    label={value.status}
                    color={getHealthColor(value.status)}
                    size="small"
                    sx={{ ml: 1 }}
                  />
                </Box>
              </Box>
              {value.usage && (
                <Box sx={{ mt: 1 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={parseFloat(value.usage.percent)} 
                    color={parseFloat(value.usage.percent) > 80 ? 'warning' : 'primary'}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption" color="textSecondary">
                    {value.usage.used} / {value.usage.total} ({value.usage.percent}%)
                  </Typography>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Paper>
    </Fade>
  );
}

// Activity feed with enhanced UI
function ActivityFeed({ activities, loading }) {
  const navigate = useNavigate();
  
  const getActivityIcon = (type) => {
    switch (type) {
      case 'tenant': return <Domain />;
      case 'user': return <Person />;
      case 'registration': return <Assignment />;
      case 'anomaly': return <Warning />;
      default: return <Info />;
    }
  };

  const getActivityColor = (action) => {
    if (action.includes('delete') || action.includes('suspend')) return 'error';
    if (action.includes('create') || action.includes('activate')) return 'success';
    if (action.includes('update') || action.includes('reset')) return 'info';
    if (action.includes('failed') || action.includes('anomaly')) return 'error';
    return 'default';
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, height: '100%' }}>
        <CircularProgress />
      </Paper>
    );
  }

  return (
    <Fade in={!loading} timeout={1200}>
      <Paper sx={{ p: 3, height: '100%', maxHeight: 600, overflow: 'auto' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Recent Activity</Typography>
          <Button
            size="small"
            onClick={() => navigate('/audit')}
            endIcon={<ArrowForward />}
          >
            View All
          </Button>
        </Box>
        <List>
          {activities.map((activity, index) => (
            <React.Fragment key={activity.id}>
              {index > 0 && <Divider />}
              <ListItem
                button
                onClick={() => {
                  if (activity.type === 'tenant' && activity.target) {
                    navigate(`/tenants/${activity.target}`);
                  } else if (activity.type === 'user' && activity.target) {
                    navigate(`/users/${activity.target}`);
                  }
                }}
                sx={{
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  }
                }}
              >
                <ListItemIcon>
                  <Box
                    sx={{
                      backgroundColor: `${getActivityColor(activity.action)}.light`,
                      borderRadius: '50%',
                      p: 1,
                      display: 'flex',
                    }}
                  >
                    {getActivityIcon(activity.type)}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body2">
                      {activity.action.replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Typography>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        {activity.target || activity.user}
                      </Typography>
                      <Typography variant="caption" color="textSecondary" display="block">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </Typography>
                    </Box>
                  }
                />
                {activity.details?.attempts && (
                  <ListItemSecondaryAction>
                    <Chip
                      label={`${activity.details.attempts} attempts`}
                      color="error"
                      size="small"
                    />
                  </ListItemSecondaryAction>
                )}
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Fade>
  );
}

// Alerts panel
function AlertsPanel({ alerts, loading }) {
  const navigate = useNavigate();
  
  const getAlertIcon = (severity) => {
    switch (severity) {
      case 'error': return <ErrorIcon />;
      case 'warning': return <Warning />;
      case 'info': return <Info />;
      default: return <Notifications />;
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <CircularProgress />
      </Paper>
    );
  }

  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <Grow in={!loading} timeout={1400}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          System Alerts
        </Typography>
        <List>
          {alerts.map((alert) => (
            <Alert
              key={alert.id}
              severity={alert.severity}
              icon={getAlertIcon(alert.severity)}
              action={
                alert.action && (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => navigate(alert.action)}
                  >
                    View
                  </Button>
                )
              }
              sx={{ mb: 2 }}
            >
              <Typography variant="subtitle2">{alert.title}</Typography>
              <Typography variant="body2">{alert.message}</Typography>
            </Alert>
          ))}
        </List>
      </Paper>
    </Grow>
  );
}

// Quick actions panel
function QuickActions() {
  const navigate = useNavigate();
  
  const actions = [
    { label: 'Create Tenant', icon: <Add />, onClick: () => navigate('/tenants/new'), color: 'primary' },
    { label: 'Add User', icon: <Person />, onClick: () => navigate('/users/new'), color: 'secondary' },
    { label: 'View Reports', icon: <Assignment />, onClick: () => navigate('/analytics'), color: 'info' },
    { label: 'System Settings', icon: <Speed />, onClick: () => navigate('/system'), color: 'warning' },
  ];

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Quick Actions
      </Typography>
      <Grid container spacing={2}>
        {actions.map((action) => (
          <Grid item xs={6} key={action.label}>
            <Button
              fullWidth
              variant="outlined"
              color={action.color}
              startIcon={action.icon}
              onClick={action.onClick}
              sx={{
                py: 1.5,
                justifyContent: 'flex-start',
              }}
            >
              {action.label}
            </Button>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}

// Main Dashboard component with real-time updates
function Dashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const navigate = useNavigate();

  // Fetch dashboard stats with auto-refresh
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery(
    'dashboard-stats',
    () => adminApi.getDashboardStats().then(res => res.data),
    { 
      refetchInterval: autoRefresh ? 30000 : false, // Refresh every 30 seconds
      refetchIntervalInBackground: true,
    }
  );

  // Fetch activity feed
  const { data: activity, isLoading: activityLoading } = useQuery(
    'dashboard-activity',
    () => adminApi.getDashboardActivity({ limit: 10 }).then(res => res.data),
    { 
      refetchInterval: autoRefresh ? 60000 : false, // Refresh every minute
    }
  );

  // Fetch alerts
  const { data: alerts, isLoading: alertsLoading } = useQuery(
    'dashboard-alerts',
    () => adminApi.getDashboardAlerts().then(res => res.data),
    { 
      refetchInterval: autoRefresh ? 120000 : false, // Refresh every 2 minutes
    }
  );

  // Fetch system health
  const { data: health, isLoading: healthLoading } = useQuery(
    'system-health',
    () => adminApi.getSystemHealth().then(res => res.data),
    { 
      refetchInterval: autoRefresh ? 30000 : false, // Refresh every 30 seconds
    }
  );

  const loading = statsLoading || activityLoading || alertsLoading || healthLoading;

  const statsData = stats?.data || {};
  const activityData = activity?.data?.activities || [];
  const alertsData = alerts?.data?.alerts || [];
  const healthData = health?.data || { status: 'unknown', checks: {} };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Admin Dashboard</Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" color="textSecondary">
            <AccessTime sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            Auto-refresh: {autoRefresh ? 'On' : 'Off'}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Disable' : 'Enable'}
          </Button>
          <IconButton onClick={() => refetchStats()} disabled={loading}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>
      
      <Grid container spacing={3}>
        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Tenants"
            value={statsData.tenants?.total || 0}
            previousValue={statsData.tenants?.total - (statsData.tenants?.growth || 0)}
            icon={<Business />}
            color="primary"
            subtitle={`${statsData.tenants?.active || 0} active`}
            loading={statsLoading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Users"
            value={statsData.users?.total || 0}
            previousValue={statsData.users?.total - (statsData.users?.growth || 0)}
            icon={<People />}
            color="secondary"
            subtitle={`${statsData.users?.active || 0} active (30d)`}
            loading={statsLoading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Data Points"
            value={statsData.data?.totalPoints || 0}
            icon={<Storage />}
            color="success"
            subtitle={`${statsData.data?.storageUsed || 0} MB used`}
            loading={statsLoading}
            format={(val) => statsData.data?.formattedPoints || val}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="System Uptime"
            value={Math.floor((statsData.system?.uptime || 0) / 3600)}
            icon={<Speed />}
            color="info"
            subtitle={statsData.system?.uptimeFormatted}
            loading={statsLoading}
            format={(val) => `${val}h`}
          />
        </Grid>

        {/* Alerts */}
        {alertsData.length > 0 && (
          <Grid item xs={12}>
            <AlertsPanel alerts={alertsData} loading={alertsLoading} />
          </Grid>
        )}

        {/* System Health */}
        <Grid item xs={12} md={4}>
          <SystemHealth health={healthData} loading={healthLoading} />
        </Grid>

        {/* Activity Feed */}
        <Grid item xs={12} md={8}>
          <ActivityFeed activities={activityData} loading={activityLoading} />
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <QuickActions />
        </Grid>

        {/* Additional Stats */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Performance Metrics
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    API Calls Today
                  </Typography>
                  <Typography variant="h6">
                    {statsData.api?.callsToday || 0}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Average Response Time
                  </Typography>
                  <Typography variant="h6">
                    {statsData.api?.avgResponseTime || 0}ms
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Error Rate
                  </Typography>
                  <Typography variant="h6" color={statsData.api?.errorRate > 1 ? 'error' : 'inherit'}>
                    {statsData.api?.errorRate || 0}%
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;