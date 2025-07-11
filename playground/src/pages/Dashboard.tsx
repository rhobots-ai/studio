import { useState, useEffect } from 'react';
import { PlusCircle, Brain, History, TrendingUp, Sparkles, Play, Pause, CheckCircle2, XCircle, Clock, Search, Filter, ExternalLink, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Progress } from '../components/ui/Progress';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AnimatedLoader } from '../components/ui/AnimatedLoader';
import { API_BASE_URL_WITH_API } from '../config/api';

interface TrainingSession {
  id: string;
  status: string;
  config: {
    model_name: string;
    num_train_epochs: number;
    learning_rate: number;
  };
  dataset_info: {
    total_rows: number;
    file_type: string;
  };
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress?: number;
}

interface DashboardStats {
  total_sessions: number;
  active_sessions: number;
  completed_sessions: number;
  failed_sessions: number;
  success_rate: number;
  avg_training_time_formatted: string;
  most_used_model: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeSessions, setActiveSessions] = useState<TrainingSession[]>([]);
  const [allSessions, setAllSessions] = useState<TrainingSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<TrainingSession[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sessionsPerPage] = useState(10);

  // Fetch dashboard statistics
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/training/dashboard/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    }
  };

  // Fetch all training sessions
  const fetchSessions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/training/sessions`);
      if (response.ok) {
        const data = await response.json();
        setAllSessions(data.sessions);
        
        // Filter active sessions
        const active = data.sessions.filter((session: TrainingSession) => 
          ['queued', 'running', 'initializing'].includes(session.status)
        );
        setActiveSessions(active);
      }
    } catch (error) {
      console.error('Failed to fetch training sessions:', error);
    }
  };

  // Filter sessions based on search and status
  useEffect(() => {
    let filtered = allSessions;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(session => session.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(session =>
        session.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.config.model_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredSessions(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  }, [allSessions, searchTerm, statusFilter]);

  // Pagination
  const indexOfLastSession = currentPage * sessionsPerPage;
  const indexOfFirstSession = indexOfLastSession - sessionsPerPage;
  const currentSessions = filteredSessions.slice(indexOfFirstSession, indexOfLastSession);
  const totalPages = Math.ceil(filteredSessions.length / sessionsPerPage);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchStats(), fetchSessions()]);
      setIsLoading(false);
    };

    loadData();

    // Set up polling for real-time updates
    const interval = setInterval(() => {
      fetchStats();
      fetchSessions();
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusVariant = (status: string): 'primary' | 'secondary' | 'success' | 'error' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
      case 'queued':
      case 'initializing':
        return 'primary';
      case 'failed':
        return 'error';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'running':
        return <Play className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      case 'queued':
      case 'initializing':
        return <Clock className="h-4 w-4" />;
      default:
        return <Pause className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copySessionUrl = (sessionId: string) => {
    const url = `${window.location.origin}/training/${sessionId}`;
    navigator.clipboard.writeText(url);
    // You could add a toast notification here
  };

  const statsItems = [
    { 
      title: 'Total Sessions', 
      value: stats?.total_sessions?.toString() || '0', 
      icon: Brain, 
      color: 'text-primary-500' 
    },
    { 
      title: 'Active Training', 
      value: stats?.active_sessions?.toString() || '0', 
      icon: Play, 
      color: 'text-secondary-500' 
    },
    { 
      title: 'Success Rate', 
      value: `${stats?.success_rate || 0}%`, 
      icon: TrendingUp, 
      color: 'text-success-500' 
    },
    { 
      title: 'Avg Duration', 
      value: stats?.avg_training_time_formatted || '0s', 
      icon: History, 
      color: 'text-warning-500' 
    },
  ];

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Training Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Monitor and manage your training sessions
          </p>
        </div>
        <Link to="/configure">
          <Button 
            leftIcon={<PlusCircle className="h-4 w-4" />}
            variant="primary"
          >
            Start New Training
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsItems.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card variant="outline" className="hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {item.title}
                    </p>
                    <h3 className="text-2xl font-bold mt-1">
                      {isLoading ? (
                        <AnimatedLoader variant="pulse" size="sm" />
                      ) : (
                        item.value
                      )}
                    </h3>
                  </div>
                  <div className={`p-3 rounded-full bg-opacity-10 ${item.color.replace('text', 'bg')}`}>
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Active Training Sessions */}
      {activeSessions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Play className="h-5 w-5 text-primary-500" />
              Currently Running Training Sessions
            </h2>
            <Badge variant="primary">{activeSessions.length} active</Badge>
          </div>
          
          <div className="grid gap-4">
            {activeSessions.map((session) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/10">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Badge variant={getStatusVariant(session.status)} className="flex items-center gap-1">
                          {getStatusIcon(session.status)}
                          {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                        </Badge>
                        <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                          {session.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copySessionUrl(session.id)}
                          leftIcon={<Copy className="h-3 w-3" />}
                        >
                          Copy URL
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => navigate(`/training/${session.id}`)}
                          leftIcon={<ExternalLink className="h-3 w-3" />}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Model</p>
                        <p className="font-medium">{session.config.model_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Dataset</p>
                        <p className="font-medium">{session.dataset_info.total_rows} examples</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Started</p>
                        <p className="font-medium">
                          {session.started_at ? formatDate(session.started_at) : 'Not started'}
                        </p>
                      </div>
                    </div>
                    
                    {session.progress !== undefined && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{session.progress}%</span>
                        </div>
                        <Progress value={session.progress} variant="primary" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Training History */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <History className="h-5 w-5 text-gray-500" />
            Training History
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="queued">Queued</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AnimatedLoader variant="dots" size="md" text="Loading training history..." />
            </CardContent>
          </Card>
        ) : filteredSessions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No training sessions found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Start your first training session to see it here.'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Link to="/configure">
                  <Button variant="primary">Start Training</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Session
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Model
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Dataset
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {currentSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                              {session.id.substring(0, 8)}...
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-gray-100">
                              {session.config.model_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={getStatusVariant(session.status)} className="flex items-center gap-1 w-fit">
                              {getStatusIcon(session.status)}
                              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-gray-100">
                              {session.dataset_info.total_rows} examples
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {session.dataset_info.file_type}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(session.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copySessionUrl(session.id)}
                                leftIcon={<Copy className="h-3 w-3" />}
                              >
                                Copy URL
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => navigate(`/training/${session.id}`)}
                                leftIcon={<ExternalLink className="h-3 w-3" />}
                              >
                                View
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {indexOfFirstSession + 1} to {Math.min(indexOfLastSession, filteredSessions.length)} of {filteredSessions.length} sessions
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/configure">
            <Card variant="outline" className="h-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-full bg-primary-100 dark:bg-primary-900/20">
                    <PlusCircle className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-medium">Start New Training</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Configure and start a new training session</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/query">
            <Card variant="outline" className="h-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-full bg-secondary-100 dark:bg-secondary-900/20">
                    <Sparkles className="h-6 w-6 text-secondary-600 dark:text-secondary-400" />
                  </div>
                  <div>
                    <h3 className="font-medium">Query Models</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Test and compare your trained models</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/progress">
            <Card variant="outline" className="h-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-full bg-success-100 dark:bg-success-900/20">
                    <TrendingUp className="h-6 w-6 text-success-600 dark:text-success-400" />
                  </div>
                  <div>
                    <h3 className="font-medium">Monitor Progress</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">View current training progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
