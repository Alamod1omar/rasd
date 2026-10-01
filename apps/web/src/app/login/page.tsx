'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { RasdButton } from '@/components/ui/RasdButton';
import { RasdInput } from '@/components/ui/RasdInput';
import { ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const { showError } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto-fill if "Remember This Device" was enabled
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isRemembered = localStorage.getItem('rasd_remember_device') === 'true';
      if (isRemembered) {
        setRememberDevice(true);
        const savedUser = localStorage.getItem('rasd_saved_username') || '';
        const savedPass = localStorage.getItem('rasd_saved_password') || '';
        if (savedUser) setUsername(savedUser);
        if (savedPass) setPassword(savedPass);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      showError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    try {
      await login(username.trim(), password);

      // Save or clear credentials based on "Remember This Device"
      if (typeof window !== 'undefined') {
        if (rememberDevice) {
          localStorage.setItem('rasd_remember_device', 'true');
          localStorage.setItem('rasd_saved_username', username.trim());
          localStorage.setItem('rasd_saved_password', password);
        } else {
          localStorage.removeItem('rasd_remember_device');
          localStorage.removeItem('rasd_saved_username');
          localStorage.removeItem('rasd_saved_password');
        }
      }
    } catch (err: any) {
      showError(err.message || 'فشل تسجيل الدخول، يرجى التأكد من البيانات المدخلة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 sm:p-10 space-y-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <img src="/logo.png" alt="رَصْد RASD" className="w-16 h-16 object-contain mx-auto rounded-2xl shadow-sm" />
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">رَصْد | RASD</h1>
          <p className="text-xs text-slate-500 font-medium">نظام رصد المبيعات السريعة والقطع الناقصة لقطع الغيار</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <RasdInput
            label="اسم المستخدم"
            ltr
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoFocus={!username}
            required
          />

          <RasdInput
            label="كلمة المرور"
            type="password"
            ltr
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {/* Remember This Device */}
          <div className="flex items-center justify-between text-xs py-1 select-none">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="w-4 h-4 rounded-md border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900 transition-all"
              />
              <span className="font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                تذكّر هذا الجهاز
              </span>
            </label>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>جلسة صالحة لمدة أسبوع</span>
            </span>
          </div>

          <RasdButton
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full font-bold shadow-md cursor-pointer"
          >
            تسجيل الدخول
          </RasdButton>
        </form>
      </div>
    </div>
  );
}
