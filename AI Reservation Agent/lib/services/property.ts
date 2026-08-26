import { prisma } from "@/lib/db";

export type FacilityInput = {
  key: string;
  label_en: string;
  label_ar: string;
  icon: string;
};

export type PhotoInput = {
  url: string;
  altText?: string;
};

export type PropertyUpdateData = {
  name: string;
  description: string;
  addressText: string;
  mapsUrl: string | null;
  checkInTime: string;
  checkOutTime: string;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  minStayNights: number;
  allowSameDayBooking: boolean;
  depositAmount: string;
  cancellationRefundDays: number;
  facilities: FacilityInput[];
};

export type ServiceResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function getResortProperty(organizationId: string) {
  return prisma.property.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function propertyBelongsToOrg(
  organizationId: string,
  propertyId: string
): Promise<boolean> {
  const found = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
    select: { id: true },
  });
  return found !== null;
}

export async function updateProperty(
  organizationId: string,
  propertyId: string,
  data: PropertyUpdateData
): Promise<ServiceResult> {
  if (!(await propertyBelongsToOrg(organizationId, propertyId))) {
    return { ok: false, error: "not_found" };
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      name: data.name,
      description: data.description,
      addressText: data.addressText,
      mapsUrl: data.mapsUrl,
      checkInTime: data.checkInTime,
      checkOutTime: data.checkOutTime,
      maxGuests: data.maxGuests,
      bedrooms: data.bedrooms,
      beds: data.beds,
      bathrooms: data.bathrooms,
      minStayNights: data.minStayNights,
      allowSameDayBooking: data.allowSameDayBooking,
      depositAmount: data.depositAmount,
      cancellationRefundDays: data.cancellationRefundDays,
      facilities: data.facilities,
    },
  });

  return { ok: true };
}

export async function syncPropertyPhotos(
  organizationId: string,
  propertyId: string,
  photos: PhotoInput[]
): Promise<ServiceResult> {
  if (!(await propertyBelongsToOrg(organizationId, propertyId))) {
    return { ok: false, error: "not_found" };
  }

  await prisma.$transaction([
    prisma.propertyImage.deleteMany({ where: { propertyId } }),
    ...photos.map((photo, index) =>
      prisma.propertyImage.create({
        data: {
          propertyId,
          url: photo.url,
          altText: photo.altText?.trim() || null,
          sortOrder: index,
        },
      })
    ),
  ]);

  return { ok: true };
}
