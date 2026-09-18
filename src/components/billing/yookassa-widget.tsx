"use client";

export function YooKassaWidget({ onError }: { confirmationToken?: string; onSuccess?: () => void; onError?: () => void }) {
  return <p className="rounded-xl bg-[#fff7ed] px-3 py-3 text-sm text-[#9a5b13]" onClick={onError}>Оплата подключается отдельно для этого standalone-продукта. Используйте локальный demo-доступ к production pack.</p>;
}
