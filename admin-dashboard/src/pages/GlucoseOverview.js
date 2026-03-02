import React from 'react';
import { useQuery } from 'react-query';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { adminApi } from '../services/api';

// Direction arrow mapping
function getDirectionDisplay(direction) {
  const map = {
    'DoubleUp': { arrow: '\u21C8', label: 'Rising fast' },
    'SingleUp': { arrow: '\u2191', label: 'Rising' },
    'FortyFiveUp': { arrow: '\u2197', label: 'Rising slowly' },
    'Flat': { arrow: '\u2192', label: 'Stable' },
    'FortyFiveDown': { arrow: '\u2198', label: 'Falling slowly' },
    'SingleDown': { arrow: '\u2193', label: 'Falling' },
    'DoubleDown': { arrow: '\u21CA', label: 'Falling fast' },
    'NOT COMPUTABLE': { arrow: '?', label: 'Not computable' },
    'RATE OUT OF RANGE': { arrow: '!', label: 'Rate out of range' },
  };
  return map[direction] || { arrow: '-', label: direction || 'Unknown' };
}

// Get color for glucose value based on thresholds
function getGlucoseColor(sgv, thresholds) {
  if (!sgv || !thresholds) return 'text.secondary';
  if (sgv >= thresholds.urgentHigh) return '#d32f2f'; // dark red
  if (sgv >= thresholds.high) return '#ed6c02'; // orange
  if (sgv <= thresholds.urgentLow) return '#d32f2f'; // dark red
  if (sgv <= thresholds.low) return '#ed6c02'; // orange
  return '#2e7d32'; // green - in range
}

// Get staleness chip props
function getStalenessChip(staleness) {
  switch (staleness) {
    case 'fresh':
      return { label: 'Fresh', color: 'success' };
    case 'aging':
      return { label: 'Aging', color: 'warning' };
    case 'stale':
      return { label: 'Stale', color: 'error' };
    case 'error':
      return { label: 'Error', color: 'error' };
    default:
      return { label: 'No Data', color: 'default' };
  }
}

function GlucoseOverview() {
  const { data, isLoading, error, refetch } = useQuery(
    'glucose-overview',
    () => adminApi.getGlucoseOverview().then(res => res.data),
    {
      refetchInterval: 30000,
      keepPreviousData: true,
    }
  );

  if (isLoading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load glucose data: {error.message}</Alert>;
  }

  const tenants = data?.data?.tenants || [];
  const thresholds = data?.data?.thresholds || {};

  // Summary stats
  const totalTenants = tenants.length;
  const withData = tenants.filter(t => t.latestSgv !== null).length;
  const freshCount = tenants.filter(t => t.staleness === 'fresh').length;
  const staleCount = tenants.filter(t => t.staleness === 'stale').length;
  const urgentCount = tenants.filter(t =>
    t.latestSgv !== null && (t.latestSgv >= thresholds.urgentHigh || t.latestSgv <= thresholds.urgentLow)
  ).length;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Glucose Overview</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={`${totalTenants} tenants`} size="small" variant="outlined" />
          <Chip label={`${freshCount} fresh`} size="small" color="success" variant="outlined" />
          {staleCount > 0 && (
            <Chip label={`${staleCount} stale`} size="small" color="error" variant="outlined" />
          )}
          {urgentCount > 0 && (
            <Chip label={`${urgentCount} urgent`} size="small" color="error" />
          )}
          <Tooltip title="Refresh now (auto-refreshes every 30s)">
            <IconButton size="small" onClick={() => refetch()}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tenant</TableCell>
              <TableCell>Subdomain</TableCell>
              <TableCell align="center">Glucose (mg/dL)</TableCell>
              <TableCell align="center">Trend</TableCell>
              <TableCell>Last Reading</TableCell>
              <TableCell>Freshness</TableCell>
              <TableCell>Bridge</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>No tenants found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((tenant) => {
                const direction = getDirectionDisplay(tenant.direction);
                const glucoseColor = getGlucoseColor(tenant.latestSgv, thresholds);
                const stalenessChip = getStalenessChip(tenant.staleness);

                return (
                  <TableRow key={tenant.tenantId} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {tenant.tenantName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={tenant.subdomain} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      {tenant.latestSgv !== null ? (
                        <Typography
                          variant="h6"
                          sx={{ color: glucoseColor, fontWeight: 'bold' }}
                        >
                          {tenant.latestSgv}
                        </Typography>
                      ) : (
                        <Typography color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {tenant.direction ? (
                        <Tooltip title={direction.label}>
                          <Typography variant="h6">{direction.arrow}</Typography>
                        </Tooltip>
                      ) : (
                        <Typography color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {tenant.minutesAgo !== null ? (
                        <Typography variant="body2" color="text.secondary">
                          {tenant.minutesAgo < 1
                            ? 'Just now'
                            : tenant.minutesAgo < 60
                              ? `${tenant.minutesAgo}m ago`
                              : `${Math.floor(tenant.minutesAgo / 60)}h ${tenant.minutesAgo % 60}m ago`
                          }
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={stalenessChip.label}
                        size="small"
                        color={stalenessChip.color}
                        variant={tenant.staleness === 'fresh' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={tenant.bridgeRunning ? 'Running' : 'Stopped'}
                        size="small"
                        color={tenant.bridgeRunning ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default GlucoseOverview;
