// MaskedPhone — SPEC.md §9.7. Used in client views only.
import { maskPhone } from '@/lib/formatters';

type Props = {
  phone: string | null | undefined;
  className?: string;
};

export function MaskedPhone({ phone, className }: Props) {
  return <span className={className}>{maskPhone(phone)}</span>;
}
