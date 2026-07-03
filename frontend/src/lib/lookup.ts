import type { Apartment, User, Vendor } from "./types";

export function userName(users: User[] | undefined, id?: string | null): string {
  if (!id) return "—";
  return users?.find((u) => u.id === id)?.name ?? "—";
}

export function ownerNameFor(
  users: User[] | undefined,
  apartments: Apartment[] | undefined,
  apartmentId: string
): string {
  const apt = apartments?.find((a) => a.id === apartmentId);
  const ownerId = apt?.ownerIds[0];
  return userName(users, ownerId);
}

export function vendorFor(
  vendors: Vendor[] | undefined,
  id?: string | null
): Vendor | undefined {
  return id ? vendors?.find((v) => v.id === id) : undefined;
}

export function aptNumber(apartmentId: string): string {
  return apartmentId.replace("apt-", "");
}
