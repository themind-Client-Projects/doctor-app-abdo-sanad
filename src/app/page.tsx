import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redirect users visiting the root URL to the patient portal home page
  redirect('/home');
}
