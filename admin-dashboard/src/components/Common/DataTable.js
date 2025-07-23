import React, { useState, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Checkbox,
  Box,
  IconButton,
  Toolbar,
  Typography,
  Tooltip,
  Paper,
  TextField,
  Menu,
  MenuItem,
  Chip,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Alert,
  Skeleton,
  Button,
  Collapse,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  VisibilityOff,
  ViewColumn,
  FilterList,
  Download,
  Delete,
  MoreVert,
  KeyboardArrowDown,
  KeyboardArrowUp,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

// Column visibility selector
function ColumnSelector({ columns, visibleColumns, onChange }) {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleToggle = (columnId) => {
    const newVisible = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    onChange(newVisible);
  };

  return (
    <>
      <Tooltip title="Toggle columns">
        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
          <ViewColumn />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {columns.map((column) => (
          <MenuItem key={column.id} onClick={() => handleToggle(column.id)}>
            <Checkbox
              checked={visibleColumns.includes(column.id)}
              size="small"
            />
            <Typography variant="body2">{column.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

// Enhanced table toolbar
function EnhancedTableToolbar({
  numSelected,
  title,
  onBulkAction,
  bulkActions,
  onExport,
  showColumnSelector,
  columns,
  visibleColumns,
  onColumnVisibilityChange,
  filters,
  density,
  onDensityChange,
}) {
  const [bulkMenuAnchor, setBulkMenuAnchor] = useState(null);

  return (
    <Toolbar
      sx={{
        pl: { sm: 2 },
        pr: { xs: 1, sm: 1 },
        ...(numSelected > 0 && {
          bgcolor: (theme) =>
            alpha(theme.palette.primary.main, theme.palette.action.activatedOpacity),
        }),
      }}
    >
      {numSelected > 0 ? (
        <Typography
          sx={{ flex: '1 1 100%' }}
          color="inherit"
          variant="subtitle1"
          component="div"
        >
          {numSelected} selected
        </Typography>
      ) : (
        <Typography
          sx={{ flex: '1 1 100%' }}
          variant="h6"
          id="tableTitle"
          component="div"
        >
          {title}
        </Typography>
      )}

      {numSelected > 0 ? (
        <>
          {bulkActions && bulkActions.length > 0 && (
            <>
              <Button
                variant="contained"
                size="small"
                endIcon={<KeyboardArrowDown />}
                onClick={(e) => setBulkMenuAnchor(e.currentTarget)}
                sx={{ mr: 1 }}
              >
                Bulk Actions
              </Button>
              <Menu
                anchorEl={bulkMenuAnchor}
                open={Boolean(bulkMenuAnchor)}
                onClose={() => setBulkMenuAnchor(null)}
              >
                {bulkActions.map((action) => (
                  <MenuItem
                    key={action.id}
                    onClick={() => {
                      onBulkAction(action.id);
                      setBulkMenuAnchor(null);
                    }}
                  >
                    {action.icon && <Box component={action.icon} sx={{ mr: 1 }} />}
                    {action.label}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
        </>
      ) : (
        <Box display="flex" gap={1}>
          {filters}
          
          {/* Density selector */}
          {onDensityChange && (
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={density}
                onChange={(e) => onDensityChange(e.target.value)}
                displayEmpty
              >
                <MenuItem value="compact">Compact</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="comfortable">Comfortable</MenuItem>
              </Select>
            </FormControl>
          )}
          
          {showColumnSelector && (
            <ColumnSelector
              columns={columns}
              visibleColumns={visibleColumns}
              onChange={onColumnVisibilityChange}
            />
          )}
          
          {onExport && (
            <Tooltip title="Export data">
              <IconButton onClick={onExport}>
                <Download />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
    </Toolbar>
  );
}

// Main DataTable component
export default function DataTable({
  columns,
  data,
  loading = false,
  error = null,
  title = '',
  onRowClick,
  onRowSelect,
  selectable = false,
  bulkActions = [],
  onBulkAction,
  pagination = true,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  sortable = true,
  defaultOrderBy = null,
  defaultOrder = 'asc',
  onExport,
  filters,
  emptyMessage = 'No data available',
  stickyHeader = true,
  density: initialDensity = 'normal',
  showColumnSelector = true,
  expandableRows = false,
  renderExpandedRow,
  getRowId = (row) => row._id || row.id,
  rowActions,
  onRefresh,
  customToolbar,
}) {
  const [selected, setSelected] = useState([]);
  const [orderBy, setOrderBy] = useState(defaultOrderBy || columns[0]?.id);
  const [order, setOrder] = useState(defaultOrder);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [visibleColumns, setVisibleColumns] = useState(
    columns.filter(col => col.visible !== false).map(col => col.id)
  );
  const [expandedRows, setExpandedRows] = useState([]);
  const [density, setDensity] = useState(initialDensity);

  // Get row height based on density
  const getRowHeight = () => {
    switch (density) {
      case 'compact': return 40;
      case 'comfortable': return 60;
      default: return 52;
    }
  };

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortable || !orderBy) return data;

    return [...data].sort((a, b) => {
      const column = columns.find(col => col.id === orderBy);
      let aValue = a[orderBy];
      let bValue = b[orderBy];

      // Handle custom value getter
      if (column?.getValue) {
        aValue = column.getValue(a);
        bValue = column.getValue(b);
      }

      // Handle null/undefined values
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Compare values
      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, orderBy, order, sortable, columns]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = page * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, page, rowsPerPage, pagination]);

  // Handlers
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelected = paginatedData.map((row) => getRowId(row));
      setSelected(newSelected);
      onRowSelect?.(newSelected);
      return;
    }
    setSelected([]);
    onRowSelect?.([]);
  };

  const handleClick = (event, row) => {
    const rowId = getRowId(row);
    
    if (selectable && (event.target.type === 'checkbox' || event.ctrlKey || event.metaKey)) {
      const selectedIndex = selected.indexOf(rowId);
      let newSelected = [];

      if (selectedIndex === -1) {
        newSelected = newSelected.concat(selected, rowId);
      } else if (selectedIndex === 0) {
        newSelected = newSelected.concat(selected.slice(1));
      } else if (selectedIndex === selected.length - 1) {
        newSelected = newSelected.concat(selected.slice(0, -1));
      } else if (selectedIndex > 0) {
        newSelected = newSelected.concat(
          selected.slice(0, selectedIndex),
          selected.slice(selectedIndex + 1),
        );
      }

      setSelected(newSelected);
      onRowSelect?.(newSelected);
    } else if (onRowClick) {
      onRowClick(row);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleToggleExpandRow = (rowId) => {
    setExpandedRows(prev =>
      prev.includes(rowId)
        ? prev.filter(id => id !== rowId)
        : [...prev, rowId]
    );
  };

  const handleBulkAction = (actionId) => {
    if (onBulkAction) {
      onBulkAction(actionId, selected);
    }
  };

  const isSelected = (rowId) => selected.indexOf(rowId) !== -1;
  const isExpanded = (rowId) => expandedRows.includes(rowId);

  // Render loading state
  if (loading) {
    return (
      <Paper>
        <Box p={2}>
          <Skeleton variant="rectangular" height={400} />
        </Box>
      </Paper>
    );
  }

  // Render error state
  if (error) {
    return (
      <Paper>
        <Box p={2}>
          <Alert severity="error">{error}</Alert>
          {onRefresh && (
            <Button onClick={onRefresh} sx={{ mt: 2 }}>
              Retry
            </Button>
          )}
        </Box>
      </Paper>
    );
  }

  // Render empty state
  if (!data || data.length === 0) {
    return (
      <Paper>
        <Box p={4} textAlign="center">
          <Typography color="textSecondary">{emptyMessage}</Typography>
          {onRefresh && (
            <Button onClick={onRefresh} sx={{ mt: 2 }}>
              Refresh
            </Button>
          )}
        </Box>
      </Paper>
    );
  }

  const visibleColumnsData = columns.filter(col => visibleColumns.includes(col.id));

  return (
    <Paper>
      {customToolbar || (
        <EnhancedTableToolbar
          numSelected={selected.length}
          title={title}
          onBulkAction={handleBulkAction}
          bulkActions={bulkActions}
          onExport={onExport}
          showColumnSelector={showColumnSelector}
          columns={columns}
          visibleColumns={visibleColumns}
          onColumnVisibilityChange={setVisibleColumns}
          filters={filters}
          density={density}
          onDensityChange={setDensity}
        />
      )}
      
      <TableContainer>
        <Table
          stickyHeader={stickyHeader}
          size={density === 'compact' ? 'small' : 'medium'}
        >
          <TableHead>
            <TableRow>
              {expandableRows && <TableCell padding="checkbox" />}
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    indeterminate={selected.length > 0 && selected.length < paginatedData.length}
                    checked={paginatedData.length > 0 && selected.length === paginatedData.length}
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
              )}
              {visibleColumnsData.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  padding={column.disablePadding ? 'none' : 'normal'}
                  sortDirection={orderBy === column.id ? order : false}
                  style={{ minWidth: column.minWidth }}
                >
                  {sortable && column.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleRequestSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
              {rowActions && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row) => {
              const rowId = getRowId(row);
              const isItemSelected = isSelected(rowId);
              const isRowExpanded = isExpanded(rowId);

              return (
                <React.Fragment key={rowId}>
                  <TableRow
                    hover
                    onClick={(event) => handleClick(event, row)}
                    role="checkbox"
                    aria-checked={isItemSelected}
                    tabIndex={-1}
                    selected={isItemSelected}
                    sx={{
                      cursor: onRowClick ? 'pointer' : 'default',
                      height: getRowHeight(),
                    }}
                  >
                    {expandableRows && (
                      <TableCell padding="checkbox">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleExpandRow(rowId);
                          }}
                        >
                          {isRowExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                        </IconButton>
                      </TableCell>
                    )}
                    {selectable && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          color="primary"
                          checked={isItemSelected}
                        />
                      </TableCell>
                    )}
                    {visibleColumnsData.map((column) => {
                      const value = column.getValue ? column.getValue(row) : row[column.id];
                      const rendered = column.renderCell
                        ? column.renderCell(value, row)
                        : value;

                      return (
                        <TableCell key={column.id} align={column.align || 'left'}>
                          {rendered}
                        </TableCell>
                      );
                    })}
                    {rowActions && (
                      <TableCell align="right">
                        {rowActions(row)}
                      </TableCell>
                    )}
                  </TableRow>
                  {expandableRows && isRowExpanded && (
                    <TableRow>
                      <TableCell colSpan={visibleColumnsData.length + (selectable ? 2 : 1) + (rowActions ? 1 : 0)}>
                        <Collapse in={isRowExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1 }}>
                            {renderExpandedRow?.(row)}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      
      {pagination && (
        <TablePagination
          rowsPerPageOptions={pageSizeOptions}
          component="div"
          count={data.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      )}
    </Paper>
  );
}