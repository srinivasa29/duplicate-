import { useState } from 'react';
import api from '../api/api';
import { useGoogleLogin } from '@react-oauth/google';
import AuthLayout from '../components/auth/AuthLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Eye, EyeOff, ChevronDown } from 'lucide-react';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true);
      const res = await api.post('/auth/google', { token: tokenResponse.credential || tokenResponse.access_token, isSignup: false });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userEmail', res.data.email || '');
      localStorage.setItem('user', JSON.stringify({ username: res.data.username, email: res.data.email }));
      window.location.href = '/dashboard';
      } catch (error) {
        setLoading(false);
        setErrors({ general: error.response?.data?.error || 'Google Login Failed' });
      }
    },
    onError: () => {
      setErrors({ general: 'Google Login Failed' });
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { identifier, password } = formData;

    if (!identifier || !password) {
      setErrors({ general: 'Please fill in all fields' });
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/auth/login', {
        username: identifier,



        password
      });

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userEmail', res.data.email || identifier);
      localStorage.setItem('user', JSON.stringify({ username: res.data.username, email: res.data.email || identifier }));
      window.location.href = '/dashboard';
    } catch (error) {
      setLoading(false);
      setErrors({ general: error.response?.data?.error || 'Login Failed' });
    }
  };

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-10">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2 font-['Plus_Jakarta_Sans'] tracking-tight">Log in to Radar</h2>
          <p className="text-gray-500 text-sm font-medium">Welcome back! Please enter your details.</p>
        </div>

        {errors.general && (
          <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {errors.general}
          </div>
        )}

        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="relative">
                <input
                  type="text"
                  name="identifier"
                  value={formData.identifier}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#10706B] focus:ring-4 focus:ring-[#10706B]/5 hover:border-[#10706B]/50 transition-all text-sm font-medium"
                  placeholder="Username / Email"
                />
              </div>
            </div>

            <div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#10706B] focus:ring-4 focus:ring-[#10706B]/5 hover:border-[#10706B]/50 transition-all text-sm font-medium"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex justify-between items-center mt-2 px-4">
                <a href="/forgot-password" className="text-sm text-[#10706B] hover:underline font-semibold">Forgot Password?</a>
              </div>
            </div>




            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full bg-[#10706B] text-white font-bold py-4 rounded-xl hover:bg-[#0D5C58] transition-all shadow-lg shadow-[#10706B]/20 text-sm tracking-[0.1em] uppercase mt-2"
            >
              {loading ? 'LOGGING IN...' : 'LOG IN'}
            </motion.button>
          </form>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase tracking-wider font-medium">Or continue with</span>
            <div className="flex-grow border-t border-gray-100"></div>
          </div>

          <div className="flex flex-col gap-4">
            <motion.button
              whileHover={{ y: -2, shadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
              whileTap={{ scale: 0.99 }}
              type="button"
              onClick={() => handleGoogleLogin()}
              className="w-full flex items-center justify-center gap-3 py-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all bg-white shadow-sm font-bold text-gray-700 text-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign in with Google
            </motion.button>
          </div>

          <div className="text-center pt-2">
            <span className="text-gray-500 text-sm">Don't have an account? </span>
            <a href="/register" className="text-[#10706B] font-bold text-sm hover:underline">Sign Up</a>
          </div>
        </div>
      </motion.div>
    </AuthLayout>
  );
}
