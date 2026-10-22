import { redirect } from 'next/navigation';

// /admin has no content of its own — send admins to the review queue.
export default function AdminIndexPage() {
  redirect('/admin/review');
}
