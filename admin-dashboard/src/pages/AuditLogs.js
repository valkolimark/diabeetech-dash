import React from 'react';
import { Typography, Box, Paper } from '@mui/material';

function AuditLogs() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Audit Logs
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Audit logs viewer coming soon...</Typography>
      </Paper>
    </Box>
  );
}

export default AuditLogs;