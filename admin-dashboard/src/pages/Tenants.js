import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Block as BlockIcon,
  CheckCircle as ActivateIcon,
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

// Tenant detail/edit component (placeholder)
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
      <Route path="/new" element={<TenantDetail />} />
      <Route path="/:id" element={<TenantDetail />} />
      <Route path="/:id/edit" element={<TenantDetail />} />
    </Routes>
  );
}

export default Tenants;