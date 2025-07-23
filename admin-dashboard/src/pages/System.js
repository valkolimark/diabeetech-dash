import React from 'react';
import { Typography, Box, Paper } from '@mui/material';

function System() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>System monitoring dashboard coming soon...</Typography>
      </Paper>
    </Box>
  );
}

export default System;