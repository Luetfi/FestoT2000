'use client';

import { Suspense, useState, useEffect, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { FestoLogo } from '@/components/ui/festo-logo';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Dictionary, Locale } from '@/lib/dictionaries/get-dictionary';

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const lang: Locale = langParam === 'en' ? 'en' : 'de';
  const from = searchParams.get('from') || '/admin/review';

  const [dict, setDict] = useState<Dictionary | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadDict = async () => {
      const dictModule = await import(`@/lib/dictionaries/${lang}.json`);
      setDict(dictModule.default);
    };
    loadDict();
  }, [lang]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        // Full page reload so middleware sees the new admin cookie
        const target = from.includes('lang=') ? from : `${from}${from.includes('?') ? '&' : '?'}lang=${lang}`;
        window.location.href = target;
        return;
      } else {
        setError(dict?.loginError || 'Invalid credentials');
      }
    } catch {
      setError(dict?.loginError || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  if (!dict) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <FestoLogo height={32} className="mb-4" />
          <h1 className="text-2xl font-[family-name:var(--font-title)] text-foreground">
            {dict.adminAreaTitle}
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{dict.loginTitle}</CardTitle>
            <p className="text-sm text-muted-foreground">{dict.adminLoginSubtitle}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="username" className="text-sm font-medium text-foreground">
                  {dict.usernameLabel}
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder={dict.usernamePlaceholder}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  {dict.passwordLabel}
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder={dict.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? dict.loginLoading : dict.loginButton}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
