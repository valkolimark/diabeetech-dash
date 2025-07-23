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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  VpnKey as PasswordIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { adminApi } from '../services/api';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';

// User list component
function UserList() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Fetch users
  const { data, isLoading, error, refetch } = useQuery(
    ['users', page, rowsPerPage, search, roleFilter, statusFilter],
    () => adminApi.getUsers({
      page: page + 1,
      limit: rowsPerPage,
      search: search,
      role: roleFilter,
      status: statusFilter
    }).then(res => res.data),
    { keepPreviousData: true }
  );

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  const handleResetPassword = async (userId) => {
    const newPassword = prompt('Enter new password (min 8 characters):');
    if (newPassword && newPassword.length >= 8) {
      try {
        await adminApi.resetUserPassword(userId, newPassword);
        enqueueSnackbar('Password reset successfully', { variant: 'success' });
      } catch (error) {
        enqueueSnackbar('Failed to reset password', { variant: 'error' });
      }
    }
  };

  const handleDisable2FA = async (userId) => {
    if (window.confirm('Are you sure you want to disable 2FA for this user?')) {
      try {
        await adminApi.disableUser2FA(userId);
        enqueueSnackbar('2FA disabled successfully', { variant: 'success' });
        refetch();
      } catch (error) {
        enqueueSnackbar('Failed to disable 2FA', { variant: 'error' });
      }
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await adminApi.deleteUser(userId);
        enqueueSnackbar('User deleted successfully', { variant: 'success' });
        refetch();
      } catch (error) {
        enqueueSnackbar('Failed to delete user', { variant: 'error' });
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
    return <Alert severity="error">Failed to load users</Alert>;
  }

  const users = data?.data?.users || [];
  const totalCount = data?.data?.pagination?.total || 0;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Users</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/users/new')}
        >
          Add User
        </Button>
      </Box>

      <Paper>
        <Box p={2}>
          <Box display="flex" gap={2}>
            <TextField
              flex={1}
              placeholder="Search by email, name, or username..."
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
              sx={{ flex: 1 }}
            />
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(0);
                }}
                label="Role"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="superadmin">SuperAdmin</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="suspended">Suspended</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Tenant</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell>2FA</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user._id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.name || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.role}
                      color={user.role === 'superadmin' ? 'primary' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{user.tenantName || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.status}
                      color={user.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {user.lastLogin ? 
                      format(new Date(user.lastLogin), 'MMM dd, yyyy') : 
                      'Never'}
                  </TableCell>
                  <TableCell>
                    {user.twoFactorEnabled ? (
                      <Chip label="Enabled" color="success" size="small" />
                    ) : (
                      <Chip label="Disabled" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/users/${user._id}/edit`)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleResetPassword(user._id)}
                    >
                      <PasswordIcon />
                    </IconButton>
                    {user.twoFactorEnabled && (
                      <IconButton
                        size="small"
                        onClick={() => handleDisable2FA(user._id)}
                      >
                        <SecurityIcon />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(user._id)}
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

// User detail/edit component (placeholder)
function UserDetail() {
  return (
    <Box>
      <Typography variant="h5">User Detail - Coming Soon</Typography>
    </Box>
  );
}

// Main Users component with routing
function Users() {
  return (
    <Routes>
      <Route path="/" element={<UserList />} />
      <Route path="/new" element={<UserDetail />} />
      <Route path="/:id/edit" element={<UserDetail />} />
    </Routes>
  );
}

export default Users;