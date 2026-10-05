import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/components/AuthLayout';
import { Settings } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const APPROVALS_TOKEN_KEY = 'approvals_token';
const APPROVALS_USER_KEY = 'approvals_user';

const clearApprovalsSession = () => {
  sessionStorage.removeItem(APPROVALS_TOKEN_KEY);
  sessionStorage.removeItem(APPROVALS_USER_KEY);
  localStorage.removeItem(APPROVALS_TOKEN_KEY);
  localStorage.removeItem(APPROVALS_USER_KEY);
};

export default function ApprovalsLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/approvals/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Login failed');
      }
      const data = await res.json();
      const token = data?.token;
      const user = data?.user;

      if (!token || !user) {
        throw new Error('Session approver invalide');
      }

      clearApprovalsSession();
      sessionStorage.setItem(APPROVALS_TOKEN_KEY, token);
      sessionStorage.setItem(APPROVALS_USER_KEY, JSON.stringify(user));
      window.location.replace('/approvals');
    } catch (err) {
      toast({ title: 'Erreur', description: err.message || 'Login failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout icon={Settings} title="Approvals Login" subtitle="Connectez-vous pour valider les inscriptions">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Mot de passe</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full">{loading ? 'Connexion...' : 'Se connecter'}</Button>
      </form>
    </AuthLayout>
  );
}
