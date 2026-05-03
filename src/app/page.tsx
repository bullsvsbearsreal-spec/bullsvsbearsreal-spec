// Root — redirect to /home. The terminal landing lives at /home.
import { redirect } from 'next/navigation';

export default function Root() {
  redirect('/home');
}
