import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface DashboardStats {
  totalVisitors: number;
  activeVisits: number;
  pendingVisits: number;
  todayVisits: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // TODO: Implement API call to fetch dashboard stats
        // const response = await api.get('/dashboard/stats');
        // setStats(response.data);
        
        // Mock data for now
        await new Promise(resolve => setTimeout(resolve, 1000));
        setStats({
          totalVisitors: 1250,
          activeVisits: 8,
          pendingVisits: 12,
          todayVisits: 45
        });
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading dashboard...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome back, {user?.firstName || 'User'}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's what's happening with your visitor management system today.
        </Typography>
      </Box>

      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PeopleIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="div">
                    Total Visitors
                  </Typography>
                </Box>
                <Typography variant="h4" component="div" color="primary">
                  {stats.totalVisitors.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Registered in system
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ScheduleIcon color="success" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="div">
                    Active Visits
                  </Typography>
                </Box>
                <Typography variant="h4" component="div" color="success.main">
                  {stats.activeVisits}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Currently on premises
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TrendingUpIcon color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="div">
                    Pending Visits
                  </Typography>
                </Box>
                <Typography variant="h4" component="div" color="warning.main">
                  {stats.pendingVisits}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Scheduled for today
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <SecurityIcon color="info" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="div">
                    Today's Visits
                  </Typography>
                </Box>
                <Typography variant="h4" component="div" color="info.main">
                  {stats.todayVisits}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Check-ins today
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                startIcon={<PeopleIcon />}
              >
                Register New Visitor
              </Button>
              <Button
                variant="outlined"
                fullWidth
                size="large"
                startIcon={<ScheduleIcon />}
              >
                Schedule Visit
              </Button>
              <Button
                variant="outlined"
                fullWidth
                size="large"
                startIcon={<SecurityIcon />}
              >
                View Security Reports
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Status
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">Database Connection</Typography>
                <Chip label="Online" color="success" size="small" />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">Email Service</Typography>
                <Chip label="Online" color="success" size="small" />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">SMS Service</Typography>
                <Chip label="Online" color="success" size="small" />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">Backup Service</Typography>
                <Chip label="Last: 2h ago" color="info" size="small" />
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard; 