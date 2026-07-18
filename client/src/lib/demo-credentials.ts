export interface DemoCredential {
  role: string;
  label: string;
  email: string;
  password: string;
}

export const DEMO_CREDENTIALS: DemoCredential[] = [
  { role: 'ADMIN', label: 'Administrator', email: 'admin@zenith.dev', password: 'admin12345' },
  { role: 'EMPLOYEE', label: 'Employee', email: 'employee@zenith.dev', password: 'employee12345' },
];
