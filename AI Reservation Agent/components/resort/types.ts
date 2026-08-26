export type ClientFacility = {
  key: string;
  label_en: string;
  label_ar: string;
  icon: string;
};

export type ClientPhoto = {
  id: string;
  url: string;
  altText: string | null;
};

export type ClientProperty = {
  id: string;
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
  facilities: ClientFacility[];
  images: ClientPhoto[];
};

export type ClientKnowledgeEntry = {
  id: string;
  type: string;
  question: string | null;
  contentEn: string;
  contentAr: string;
  isActive: boolean;
};
