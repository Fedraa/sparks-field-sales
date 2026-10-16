import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  LogIn,
} from 'lucide-react';

export interface InternalLoginCredential {
  username: string;
  password: string;
}

export interface InternalLoginProps {
  /** Callback saat login berhasil */
  onLoginSuccess: () => void;
  /** Callback saat membatalkan login */
  onCancel: () => void;
  /**
   * Kredensial kustom yang diterima (opsional).
   * Jika tidak diisi, menggunakan kredensial internal standar.
   */
  credentials?: InternalLoginCredential[];
}

/**
 * Kredensial default untuk verifikasi akses Dashboard Internal
 */
const DEFAULT_CREDENTIALS: InternalLoginCredential[] = [
  { username: 'admin', password: 'sparks123' },
  { username: 'manager', password: 'sparks123' },
  { username: 'internal', password: 'sparks123' },
];

export const InternalLogin: React.FC<InternalLoginProps> = ({
  onLoginSuccess,
  onCancel,
  credentials,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ambil daftar kredensial yang valid
  const validCredentials = credentials && credentials.length > 0 ? credentials : DEFAULT_CREDENTIALS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setError('Harap masukkan username dan password.');
      return;
    }

    setIsSubmitting(true);

    // Verifikasi kredensial
    const matched = validCredentials.some(
      (c) => c.username.trim().toLowerCase() === cleanUser && c.password === cleanPass
    );

    // Cek juga kemungkinan env var (jika disetel di environment client)
    const envUser = (import.meta.env.VITE_INTERNAL_USERNAME as string | undefined)?.trim().toLowerCase();
    const envPass = import.meta.env.VITE_INTERNAL_PASSWORD as string | undefined;
    const envMatched = envUser && envPass && envUser === cleanUser && envPass === cleanPass;

    if (matched || envMatched) {
      setIsSubmitting(false);
      onLoginSuccess();
    } else {
      setIsSubmitting(false);
      setError('Username atau password salah. Pastikan kredensial Anda benar.');
    }
  };

  return (
    <div className="min-h-[500px] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-[#DCE8DE] rounded-2xl shadow-lg p-6 sm:p-8">
        {/* Header Ikon & Judul */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#E3F2E7] border border-[#BFE0C9] flex items-center justify-center text-[#254C33] mb-3 shadow-xs">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#173020] tracking-tight">
            Dashboard Internal
          </h2>
          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF6DC] text-[#865E0C] border border-[#F4E1A3]">
            <Lock className="w-3 h-3" />
            Khusus Manager / Internal
          </div>
          <p className="mt-2 text-xs text-[#5A7766] max-w-xs">
            Silakan masukkan kredensial resmi untuk mengakses laporan analitik lengkap dan performa tim.
          </p>
        </div>

        {/* Pesan Error */}
        {error && (
          <div
            role="alert"
            className="mb-5 p-3 rounded-xl bg-[#FDE8E8] border border-[#F8B4B4] text-[#9B1C1C] flex items-start gap-2.5 text-xs font-semibold animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#E02424]" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Input Username */}
          <div>
            <label
              htmlFor="internal-username"
              className="block text-xs font-bold text-[#295637] mb-1.5"
            >
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7E9787]">
                <User className="w-4 h-4" />
              </div>
              <input
                id="internal-username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Masukkan username"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#D5E5DA] bg-white text-sm text-[#173020] placeholder-[#9BAFA3] focus:outline-none focus:ring-2 focus:ring-[#3B7451]/30 focus:border-[#3B7451] transition"
                autoFocus
              />
            </div>
          </div>

          {/* Input Password */}
          <div>
            <label
              htmlFor="internal-password"
              className="block text-xs font-bold text-[#295637] mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7E9787]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="internal-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Masukkan password"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-[#D5E5DA] bg-white text-sm text-[#173020] placeholder-[#9BAFA3] focus:outline-none focus:ring-2 focus:ring-[#3B7451]/30 focus:border-[#3B7451] transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#7E9787] hover:text-[#254C33] focus:outline-none"
                tabIndex={-1}
                title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Tombol Aksi */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#254C33] hover:bg-[#1E3A28] text-white font-bold text-sm shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <LogIn className="w-4 h-4" />
              <span>{isSubmitting ? 'Memproses...' : 'Masuk'}</span>
            </button>

            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-[#D5E5DA] bg-white hover:bg-[#F4F8F5] text-[#4A5D52] font-semibold text-xs transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Batal / Kembali ke Menu Utama</span>
            </button>
          </div>
        </form>

        {/* Catatan Privasi / Bantuan */}
        <div className="mt-6 pt-4 border-t border-[#EEF3F0] text-center">
          <p className="text-[11px] text-[#8AA092]">
            Hubungi administrator jika Anda memerlukan akses akun atau lupa password.
          </p>
        </div>
      </div>
    </div>
  );
};
