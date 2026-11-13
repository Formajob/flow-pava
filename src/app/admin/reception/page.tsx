import { redirect } from 'next/navigation';

/** Ancienne route Réception → Importation (renommée). */
export default function ReceptionRedirect() {
  redirect('/admin/importation');
}
