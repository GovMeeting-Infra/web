'use client';

import { useState, useRef, use } from 'react';
import { useGeolocation } from '@/lib/hooks/useGeolocation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SignatureCanvas from 'react-signature-canvas';

export default function CheckInPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const { latitude, longitude, accuracy, error: geoError } = useGeolocation();
  const signCanvasRef = useRef<any>(null);
  const [signedName, setSignedName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCheckIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!signedName.trim()) {
        setError('Please enter your name');
        setIsLoading(false);
        return;
      }

      const signature = signCanvasRef.current?.getTrimmedCanvas().toDataURL();
      if (!signature) {
        setError('Please provide a signature');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`/api/v1/checkin/${resolvedParams.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          signedName,
          signature,
          lat: latitude,
          lng: longitude,
          gpsAccuracy: accuracy,
          withinGeofence: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || 'Check-in failed');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <Card className="w-96">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-green-600">✓ Check-In Successful</CardTitle>
            <CardDescription>Thank you for attending!</CardDescription>
          </CardHeader>
          <CardContent className="text-center text-slate-600">
            Your attendance has been recorded.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Event Check-In</CardTitle>
          <CardDescription>Sign in to confirm your attendance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {geoError && (
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-700">
              Location: {geoError}
            </div>
          )}

          {latitude && longitude && (
            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
              Location obtained ({accuracy?.toFixed(1)}m accuracy)
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Your Name</label>
            <Input
              type="text"
              placeholder="Enter your full name"
              value={signedName}
              onChange={(e) => setSignedName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Your Signature</label>
            <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
              <SignatureCanvas
                ref={signCanvasRef}
                canvasProps={{
                  width: 280,
                  height: 150,
                  className: 'border-0 w-full',
                }}
                penColor="black"
                backgroundColor="white"
              />
            </div>
            <button
              type="button"
              onClick={() => signCanvasRef.current?.clear()}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Clear signature
            </button>
          </div>

          <Button
            onClick={handleCheckIn}
            className="w-full"
            disabled={isLoading || !signedName.trim()}
          >
            {isLoading ? 'Checking in...' : 'Check In'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
