import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Switch,
  FormControlLabel,
  Divider,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Block as BlockIcon,
  CheckCircle as ActivateIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { adminApi } from '../services/api';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';

// Tenant list component
function TenantList() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Fetch tenants
  const { data, isLoading, error, refetch } = useQuery(
    ['tenants', page, rowsPerPage, search],
    () => adminApi.getTenants({
      page: page + 1,
      limit: rowsPerPage,
      search: search
    }).then(res => res.data),
    { keepPreviousData: true }
  );

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  const handleStatusChange = async (tenantId, action) => {
    try {
      if (action === 'suspend') {
        await adminApi.suspendTenant(tenantId, 'Manual suspension by admin');
      } else if (action === 'activate') {
        await adminApi.activateTenant(tenantId);
      }
      enqueueSnackbar(`Tenant ${action}d successfully`, { variant: 'success' });
      refetch();
    } catch (error) {
      enqueueSnackbar(`Failed to ${action} tenant`, { variant: 'error' });
    }
  };

  const handleDelete = async (tenantId) => {
    if (window.confirm('Are you sure you want to delete this tenant? This action cannot be undone.')) {
      try {
        await adminApi.deleteTenant(tenantId);
        enqueueSnackbar('Tenant deleted successfully', { variant: 'success' });
        refetch();
      } catch (error) {
        enqueueSnackbar('Failed to delete tenant', { variant: 'error' });
      }
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load tenants</Alert>;
  }

  const tenants = data?.data?.tenants || [];
  const totalCount = data?.data?.pagination?.total || 0;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Tenants</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/tenants/new')}
        >
          Add Tenant
        </Button>
      </Box>

      <Paper>
        <Box p={2}>
          <TextField
            fullWidth
            placeholder="Search by name, subdomain, or owner email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleSearch}>
                    <SearchIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Subdomain</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Users</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant._id}>
                  <TableCell>{tenant.name}</TableCell>
                  <TableCell>{tenant.subdomain}</TableCell>
                  <TableCell>{tenant.owner?.email || 'N/A'}</TableCell>
                  <TableCell>{tenant.userCount || 0}</TableCell>
                  <TableCell>
                    <Chip
                      label={tenant.status}
                      color={tenant.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {format(new Date(tenant.createdAt), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/tenants/${tenant._id}`)}
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/tenants/${tenant._id}/edit`)}
                    >
                      <EditIcon />
                    </IconButton>
                    {tenant.status === 'active' ? (
                      <IconButton
                        size="small"
                        onClick={() => handleStatusChange(tenant._id, 'suspend')}
                      >
                        <BlockIcon />
                      </IconButton>
                    ) : (
                      <IconButton
                        size="small"
                        onClick={() => handleStatusChange(tenant._id, 'activate')}
                      >
                        <ActivateIcon />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(tenant._id)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>
    </Box>
  );
}

// Create new tenant form
function CreateTenant() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    units: 'mg/dl',
    dexcomUsername: '',
    dexcomPassword: '',
    enableBridge: true,
  });

  const createMutation = useMutation(
    (data) => adminApi.createFullTenant(data),
    {
      onSuccess: (res) => {
        const d = res.data.data;
        enqueueSnackbar(
          `Tenant "${d.tenant.subdomain}" created! Bridge: ${d.bridge.running ? 'Running' : 'Not started'}`,
          { variant: 'success' }
        );
        queryClient.invalidateQueries('tenants');
        navigate('/tenants');
      },
      onError: (err) => {
        enqueueSnackbar(
          err.response?.data?.error || 'Failed to create tenant',
          { variant: 'error' }
        );
      },
    }
  );

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [field]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate('/tenants')}>
          <BackIcon />
        </IconButton>
        <Typography variant="h5">Create New Tenant</Typography>
      </Box>

      <Paper sx={{ p: 3, maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <Typography variant="h6" gutterBottom>Account Info</Typography>

          <TextField
            label="Username / Subdomain"
            value={form.username}
            onChange={handleChange('username')}
            fullWidth
            required
            margin="normal"
            helperText="3-63 characters. Letters, numbers, hyphens only. This becomes the subdomain."
            inputProps={{ pattern: '[a-zA-Z0-9-]+', minLength: 3, maxLength: 63 }}
          />

          <TextField
            label="Display Name"
            value={form.displayName}
            onChange={handleChange('displayName')}
            fullWidth
            margin="normal"
            helperText="Shown in the admin dashboard and glucose overview"
          />

          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={handleChange('email')}
            fullWidth
            required
            margin="normal"
          />

          <TextField
            label="Password"
            type="password"
            value={form.password}
            onChange={handleChange('password')}
            fullWidth
            required
            margin="normal"
            inputProps={{ minLength: 8 }}
            helperText="Minimum 8 characters"
          />

          <TextField
            label="Glucose Units"
            select
            value={form.units}
            onChange={handleChange('units')}
            fullWidth
            margin="normal"
          >
            <MenuItem value="mg/dl">mg/dL</MenuItem>
            <MenuItem value="mmol">mmol/L</MenuItem>
          </TextField>

          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" gutterBottom>Dexcom Share Integration</Typography>

          <TextField
            label="Dexcom Username"
            value={form.dexcomUsername}
            onChange={handleChange('dexcomUsername')}
            fullWidth
            margin="normal"
            autoComplete="off"
          />

          <TextField
            label="Dexcom Password"
            type="password"
            value={form.dexcomPassword}
            onChange={handleChange('dexcomPassword')}
            fullWidth
            margin="normal"
            autoComplete="new-password"
          />

          <FormControlLabel
            control={
              <Switch
                checked={form.enableBridge}
                onChange={handleChange('enableBridge')}
              />
            }
            label="Auto-start Dexcom bridge after creation"
          />

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={createMutation.isLoading}
            >
              {createMutation.isLoading ? 'Creating...' : 'Create Tenant'}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/tenants')}
            >
              Cancel
            </Button>
          </Box>

          {createMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {createMutation.error?.response?.data?.error || 'Creation failed'}
            </Alert>
          )}
        </form>
      </Paper>
    </Box>
  );
}

// Tenant detail/view component (placeholder for future)
function TenantDetail() {
  return (
    <Box>
      <Typography variant="h5">Tenant Detail - Coming Soon</Typography>
    </Box>
  );
}

// Main Tenants component with routing
function Tenants() {
  return (
    <Routes>
      <Route path="/" element={<TenantList />} />
      <Route path="/new" element={<CreateTenant />} />
      <Route path="/:id" element={<TenantDetail />} />
      <Route path="/:id/edit" element={<TenantDetail />} />
    </Routes>
  );
}

export default Tenants;