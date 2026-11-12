import type { ReactNode } from 'react';
import RoleLayout from '@/components/layout/RoleLayout';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleLayout>{children}</RoleLayout>;
}
