"use client";

import { useEffect, useRef, useState } from "react";

export interface PincodeLookupResult {
  city: string;
  state: string;
  loading: boolean;
  error: string | null;
}

/**
 * Client hook: given a pincode string, resolves city/state via
 * /api/pincode/[code]. Fires only when the pincode is 6 digits.
 * Debounced so typing doesn't spam the lookup.
 */
export function usePincodeLookup(pincode: string): PincodeLookupResult {
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const code = pincode.trim();
    if (!/^\d{6}$/.test(code)) {
      setCity("");
      setState("");
      setError(code.length === 6 ? "Invalid pincode" : null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pincode/${code}`);
        if (!res.ok) {
          setError("Could not find this pincode — please enter city/state manually.");
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { city: string; state: string };
        setCity(data.city || "");
        setState(data.state || "");
      } catch {
        setError("Lookup failed — please enter city/state manually.");
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pincode]);

  return { city, state, loading, error };
}
