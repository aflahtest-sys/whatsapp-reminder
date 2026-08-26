import { requireOrgUser } from "@/lib/auth/guards";
import { listReservations } from "@/lib/services/reservation";
import { listCustomers } from "@/lib/services/customer";
import { getResortProperty } from "@/lib/services/property";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { ReservationList } from "@/components/reservations/reservation-list";

export default async function ReservationsPage() {
  const session = await requireOrgUser();
  const organizationId = session.user.organizationId;
  const locale = await getLocale();
  const dict = getDictionary(locale);

  let reservations: {
    id: string;
    customerId: string;
    propertyId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    nights: number;
    totalPrice: number;
    depositAmount: number;
    remainingBalance: number;
    status: string;
    source: string;
    cancellationReason: string | null;
    depositRefundable: boolean | null;
    notes: string | null;
    createdAt: string;
    customer: { name: string; phone: string; email: string | null };
    payments: {
      id: string;
      type: string;
      amount: number;
      status: string;
      method: string;
      paidAt: string | null;
      verifiedBy: string | null;
    }[];
  }[] = [];
  let customers: { id: string; name: string; phone: string }[] = [];
  let propertyId: string | null = null;

  if (organizationId) {
    const property = await getResortProperty(organizationId);
    if (property) {
      propertyId = property.id;
      const dbReservations = await listReservations(organizationId, {
        propertyId: property.id,
      });
      reservations = dbReservations.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        propertyId: r.propertyId,
        checkIn: r.checkIn.toISOString(),
        checkOut: r.checkOut.toISOString(),
        guests: r.guests,
        nights: r.nights,
        totalPrice: Number(r.totalPrice),
        depositAmount: Number(r.depositAmount),
        remainingBalance: Number(r.remainingBalance),
        status: r.status,
        source: r.source,
        cancellationReason: r.cancellationReason,
        depositRefundable: r.depositRefundable,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
        customer: r.customer,
        payments: r.payments.map((p) => ({
          id: p.id,
          type: p.type,
          amount: Number(p.amount),
          status: p.status,
          method: p.method,
          paidAt: p.paidAt?.toISOString() ?? null,
          verifiedBy: p.verifiedBy,
        })),
      }));
    }

    const dbCustomers = await listCustomers(organizationId);
    customers = dbCustomers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{dict.nav.reservations}</h1>
      </div>

      {propertyId ? (
        <ReservationList
          reservations={reservations}
          customers={customers}
          propertyId={propertyId}
          locale={locale}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
          <p className="text-sm font-semibold text-stone-700">{dict.resort.noPropertyTitle}</p>
          <p className="mt-1 text-sm text-stone-500">{dict.resort.noPropertyHint}</p>
        </div>
      )}
    </div>
  );
}
