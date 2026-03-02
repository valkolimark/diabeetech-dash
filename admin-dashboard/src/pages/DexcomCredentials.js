import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
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
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Refresh as RestartIcon,
  Stop as StopIcon,
  PlayArrow as StartIcon,
} from '@mui/icons-material';
import { adminApi } from '../services/api';
import { useSnackbar } from 'notistack';

function DexcomCredentials() {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [editDialog, setEditDialog] = useState({ open: false, tenant: null });
  const [formData, setFormData] = useState({ userName: '', password: '', enable: false });

  // Fetch bridges
  const { data, isLoading, error } = useQuery(
    'bridges',
    () => adminApi.getBridges().then(res => res.data),
    { refetchInterval: 30000 }
  );

  // Update mutation
  const updateMutation = useMutation(
    ({ tenantId, data }) => adminApi.updateBridge(tenantId, data),
    {
      onSuccess: (res) => {
        enqueueSnackbar(res.data.message || 'Bridge updated successfully', { variant: 'success' });
        queryClient.invalidateQueries('bridges');
        setEditDialog({ open: false, tenant: null });
      },
      onError: (err) => {
        enqueueSnackbar(err.response?.data?.error || 'Failed to update bridge', { variant: 'error' });
      }
    }
  );

  // Restart mutation
  const restartMutation = useMutation(
    (tenantId) => adminApi.restartBridge(tenantId),
    {
      onSuccess: (res) => {
        enqueueSnackbar(res.data.message || 'Bridge restarted', { variant: 'success' });
        queryClient.invalidateQueries('bridges');
      },
      onError: (err) => {
        enqueueSnackbar(err.response?.data?.error || 'Failed to restart bridge', { variant: 'error' });
      }
    }
  );

  // Stop mutation
  const stopMutation = useMutation(
    (tenantId) => adminApi.stopBridge(tenantId),
    {
      onSuccess: (res) => {
        enqueueSnackbar(res.data.message || 'Bridge stopped', { variant: 'success' });
        queryClient.invalidateQueries('bridges');
      },
      onError: (err) => {
        enqueueSnackbar(err.response?.data?.error || 'Failed to stop bridge', { variant: 'error' });
      }
    }
  );

  const handleEditOpen = (bridge) => {
    setFormData({
      userName: bridge.dexcomUsername || '',
      password: '',
      enable: bridge.bridgeEnabled
    });
    setEditDialog({ open: true, tenant: bridge });
  };

  const handleEditClose = () => {
    setEditDialog({ open: false, tenant: null });
  };

  const handleSave = () => {
    const payload = {
      userName: formData.userName,
      enable: formData.enable
    };
    // Only send password if it was changed
    if (formData.password) {
      payload.password = formData.password;
    }
    updateMutation.mutate({ tenantId: editDialog.tenant.tenantId, data: payload });
  };

  const formatUptime = (ms) => {
    if (!ms) return '-';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load bridge data: {error.message}</Alert>;
  }

  const bridges = data?.data?.bridges || [];

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Dexcom Bridge Management</Typography>
        <Chip
          label={`${bridges.filter(b => b.bridgeRunning).length} / ${bridges.length} running`}
          color="primary"
          variant="outlined"
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tenant</TableCell>
              <TableCell>Subdomain</TableCell>
              <TableCell>Dexcom Username</TableCell>
              <TableCell>Enabled</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Uptime</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bridges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>No tenants found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              bridges.map((bridge) => (
                <TableRow key={bridge.tenantId} hover>
                  <TableCell>{bridge.tenantName}</TableCell>
                  <TableCell>
                    <Chip label={bridge.subdomain} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{bridge.dexcomUsername || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={bridge.bridgeEnabled ? 'Enabled' : 'Disabled'}
                      size="small"
                      color={bridge.bridgeEnabled ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={bridge.bridgeRunning ? 'Running' : 'Stopped'}
                      size="small"
                      color={bridge.bridgeRunning ? 'success' : 'error'}
                      variant={bridge.bridgeRunning ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>{formatUptime(bridge.uptime)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit credentials">
                      <IconButton size="small" onClick={() => handleEditOpen(bridge)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {bridge.bridgeRunning ? (
                      <Tooltip title="Stop bridge">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => stopMutation.mutate(bridge.tenantId)}
                          disabled={stopMutation.isLoading}
                        >
                          <StopIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Start bridge">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => restartMutation.mutate(bridge.tenantId)}
                          disabled={restartMutation.isLoading}
                        >
                          <StartIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Restart bridge">
                      <IconButton
                        size="small"
                        onClick={() => restartMutation.mutate(bridge.tenantId)}
                        disabled={restartMutation.isLoading}
                      >
                        <RestartIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onClose={handleEditClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit Dexcom Credentials — {editDialog.tenant?.tenantName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Dexcom Username"
              value={formData.userName}
              onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
              fullWidth
              autoComplete="off"
            />
            <TextField
              label="Dexcom Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              fullWidth
              placeholder="Leave empty to keep current password"
              autoComplete="new-password"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.enable}
                  onChange={(e) => setFormData({ ...formData, enable: e.target.checked })}
                />
              }
              label="Enable Bridge"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={updateMutation.isLoading}
          >
            {updateMutation.isLoading ? 'Saving...' : 'Save & Restart'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DexcomCredentials;
