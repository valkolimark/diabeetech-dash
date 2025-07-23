import React from 'react';
import { Typography, Box, Paper } from '@mui/material';

function Settings() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Admin settings coming soon...</Typography>
      </Paper>
    </Box>
  );
}

export default Settings;