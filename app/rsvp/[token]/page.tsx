'use client';

import { useState, use } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RSVPPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'declined' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRSVP = async (responseStatus: 'CONFIRMED' | 'DECLINED') => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/rsvp/${resolvedParams.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: responseStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || 'RSVP failed');
        return;
      }

      setStatus(responseStatus === 'CONFIRMED' ? 'confirmed' : 'declined');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (status) {
    return (
      <div className="flex items-center justify-center min-h-dvh p-4 bg-gradient-to-br from-green-50 to-emerald-100">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-green-600">✓ RSVP Recorded</CardTitle>
            <CardDescription>
              Your response has been {status === 'confirmed' ? 'confirmed' : 'declined'}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-slate-600">
            Thank you for your response!
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-dvh p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Event Invitation</CardTitle>
          <CardDescription>Will you be attending?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={() => handleRSVP('CONFIRMED')}
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Recording...' : 'Yes, I will attend'}
            </Button>
            <Button
              onClick={() => handleRSVP('DECLINED')}
              variant="secondary"
              className="w-full"
              disabled={isLoading}
            >
              No, I cannot attend
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
