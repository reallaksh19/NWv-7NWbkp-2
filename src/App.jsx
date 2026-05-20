/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';

// ── ErrorBoundary: prevents one page crash from blanking the entire app ──
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px 16px', textAlign: 'center',
          color: '#9CA5B0', fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
          <strong style={{ color: '#D0D7DE' }}>This page encountered an error</strong>
          <p style={{ fontSize: '0.82rem', marginTop: '8px' }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '12px', padding: '6px 16px', borderRadius: '8px',
              border: '1px solid rgba(48,54,61,0.65)', background: 'rgba(18,23,30,0.6)',
              color: '#D0D7DE', cursor: 'pointer', fontSize: '0.82rem'
            }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import MainPage from './pages/MainPage';
import UpAheadPage from './pages/UpAheadPage';
import MyPlannerPage from './pages/MyPlannerPage';
import WeatherPage from './pages/WeatherPage';
import MarketPage from './pages/MarketPage';
import TechSocialPage from './pages/TechSocialPage';
import NewspaperPage from './pages/NewspaperPage';
import SettingsPage from './pages/SettingsPage';
import RefreshPage from './pages/RefreshPage';
import FollowingPage from './pages/FollowingPage';
import TopicDetail from './pages/TopicDetail';
import MorePage from './pages/MorePage';
import InsightPage from './pages/InsightPage';
import BottomNav from './components/BottomNav';
import ScrollToTop from './components/ScrollToTop';
import DebugConsole from './components/DebugConsole';
import OnThisDayVisibilityController from './components/settings/OnThisDayVisibilityController.jsx';
import { WeatherProvider, useWeather } from './context/WeatherContext';
import { NewsProvider, useNews } from './context/NewsContext';
import { MarketProvider } from './context/MarketContext';
import { SettingsProvider } from './context/SettingsContext';
import { SegmentProvider } from './context/SegmentContext';
import { TopicProvider } from './context/TopicContext';
import './index.css';
import './styles/desktopRevamp.css';
import './styles/desktopPolish.css';
import './styles/weatherProfessionalTheme.css';

/**
 * Global Progress Bar
 * "Deep Architect Mode" - High visibility, smooth animation, top of screen.
 */
const GlobalLoader = () => {
  const { loading: newsLoading } = useNews();
  const { loading: weatherLoading } = useWeather();
  const isLoading = newsLoading || weatherLoading;
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer;
    if (isLoading) {
      setTimeout(() => setVisible(true), 0);
      setProgress(10); // Start
      timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          const increment = Math.max(1, (90 - prev) / 10);
          return prev + increment;
        });
      }, 200);
    } else {
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 400); // Fade out after completion
    }
    return () => clearInterval(timer);
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '3px',
      zIndex: 100000,
      pointerEvents: 'none'
    }}>
      <div style={{
        height: '100%',
        width: `${progress}%`,
        background: 'linear-gradient(90deg, #00D4AA, #58A6FF, #F0883E)',
        boxShadow: '0 0 10px rgba(0, 212, 170, 0.5)',
        transition: 'width 0.2s ease-out',
        borderRadius: '0 2px 2px 0'
      }} />
    </div>
  );
};

function App() {
  console.log('[App] Rendering root component...');
  return (
    <SettingsProvider>
      <SegmentProvider>
        <WeatherProvider lazy={true}>
          <NewsProvider>
            <MarketProvider>
              <TopicProvider>
                <HashRouter>
                <ScrollToTop />
                <GlobalLoader />
                <DebugConsole />
                <OnThisDayVisibilityController />
                <div className="app app-shell">
                  <Routes>
                    <Route path="/" element={<ErrorBoundary><MainPage /></ErrorBoundary>} />
                    <Route path="/insight" element={<ErrorBoundary><InsightPage /></ErrorBoundary>} />
                    <Route path="/markets" element={<ErrorBoundary><MarketPage /></ErrorBoundary>} />
                    <Route path="/up-ahead" element={<ErrorBoundary><UpAheadPage /></ErrorBoundary>} />
                    <Route path="/my-planner" element={<ErrorBoundary><MyPlannerPage /></ErrorBoundary>} />
                    <Route path="/more" element={<ErrorBoundary><MorePage /></ErrorBoundary>} />
                    <Route path="/weather" element={<ErrorBoundary><WeatherPage /></ErrorBoundary>} />
                    <Route path="/tech-social" element={<ErrorBoundary><TechSocialPage /></ErrorBoundary>} />
                    <Route path="/newspaper" element={<ErrorBoundary><NewspaperPage /></ErrorBoundary>} />
                    <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
                    <Route path="/refresh" element={<ErrorBoundary><RefreshPage /></ErrorBoundary>} />
                    <Route path="/following" element={<ErrorBoundary><FollowingPage /></ErrorBoundary>} />
                    <Route path="/following/:topicId" element={<ErrorBoundary><TopicDetail /></ErrorBoundary>} />
                  </Routes>
                  <BottomNav />
                </div>
                </HashRouter>
              </TopicProvider>
            </MarketProvider>
          </NewsProvider>
        </WeatherProvider>
      </SegmentProvider>
    </SettingsProvider>
  );
}

export default App;
