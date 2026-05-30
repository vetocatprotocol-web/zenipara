import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Zap, Users, BarChart3, Lock } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { APP_ROUTE_PATHS, getRoleDefaultPath } from '../lib/rolePermissions';
import { usePlatformStore } from '../store/platformStore';

export default function Landing() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const { settings } = usePlatformStore();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const redirectPath = getRoleDefaultPath(user.role) ?? APP_ROUTE_PATHS.login;
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleLoginClick = () => {
    navigate(APP_ROUTE_PATHS.login);
  };

  const features = [
    {
      icon: Shield,
      title: 'Keamanan Terjamin',
      description: 'Sistem keamanan tingkat militer dengan enkripsi end-to-end untuk melindungi data Anda',
    },
    {
      icon: Zap,
      title: 'Performa Cepat',
      description: 'Teknologi terdepan yang memastikan aplikasi responsif dan efisien di semua perangkat',
    },
    {
      icon: Users,
      title: 'Manajemen Personel',
      description: 'Kelola seluruh aspek penugasan dan penjadwalan personel dengan mudah',
    },
    {
      icon: BarChart3,
      title: 'Laporan Real-time',
      description: 'Dashboard analitik komprehensif untuk monitoring operasional 24/7',
    },
    {
      icon: Lock,
      title: 'Kontrol Akses',
      description: 'Sistem role-based yang fleksibel untuk manajemen izin pengguna',
    },
    {
      icon: Zap,
      title: 'Skalabilitas',
      description: 'Platform yang dapat berkembang mengikuti kebutuhan organisasi Anda',
    },
  ];

  return (
    <main className="min-h-screen bg-military-dark overflow-hidden">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-accent-red/20 bg-military-dark/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-accent-red" />
            <h1 className="text-2xl font-bold text-text-primary">
              {settings?.platformName || 'Sistem Operasional Militer'}
            </h1>
          </div>
          <button
            onClick={handleLoginClick}
            className="px-6 py-2 bg-accent-red hover:bg-accent-red/90 text-white font-medium rounded-lg transition-colors"
          >
            Masuk
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-20">
        {/* Background gradient effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-accent-red/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-text-primary leading-tight">
              Platform Manajemen <span className="text-accent-red">Operasional</span> Terintegrasi
            </h2>
            <p className="text-xl sm:text-2xl text-text-muted max-w-2xl mx-auto">
              Solusi komprehensif untuk manajemen personel, penjadwalan, dan laporan operasional dengan teknologi keamanan terkini
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <button
              onClick={handleLoginClick}
              className="px-8 py-4 bg-accent-red hover:bg-accent-red/90 text-white font-bold rounded-lg text-lg transition-all hover:shadow-lg hover:shadow-accent-red/50 flex items-center gap-2 group"
            >
              Masuk Sekarang
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 border-2 border-accent-red/50 hover:border-accent-red text-accent-red font-bold rounded-lg text-lg transition-colors hover:bg-accent-red/10"
            >
              Pelajari Lebih Lanjut
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-12 text-center">
            <div className="space-y-2">
              <p className="text-3xl font-bold text-accent-red">99.9%</p>
              <p className="text-sm text-text-muted">Uptime</p>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-accent-red">24/7</p>
              <p className="text-sm text-text-muted">Monitoring</p>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-accent-red">Real-time</p>
              <p className="text-sm text-text-muted">Sinkronisasi</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-surface/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h3 className="text-4xl sm:text-5xl font-bold text-text-primary">Fitur Unggulan</h3>
            <p className="text-xl text-text-muted max-w-2xl mx-auto">
              Lengkap dengan semua yang Anda butuhkan untuk mengelola operasional dengan efisien
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-8 rounded-2xl border border-accent-red/20 bg-bg-card hover:border-accent-red/50 hover:shadow-lg hover:shadow-accent-red/10 transition-all group"
              >
                <div className="mb-4 inline-flex p-3 rounded-lg bg-accent-red/10 group-hover:bg-accent-red/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-accent-red" />
                </div>
                <h4 className="text-xl font-bold text-text-primary mb-3">{feature.title}</h4>
                <p className="text-text-muted">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto bg-gradient-to-r from-accent-red/10 via-primary/10 to-accent-red/10 rounded-2xl border border-accent-red/30 p-12 text-center space-y-6">
          <h3 className="text-3xl sm:text-4xl font-bold text-text-primary">Siap untuk Memulai?</h3>
          <p className="text-lg text-text-muted">
            Akses platform operasional Anda sekarang dan tingkatkan efisiensi manajemen
          </p>
          <button
            onClick={handleLoginClick}
            className="inline-flex px-8 py-4 bg-accent-red hover:bg-accent-red/90 text-white font-bold rounded-lg text-lg transition-all hover:shadow-lg hover:shadow-accent-red/50"
          >
            <span>Masuk ke Aplikasi</span>
            <ArrowRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-accent-red/20 bg-military-dark/50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center text-text-muted text-sm">
          <p>&copy; {new Date().getFullYear()} {settings?.platformName || 'Sistem Operasional Militer'}. Semua hak dilindungi.</p>
        </div>
      </footer>
    </main>
  );
}
