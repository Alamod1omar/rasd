'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BranchesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings?tab=branches');
  }, [router]);

  return null;
}
