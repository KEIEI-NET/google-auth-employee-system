import React, { useMemo } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  Chip,
  Button,
  Divider,
} from '@mui/material';
import {
  Person as PersonIcon,
  Security as SecurityIcon,
  Dashboard as DashboardIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Memoize role checks for performance
  const userPermissions = useMemo(() => {
    if (!user) return { isAdmin: false, isManager: false };
    
    return {
      isAdmin: user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN'),
      isManager: user.roles.includes('MANAGER'),
    };
  }, [user]);

  if (!user) {
    return null;
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'error';
      case 'ADMIN':
        return 'warning';
      case 'MANAGER':
        return 'info';
      case 'EMPLOYEE':
        return 'success';
      case 'VIEWER':
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {/* Header */}
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box display="flex" alignItems="center">
              <DashboardIcon sx={{ mr: 2, fontSize: 30 }} />
              <Typography variant="h4" component="h1">
                Employee Dashboard
              </Typography>
            </Box>
            <Button variant="outlined" color="secondary" onClick={logout}>
              Logout
            </Button>
          </Paper>
        </Grid>

        {/* User Profile Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" flexDirection="column" alignItems="center">
                <Avatar
                  src={user.profilePicture || undefined}
                  sx={{ width: 100, height: 100, mb: 2 }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </Avatar>
                <Typography variant="h5" gutterBottom>
                  {user.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {user.email}
                </Typography>
                <Box mt={2}>
                  {user.roles.map((role) => (
                    <Chip
                      key={role}
                      label={role}
                      color={getRoleColor(role) as any}
                      size="small"
                      sx={{ m: 0.5 }}
                    />
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<PersonIcon />}
                  onClick={() => navigate('/profile')}
                >
                  View Profile
                </Button>
              </Grid>
              
              {userPermissions.isManager && (
                <Grid item xs={12} sm={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<SecurityIcon />}
                    onClick={() => navigate('/team')}
                  >
                    Manage Team
                  </Button>
                </Grid>
              )}
              
              {userPermissions.isAdmin && (
                <Grid item xs={12} sm={6}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    startIcon={<AdminIcon />}
                    onClick={() => navigate('/admin')}
                  >
                    Admin Panel
                  </Button>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* Statistics Cards */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography color="text.secondary" gutterBottom>
                  Department
                </Typography>
                <Typography variant="h5">Engineering</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography color="text.secondary" gutterBottom>
                  Team Size
                </Typography>
                <Typography variant="h5">12</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography color="text.secondary" gutterBottom>
                  Projects
                </Typography>
                <Typography variant="h5">3</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography color="text.secondary" gutterBottom>
                  Status
                </Typography>
                <Typography variant="h5" color="success.main">
                  Active
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;